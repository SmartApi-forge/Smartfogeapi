<!-- 40266be9-0e24-4ea4-93a5-5f0654e0e211 73080eb0-83a6-444c-ab97-98624ce02c69 -->
# Real-time Streaming API Generation with Live Code Display

## Overview

Transform the current database-polling architecture into a real-time streaming system that shows live progress, file generation, and code writing with V0-style animations. Optimize AI generation speed and provide engaging loading states.

## Architecture Changes

### 1. Backend Streaming Infrastructure

**Create SSE (Server-Sent Events) endpoint** - `app/api/generate/stream/route.ts`

- New streaming endpoint that Inngest can push events to
- Handles connection management and event broadcasting
- Uses in-memory Map to track active project streams

**Modify Inngest function** - `src/inngest/functions.ts`

- Add streaming event emissions at each workflow step
- Stream OpenAI responses in real-time using streaming completions
- Emit events: `step:start`, `step:progress`, `file:generating`, `file:complete`, `code:chunk`, `complete`
- Keep database saves but add streaming layer on top

**Create streaming service** - `src/services/streaming.ts`

- Centralized service for managing SSE connections
- Event emission utilities for Inngest functions
- Connection cleanup and error handling

### 2. Frontend Streaming Consumer

**Create useGenerationStream hook** - `hooks/use-generation-stream.ts`

- React hook that subscribes to SSE endpoint
- Manages connection lifecycle and reconnection
- Returns stream state: current step, files being generated, code chunks, errors

**Update ProjectPageClient component** - `app/projects/[projectId]/project-page-client.tsx`

- Replace polling with SSE subscription
- Show real-time code writing with chunk-by-chunk animation
- Display current generation step with progress indicator
- Animate file tree updates as files are generated

**Create streaming code viewer** - `components/streaming-code-viewer.tsx`

- Component that displays code with typing animation
- Uses `framer-motion` for smooth character/chunk reveals
- Shows "cursor" blinking effect at write position
- Highlights current line being written

**Create progress tracker component** - `components/generation-progress-tracker.tsx`

- Visual stepper showing: Planning → Analyzing → Generating → Validating → Complete
- Highlights current step with animations
- Shows sub-steps (e.g., "Generating index.js", "Generating package.json")
- Estimated time remaining indicator

**Add skeleton UI states** - `components/project-skeleton.tsx`

- Skeleton loaders for file tree and code viewer
- Pulsing animation effects
- Graceful degradation if streaming fails

### 4. AI Generation Optimization

**Switch to GPT-4o with streaming** - `src/inngest/functions.ts` line 270

- Replace `gpt-4-turbo` with `gpt-4o` model
- Enable `stream: true` in OpenAI completion options
- Process streaming chunks and emit to frontend
- Expected speedup: 50-70% faster generation

**Optimize prompt structure** - `src/inngest/functions.ts` lines 274-386

- Reduce prompt verbosity while maintaining quality
- Add explicit instructions for streaming-friendly output
- Request files in logical order (package.json → main files → routes)

**Parallel operations** - `src/inngest/functions.ts`

- Run non-dependent steps in parallel (e.g., repo analysis + validation setup)
- Stream multiple files simultaneously when possible
- Reduce total workflow time by 30-40%

### 5. Database & State Management

**Add streaming_session table** - New migration

- Track active streaming sessions
- Store session metadata (project_id, user_id, status)
- Enable recovery if connection drops

**Update project status field** - Existing `projects` table

- Add intermediate statuses: `initializing`, `streaming`, `generating`, `validating`
- Frontend displays appropriate UI based on status

**Cache strategy** - Redis or in-memory

- Cache partial results during streaming
- Enable resume if user refreshes page
- Clear cache after successful completion

## Implementation Details

### Key Files to Create:

1. `app/api/generate/stream/[projectId]/route.ts` - SSE endpoint
2. `hooks/use-generation-stream.ts` - Streaming hook
3. `components/streaming-code-viewer.tsx` - Animated code display
4. `components/project-loading-screen.tsx` - Initial loading state
5. `components/generation-progress-tracker.tsx` - Progress visualization
6. `src/services/streaming.ts` - Streaming service
7. `src/types/streaming.ts` - TypeScript types for events

### Key Files to Modify:

1. `src/inngest/functions.ts` - Add streaming emissions
2. `app/projects/[projectId]/project-page-client.tsx` - Replace polling with streaming
3. `src/modules/api-generation/service.ts` - Return projectId immediately
4. `app/page.tsx` - Navigate to project immediately after creation

### Event Structure:

```typescript
type StreamEvent = 
  | { type: 'step:start', step: string, message: string }
  | { type: 'file:generating', filename: string }
  | { type: 'code:chunk', filename: string, chunk: string, line: number }
  | { type: 'file:complete', filename: string, content: string }
  | { type: 'validation:progress', stage: string, result: boolean }
  | { type: 'complete', summary: string }
  | { type: 'error', message: string }
```

## Performance Targets

- **Time to first byte**: < 500ms (loading screen shows immediately)
- **First file visible**: < 3s (package.json streams first)
- **Complete generation**: 15-25s (down from 30-45s current)
- **Code animation speed**: 100-200ms per chunk (8-10 lines)

## User Experience Flow

1. User submits prompt → Immediate redirect to project page
2. Loading screen appears with animated icons (0-2s)
3. Progress tracker shows "Planning..." step (2-5s)
4. First file appears in tree, starts "typing" in viewer (5-8s)
5. Subsequent files stream in with animations (8-20s)
6. Validation results stream in real-time (20-25s)
7. Complete! All files available, can interact immediately

## Fallback Strategy

If streaming fails or connection drops:

- Fall back to polling every 2s
- Show "Reconnecting..." message
- Load from database when data available
- No loss of functionality, just slower updates

## Immediate Redirect Fix (No Annoying Success Messages)

**Remove success/error messages from dashboard** - `components/dashboard-content.tsx`

- Remove lines 59-72 (success and error message displays)
- Redirect to project page immediately when mutation starts
- Show loading state inline in the input area (small spinner + "Creating project...")
- All status updates happen on the project page, not dashboard

**Update redirect logic** - `app/page.tsx` and `components/dashboard-content.tsx`

- Navigate to `/projects/[projectId]` immediately after getting projectId
- Don't wait for Inngest completion
- Project page handles all loading states

**Modified user flow**:

1. User types prompt and clicks submit
2. Small inline loading indicator appears (no success message)
3. Immediately redirects to project page (< 300ms)
4. Beautiful loading screen with brain animation shows
5. Real-time streaming begins

## Developer/Debug View Option

**Add developer console panel** - `components/developer-console.tsx`

- Toggle-able panel (keyboard shortcut: `Ctrl+Shift+D` or `Cmd+Shift+D`)
- Shows real-time logs from streaming events
- Displays Inngest workflow steps and timing
- Shows raw SSE events for debugging
- Performance metrics: token usage, API call latency, validation times

**Developer mode features**:

- Event timeline visualization
- JSON inspector for each stream event
- Network tab showing SSE connection status
- Ability to export logs for debugging
- Toggle in project settings or via URL param `?debug=true`

**Implementation**:

- Create `hooks/use-developer-mode.ts` for state management
- Add keyboard listener in ProjectPageClient
- Styled as a bottom drawer panel (like browser DevTools)
- Only visible when enabled (hidden in production by default)
- Persists preference in localStorage

**Benefits for developers**:

- See exactly what's happening under the hood
- Debug streaming issues
- Understand performance bottlenecks
- Better developer experience without cluttering user UI

### To-dos

- [ ] Create SSE endpoint and streaming service infrastructure
- [ ] Modify Inngest generateAPI function to emit streaming events
- [ ] Switch to GPT-4o with streaming completions and optimize prompts
- [ ] Create useGenerationStream hook for consuming SSE events
- [ ] Build initial loading screen with animated brain icons
- [ ] Create generation progress tracker component
- [ ] Build streaming code viewer with typing animation
- [ ] Update ProjectPageClient to use streaming instead of polling
- [ ] Modify API generation flow to navigate immediately after project creation
- [ ] Add streaming_session table and update project status field
- [ ] Test end-to-end flow and optimize timing/performance