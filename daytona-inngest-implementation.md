# Daytona Sandbox & Inngest Implementation Guide

## Overview

This document explains how Daytona (code execution sandboxes), iframe previews, and Inngest (workflow orchestration) are integrated in SmartAPI Forge to provide live code previews and automated workflows.

**Key Improvement over E2B:** Daytona provides up to **16GB RAM** and **4 vCPU** per sandbox (vs E2B's 1GB/2 vCPU limit), enabling complex production-ready Next.js projects with heavy dependencies.

---

## Architecture Overview

### High-Level Flow

```
User Action → Inngest Workflow → Daytona Sandbox → Iframe Preview
    ↓              ↓                  ↓                ↓
  tRPC API    Background Jobs    Code Execution    Live View
```

### Key Components

1. **Daytona Sandboxes**: Isolated cloud environments for running code with 8-16GB RAM
2. **Inngest**: Workflow orchestration for long-running tasks
3. **SandboxPreview**: React component with iframe for live preview
4. **useSandboxManager**: Hook for sandbox lifecycle management
5. **API Routes**: Keep-alive and restart endpoints

---

## Daytona Sandbox Implementation

### What is Daytona?

Daytona provides secure, isolated cloud sandboxes for running code. Each sandbox:
- Has its own filesystem, processes, and network
- Can run dev servers (Next.js, React, Vue, etc.)
- Exposes ports via HTTPS URLs (e.g., `https://3000-{sandboxId}.proxy.daytona.works`)
- **Has unlimited lifetime** (no 1-hour timeout like E2B)
- **Supports 8-16GB RAM** for complex builds
- **Auto-generates preview URLs** for any HTTP port (3000-9999)

### Resource Tiers

| Tier | vCPU | RAM | Storage | Cost |
|------|------|-----|---------|------|
| **Tier 1 (Free)** | 2 | 8 GB | 50 GB | $0 (email verified) |
| **Tier 2** | 4 | 16 GB | 50 GB | $25 one-time + usage |
| **Tier 3** | 8 | 32 GB | 50 GB | $500 top-up |

**Recommended:** Start with Tier 1 (free), upgrade to Tier 2 ($25) for production.

---

## Installation & Setup

### 1. Install Daytona SDK

```bash
npm install @daytonaio/sdk
```

### 2. Get API Key

1. Visit [app.daytona.io](https://app.daytona.io)
2. Create account and verify email
3. Generate API key from dashboard
4. Save to `.env.local`

### 3. Environment Variables

```env
# Daytona Configuration
DAYTONA_API_KEY=your_daytona_api_key_here
DAYTONA_API_URL=https://api.daytona.works
DAYTONA_TARGET=us

# Inngest Configuration
INNGEST_EVENT_KEY=your_inngest_key
INNGEST_SIGNING_KEY=your_signing_key

# Database
DATABASE_URL=your_supabase_url
```

---

## Core Implementation

### Daytona Client Setup

**File**: `src/lib/daytona-client.ts`

```typescript
import { Daytona } from '@daytonaio/sdk';

export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  apiUrl: process.env.DAYTONA_API_URL,
  target: process.env.DAYTONA_TARGET || 'us',
});

export type WorkspaceClass = 'small' | 'medium' | 'large';

export interface SandboxConfig {
  workspaceClass?: WorkspaceClass;
  image?: string;
  public?: boolean;
  envVars?: Record<string, string>;
}

export async function createDaytonaSandbox(config: SandboxConfig = {}) {
  const sandbox = await daytona.create({
    image: config.image || 'node:22-bookworm', // Debian with full tooling
    workspaceClass: config.workspaceClass || 'medium', // 4 vCPU, 16GB RAM
    public: config.public ?? true, // Public preview URLs
    envVars: config.envVars || {},
  });

  return sandbox;
}
```

---

## GitHub Repository Service (Daytona Version)

### File Structure

**File**: `src/services/github-repository-service.ts`

```typescript
import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';

export class GitHubRepositoryService {
  /**
   * Clone repository to Daytona sandbox
   */
  async cloneToSandbox(
    repoUrl: string,
    accessToken: string,
    sandbox: Sandbox
  ): Promise<{ success: boolean; path: string }> {
    try {
      // Create authenticated GitHub URL
      const authenticatedUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${accessToken}@github.com/`
      );

      // Clone repository
      const cloneCommand = `git clone ${authenticatedUrl} /workspace/project`;
      const result = await sandbox.process.exec(cloneCommand, {
        timeout: 300, // 5 minutes for large repos
      });

      if (result.exitCode !== 0) {
        throw new Error(`Clone failed: ${result.stderr}`);
      }

      return {
        success: true,
        path: '/workspace/project',
      };
    } catch (error) {
      console.error('Clone error:', error);
      throw error;
    }
  }

  /**
   * Detect framework from package.json
   */
  async detectFramework(
    sandbox: Sandbox,
    repoPath: string
  ): Promise<{
    framework: string;
    packageManager: 'npm' | 'pnpm' | 'yarn';
    port: number;
  }> {
    try {
      // Read package.json
      const readCmd = `cat ${repoPath}/package.json`;
      const result = await sandbox.process.exec(readCmd);

      if (result.exitCode !== 0) {
        throw new Error('package.json not found');
      }

      const packageJson = JSON.parse(result.stdout);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect framework
      let framework = 'node';
      let port = 3000;

      if (dependencies.next) {
        framework = 'nextjs';
        port = 3000;
      } else if (dependencies.vite) {
        framework = 'vite';
        port = 5173;
      } else if (dependencies.vue) {
        framework = 'vue';
        port = 8080;
      } else if (dependencies.express) {
        framework = 'express';
        port = 3000;
      }

      // Detect package manager
      let packageManager: 'npm' | 'pnpm' | 'yarn' = 'npm';
      
      const checkPnpm = await sandbox.process.exec(`test -f ${repoPath}/pnpm-lock.yaml && echo "yes"`);
      const checkYarn = await sandbox.process.exec(`test -f ${repoPath}/yarn.lock && echo "yes"`);

      if (checkPnpm.stdout.trim() === 'yes') {
        packageManager = 'pnpm';
      } else if (checkYarn.stdout.trim() === 'yes') {
        packageManager = 'yarn';
      }

      return { framework, packageManager, port };
    } catch (error) {
      console.error('Framework detection error:', error);
      return { framework: 'node', packageManager: 'npm', port: 3000 };
    }
  }

  /**
   * Install dependencies with increased memory allocation
   */
  async installDependencies(
    sandbox: Sandbox,
    packageManager: 'npm' | 'pnpm' | 'yarn',
    repoPath: string
  ): Promise<{ success: boolean }> {
    try {
      // Set Node.js memory limit to 12GB (within 16GB sandbox)
      const nodeOptions = 'NODE_OPTIONS="--max-old-space-size=12288"';
      
      let installCmd: string;
      switch (packageManager) {
        case 'pnpm':
          installCmd = `cd ${repoPath} && ${nodeOptions} pnpm install`;
          break;
        case 'yarn':
          installCmd = `cd ${repoPath} && ${nodeOptions} yarn install`;
          break;
        default:
          installCmd = `cd ${repoPath} && ${nodeOptions} npm install`;
      }

      const result = await sandbox.process.exec(installCmd, {
        timeout: 900, // 15 minutes for large node_modules
        cwd: repoPath,
      });

      if (result.exitCode !== 0) {
        throw new Error(`Install failed: ${result.stderr}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Install error:', error);
      throw error;
    }
  }

  /**
   * Build project (if needed)
   */
  async buildProject(
    sandbox: Sandbox,
    packageManager: 'npm' | 'pnpm' | 'yarn',
    repoPath: string
  ): Promise<{ success: boolean }> {
    try {
      // Check if build script exists
      const checkBuildScript = await sandbox.process.exec(
        `cat ${repoPath}/package.json | grep -o '"build"'`
      );

      if (checkBuildScript.exitCode !== 0) {
        // No build script, skip
        return { success: true };
      }

      // Set Node.js memory limit
      const nodeOptions = 'NODE_OPTIONS="--max-old-space-size=12288"';
      
      let buildCmd: string;
      switch (packageManager) {
        case 'pnpm':
          buildCmd = `cd ${repoPath} && ${nodeOptions} pnpm run build`;
          break;
        case 'yarn':
          buildCmd = `cd ${repoPath} && ${nodeOptions} yarn build`;
          break;
        default:
          buildCmd = `cd ${repoPath} && ${nodeOptions} npm run build`;
      }

      const result = await sandbox.process.exec(buildCmd, {
        timeout: 900, // 15 minutes for complex builds
        cwd: repoPath,
      });

      if (result.exitCode !== 0) {
        console.warn('Build warning:', result.stderr);
        // Don't fail - some projects build on dev server start
      }

      return { success: true };
    } catch (error) {
      console.error('Build error:', error);
      // Continue anyway - dev server might handle build
      return { success: true };
    }
  }

  /**
   * Start preview server and get public URL
   */
  async startPreviewServer(
    sandbox: Sandbox,
    framework: { framework: string; packageManager: string; port: number },
    repoPath: string
  ): Promise<{ success: boolean; url: string; port: number }> {
    try {
      const { packageManager, port } = framework;

      // Determine start command
      let startCmd: string;
      switch (packageManager) {
        case 'pnpm':
          startCmd = `cd ${repoPath} && pnpm run dev`;
          break;
        case 'yarn':
          startCmd = `cd ${repoPath} && yarn dev`;
          break;
        default:
          startCmd = `cd ${repoPath} && npm run dev`;
      }

      // Start server in background
      await sandbox.process.exec(startCmd, {
        background: true, // Don't wait for completion
        cwd: repoPath,
      });

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get Daytona preview URL
      const previewLink = await sandbox.getPreviewLink(port);

      return {
        success: true,
        url: previewLink.url,
        port,
      };
    } catch (error) {
      console.error('Start server error:', error);
      throw error;
    }
  }
}

export const githubRepositoryService = new GitHubRepositoryService();
```

---

## Inngest Workflow (Daytona Version)

### Clone and Preview Workflow

**File**: `src/inngest/functions.ts`

```typescript
import { inngest } from './client';
import { daytona, createDaytonaSandbox } from '@/lib/daytona-client';
import { githubRepositoryService } from '@/services/github-repository-service';
import { createClient } from '@/lib/supabase/server';

export const cloneAndPreviewRepository = inngest.createFunction(
  {
    id: 'daytona-clone-and-preview-repository',
    retries: 2,
    concurrency: {
      limit: 5, // Max 5 concurrent preview builds
    },
  },
  { event: 'github/clone-and-preview' },
  async ({ event, step }) => {
    const { projectId, repoUrl, repoFullName, userId } = event.data;
    const supabase = await createClient();

    // Step 1: Get GitHub Integration
    const integration = await step.run('get-github-integration', async () => {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'github')
        .single();

      if (error || !data) {
        throw new Error('GitHub integration not found');
      }

      return data;
    });

    // Step 2: Create Daytona Sandbox
    const sandboxResult = await step.run('create-daytona-sandbox', async () => {
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'building' })
        .eq('id', projectId);

      // Create sandbox with medium resources (4 vCPU, 16GB RAM)
      const sandbox = await createDaytonaSandbox({
        workspaceClass: 'medium',
        public: true,
      });

      return {
        sandboxId: sandbox.id,
        sandbox,
      };
    });

    // Step 3: Clone Repository
    const cloneResult = await step.run('clone-repository', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      const result = await githubRepositoryService.cloneToSandbox(
        repoUrl,
        integration.access_token,
        sandbox
      );

      return {
        success: result.success,
        repoPath: result.path,
      };
    });

    // Step 4: Detect Framework
    const frameworkInfo = await step.run('detect-framework', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      return await githubRepositoryService.detectFramework(
        sandbox,
        cloneResult.repoPath
      );
    });

    // Step 5: Install Dependencies
    await step.run('install-dependencies', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      await githubRepositoryService.installDependencies(
        sandbox,
        frameworkInfo.packageManager as 'npm' | 'pnpm' | 'yarn',
        cloneResult.repoPath
      );
    });

    // Step 6: Build Project (optional)
    await step.run('build-project', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      await githubRepositoryService.buildProject(
        sandbox,
        frameworkInfo.packageManager as 'npm' | 'pnpm' | 'yarn',
        cloneResult.repoPath
      );
    });

    // Step 7: Start Preview Server
    const previewResult = await step.run('start-preview-server', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      return await githubRepositoryService.startPreviewServer(
        sandbox,
        frameworkInfo,
        cloneResult.repoPath
      );
    });

    // Step 8: Update Project with Preview URL
    await step.run('update-project', async () => {
      await supabase
        .from('projects')
        .update({
          status: 'deployed',
          sandbox_url: previewResult.url,
          framework: frameworkInfo.framework,
          metadata: {
            sandboxId: sandboxResult.sandboxId,
            port: previewResult.port,
            packageManager: frameworkInfo.packageManager,
          },
        })
        .eq('id', projectId);
    });

    return {
      success: true,
      sandboxId: sandboxResult.sandboxId,
      previewUrl: previewResult.url,
      framework: frameworkInfo.framework,
    };
  }
);
```

---

## Frontend Components

### SandboxPreview Component

**File**: `components/sandbox-preview.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useSandboxManager } from '@/hooks/use-sandbox-manager';

interface SandboxPreviewProps {
  projectId: string;
  sandboxUrl: string;
  onError?: () => void;
}

export function SandboxPreview({
  projectId,
  sandboxUrl,
  onError,
}: SandboxPreviewProps) {
  const [currentUrl, setCurrentUrl] = useState(sandboxUrl);
  const [path, setPath] = useState('/');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

  // Manage sandbox lifecycle
  const sandbox = useSandboxManager({
    projectId,
    enabled: !!projectId && !!sandboxUrl,
    onSandboxRestored: (newUrl) => {
      setCurrentUrl(newUrl);
      setKey(prev => prev + 1); // Force iframe reload
      setIsLoading(true);
      setError(false);
    },
  });

  const handleRefresh = () => {
    setKey(prev => prev + 1);
    setIsLoading(true);
    setError(false);
  };

  const handlePathChange = (newPath: string) => {
    setPath(newPath);
    setKey(prev => prev + 1);
    setIsLoading(true);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError(true);
    onError?.();
  };

  const fullUrl = currentUrl + (path !== '/' ? path : '');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header with URL bar */}
      <div className="flex items-center gap-2 p-3 bg-white border-b">
        <button
          onClick={handleRefresh}
          disabled={isLoading || sandbox.isRestarting}
          className="p-2 hover:bg-gray-100 rounded-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePathChange(path)}
            placeholder="/"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Loading/Error States */}
      {sandbox.isRestarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-gray-600">Restoring sandbox...</p>
          </div>
        </div>
      )}

      {isLoading && !sandbox.isRestarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && !sandbox.isRestarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-gray-900 font-medium mb-2">Failed to load preview</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Preview Iframe */}
      <iframe
        key={key}
        src={fullUrl}
        className="flex-1 w-full border-0"
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="Live Preview"
      />
    </div>
  );
}
```

---

## Sandbox Lifecycle Management

### useSandboxManager Hook

**File**: `hooks/use-sandbox-manager.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseSandboxManagerOptions {
  projectId: string;
  enabled: boolean;
  onSandboxRestored?: (newUrl: string) => void;
}

interface SandboxState {
  isAlive: boolean;
  isRestarting: boolean;
  lastCheck: number | null;
}

export function useSandboxManager({
  projectId,
  enabled,
  onSandboxRestored,
}: UseSandboxManagerOptions) {
  const [state, setState] = useState<SandboxState>({
    isAlive: true,
    isRestarting: false,
    lastCheck: null,
  });

  // Check if sandbox is still alive
  const checkSandboxHealth = useCallback(async () => {
    try {
      const response = await fetch(`/api/sandbox/health/${projectId}`);
      const data = await response.json();

      setState(prev => ({
        ...prev,
        isAlive: data.isAlive,
        lastCheck: Date.now(),
      }));

      return data.isAlive;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }, [projectId]);

  // Restart sandbox if needed
  const restartSandbox = useCallback(async () => {
    setState(prev => ({ ...prev, isRestarting: true }));

    try {
      const response = await fetch(`/api/sandbox/restart/${projectId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.sandboxUrl) {
        onSandboxRestored?.(data.sandboxUrl);
      }

      setState(prev => ({
        ...prev,
        isRestarting: false,
        isAlive: true,
      }));
    } catch (error) {
      console.error('Restart failed:', error);
      setState(prev => ({ ...prev, isRestarting: false }));
    }
  }, [projectId, onSandboxRestored]);

  useEffect(() => {
    if (!enabled) return;

    // Initial health check
    checkSandboxHealth().then(isAlive => {
      if (!isAlive) {
        restartSandbox();
      }
    });

    // Periodic health checks every 5 minutes
    const interval = setInterval(async () => {
      const isAlive = await checkSandboxHealth();
      if (!isAlive) {
        await restartSandbox();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, checkSandboxHealth, restartSandbox]);

  return state;
}
```

---

## API Routes

### Health Check API

**File**: `app/api/sandbox/health/[projectId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { daytona } from '@/lib/daytona-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    // Get project metadata
    const { data: project } = await supabase
      .from('projects')
      .select('metadata')
      .eq('id', projectId)
      .single();

    if (!project?.metadata?.sandboxId) {
      return NextResponse.json({ isAlive: false });
    }

    // Check if sandbox exists
    try {
      const sandbox = await daytona.getSandbox(project.metadata.sandboxId);
      // Sandbox exists and is accessible
      return NextResponse.json({ isAlive: true });
    } catch {
      // Sandbox not found or expired
      return NextResponse.json({ isAlive: false });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ isAlive: false }, { status: 500 });
  }
}
```

### Restart API

**File**: `app/api/sandbox/restart/[projectId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDaytonaSandbox } from '@/lib/daytona-client';
import { githubRepositoryService } from '@/services/github-repository-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*, user_integrations!inner(*)')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create new sandbox
    const sandbox = await createDaytonaSandbox({
      workspaceClass: 'medium',
      public: true,
    });

    const repoPath = '/workspace/project';

    // Clone repository
    await githubRepositoryService.cloneToSandbox(
      project.metadata.repoUrl,
      project.user_integrations.access_token,
      sandbox
    );

    // Detect framework
    const framework = await githubRepositoryService.detectFramework(
      sandbox,
      repoPath
    );

    // Install dependencies
    await githubRepositoryService.installDependencies(
      sandbox,
      framework.packageManager as 'npm' | 'pnpm' | 'yarn',
      repoPath
    );

    // Start preview server
    const result = await githubRepositoryService.startPreviewServer(
      sandbox,
      framework,
      repoPath
    );

    // Update project
    await supabase
      .from('projects')
      .update({
        sandbox_url: result.url,
        metadata: {
          ...project.metadata,
          sandboxId: sandbox.id,
          port: result.port,
        },
      })
      .eq('id', projectId);

    return NextResponse.json({
      success: true,
      sandboxUrl: result.url,
      sandboxId: sandbox.id,
    });
  } catch (error) {
    console.error('Restart error:', error);
    return NextResponse.json(
      { error: 'Failed to restart sandbox' },
      { status: 500 }
    );
  }
}
```

---

## Key Differences: E2B vs Daytona

| Feature | E2B (Hobby) | Daytona (Tier 1 Free) | Daytona (Tier 2) |
|---------|-------------|----------------------|------------------|
| **vCPU** | 2 | 2 | 4 |
| **RAM** | 1 GB | **8 GB** | **16 GB** |
| **Storage** | Limited | 50 GB | 50 GB |
| **Max Lifetime** | 1 hour | **Unlimited** | **Unlimited** |
| **Preview URLs** | Manual | **Auto-generated** | **Auto-generated** |
| **Cost** | $0 | $0 | $25 one-time + usage |
| **Large Projects** | ❌ Fails | ⚠️ Works (small) | ✅ Works smoothly |

---

## Migration Checklist

### 1. Replace Dependencies
```bash
# Remove E2B
npm uninstall @e2b/code-interpreter

# Install Daytona
npm install @daytonaio/sdk
```

### 2. Update Environment Variables
```env
# Remove
E2B_API_KEY=...
E2B_FULLSTACK_TEMPLATE_ID=...

# Add
DAYTONA_API_KEY=...
DAYTONA_API_URL=https://api.daytona.works
DAYTONA_TARGET=us
```

### 3. Replace Imports
```typescript
// Old (E2B)
import { Sandbox } from '@e2b/code-interpreter';

// New (Daytona)
import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';
```

### 4. Update Sandbox Creation
```typescript
// Old (E2B)
const sandbox = await Sandbox.create(templateId, {
  timeoutMs: 300000,
});

// New (Daytona)
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  workspaceClass: 'medium', // 4 vCPU, 16GB RAM
  public: true,
});
```

### 5. Update Command Execution
```typescript
// Old (E2B)
const result = await sandbox.commands.run(command, {
  timeoutMs: 120000,
});

// New (Daytona)
const result = await sandbox.process.exec(command, {
  timeout: 120, // seconds
  cwd: '/workspace/project',
});
```

### 6. Update Preview URL
```typescript
// Old (E2B)
const url = `https://${sandbox.getHost(port)}`;

// New (Daytona)
const previewLink = await sandbox.getPreviewLink(port);
const url = previewLink.url;
```

---

## Complete Flow Example

### User Connects GitHub Repo

```
1. User clicks "Connect Repository"
   → tRPC: github.connectRepository

2. Create project record (status: 'generating')

3. Send Inngest event: 'github/clone-and-preview'

4. Inngest workflow executes:
   - Create Daytona sandbox (4 vCPU, 16GB RAM)
   - Clone repository (with Git auth)
   - Detect framework (Next.js, Vite, etc.)
   - Install dependencies (with 12GB Node memory)
   - Build project (if needed)
   - Start dev server (background process)
   - Get preview URL (auto-generated)
   - Save sandbox_url to database

5. Frontend receives sandbox_url
   → SandboxPreview renders iframe

6. Iframe loads: https://3000-abc123xyz.proxy.daytona.works
   → User sees live preview!

7. useSandboxManager starts health checks
   → Monitors sandbox status every 5 minutes
   → Auto-restarts if needed
```

---

## Performance Optimizations

### 1. Parallel Steps
```typescript
// Run install and build in parallel (if safe)
const [installResult, buildResult] = await Promise.all([
  step.run('install-deps', () => install()),
  step.run('build-assets', () => buildAssets()),
]);
```

### 2. Caching Strategy
```typescript
// Check for cached node_modules
const cacheKey = `${repoUrl}-${gitCommitSha}`;
const cached = await checkCache(cacheKey);

if (cached) {
  await sandbox.filesystem.copy(cached, '/workspace/project/node_modules');
} else {
  await install();
  await saveCache(cacheKey, '/workspace/project/node_modules');
}
```

### 3. Progressive Build
```typescript
// Start preview before full build completes
await step.run('start-dev-server', async () => {
  // Start dev server (handles incremental builds)
  await startDevServer();
});

// Build in background after preview is live
await step.run('full-build', async () => {
  await buildProduction();
});
```

---

## Troubleshooting

### Problem: Sandbox creation fails
**Solution:** Check API key and tier limits
```typescript
try {
  const sandbox = await daytona.create({ workspaceClass: 'medium' });
} catch (error) {
  if (error.message.includes('quota')) {
    console.error('Tier limit reached. Upgrade to Tier 2.');
  }
}
```

### Problem: Install fails with out of memory
**Solution:** Increase Node memory limit
```typescript
const installCmd = `NODE_OPTIONS="--max-old-space-size=14336" npm install`;
// 14GB limit within 16GB sandbox
```

### Problem: Preview URL not loading
**Solution:** Check port and wait for server
```typescript
// Wait longer for complex Next.js builds
await new Promise(resolve => setTimeout(resolve, 20000));

// Check if port is listening
const check = await sandbox.process.exec(`lsof -ti:3000`);
if (check.exitCode !== 0) {
  throw new Error('Dev server not started');
}
```

---

## Summary

Daytona provides a **superior alternative to E2B** for complex fullstack projects:

✅ **8-16GB RAM** (vs 1GB) - handles large node_modules  
✅ **Unlimited lifetime** (vs 1 hour) - no forced timeouts  
✅ **Auto preview URLs** - instant public links  
✅ **Free tier available** - test before paying  
✅ **Same Inngest patterns** - drop-in replacement  
✅ **Better isolation** - microVM-based sandboxes  

**Start with Tier 1 (free), upgrade to Tier 2 ($25) when ready for production.**
