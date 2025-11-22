# Vercel Publish Feature - Setup Guide

## Overview

The Publish Dialog provides a Vercel-style deployment interface with:
- **Visibility Settings** - Public or Password Protected
- **Custom Domain** - Add vercel.app subdomains
- **One-Click Deployment** - Deploy to Vercel directly

## Usage

### Basic Implementation

```tsx
import { PublishDialog } from "@/components/publish-dialog";
import { Button } from "@/components/ui/button";

<PublishDialog projectId="project-123" projectName="My Project">
  <Button>Publish</Button>
</PublishDialog>
```

## Features

### 1. Main View
- **Customize Domain** - Opens domain configuration
- **Visibility** - Shows current visibility (public/password)
- **Publish to Production** - Deploys to Vercel

### 2. Visibility Settings
Two options:
- **Public** - Anyone with URL can access
- **Password Protected** - Requires password to view

### 3. Custom Domain
- Subdomain format: `your-name.vercel.app`
- Validates domain availability
- Saves configuration

## Dropdown Auto-Close Fix

The Share Dialog dropdown now closes immediately when you select an option:

```tsx
// In share-dialog.tsx
const [selectOpen, setSelectOpen] = useState(false);

<Select 
  open={selectOpen}
  onOpenChange={setSelectOpen}
  onValueChange={(value) => {
    setSelectOpen(false); // Close immediately
    // ... rest of logic
  }}
>
```

## Vercel Integration (TODO)

To connect to Vercel, you'll need to:

### 1. Set up Vercel OAuth

```bash
# Install Vercel SDK
npm install @vercel/client
```

### 2. Create API Route for Vercel Auth

```ts
// app/api/vercel/connect/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/vercel/callback`;
  
  const authUrl = `https://vercel.com/oauth/authorize?client_id=${VERCEL_CLIENT_ID}&redirect_uri=${redirectUri}&scope=deployments`;
  
  return Response.redirect(authUrl);
}
```

### 3. Create Callback Handler

```ts
// app/api/vercel/callback/route.ts
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  
  // Exchange code for access token
  const response = await fetch('https://vercel.com/api/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.VERCEL_CLIENT_ID,
      client_secret: process.env.VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/vercel/callback`,
    }),
  });
  
  const { access_token } = await response.json();
  
  // Store access_token in database for user
  // Redirect back to app
  return Response.redirect('/');
}
```

### 4. Create Deployment API

```ts
// app/api/vercel/deploy/route.ts
import { createClient } from '@vercel/client';

export async function POST(request: NextRequest) {
  const { projectId, visibility, domain, password } = await request.json();
  
  // Get user's Vercel access token from database
  const accessToken = getUserVercelToken(userId);
  
  const vercel = createClient({ token: accessToken });
  
  // Create deployment
  const deployment = await vercel.deployments.create({
    name: projectName,
    files: projectFiles,
    projectSettings: {
      framework: 'nextjs',
      buildCommand: 'npm run build',
      outputDirectory: '.next',
    },
  });
  
  // Set password protection if needed
  if (visibility === 'password' && password) {
    await vercel.deployments.updatePasswordProtection(deployment.id, {
      password,
    });
  }
  
  // Set custom domain
  if (domain) {
    await vercel.domains.add(deployment.id, `${domain}.vercel.app`);
  }
  
  return Response.json({ 
    success: true, 
    url: deployment.url 
  });
}
```

### 5. Update PublishDialog Component

```tsx
const handlePublish = async () => {
  setIsPublishing(true);
  
  try {
    const response = await fetch('/api/vercel/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        visibility,
        domain: customDomain,
        password,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      toast.success('Published successfully!', {
        description: `Visit: ${data.url}`,
      });
    }
  } catch (error) {
    toast.error('Failed to publish');
  } finally {
    setIsPublishing(false);
  }
};
```

## Environment Variables

Add to `.env.local`:

```env
VERCEL_CLIENT_ID=your-vercel-client-id
VERCEL_CLIENT_SECRET=your-vercel-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Testing

1. **Test Dropdown Close**:
   - Open share dialog
   - Click visibility dropdown
   - Select any option
   - Dropdown should close immediately ✓

2. **Test Toast Stacking**:
   - Change visibility multiple times
   - Only one toast should show at a time ✓

3. **Test Publish Dialog**:
   - Click Publish button
   - Navigate through Visibility and Domain views
   - Check back navigation works ✓

## Next Steps

1. ✅ Create Vercel OAuth app
2. ✅ Set up environment variables
3. ✅ Implement API routes
4. ✅ Test deployment flow
5. ✅ Add error handling
6. 🚀 Deploy to production

## Notes

- The dropdown now closes immediately on selection
- Toasts are properly managed (no stacking)
- Dialog size is optimized
- Vercel integration requires OAuth setup
- Password protection uses Vercel's native feature
- Custom domains work with vercel.app subdomains

Enjoy your new publish feature! 🎉
