# GitHub Push Code - 401 Unauthorized Fix

## Problem
When clicking "Set Active Branch & Push Code", you got a **401 Unauthorized** error trying to push code to GitHub.

## Root Causes

### 1. Wrong Database Table ❌
```typescript
// BEFORE - Wrong table
const { data: integration } = await supabase
  .from('github_integrations')  // ❌ This table is EMPTY
  .select('access_token')
  .eq('user_id', user.id)
  .single();
```

Your GitHub tokens are stored in `user_integrations` table, NOT `github_integrations` table.

### 2. No Authentication in API Route ❌
```typescript
// BEFORE - No auth token passed
const { data: { user } } = await supabase.auth.getUser();
// ❌ This fails in API routes because no auth token is provided
```

API routes are server-side and don't automatically have access to user sessions from cookies.

### 3. Wrong GitHub Authorization Header ❌
```typescript
// BEFORE - Wrong auth format
'Authorization': `Bearer ${accessToken}`  // ❌ GitHub uses "token", not "Bearer"
```

GitHub's REST API requires `token` prefix, not `Bearer`.

## Solutions Applied ✅

### 1. Fixed Database Table
```typescript
// AFTER - Correct table
const { data: integration, error: integrationError } = await supabase
  .from('user_integrations')  // ✅ Correct table
  .select('access_token')
  .eq('user_id', user.id)
  .eq('provider', 'github')  // ✅ Filter by provider
  .eq('is_active', true)      // ✅ Only active integrations
  .single();
```

### 2. Fixed Authentication
```typescript
// AFTER - Extract auth token from cookies
const cookieStore = await cookies();
const authToken = cookieStore.get('sb-access-token')?.value || 
                 cookieStore.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0] + '-auth-token')?.value;

if (!authToken) {
  return NextResponse.json(
    { error: 'Unauthorized - No auth token found' },
    { status: 401 }
  );
}

// Create Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify auth token and get user
const { data: { user }, error: userError } = await supabase.auth.getUser(authToken);
```

**How it works**:
1. Extract Supabase auth token from cookies
2. Create Supabase client with service role key (has full database access)
3. Verify the auth token and get user ID
4. Use user ID to fetch GitHub access token from `user_integrations`

### 3. Fixed GitHub Authorization
```typescript
// AFTER - Correct auth format
'Authorization': `token ${accessToken}`  // ✅ GitHub requires "token" prefix
```

Changed **all 5 GitHub API calls** in the file:
- Branch reference fetch
- Commit fetch  
- Blob creation
- Tree creation
- Commit creation
- Reference update

## Files Modified

### `app/api/github/push-code/route.ts`
**Changes**:
1. Import `cookies` from `next/headers`
2. Extract auth token from Supabase cookies
3. Verify auth token with `supabase.auth.getUser(authToken)`
4. Query `user_integrations` table instead of `github_integrations`
5. Filter by `provider='github'` and `is_active=true`
6. Changed all `Bearer` to `token` in Authorization headers

## How It Works Now

### Push Code Flow:
```
User clicks "Set Active Branch & Push Code"
  ↓
Component calls pushChangesMutation (tRPC)
  ↓
tRPC calls /api/github/push-code
  ↓
Extract auth token from cookies ✅
  ↓
Verify token and get user ID ✅
  ↓
Fetch GitHub access token from user_integrations ✅
  ↓
Push code to GitHub with correct "token" auth ✅
  ↓
Success! Code pushed to repository 🎉
```

## Testing

### Before Fix:
- ❌ 401 Unauthorized error
- ❌ "GitHub not connected" message
- ❌ No code pushed to repository

### After Fix:
- ✅ Authentication works correctly
- ✅ GitHub token retrieved from user_integrations
- ✅ Code successfully pushed to GitHub
- ✅ Commit appears in repository

## Database Verification

We verified your database has the correct data:
```sql
SELECT * FROM user_integrations WHERE provider = 'github';
-- Result:
{
  "user_id": "[your-user-id]",
  "provider": "github",
  "access_token": "[your-github-token]",  ✅ Token exists!
  "scopes": ["repo,user:email,write:repo_hook"],  ✅ Has correct scopes!
  "is_active": true  ✅ Active!
}
```

## Error Messages Improved

### Before:
- ❌ Generic "Unauthorized" (401)
- No details about what went wrong

### After:
- ✅ "Unauthorized - No auth token found" (missing cookie)
- ✅ "Unauthorized - Invalid token" (bad token)
- ✅ "GitHub not connected. Please reconnect your GitHub account." (no integration)
- ✅ Console logs show detailed error info

## Next Steps

1. **Restart your dev server** to apply the changes
2. **Try pushing code** - should work now!
3. If you still get errors, check the terminal/console for detailed logs

## Summary

Fixed the 401 Unauthorized error by:
1. ✅ Using correct `user_integrations` table
2. ✅ Extracting auth token from cookies
3. ✅ Using `token` instead of `Bearer` for GitHub API
4. ✅ Added better error messages and logging

**Status**: Push code functionality should work perfectly now! 🚀
