# so here is the application which im working on, its similar to loveable or v0, which need a integration to deploy or publish in web! so i need a vercel integration for deplying the code generated for each project

Perfect! Now I understand your use case better. Based on how **v0.dev** and **Lovable** work, here's a complete implementation guide for your AI code generation platform:

## How v0/Lovable Deploy to Vercel

Both platforms use **Vercel OAuth integration** where:

1. Users connect their Vercel account once via OAuth
2. Each time they click "Publish/Deploy", the app uses their OAuth token to deploy directly to their account
3. No transfer needed - deployments go straight to user's Vercel account

## Complete Implementation for Your Platform

### Step 1: Create Vercel Integration (One-Time Setup)

1. Go to [Vercel Integration Console](https://vercel.com/dashboard/integrations/console)
2. Click **Create Integration**
3. Fill in details:
    - **Name**: Your App Name
    - **Logo**: Upload 160x160px image
    - **Redirect URL**: `https://yourapp.com/api/vercel/callback` (or `http://localhost:3000/api/vercel/callback` for dev)
    - **Required Scopes**:
        - `project` (read/write)
        - `deployment` (read/write)
        - `user` (read)
        - `team` (read) - optional but recommended
4. Save and copy your **Client ID** and **Client Secret**

### Step 2: Environment Setup

```env
# .env.local
VERCEL_CLIENT_ID=your_client_id_here
VERCEL_CLIENT_SECRET=your_client_secret_here
VERCEL_REDIRECT_URI=http://localhost:3000/api/vercel/callback
# For production: https://yourapp.com/api/vercel/callback

# Your app's base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```


### Step 3: Database Schema (Supabase)

```sql
-- Store user's Vercel connection
CREATE TABLE vercel_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  team_id TEXT, -- null for personal accounts
  configuration_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Store deployments
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  vercel_project_id TEXT NOT NULL,
  vercel_deployment_id TEXT NOT NULL,
  deployment_url TEXT NOT NULL,
  status TEXT DEFAULT 'building', -- building, ready, error
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```


### Step 4: Vercel OAuth Flow Implementation

```typescript
// app/api/vercel/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }

  // Build Vercel OAuth URL
  const authUrl = new URL('https://vercel.com/integrations/oauth/authorize');
  authUrl.searchParams.set('client_id', process.env.VERCEL_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.VERCEL_REDIRECT_URI!);
  authUrl.searchParams.set('state', user.id); // Pass user ID for verification
  
  return NextResponse.redirect(authUrl.toString());
}
```

```typescript
// app/api/vercel/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const searchParams = req.nextUrl.searchParams;
  
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user_id
  const teamId = searchParams.get('teamId'); // null for personal accounts
  const configurationId = searchParams.get('configurationId');
  
  if (!code || !state || !configurationId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_params`
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_CLIENT_ID!,
        client_secret: process.env.VERCEL_CLIENT_SECRET!,
        code: code,
        redirect_uri: process.env.VERCEL_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, team_id } = tokenData;

    // Store in database
    const { error } = await supabase
      .from('vercel_connections')
      .upsert({
        user_id: state,
        access_token: access_token,
        team_id: team_id || teamId,
        configuration_id: configurationId,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?vercel_connected=true`
    );
    
  } catch (error) {
    console.error('Vercel OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=auth_failed`
    );
  }
}
```


### Step 5: Deploy Function (The Core Logic)

```typescript
// lib/vercel-deploy.ts
import { createClient } from '@supabase/supabase-js';

interface DeploymentConfig {
  projectName: string;
  files: Array<{ file: string; data: string }>;
  framework?: 'nextjs' | 'vite' | 'react';
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
}

export async function deployToVercel(
  userId: string,
  projectId: string,
  config: DeploymentConfig
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get user's Vercel connection
  const { data: connection, error: connError } = await supabase
    .from('vercel_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (connError || !connection) {
    throw new Error('Vercel not connected. Please connect your Vercel account first.');
  }

  const { access_token, team_id } = connection;
  const baseUrl = team_id 
    ? `https://api.vercel.com/v10/projects?teamId=${team_id}`
    : 'https://api.vercel.com/v10/projects';

  try {
    // 2. Create or get Vercel project
    let vercelProjectId: string;
    
    // Check if project already exists
    const existingDeployment = await supabase
      .from('deployments')
      .select('vercel_project_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingDeployment.data?.vercel_project_id) {
      vercelProjectId = existingDeployment.data.vercel_project_id;
    } else {
      // Create new Vercel project
      const projectResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: config.projectName,
          framework: config.framework || 'nextjs',
        }),
      });

      if (!projectResponse.ok) {
        const error = await projectResponse.text();
        throw new Error(`Failed to create Vercel project: ${error}`);
      }

      const projectData = await projectResponse.json();
      vercelProjectId = projectData.id;
    }

    // 3. Create deployment
    const deployUrl = team_id
      ? `https://api.vercel.com/v13/deployments?teamId=${team_id}`
      : 'https://api.vercel.com/v13/deployments';

    const deploymentResponse = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.projectName,
        files: config.files,
        projectSettings: {
          framework: config.framework || 'nextjs',
          buildCommand: config.buildCommand || 'npm run build',
          outputDirectory: config.outputDirectory || '.next',
          installCommand: config.installCommand || 'npm install',
        },
        target: 'production',
      }),
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.text();
      throw new Error(`Deployment failed: ${error}`);
    }

    const deploymentData = await deploymentResponse.json();
    const deploymentUrl = deploymentData.alias?.[^0] || deploymentData.url;

    // 4. Store deployment in database
    await supabase.from('deployments').insert({
      user_id: userId,
      project_id: projectId,
      vercel_project_id: vercelProjectId,
      vercel_deployment_id: deploymentData.id,
      deployment_url: `https://${deploymentUrl}`,
      status: 'building',
    });

    return {
      success: true,
      url: `https://${deploymentUrl}`,
      deploymentId: deploymentData.id,
    };

  } catch (error) {
    console.error('Deployment error:', error);
    throw error;
  }
}
```


### Step 6: API Route for Deployment

```typescript
// app/api/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { deployToVercel } from '@/lib/vercel-deploy';

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, generatedCode } = await req.json();
    
    // Package your generated code into Vercel-compatible files
    const files = packageCodeForVercel(generatedCode);
    
    const result = await deployToVercel(user.id, projectId, {
      projectName: `project-${projectId}`,
      files,
      framework: 'nextjs', // or detect from your project
    });

    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper to convert your generated code to Vercel file format
function packageCodeForVercel(generatedCode: any) {
  // Example for Next.js project
  return [
    {
      file: 'package.json',
      data: JSON.stringify({
        name: 'generated-app',
        version: '1.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: 'latest',
          react: 'latest',
          'react-dom': 'latest',
        },
      }),
    },
    {
      file: 'app/page.tsx',
      data: generatedCode.mainFile,
    },
    {
      file: 'app/layout.tsx',
      data: `export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        )
      }`,
    },
    // Add more files as needed
  ];
}
```


### Step 7: Frontend UI Component

```typescript
// components/VercelDeployButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VercelDeployButton({ 
  projectId,
  isConnected 
}: { 
  projectId: string;
  isConnected: boolean;
}) {
  const [deploying, setDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = () => {
    window.location.href = '/api/vercel/connect';
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();
      
      if (data.error) {
        alert(`Deployment failed: ${data.error}`);
      } else {
        setDeploymentUrl(data.url);
        alert(`Deployed successfully! ${data.url}`);
      }
    } catch (error) {
      alert('Deployment failed. Please try again.');
    } finally {
      setDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <button 
        onClick={handleConnect}
        className="btn btn--primary"
      >
        Connect Vercel
      </button>
    );
  }

  return (
    <div className="flex gap-8">
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="btn btn--primary"
      >
        {deploying ? 'Deploying...' : 'Deploy to Vercel'}
      </button>
      
      {deploymentUrl && (
        <a 
          href={deploymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--secondary"
        >
          View Live Site
        </a>
      )}
    </div>
  );
}
```


## Key Differences from Transfer Approach

| Transfer Approach | OAuth Approach (Recommended) |
| :-- | :-- |
| Deploy to your account first | Deploy directly to user's account |
| Generate transfer code | No transfer needed |
| User must claim within 24h | Instant ownership |
| Extra API calls | Fewer API calls |
| Complex UX | Seamless UX |

## Testing Locally

1. Create integration with `http://localhost:3000/api/vercel/callback`
2. Add your Client ID/Secret to `.env.local`
3. Run your app and test the OAuth flow
4. Deploy a test project

## Production Checklist

- [ ] Update Redirect URL to production domain
- [ ] Store access tokens securely (encrypted in DB)
- [ ] Add error handling for expired/revoked tokens
- [ ] Implement webhook to track deployment status
- [ ] Add UI to disconnect Vercel
- [ ] Handle team switching (if user has multiple teams)
- [ ] Add deployment history view
- [ ] Implement custom domain support

This approach matches exactly how v0 and Lovable work - users connect once, then every deployment goes straight to their Vercel account with zero friction!
<span style="display:none">[^1][^10][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://auth0.com/docs/customize/integrations/integrate-with-vercel

[^2]: https://docs.lovable.dev/integrations/github

[^3]: https://v0.app/docs/deployments

[^4]: https://vercel.com/docs/integrations/vercel-api-integrations

[^5]: https://www.youtube.com/watch?v=nZPgFHeBvJA

[^6]: https://v0.app/community/vercel-integrations-YCHvS1I39I5

[^7]: https://community.vercel.com/t/how-to-create-a-vercel-oauth-integration-for-account-authentication/7337

[^8]: https://lovable.dev/video/lovable-ai-deployment-tutorial

[^9]: https://www.datacamp.com/tutorial/vercel-v0

[^10]: https://github.com/vercel/example-integration

