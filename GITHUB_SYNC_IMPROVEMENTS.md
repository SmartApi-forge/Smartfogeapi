# GitHub Sync & Organization Support - Complete Implementation

## Overview
Enhanced GitHub integration with proper sync tracking, organization support, and complete database persistence for all GitHub operations.

## Key Improvements

### 1. Real GitHub Username & Organization Support

**Problem**: Git Scope dropdown showed hardcoded "Personal" and "Organization" labels instead of actual GitHub usernames and organization names.

**Solution**: 
- Fetch real GitHub username from integration status
- Fetch user's organizations from GitHub API
- Display actual names: "Shashank4507 (Personal)" and organization names like "acme-org (Organization)"

**Files Modified**:
- `components/github-setup-dialog.tsx`
  - Added `gitHubUsername`, `gitHubOrgs`, and `loadingScopes` state
  - Created `fetchGitHubScopes()` function to fetch user and org info
  - Updated Git Scope dropdown to show real names

**Implementation**:
```typescript
// Fetch user info and organizations
const fetchGitHubScopes = async () => {
  // Get username from integration status
  setGitHubUsername(integrationStatus.username);
  
  // Fetch organizations from GitHub API
  const orgsResponse = await fetch('https://api.github.com/user/orgs');
  const orgs = await orgsResponse.json();
  setGitHubOrgs(orgs);
};

// Display in dropdown
<SelectContent>
  {gitHubUsername && (
    <SelectItem value={gitHubUsername}>
      {gitHubUsername} (Personal)
    </SelectItem>
  )}
  {gitHubOrgs.map((org) => (
    <SelectItem value={org.login}>
      {org.login} (Organization)
    </SelectItem>
  ))}
</SelectContent>
```

### 2. Organization Repository Creation

**Enhancement**: Support creating repositories in GitHub organizations, not just personal accounts.

**Changes**:
- `src/services/github-sync-service.ts`
  - Updated `createRepository()` to accept optional `org` parameter
  - Use `octokit.repos.createInOrg()` for organizations
  - Return `repoId` directly from API response

- `src/trpc/routers/github.ts`
  - Added `owner` parameter to `createRepository` endpoint
  - Automatically detect if owner is organization or personal account
  - Pass organization name to service if applicable

**Implementation**:
```typescript
// Service layer
if (org) {
  // Create in organization
  const { data } = await octokit.repos.createInOrg({
    org,
    name,
    private: isPrivate,
    auto_init: true,
  });
} else {
  // Create in personal account
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    private: isPrivate,
    auto_init: true,
  });
}
```

### 3. Complete Sync History Tracking

**Problem**: GitHub operations (push, pull, create repo, create branch) were not being tracked in `github_sync_history` table.

**Solution**: All GitHub operations now record entries in the sync history table.

**Tracked Operations**:
1. **create_repo** - When repository is created and linked to project
2. **create_branch** - When new branch is created
3. **push** - When code is pushed to GitHub
4. **pull** - When code is pulled from GitHub
5. **create_pr** - When pull request is created (future)

**Database Fields Tracked**:
- `operation_type` - Type of operation
- `branch_name` - Branch involved
- `commit_sha` - Commit SHA for push operations
- `commit_message` - Commit message for push
- `files_changed` - Number of files modified
- `status` - Operation status (completed/failed)
- `started_at` / `completed_at` - Timestamps
- `metadata` - Additional operation metadata

**Implementation in tRPC**:
```typescript
// After successful push
await githubSyncService.recordSyncHistory(
  repositoryId,
  projectId,
  userId,
  'push',
  {
    branchName: input.branchName,
    commitSha: result.commitSha,
    commitMessage: input.commitMessage,
    filesChanged: Object.keys(input.files).length,
    status: 'completed',
  }
);
```

### 4. Project Timestamp Updates

**Enhancement**: Track when projects were last synced with GitHub.

**Fields Updated**:
- `last_push_at` - Updated after successful push
- `last_pull_at` - Updated after successful pull
- `has_local_changes` - Set to false after push, true when changes detected

**Implementation**:
```typescript
// After push
await supabase
  .from('projects')
  .update({
    last_push_at: new Date().toISOString(),
    has_local_changes: false,
  })
  .eq('id', projectId);

// After pull
await supabase
  .from('projects')
  .update({
    last_pull_at: new Date().toISOString(),
  })
  .eq('id', projectId);
```

### 5. Repository Sync Status Tracking

**Enhancement**: Track repository sync status in `github_repositories` table.

**Fields Updated**:
- `last_sync_at` - Timestamp of last sync operation
- `sync_status` - Current sync status (idle/syncing/error)

**States**:
- `idle` - Repository ready for operations
- `syncing` - Currently syncing (future)
- `cloning` - Cloning repository (future)
- `error` - Sync error occurred

**Implementation**:
```typescript
// After any sync operation
await supabase
  .from('github_repositories')
  .update({
    last_sync_at: new Date().toISOString(),
    sync_status: 'idle',
  })
  .eq('id', repositoryId);
```

## Database Schema Verification

### Tables Used:

#### 1. `github_sync_history`
```sql
CREATE TABLE github_sync_history (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES github_repositories(id),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id),
  operation_type TEXT CHECK (operation_type IN ('push', 'pull', 'clone', 'create_repo', 'create_branch', 'create_pr')),
  branch_name TEXT,
  commit_sha TEXT,
  commit_message TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  files_changed INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `github_repositories`
```sql
-- Relevant fields
last_sync_at TIMESTAMPTZ
sync_status TEXT CHECK (sync_status IN ('idle', 'cloning', 'syncing', 'error'))
```

#### 3. `projects`
```sql
-- Relevant fields
active_branch TEXT DEFAULT 'main'
last_push_at TIMESTAMPTZ
last_pull_at TIMESTAMPTZ
has_local_changes BOOLEAN DEFAULT false
```

## Testing Guide

### Test 1: Create Repo in Personal Account
1. Create project
2. Click GitHub button → Create Repository
3. Git Scope should show: "Shashank4507 (Personal)"
4. Select personal account, enter repo name
5. Create repository
6. **Verify**: Check `github_sync_history` for `create_repo` entry

```sql
SELECT * FROM github_sync_history 
WHERE operation_type = 'create_repo' 
ORDER BY created_at DESC LIMIT 1;
```

### Test 2: Create Repo in Organization
1. Create project
2. Click GitHub button → Create Repository
3. Git Scope should show organizations (if any)
4. Select organization, enter repo name
5. Create repository
6. **Verify**: Repository created under organization on GitHub
7. **Verify**: `github_sync_history` has entry

### Test 3: Push Changes
1. Make code changes in project
2. Click GitHub button → Push Changes
3. Enter commit message, push
4. **Verify**: 
   - `github_sync_history` has `push` entry with commit SHA
   - `projects.last_push_at` is updated
   - `projects.has_local_changes` = false
   - `github_repositories.last_sync_at` is updated

```sql
SELECT 
  p.id, 
  p.last_push_at, 
  p.has_local_changes,
  gr.last_sync_at,
  gr.sync_status
FROM projects p
JOIN github_repositories gr ON p.github_repo_id = gr.id
WHERE p.id = '<project_id>';
```

### Test 4: Pull Changes
1. Make changes on GitHub directly
2. Click GitHub button → Pull Changes
3. **Verify**:
   - `github_sync_history` has `pull` entry
   - `projects.last_pull_at` is updated
   - Changes reflected in project

### Test 5: Create Branch
1. Click GitHub button → Create Branch
2. Enter branch name, create
3. **Verify**:
   - `github_sync_history` has `create_branch` entry
   - Branch exists on GitHub
   - Active branch updated in project

## Sync History Queries

### View All Sync Operations for Project
```sql
SELECT 
  gsh.operation_type,
  gsh.branch_name,
  gsh.commit_message,
  gsh.files_changed,
  gsh.status,
  gsh.created_at,
  gsh.completed_at
FROM github_sync_history gsh
WHERE gsh.project_id = '<project_id>'
ORDER BY gsh.created_at DESC;
```

### View Repository Sync Status
```sql
SELECT 
  gr.repo_full_name,
  gr.sync_status,
  gr.last_sync_at,
  COUNT(gsh.id) as total_operations,
  COUNT(CASE WHEN gsh.operation_type = 'push' THEN 1 END) as pushes,
  COUNT(CASE WHEN gsh.operation_type = 'pull' THEN 1 END) as pulls
FROM github_repositories gr
LEFT JOIN github_sync_history gsh ON gr.id = gsh.repository_id
WHERE gr.user_id = '<user_id>'
GROUP BY gr.id, gr.repo_full_name, gr.sync_status, gr.last_sync_at;
```

### View Failed Operations
```sql
SELECT 
  gsh.*,
  gr.repo_full_name
FROM github_sync_history gsh
JOIN github_repositories gr ON gsh.repository_id = gr.id
WHERE gsh.status = 'failed'
  AND gsh.user_id = '<user_id>'
ORDER BY gsh.created_at DESC;
```

## Architecture Flow

```
User Action
    ↓
Frontend Component (GitHubSetupDialog / GitHubBranchSelectorV0)
    ↓
tRPC Mutation (github.createRepository / push / pull / createBranch)
    ↓
GitHub Service (githubSyncService)
    ↓
GitHub API (Octokit)
    ↓
[Success]
    ↓
Record Sync History (github_sync_history table)
    ↓
Update Project Timestamps (projects table)
    ↓
Update Repository Status (github_repositories table)
    ↓
Return Success to Frontend
```

## Files Modified

1. **components/github-setup-dialog.tsx**
   - Added real GitHub username/org fetching
   - Updated Git Scope dropdown UI
   - Pass owner parameter to createRepository

2. **src/services/github-sync-service.ts**
   - Added org parameter to createRepository
   - Return repoId from API response
   - Support both personal and org repos

3. **src/trpc/routers/github.ts**
   - Added owner parameter to createRepository endpoint
   - Added sync history tracking to all operations
   - Added project timestamp updates
   - Added repository sync status updates

## Benefits

✅ **Complete Audit Trail** - All GitHub operations tracked in database
✅ **Organization Support** - Create repos in orgs, not just personal accounts
✅ **Real Names** - Show actual GitHub usernames and org names
✅ **Sync Status** - Track when projects were last synced
✅ **Operation Metrics** - Query how many pushes/pulls/operations per repo
✅ **Error Tracking** - Failed operations logged for debugging
✅ **Timestamp Tracking** - Know exactly when last push/pull occurred

## Next Steps (Optional)

1. **Sync Status UI** - Show sync status and last sync time in UI
2. **Conflict Detection** - Detect when local and remote have conflicts
3. **Sync Analytics** - Dashboard showing sync activity
4. **Retry Failed Operations** - Auto-retry or manual retry for failed syncs
5. **Real-time Sync** - WebSocket notifications for GitHub events
6. **Diff Viewer** - Show what changed in push/pull operations
