# Real-time Streaming API Generation with Chat-based Version Control

## Overview

Build a V0-style chat interface where users iteratively create and modify their APIs through conversation. Each prompt generates a new version with real-time streaming, animated code display, and the ability to switch between versions to see different iterations.

## Core Features

### 1. Chat-Based Versioning System

**Version Flow:**

- First prompt at `/ask` → Creates project + v1
- Redirect to `/projects/[projectId]` with chat interface
- Each subsequent prompt → New version (v2, v3, v4...)
- Users can switch between versions via dropdown in code viewer

**Database Schema Changes:**

New table: `api_versions`

```sql
- id (uuid)
- project_id (uuid, foreign key)
- version_number (integer)
- prompt (text) - The user's request
- ai_response (text) - Summary of what was generated
- status (enum: pending, generating, complete, failed)
- created_at (timestamp)
```

New table: `version_files`

```sql
- id (uuid)
- version_id (uuid, foreign key)
- file_path (text)
- content_diff (jsonb) - Stores diff from previous version
- full_content (text) - Complete file content for first version or major changes
- operation (enum: created, modified, deleted)
- created_at (timestamp)
```

New table: `chat_messages`

```sql
- id (uuid)
- project_id (uuid, foreign key)
- version_id (uuid, nullable, foreign key)
- role (enum: user, assistant, system)
- content (text)
- created_at (timestamp)
```

**Why diffs + full content hybrid:**

- v1: Store complete files
- v2+: Store diffs for efficiency
- On reconstruction: Apply diffs to reconstruct full file on-demand
- Cache reconstructed files in memory for fast switching
- If diff chain gets too long (>10 versions), create new full snapshot

### 2. Updated Project Page Architecture

**Layout:** `/projects/[projectId]/project-page-client.tsx`

```
┌─────────────────────────────────────────────────────┐
│  Header: Project Name | Version Dropdown (v1, v2..) │
├──────────────────┬──────────────────────────────────┤
│                  │  Code Viewer                     │
│  Chat Interface  │  ┌────────────────────────────┐  │
│  ┌────────────┐  │  │ File Explorer (left panel) │  │
│  │ Message 1  │  │  │ ┌────────────────────────┐ │  │
│  │ (User)     │  │  │ │ src/                   │ │  │
│  └────────────┘  │  │ │   index.ts             │ │  │
│  ┌────────────┐  │  │ │   routes/              │ │  │
│  │ Response 1 │  │  │ └────────────────────────┘ │  │
│  │ (AI)       │  │  └────────────────────────────┘  │
│  └────────────┘  │  ┌────────────────────────────┐  │
│  ...             │  │ Code Editor (right panel)  │  │
│  ┌────────────┐  │  │ [Streaming code display]   │  │
│  │ Input box  │  │  │                            │  │
│  └────────────┘  │  └────────────────────────────┘  │
└──────────────────┴──────────────────────────────────┘
```

**Responsive behavior:**

- Desktop: Side-by-side layout (40% chat, 60% code)
- Tablet: Tabs to switch between chat and code
- Mobile: Bottom sheet for chat, full-screen code viewer

### 3. Backend Streaming Infrastructure

**SSE Endpoint:** `app/api/stream/[projectId]/route.ts`

```typescript
// Handles streaming events for a specific project/version
// Events: version:start, step:start, file:generating, code:chunk, file:complete, version:complete
// Maintains connection map for active sessions
// Auto-cleanup on disconnect
```

**Streaming Service:** `src/services/streaming-service.ts`

```typescript
class StreamingService {
  // Manage SSE connections per project
  // Emit events to connected clients
  // Handle reconnection logic
  // Cache partial results for resume
}
```

**Modified Inngest Function:** `src/inngest/functions.ts`

**IMPORTANT:** The existing Inngest workflow stays the SAME - still uses E2B sandbox for validation!

Current `generateAPI` function modifications:

1. **Accept `versionNumber` and `previousFragmentId` parameters**

   - If versionNumber = 1 (first version): Standard generation
   - If versionNumber >= 2: Load previous version context

2. **Load previous version context (v2+)**
```typescript
let previousContext = '';
if (versionNumber > 1 && previousFragmentId) {
  // Load previous fragment from database
  const { data: prevFragment } = await supabase
    .from('fragments')
    .select('files, content, title')
    .eq('id', previousFragmentId)
    .single();
    
  // Build context from previous files
  previousContext = `
Previous Version (v${versionNumber - 1}):
${prevFragment.title}

Generated Files:
${Object.entries(prevFragment.files).map(([name, code]) => 
  `--- ${name} ---\n${code.substring(0, 500)}...`
).join('\n\n')}
  `;
}
```

3. **Enhanced prompt for v2+ (iterative changes)**
```typescript
const systemPrompt = versionNumber === 1 
  ? /* Existing prompt */ 
  : /* Modified prompt for iterations */;

// For v2+, user message becomes:
const userMessage = versionNumber === 1
  ? prompt  // Original prompt
  : `${previousContext}\n\nUSER REQUEST: ${prompt}\n\nGenerate the COMPLETE updated API with all files. Modify existing files as needed and add new files if required.`;
```

4. **Same streaming already implemented** ✅

   - Already using `stream: true` with GPT-4o
   - Already emitting events via streamingService
   - Code chunks already streaming

5. **Same E2B validation** ✅

   - All versions go through E2B sandbox
   - Same validation process
   - Same error handling

6. **Store in fragments table with version link**

   - Create new fragment for each version
   - Link to api_versions table
   - Each fragment has complete files (not diffs initially)

**Event Structure:**

```typescript
type StreamEvent = 
  | { type: 'version:start', versionId: string, versionNumber: number }
  | { type: 'planning', message: string }
  | { type: 'file:generating', filePath: string }
  | { type: 'code:chunk', filePath: string, chunk: string, startLine: number }
  | { type: 'file:complete', filePath: string, operation: 'created' | 'modified' | 'deleted' }
  | { type: 'version:complete', summary: string, filesChanged: number }
  | { type: 'error', message: string }
```

### 4. Frontend Components

**Chat Interface:** `components/chat-interface.tsx`

- Message list showing user prompts and AI responses
- Auto-scroll to latest message
- Loading indicator when version is generating
- Activity log items (e.g., "Read demo-one.tsx", "Scanned codebase", "Thought for 4s")
- Copy button for messages
- Timestamp for each message

**Version Result Cards (V0-style):**

Each completed version displays as a **compact collapsible card** (appears BEFORE AI's detailed response):

```
Collapsed (default):
┌──────────────────────────────────────────────────┐
│ > Built API  v1                              ⋮   │
└──────────────────────────────────────────────────┘

Expanded (after clicking):
┌──────────────────────────────────────────────────┐
│ ∨ Built API  v1                              ⋮   │
├──────────────────────────────────────────────────┤
│ ⚙️ index.js                     src/index.js    │
│ ⚙️ auth.js                 src/routes/auth.js   │
│ ⚙️ middleware.js           src/middleware.js    │
│ 📦 package.json                  package.json    │
└──────────────────────────────────────────────────┘
```

**Card Features:**

- **Collapsed by default:** Chevron (>) + Title (1-3 words) + Version (v1) + Menu (⋮)
- **Click to expand:** Chevron rotates to (∨), reveals file list
- **File list items:**
  - Left: File icon + filename
  - Right: Full path (e.g., "src/routes/auth.js")
  - Click any file → Jump to that file in code viewer and highlight it
- **Menu (⋮) actions:** 
  - Regenerate this version
  - Copy all files
  - Download as ZIP
  - Compare with previous version

**Future Enhancement:** File operation indicators (for v2+):

- 🟢 New file created
- 🟡 File modified
- 🔴 File deleted

**Chat Input:** `components/chat-input.tsx`

- Textarea with auto-resize
- Send button (disabled while generating)
- Character count (optional)
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Shows "AI is generating v2..." status

**Version Selector:** `components/version-selector.tsx`

- Dropdown in code viewer header
- Shows: "v1 (initial)", "v2 (Added auth)", "v3 (Fixed bugs)"
- Click to switch versions instantly
- Current version highlighted
- Shows timestamp and prompt summary

**Streaming Code Viewer:** `components/streaming-code-viewer.tsx`

- File tree on left (shows files being added/modified with animations)
- Code editor on right with syntax highlighting
- Typing animation as code streams in
- Blinking cursor effect at write position
- Line-by-line highlights as code appears
- Uses `framer-motion` for smooth animations

**Version Diff Viewer:** `components/version-diff-viewer.tsx` (Optional enhancement)

- Side-by-side diff view when comparing versions
- Highlight additions (green), deletions (red), modifications (yellow)
- Accessible via "Compare with v1" button

**Progress Tracker:** `components/generation-progress-tracker.tsx`

- Shows current step: Planning → Analyzing → Generating → Complete
- File-level progress: "Generating index.ts (2/5 files)"
- Estimated time remaining
- Pulsing animations on active step

### 5. Frontend Hooks

**useGenerationStream:** `hooks/use-generation-stream.ts`

```typescript
// Subscribes to SSE endpoint for a project
// Returns: { 
//   currentVersion, 
//   streamingFiles, 
//   currentStep, 
//   isConnected, 
//   error 
// }
// Handles reconnection if connection drops
// Falls back to polling if SSE unavailable
```

**useChatMessages:** `hooks/use-chat-messages.ts`

```typescript
// Fetch and manage chat history
// Real-time updates via Supabase subscriptions
// Optimistic updates when sending messages
```

**useVersions:** `hooks/use-versions.ts`

```typescript
// Fetch all versions for a project
// Switch between versions
// Reconstruct files from diffs
// Cache reconstructed versions
```

**useFileReconstruction:** `hooks/use-file-reconstruction.ts`

```typescript
// Apply diffs to reconstruct complete files
// Cache results for fast version switching
// Handle file operations: created, modified, deleted
```

### 6. API Routes

**Create Version:** `app/api/projects/[projectId]/versions/route.ts`

- POST: Create new version from user prompt
- Trigger Inngest generateAPI with versionId
- Return versionId immediately
- Frontend subscribes to SSE for updates

**Get Versions:** `app/api/projects/[projectId]/versions/route.ts`

- GET: Fetch all versions for a project
- Include version metadata, prompt, file counts

**Get Version Files:** `app/api/projects/[projectId]/versions/[versionId]/files/route.ts`

- GET: Fetch all files for a specific version
- Reconstruct from diffs on-demand
- Return complete file tree and contents

**Chat Messages:** `app/api/projects/[projectId]/messages/route.ts`

- GET: Fetch chat history
- POST: Add new message (user or system)

### 7. AI Generation Optimization

**Switch to GPT-4o with streaming:**

- Model: `gpt-4o` (faster than gpt-4-turbo)
- Enable `stream: true`
- Process chunks in real-time
- Expected speedup: 50-70%

**Context-aware prompts for v2+:**

- Include previous version's files as context
- User prompt: "Add authentication"
- AI prompt: "Previous version: [file summaries]. User wants: Add authentication. Generate updated files with diffs highlighted."

**Parallel operations:**

- Generate multiple files simultaneously where possible
- Run validation in parallel with file generation

### 8. User Flow

**Initial Creation (v1):**

1. User enters prompt at `/ask` page
2. Project created → Redirect to `/projects/[projectId]`
3. Chat interface shows: "Creating v1..."
4. SSE connection established
5. Loading animation with progress tracker
6. Files stream in with typing animation
7. v1 complete → Chat shows success message
8. User can now iterate with new prompts

**Iteration (v2, v3, etc.):**

1. User types in chat input: "Add user authentication"
2. Click send → New version created
3. Chat shows user message + "Generating v2..."
4. SSE streams updates
5. Code viewer updates in real-time showing changes
6. File tree animates new/modified files
7. v2 complete → Version dropdown shows v2 selected
8. User can switch back to v1 anytime via dropdown

**Version Switching:**

1. Click version dropdown
2. Select v1
3. Instant switch (if cached) or 500ms loading
4. Code viewer updates to show v1 files
5. Chat history scrolls to v1 message
6. Can switch forward to v2, v3 anytime

### 9. Performance Targets

- **Version creation**: < 300ms to get versionId and start streaming
- **First code visible**: < 3s after version creation
- **Complete generation**: 15-25s (vs 30-45s currently)
- **Version switching**: < 500ms (with caching)
- **Code animation speed**: 100-200ms per chunk (smooth but not slow)

### 10. Fallback & Error Handling

**If SSE fails:**

- Fall back to polling every 2s
- Show "Reconnecting..." message
- Load from database when available
- Retry SSE connection 3 times before fallback

**If version generation fails:**

- Show error in chat
- Offer "Retry" button
- Previous versions remain intact
- Can continue from last working version

**If version reconstruction fails:**

- Fall back to loading full content from database
- Log warning for investigation
- Create new full snapshot for this version

### 11. File Changes Required

**New Files:**

1. `app/api/stream/[projectId]/route.ts` - SSE endpoint
2. `app/api/projects/[projectId]/versions/route.ts` - Version CRUD
3. `app/api/projects/[projectId]/versions/[versionId]/files/route.ts` - File retrieval
4. `app/api/projects/[projectId]/messages/route.ts` - Chat messages
5. `components/chat-interface.tsx` - Chat UI
6. `components/chat-input.tsx` - Message input
7. `components/version-selector.tsx` - Version dropdown
8. `components/streaming-code-viewer.tsx` - Animated code display
9. `components/generation-progress-tracker.tsx` - Progress visualization
10. `components/version-diff-viewer.tsx` - Diff comparison (optional)
11. `hooks/use-generation-stream.ts` - SSE subscription
12. `hooks/use-chat-messages.ts` - Chat management
13. `hooks/use-versions.ts` - Version management
14. `hooks/use-file-reconstruction.ts` - Diff reconstruction
15. `src/services/streaming-service.ts` - Streaming logic
16. `src/types/streaming.ts` - TypeScript types
17. `src/types/versioning.ts` - Version types
18. `src/utils/diff-generator.ts` - Generate diffs between file versions
19. `src/utils/diff-applier.ts` - Apply diffs to reconstruct files
20. `supabase/migrations/XXX_add_versioning_tables.sql` - Database schema

**Modified Files:**

1. `src/inngest/functions.ts` - Add streaming emissions and version support
2. `app/projects/[projectId]/project-page-client.tsx` - New layout with chat + code viewer
3. `components/dashboard-content.tsx` - Immediate redirect after project creation
4. `app/ask/page.tsx` - Ensure proper flow to project page

### 12. Database Migration

```sql
-- Create api_versions table
CREATE TABLE api_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  ai_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

-- Create version_files table
CREATE TABLE version_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES api_versions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content_diff JSONB,
  full_content TEXT,
  operation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(version_id, file_path)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES api_versions(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_api_versions_project ON api_versions(project_id, version_number DESC);
CREATE INDEX idx_version_files_version ON version_files(version_id);
CREATE INDEX idx_chat_messages_project ON chat_messages(project_id, created_at);
```

## Implementation Todos

- [ ] Create database migration for versioning tables
- [ ] Build SSE streaming endpoint and service
- [ ] Create version management API routes
- [ ] Modify Inngest function to support versioning and emit stream events
- [ ] Build chat interface component with message history
- [ ] Build chat input component with loading states
- [ ] Create version selector dropdown
- [ ] Build streaming code viewer with typing animations
- [ ] Create generation progress tracker
- [ ] Implement useGenerationStream hook for SSE
- [ ] Implement useVersions hook for version management
- [ ] Implement useChatMessages hook
- [ ] Build diff generation and application utilities
- [ ] Implement file reconstruction from diffs
- [ ] Update ProjectPageClient with new chat + code layout
- [ ] Switch to GPT-4o with streaming completions
- [ ] Add version switching logic with caching
- [ ] Test end-to-end flow: prompt → v1 → iterate → v2
- [ ] Add error handling and fallback to polling
- [ ] Optimize performance and caching strategy

