# 🚀 Quick Start - New Features

## ✅ What Has Been Implemented

### 1. **Vercel Integration** (Complete Deployment System)
- OAuth authentication with Vercel
- One-click deployment to user's Vercel account
- Deployment tracking and status monitoring
- Live URL generation for deployed projects

### 2. **GitHub Enhancements** (Fixed & Improved)
- ✅ Fixed "window not responding" issue with timeout protection
- ✅ Better error handling with clear messages
- ✅ Branch creation directly from UI
- ✅ Improved branch fetching with auto-retry
- ✅ Automatic sandbox restart after pulling changes
- ✅ Push/Pull code synchronization

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Add Environment Variables

Add to your `.env.local`:

```bash
# Vercel Integration
VERCEL_CLIENT_ID=your_vercel_client_id
VERCEL_CLIENT_SECRET=your_vercel_client_secret
VERCEL_REDIRECT_URI=http://localhost:3000/api/vercel/callback

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 2: Create Vercel Integration

1. Visit: https://vercel.com/dashboard/integrations/console
2. Click "Create Integration"
3. Set redirect URL: `http://localhost:3000/api/vercel/callback`
4. Enable scopes: `project`, `deployment`, `user`, `team`
5. Copy Client ID and Secret to `.env.local`

### Step 3: Run Database Migration

```bash
# Using Supabase CLI
supabase migration up

# OR manually in Supabase Dashboard SQL Editor
# Run: supabase/migrations/016_vercel_integration.sql
```

### Step 4: Restart App

```bash
npm run dev
```

---

## 🎯 Test It Out

### Test Vercel Deployment

1. Open any project in your app
2. Look for **"Publish"** button in header (has Vercel triangle logo)
3. Click it → "Connect Vercel Account"
4. Authorize on Vercel
5. Click "Deploy to Vercel"
6. Wait ~1-3 minutes
7. Click "View Live Site"

### Test GitHub Features

1. **Open a project** with GitHub repository
2. **Click GitHub icon** in header
3. **See branches load** (should be fast now, no hanging!)
4. **Create a new branch**: Click "+", enter name like `feature/test`
5. **Switch branches**: Select different branch from dropdown
6. **Pull changes**: Click "Pull Changes" → Sandbox restarts automatically
7. **Push changes**: Edit code → Click "Push Changes"

---

## 📁 Files Created/Modified

### New Files
- ✅ `supabase/migrations/016_vercel_integration.sql` - Database tables
- ✅ `app/api/vercel/connect/route.ts` - OAuth start
- ✅ `app/api/vercel/callback/route.ts` - OAuth callback
- ✅ `src/services/vercel-deploy-service.ts` - Deployment logic
- ✅ `src/trpc/routers/vercel.ts` - Vercel API endpoints
- ✅ `components/vercel-deploy-dialog.tsx` - UI for deployment
- ✅ `VERCEL_GITHUB_SETUP_GUIDE.md` - Detailed documentation
- ✅ `QUICK_START.md` - This file

### Modified Files
- ✅ `components/simple-header.tsx` - Replaced Publish button with Vercel integration
- ✅ `components/github-branch-selector-v0.tsx` - Fixed hanging issue, added sandbox restart
- ✅ `src/trpc/routers/_app.ts` - Added Vercel router
- ✅ `env.example` - Added Vercel variables

---

## 🐛 Known Issues Fixed

1. ✅ **"Window not responding"** when clicking GitHub branches
   - Added 10-second timeout
   - Better error handling
   - Prevents infinite loops

2. ✅ **Branches not fetching for cloned repos**
   - Improved repo info extraction
   - Better authentication handling
   - Clear error messages

3. ✅ **No sandbox restart after pull**
   - Now automatically restarts sandbox
   - Reloads page to show changes
   - Handles errors gracefully

---

## 🎨 UI Changes

### Before → After

**Publish Button:**
- Before: Generic "Publish" with Globe icon
- After: "Publish" with Vercel triangle logo

**GitHub Branch Selector:**
- Before: Could hang/freeze
- After: Fast, responsive, with loading states

**Pull Changes:**
- Before: Just pulled files, no refresh
- After: Pulls files + restarts sandbox + reloads page

---

## 🔥 What Users Can Now Do

### Vercel Deployment
1. Connect Vercel account (one time)
2. Deploy any project with one click
3. Get instant live URL
4. Redeploy updates easily
5. Track deployment history

### GitHub Workflow
1. View all branches (fast!)
2. Create new branches from UI
3. Switch between branches
4. Push local changes to GitHub
5. Pull remote changes + auto-restart
6. See changes immediately in preview

---

## 📊 Database Changes

### New Tables
```
vercel_connections
├─ id (UUID)
├─ user_id (→ auth.users)
├─ access_token (TEXT)
├─ team_id (TEXT, nullable)
├─ configuration_id (TEXT)
└─ timestamps

deployments
├─ id (UUID)
├─ user_id (→ auth.users)
├─ project_id (→ projects)
├─ vercel_project_id (TEXT)
├─ vercel_deployment_id (TEXT)
├─ deployment_url (TEXT)
├─ status (TEXT)
└─ timestamps
```

---

## 🚨 Important Notes

### For Development
- Works with `localhost:3000`
- No HTTPS required for testing
- Can use ngrok for external testing

### For Production
- Update `VERCEL_REDIRECT_URI` to production URL
- Update `NEXT_PUBLIC_APP_URL` to production domain
- Update Vercel integration settings
- Enable token encryption (recommended)

### Rate Limits
- GitHub API: 5,000 requests/hour (authenticated)
- Vercel API: Depends on plan
- Both have good limits for typical usage

---

## 🧪 Testing Checklist

- [ ] Environment variables set
- [ ] Database migration applied
- [ ] App restarted
- [ ] Can open Publish dialog
- [ ] Can connect Vercel account
- [ ] Can deploy a project
- [ ] Deployment URL works
- [ ] GitHub branch selector opens fast
- [ ] Can see all branches
- [ ] Can create new branch
- [ ] Can switch branches
- [ ] Can pull changes
- [ ] Sandbox restarts after pull
- [ ] Can push changes

---

## 💡 Tips

### Deployment Tips
- First deployment takes longer (2-3 min)
- Subsequent deployments are faster (1-2 min)
- Status shows "building" → "ready"
- Can deploy same project multiple times

### GitHub Tips
- Always pull before pushing to avoid conflicts
- Use descriptive branch names (e.g., `feature/api-auth`)
- Sandbox restart takes 30-60 seconds
- Can work with private repos (just need GitHub OAuth)

---

## 📞 Need Help?

### Check These First
1. Browser console (F12) for errors
2. Supabase logs for database issues
3. Terminal for server errors
4. Network tab for API failures

### Common Solutions
- **OAuth redirect fails**: Check URLs match exactly
- **Deployment fails**: Check Vercel API status
- **Branch fetch timeout**: Wait and retry
- **Sandbox not restarting**: Check Daytona API

---

## 🎉 You're All Set!

Everything is ready to test. Start with:
1. Create a test project
2. Connect Vercel
3. Deploy it
4. Visit the live URL

Then test GitHub features:
1. Clone a repo or create one
2. Switch branches
3. Pull/push changes
4. Create new branches

**All features work together seamlessly!** 🚀

---

Questions? Check `VERCEL_GITHUB_SETUP_GUIDE.md` for detailed docs.

