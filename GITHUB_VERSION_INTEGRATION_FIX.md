# GitHub Version Integration - Complete Fix

## Issues Fixed

### 1. ✅ ZIP Download Not Working
**Problem:** `filesToZip` was empty for GitHub-cloned projects  
**Solution:** Added fallback to message fragments when no versions exist  
**File:** `app/projects/[projectId]/project-page-client.tsx` (lines 1189-1200)

### 2. ✅ Version Creation for GitHub Projects
**Problem:** GitHub clone workflow didn't create versions  
**Solution:** Added version creation step in `cloneAndPreviewRepository` workflow  
**File:** `src/inngest/functions.ts` (lines 2473-2550)
- Creates Version 1 with `CLONE_REPO` command type
- Stores all cloned files in version
- Links messages/fragments to version via `version_id`
- Metadata includes repo URL, framework, sandbox URL

### 3. ✅ Version Dropdown in Unified Header
**Problem:** Version dropdown only existed in StreamingCodeViewer, not in main header  
**Solution:** Added version dropdown to unified header (before three-dot menu)  
**File:** `app/projects/[projectId]/project-page-client.tsx` (lines 1565-1614)

**Features:**
- Shows current version (e.g., "v1")
- Click to open dropdown with all versions
- Displays version number, name, and status
- Checkmark on selected version
- Click-outside to close
- Positioned between path bar and three-dot menu

### 4. ✅ Version Cards in Chat
**Problem:** Version cards might not appear immediately after GitHub cloning  
**Solution:** Added message refetch on streaming complete  
**File:** `app/projects/[projectId]/project-page-client.tsx` (lines 683-691)

**Version Card Display Methods:**
1. **Direct link** via `version_id` (most reliable)
2. **Time-based matching** (within 10 seconds)
3. **Orphaned versions** (fallback)

### 5. ✅ Type System Updates
**Files Updated:**
- `src/modules/versions/types.ts` - Added `'CLONE_REPO'` to CommandType
- `src/modules/api-generation/router.ts` - Updated triggerIteration enum
- `app/projects/[projectId]/project-page-client.tsx` - Added all framework types

## How It Works Now

### For GitHub Projects:
1. User clones GitHub repo → workflow starts
2. **Step 7**: Message + fragment saved
3. **Step 7.5**: Version 1 created with `CLONE_REPO` type
4. **Step 7.6**: Messages linked to version (`version_id` set)
5. **Step 9**: Workflow completes
6. **Frontend**: Refetches versions + messages
7. **Version card appears** in chat (Method 1: direct link)
8. **Version dropdown appears** in header

### For Regular API Generation:
1. User sends prompt → workflow starts
2. **Step 7.6**: Version 1 created with `GENERATE_API` type
3. Messages linked to version
4. Version card + dropdown appear (same as GitHub)

## UI Components

### Version Dropdown Location
```
[Code/Preview Toggle] [Path Bar/Spacer] [Version Dropdown] [Three Dots Menu]
```

### Version Dropdown Features
- Button: `v{number}` with chevron
- Dropdown: List of all versions
- Each item shows: version number, name, status icon
- Active version highlighted with checkmark
- Max height with scroll for many versions

## Testing Checklist

- [ ] GitHub repo cloning creates Version 1
- [ ] Version dropdown appears in header
- [ ] Version cards appear in chat
- [ ] ZIP download works for GitHub projects
- [ ] Version switching updates file view
- [ ] Multiple follow-up prompts create new versions
- [ ] Version dropdown shows all versions with status

## Database Structure

**versions table:**
- `id` (uuid)
- `project_id` (uuid)
- `version_number` (int)
- `name` (string)
- `files` (jsonb) - all file contents
- `command_type` - now includes `'CLONE_REPO'`
- `status` - 'generating' | 'complete' | 'failed'
- `parent_version_id` (uuid, nullable)

**messages table:**
- `version_id` (uuid, nullable) - **KEY LINK** to versions

## Verification Command

To verify version was created for "v0-shader-animation-landing-page":

```sql
SELECT 
  v.id,
  v.version_number,
  v.name,
  v.command_type,
  v.status,
  v.metadata->>'repo_full_name' as repo,
  jsonb_object_keys(v.files) as file_count
FROM versions v
JOIN projects p ON p.id = v.project_id
WHERE p.name LIKE '%v0-shader-animation%'
ORDER BY v.created_at DESC;
```

## Expected Output
✅ Version dropdown shows "v1" in header  
✅ Version card appears in chat after cloning  
✅ ZIP download includes all cloned files  
✅ Follow-up prompts create v2, v3, etc.
