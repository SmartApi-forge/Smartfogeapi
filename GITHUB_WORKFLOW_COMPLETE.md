# 🔄 Complete GitHub Workflow

## Overview

SmartAPIForge has 3 different GitHub workflows depending on the project type:

1. **Cloning a GitHub repo** (starts from `/ask` page)
2. **Creating a new repo for text-based project** (after generating code from prompt)
3. **Managing branches in cloned repo** (branch switching, creating branches)

---

## 📍 Scenario 1: Cloning a GitHub Repository

### **Where:** `/ask` page (landing page)

### **User Flow:**
```
1. User visits /ask page
2. Clicks "Clone GitHub Repository" or similar button
3. Enters GitHub repo URL (e.g., https://github.com/username/repo)
4. System clones the repository
5. → Project page opens with cloned code
6. GitHub button now shows GitHubBranchSelector
```

### **What Gets Set:**
- `project.github_mode = true` OR
- `project.github_repo_id = <repo_id>` OR  
- `project.repo_url = <repo_url>`

### **Result:**
- ✅ All files loaded from GitHub
- ✅ Can switch between branches
- ✅ Can create new branches
- ✅ **Version is created** for the cloned repo (v1)

---

## 📍 Scenario 2: Creating New Repo for Text-Based Project

### **Where:** Project page (after creating with "create an API for...")

### **User Flow:**
```
1. User creates project with text prompt: "create an API for user authentication"
2. Code is generated
3. User clicks GitHub button (octocat icon) in header
4. → If not connected: Shows "Connect GitHub Account" button
5. → If connected: Shows "Create GitHub Repository" dialog
6. User selects:
   - Git Scope: Personal OR Organization
   - Repository Name: e.g., "user-auth-api"
7. Clicks "Create Repository"
8. → New GitHub repo is created
9. → Code is pushed to the new repo
```

### **Technical Details:**

**Components Used:**
- `simple-header.tsx` → Shows GitHub button
- `github-repository-dialog.tsx` → Shows create form

**Conditional Logic (in simple-header.tsx):**
```typescript
// Only show GitHub dialog for manual projects (not GitHub cloned projects)
const shouldShowGitHubDialog = !project?.github_mode && 
                               !project?.github_repo_id && 
                               !project?.repo_url
```

**Dialog Shows:**
- ✅ "Connect GitHub" (if not connected)
- ✅ "Create New Repository" form with:
  - Git Scope selector (Personal/Organization)
  - Repository name input
  - Create button

**Does NOT Show:**
- ❌ Clone option (that's only for /ask page)
- ❌ Tabs (no mode switching needed)

---

## 📍 Scenario 3: Managing Branches in Cloned Repo

### **Where:** Project page (GitHub-cloned projects only)

### **User Flow:**
```
1. User has a GitHub-cloned project
2. Clicks GitHub button in header
3. → Shows GitHubBranchSelector (NOT GitHubRepositoryDialog)
4. Can:
   - View current branch
   - Switch to different branches
   - Create new branch
   - See list of all branches
```

### **Technical Details:**

**Components Used:**
- `simple-header.tsx` → Shows GitHub button
- `github-branch-selector.tsx` → Shows branch management UI

**Conditional Logic (in simple-header.tsx):**
```typescript
// Show GitHub branch selector for GitHub cloned projects
const shouldShowGitHubBranchSelector = project?.github_mode || 
                                       project?.github_repo_id || 
                                       project?.repo_url
```

**Features:**
- ✅ List all branches from GitHub
- ✅ Switch between branches
- ✅ Create new branch
- ✅ Shows current active branch
- ✅ **Each branch switch creates a new version**

---

## 🎯 Component Breakdown

### **1. simple-header.tsx**
**Purpose:** Shows the correct GitHub button based on project type

**Logic:**
```typescript
{/* GitHub button - Conditionally rendered based on project type */}

{/* For manual/text-based projects → Show Create Repo Dialog */}
{shouldShowGitHubDialog && (
  <GitHubRepositoryDialog>
    <Button><Github /></Button>
  </GitHubRepositoryDialog>
)}

{/* For GitHub-cloned projects → Show Branch Selector */}
{shouldShowGitHubBranchSelector && project && (
  <GitHubBranchSelector project={project}>
    <Button><Github /></Button>
  </GitHubBranchSelector>
)}
```

---

### **2. github-repository-dialog.tsx**
**Purpose:** Create new GitHub repository for text-based projects

**Features:**
- ✅ Checks if GitHub is connected first
- ✅ Shows "Connect GitHub Account" if not connected
- ✅ Shows "Create Repository" form if connected
- ✅ Git Scope selection (Personal/Organization)
- ✅ Repository name input
- ✅ Creates repo via tRPC mutation

**Does NOT:**
- ❌ Show clone option
- ❌ Show tabs
- ❌ Allow cloning repos (that's for /ask page)

---

### **3. github-branch-selector.tsx**
**Purpose:** Manage branches for GitHub-cloned projects

**Features:**
- ✅ Lists all branches from GitHub API
- ✅ Shows current branch with checkmark
- ✅ Switch branch button
- ✅ Create new branch button
- ✅ Fetches latest changes from GitHub
- ✅ Creates new version when switching branches

---

## 📊 Decision Tree

```
User clicks GitHub button →

├─ Is project from GitHub clone?
│  ├─ YES → Show GitHubBranchSelector
│  │         - List branches
│  │         - Switch branches
│  │         - Create new branch
│  │
│  └─ NO → Is GitHub connected?
│           ├─ YES → Show Create Repository Form
│           │         - Select scope (Personal/Org)
│           │         - Enter repo name
│           │         - Create new repo
│           │
│           └─ NO → Show "Connect GitHub Account" button
│                    - Click → Redirect to /api/auth/github
│                    - OAuth flow
│                    - Return to app
```

---

## 🔐 Authentication Flow

### **First Time Setup:**
```
1. User clicks GitHub button
2. integrationStatus.connected = false
3. Shows "Connect GitHub Account" button
4. User clicks → Redirects to /api/auth/github
5. GitHub OAuth page opens
6. User authorizes SmartAPIForge
7. Redirected back to app
8. integrationStatus.connected = true
9. Now can create repos or clone repos
```

### **Subsequent Uses:**
```
1. User clicks GitHub button
2. integrationStatus.connected = true
3. Directly shows appropriate dialog:
   - Create Repo form (for text projects)
   - Branch Selector (for cloned projects)
```

---

## ✅ Version Integration

### **When are versions created?**

1. **Initial GitHub Clone** (Scenario 1)
   - When repo is first cloned → v1 created
   - Contains all files from GitHub
   - `command_type: 'CLONE_REPO'`

2. **Branch Switch** (Scenario 3)
   - When user switches branch → New version created
   - v2, v3, v4, etc.
   - Contains files from that branch

3. **Text Generation** (Normal flow)
   - When user asks to modify code → New version
   - `command_type: 'MODIFY_FILE'`, etc.

### **Version Dropdown:**
Shows in unified header when `versions.length > 0`:
```
[v1] Initial Clone - v0-shader-animation
[v2] Switched to main branch
[v3] Modified auth logic
```

---

## 🎨 UI Flow Examples

### **Example 1: New User Creates API Project**

```
1. /ask → User types: "create a REST API for blog"
2. → Code generates
3. → Project page opens
4. User clicks GitHub button (🐙)
5. → Popup: "Connect GitHub Account"
6. User clicks → GitHub OAuth
7. → Returns to app
8. User clicks GitHub button again
9. → Popup: "Create GitHub Repository"
10. Selects: Personal, Name: "blog-api"
11. → Repo created on GitHub
12. → Code pushed to repo
13. ✅ Done! Repo is live on GitHub
```

### **Example 2: User Clones Existing Repo**

```
1. /ask → User pastes: "https://github.com/username/my-app"
2. → Cloning starts
3. → Project page opens
4. → Files loaded from GitHub
5. User clicks GitHub button (🐙)
6. → Popup: GitHubBranchSelector
7. Shows: [✓ main] [develop] [feature/auth]
8. User clicks "develop"
9. → Switches to develop branch
10. → v2 created with develop files
11. ✅ Done! Working on develop branch
```

---

## 🔧 Technical Configuration

### **Environment Variables Needed:**
```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# Supabase (for storing projects/versions)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Database Schema:**
```sql
-- Projects table needs these fields for GitHub integration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_url TEXT;

-- Versions table needs CLONE_REPO command type
ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_command_type_check;
ALTER TABLE versions ADD CONSTRAINT versions_command_type_check 
  CHECK (command_type IN (
    'CREATE_FILE', 'MODIFY_FILE', 'DELETE_FILE',
    'REFACTOR_CODE', 'GENERATE_API', 'CLONE_REPO'
  ));
```

---

## 🚀 Summary

| Scenario | Starting Point | GitHub Button Shows | What It Does |
|----------|---------------|-------------------|--------------|
| **Clone Repo** | /ask page | N/A (separate flow) | Clones GitHub repo |
| **Text Project** | Project page | Create Repo Dialog | Creates new GitHub repo |
| **Cloned Project** | Project page | Branch Selector | Manages branches |

**Key Points:**
- ✅ Authentication is checked first for all operations
- ✅ Context-aware: Different UI based on project type
- ✅ Versions created for each significant change
- ✅ Clean separation: Clone in /ask, Create/Manage in project
- ✅ Seamless OAuth flow for first-time setup

**All workflows are now implemented correctly!** 🎉
