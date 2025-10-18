# Inngest Clone-and-Preview Timeout Fix

## Problem
The `clone-and-preview-repository` Inngest function was failing with endless retry loops. The issue occurred when:
1. User selects a GitHub repository
2. Repository clones successfully
3. Files are read successfully
4. **During dependency installation and dev server startup**, the function times out
5. Inngest retries the entire function from scratch (cloning again)
6. This creates an endless loop of 5-minute attempts

## Root Cause
The entire repository cloning, file reading, dependency installation, and server startup was wrapped in a **single Inngest step** (`clone-and-setup-preview`). This step could take up to 30 minutes for large projects:
- Repository cloning: 1-2 minutes
- Reading 150+ files: 1-2 minutes
- Installing dependencies: **10 minutes** (configured timeout)
- Starting dev server: **20 minutes** (Next.js 15 + Tailwind v4 first build)

**Total: Up to 33 minutes in a single step**

Inngest has default step timeouts that were shorter than this, causing the step to timeout and triggering function retries. Each retry started from scratch, creating the endless loop.

## Solution
**Break the large monolithic step into multiple smaller, focused steps:**

### Before (1 Giant Step):
```
Step 1: get-github-integration
Step 2: clone-and-setup-preview (EVERYTHING - 30+ mins)
  ├─ Create sandbox
  ├─ Clone repository
  ├─ Detect framework
  ├─ Read 150+ files
  ├─ Install dependencies (10 mins)
  └─ Start preview server (20 mins)
Step 3: save-repository-files
Step 4: update-project
Step 5: emit-complete
```

### After (Multiple Focused Steps):
```
Step 1: get-github-integration
Step 2: clone-repository (2-3 mins)
  ├─ Create sandbox
  └─ Clone repository
Step 3: detect-framework (30 seconds)
  └─ Analyze package.json and project structure
Step 4: read-repository-files (1-2 mins)
  └─ Read up to 150 source files
Step 5: install-dependencies (10 mins)
  └─ Run npm/pnpm/yarn install with 10-minute timeout
Step 6: start-preview-server (20 mins)
  └─ Start dev server with 20-minute timeout
Step 7: save-repository-files
Step 8: update-project
Step 9: emit-complete
```

## Key Changes

### 1. Split Inngest Function Steps (`src/inngest/functions.ts`)
- **Separated** clone, framework detection, file reading, dependency installation, and server startup into individual steps
- Each step can now fail independently without restarting the entire workflow
- Inngest's step memoization ensures completed steps don't re-run on retry

### 2. Updated Function Configuration
```typescript
export const cloneAndPreviewRepository = inngest.createFunction(
  { 
    id: "clone-and-preview-repository",
    retries: 1, // Reduced from 2 to avoid excessive retries
    concurrency: {
      limit: 5, // Limit concurrent executions
    },
  },
  // ...
);
```

### 3. Enhanced `startPreviewServer` Method (`src/services/github-repository-service.ts`)
Added `skipInstall` parameter to avoid reinstalling dependencies:
```typescript
async startPreviewServer(
  sandbox: Sandbox,
  framework: FrameworkDetection,
  repoPath: string = '/home/user/repo',
  skipInstall: boolean = false // NEW: Skip install if already done
): Promise<...> {
  // ...
  if (!skipInstall) {
    // Install dependencies
  } else {
    console.log('⏭️  Skipping dependency installation (already done)');
  }
  // Start server
}
```

### 4. Sandbox Connection Reuse
Each step now reconnects to the same sandbox using `Sandbox.connect(sandboxId)`:
```typescript
const sandbox = await Sandbox.connect(cloneResult.sandboxId);
```

## Benefits

1. **No More Endless Loops**: Each step completes within its timeout, preventing full function retries
2. **Better Progress Tracking**: Each step emits streaming events, giving users accurate progress updates
3. **Faster Retries**: If a step fails, only that step retries (not the entire workflow)
4. **Better Error Messages**: Failures show exactly which step failed and why
5. **Inngest Step Memoization**: Completed steps are cached, so retries skip successful steps

## Testing Recommendations

1. **Test with small repository** (Create React App):
   - Should complete in ~5 minutes
   - All steps should succeed

2. **Test with large repository** (Next.js 15 + Tailwind v4):
   - May take 15-20 minutes total
   - Should NOT timeout or retry from scratch
   - Progress should be visible throughout

3. **Test with failing dependency installation**:
   - Should fail at Step 5 (install-dependencies)
   - Should NOT retry cloning (Steps 1-4 should be cached)
   - Should show clear error message about installation failure

4. **Monitor Inngest Dashboard**:
   - Check that steps are completing individually
   - Verify no full function retries
   - Confirm step execution times

## Files Modified

1. `src/inngest/functions.ts` - Refactored `cloneAndPreviewRepository` function
2. `src/services/github-repository-service.ts` - Added `skipInstall` parameter to `startPreviewServer`

## Related Issues

- Inngest function timeout/retry behavior
- E2B sandbox long-running operations
- Next.js 15 + Tailwind v4 first build time (10-15 minutes)
- SSE (Server-Sent Events) connection stability during long operations

