# Vercel Integration & GitHub Features Setup Guide

This guide covers the new Vercel deployment integration and enhanced GitHub features in SmartAPIForge.

## 🆕 What's New

### ✅ Vercel Integration
- **OAuth-based deployment**: Users connect their Vercel account once, then deploy with one click
- **Automatic project management**: Creates Vercel projects automatically
- **Deployment tracking**: Tracks all deployments in the database
- **Live URLs**: Get instant access to deployed project URLs

### ✅ Enhanced GitHub Features
- **Fixed branch fetching**: Resolved "window not responding" issues
- **Timeout protection**: Added 10-second timeout to prevent hanging
- **Better error handling**: Clear, actionable error messages
- **Branch creation**: Create new branches directly from the UI
- **Push/Pull changes**: Sync code bidirectionally with GitHub
- **Sandbox restart**: Automatically restarts sandbox after pulling changes

---

## 📋 Prerequisites

1. **Supabase Project** - Already configured
2. **GitHub OAuth** - Already configured
3. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
4. **Daytona Workspace** - Already configured

---

## 🔧 Vercel Integration Setup

### Step 1: Create Vercel Integration

1. Go to [Vercel Integrations Console](https://vercel.com/dashboard/integrations/console)
2. Click **"Create Integration"**
3. Fill in the details:
   - **Name**: SmartAPIForge (or your app name)
   - **Logo**: Upload a 160x160px logo
   - **Description**: AI-powered API generation platform
   - **Redirect URL**: 
     - Development: `http://localhost:3000/api/vercel/callback`
     - Production: `https://your-domain.com/api/vercel/callback`
   - **Required Scopes**:
     - ✅ `project` (read/write)
     - ✅ `deployment` (read/write)
     - ✅ `user` (read)
     - ✅ `team` (read) - optional but recommended

4. Click **"Create"**
5. Copy your **Client ID** and **Client Secret**

### Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Vercel Integration
VERCEL_CLIENT_ID=your_client_id_from_step_1
VERCEL_CLIENT_SECRET=your_client_secret_from_step_1
VERCEL_REDIRECT_URI=http://localhost:3000/api/vercel/callback

# App URL (required for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Production**, update:
```bash
VERCEL_REDIRECT_URI=https://your-domain.com/api/vercel/callback
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 3: Run Database Migration

Run the Vercel integration migration:

```bash
# Using Supabase CLI
supabase migration up

# Or apply directly in Supabase Dashboard
# Go to SQL Editor and run: supabase/migrations/016_vercel_integration.sql
```

This creates:
- `vercel_connections` table - Stores user OAuth tokens
- `deployments` table - Tracks all deployments

### Step 4: Restart Your App

```bash
npm run dev
```

---

## 🚀 Using the Vercel Integration

### For Users

1. **Open a Project** in SmartAPIForge
2. **Click "Publish"** button in the header (now shows Vercel logo)
3. **First Time**: Click "Connect Vercel Account"
   - Redirects to Vercel OAuth
   - Authorize the integration
   - Redirects back to your project
4. **Deploy**: Click "Deploy to Vercel"
   - Deploys your project code
   - Shows deployment status
   - Provides live URL
5. **Redeploy**: Click "Redeploy to Vercel" to update

### Deployment Flow

```
User clicks Publish
  ↓
Check if Vercel connected
  ↓ (No)
  Show Connect Screen → OAuth Flow → Store Token
  ↓ (Yes)
  Show Deploy Screen
  ↓
Click Deploy
  ↓
Package files → Send to Vercel API → Create deployment
  ↓
Show live URL + deployment status
```

---

## 🔀 Enhanced GitHub Features

### Branch Management

#### Fetch Branches
- Opens automatically when you click the GitHub icon
- Shows all repository branches
- Auto-selects current active branch
- Handles errors gracefully (404, auth failures, timeouts)

#### Create Branch
1. Click **GitHub icon** in header
2. Click **"Create Branch"** or **"+"** button
3. Enter branch name (e.g., `feature/new-api`)
4. Click **"Create"**
5. Branch is created on GitHub and locally selected

#### Switch Branches
1. Click **GitHub icon** in header
2. Select branch from dropdown
3. Branch is now active for push/pull operations

### Push Changes
1. Make changes to your project code
2. Click **GitHub icon** → **"Push Changes"**
3. Code is committed and pushed to active branch
4. Commit message: "Update from SmartAPIForge - [timestamp]"

### Pull Changes
1. Click **GitHub icon** → **"Pull Changes"**
2. Latest code from active branch is fetched
3. Files are updated in the database
4. **Sandbox automatically restarts** with new changes
5. Page reloads to show updated preview

### Initial Setup (for cloned repos)
1. Click **GitHub icon** in header
2. Select the branch you want to work with
3. Click **"Set Active Branch & Push Code"**
4. Initial code is pushed to selected branch
5. Branch is now active

---

## 🐛 Troubleshooting

### Vercel Issues

#### "Vercel not connected" error
- **Solution**: Click "Publish" → "Connect Vercel Account"
- Ensure environment variables are set correctly

#### "Failed to deploy" error
- Check Vercel API status
- Verify OAuth token hasn't expired
- Check browser console for detailed errors

#### "Project already exists" error
- The system reuses existing Vercel projects
- This is normal behavior - deployment will update existing project

### GitHub Issues

#### "Repository not found" error
- Ensure GitHub OAuth is properly configured
- User must have access to the repository
- Check repository URL is valid

#### "Failed to fetch branches" timeout
- Network issue or GitHub API rate limit
- Wait a moment and try again
- Check GitHub API status

#### "Window not responding" (FIXED)
- This issue has been resolved with timeout protection
- If it still occurs, check browser console for errors

#### Branch not updating after pull
- Sandbox restart should happen automatically
- If not, manually refresh the page
- Check `/api/sandbox/restart/[projectId]` logs

---

## 🏗️ Architecture

### Vercel Integration

```
Frontend (components/vercel-deploy-dialog.tsx)
  ↓
tRPC Router (src/trpc/routers/vercel.ts)
  ↓
Service (src/services/vercel-deploy-service.ts)
  ↓
Vercel API (api.vercel.com)
  ↓
Database (vercel_connections, deployments)
```

### GitHub Integration

```
Frontend (components/github-branch-selector-v0.tsx)
  ↓
tRPC Router (src/trpc/routers/github.ts)
  ↓
Services:
  - github-repository-service.ts (branches, repos)
  - github-sync-service.ts (push/pull)
  ↓
GitHub API (api.github.com)
  ↓
Database (github_repositories, projects)
  ↓
Sandbox Restart (app/api/sandbox/restart/[projectId])
```

---

## 🔒 Security Notes

### Vercel Tokens
- Stored in `vercel_connections` table
- Protected by Row Level Security (RLS)
- One connection per user
- **TODO**: Add encryption for access tokens (recommended for production)

### GitHub Tokens
- Already encrypted using `GITHUB_TOKEN_ENCRYPTION_KEY`
- Stored in `user_integrations` table
- Protected by RLS

### Best Practices
1. **Never commit** `.env.local` to version control
2. **Rotate secrets** regularly in production
3. **Use different** OAuth apps for dev/staging/prod
4. **Monitor** API usage to prevent rate limit issues
5. **Implement** token refresh logic for long-lived integrations

---

## 📊 Database Schema

### Vercel Tables

```sql
-- User's Vercel OAuth connection
vercel_connections (
  id UUID PRIMARY KEY,
  user_id UUID → auth.users,
  access_token TEXT,
  team_id TEXT,
  configuration_id TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Deployment tracking
deployments (
  id UUID PRIMARY KEY,
  user_id UUID → auth.users,
  project_id UUID → projects,
  vercel_project_id TEXT,
  vercel_deployment_id TEXT,
  deployment_url TEXT,
  status TEXT, -- building, ready, error, canceled
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## 🧪 Testing

### Test Vercel Integration

1. **Development**:
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Create/open a project
   # Click "Publish" → Connect Vercel
   ```

2. **Verify OAuth**:
   - Should redirect to Vercel
   - Authorize the integration
   - Redirect back with success message
   - Check database: `vercel_connections` has new row

3. **Test Deployment**:
   - Click "Deploy to Vercel"
   - Wait for deployment (1-3 minutes)
   - Click "View Live Site"
   - Verify project is accessible

### Test GitHub Features

1. **Test Branch Fetching**:
   - Open project with GitHub repo
   - Click GitHub icon
   - Should load branches within 2-3 seconds
   - If empty repo, shows "no branches" message

2. **Test Branch Creation**:
   - Click "Create Branch"
   - Enter name: `test-branch`
   - Verify on GitHub the branch exists

3. **Test Pull Changes**:
   - Make changes on GitHub (edit a file)
   - Click "Pull Changes"
   - Wait for sandbox restart
   - Verify changes appear in preview

---

## 📚 API Reference

### Vercel API Routes

- `GET /api/vercel/connect` - Start OAuth flow
- `GET /api/vercel/callback` - Handle OAuth callback

### Vercel tRPC Procedures

- `vercel.getConnectionStatus` - Check if user connected
- `vercel.disconnect` - Remove Vercel connection
- `vercel.deployProject` - Deploy project to Vercel
- `vercel.getDeploymentStatus` - Check deployment status
- `vercel.getDeployments` - List user's deployments
- `vercel.getLatestDeployment` - Get latest deployment for project

### GitHub tRPC Procedures (Updated)

- `github.getBranches` - Fetch repository branches (with timeout)
- `github.createBranch` - Create new branch
- `github.updateActiveBranch` - Set active branch
- `github.pushChanges` - Push code to GitHub
- `github.pullChanges` - Pull code from GitHub (triggers sandbox restart)

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Vercel Webhooks**: Listen for deployment status updates
2. **Custom Domains**: Allow users to add custom domains
3. **Environment Variables**: Let users set env vars for deployments
4. **Preview Deployments**: Deploy to preview URLs first
5. **Deployment History**: Show full deployment timeline
6. **GitHub Webhooks**: Auto-pull when changes are pushed
7. **Branch Protection**: Warn before pushing to protected branches
8. **Conflict Resolution**: Handle merge conflicts gracefully

### Production Checklist

- [ ] Update redirect URLs in Vercel integration settings
- [ ] Set production environment variables
- [ ] Enable token encryption for Vercel tokens
- [ ] Set up monitoring for API rate limits
- [ ] Add error tracking (Sentry, LogRocket, etc.)
- [ ] Test with multiple Vercel team accounts
- [ ] Document user-facing features
- [ ] Add deployment analytics

---

## 🤝 Support

If you encounter issues:

1. Check browser console for errors
2. Verify environment variables are set
3. Check Supabase logs for database errors
4. Check Vercel integration dashboard
5. Review GitHub API rate limits

---

## 📝 Changelog

### v1.0.0 - Initial Release
- ✅ Vercel OAuth integration
- ✅ One-click deployment
- ✅ GitHub branch fetching fixes
- ✅ Branch creation/switching
- ✅ Push/Pull with sandbox restart
- ✅ Comprehensive error handling
- ✅ Timeout protection (10s)

---

Made with ❤️ by SmartAPIForge Team

