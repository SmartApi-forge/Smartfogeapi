# 📊 GitHub Integration Database Schema

Complete documentation of all GitHub-related tables and columns in SmartAPIForge.

---

## 🗄️ **Table Overview**

### **1. projects**
Main projects table with GitHub integration columns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner of the project |
| `name` | TEXT | Project name |
| `github_mode` | BOOLEAN | True if project created from GitHub |
| `github_repo_id` | UUID | FK to github_repositories.id |
| `repo_url` | TEXT | GitHub repository URL |
| **`active_branch`** | TEXT | Currently active branch (default: 'main') |
| **`last_push_at`** | TIMESTAMPTZ | Last push to GitHub timestamp |
| **`last_pull_at`** | TIMESTAMPTZ | Last pull from GitHub timestamp |
| **`has_local_changes`** | BOOLEAN | True if unpushed changes exist |
| `sandbox_url` | TEXT | E2B sandbox preview URL |
| `status` | TEXT | Project status |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

---

### **2. github_integrations**
Stores GitHub OAuth tokens and connection status (simplified table).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users (UNIQUE) |
| `access_token` | TEXT | GitHub OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `token_expires_at` | TIMESTAMPTZ | Token expiration time |
| `github_username` | TEXT | GitHub username |
| `github_user_id` | TEXT | GitHub user ID |
| `avatar_url` | TEXT | User's GitHub avatar |
| `scopes` | TEXT[] | OAuth scopes granted |
| `is_connected` | BOOLEAN | Connection status (default: true) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Usage for v0 UI:**
```typescript
// Check if user is connected
const { data: integration } = await supabase
  .from('github_integrations')
  .select('*')
  .eq('user_id', userId)
  .single();

if (integration?.is_connected) {
  // Show "Connected to GitHub" state
}
```

---

### **3. user_integrations**
Stores OAuth tokens for multiple providers (github/gitlab/bitbucket).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `provider` | TEXT | 'github', 'gitlab', or 'bitbucket' |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `token_expires_at` | TIMESTAMPTZ | Token expiration |
| `provider_user_id` | TEXT | Provider's user ID |
| `provider_username` | TEXT | Provider username |
| `provider_email` | TEXT | Provider email |
| `scopes` | TEXT[] | OAuth scopes |
| `metadata` | JSONB | Additional provider data |
| `is_active` | BOOLEAN | Active status |

**Unique Constraint:** `(user_id, provider, provider_user_id)`

---

### **4. github_repositories**
Stores connected GitHub repositories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `integration_id` | UUID | FK to user_integrations |
| `project_id` | UUID | FK to projects (nullable) |
| `repo_id` | BIGINT | GitHub repository ID |
| `repo_full_name` | TEXT | owner/repo format |
| `repo_name` | TEXT | Repository name |
| `repo_owner` | TEXT | Repository owner |
| `repo_url` | TEXT | Full GitHub URL |
| `default_branch` | TEXT | Default branch (e.g., 'main') |
| `is_private` | BOOLEAN | Private repository flag |
| `description` | TEXT | Repo description |
| `language` | TEXT | Primary language |
| `last_sync_at` | TIMESTAMPTZ | Last sync timestamp |
| `sync_status` | TEXT | 'idle', 'cloning', 'syncing', 'error' |
| `metadata` | JSONB | Additional repo data |

**Unique Constraint:** `(user_id, repo_full_name)`

---

### **5. github_sync_history**
Tracks all GitHub sync operations for audit and status tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `repository_id` | UUID | FK to github_repositories |
| `project_id` | UUID | FK to projects (nullable) |
| `user_id` | UUID | FK to auth.users |
| `operation_type` | TEXT | Operation performed |
| `branch_name` | TEXT | Branch name |
| `commit_sha` | TEXT | Git commit SHA |
| `commit_message` | TEXT | Commit message |
| `pr_number` | INTEGER | Pull request number |
| `pr_url` | TEXT | Pull request URL |
| `status` | TEXT | 'pending', 'in_progress', 'completed', 'failed' |
| `error_message` | TEXT | Error details if failed |
| `files_changed` | INTEGER | Number of files changed |
| `metadata` | JSONB | Additional operation data |
| `started_at` | TIMESTAMPTZ | Operation start time |
| `completed_at` | TIMESTAMPTZ | Operation end time |

**Operation Types:**
- `push` - Push changes to GitHub
- `pull` - Pull changes from GitHub
- `clone` - Clone repository
- `create_repo` - Create new repository
- `create_branch` - Create new branch
- `create_pr` - Create pull request

**Usage for v0 UI:**
```typescript
// Record a push operation
await supabase.from('github_sync_history').insert({
  repository_id: repoId,
  project_id: projectId,
  user_id: userId,
  operation_type: 'push',
  branch_name: 'main',
  commit_sha: commitSha,
  commit_message: 'Push changes from SmartAPIForge',
  status: 'completed',
  files_changed: 5,
  started_at: startTime,
  completed_at: new Date()
});
```

---

## 🔄 **v0-Style UI Data Flow**

### **1. Check Connection Status**
```typescript
const { data: integration } = await supabase
  .from('github_integrations')
  .select('is_connected, github_username')
  .eq('user_id', userId)
  .single();

if (integration?.is_connected) {
  return 'connected'; // Show "Connected to GitHub" state
} else {
  return 'disconnected'; // Show "Connect GitHub" button
}
```

### **2. Fetch Branches**
```typescript
// From GitHub API (not stored in DB)
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/branches`,
  {
    headers: {
      Authorization: `Bearer ${integration.access_token}`
    }
  }
);
const branches = await response.json();
```

### **3. Set Active Branch**
```typescript
// Update project's active branch
await supabase
  .from('projects')
  .update({
    active_branch: newBranch,
    has_local_changes: false // Reset after push
  })
  .eq('id', projectId);
```

### **4. Push Changes**
```typescript
// 1. Push code to GitHub API
// 2. Update project
await supabase
  .from('projects')
  .update({
    last_push_at: new Date(),
    has_local_changes: false
  })
  .eq('id', projectId);

// 3. Record in sync history
await supabase
  .from('github_sync_history')
  .insert({
    repository_id: repoId,
    project_id: projectId,
    user_id: userId,
    operation_type: 'push',
    branch_name: activeBranch,
    status: 'completed',
    files_changed: fileCount
  });
```

### **5. Pull Changes**
```typescript
// 1. Fetch from GitHub API
// 2. Update project
await supabase
  .from('projects')
  .update({
    last_pull_at: new Date()
  })
  .eq('id', projectId);

// 3. Record in sync history
await supabase
  .from('github_sync_history')
  .insert({
    operation_type: 'pull',
    // ... other fields
  });
```

### **6. Detect Local Changes**
```typescript
// Set when user makes changes in the editor
await supabase
  .from('projects')
  .update({
    has_local_changes: true
  })
  .eq('id', projectId);

// Check for push button state
const { data: project } = await supabase
  .from('projects')
  .select('has_local_changes')
  .eq('id', projectId)
  .single();

const pushButtonEnabled = project.has_local_changes;
```

---

## 📊 **Indexes (Already Created)**

```sql
-- Projects
CREATE INDEX idx_projects_active_branch ON projects(active_branch);
CREATE INDEX idx_projects_github_mode ON projects(github_mode) WHERE github_mode = TRUE;
CREATE INDEX idx_projects_github_repo_id ON projects(github_repo_id);
CREATE INDEX idx_projects_repo_url ON projects(repo_url);

-- GitHub Integrations
CREATE INDEX idx_github_integrations_user_id ON github_integrations(user_id);
CREATE INDEX idx_github_integrations_github_user_id ON github_integrations(github_user_id);

-- User Integrations
CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_provider ON user_integrations(provider, is_active);

-- GitHub Repositories
CREATE INDEX idx_github_repositories_user_id ON github_repositories(user_id);
CREATE INDEX idx_github_repositories_project_id ON github_repositories(project_id);
CREATE INDEX idx_github_repositories_repo_full_name ON github_repositories(repo_full_name);

-- GitHub Sync History
CREATE INDEX idx_github_sync_history_repository_id ON github_sync_history(repository_id);
CREATE INDEX idx_github_sync_history_project_id ON github_sync_history(project_id);
CREATE INDEX idx_github_sync_history_user_id ON github_sync_history(user_id);
CREATE INDEX idx_github_sync_history_created_at ON github_sync_history(created_at DESC);
```

---

## 🔐 **RLS Policies**

All tables have Row Level Security enabled with proper policies:

- ✅ Users can only view their own data
- ✅ Users can only create/update/delete their own records
- ✅ Service role can bypass RLS for background jobs

---

## ✅ **Schema Status: Complete**

All necessary columns and tables for the v0-style GitHub UI are **already in the database**. No additional migrations needed!

**Ready to use:**
- ✅ `active_branch` tracking
- ✅ `last_push_at` / `last_pull_at` timestamps
- ✅ `has_local_changes` flag
- ✅ `github_integrations` table
- ✅ `github_sync_history` for audit trail
- ✅ All indexes and RLS policies

---

## 🚀 **Next Steps**

1. ✅ Database schema - Complete
2. ✅ UI components - Complete (GitHubBranchSelectorV0)
3. 🔄 API endpoints - Need to implement:
   - `github.fetchBranches` - Get branches from GitHub API
   - `github.createBranch` - Create new branch
   - `github.pushChanges` - Push to active branch
   - `github.pullChanges` - Pull from active branch
   - `github.checkChanges` - Detect local changes

4. 🔄 Real-time updates - Consider adding:
   - Supabase Realtime subscriptions for `has_local_changes`
   - Polling for remote changes
   - WebSocket for collaboration
