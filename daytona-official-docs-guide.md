# Complete Daytona Implementation Guide (Official Docs)

> **Based on Official Daytona Documentation**: This guide is compiled from the actual Daytona docs at daytona.io/docs to ensure 100% accuracy for SmartAPI Forge implementation.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [TypeScript SDK Reference](#typescript-sdk-reference)
3. [Configuration](#configuration)
4. [Sandbox Management](#sandbox-management)
5. [File System Operations](#file-system-operations)
6. [Git Operations](#git-operations)
7. [Process & Code Execution](#process--code-execution)
8. [Sessions (Background Processes)](#sessions-background-processes)
9. [Preview & Authentication](#preview--authentication)
10. [Resource Limits & Tiers](#resource-limits--tiers)
11. [Volumes](#volumes)
12. [Error Handling & Best Practices](#error-handling--best-practices)
13. [Complete Implementation for Your App](#complete-implementation-for-your-app)

---

## Getting Started

### Installation

Install the Daytona TypeScript SDK:

```bash
npm install @daytonaio/sdk
```

Or using yarn:

```bash
yarn add @daytonaio/sdk
```

### Get Your API Key

1. Go to the [Daytona Dashboard](https://app.daytona.io)
2. Create a new API key
3. Make sure to save it securely

### Quick Start Example

```typescript
import { Daytona } from '@daytonaio/sdk';

async function main() {
  // Initialize the SDK (uses environment variables by default)
  const daytona = new Daytona();

  // Create a new sandbox
  const sandbox = await daytona.create({
    language: 'typescript',
    envVars: {
      NODE_ENV: 'development',
    },
  });

  // Execute a command
  const response = await sandbox.process.executeCommand('echo "Hello, World!"');
  console.log(response.result);
}

main().catch(console.error);
```

---

## TypeScript SDK Reference

### Multiple Runtime Support

**Important**: If using Daytona SDK in browser context (Vite/Next.js client components), you need to configure webpack/vite.

#### Daytona in Vite Projects

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
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

#### Daytona in Next.js Projects

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

## Configuration

### Configuration Methods

Daytona SDK supports multiple ways to configure your environment, **in order of precedence**:

1. Configuration in code
2. Environment variables
3. `.env` file
4. Default values

### Configuration in Code

```typescript
import { Daytona } from '@daytonaio/sdk';

// Using environment variables (DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET)
const daytona = new Daytona();

// Using explicit configuration
const daytona = new Daytona({
  apiKey: 'your-api-key',
  apiUrl: 'https://app.daytona.io/api',
  target: 'us',
});
```

### Environment Variables

Add to `.env.local`:

```env
DAYTONA_API_KEY=your_api_key_here
DAYTONA_API_URL=https://api.daytona.works
DAYTONA_TARGET=us
```

### Default Values

- `DAYTONA_API_URL`: `https://api.daytona.works`
- `DAYTONA_TARGET`: `us`

---

## Sandbox Management

### Creating Sandboxes

```typescript
import { Daytona } from '@daytonaio/sdk';

const daytona = new Daytona();

// Create sandbox with language
const sandbox = await daytona.create({
  language: 'typescript',
  envVars: {
    NODE_ENV: 'development',
  },
});

console.log(sandbox.id); // 7cd11133-96c1-4cc8-9baa-c757b8f8c916
```

**Available Languages**: `typescript`, `python`, `node`, etc.

### Sandbox Resources

You can configure sandbox resources using **workspace classes**:

```typescript
const sandbox = await daytona.create({
  image: 'node:22-bookworm',
  workspaceClass: 'medium', // small, medium, large
  public: true, // For public preview URLs
  envVars: {
    NODE_ENV: 'production',
  },
});
```

**Workspace Classes**:
- `small`: 2 vCPU, 8 GB RAM
- `medium`: 4 vCPU, 16 GB RAM
- `large`: 8 vCPU, 32 GB RAM

### Getting Existing Sandbox

```typescript
// Get sandbox by ID
const sandbox = await daytona.getSandbox('7cd11133-96c1-4cc8-9baa-c757b8f8c916');
```

### Stop and Start Sandbox

**Stopped Sandboxes maintain filesystem persistence** while their memory state is cleared. They incur only disk usage costs and can be started again when needed.

```typescript
// Create sandbox
const sandbox = await daytona.create({
  language: 'python',
});

// Stop Sandbox
await sandbox.stop();
console.log(sandbox.id); // 7cd11133-96c1-4cc8-9baa-c757b8f8c916

// Start stopped sandbox
const stoppedSandbox = await daytona.getSandbox('7cd11133-96c1-4cc8-9baa-c757b8f8c916');
await stoppedSandbox.start();
```

### Deleting Sandboxes

```typescript
// Delete sandbox permanently
await sandbox.delete();
```

### Listing Sandboxes

```typescript
// List all sandboxes
const sandboxes = await daytona.listSandboxes();

for (const sb of sandboxes) {
  console.log(`${sb.id} - State: ${sb.state}`);
}
```

---

## File System Operations

The Daytona SDK provides comprehensive file system operations through the `fs` module in Sandboxes.

### Working Directory Behavior

**Important**: File operations assume you are operating in the Sandbox user's home directory (e.g. `workspace` implies `/home/[username]/workspace`). **Use a leading `/` when providing absolute paths**.

### Listing Files and Directories

```typescript
// List files in directory
const files = await sandbox.fs.listFiles('workspace');

for (const file of files) {
  console.log(`Name: ${file.name}`);
  console.log(`Is directory: ${file.isDir}`);
  console.log(`Size: ${file.size} bytes`);
  console.log(`Modified: ${file.modTime}`);
}
```

### Creating Directories

```typescript
// Create directory with permissions
await sandbox.fs.createFolder('workspace/new-dir', '755');

// Create nested directories
await sandbox.fs.createFolder('workspace/src/components', '755');
```

### Reading Files

```typescript
// Read text file
const content = await sandbox.fs.readFile('workspace/package.json');
console.log(content.toString('utf-8'));

// Read binary file
const imageData = await sandbox.fs.readFile('workspace/logo.png');
```

### Writing Files

```typescript
// Write text file
const content = Buffer.from('Hello, World!', 'utf-8');
await sandbox.fs.uploadFile(content, 'workspace/hello.txt');

// Write JSON file
const packageJson = JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2);
await sandbox.fs.uploadFile(Buffer.from(packageJson), 'workspace/package.json');
```

### Uploading Files

#### Uploading a Single File

```typescript
// Upload single file
const fileContent = Buffer.from('console.log("Hello");');
await sandbox.fs.uploadFile(fileContent, 'workspace/index.js');
```

#### Uploading Multiple Files

```typescript
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

#### Downloading a Single File

```typescript
// Download single file
const content = await sandbox.fs.downloadFile('workspace/output.json');
console.log(content.toString('utf-8'));
```

#### Downloading Multiple Files

```typescript
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

### Advanced Operations

#### File Permissions

```typescript
// Change file permissions
await sandbox.fs.chmod('workspace/script.sh', '755'); // rwxr-xr-x

// Change directory permissions
await sandbox.fs.chmod('workspace/secrets', '700'); // rwx------
```

#### File Search and Replace

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

The Daytona SDK provides built-in Git support through the `git` module in Sandboxes.

### Working Directory Behavior

**Important**: The starting cloning dir is the current Sandbox working directory. Uses the `WORKDIR` specified in the Dockerfile if present, or falling back to the user's home directory if not - e.g. `workspace/repo` implies `/my-work-dir/workspace/repo`, but you are free to provide an absolute workDir path as well (by starting the path with `/`).

### Cloning Repositories

You can clone public or private repositories, specific branches, and authenticate using personal access tokens.

```typescript
// Basic clone
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo'
);

// Clone with authentication
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo',
  undefined, // branch (optional)
  undefined, // depth (optional)
  'git', // username
  'personal_access_token' // password/token
);

// Clone specific branch
await sandbox.git.clone(
  'https://github.com/user/repo.git',
  'workspace/repo',
  'develop' // branch name
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
status.fileStatus.forEach(file => {
  console.log(`File: ${file.name}`);
  console.log(`Status: ${file.status}`); // modified, added, deleted, etc.
});

// List branches
const response = await sandbox.git.branches('workspace/repo');
response.branches.forEach(branch => {
  console.log(`Branch: ${branch}`);
});
```

### Branch Operations

#### Managing Branches

```typescript
// Create new branch
await sandbox.git.createBranch('workspace/repo', 'feature/new-feature');

// Switch branch
await sandbox.git.checkoutBranch('workspace/repo', 'feature/new-feature');

// Delete branch
await sandbox.git.deleteBranch('workspace/repo', 'feature/old-feature');
```

### Staging and Committing

#### Working with Changes

```typescript
// Stage specific files
await sandbox.git.add('workspace/repo', ['file1.txt', 'file2.txt']);

// Stage all changes
await sandbox.git.add('workspace/repo', ['.']);

// Commit changes
await sandbox.git.commit(
  'workspace/repo',
  'feat: add new feature',
  'John Doe',
  'john@example.com'
);
```

### Remote Operations

#### Working with Remotes

```typescript
// Push changes
await sandbox.git.push('workspace/repo');

// Pull changes
await sandbox.git.pull('workspace/repo');
```

---

## Process & Code Execution

The Daytona SDK provides powerful process and code execution capabilities through the `process` module in Sandboxes.

### Working Directory Behavior

**Important**: The `workDir` for executing defaults to the current Sandbox working directory. Uses the `WORKDIR` specified in the Dockerfile if present, or falling back to the user's home directory if not - e.g. `workspace/repo` implies `/my-work-dir/workspace/repo`, but you can override it with an absolute path (by starting the path with `/`).

### Code Execution

#### Running Code

You can execute code with input, timeout, and environment variables.

```typescript
// Run TypeScript code
let response = await sandbox.process.codeRun(`
  function greet(name: string): string {
    return \`Hello, \${name}!\`;
  }
  console.log(greet("Daytona"));
`);
console.log(response.result);

// Run code with argv and environment variables
response = await sandbox.process.codeRun(
  `
    console.log(\`Hello, \${process.argv[2]}!\`);
    console.log(\`FOO: \${process.env.FOO}\`);
  `,
  {
    argv: ['Daytona'],
    env: { FOO: 'BAR' }
  }
);
console.log(response.result);

// Run code with timeout
response = await sandbox.process.codeRun(
  'setTimeout(() => console.log("Done"), 2000);',
  undefined,
  5000 // 5 second timeout in milliseconds
);
console.log(response.result);
```

### Process Execution

#### Running Commands

You can run commands with input, timeout, and environment variables.

```typescript
// Execute any shell command
const response = await sandbox.process.executeCommand('ls -la');
console.log(response.result);

// Setting a working directory and a timeout
const response2 = await sandbox.process.executeCommand(
  'sleep 3',
  'workspace/src', // working directory
  undefined, // env vars
  5 // timeout in seconds
);
console.log(response2.result);

// Passing environment variables
const response3 = await sandbox.process.executeCommand(
  'echo $CUSTOM_SECRET',
  '.', // working directory
  { CUSTOM_SECRET: 'DAYTONA' } // env vars
);
console.log(response3.result);
```

---

## Sessions (Background Processes)

Daytona SDK provides an option to start, stop, and manage background process sessions in Sandboxes. You can run long-running commands, monitor process status, and list all running processes.

### Creating Sessions

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
```

### Managing Long-Running Processes

```typescript
// Check session's executed commands
const session = await sandbox.process.getSession(sessionId);
console.log(`Session ${sessionId}:`);

for (const command of session.commands) {
  console.log(`Command: ${command.command}, Exit Code: ${command.exitCode}`);
}

// List all running sessions
const sessions = await sandbox.process.listSessions();

for (const session of sessions) {
  console.log(`PID: ${session.id}, Commands: ${session.commands}`);
}
```

### Getting Session Command Status

```typescript
// Check command status
const status = await sandbox.process.getSessionCommandStatus(
  sessionId,
  command.cmdId
);

console.log(`Exit code: ${status.exitCode}`);
console.log(`Is running: ${status.isRunning}`);
```

### Getting Session Command Logs

```typescript
// Get command logs
const logs = await sandbox.process.getSessionCommandLogs(
  sessionId,
  command.cmdId
);

console.log(`Stdout: ${logs.stdout}`);
console.log(`Stderr: ${logs.stderr}`);
```

### Killing Session Commands

```typescript
// Stop command
await sandbox.process.killSessionCommand(sessionId, command.cmdId);
```

### Cleaning Up Sessions

```typescript
// Clean up session
await sandbox.process.deleteSession(sessionId);
```

---

## Preview & Authentication

The Daytona SDK provides a method to generate preview links for Sandboxes. A preview link's schema consists of the port and Sandbox ID (e.g. `https://3000-sandboxid.proxy.daytona.works`). **Any process listening for HTTP traffic on ports 3000–9999 can be previewed**.

### Fetching a Preview Link

To fetch the preview link and the authorization token for a specific port:

```typescript
const previewInfo = await sandbox.getPreviewUrl(3000);

console.log(`Preview link url: ${previewInfo.url}`);
console.log(`Preview link token: ${previewInfo.token}`);
```

### Authentication

If the Sandbox has its `public` property set to `true`, these links will be **publicly accessible**, otherwise the preview link will be available only to the Sandbox Organization users.

For programmatic access, use the authorization token to access the preview URL:

```bash
curl -H "x-daytona-preview-token: vg5c0ylmcimr8b_v1ne0u6mdnvit6gc0" \
  https://3000-sandbox-123456.proxy.daytona.work
```

### Warning Page

When opening the preview link in a browser, **a warning page will be shown for the first time**. This warning serves as a security measure to inform users about the potential risks of visiting the preview URL.

**The warning page will only be shown when loading the preview link in a browser.**

To avoid this warning you can do one of the following:
1. Send the `X-Daytona-Skip-Preview-Warning: true` header
2. Upgrade to Tier 3
3. Deploy your own custom preview proxy

```typescript
// Skip warning with header
const response = await fetch(previewUrl, {
  headers: {
    'X-Daytona-Skip-Preview-Warning': 'true',
  },
});
```

---

## Resource Limits & Tiers

Daytona enforces resource limits to ensure fair usage and stability across all organizations. Your organization has access to a **compute pool** consisting of:

- **vCPU** — Total CPU cores available
- **Memory** — Total RAM available
- **Storage** — Total disk space available

**Resources are shared across all running Sandboxes**, so the number of Sandboxes you can run at once depends on their individual usage.

### Tiers & Limit Increases

Organizations are automatically placed into a **Tier** based on verification status. You can unlock higher limits by completing the following steps:

| Tier | Resources (vCPU / RAM / Storage) | Access Requirements |
|------|----------------------------------|---------------------|
| **Tier 1** | 10 / 10GiB / 30GiB | Email verified |
| **Tier 2** | 100 / 200GiB / 300GiB | Credit card linked, $25 top-up, GitHub connected |
| **Tier 3** | 250 / 500GiB / 2000GiB | Business email verified, Phone verified, $500 top-up |
| **Tier 4** | 500 / 1000GiB / 5000GiB | $2000 top-up every 30 days |
| **Custom** | Custom limits | Contact support@daytona.io |

**Once you meet the criteria for a higher tier**, make sure to **Upgrade** by clicking the "Upgrade" button in the Dashboard.

### Manage Usage Dynamically

You can manage your resource usage by changing the state of your Sandboxes. The table below summarizes how each state affects resource usage:

| State | vCPU | Memory | Storage | Notes |
|-------|------|--------|---------|-------|
| **Running** | ✅ | ✅ | ✅ | Counts against all limits |
| **Stopped** | ❌ | ❌ | ✅ | Frees CPU & memory, but storage is still used |
| **Archived** | ❌ | ❌ | ❌ | Data moved to cold storage, no quota impact |
| **Deleted** | ❌ | ❌ | ❌ | All resources freed |

### Checking Current Usage

Check your current usage and limits in the [Dashboard](https://app.daytona.io).

---

## Volumes

Volumes are **FUSE-based mounts** that provide shared file access across Sandboxes. They allow Sandboxes to read from large files instantly - no need to upload files manually to each Sandbox.

**Key Features**:
- Volume data is stored on an S3-compatible object store
- Multiple volumes can be mounted to a single Sandbox
- A single volume can be mounted to multiple Sandboxes

### Creating Volumes

Before mounting a volume to a Sandbox, it must be created:

```typescript
const volume = await daytona.volume.get('my-volume', true);
```

### Mounting Volumes

Once a volume is created, it can be mounted to a Sandbox by specifying it in the `CreateSandboxFromSnapshotParams` object.

#### Volume Mount Path Requirements

Volume mount paths must meet the following requirements:
- **Must be absolute paths**: Mount paths must start with `/` (e.g. `/home/daytona/volume`)
- **Cannot be root directory**: Cannot mount to `/` or `//`
- **No relative path components**: Cannot contain `/../`, `/./`, or end with `/..` or `/.`
- **No consecutive slashes**: Cannot contain multiple consecutive slashes like `//` (except at the beginning)
- **Cannot mount to system directories**: The following system directories are prohibited: `/proc`, `/sys`, `/dev`, `/boot`, `/etc`, `/bin`, `/sbin`, `/lib`, `/lib64`

```typescript
import { Daytona } from '@daytonaio/sdk';
import path from 'path';

const daytona = new Daytona();

// Create a new volume or get an existing one
const volume = await daytona.volume.get('my-volume', true);

// Mount the volume to the sandbox
const mountDir1 = '/home/daytona/volume';

const sandbox = await daytona.create({
  language: 'python',
  volumes: [
    {
      volumeId: volume.id,
      mountPath: mountDir1,
    },
  ],
});
```

### Working with Volumes

Once mounted, you can use the volume like any other directory in the sandbox:

```typescript
// Write to volume
await sandbox.fs.uploadFile(
  Buffer.from('Hello from volume!'),
  '/home/daytona/volume/test.txt'
);

// Read from volume
const content = await sandbox.fs.readFile('/home/daytona/volume/test.txt');
console.log(content.toString('utf-8'));
```

### Deleting Volumes

```typescript
await daytona.volume.delete('my-volume');
```

### Limitations

- Volumes use FUSE (Filesystem in Userspace) which may have different performance characteristics than native filesystems
- Volume data is stored remotely and accessed over network, so latency may be higher than local storage
- System directories cannot be used as mount points for security reasons

---

## Error Handling & Best Practices

### Resource Management Best Practices

The following best practices apply to managing resources when executing processes:

1. **Use sessions for long-running operations**
2. **Clean up sessions after execution**
3. **Handle session exceptions properly**

```typescript
// TypeScript - Clean up session
const sessionId = 'long-running-cmd';

try {
  await sandbox.process.createSession(sessionId);
  const session = await sandbox.process.getSession(sessionId);
  // Do work...
} finally {
  await sandbox.process.deleteSession(session.sessionId);
}
```

### Error Handling Best Practices

The following best practices apply to error handling when executing processes:

1. **Handle process exceptions properly**
2. **Log error details for debugging**
3. **Use try-catch blocks for error handling**

```typescript
try {
  const response = await sandbox.process.codeRun('invalid typescript code');
} catch (e) {
  if (e instanceof ProcessExecutionError) {
    console.error('Execution failed:', e);
    console.error('Exit code:', e.exitCode);
    console.error('Error output:', e.stderr);
  }
}
```

### Common Issues

| Issue | Solutions |
|-------|-----------|
| **Process Execution Failed** | • Check command syntax<br>• Verify required dependencies<br>• Ensure sufficient permissions |
| **Process Timeout** | • Adjust timeout settings<br>• Optimize long-running operations<br>• Consider using background processes |
| **Resource Limits** | • Monitor process memory usage<br>• Handle process cleanup properly<br>• Use appropriate resource constraints |

---

## Complete Implementation for Your App

Now let's put it all together for your SmartAPI Forge application.

### Step 1: Create Daytona Client

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
}

// Helper function to create sandbox with defaults
export async function createDaytonaSandbox(config: SandboxConfig = {}) {
  const sandbox = await daytona.create({
    // Use language or image
    language: config.image ? undefined : 'typescript',
    image: config.image,
    
    // Resource allocation
    workspaceClass: config.workspaceClass || 'medium', // 4 vCPU, 16GB RAM
    
    // Public preview URLs (true = publicly accessible)
    public: config.public ?? true,
    
    // Environment variables for the sandbox
    envVars: config.envVars || {},
  });

  return sandbox;
}
```

### Step 2: GitHub Repository Service

Create `src/services/github-repository-service.ts`:

```typescript
import { Sandbox } from '@daytonaio/sdk';

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
      await sandbox.git.clone(authenticatedUrl, 'workspace/project');

      return {
        success: true,
        path: 'workspace/project',
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
      const content = await sandbox.fs.readFile(`${repoPath}/package.json`);
      const packageJson = JSON.parse(content.toString('utf-8'));
      
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

      // Detect package manager by checking lock files
      let packageManager: 'npm' | 'pnpm' | 'yarn' = 'npm';
      
      const files = await sandbox.fs.listFiles(repoPath);
      const fileNames = files.map(f => f.name);
      
      if (fileNames.includes('pnpm-lock.yaml')) {
        packageManager = 'pnpm';
      } else if (fileNames.includes('yarn.lock')) {
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
      let installCmd: string;
      
      switch (packageManager) {
        case 'pnpm':
          installCmd = 'pnpm install';
          break;
        case 'yarn':
          installCmd = 'yarn install';
          break;
        default:
          installCmd = 'npm install';
      }

      const result = await sandbox.process.executeCommand(
        installCmd,
        repoPath,
        { NODE_OPTIONS: '--max-old-space-size=12288' }, // 12GB Node.js memory
        900 // 15 minutes timeout
      );

      if (result.exitCode !== 0) {
        throw new Error(`Install failed: ${result.result}`);
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
      // Check if build script exists in package.json
      const content = await sandbox.fs.readFile(`${repoPath}/package.json`);
      const packageJson = JSON.parse(content.toString('utf-8'));
      
      if (!packageJson.scripts?.build) {
        // No build script, skip
        return { success: true };
      }

      let buildCmd: string;
      
      switch (packageManager) {
        case 'pnpm':
          buildCmd = 'pnpm run build';
          break;
        case 'yarn':
          buildCmd = 'yarn build';
          break;
        default:
          buildCmd = 'npm run build';
      }

      const result = await sandbox.process.executeCommand(
        buildCmd,
        repoPath,
        { NODE_OPTIONS: '--max-old-space-size=12288' },
        900 // 15 minutes timeout
      );

      if (result.exitCode !== 0) {
        console.warn('Build warning:', result.result);
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
          startCmd = 'pnpm run dev';
          break;
        case 'yarn':
          startCmd = 'yarn dev';
          break;
        default:
          startCmd = 'npm run dev';
      }

      // Create session for background process
      const sessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(sessionId);

      // Start server in background
      await sandbox.process.executeSessionCommand(sessionId, {
        command: startCmd,
        runAsync: true, // Don't wait for completion
        cwd: repoPath,
      });

      // Wait for server to be ready (15 seconds)
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Get Daytona preview URL
      const previewInfo = await sandbox.getPreviewUrl(port);

      return {
        success: true,
        url: previewInfo.url,
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

### Step 3: Inngest Workflow

Update your Inngest function in `src/inngest/functions.ts`:

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
        frameworkInfo.packageManager,
        cloneResult.repoPath
      );
    });

    // Step 6: Build Project (optional)
    await step.run('build-project', async () => {
      const sandbox = await daytona.getSandbox(sandboxResult.sandboxId);

      await githubRepositoryService.buildProject(
        sandbox,
        frameworkInfo.packageManager,
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
            repoUrl,
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

### Step 4: Health Check API

Create `app/api/sandbox/health/[projectId]/route.ts`:

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

    // Check if sandbox exists and is running
    try {
      const sandbox = await daytona.getSandbox(project.metadata.sandboxId);
      // Sandbox exists and is accessible
      return NextResponse.json({ isAlive: true });
    } catch {
      // Sandbox not found or stopped
      return NextResponse.json({ isAlive: false });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ isAlive: false }, { status: 500 });
  }
}
```

### Step 5: Restart API

Create `app/api/sandbox/restart/[projectId]/route.ts`:

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

    const repoPath = 'workspace/project';

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
      framework.packageManager,
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

## Summary

This guide is based on **official Daytona documentation** and provides everything needed to integrate Daytona into SmartAPI Forge:

✅ **Installation & Configuration**: TypeScript SDK setup with environment variables  
✅ **Sandbox Management**: Creating, stopping, starting, deleting sandboxes  
✅ **File Operations**: Reading, writing, uploading, downloading with proper paths  
✅ **Git Operations**: Cloning with authentication, branch management  
✅ **Process Execution**: Running commands with timeouts and env vars  
✅ **Sessions**: Background processes for dev servers  
✅ **Preview URLs**: Getting auto-generated HTTPS preview links  
✅ **Resource Limits**: Tier system, workspace classes, quota management  
✅ **Complete Implementation**: Full workflow for your application  

### Key Points from Official Docs

1. **Working directories** default to sandbox home directory - use `/` for absolute paths
2. **Preview URLs** auto-generated for ports 3000-9999
3. **Sessions** required for long-running background processes
4. **Resource tiers** from 10 to 500+ vCPU based on verification
5. **Stopped sandboxes** free CPU/memory but keep storage
6. **Volumes** use FUSE for shared file access across sandboxes

**Ready to implement with accurate Daytona SDK methods!** 🚀
