# Sandbox Restoration Debugging Guide

## 🔍 Current Issue

Your console shows restoration is **being triggered** but **failing with 500 error**:

```
✅ Sandbox expired - DETECTED
✅ Auto-restoration triggered
❌ Failed with server error 500
```

## 🛠️ How Restoration Works (WITHOUT Inngest)

The restoration is **synchronous** and uses the **E2B SDK directly**:

```typescript
// Client Side (browser)
1. Detects sandbox expired
2. Calls → POST /api/sandbox/restart/[projectId]

// Server Side (Next.js API route)
3. Creates new E2B sandbox using E2B SDK
4. Uses github-repository-service to:
   - Clone repo from GitHub
   - Install dependencies (npm/pip)
   - Start dev server
5. Returns new sandbox URL
6. Client updates iframe (no page reload)
```

**No Inngest needed** - it's a direct API call!

---

## 🚨 Why It's Failing (500 Error)

The 500 error means something on the **server side** is crashing. Common causes:

### 1. Missing E2B_API_KEY
```bash
# Check your .env.local file
E2B_API_KEY=your-key-here
E2B_FULLSTACK_TEMPLATE_ID=your-template-id
```

### 2. GitHub Service Import Error
The restart API imports `@/src/services/github-repository-service` which might not exist or have errors.

### 3. E2B Template ID Wrong
Using wrong template ID or E2B quota exceeded.

---

## 🧪 Diagnostic Steps

### Step 1: Check Server Logs (CRITICAL!)

**Browser console only shows client-side errors!** You need to check where Next.js is running:

```bash
# Look for your terminal/command prompt where you ran:
npm run dev
# or
yarn dev
```

**Look for error messages like:**
```
❌ Error in /api/sandbox/restart/[projectId]:
   - "E2B_API_KEY is not defined"
   - "Cannot find module '@/src/services/...'"
   - "E2B quota exceeded"
   - "GitHub authentication failed"
```

### Step 2: Test E2B Connection

I created a test endpoint. Open in browser:

```
http://localhost:3000/api/sandbox/test-e2b
```

**Expected Success:**
```json
{
  "success": true,
  "message": "E2B is working correctly!",
  "details": {
    "templateId": "...",
    "sandboxId": "...",
    "commandOutput": "Hello from E2B"
  }
}
```

**If it fails**, the response will show exactly what's wrong with your E2B setup.

### Step 3: Verify Environment Variables

Check your `.env.local`:

```bash
# Required for E2B
E2B_API_KEY=e2b_xxxxxxxxxxxxx

# Required for GitHub
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Optional (has default)
E2B_FULLSTACK_TEMPLATE_ID=ckskh5feot2y94v5z07d
```

### Step 4: Check GitHub Integration

```sql
-- Run this in Supabase SQL Editor
SELECT 
  access_token IS NOT NULL as has_token,
  provider_username,
  is_active,
  created_at
FROM user_integrations
WHERE user_id = '27ceb1b6-98fb-4187-b7e6-a3f26d51eea5'
  AND provider = 'github';
```

Should return `has_token: true` and `is_active: true`.

---

## 🔧 Common Fixes

### Fix 1: Missing E2B_API_KEY

Add to `.env.local`:
```bash
E2B_API_KEY=your-api-key-from-e2b-dashboard
```

Restart Next.js server:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Fix 2: GitHub Service Missing

Check if file exists:
```bash
ls src/services/github-repository-service.ts
```

If missing, the service needs to be created.

### Fix 3: E2B Quota Exceeded

Check E2B dashboard: https://e2b.dev/dashboard

Free tier limits:
- 100 sandboxes/month
- 3 concurrent sandboxes

If exceeded, old sandboxes need to be killed.

### Fix 4: Wrong Template ID

Use the default template:
```bash
E2B_FULLSTACK_TEMPLATE_ID=ckskh5feot2y94v5z07d
```

Or create a custom template with Node.js/Python pre-installed.

---

## 📋 Step-by-Step Debugging

### 1. Check Terminal Output
- [ ] Open terminal where `npm run dev` is running
- [ ] Look for error messages when restoration fails
- [ ] Copy the **full error stack trace**

### 2. Test E2B
- [ ] Visit `/api/sandbox/test-e2b` in browser
- [ ] If fails, fix E2B_API_KEY
- [ ] If succeeds, E2B is working ✅

### 3. Check GitHub Token
- [ ] Verify user_integrations has valid GitHub token
- [ ] Check token hasn't expired
- [ ] Reconnect GitHub if needed

### 4. Check File Exists
```bash
# Verify github service exists
ls src/services/github-repository-service.ts

# Should show:
src/services/github-repository-service.ts
```

### 5. Manual Test
Try manually calling the restart API:

```bash
curl -X POST http://localhost:3000/api/sandbox/restart/79acd13f-d10b-4953-97c2-27047b64765a
```

Check the terminal output for detailed error.

---

## 🎯 Most Likely Issue

Based on the 500 error, it's probably **one of these**:

1. **Missing E2B_API_KEY** (80% chance)
2. **GitHub service import failing** (15% chance)
3. **E2B quota exceeded** (5% chance)

---

## 🆘 What to Send Me

If still failing after checks above, send me:

1. **Server terminal output** (the error stack trace)
2. **Result from `/api/sandbox/test-e2b`**
3. **Environment variables** (DON'T share actual keys, just confirm they exist):
   ```
   E2B_API_KEY: ✅ exists / ❌ missing
   NEXT_PUBLIC_SUPABASE_URL: ✅ exists / ❌ missing
   SUPABASE_SERVICE_ROLE_KEY: ✅ exists / ❌ missing
   ```

---

## ✅ Expected Working Flow

When everything is fixed, you should see in **server terminal**:

```
✅ Created new sandbox abc123xyz for project 79acd13f...
📥 Cloning repository: https://github.com/Shashank4507/v0-shader-animation-landing-page
✅ Repository cloned to: /home/user/repo
📦 Installing dependencies with npm...
✅ Dependencies installed successfully
🚀 Starting preview server with: npm run dev
✅ Preview server started: https://3000-newsandboxid.e2b.app
✅ Project updated with new sandbox URL
```

And in **browser console**:

```
✅ Sandbox restored successfully!
   Framework: nextjs
   URL: https://3000-newsandboxid.e2b.app
🔄 Updating sandbox URL
```

Then the preview loads automatically! 🎉

---

## 🔑 Key Point

**The restoration DOES NOT use Inngest!**

It's a simple synchronous flow:
1. Client calls API route
2. API route uses E2B SDK directly
3. Returns new URL
4. Client updates iframe

The only requirements are:
- E2B_API_KEY environment variable
- github-repository-service file exists
- GitHub integration is connected
