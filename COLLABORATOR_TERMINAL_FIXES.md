# Collaborator Terminal & Preview Fixes

## Issues Fixed

### 1. Terminal Authentication for Invited Users (404 Error)
**Problem:** Terminal initialization was returning 404 errors for invited collaborators because the endpoint only checked if the project existed, not if the user had collaborator access.

**Solution:** Added comprehensive authentication and authorization checks to all terminal endpoints:

#### Files Modified:
- `app/api/sandbox/terminal/init/route.ts`
- `app/api/sandbox/terminal/execute/route.ts`
- `app/api/sandbox/terminal/cleanup/route.ts`
- `hooks/use-daytona-terminal.ts`

#### Changes Made:
1. Added user authentication check (`supabase.auth.getUser()`)
2. Added owner verification (`project.user_id === user.id`)
3. Added collaborator permission check via `project_collaborators` table
4. Added sandbox ID verification against project metadata
5. Updated hooks to pass `projectId` to all terminal endpoints

**Before:**
```typescript
// Only checked if project exists
const { data: project } = await supabase
  .from('projects')
  .select('id, user_id, metadata')
  .eq('id', projectId)
  .single();
```

**After:**
```typescript
// Check user authentication
const { data: { user }, error: userError } = await supabase.auth.getUser();

// Check if owner OR collaborator
const isOwner = project.user_id === user.id;

if (!isOwner) {
  const { data: collaborator } = await supabase
    .from('project_collaborators')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (!collaborator) {
    return 403 Forbidden
  }
}
```

### 2. Keepalive 401 Errors
**Status:** Already properly implemented! The keepalive endpoint correctly checks for collaborators.

**Verification:** The 401 errors were happening because terminal wasn't initializing properly. Now that terminal auth is fixed, keepalive should work correctly.

### 3. Daytona Iframe Security Warning
**Status:** Known limitation - not fixed.

**Problem:** Daytona proxy shows security warning when embedding in iframe. This is a built-in security feature from Daytona that cannot be bypassed.

**Workaround:** Users must click "Open in New Tab" button in the preview header to view the preview in a separate tab where they can trust the Daytona URL.

## Testing Instructions

### Test 1: Terminal Access for Invited Users
1. **Owner:** Invite a collaborator to a project
2. **Collaborator:** Accept invitation and open the project
3. **Collaborator:** Click terminal icon in preview header
4. **Expected:** Terminal should initialize successfully (no 404 errors)
5. **Verify:** Run commands like `ls`, `pwd` in the terminal

### Test 2: Keepalive for Invited Users
1. **Collaborator:** Keep project open with preview visible
2. **Monitor:** Check browser console and network tab
3. **Expected:** `/api/sandbox/keepalive/[projectId]` should return 200
4. **Verify:** No 401 errors after ~5 minutes

### Test 3: Preview Access
1. **Any User:** Open a project with Daytona sandbox
2. **If preview shows security warning:** Click "Open in New Tab" button in preview header
3. **In new tab:** Trust the URL (click through Daytona warning)
4. **Use preview in new tab:** Work directly in the new tab if iframe doesn't load

### Test 4: Execute Commands
1. **Collaborator:** Initialize terminal
2. **Run commands:**
   ```bash
   ls -la
   pwd
   npm run dev
   ```
3. **Expected:** All commands execute successfully
4. **Verify:** Output appears in terminal

## Security Improvements

### Authentication Flow
```
User Request → Terminal Endpoint
    ↓
Check User Auth (401 if not authenticated)
    ↓
Verify Project Exists (404 if not found)
    ↓
Check Owner or Collaborator (403 if neither)
    ↓
Verify Sandbox ID matches (403 if mismatch)
    ↓
Execute Terminal Operation
```

### Endpoints Protected
- ✅ `/api/sandbox/terminal/init` - Initialize session
- ✅ `/api/sandbox/terminal/execute` - Execute commands
- ✅ `/api/sandbox/terminal/cleanup` - Cleanup session
- ✅ `/api/sandbox/keepalive/[projectId]` - Keep sandbox alive (already protected)

## Known Limitations

### Daytona Proxy Security
- **Issue:** Daytona's proxy service shows security warnings for iframe embedding
- **Reason:** This is a security feature to prevent malicious iframe embedding
- **Workaround:** Users must open preview in new tab once to trust the URL
- **Status:** Cannot be bypassed - this is Daytona's security policy

### First-Time Preview
- Users may need to click through Daytona's security warning on first load
- After trusting once, subsequent loads should work in iframe
- This is standard behavior for secure proxy services

## API Changes

### New Required Parameters
All terminal endpoints now require `projectId`:

```typescript
// Terminal Init
POST /api/sandbox/terminal/init
{
  "sandboxId": "...",
  "projectId": "...",  // NEW - Required
  "workingDirectory": "..."
}

// Terminal Execute
POST /api/sandbox/terminal/execute
{
  "sessionId": "...",
  "sandboxId": "...",
  "projectId": "...",  // NEW - Required
  "command": "..."
}

// Terminal Cleanup
POST /api/sandbox/terminal/cleanup
{
  "sessionId": "...",
  "sandboxId": "...",
  "projectId": "..."  // NEW - Required
}
```

## Troubleshooting

### Still Getting 404 Errors?
1. Verify collaborator invitation was accepted
2. Check `project_collaborators` table has entry
3. Clear browser cache and cookies
4. Log out and log back in

### Still Getting 401 Errors?
1. Check authentication token is valid
2. Verify user session in Supabase
3. Check browser console for detailed error messages

### Preview Not Loading?
1. Check if it's a Daytona security warning
2. Click "Open in New Tab" button in yellow notice
3. Trust the URL in the new tab
4. Return to app and refresh

### Terminal Not Working?
1. Check sandbox is running (green indicator)
2. Verify sandbox URL is valid
3. Try restarting sandbox
4. Check browser console for errors
## Files Changed Summary

| File | Changes | Purpose |
|------|---------|---------|------|
| `app/api/sandbox/terminal/init/route.ts` | Added auth & collaborator checks | Fix 404 for invited users |
| `app/api/sandbox/terminal/execute/route.ts` | Added auth & collaborator checks | Secure command execution |
| `app/api/sandbox/terminal/cleanup/route.ts` | Added auth & collaborator checks | Secure cleanup |
| `hooks/use-daytona-terminal.ts` | Pass projectId to endpoints | Enable auth verification |
| `components/sandbox-preview.tsx` | Added security notice & iframe permissions | Help users with Daytona warning |

## Next Steps

1. **Test thoroughly** with invited collaborators
2. **Monitor logs** for any remaining auth errors
3. **Gather feedback** on the security notice UX
4. **Consider adding** a one-time setup guide for new collaborators

## References

- [Daytona Preview Authentication Docs](https://daytona.io/docs/en/preview-and-authentication)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [MDN iframe Security](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#security_considerations)
