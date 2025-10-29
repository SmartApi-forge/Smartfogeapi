# E2B Sandbox & Inngest Implementation Guide

## Overview

This document explains how E2B (code execution sandboxes), iframe previews, and Inngest (workflow orchestration) are integrated in SmartAPI Forge to provide live code previews and automated workflows.

## Architecture Overview

### High-Level Flow

```
User Action → Inngest Workflow → E2B Sandbox → Iframe Preview
    ↓              ↓                  ↓              ↓
  tRPC API    Background Jobs    Code Execution   Live View
```

### Key Components

1. **E2B Sandboxes**: Isolated cloud environments for running code
2. **Inngest**: Workflow orchestration for long-running tasks
3. **SandboxPreview**: React component with iframe for live preview
4. **useSandboxManager**: Hook for sandbox lifecycle management
5. **API Routes**: Keep-alive and restart endpoints

---

## E2B Sandbox Implementation

### What is E2B?

E2B provides secure, isolated cloud sandboxes for running code. Each sandbox:
- Has its own filesystem, processes, and network
- Can run dev servers (Next.js, React, Vue, etc.)
- Exposes ports via HTTPS URLs (e.g., `https://sandbox-id-3000.e2b.dev`)
- Has configurable timeouts (default: 5 minutes, extended: 1 hour)

### Sandbox Creation

**File**: `src/inngest/functions.ts` (Line 2140)

```typescript
const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
const sandbox = await Sandbox.create(templateId, {
  timeoutMs: 300000, // 5 minutes
});
```

### Repository Cloning

**File**: `src/services/github-repository-service.ts`

```typescript
async cloneToSandbox(repoUrl: string, accessToken: string, sandbox: Sandbox) {
  const authenticatedUrl = repoUrl.replace(
    'https://github.com/',
    `https://x-access-token:${accessToken}@github.com/`
  );
  
  const cloneCommand = `git clone ${authenticatedUrl} /home/user/repo`;
  const result = await sandbox.commands.run(cloneCommand, {
    timeoutMs: 120000,
  });
  
  return { success: result.exitCode === 0, path: '/home/user/repo' };
}
```

### Starting Dev Server

**File**: `src/services/github-repository-service.ts` (Line 405)

```typescript
async startPreviewServer(sandbox: Sandbox, framework: FrameworkDetection, repoPath: string) {
  const port = framework.port || 3000;
  
  // Start server in background
  const startCommand = `source /usr/local/bin/compile_fullstack.sh && start_server_background "${repoPath}" ${port} /tmp/server.log`;
  
  await sandbox.commands.run(startCommand, {
    timeoutMs: 1200000, // 20 minutes for Next.js first build
  });
  
  // Get E2B public URL
  const sandboxUrl = `https://${sandbox.getHost(port)}`;
  
  return { success: true, url: sandboxUrl, port };
}
```

---

## Iframe Preview System

### SandboxPreview Component

**File**: `components/sandbox-preview.tsx`

Main component that displays live preview in an iframe.

#### Key Features

**1. Secure Iframe**
```tsx
<iframe
  src={sandboxUrl}
  sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
  onLoad={() => setIsLoading(false)}
  onError={() => handleError()}
/>
```

**2. URL Bar (v0.app style)**
```tsx
<input
  type="text"
  value={path}
  onChange={handlePathChange}
  placeholder="/"
/>
<button onClick={handleRefresh}>
  <RefreshCw />
</button>
```

**3. Loading States**
```tsx
{isLoading && <Loader2 className="animate-spin" />}
{error && <AlertCircle />}
{sandbox.isRestarting && <div>Restoring sandbox...</div>}
```

**4. Sandbox Manager Integration**
```tsx
const sandbox = useSandboxManager({
  projectId,
  enabled: !!projectId && !!sandboxUrl,
  onSandboxRestored: (newUrl) => {
    setCurrentSandboxUrl(newUrl);
    setKey(prev => prev + 1); // Force iframe reload
  },
});
```

---

## Inngest Workflow Orchestration

### What is Inngest?

Inngest orchestrates long-running async workflows with:
- Automatic retries and error handling
- Step-by-step execution with state persistence
- Event-driven triggers
- Webhook integration

### Setup

**File**: `src/inngest/client.ts`
```typescript
export const inngest = new Inngest({ id: "Smart-forge-api" });
```

**File**: `app/api/inngest/route.ts`
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    cloneAndPreviewRepository,
    generateAPI,
    deployAPI,
    iterateAPI,
  ],
});
```

### Clone and Preview Workflow

**File**: `src/inngest/functions.ts` (Line 2079)

```typescript
export const cloneAndPreviewRepository = inngest.createFunction(
  { 
    id: "clone-and-preview-repository",
    retries: 1,
    concurrency: { limit: 5 },
  },
  { event: "github/clone-and-preview" },
  async ({ event, step }) => {
    // Workflow implementation
  }
);
```

#### Workflow Steps

**Step 1: Get GitHub Integration**
```typescript
const integration = await step.run("get-github-integration", async () => {
  return await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .single();
});
```

**Step 2: Clone Repository**
```typescript
const cloneResult = await step.run("clone-repository", async () => {
  const sandbox = await Sandbox.create(templateId);
  
  await streamingService.emit(projectId, {
    type: 'step:start',
    step: 'Cloning Repository',
  });
  
  const result = await githubRepositoryService.cloneToSandbox(
    repoUrl, integration.access_token, sandbox
  );
  
  await streamingService.emit(projectId, {
    type: 'step:complete',
    step: 'Cloning Repository',
  });
  
  return { sandboxId: sandbox.sandboxId, repoPath: result.path };
});
```

**Step 3: Detect Framework**
```typescript
const frameworkInfo = await step.run("detect-framework", async () => {
  const sandbox = await Sandbox.connect(cloneResult.sandboxId);
  return await githubRepositoryService.detectFramework(sandbox, cloneResult.repoPath);
});
```

**Step 4: Install Dependencies**
```typescript
await step.run("install-dependencies", async () => {
  const sandbox = await Sandbox.connect(cloneResult.sandboxId);
  return await githubRepositoryService.installDependencies(
    sandbox, frameworkInfo.packageManager, repoPath
  );
});
```

**Step 5: Start Preview Server**
```typescript
const previewResult = await step.run("start-preview-server", async () => {
  const sandbox = await Sandbox.connect(cloneResult.sandboxId);
  return await githubRepositoryService.startPreviewServer(
    sandbox, frameworkInfo.frameworkDetails, repoPath, true
  );
});
```

**Step 6: Update Project**
```typescript
await step.run("update-project", async () => {
  await supabase
    .from('projects')
    .update({
      status: 'deployed',
      sandbox_url: previewResult.sandboxUrl,
      framework: frameworkInfo.framework,
    })
    .eq('id', projectId);
});
```

### Triggering Workflows

**File**: `src/trpc/routers/github.ts` (Line 241)

```typescript
const { inngest } = await import('../../inngest/client');

await inngest.send({
  name: 'github/clone-and-preview',
  data: {
    projectId,
    repoUrl,
    repoFullName,
    userId,
  },
});
```

---

## Sandbox Lifecycle Management

### useSandboxManager Hook

**File**: `hooks/use-sandbox-manager.ts`

Manages sandbox lifecycle automatically with:
- Auto-check on mount
- 5-minute keep-alive heartbeat
- Auto-restart on expiration
- No page reload needed

```typescript
export function useSandboxManager({ projectId, enabled, onSandboxRestored }) {
  const keepAlive = async () => {
    const response = await fetch(`/api/sandbox/keepalive/${projectId}`, {
      method: 'POST',
    });
    const data = await response.json();
    return { success: data.success, needsRestart: data.needsRestart };
  };
  
  const restartSandbox = async () => {
    setState(prev => ({ ...prev, isRestarting: true }));
    
    const response = await fetch(`/api/sandbox/restart/${projectId}`, {
      method: 'POST',
    });
    const data = await response.json();
    
    if (data.success) {
      onSandboxRestored(data.sandboxUrl);
    }
  };
  
  useEffect(() => {
    const init = async () => {
      const status = await keepAlive();
      if (status.needsRestart) await restartSandbox();
    };
    
    init();
    const interval = setInterval(async () => {
      const status = await keepAlive();
      if (status.needsRestart) await restartSandbox();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [projectId, enabled]);
}
```

### Keep-Alive API

**File**: `app/api/sandbox/keepalive/[projectId]/route.ts`

```typescript
export async function POST(request, { params }) {
  const { projectId } = await params;
  const { data: project } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single();
  
  const sandboxId = project.metadata?.sandboxId;
  
  try {
    await Sandbox.connect(sandboxId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, needsRestart: true });
  }
}
```

### Restart API

**File**: `app/api/sandbox/restart/[projectId]/route.ts`

```typescript
export async function POST(request, { params }) {
  const { projectId } = await params;
  
  // Get project and GitHub integration
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  // Create new sandbox
  const sandbox = await Sandbox.create(templateId);
  
  // Clone, install, start server
  await githubRepositoryService.cloneToSandbox(repoUrl, accessToken, sandbox);
  await githubRepositoryService.installDependencies(sandbox, packageManager, repoPath);
  const result = await githubRepositoryService.startPreviewServer(sandbox, framework, repoPath);
  
  // Update project
  await supabase
    .from('projects')
    .update({ sandbox_url: result.url })
    .eq('id', projectId);
  
  return NextResponse.json({ success: true, sandboxUrl: result.url });
}
```

---

## Complete Flow Examples

### Example 1: User Connects GitHub Repo

```
1. User clicks "Connect Repository"
   → tRPC: github.connectRepository

2. Create project record (status: 'generating')

3. Send Inngest event: 'github/clone-and-preview'

4. Inngest workflow executes:
   - Create E2B sandbox
   - Clone repository
   - Detect framework
   - Install dependencies
   - Start dev server
   - Save sandbox_url to database

5. Frontend receives sandbox_url
   → SandboxPreview renders iframe

6. Iframe loads: https://abc123-3000.e2b.dev
   → User sees live preview!

7. useSandboxManager starts heartbeat
   → Keeps sandbox alive
```

### Example 2: Sandbox Auto-Restart

```
1. Sandbox expires after 5 minutes

2. useSandboxManager detects expiration
   → keepAlive() returns needsRestart: true

3. Hook calls restartSandbox()
   → Shows "Restoring sandbox..." UI

4. /api/sandbox/restart creates new sandbox
   → Clone, install, start server

5. Hook receives new URL
   → onSandboxRestored(newUrl)

6. SandboxPreview updates iframe
   → setCurrentSandboxUrl(newUrl)
   → Force reload with new key

7. Preview restored (no page reload!)
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `components/sandbox-preview.tsx` | Iframe preview component |
| `hooks/use-sandbox-manager.ts` | Sandbox lifecycle hook |
| `src/inngest/functions.ts` | Workflow definitions |
| `src/inngest/client.ts` | Inngest client setup |
| `app/api/inngest/route.ts` | Inngest webhook endpoint |
| `app/api/sandbox/keepalive/[projectId]/route.ts` | Keep-alive API |
| `app/api/sandbox/restart/[projectId]/route.ts` | Restart API |
| `src/services/github-repository-service.ts` | E2B operations |

---

## Environment Variables

```env
E2B_API_KEY=your_e2b_api_key
E2B_FULLSTACK_TEMPLATE_ID=ckskh5feot2y94v5z07d
INNGEST_EVENT_KEY=your_inngest_key
INNGEST_SIGNING_KEY=your_signing_key
```

---

## Summary

The implementation combines three key technologies:

1. **E2B**: Provides isolated sandboxes for running code with public HTTPS URLs
2. **Inngest**: Orchestrates long-running workflows (clone → install → start)
3. **React/Next.js**: Displays live preview in iframe with auto-restoration

The result is a seamless experience where users can preview GitHub repos instantly, with automatic sandbox management and no page reloads needed.
