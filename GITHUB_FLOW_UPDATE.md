# GitHub Integration Flow - Updated

## ✅ New Flow (v0-Style)

### User Journey

1. **Navigate to `/ask` page**
   - User sees the Smart API Forge interface
   - Prompt input box with GitHub button visible

2. **Click GitHub Button**
   - Repository selector modal opens
   - If not connected: "Connect GitHub Account" button shown
   - If connected: List of user's repositories displayed

3. **Connect GitHub (if needed)**
   - User clicks "Connect GitHub Account"
   - Redirects to GitHub OAuth
   - User authorizes SmartForge
   - Redirects back to `/ask` with success message

4. **Select Repository**
   - User sees dropdown of their repositories
   - Selects a repository (e.g., "my-nextjs-app")
   - Clicks "Select Repository" button

5. **Immediate Clone & Preview** ✨
   - System creates a new project
   - Redirects to `/loading?projectId={id}`
   - Inngest workflow `github/clone-and-preview` triggers:
     - Clones repository to E2B sandbox
     - Detects framework (Next.js, React, Vue, etc.)
     - Installs dependencies with appropriate package manager
     - Starts preview development server
     - Streams progress updates to frontend

6. **Redirect to Project Page**
   - After cloning completes, redirects to `/projects/{projectId}`
   - User sees:
     - **Their existing code** in the file explorer
     - **Preview tab** with running application
     - **Chat interface** for making changes

7. **Iterate with Prompts**
   - User can now enter prompts like:
     - "Add a user authentication API"
     - "Create CRUD endpoints for products"
     - "Add a search API endpoint"
   - Each prompt generates new code
   - Changes are automatically pushed to GitHub as PRs

---

## 🔄 Two Workflows

### 1. Clone & Preview (NEW)
**Event**: `github/clone-and-preview`
**When**: User selects a repository from GitHub selector
**What it does**:
- ✅ Clones repository
- ✅ Installs dependencies
- ✅ Detects framework
- ✅ Starts preview server
- ❌ Does NOT generate new code
- ✅ Saves sandbox URL to project

**Result**: User sees their existing repo running in preview

### 2. Generate API (EXISTING - Modified)
**Event**: `api/generate`
**When**: User enters a prompt (with or without GitHub repo)
**What it does**:
- If GitHub mode:
  - Uses cloned repository context
  - Generates new code based on prompt
  - Creates Pull Request with changes
- If direct mode:
  - Generates API from scratch
  - No GitHub integration

**Result**: New code generated and optionally pushed to GitHub

---

## 📂 File Structure After Clone

When a repository is cloned, the project structure looks like:

```
/projects/{projectId}
├── Chat Interface (for prompts)
├── Code Explorer
│   ├── src/
│   ├── components/
│   ├── package.json
│   └── ... (all repo files)
└── Preview Tab
    └── Running application on port 3000/5173/etc
```

---

## 🎯 Key Differences from Previous Implementation

| Aspect | Previous | Updated |
|--------|----------|---------|
| **Trigger** | Prompt submission | Repository selection |
| **Initial Action** | Wait for prompt | Clone immediately |
| **Preview** | Only after code gen | Immediate |
| **User Flow** | /ask → prompt → /projects | /ask → select repo → /projects |
| **Code in Preview** | Generated code | Existing repo code |

---

## 💡 Example User Flow

### Scenario: User wants to add API to existing Next.js app

1. **Select Repo**
   ```
   User: [Clicks GitHub button]
   User: [Selects "my-nextjs-ecommerce"]
   User: [Clicks "Select Repository"]
   ```

2. **System Clones**
   ```
   ✓ Cloning my-nextjs-ecommerce...
   ✓ Detected: Next.js
   ✓ Installing with npm...
   ✓ Starting preview on port 3000...
   → Redirecting to /projects/abc-123
   ```

3. **User Sees Their App**
   ```
   [Code Explorer]          [Preview Tab]
   - src/                   ┌──────────────────┐
     - app/                 │  Next.js App     │
     - components/          │  Running Live!   │
   - package.json           │  Port: 3000      │
   - ...                    └──────────────────┘
   ```

4. **User Adds API**
   ```
   User: "Add a product search API with fuzzy matching"
   
   System:
   ✓ Generating API endpoints...
   ✓ Creating /api/products/search...
   ✓ Adding search logic...
   ✓ Creating Pull Request...
   
   Result: PR created at github.com/user/my-nextjs-ecommerce/pull/42
   ```

---

## 🔧 Technical Implementation

### Components Updated

1. **`components/github-repo-selector.tsx`**
   - Added `createProject: true` to mutation
   - Redirects to `/loading` after selection
   - No longer just stores repo in state

2. **`src/trpc/routers/github.ts`**
   - `connectRepository` now accepts `createProject` flag
   - Creates project automatically
   - Triggers `github/clone-and-preview` event

3. **`src/inngest/functions.ts`**
   - New function: `cloneAndPreviewRepository`
   - Handles clone, install, detect, preview
   - Streams progress to frontend
   - Does NOT generate new code

### Database Changes

Projects created from GitHub now have:
- `github_mode: true`
- `github_repo_id: <uuid>`
- `sandbox_url: <preview_url>`
- `framework: <detected_framework>`
- `status: 'completed'` (after clone finishes)

---

## 🎨 UI/UX Improvements

### Loading States
- "Cloning repository..." with spinner
- Progress bar showing:
  - Cloning (25%)
  - Detecting Framework (50%)
  - Installing Dependencies (75%)
  - Starting Preview (100%)

### Preview Tab
Should show:
- Live preview of the application
- Console logs
- Network requests
- Port information
- Refresh button

### Code Explorer
Should show:
- Full file tree from cloned repo
- Syntax highlighting
- File editing capabilities
- Diff viewer when changes are made

---

## 🚀 Next Steps for Full Feature

To complete the GitHub integration, you'll need to:

1. **Preview Tab UI** (in `/projects/[projectId]`)
   - Create `components/preview-tab.tsx`
   - Embed iframe with `sandbox_url`
   - Add console logs viewer
   - Add refresh functionality

2. **GitHub Push UI** (in project page)
   - "Push to GitHub" button
   - Commit message input
   - Branch name selector
   - PR creation confirmation

3. **Sandbox Persistence**
   - Store sandbox ID in database
   - Reconnect to existing sandbox when returning
   - Handle sandbox timeout/restart

4. **Real-time Updates**
   - WebSocket connection for preview updates
   - Hot reload when files change
   - Live console streaming

---

## ✅ What's Working Now

- ✅ GitHub OAuth flow
- ✅ Repository selection
- ✅ Project creation on selection
- ✅ Clone & preview workflow
- ✅ Framework detection
- ✅ Dependency installation
- ✅ Preview server startup
- ✅ Sandbox URL storage
- ✅ Progress streaming
- ✅ Redirect to project page

## 🔜 What Needs UI

- 🔜 Preview tab component
- 🔜 Sandbox URL display
- 🔜 Code editor integration
- 🔜 Push to GitHub button
- 🔜 Sync history viewer

---

**Implementation completed**: October 17, 2025  
**Status**: ✅ Backend Complete, 🔜 Frontend UI Needed

