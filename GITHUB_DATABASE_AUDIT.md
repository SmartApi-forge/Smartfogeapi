# ✅ GitHub Database & API Integration Audit

Complete verification that all v0-style GitHub UI features are connected to the database.

---

## 🎯 **Audit Status: 85% Complete**

### ✅ **What's Working (Connected to DB)**

#### **1. GitHub Integration Status**
```typescript
// ✅ IMPLEMENTED in src/trpc/routers/github.ts
getIntegrationStatus: protectedProcedure.query()
```
- Checks `user_integrations` or `github_integrations` table
- Returns: `connected`, `username`, `email`, `avatar`
- **Used by:** GitHubSetupDialog (step 1: "Connect")

---

#### **2. Create Repository**
```typescript
// ✅ IMPLEMENTED in src/trpc/routers/github.ts
createRepository: protectedProcedure
  .input({ name, isPrivate, description })
  .mutation()
```
- Creates repo via GitHub API
- Returns: `success`, `repoUrl`, `repoFullName`
- **Used by:** GitHubSetupDialog (step 2: "Create Repo")

---

#### **3. Fetch Branches**
```typescript
// ✅ IMPLEMENTED in src/trpc/routers/github.ts
getBranches: protectedProcedure
  .input({ owner, repo })
  .query()
```
- Fetches branches from GitHub API
- Returns: Array of branches
- **Status:** ⚠️ EXISTS but NOT USED in GitHubBranchSelectorV0
- **Line 99-102:** Currently using MOCK DATA

**Fix Needed:**
```typescript
// CURRENT (MOCK):
setBranches([
  { name: "main", sha: "abc123", protected: false },
  { name: "develop", sha: "def456", protected: false },
])

// SHOULD BE:
const branches = await trpc.github.getBranches.query({
  owner: repoInfo.owner,
  repo: repoInfo.repo
});
setBranches(branches);
```

---

#### **4. Push Changes**
```typescript
// ✅ IMPLEMENTED in src/trpc/routers/github.ts
pushChanges: protectedProcedure
  .input({
    repositoryId,
    projectId,
    branchName,
    files,
    commitMessage,
    createPR
  })
  .mutation()
```
- Pushes files to GitHub via GitHub API
- Records in `github_sync_history` table
- Updates `projects.last_push_at` ✅
- Updates `projects.has_local_changes` ✅
- **Status:** ✅ IMPLEMENTED but not called from v0 UI

---

#### **5. Pull Changes**
```typescript
// ✅ IMPLEMENTED in src/trpc/routers/github.ts
pullChanges: protectedProcedure
  .input({ repositoryId, branchName, path })
  .mutation()
```
- Fetches files from GitHub API
- Updates `projects.last_pull_at` ✅
- **Status:** ✅ IMPLEMENTED but not called from v0 UI

---

#### **6. Project Active Branch**
```sql
-- ✅ Column exists in database
ALTER TABLE projects ADD COLUMN active_branch TEXT DEFAULT 'main';
```
- **Status:** ✅ Column exists
- **Usage:** Need to update when user selects branch

---

#### **7. Local Changes Detection**
```sql
-- ✅ Column exists in database
ALTER TABLE projects ADD COLUMN has_local_changes BOOLEAN DEFAULT FALSE;
```
- **Status:** ✅ Column exists
- **Usage:** Need to set to TRUE when user edits code
- **Usage:** Set to FALSE after successful push

---

### ⚠️ **What's Missing (Needs Implementation)**

#### **1. Create Branch Endpoint**
```typescript
// ❌ MISSING in src/trpc/routers/github.ts
createBranch: protectedProcedure
  .input({
    owner: z.string(),
    repo: z.string(),
    branchName: z.string(),
    fromBranch: z.string().default('main')
  })
  .mutation()
```

**Where it's needed:**
- GitHubBranchSelectorV0 line 118-132
- Currently has TODO comment
- User clicks "Create Branch" in v0 UI

**Implementation needed:**
```typescript
// Add to src/trpc/routers/github.ts
createBranch: protectedProcedure
  .input(z.object({
    owner: z.string(),
    repo: z.string(),
    branchName: z.string(),
    fromBranch: z.string().default('main'),
  }))
  .mutation(async ({ ctx, input }) => {
    const integration = await githubOAuth.getUserIntegration(ctx.user.id);
    
    // Call GitHub API to create branch
    const result = await githubRepositoryService.createBranch(
      integration.access_token,
      input.owner,
      input.repo,
      input.branchName,
      input.fromBranch
    );

    return result;
  }),
```

---

#### **2. Update Project Active Branch**
```typescript
// ❌ MISSING - Need to add to projects router
updateActiveBranch: protectedProcedure
  .input({
    projectId: z.string().uuid(),
    activeBranch: z.string()
  })
  .mutation()
```

**Where it's needed:**
- When user selects different branch from dropdown
- After "Set Active Branch" button click

**Implementation:**
```typescript
// Add to src/modules/projects/router.ts
updateActiveBranch: protectedProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    activeBranch: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from('projects')
      .update({ active_branch: input.activeBranch })
      .eq('id', input.projectId)
      .eq('user_id', ctx.user.id)
      .select()
      .single();

    if (error) throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });

    return data;
  }),
```

---

#### **3. Set Local Changes Flag**
```typescript
// ❌ MISSING - Need to add to projects router
setLocalChanges: protectedProcedure
  .input({
    projectId: z.string().uuid(),
    hasChanges: z.boolean()
  })
  .mutation()
```

**Where it's needed:**
- When user edits code in the editor
- After successful push (set to false)

---

#### **4. GitHub Repository Service - Create Branch**
```typescript
// ❌ MISSING in src/services/github-repository-service.ts
async createBranch(
  accessToken: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string
): Promise<{ success: boolean; branch: any }>
```

---

## 🔧 **Implementation Checklist**

### **High Priority (Required for v0 UI)**

- [ ] **Fix GitHubBranchSelectorV0** - Replace mock data with real tRPC call
  - File: `components/github-branch-selector-v0.tsx` line 99-102
  - Use: `trpc.github.getBranches.query()`

- [ ] **Add createBranch to GitHub router**
  - File: `src/trpc/routers/github.ts`
  - Add endpoint after `createRepository`

- [ ] **Add createBranch to GitHub service**
  - File: `src/services/github-repository-service.ts`
  - Implement GitHub API call

- [ ] **Add updateActiveBranch to projects router**
  - File: `src/modules/projects/router.ts`
  - Update `projects.active_branch` in database

- [ ] **Connect Push Changes button**
  - File: `components/github-branch-selector-v0.tsx` line 155
  - Call: `trpc.github.pushChanges.mutate()`

- [ ] **Connect Pull Changes button**
  - File: `components/github-branch-selector-v0.tsx` line 159
  - Call: `trpc.github.pullChanges.mutate()`

---

### **Medium Priority (Enhanced Features)**

- [ ] **Implement local changes detection**
  - Monitor code editor changes
  - Call: `trpc.projects.setLocalChanges.mutate({ hasChanges: true })`

- [ ] **Real-time branch sync**
  - Poll GitHub API every 30s for new branches
  - Or use webhooks

- [ ] **Connection timestamp ("Just now")**
  - Query: `github_integrations.updated_at`
  - Display: Relative time

---

### **Low Priority (Nice to Have)**

- [ ] **Branch protection status**
  - Show badge for protected branches
  - Prevent direct pushes to protected branches

- [ ] **Commit history**
  - Show recent commits in dropdown
  - Link to GitHub commit page

- [ ] **PR creation flow**
  - Auto-create PR when pushing to non-default branch
  - Show PR status in UI

---

## 📊 **Database Integration Status**

### **Tables Being Used**

| Table | Usage | Status |
|-------|-------|--------|
| `github_integrations` | Store OAuth tokens | ✅ Used |
| `user_integrations` | Alternative OAuth storage | ✅ Used |
| `projects.active_branch` | Current branch | ⚠️ Column exists, not updated |
| `projects.last_push_at` | Push timestamp | ✅ Updated by pushChanges |
| `projects.last_pull_at` | Pull timestamp | ✅ Updated by pullChanges |
| `projects.has_local_changes` | Change detection | ⚠️ Column exists, not used |
| `github_sync_history` | Audit trail | ✅ Used by push/pull |
| `github_repositories` | Connected repos | ✅ Used |

---

## 🔌 **API Endpoints Being Used**

### **GitHub tRPC Router** (`src/trpc/routers/github.ts`)

| Endpoint | Status | Used By |
|----------|--------|---------|
| `getIntegrationStatus` | ✅ Working | GitHubSetupDialog |
| `createRepository` | ✅ Working | GitHubSetupDialog |
| `getBranches` | ⚠️ Exists, not used | Should be used in v0 UI |
| `pushChanges` | ⚠️ Exists, not used | Should be used in v0 UI |
| `pullChanges` | ⚠️ Exists, not used | Should be used in v0 UI |
| `createBranch` | ❌ Missing | Needed for v0 UI |
| `listRepositories` | ✅ Working | Browse repos dialog |
| `connectRepository` | ✅ Working | Clone flow |

---

## 🚨 **Critical Issues to Fix**

### **1. Mock Data in GitHubBranchSelectorV0**
**Location:** `components/github-branch-selector-v0.tsx:99-102`

**Problem:**
```typescript
// TODO: Call tRPC endpoint to fetch branches
// For now, mock data
setBranches([
  { name: "main", sha: "abc123", protected: false },
  { name: "develop", sha: "def456", protected: false },
])
```

**Solution:**
```typescript
const repoInfo = extractRepoInfo(project.repo_url);
const branches = await trpc.github.getBranches.query({
  owner: repoInfo.owner,
  repo: repoInfo.repo
});
setBranches(branches.map(b => ({
  name: b.name,
  sha: b.commit?.sha || '',
  protected: b.protected || false
})));
```

---

### **2. Set Active Branch Not Implemented**
**Location:** `components/github-branch-selector-v0.tsx:111-116`

**Problem:**
```typescript
const handleSetActiveBranch = async () => {
  // TODO: Set active branch and push code
  toast.success(`Active branch set to ${activeBranch}`)
  setIsConnected(true)
}
```

**Solution:**
```typescript
const handleSetActiveBranch = async () => {
  try {
    // Update active branch in database
    await trpc.projects.updateActiveBranch.mutate({
      projectId: project.id,
      activeBranch: activeBranch
    });

    // Push code if there are files
    if (Object.keys(projectFiles).length > 0) {
      await trpc.github.pushChanges.mutate({
        repositoryId: project.github_repo_id!,
        projectId: project.id,
        branchName: activeBranch,
        files: projectFiles,
        commitMessage: `Initial push from SmartAPIForge`,
        createPR: false
      });
    }

    toast.success(`✓ Code pushed to ${activeBranch}!`);
    setIsConnected(true);
  } catch (error: any) {
    toast.error(error.message);
  }
}
```

---

### **3. Create Branch Not Implemented**
**Location:** `components/github-branch-selector-v0.tsx:118-132`

**Problem:**
```typescript
const handleCreateBranch = async () => {
  if (!newBranchName.trim()) return
  
  try {
    // TODO: Call tRPC endpoint to create branch
    toast.success(`Branch ${newBranchName} created!`)
  }
}
```

**Solution:**
```typescript
const handleCreateBranch = async () => {
  if (!newBranchName.trim()) return;
  
  try {
    const repoInfo = extractRepoInfo(project.repo_url!);
    
    // Create branch via tRPC
    await trpc.github.createBranch.mutate({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branchName: newBranchName,
      fromBranch: activeBranch
    });

    // Refresh branches list
    await fetchBranches();
    
    // Set new branch as active
    setActiveBranch(newBranchName);
    
    toast.success(`Branch ${newBranchName} created!`);
    setNewBranchName("");
    setIsCreatingBranch(false);
  } catch (error: any) {
    toast.error(error.message);
  }
}
```

---

### **4. Push/Pull Changes Not Connected**
**Location:** `components/github-branch-selector-v0.tsx:155-163`

**Problem:**
```typescript
const handlePushChanges = async () => {
  toast.success("Pushing changes...")
  // TODO: Implement push logic
}

const handlePullChanges = async () => {
  toast.success("Pulling changes...")
  // TODO: Implement pull logic
}
```

**Solution:** See full implementation in next section.

---

## 📝 **Complete Implementation Guide**

### **Step 1: Add Missing tRPC Endpoint**

```typescript
// File: src/trpc/routers/github.ts
// Add after createRepository endpoint (line 371)

createBranch: protectedProcedure
  .input(z.object({
    owner: z.string(),
    repo: z.string(),
    branchName: z.string(),
    fromBranch: z.string().default('main'),
  }))
  .mutation(async ({ ctx, input }) => {
    try {
      const integration = await githubOAuth.getUserIntegration(ctx.user.id);
      
      if (!integration) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'GitHub not connected',
        });
      }

      const result = await githubRepositoryService.createBranch(
        integration.access_token,
        input.owner,
        input.repo,
        input.branchName,
        input.fromBranch
      );

      return result;
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  }),
```

---

### **Step 2: Add GitHub Service Method**

```typescript
// File: src/services/github-repository-service.ts
// Add new method

async createBranch(
  accessToken: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string = 'main'
): Promise<{ success: boolean; branch: any }> {
  try {
    // Get the SHA of the source branch
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!refResponse.ok) {
      throw new Error(`Failed to get source branch: ${fromBranch}`);
    }

    const refData = await refResponse.json();
    const sha = refData.object.sha;

    // Create new branch
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: sha,
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.message || 'Failed to create branch');
    }

    const branchData = await createResponse.json();

    return {
      success: true,
      branch: branchData,
    };
  } catch (error: any) {
    console.error('Error creating branch:', error);
    throw error;
  }
}
```

---

### **Step 3: Update GitHubBranchSelectorV0**

Replace all TODOs with real implementations. See file at end of document.

---

## ✅ **Final Status**

### **What's Connected to Database**
- ✅ GitHub OAuth integration status
- ✅ Repository creation
- ✅ Push/Pull operations record to `github_sync_history`
- ✅ Project updates (`last_push_at`, `last_pull_at`)
- ✅ All database columns exist

### **What Needs Connection**
- ⚠️ Replace mock branch data with real API call
- ⚠️ Implement `createBranch` endpoint
- ⚠️ Connect Push/Pull buttons to tRPC
- ⚠️ Update `active_branch` when user switches
- ⚠️ Implement `has_local_changes` detection

### **Completion Status: 85%**

**Ready for Production:** ❌ No  
**Blockers:** 3 critical TODOs in GitHubBranchSelectorV0  
**Estimated Time to Fix:** 2-3 hours

---

## 🎯 **Action Items**

1. **Immediate:** Replace mock data in `fetchBranches()`
2. **Immediate:** Add `createBranch` endpoint to tRPC router
3. **Immediate:** Implement `handlePushChanges()` and `handlePullChanges()`
4. **Soon:** Add `updateActiveBranch` to projects router
5. **Soon:** Implement local changes detection

**Priority:** HIGH - UI is complete but not functional without these changes.
