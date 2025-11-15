# Complete Daytona Implementation Guide for SmartAPI Forge

> **Purpose**: This guide consolidates all Daytona documentation needed to replace E2B with Daytona in your application. It covers SDK setup, sandbox management, file operations, process execution, Git operations, and preview URLs.

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Installation & Configuration](#installation--configuration)
3. [Sandbox Management](#sandbox-management)
4. [File System Operations](#file-system-operations)
5. [Git Operations](#git-operations)
6. [Process & Code Execution](#process--code-execution)
7. [Preview URLs & Authentication](#preview-urls--authentication)
8. [Resource Management & Limits](#resource-management--limits)
9. [Error Handling & Best Practices](#error-handling--best-practices)
10. [Complete Integration Examples](#complete-integration-examples)

---

## Overview & Architecture

### What is Daytona?

Daytona provides secure, isolated cloud sandboxes for running code. Each sandbox is a microVM-based environment with:

- **Isolated filesystem, processes, and network**
- **Customizable resources** (2-8 vCPU, 8-32GB RAM)
- **Persistent storage** (50GB+ depending on tier)
- **Unlimited lifetime** (no forced 1-hour timeout like E2B)
- **Auto-generated preview URLs** for ports 3000-9999
- **Full Linux environment** with all standard tools

### Key Advantages Over E2B

| Feature | E2B | Daytona |
|---------|-----|---------|
| RAM | 1 GB | 8-32 GB |
| Lifetime | 1 hour max | Unlimited |
| Preview URLs | Manual | Auto-generated |
| Large Projects | ❌ Fails | ✅ Works smoothly |

### Architecture for Your Application

```
User Action → tRPC API → Inngest Workflow → Daytona Sandbox
                              ↓
                    1. Create Sandbox
                    2. Clone GitHub Repo (Git Operations)
                    3. Install Dependencies (Process Execution)
                    4. Build Project (Process Execution)
                    5. Start Dev Server (Background Process)
                    6. Get Preview URL (Preview API)
                    7. Store URL in Database
                              ↓
Frontend SandboxPreview Component → Iframe with Live Preview
```

---

## Installation & Configuration

### 1. Install SDK

```bash
npm install @daytonaio/sdk
```

### 2. Get API Key

1. Visit [app.daytona.io](https://app.daytona.io)
2. Sign up and verify email (gets you Tier 1 - Free)
3. Go to Dashboard → API Keys → Create new key
4. Copy the key

### 3. Environment Variables

Add to `.env.local`:

```env
# Daytona Configuration
DAYTONA_API_KEY=your_api_key_here
DAYTONA_API_URL=https://api.daytona.works
DAYTONA_TARGET=us

# Optional: Specify default workspace class
DAYTONA_DEFAULT_WORKSPACE_CLASS=medium
```

### 4. Initialize Client

Create `src/lib/daytona-client.ts`:

```typescript
import { Daytona } from '@daytonaio/sdk';

// Initialize client
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  apiUrl: process.env.DAYTONA_API_URL,
  target: process.env.DAYTONA_TARGET || 'us',
});

// Workspace classes define resources
export type WorkspaceClass = 'small' | 'medium' | 'large';

// Configuration interface
export interface SandboxConfig {
  workspaceClass?: WorkspaceClass;
  image?: string;
  public?: boolean;
  envVars?: Record<string, string>;
  volumes?: VolumeMount[];
}

// Helper function to create sandbox with defaults
export async function createDaytonaSandbox(config: SandboxConfig = {}) {
  const sandbox = await daytona.create({
    // Base image (Debian with Node.js 22 and full tooling)
    image: config.image || 'node:22-bookworm',
    
    // Resource allocation
    workspaceClass: config.workspaceClass || 'medium', // 4 vCPU, 16GB RAM
    
    // Public preview URLs (true = publicly accessible)
    public: config.public ?? true,
    
    // Environment variables for the sandbox
    envVars: config.envVars || {},
    
    // Optional: Mount volumes for shared data
    volumes: config.volumes || [],
  });

  return sandbox;
}
```

### Multiple Runtime Support (Vite/Next.js)

**Note**: If using Daytona SDK in browser context (Vite/Next.js client components), configure webpack/vite to handle Node.js modules:

#### For Vite Projects

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer',
    },
  },
  define: {
    'process.env': {},
  },
});
```

#### For Next.js Projects

```typescript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
};
```

**Best Practice**: Use Daytona SDK **only in server-side code** (API routes, server actions, server components) to avoid these issues.

---

## Sandbox Management

### Creating Sandboxes

```typescript
import { daytona, createDaytonaSandbox } from '@/lib/daytona-client';

// Basic creation
const sandbox = await createDaytonaSandbox();

// With custom configuration
const sandbox = await createDaytonaSandbox({
  workspaceClass: 'large', // 8 vCPU, 32GB RAM
  image: 'node:22-bookworm',
  public: true,
  envVars: {
    NODE_ENV: 'development',
    NEXT_PUBLIC_API_URL: 'https://api.example.com',
  },
});

// Access sandbox properties
console.log(sandbox.id); // Unique sandbox ID
console.log(sandbox.createdAt); // Timestamp
```

### Getting Existing Sandbox

```typescript
// Get sandbox by ID
const sandbox = await daytona.getSandbox('sandbox-id-here');

// Check if sandbox exists
try {
  const sandbox = await daytona.getSandbox(sandboxId);
  console.log('Sandbox exists and is running');
} catch (error) {
  console.log('Sandbox not found or stopped');
}
```

### Sandbox States

Sandboxes can be in different states affecting resource usage:

| State | vCPU | Memory | Storage | Description |
|-------|------|--------|---------|-------------|
| **Running** | ✅ | ✅ | ✅ | Fully active, counts against all limits |
| **Stopped** | ❌ | ❌ | ✅ | Paused, frees CPU & memory but storage still used |
| **Archived** | ❌ | ❌ | ❌ | Moved to cold storage, no quota impact |
| **Deleted** | ❌ | ❌ | ❌ | Permanently removed, all resources freed |

### Managing Sandbox Lifecycle

```typescript
// Stop sandbox (frees CPU and memory)
await sandbox.stop();

// Start stopped sandbox
await sandbox.start();

// Delete sandbox permanently
await sandbox.delete();

// Archive sandbox (moves to cold storage)
await sandbox.archive();

// List all sandboxes
const sandboxes = await daytona.listSandboxes();
for (const sb of sandboxes) {
  console.log(`${sb.id} - ${sb.state}`);
}
```

### Working Directory

All operations default to the sandbox's working directory:
- Uses `WORKDIR` from Dockerfile if specified
- Falls back to `/home/daytona` (user home directory)
- Example: `workspace/repo` resolves to `/home/daytona/workspace/repo`
- Use absolute paths (starting with `/`) to override this

---

## File System Operations

The `sandbox.fs` module provides comprehensive file operations.

### Listing Files

```typescript
// List files in directory
const files = await sandbox.fs.listFiles('workspace');

for (const file of files) {
  console.log(`Name: ${file.name}`);
  console.log(`Is directory: ${file.isDir}`);
  console.log(`Size: ${file.size} bytes`);
  console.log(`Modified: ${file.modTime}`);
}

// List with absolute path
const rootFiles = await sandbox.fs.listFiles('/workspace/project');
```

### Creating Directories

```typescript
// Create directory with permissions
await sandbox.fs.createFolder('workspace/new-dir', '755');

// Create nested directories
await sandbox.fs.createFolder('workspace/src/components', '755');

// Create with full permissions
await sandbox.fs.createFolder('workspace/data', '777');
```

### Reading Files

```typescript
// Read text file
const content = await sandbox.fs.readFile('workspace/package.json');
console.log(content.toString('utf-8'));

// Read binary file
const imageData = await sandbox.fs.readFile('workspace/logo.png');

// Read file from absolute path
const config = await sandbox.fs.readFile('/etc/nginx/nginx.conf');
```

### Writing Files

```typescript
// Write text file
const content = Buffer.from('Hello, World!', 'utf-8');
await sandbox.fs.uploadFile(content, 'workspace/hello.txt');

// Write JSON file
const packageJson = JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2);
await sandbox.fs.uploadFile(Buffer.from(packageJson), 'workspace/package.json');

// Write binary file
const imageBuffer = Buffer.from(imageData);
await sandbox.fs.uploadFile(imageBuffer, 'workspace/image.png');
```

### Uploading Files

```typescript
// Upload single file
const fileContent = Buffer.from('console.log("Hello");');
await sandbox.fs.uploadFile(fileContent, 'workspace/index.js');

// Upload multiple files (efficient batch upload)
const files = [
  {
    content: Buffer.from('<!DOCTYPE html>...'),
    path: 'workspace/index.html',
  },
  {
    content: Buffer.from('body { margin: 0; }'),
    path: 'workspace/styles.css',
  },
  {
    content: Buffer.from('console.log("App");'),
    path: 'workspace/app.js',
  },
];

await sandbox.fs.uploadFiles(files);
```

### Downloading Files

```typescript
// Download single file
const content = await sandbox.fs.downloadFile('workspace/output.json');
console.log(content.toString('utf-8'));

// Download multiple files
const files = await sandbox.fs.downloadFiles([
  'workspace/dist/bundle.js',
  'workspace/dist/styles.css',
  'workspace/dist/index.html',
]);

for (const file of files) {
  console.log(`File: ${file.path}`);
  console.log(`Content: ${file.content.toString()}`);
}
```

### Deleting Files

```typescript
// Delete single file
await sandbox.fs.deleteFile('workspace/temp.txt');

// Delete directory (recursive)
await sandbox.fs.deleteFile('workspace/node_modules');

// Delete multiple files
await sandbox.fs.deleteFiles([
  'workspace/temp1.txt',
  'workspace/temp2.txt',
  'workspace/cache',
]);
```

### File Permissions

```typescript
// Change file permissions
await sandbox.fs.chmod('workspace/script.sh', '755'); // rwxr-xr-x

// Change directory permissions
await sandbox.fs.chmod('workspace/secrets', '700'); // rwx------
```

### Search and Replace

```typescript
// Search for pattern in files
const results = await sandbox.fs.searchFiles('workspace', 'TODO');

for (const result of results) {
  console.log(`File: ${result.file}`);
  console.log(`Line: ${result.line}`);
  console.log(`Content: ${result.content}`);
}

// Replace content in file
await sandbox.fs.replaceInFile(
  'workspace/config.js',
  'localhost:3000',
  'api.production.com'
);
```

---

## Git Operations

The `sandbox.git` module provides full Git functionality.

### Cloning Repositories

```typescript
// Basic clone (public repo)
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo'
);

// Clone with authentication (private repo)
await sandbox.git.clone(
  'https://github.com/user/private-repo.git',
  'workspace/repo',
  undefined, // branch (optional)
  undefined, // depth (optional)
  'git', // username
  'ghp_your_personal_access_token_here' // password/token
);

// Clone specific branch
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo',
  'develop' // branch name
);

// Shallow clone (faster, only recent commits)
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo',
  'main',
  1 // depth = 1 (only latest commit)
);
```

### Repository Status

```typescript
// Get repository status
const status = await sandbox.git.status('workspace/repo');

console.log(`Current branch: ${status.currentBranch}`);
console.log(`Commits ahead: ${status.ahead}`);
console.log(`Commits behind: ${status.behind}`);

// Check modified files
for (const file of status.fileStatus) {
  console.log(`File: ${file.name}`);
  console.log(`Status: ${file.status}`); // modified, added, deleted, etc.
}

// Check if repo is clean
const isClean = status.fileStatus.length === 0;
```

### Branch Operations

```typescript
// List all branches
const response = await sandbox.git.branches('workspace/repo');
for (const branch of response.branches) {
  console.log(`Branch: ${branch}`);
}

// Create new branch
await sandbox.git.createBranch('workspace/repo', 'feature/new-feature');

// Switch to branch
await sandbox.git.checkoutBranch('workspace/repo', 'feature/new-feature');

// Create and switch to branch (one step)
await sandbox.git.createBranch('workspace/repo', 'feature/another');
await sandbox.git.checkoutBranch('workspace/repo', 'feature/another');

// Delete branch
await sandbox.git.deleteBranch('workspace/repo', 'feature/old-feature');
```

### Staging and Committing

```typescript
// Stage specific files
await sandbox.git.add('workspace/repo', ['src/index.js', 'README.md']);

// Stage all changes
await sandbox.git.add('workspace/repo', ['.']);

// Commit changes
await sandbox.git.commit(
  'workspace/repo',
  'feat: add new feature',
  {
    name: 'Your Name',
    email: 'you@example.com',
  }
);

// Amend last commit
await sandbox.git.commitAmend(
  'workspace/repo',
  'feat: add new feature (updated)',
  {
    name: 'Your Name',
    email: 'you@example.com',
  }
);
```

### Remote Operations

```typescript
// Add remote
await sandbox.git.addRemote(
  'workspace/repo',
  'origin',
  'https://github.com/user/repo.git'
);

// List remotes
const remotes = await sandbox.git.listRemotes('workspace/repo');
for (const remote of remotes) {
  console.log(`${remote.name}: ${remote.url}`);
}

// Fetch from remote
await sandbox.git.fetch('workspace/repo', 'origin');

// Pull changes
await sandbox.git.pull(
  'workspace/repo',
  'origin',
  'main',
  'git', // username
  'token' // password/token
);

// Push changes
await sandbox.git.push(
  'workspace/repo',
  'origin',
  'main',
  'git', // username
  'token' // password/token
);
```

### Example: Complete GitHub Clone Flow

```typescript
async function cloneGitHubRepo(
  sandbox: Sandbox,
  repoUrl: string,
  accessToken: string
): Promise<string> {
  // Create authenticated URL
  const authenticatedUrl = repoUrl.replace(
    'https://github.com/',
    `https://x-access-token:${accessToken}@github.com/`
  );

  // Clone repository
  await sandbox.git.clone(authenticatedUrl, 'workspace/project');

  return '/workspace/project';
}
```

---

## Process & Code Execution

The `sandbox.process` module handles command execution and code running.

### Running Commands

```typescript
// Basic command execution
const result = await sandbox.process.executeCommand('ls -la');
console.log(result.result); // stdout
console.log(result.exitCode); // 0 for success

// Command with working directory
const result = await sandbox.process.executeCommand(
  'npm install',
  'workspace/project' // working directory
);

// Command with timeout (in seconds)
const result = await sandbox.process.executeCommand(
  'sleep 10',
  '.',
  undefined, // env vars
  5 // timeout = 5 seconds (will fail)
);

// Command with environment variables
const result = await sandbox.process.executeCommand(
  'echo $CUSTOM_VAR',
  '.',
  { CUSTOM_VAR: 'Hello from Daytona' }
);
```

### Alternative: exec Method

```typescript
// Using exec (same as executeCommand but different signature)
const result = await sandbox.process.exec('ls -la', {
  cwd: 'workspace/project',
  timeout: 30,
  env: { NODE_ENV: 'production' },
});

console.log(result.stdout); // standard output
console.log(result.stderr); // standard error
console.log(result.exitCode); // exit code
```

### Running Code Snippets

```typescript
// Run TypeScript/JavaScript code
const result = await sandbox.process.codeRun(`
  function greet(name: string): string {
    return \`Hello, \${name}!\`;
  }
  console.log(greet("Daytona"));
`);
console.log(result.result); // "Hello, Daytona!"

// Run with arguments (process.argv)
const result = await sandbox.process.codeRun(
  `console.log(\`Hello, \${process.argv[2]}!\`)`,
  {
    argv: ['Daytona'], // process.argv[2] = 'Daytona'
  }
);

// Run with environment variables
const result = await sandbox.process.codeRun(
  `console.log(\`FOO: \${process.env.FOO}\`)`,
  {
    env: { FOO: 'BAR' },
  }
);

// Run with timeout (milliseconds)
const result = await sandbox.process.codeRun(
  'setTimeout(() => console.log("Done"), 2000);',
  undefined,
  5000 // 5 second timeout
);
```

### Background Processes (Sessions)

For long-running processes (dev servers, background jobs), use sessions:

```typescript
// Create session
const sessionId = 'dev-server-session';
await sandbox.process.createSession(sessionId);

// Execute command in background
const command = await sandbox.process.executeSessionCommand(
  sessionId,
  {
    command: 'npm run dev',
    runAsync: true, // Don't wait for completion
  }
);

console.log(`Command ID: ${command.cmdId}`);

// Check command status later
const status = await sandbox.process.getSessionCommandStatus(
  sessionId,
  command.cmdId
);

console.log(`Exit code: ${status.exitCode}`);
console.log(`Is running: ${status.isRunning}`);

// Get command logs
const logs = await sandbox.process.getSessionCommandLogs(
  sessionId,
  command.cmdId
);

console.log(`Stdout: ${logs.stdout}`);
console.log(`Stderr: ${logs.stderr}`);

// Stop command
await sandbox.process.killSessionCommand(sessionId, command.cmdId);

// Clean up session
await sandbox.process.deleteSession(sessionId);
```

### Streaming Logs (Real-time)

```typescript
// Stream logs with callbacks
await sandbox.process.getSessionCommandLogs(
  sessionId,
  command.cmdId,
  (stdout) => console.log(`[STDOUT]: ${stdout}`),
  (stderr) => console.log(`[STDERR]: ${stderr}`)
);
```

### Example: Install Dependencies with Progress

```typescript
async function installDependencies(
  sandbox: Sandbox,
  projectPath: string
): Promise<void> {
  // Set Node.js memory limit (12GB within 16GB sandbox)
  const env = {
    NODE_OPTIONS: '--max-old-space-size=12288',
  };

  // Run npm install with timeout
  const result = await sandbox.process.executeCommand(
    'npm install',
    projectPath,
    env,
    900 // 15 minutes timeout
  );

  if (result.exitCode !== 0) {
    throw new Error(`Install failed: ${result.result}`);
  }

  console.log('Dependencies installed successfully');
}
```

### Example: Start Dev Server in Background

```typescript
async function startDevServer(
  sandbox: Sandbox,
  projectPath: string,
  port: number
): Promise<string> {
  // Create session for dev server
  const sessionId = `dev-server-${Date.now()}`;
  await sandbox.process.createSession(sessionId);

  // Start server in background
  await sandbox.process.executeSessionCommand(sessionId, {
    command: 'npm run dev',
    runAsync: true,
    cwd: projectPath,
  });

  // Wait for server to start (10 seconds)
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Verify server is running
  const checkResult = await sandbox.process.executeCommand(
    `curl -f http://localhost:${port} || echo "NOT_RUNNING"`
  );

  if (checkResult.result.includes('NOT_RUNNING')) {
    throw new Error('Dev server failed to start');
  }

  // Get preview URL
  const previewInfo = await sandbox.getPreviewUrl(port);
  return previewInfo.url;
}
```

---

## Preview URLs & Authentication

Daytona auto-generates preview URLs for any HTTP server running on ports 3000-9999.

### Getting Preview URL

```typescript
// Get preview URL for specific port
const previewInfo = await sandbox.getPreviewUrl(3000);

console.log(`Preview URL: ${previewInfo.url}`);
console.log(`Auth token: ${previewInfo.token}`);

// Example URL format: https://3000-sandbox123.proxy.daytona.works
```

### Public vs Private Previews

```typescript
// Public preview (anyone can access)
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  public: true, // ← Public preview URLs
});

// Private preview (only org members can access)
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  public: false, // ← Private preview URLs
});
```

### Accessing Private Previews Programmatically

```typescript
// For private previews, use the auth token
const previewInfo = await sandbox.getPreviewUrl(3000);

// Make authenticated request
const response = await fetch(previewInfo.url, {
  headers: {
    'x-daytona-preview-token': previewInfo.token,
  },
});

// cURL example
// curl -H "x-daytona-preview-token: ${token}" ${url}
```

### Warning Page (First Visit)

When opening a preview URL in a browser for the first time, Daytona shows a security warning page. To skip it:

**Option 1**: Send header
```typescript
const response = await fetch(previewUrl, {
  headers: {
    'X-Daytona-Skip-Preview-Warning': 'true',
  },
});
```

**Option 2**: Upgrade to Tier 3 (removes warning automatically)

### Custom Domains (Optional)

You can serve previews under your own domain instead of `proxy.daytona.works`:

1. Go to Dashboard → Settings → Custom Domain
2. Add your domain (e.g., `preview.myapp.com`)
3. Configure DNS CNAME record
4. Enable SSL certificate
5. Preview URLs will use your domain: `https://3000-sandbox123.preview.myapp.com`

### Example: Complete Preview Flow

```typescript
async function getProjectPreview(
  sandbox: Sandbox,
  port: number
): Promise<{ url: string; token: string }> {
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Get preview info
  const previewInfo = await sandbox.getPreviewUrl(port);

  // Verify preview is accessible
  const response = await fetch(previewInfo.url, {
    headers: {
      'x-daytona-preview-token': previewInfo.token,
      'X-Daytona-Skip-Preview-Warning': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`Preview not accessible: ${response.status}`);
  }

  return {
    url: previewInfo.url,
    token: previewInfo.token,
  };
}
```

---

## Resource Management & Limits

### Tier System

Organizations are assigned to tiers based on verification status:

| Tier | vCPU | RAM | Storage | Requirements |
|------|------|-----|---------|--------------|
| **Tier 1** | 10 total | 10 GiB | 30 GiB | Email verified |
| **Tier 2** | 100 total | 200 GiB | 300 GiB | Credit card linked, $25 top-up, GitHub connected |
| **Tier 3** | 250 total | 500 GiB | 2000 GiB | Business email, phone verified, $500 top-up |
| **Tier 4** | 500 total | 1000 GiB | 5000 GiB | $2000 top-up every 30 days |
| **Custom** | Custom | Custom | Custom | Contact support@daytona.io |

**Important**: These are **organization-wide pools**. Resources are shared across all running sandboxes.

### Workspace Classes

Individual sandboxes use resources from the pool:

| Class | vCPU per Sandbox | RAM per Sandbox | Use Case |
|-------|------------------|-----------------|----------|
| `small` | 2 | 8 GB | Simple apps, testing |
| `medium` | 4 | 16 GB | **Recommended for your app** (Next.js, large node_modules) |
| `large` | 8 | 32 GB | Complex builds, monorepos |

```typescript
// Specify workspace class when creating sandbox
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  workspaceClass: 'medium', // 4 vCPU, 16GB RAM
});
```

### Checking Current Usage

Check your usage in the [Dashboard](https://app.daytona.io):
- **vCPU**: Total CPU cores used across all running sandboxes
- **Memory**: Total RAM used across all running sandboxes
- **Storage**: Total disk space used (running + stopped sandboxes)

### Managing Resource Usage

```typescript
// Stop sandbox to free CPU and memory (storage still counted)
await sandbox.stop();

// Resume stopped sandbox
await sandbox.start();

// Archive sandbox to free all resources (moved to cold storage)
await sandbox.archive();

// Delete sandbox permanently
await sandbox.delete();
```

### Best Practices for Resource Management

1. **Clean up after use**
   ```typescript
   try {
     // Use sandbox
     await doWork(sandbox);
   } finally {
     // Always clean up
     await sandbox.delete();
   }
   ```

2. **Stop sandboxes when not in use**
   ```typescript
   // Stop inactive sandboxes after 1 hour
   if (lastUsed > Date.now() - 3600000) {
     await sandbox.stop();
   }
   ```

3. **Monitor storage usage**
   ```typescript
   // Check disk usage
   const result = await sandbox.process.executeCommand('df -h /workspace');
   console.log(result.result);
   ```

4. **Use appropriate workspace class**
   ```typescript
   // Don't use 'large' if 'medium' is sufficient
   const sandbox = await daytona.create({
     workspaceClass: 'medium', // Not 'large' unless needed
   });
   ```

### Upgrading Tiers

To unlock higher limits:

1. **Tier 1 → Tier 2**:
   - Link credit card
   - Add $25 top-up
   - Connect GitHub account
   - Click "Upgrade" in Dashboard

2. **Tier 2 → Tier 3**:
   - Verify business email
   - Verify phone number
   - Add $500 top-up
   - Click "Upgrade" in Dashboard

**Recommendation for your app**: Start with Tier 1 (free) for development. Upgrade to Tier 2 ($25) for production.

---

## Error Handling & Best Practices

### Common Errors

#### 1. Quota Exceeded

```typescript
try {
  const sandbox = await daytona.create({ workspaceClass: 'medium' });
} catch (error) {
  if (error.message.includes('quota') || error.message.includes('limit')) {
    console.error('Tier limit reached. Options:');
    console.error('1. Stop/delete existing sandboxes');
    console.error('2. Upgrade to higher tier');
    console.error('3. Use smaller workspace class');
  }
}
```

#### 2. Out of Memory During Install

```typescript
// Solution: Increase Node.js memory limit
const installCmd = `NODE_OPTIONS="--max-old-space-size=12288" npm install`;

const result = await sandbox.process.executeCommand(
  installCmd,
  projectPath,
  undefined,
  900 // 15 minutes timeout
);
```

#### 3. Command Timeout

```typescript
// Solution: Increase timeout for long-running operations
const result = await sandbox.process.executeCommand(
  'npm run build',
  projectPath,
  undefined,
  1800 // 30 minutes timeout for complex builds
);
```

#### 4. Preview URL Not Loading

```typescript
// Solution: Wait longer and verify server is running
async function verifyServerStarted(sandbox: Sandbox, port: number): Promise<boolean> {
  // Wait up to 60 seconds
  for (let i = 0; i < 12; i++) {
    const check = await sandbox.process.executeCommand(
      `curl -f http://localhost:${port} --max-time 5 || echo "NOT_RUNNING"`
    );
    
    if (!check.result.includes('NOT_RUNNING')) {
      return true; // Server is running
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return false; // Timeout
}
```

### Error Handling Pattern

```typescript
async function createAndSetupSandbox(): Promise<Sandbox> {
  let sandbox: Sandbox | null = null;

  try {
    // Create sandbox
    sandbox = await daytona.create({
      workspaceClass: 'medium',
      public: true,
    });

    // Clone repo
    await sandbox.git.clone(repoUrl, 'workspace/project');

    // Install dependencies
    await sandbox.process.executeCommand(
      'npm install',
      'workspace/project',
      { NODE_OPTIONS: '--max-old-space-size=12288' },
      900
    );

    return sandbox;
  } catch (error) {
    // Clean up on error
    if (sandbox) {
      await sandbox.delete().catch(console.error);
    }
    throw error;
  }
}
```

### Retry Strategy

```typescript
async function createSandboxWithRetry(maxRetries = 3): Promise<Sandbox> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sandbox = await daytona.create({ workspaceClass: 'medium' });
      return sandbox;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to create sandbox');
}
```

### Logging Best Practices

```typescript
// Structured logging
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    message,
    ...data,
  }));
}

// Usage
log('info', 'Creating sandbox', { workspaceClass: 'medium' });
log('warn', 'Command took long', { duration: 45000 });
log('error', 'Install failed', { exitCode: 1, stderr: result.stderr });
```

### Timeout Management

```typescript
// Helper function for operations with timeout
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  return Promise.race([promise, timeout]);
}

// Usage
const sandbox = await withTimeout(
  daytona.create({ workspaceClass: 'medium' }),
  60000,
  'Sandbox creation'
);
```

---

## Complete Integration Examples

### Example 1: Clone and Preview GitHub Repository

```typescript
import { Daytona, Sandbox } from '@daytonaio/sdk';

interface PreviewResult {
  sandboxId: string;
  previewUrl: string;
  framework: string;
  port: number;
}

async function cloneAndPreviewRepository(
  repoUrl: string,
  accessToken: string
): Promise<PreviewResult> {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY!,
  });

  let sandbox: Sandbox | null = null;

  try {
    // Step 1: Create sandbox
    console.log('Creating sandbox...');
    sandbox = await daytona.create({
      image: 'node:22-bookworm',
      workspaceClass: 'medium',
      public: true,
    });

    // Step 2: Clone repository
    console.log('Cloning repository...');
    const authenticatedUrl = repoUrl.replace(
      'https://github.com/',
      `https://x-access-token:${accessToken}@github.com/`
    );
    
    await sandbox.git.clone(authenticatedUrl, 'workspace/project');

    // Step 3: Detect framework
    console.log('Detecting framework...');
    const packageJsonContent = await sandbox.fs.readFile('workspace/project/package.json');
    const packageJson = JSON.parse(packageJsonContent.toString('utf-8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    let framework = 'node';
    let port = 3000;
    let startCommand = 'npm run dev';

    if (dependencies.next) {
      framework = 'nextjs';
      port = 3000;
    } else if (dependencies.vite) {
      framework = 'vite';
      port = 5173;
    } else if (dependencies.vue) {
      framework = 'vue';
      port = 8080;
    }

    // Step 4: Install dependencies
    console.log('Installing dependencies...');
    const installResult = await sandbox.process.executeCommand(
      'npm install',
      'workspace/project',
      { NODE_OPTIONS: '--max-old-space-size=12288' },
      900
    );

    if (installResult.exitCode !== 0) {
      throw new Error(`Install failed: ${installResult.result}`);
    }

    // Step 5: Start dev server
    console.log('Starting dev server...');
    const sessionId = `dev-server-${Date.now()}`;
    await sandbox.process.createSession(sessionId);
    
    await sandbox.process.executeSessionCommand(sessionId, {
      command: startCommand,
      runAsync: true,
      cwd: 'workspace/project',
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Step 6: Get preview URL
    console.log('Getting preview URL...');
    const previewInfo = await sandbox.getPreviewUrl(port);

    return {
      sandboxId: sandbox.id,
      previewUrl: previewInfo.url,
      framework,
      port,
    };
  } catch (error) {
    // Clean up on error
    if (sandbox) {
      await sandbox.delete().catch(console.error);
    }
    throw error;
  }
}

// Usage
const result = await cloneAndPreviewRepository(
  'https://github.com/username/nextjs-app',
  'ghp_your_token_here'
);

console.log(`Preview URL: ${result.previewUrl}`);
```

### Example 2: Inngest Workflow Integration

```typescript
import { inngest } from './client';
import { Daytona } from '@daytonaio/sdk';
import { createClient } from '@/lib/supabase/server';

export const cloneAndPreviewRepository = inngest.createFunction(
  {
    id: 'daytona-clone-and-preview-repository',
    retries: 2,
    concurrency: { limit: 5 },
  },
  { event: 'github/clone-and-preview' },
  async ({ event, step }) => {
    const { projectId, repoUrl, userId } = event.data;
    const supabase = await createClient();
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    // Step 1: Get GitHub access token
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

    // Step 2: Create sandbox
    const sandboxResult = await step.run('create-sandbox', async () => {
      await supabase
        .from('projects')
        .update({ status: 'building' })
        .eq('id', projectId);

      const sandbox = await daytona.create({
        image: 'node:22-bookworm',
        workspaceClass: 'medium',
        public: true,
      });

      return { sandboxId: sandbox.id };
    });

    // Step 3: Clone repository
    await step.run('clone-repository', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);
      
      const authenticatedUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${integration.access_token}@github.com/`
      );

      await sandbox.git.clone(authenticatedUrl, 'workspace/project');
    });

    // Step 4: Detect framework
    const frameworkInfo = await step.run('detect-framework', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);
      const content = await sandbox.fs.readFile('workspace/project/package.json');
      const packageJson = JSON.parse(content.toString('utf-8'));
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      let framework = 'node';
      let port = 3000;
      
      if (deps.next) {
        framework = 'nextjs';
        port = 3000;
      } else if (deps.vite) {
        framework = 'vite';
        port = 5173;
      }

      return { framework, port };
    });

    // Step 5: Install dependencies
    await step.run('install-dependencies', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);
      
      const result = await sandbox.process.executeCommand(
        'npm install',
        'workspace/project',
        { NODE_OPTIONS: '--max-old-space-size=12288' },
        900
      );

      if (result.exitCode !== 0) {
        throw new Error(`Install failed: ${result.result}`);
      }
    });

    // Step 6: Start dev server
    const previewResult = await step.run('start-preview-server', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);
      
      const sessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(sessionId);
      
      await sandbox.process.executeSessionCommand(sessionId, {
        command: 'npm run dev',
        runAsync: true,
        cwd: 'workspace/project',
      });

      await new Promise(resolve => setTimeout(resolve, 15000));

      const previewInfo = await sandbox.getPreviewUrl(frameworkInfo.port);
      
      return {
        url: previewInfo.url,
        port: frameworkInfo.port,
      };
    });

    // Step 7: Update database
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

### Example 3: Health Check and Auto-Restart

```typescript
// API Route: app/api/sandbox/health/[projectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Daytona } from '@daytonaio/sdk';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

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
      await daytona.getSandbox(project.metadata.sandboxId);
      return NextResponse.json({ isAlive: true });
    } catch {
      return NextResponse.json({ isAlive: false });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ isAlive: false }, { status: 500 });
  }
}

// API Route: app/api/sandbox/restart/[projectId]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Recreate sandbox and restart preview
    const sandbox = await daytona.create({
      image: 'node:22-bookworm',
      workspaceClass: 'medium',
      public: true,
    });

    // Clone, install, start (same as initial setup)
    // ... implementation from Example 1 ...

    const previewInfo = await sandbox.getPreviewUrl(project.metadata.port);

    // Update database
    await supabase
      .from('projects')
      .update({
        sandbox_url: previewInfo.url,
        metadata: {
          ...project.metadata,
          sandboxId: sandbox.id,
        },
      })
      .eq('id', projectId);

    return NextResponse.json({
      success: true,
      sandboxUrl: previewInfo.url,
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

### Example 4: React Hook for Sandbox Management

```typescript
// hooks/use-sandbox-manager.ts
import { useState, useEffect, useCallback } from 'react';

interface UseSandboxManagerOptions {
  projectId: string;
  enabled: boolean;
  onSandboxRestored?: (newUrl: string) => void;
}

export function useSandboxManager({
  projectId,
  enabled,
  onSandboxRestored,
}: UseSandboxManagerOptions) {
  const [state, setState] = useState({
    isAlive: true,
    isRestarting: false,
    lastCheck: null as number | null,
  });

  const checkHealth = useCallback(async () => {
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

  const restart = useCallback(async () => {
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

    // Initial check
    checkHealth().then(isAlive => {
      if (!isAlive) restart();
    });

    // Check every 5 minutes
    const interval = setInterval(async () => {
      const isAlive = await checkHealth();
      if (!isAlive) await restart();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, checkHealth, restart]);

  return state;
}
```

---

## Migration from E2B Checklist

### 1. Remove E2B Dependencies

```bash
npm uninstall @e2b/code-interpreter
```

### 2. Install Daytona

```bash
npm install @daytonaio/sdk
```

### 3. Update Environment Variables

```env
# Remove
E2B_API_KEY=...
E2B_FULLSTACK_TEMPLATE_ID=...

# Add
DAYTONA_API_KEY=...
DAYTONA_API_URL=https://api.daytona.works
DAYTONA_TARGET=us
```

### 4. Update Imports

```typescript
// Old (E2B)
import { Sandbox } from '@e2b/code-interpreter';

// New (Daytona)
import { Daytona, Sandbox } from '@daytonaio/sdk';
```

### 5. Replace Sandbox Creation

```typescript
// Old (E2B)
const sandbox = await Sandbox.create(templateId, {
  timeoutMs: 300000,
});

// New (Daytona)
const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY! });
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  workspaceClass: 'medium',
  public: true,
});
```

### 6. Replace Command Execution

```typescript
// Old (E2B)
const result = await sandbox.commands.run(command, {
  timeoutMs: 120000,
});

// New (Daytona)
const result = await sandbox.process.executeCommand(command, '.', undefined, 120);
```

### 7. Replace Preview URL

```typescript
// Old (E2B)
const url = `https://${sandbox.getHost(port)}`;

// New (Daytona)
const previewInfo = await sandbox.getPreviewUrl(port);
const url = previewInfo.url;
```

---

## Summary

This guide covered everything needed to integrate Daytona into SmartAPI Forge:

✅ **SDK Setup**: Installation, configuration, environment variables  
✅ **Sandbox Management**: Creating, stopping, deleting sandboxes  
✅ **File Operations**: Reading, writing, uploading, downloading files  
✅ **Git Operations**: Cloning repos, managing branches, committing changes  
✅ **Process Execution**: Running commands, background processes, log streaming  
✅ **Preview URLs**: Auto-generated public/private preview links  
✅ **Resource Management**: Tier system, workspace classes, quota management  
✅ **Error Handling**: Common errors, retry strategies, logging  
✅ **Complete Examples**: Full workflows, Inngest integration, React hooks  

### Key Takeaways

1. **Start with Tier 1 (free)** for development
2. **Use `medium` workspace class** (4 vCPU, 16GB RAM) for your Next.js apps
3. **Always clean up sandboxes** to avoid hitting limits
4. **Set Node.js memory limit** to 12GB for large installs
5. **Use background sessions** for long-running dev servers
6. **Implement health checks** to auto-restart dead sandboxes

### Next Steps

1. Replace E2B imports with Daytona SDK
2. Update `daytona-client.ts` with proper configuration
3. Modify Inngest workflow to use Daytona sandbox operations
4. Test with a sample GitHub repository
5. Add health check API routes
6. Update frontend components to handle Daytona preview URLs

**Ready to build! 🚀**
