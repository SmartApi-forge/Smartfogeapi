# GitHub Router Error Handling & UUID Constraint Fixes

## Summary
Fixed two critical issues in `src/trpc/routers/github.ts`:

1. **Preserved TRPCError instances in catch blocks** - All 13 catch blocks now check if the error is already a TRPCError and re-throw it unchanged, preventing status code masking
2. **Fixed UUID constraint violation** - Stopped passing empty strings for `projectId` when calling `recordSyncHistory`

## Changes Made

### 1. Error Handling Pattern (Applied to all 13 catch blocks)

**Before:**
```typescript
} catch (error: any) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error.message,
  });
}
```

**After:**
```typescript
} catch (error: any) {
  if (error instanceof TRPCError) {
    throw error;  // Preserve existing TRPCError with its status code
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error.message || 'An unexpected error occurred',
    cause: error,  // Attach original error for debugging
  });
}
```

**Affected Lines:** 28-33, 48-53, 82-87, 186-191, 202-207, 303-308, 417-422, 458-463, 482-487, 516-521, 586-591, 688-693, 728-733, 788-793

### 2. UUID Constraint Fix

**Issue:** `repo.project_id || ''` was passing empty strings to `recordSyncHistory`, violating the UUID constraint in the database.

#### Location 1: `pullChanges` (lines 417-430)
**Before:**
```typescript
await githubSyncService.recordSyncHistory(
  input.repositoryId,
  repo.project_id || '',  // ❌ Empty string violates UUID constraint
  ctx.user.id,
  'pull',
  { ... }
);
```

**After:**
```typescript
// Record sync history (only if project_id exists)
if (repo.project_id) {
  await githubSyncService.recordSyncHistory(
    input.repositoryId,
    repo.project_id,  // ✅ Only call when valid UUID exists
    ctx.user.id,
    'pull',
    { ... }
  );
}
```

#### Location 2: `createBranch` (lines 614-625)
**Before:**
```typescript
if (repo) {
  await githubSyncService.recordSyncHistory(
    repo.id,
    repo.project_id || '',  // ❌ Empty string violates UUID constraint
    ctx.user.id,
    'create_branch',
    { ... }
  );
}
```

**After:**
```typescript
if (repo && repo.project_id) {  // ✅ Check both repo and project_id exist
  await githubSyncService.recordSyncHistory(
    repo.id,
    repo.project_id,
    ctx.user.id,
    'create_branch',
    { ... }
  );
}
```

## Benefits

### Error Handling Improvements
- **Preserves specific error codes**: `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST` errors are no longer masked as `INTERNAL_SERVER_ERROR`
- **Better debugging**: Original error attached via `cause` property
- **Consistent error messages**: Fallback message when `error.message` is undefined
- **Proper error propagation**: Client receives the correct HTTP status codes

### UUID Constraint Fix
- **Prevents database errors**: No more UUID constraint violations from empty strings
- **Graceful handling**: Sync history simply isn't recorded when project_id is missing
- **Data integrity**: Only valid UUIDs are written to the database
- **No breaking changes**: Repositories without project_id continue to work

## Testing Recommendations

1. **Test TRPCError preservation:**
   - Trigger an `UNAUTHORIZED` error (disconnect GitHub)
   - Verify client receives 401, not 500

2. **Test UUID constraint:**
   - Pull changes from a repository without a linked project
   - Verify no database errors occur
   - Confirm sync history is skipped gracefully

3. **Test unexpected errors:**
   - Simulate network failures
   - Verify proper `INTERNAL_SERVER_ERROR` wrapping with cause

## Related Files
- `src/trpc/routers/github.ts` - Main file with all fixes
- `src/services/github-sync-service.ts` - `recordSyncHistory` signature (unchanged)
