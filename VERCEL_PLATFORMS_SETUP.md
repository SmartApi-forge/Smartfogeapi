# Vercel Platforms API Setup Guide

## 🎉 **What Changed?**

We've migrated from **Vercel OAuth Integration** (requires approval) to **Vercel Platforms API** (no approval needed)!

### **New Approach Benefits:**
- ✅ No Vercel approval required
- ✅ Instant setup - just need an access token
- ✅ Deploy to your Vercel account, then transfer to user
- ✅ v0.dev-style UI with live preview
- ✅ Real-time deployment logs
- ✅ Project claiming for users

---

## 🚀 **Quick Setup (5 Minutes)**

### **Step 1: Get Vercel Access Token**

1. Go to: https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Settings:
   ```
   Token Name: SmartForge Deployments
   Scope: Full Account (or select your team)
   Expiration: No expiration
   ```
4. Click **"Create"**
5. **Copy the token** (starts with `vercel_` or looks like a long string)

⚠️ **Save this token securely - you won't be able to see it again!**

---

### **Step 2: Get Team ID (Optional - Only for Team Accounts)**

If you're using a Vercel team account:

1. Go to: https://vercel.com/teams/YOUR-TEAM/settings
2. Copy your **Team ID** (format: `team_abc123xyz`)

If you're using a personal account, **skip this step**.

---

### **Step 3: Add Environment Variables**

#### **Local Development (.env.local):**

```bash
# Vercel Platforms API
VERCEL_ACCESS_TOKEN=vercel_your_actual_token_here
VERCEL_TEAM_ID=team_abc123xyz  # Optional - only for team accounts
```

#### **Vercel Dashboard (Production):**

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add these variables for **all environments** (Production, Preview, Development):

```
VERCEL_ACCESS_TOKEN = vercel_your_actual_token_here
VERCEL_TEAM_ID = team_abc123xyz  (optional)
```

3. Click **"Save"**

---

### **Step 4: Run Database Migration**

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase dashboard
# Copy contents of: supabase/migrations/017_vercel_platforms_update.sql
# Paste in: Supabase Dashboard → SQL Editor → Run
```

---

### **Step 5: Redeploy**

```bash
git add -A
git commit -m "feat: Migrate to Vercel Platforms API with v0.dev-style UI"
git push origin main
```

---

## 🎨 **New UI Flow**

### **1. Initial Dialog - Simple & Clean**
```
┌─────────────────────────────────┐
│ 🔺 Publish your site on Vercel  │
│                                 │
│ Publish your site for the      │
│ world to see.                   │
│                                 │
│ [🌐 Publish]                    │
└─────────────────────────────────┘
```

### **2. Building State - Show Logs**
```
┌─────────────────────────────────┐
│ ⚙️ Building your app...         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ $ npm install               │ │
│ │ $ next build                │ │
│ │ ✓ Compiled successfully     │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ supernova-ai-clone.vercel.app  │
└─────────────────────────────────┘
```

### **3. Ready State - Show Preview**
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   [Your Site Preview]       │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ supernova-ai-clone.vercel.app 🗑 │
│ Last updated just now           │
│                                 │
│ [🌐 Custom Domain] [🔺 Republish]│
│ [Transfer to Your Vercel Account]│
└─────────────────────────────────┘
```

---

## 🔧 **Files Changed**

### **New Files:**
```
✅ lib/vercel-client.ts                              - Vercel API wrapper
✅ src/services/vercel-platforms-service.ts          - Deployment service
✅ app/api/deploy/vercel/route.ts                   - Deploy endpoint
✅ app/api/deploy/vercel/[id]/route.ts             - Delete endpoint
✅ app/api/deploy/vercel/[id]/status/route.ts      - Status endpoint
✅ supabase/migrations/017_vercel_platforms_update.sql - Schema update
```

### **Deleted Files:**
```
❌ app/api/vercel/connect/route.ts                  - Old OAuth
❌ app/api/vercel/callback/route.ts                 - Old OAuth
❌ src/services/vercel-deploy-service.ts            - Old service
```

### **Updated Files:**
```
📝 components/vercel-deploy-dialog.tsx              - New v0.dev-style UI
📝 env.example                                      - Updated variables
```

---

## 🧪 **Testing the Flow**

1. **Start your local dev server:**
   ```bash
   npm run dev
   ```

2. **Open a project in the UI**

3. **Click the "Publish" button**

4. **Watch the magic happen:**
   - ✅ Initializing deployment...
   - ✅ Building your app...
   - ✅ Real-time logs appear
   - ✅ Preview shows when ready

5. **Test these features:**
   - Click "Republish" - should redeploy
   - Click "Delete" (trash icon) - should delete
   - Click "Transfer to Your Vercel Account" - opens Vercel claim page

---

## 📊 **How It Works**

```
User clicks "Publish"
    ↓
Frontend calls /api/deploy/vercel
    ↓
Backend creates Vercel project using YOUR token
    ↓
Deploys files to Vercel
    ↓
Generates transfer code for user to claim
    ↓
Frontend polls /api/deploy/vercel/[id]/status
    ↓
Shows real-time logs
    ↓
When ready, shows preview
    ↓
User can claim project to their own Vercel account
```

---

## 🔒 **Security Notes**

1. **Access Token is Server-Side Only**
   - Never exposed to frontend
   - Only used in API routes
   - Stored as environment variable

2. **User Ownership**
   - Projects are deployed to your Vercel account initially
   - Users can claim ownership via transfer URL
   - After claiming, billing transfers to their account

3. **Database Security**
   - RLS policies ensure users only see their deployments
   - All queries filtered by user_id

---

## 🐛 **Troubleshooting**

### **Error: "VERCEL_ACCESS_TOKEN environment variable is required"**
- Make sure you added the token to your environment variables
- Restart your dev server after adding `.env.local`
- In Vercel dashboard, make sure token is set for all environments

### **Error: "Failed to create project"**
- Check if your token has correct permissions
- Verify token hasn't expired
- Check Vercel dashboard for usage limits

### **Deployment stuck in "Building"**
- Check Vercel dashboard for actual deployment status
- Look at logs endpoint: `/api/deploy/vercel/[id]/status`
- May take 2-5 minutes for first deployment

---

## 🎯 **Next Steps**

1. **Get your Vercel Access Token** (Step 1 above)
2. **Add to environment variables** (Step 3 above)
3. **Run migration** (Step 4 above)
4. **Push to production** (Step 5 above)
5. **Test it out!** 🚀

---

## 💡 **Tips**

- **First deployment** might take longer (2-5 minutes)
- **Subsequent deployments** are faster (30-60 seconds)
- **Transfer URL** is valid for 24 hours
- **Logs are fetched** every 2 seconds during build
- **Preview iframe** shows your deployed site instantly

---

**Questions?** Check the code comments in:
- `lib/vercel-client.ts` - API wrapper
- `src/services/vercel-platforms-service.ts` - Deployment logic
- `components/vercel-deploy-dialog.tsx` - UI component

Happy deploying! 🎉

