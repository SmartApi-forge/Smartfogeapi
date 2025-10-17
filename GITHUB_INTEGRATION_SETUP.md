# GitHub Integration Setup Guide

This guide walks you through setting up the GitHub integration feature in SmartForge.

## Prerequisites

- GitHub account
- Supabase project set up
- E2B API key
- Node.js 18+ installed

## Step 1: Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: SmartForge (or your app name)
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click "Register application"
5. Copy the **Client ID**
6. Generate a new **Client Secret** and copy it

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp env.example .env.local
   ```

2. Add your GitHub OAuth credentials to `.env.local`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id_here
   GITHUB_CLIENT_SECRET=your_github_client_secret_here
   GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
   ```

3. Ensure E2B configuration is present:
   ```env
   E2B_API_KEY=your_e2b_api_key
   E2B_FULLSTACK_TEMPLATE_ID=smart-forge-fullstack
   ```

## Step 3: Apply Database Migrations

Run the GitHub integration migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually apply the migration in Supabase Dashboard
# SQL Editor → Run supabase/migrations/008_github_integration.sql
```

This creates the following tables:
- `user_integrations` - Stores OAuth tokens
- `github_repositories` - Connected repositories
- `github_sync_history` - Sync operation history

## Step 4: Build E2B Full-Stack Template

The full-stack template supports Next.js, React, Vue, and other frameworks for preview:

```bash
# Install E2B CLI if not already installed
npm install -g @e2b/cli

# Authenticate with E2B
e2b auth login

# Build the full-stack template
e2b template build -c e2b-fullstack.toml

# Copy the template ID from the output and update .env.local
# E2B_FULLSTACK_TEMPLATE_ID=<your_template_id>
```

## Step 5: Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

## Step 6: Start Development Server

```bash
npm run dev
```

## How to Use

### Connecting GitHub

1. Navigate to `/ask` page
2. Click the **GitHub** button in the prompt input area
3. Click "Connect GitHub Account"
4. Authorize SmartForge to access your repositories
5. Select a repository from the dropdown

### Generating Code with GitHub Repository

1. After selecting a repository, enter your prompt
2. The system will:
   - Clone the repository to an E2B sandbox
   - Install dependencies automatically
   - Detect the framework (Next.js, React, Vue, etc.)
   - Start a preview server (if applicable)
   - Generate code based on your prompt and repository context
   - Create a Pull Request with the changes

### Two-Way Synchronization

**Push Changes** (Automatic):
- When code is generated with a GitHub repository selected
- A new branch is created (`smartforge/api-generation-<timestamp>`)
- Changes are committed and a Pull Request is created automatically

**Pull Changes** (Future feature):
- Users can pull latest changes from their repository
- Sync local project with GitHub repository changes

### Preview Server

For full-stack projects:
- The preview server starts automatically in the E2B sandbox
- Access it through the project's `sandbox_url` field
- Supports common ports:
  - 3000 for Next.js/Express
  - 5173 for Vite
  - 4200 for Angular
  - 8000 for FastAPI

## Security Considerations

### Token Storage

- GitHub access tokens are stored in the `user_integrations` table
- **Important**: In production, encrypt tokens at rest using Supabase Vault
- Implement token rotation for expired tokens

### Repository Access

- Only repositories the user has access to are shown
- OAuth scopes requested: `repo`, `user:email`, `write:repo_hook`
- Users can revoke access anytime from Settings

### Rate Limiting

- GitHub API has rate limits (5,000 requests/hour for authenticated users)
- Implement caching for repository lists
- Show rate limit warnings to users

## Troubleshooting

### "GitHub not connected" error
- Ensure OAuth callback URL matches exactly in GitHub OAuth App settings
- Check that environment variables are correctly set
- Verify user has completed OAuth flow

### Repository clone fails
- Verify user has access to the repository
- Check that GitHub token has correct scopes
- Ensure E2B sandbox has git installed

### Preview server doesn't start
- Check framework detection worked correctly
- Verify dependencies installed successfully
- Review E2B sandbox logs for errors

### Pull Request creation fails
- Ensure user has write access to the repository
- Check GitHub token hasn't expired
- Verify repository settings allow PRs

## Production Deployment

### Environment Variables

Update for production:
```env
GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/github/callback
```

Update GitHub OAuth App:
- Add production callback URL
- Enable production homepage URL

### Security Hardening

1. **Encrypt tokens at rest**: Use Supabase Vault
   ```sql
   -- Example encryption (adjust for your setup)
   CREATE EXTENSION IF NOT EXISTS pgsodium;
   -- Encrypt access_token column
   ```

2. **Implement rate limiting**: Add rate limiters to API routes

3. **Monitor usage**: Track GitHub API usage and E2B sandbox costs

4. **Audit logs**: Enable audit logging for sensitive operations

## API Reference

### tRPC Endpoints

```typescript
// Check integration status
const status = await trpc.github.getIntegrationStatus.query();

// List repositories
const repos = await trpc.github.listRepositories.query({ page: 1, perPage: 30 });

// Connect repository
const result = await trpc.github.connectRepository.mutate({
  repositoryId: 12345,
  repositoryFullName: "owner/repo",
  projectId: "uuid",
});

// Push changes
const pushResult = await trpc.github.pushChanges.mutate({
  repositoryId: "uuid",
  projectId: "uuid",
  branchName: "feature/new-api",
  files: { "index.js": "content..." },
  commitMessage: "Add new API endpoint",
  createPR: true,
});

// Create repository
const newRepo = await trpc.github.createRepository.mutate({
  name: "my-new-repo",
  isPrivate: true,
  description: "Created by SmartForge",
});
```

## Support

For issues or questions:
- Check existing GitHub Issues
- Review Supabase logs
- Inspect E2B sandbox logs
- Contact support

## License

[Your License Here]

