# 🔍 Debug Guide: GitHub Version Integration

## Current Status

✅ **Code is in place** - Version creation IS implemented in `cloneAndPreviewRepository`  
✅ **Version dropdown IS implemented** - Shows when `versions.length > 0`  
✅ **Enhanced logging added** - Will show detailed error messages

## Why It's Not Working

The version creation might be **failing silently**. I've added extensive logging to expose the issue.

---

## 🛠️ How to Test & Debug

### **Step 1: Clone a New Repository**

1. Go to your dashboard
2. Select **"Connect GitHub"** or clone a repo
3. **Watch the console logs** (Browser DevTools → Console)
4. **Watch Inngest logs** (if you have access to Inngest dashboard)

### **Step 2: Check for Errors in Console**

Look for these log messages in your **browser console**:

```
✅ Good Signs:
[useGenerationStream] Version created: 1 <version-id>
Streaming completed, refetching versions and messages...

❌ Bad Signs:
❌ CRITICAL ERROR creating version for GitHub repo:
Failed to create version: <error message>
```

### **Step 3: Check Inngest Logs**

If you have access to Inngest dashboard, look for function run logs:

1. Go to Inngest dashboard
2. Find `clone-and-preview-repository` function
3. Look for the `create-initial-version` step
4. Check if it succeeded or failed

**Expected Logs:**
```
🔵 Starting version creation for GitHub repo
  - Project ID: <uuid>
  - Repo: <owner/repo>
  - Files count: <number>
✅ VersionManager imported successfully
📝 Creating version with name: <Name>
✅ Created initial version for GitHub repo: <id> v1
  - Version ID: <uuid>
  - Version Number: 1
  - Files stored: <count>
```

### **Step 4: Verify Version in Database**

Run this SQL query in Supabase SQL Editor:

```sql
-- Check for versions created in the last hour
SELECT 
  v.id,
  v.version_number,
  v.name,
  v.command_type,
  v.status,
  v.created_at,
  v.metadata->>'repo_full_name' as repo,
  jsonb_object_keys(v.files) as sample_file,
  p.name as project_name
FROM versions v
JOIN projects p ON p.id = v.project_id
WHERE v.created_at > NOW() - INTERVAL '1 hour'
  AND v.command_type = 'CLONE_REPO'
ORDER BY v.created_at DESC;
```

**Expected Result:**
- At least 1 row showing your cloned repo
- `version_number = 1`
- `command_type = 'CLONE_REPO'`
- `status = 'complete'`
- Files stored in `files` column

---

## 🐛 Common Issues & Fixes

### **Issue 1: `versions.length = 0` (Version Dropdown Hidden)**

**Cause:** Version creation failed or versions not being fetched

**Debug:**
1. Check if version exists in database (SQL query above)
2. Check browser network tab for `/api/trpc/versions.getMany` calls
3. Look for errors in tRPC response

**Fix:**
- If version exists in DB but not showing → frontend polling issue
- If version doesn't exist in DB → backend creation issue

### **Issue 2: Version Creation Error**

**Common Errors:**

#### A) `VersionManager is not defined`
```typescript
Error: Cannot import VersionManager
```
**Fix:** Check that `src/services/version-manager.ts` exists

#### B) `CLONE_REPO not in enum`
```typescript
Type '"CLONE_REPO"' is not assignable to CommandType
```
**Fix:** Already fixed! Added to `src/modules/versions/types.ts`

#### C) `Supabase insert error`
```typescript
Error: insert or update on table "versions" violates foreign key constraint
```
**Fix:** Project ID might be invalid - check project exists first

#### D) `Files too large`
```typescript
Error: payload too large
```
**Fix:** Reduce file count or implement file size limits

### **Issue 3: Version Card Not Showing in Chat**

**Cause:** Message not linked to version via `version_id`

**Debug:**
1. Check `messages` table for `version_id` column
2. Run SQL:
```sql
SELECT id, content, role, version_id 
FROM messages 
WHERE project_id = '<your-project-id>' 
ORDER BY created_at DESC;
```

**Expected:** `version_id` should match version ID from versions table

**Fix:**
- If `version_id` is NULL → linking step failed (Step 7.6)
- Check Inngest logs for `link-to-version` step errors

---

## 🎯 Quick Test Checklist

- [ ] Clone a GitHub repository
- [ ] Check browser console for version creation logs
- [ ] Verify version exists in database
- [ ] Confirm version dropdown appears in header
- [ ] Confirm version card appears in chat
- [ ] Test ZIP download works
- [ ] Test version switching works

---

## 📊 What Each File Does

### Backend (Inngest):
- `src/inngest/functions.ts` (lines 2473-2550) - **Creates version for GitHub repos**
- `src/modules/versions/types.ts` - **Defines CLONE_REPO type**
- `src/services/version-manager.ts` - **Database operations for versions**

### Frontend:
- `app/projects/[projectId]/project-page-client.tsx` (lines 1565-1614) - **Version dropdown UI**
- `app/projects/[projectId]/project-page-client.tsx` (lines 938-1005) - **Version card injection logic**
- `hooks/use-generation-stream.ts` (lines 81-88) - **Handles version:created event**

### Types:
- `src/types/streaming.ts` - **Event types including version:created**

---

## 🚀 Expected Flow

### 1. User Clones Repo
```
User clicks "Clone Repository" → GitHub integration triggered
```

### 2. Backend Workflow
```
Step 1: Get GitHub token
Step 2: Clone repository to E2B sandbox
Step 3: Detect framework
Step 4: Read files (up to 150 files)
Step 5: Install dependencies
Step 6: Start preview server
Step 7: Save message + fragment
Step 7.5: ⭐ CREATE VERSION ⭐
  - Generate version name from repo
  - Create version with command_type: 'CLONE_REPO'
  - Store all files in version.files
  - Emit 'version:created' event to stream
Step 7.6: Link messages to version
  - Update messages.version_id
  - Update fragments.version_id
Step 8: Update project status
Step 9: Emit 'complete' event
```

### 3. Frontend Updates
```
SSE receives 'version:created' → useGenerationStream updates state
SSE receives 'complete' → Triggers refetch
versions.getMany refetches → Gets new version
messagesWithVersions updated → Version card appears
Version dropdown shows → Shows "v1"
```

---

## 💡 Next Steps

1. **Test with a fresh clone** to see the new detailed logs
2. **Check Inngest dashboard** for the exact error
3. **Run the SQL query** to verify version creation
4. **Share the error message** if version creation fails

The enhanced logging will show **exactly where** it's failing! 🎯
