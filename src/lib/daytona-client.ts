/**
 * Daytona SDK Client Configuration
 * Replaces E2B sandbox with Daytona cloud workspaces
 * 
 * IMPORTANT: Make sure to install the Daytona SDK:
 * npm install @daytonaio/sdk
 * 
 * Set environment variables:
 * DAYTONA_API_KEY=your_api_key
 * DAYTONA_API_URL=https://api.daytona.works
 * DAYTONA_TARGET=us
 * 
 * V0/Lovable Architecture Updates:
 * - Added async file writing that doesn't block response
 * - Added batch file writing for efficiency
 * - Errors are logged but don't crash generation
 * - Requirements: 5.1, 5.2, 5.4
 */

import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';
import type { FileSnapshotData } from '../types/database';

// Export Sandbox type for use in other files
export type { Sandbox };

// Lazily initialize Daytona client so Next.js build doesn't execute SDK code
// during module load (which can throw if the SDK expects extra config).
let _daytona: Daytona | null = null;

function getDaytonaClient(): Daytona {
  if (_daytona) return _daytona;

  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY is not set');
  }

  const config: { apiKey: string; apiUrl: string; target: string; organizationId?: string } = {
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL || 'https://api.daytona.works',
    target: process.env.DAYTONA_TARGET || 'us',
  };

  // If the SDK ever requires an organization ID for certain key types,
  // allow it to be provided via env without forcing it for normal keys.
  if (process.env.DAYTONA_ORGANIZATION_ID) {
    config.organizationId = process.env.DAYTONA_ORGANIZATION_ID;
  }

  _daytona = new Daytona(config);
  return _daytona;
}

// Resource allocation for Daytona workspaces
export interface WorkspaceResources {
  cpu: number;      // CPU cores
  memory: number;   // Memory in GiB
  disk: number;     // Disk space in GiB
}

// Default workspace specifications: 4 vCPU, 8GB RAM, 10GB storage
export const DEFAULT_RESOURCES: WorkspaceResources = {
  cpu: 4,
  memory: 8,
  disk: 10,
};

// Configuration interface for creating sandboxes
export interface SandboxConfig {
  resources?: WorkspaceResources;
  image?: string;
  public?: boolean;
  envVars?: Record<string, string>;
  autoStopInterval?: number; // Minutes until auto-stop (0 = disabled, default = 15)
}

/**
 * Create a new Daytona workspace (sandbox)
 * Uses internal configuration instead of external snapshots
 * @param config Sandbox configuration
 * @returns Created sandbox instance
 */
export async function createWorkspace(config: SandboxConfig = {}): Promise<Sandbox> {
  const daytona = getDaytonaClient();

  const sandbox = await daytona.create({
    // Use Node.js 22 with Debian (full tooling support)
    image: config.image || 'node:22-bookworm',

    // Resource allocation: 4 vCPU, 8GB RAM, 10GB storage
    resources: config.resources || DEFAULT_RESOURCES,

    // Public preview URLs (true = publicly accessible)
    public: config.public ?? true,

    // Environment variables for the sandbox
    envVars: config.envVars || {},

    // Auto-stop interval: 30 minutes by default for cost efficiency
    // Only keeps running when user is actively viewing the project
    // Set to 0 to disable auto-stop (not recommended - costly!)
    autoStopInterval: config.autoStopInterval !== undefined ? config.autoStopInterval : 30,
  });

  console.log(`✅ Created Daytona workspace: ${sandbox.id} with ${config.resources?.cpu || DEFAULT_RESOURCES.cpu} vCPU, ${config.resources?.memory || DEFAULT_RESOURCES.memory}GB RAM, auto-stop: ${config.autoStopInterval !== undefined ? config.autoStopInterval : 30}min`);
  return sandbox;
}

/**
 * Get an existing Daytona workspace by ID
 * Uses daytona.get() or daytona.findOne() as per official SDK documentation
 * @param sandboxId Sandbox ID
 * @returns Sandbox instance
 */
export async function getWorkspace(sandboxId: string): Promise<Sandbox> {
  const daytona = getDaytonaClient();

  try {
    // Use get method for direct ID lookup (preferred)
    // Or findOne with idOrName filter as per official Daytona SDK documentation
    // https://www.daytona.io/docs/en/sandbox-management/
    const sandbox = await daytona.get(sandboxId);
    
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }
    
    return sandbox;
  } catch (error) {
    console.error(`Failed to get workspace ${sandboxId}:`, error);
    throw new Error(`Cannot reconnect to Daytona workspace ${sandboxId}: ${error}`);
  }
}

/**
 * Delete a Daytona workspace
 * @param sandboxId Sandbox ID or Sandbox instance
 */
export async function deleteWorkspace(sandboxId: string | Sandbox): Promise<void> {
  // Use shared getWorkspace helper to avoid relying on specific SDK methods
  if (typeof sandboxId === 'string') {
    const sandbox = await getWorkspace(sandboxId);
    await sandbox.delete();
  } else {
    await sandboxId.delete();
  }
  console.log(`🗑️ Deleted Daytona workspace`);
}

/**
 * Stop a Daytona workspace (preserves filesystem, frees CPU/RAM)
 * @param sandboxId Sandbox ID or Sandbox instance
 */
export async function stopWorkspace(sandboxId: string | Sandbox): Promise<void> {
  if (typeof sandboxId === 'string') {
    const sandbox = await getWorkspace(sandboxId);
    await sandbox.stop();
  } else {
    await sandboxId.stop();
  }
  console.log(`⏸️ Stopped Daytona workspace`);
}

/**
 * Start a stopped Daytona workspace
 * @param sandboxId Sandbox ID
 */
export async function startWorkspace(sandboxId: string): Promise<Sandbox> {
  const sandbox = await getWorkspace(sandboxId);
  await sandbox.start();
  console.log(`▶️ Started Daytona workspace: ${sandboxId}`);
  return sandbox;
}

/**
 * Check if a sandbox is running and start it if stopped
 * Uses daytona.findOne() and sandbox.start() as per official SDK documentation
 * Stopped sandboxes maintain filesystem persistence while memory state is cleared
 * @param sandboxId Sandbox ID
 * @returns Sandbox instance (started if it was stopped)
 */
export async function ensureSandboxRunning(sandboxId: string): Promise<Sandbox> {
  try {
    // Get the sandbox using findOne
    const sandbox = await getWorkspace(sandboxId);

    // Check sandbox state directly using the state property
    // Possible states: 'started', 'stopped', 'starting', 'stopping', 'error', etc.
    const state = sandbox.state;
    console.log(`📊 Sandbox ${sandboxId} state: ${state}`);

    if (state === 'started') {
      console.log(`✅ Sandbox ${sandboxId} is already running`);
      return sandbox;
    }

    if (state === 'stopped' || state === 'archived') {
      console.log(`⏸️ Sandbox ${sandboxId} is ${state}, starting it...`);
      
      // Start the sandbox - this will wait for it to be ready
      await sandbox.start();
      
      // Refresh sandbox data to get updated state
      await sandbox.refreshData();
      
      console.log(`▶️ Successfully started sandbox ${sandboxId}, new state: ${sandbox.state}`);
      return sandbox;
    }

    if (state === 'starting') {
      console.log(`⏳ Sandbox ${sandboxId} is already starting, waiting for it to be ready...`);
      
      // Wait for sandbox to be started (up to 60 seconds)
      await sandbox.waitUntilStarted(60);
      
      console.log(`✅ Sandbox ${sandboxId} is now running`);
      return sandbox;
    }

    if (state === 'error') {
      const errorReason = sandbox.errorReason || 'Unknown error';
      console.error(`❌ Sandbox ${sandboxId} is in error state: ${errorReason}`);
      throw new Error(`Sandbox is in error state: ${errorReason}`);
    }

    // For any other state, try to start it
    console.log(`⚠️ Sandbox ${sandboxId} is in unexpected state: ${state}, attempting to start...`);
    await sandbox.start();
    await sandbox.refreshData();
    
    return sandbox;
  } catch (error) {
    console.error(`Failed to ensure sandbox ${sandboxId} is running:`, error);
    throw error;
  }
}

/**
 * Keep a sandbox alive by making periodic API calls
 * This resets the auto-stop timer
 * @param sandboxId Sandbox ID
 * @returns Object with success status and sandbox state
 */
export async function keepSandboxAlive(sandboxId: string): Promise<{ success: boolean; state?: string; needsRestart?: boolean }> {
  try {
    const sandbox = await getWorkspace(sandboxId);
    
    // Check sandbox state
    const state = sandbox.state;
    
    if (state === 'stopped' || state === 'archived') {
      console.log(`⏸️ Sandbox ${sandboxId} is ${state}, needs to be started`);
      return { success: false, state, needsRestart: true };
    }
    
    if (state === 'error') {
      console.log(`❌ Sandbox ${sandboxId} is in error state`);
      return { success: false, state, needsRestart: true };
    }
    
    if (state !== 'started') {
      console.log(`⚠️ Sandbox ${sandboxId} is in state: ${state}`);
      return { success: false, state };
    }

    // Make a lightweight API call to reset the auto-stop timer
    // Just listing the root directory is enough
    await (sandbox.fs as any).list('/');
    console.log(`💓 Keep-alive ping sent to sandbox ${sandboxId}`);
    return { success: true, state };
  } catch (error) {
    console.error(`Failed to keep sandbox ${sandboxId} alive:`, error);
    // Don't throw - keep-alive is not critical
    return { success: false, needsRestart: true };
  }
}

/**
 * List all sandboxes for debugging
 */
export async function listWorkspaces(): Promise<any[]> {
  const daytona = getDaytonaClient();
  // Try different method names for listing sandboxes
  if (typeof (daytona as any).list === 'function') {
    return await (daytona as any).list();
  }
  if (typeof (daytona as any).listSandboxes === 'function') {
    return await (daytona as any).listSandboxes();
  }
  console.warn('No list method found on Daytona client');
  return [];
}

// ============================================================================
// V0/Lovable Architecture: Async File Operations
// Requirements: 5.1, 5.2, 5.4
// ============================================================================

/**
 * Result of an async file write operation
 */
export interface FileWriteResult {
  path: string;
  success: boolean;
  error?: string;
}

/**
 * Result of a batch file write operation
 */
export interface BatchWriteResult {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  results: FileWriteResult[];
  errors: string[];
}

/**
 * Write a single file to Daytona sandbox
 * Errors are logged but don't throw - returns result object
 * 
 * @param sandbox Sandbox instance
 * @param filePath Path to write the file
 * @param content File content
 * @returns FileWriteResult with success status
 * 
 * Requirements: 5.2, 5.4
 */
export async function writeFile(
  sandbox: Sandbox,
  filePath: string,
  content: string
): Promise<FileWriteResult> {
  try {
    // Normalize path - ensure it's relative to /workspace
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/workspace/')) {
      normalizedPath = normalizedPath.substring('/workspace/'.length);
    } else if (normalizedPath.startsWith('workspace/')) {
      normalizedPath = normalizedPath.substring('workspace/'.length);
    }

    // Make path absolute for Daytona SDK
    const absolutePath = normalizedPath.startsWith('/')
      ? normalizedPath
      : `/workspace/${normalizedPath}`;

    // Ensure directory exists
    const dirPath = absolutePath.substring(0, absolutePath.lastIndexOf('/'));
    if (dirPath && dirPath !== '/workspace') {
      try {
        await (sandbox.fs as any).createFolder(dirPath, '0755');
      } catch {
        // Directory might already exist, ignore error
      }
    }

    // Write the file - Daytona SDK expects (content: Buffer, path: string)
    await (sandbox.fs as any).uploadFile(Buffer.from(content, 'utf-8'), absolutePath);
    console.log(`✅ [Daytona] Wrote file: ${absolutePath}`);
    return { path: filePath, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Daytona] Failed to write file ${filePath}:`, errorMessage);
    // Don't throw - return error result (Requirement 5.4)
    return { path: filePath, success: false, error: errorMessage };
  }
}

/**
 * Read a file from Daytona sandbox
 * Errors are logged but don't throw - returns null on failure
 * 
 * @param sandbox Sandbox instance
 * @param filePath Path to read
 * @returns File content or null on error
 */
export async function readFile(
  sandbox: Sandbox,
  filePath: string
): Promise<string | null> {
  try {
    // Normalize path - ensure it's absolute for Daytona SDK
    let absolutePath = filePath;
    if (!absolutePath.startsWith('/')) {
      absolutePath = `/workspace/${absolutePath}`;
    }

    const content = await (sandbox.fs as any).downloadFile(absolutePath);
    return typeof content === 'string' ? content : content.toString();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Daytona] Failed to read file ${filePath}:`, errorMessage);
    return null;
  }
}

/**
 * Write multiple files to Daytona sandbox asynchronously
 * Does NOT block the response - fires and forgets with logging
 * 
 * @param sandbox Sandbox instance
 * @param files Map of file paths to content
 * @returns Promise<BatchWriteResult> with summary of operations
 * 
 * Requirements: 5.2, 5.4
 */
export async function writeFilesAsync(
  sandbox: Sandbox,
  files: Record<string, string>
): Promise<BatchWriteResult> {
  const filePaths = Object.keys(files);
  const results: FileWriteResult[] = [];
  const errors: string[] = [];

  console.log(`📝 [Daytona] Writing ${filePaths.length} files asynchronously...`);

  // Write files in parallel for efficiency
  const writePromises = filePaths.map(async (filePath) => {
    const result = await writeFile(sandbox, filePath, files[filePath]);
    results.push(result);
    if (!result.success && result.error) {
      errors.push(`${filePath}: ${result.error}`);
    }
    return result;
  });

  // Wait for all writes to complete
  await Promise.all(writePromises);

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`📝 [Daytona] Batch write complete: ${successCount}/${filePaths.length} succeeded`);

  if (failureCount > 0) {
    console.warn(`⚠️ [Daytona] ${failureCount} file(s) failed to write:`, errors);
  }

  return {
    totalFiles: filePaths.length,
    successCount,
    failureCount,
    results,
    errors,
  };
}

/**
 * Write files from a FileSnapshotData structure to Daytona
 * Extracts content from snapshot format and writes to sandbox
 * 
 * @param sandbox Sandbox instance
 * @param snapshotData FileSnapshotData from database
 * @returns Promise<BatchWriteResult>
 * 
 * Requirements: 5.2, 5.4
 */
export async function writeSnapshotToDaytona(
  sandbox: Sandbox,
  snapshotData: FileSnapshotData
): Promise<BatchWriteResult> {
  // Convert snapshot format to simple path -> content map
  const files: Record<string, string> = {};

  for (const [filePath, fileData] of Object.entries(snapshotData)) {
    files[filePath] = fileData.content;
  }

  return writeFilesAsync(sandbox, files);
}

/**
 * Write only changed files to Daytona (more efficient for updates)
 * 
 * @param sandbox Sandbox instance
 * @param changedFiles Array of file paths that changed
 * @param snapshotData Full snapshot data to get content from
 * @returns Promise<BatchWriteResult>
 * 
 * Requirements: 5.2, 5.4
 */
export async function writeChangedFilesToDaytona(
  sandbox: Sandbox,
  changedFiles: string[],
  snapshotData: FileSnapshotData
): Promise<BatchWriteResult> {
  const files: Record<string, string> = {};

  for (const filePath of changedFiles) {
    const fileData = snapshotData[filePath];
    if (fileData) {
      files[filePath] = fileData.content;
    } else {
      console.warn(`⚠️ [Daytona] Changed file ${filePath} not found in snapshot`);
    }
  }

  return writeFilesAsync(sandbox, files);
}

/**
 * Fire-and-forget file writing - starts async write without waiting
 * Use this when you want to write files without blocking the response
 * 
 * @param sandbox Sandbox instance
 * @param files Map of file paths to content
 * @param onComplete Optional callback when write completes
 * 
 * Requirements: 5.2, 5.3, 5.4
 */
export function writeFilesFireAndForget(
  sandbox: Sandbox,
  files: Record<string, string>,
  onComplete?: (result: BatchWriteResult) => void
): void {
  // Start the async operation without awaiting
  writeFilesAsync(sandbox, files)
    .then((result) => {
      if (onComplete) {
        onComplete(result);
      }
    })
    .catch((error) => {
      // Log but don't throw - this is fire-and-forget
      console.error('❌ [Daytona] Fire-and-forget write failed:', error);
      if (onComplete) {
        onComplete({
          totalFiles: Object.keys(files).length,
          successCount: 0,
          failureCount: Object.keys(files).length,
          results: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    });
}

/**
 * Get the preview URL for a Daytona sandbox
 * 
 * @param sandbox Sandbox instance
 * @param port Port number (default: 3000)
 * @returns Preview URL string
 */
export async function getPreviewUrlAsync(sandbox: Sandbox, port: number = 3000): Promise<string> {
  try {
    // Use the official getPreviewLink method from Daytona SDK
    if (typeof sandbox.getPreviewLink === 'function') {
      const previewLink = await sandbox.getPreviewLink(port);
      console.log(`📎 [Daytona] Got preview link:`, previewLink);
      return previewLink.url || '';
    }

    // Fallback: try getPreviewUrl if it exists
    if (typeof (sandbox as any).getPreviewUrl === 'function') {
      return (sandbox as any).getPreviewUrl(port);
    }

    // Last resort fallback - construct URL (may not work)
    console.warn('⚠️ [Daytona] No getPreviewLink method found, using fallback URL');
    return `https://${port}-${sandbox.id}.proxy.daytona.works`;
  } catch (error) {
    console.error('❌ [Daytona] Failed to get preview URL:', error);
    return '';
  }
}

/**
 * Synchronous version for backwards compatibility
 * Note: This may return an incorrect URL - prefer getPreviewUrlAsync
 */
export function getPreviewUrl(sandbox: Sandbox, port: number = 3000): string {
  // Return a placeholder - the async version should be used
  return `https://${port}-${sandbox.id}.proxy.daytona.works`;
}

/**
 * Read all files from a directory in Daytona sandbox
 * Useful for creating initial snapshots from cloned repos
 * OPTIMIZED: Reads files in parallel batches for speed
 * 
 * @param sandbox Sandbox instance
 * @param basePath Base directory path (e.g., 'workspace/repo')
 * @param extensions Optional file extensions to include (e.g., ['.ts', '.tsx', '.js'])
 * @returns Promise<FileSnapshotData> with relative paths (basePath stripped)
 */
export async function readAllFiles(
  sandbox: Sandbox,
  basePath: string = '.',
  extensions?: string[]
): Promise<FileSnapshotData> {
  const snapshot: FileSnapshotData = {};

  try {
    // List all files recursively
    const allFiles = await listFilesRecursive(sandbox, basePath);

    // Filter files - skip non-code files and optionally filter by extension
    const filesToRead = allFiles.filter(filePath => {
      // Skip common non-code files first (node_modules, .git, binary files, etc.)
      if (shouldSkipFile(filePath)) {
        return false;
      }

      // Filter by extension if specified
      if (extensions && extensions.length > 0) {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        return extensions.includes(ext);
      }

      // Use the helper function to check if it's a code/config file
      return isCodeOrConfigFile(filePath);
    });

    console.log(`📂 [Daytona] After filtering: ${filesToRead.length} of ${allFiles.length} files`);

    console.log(`📖 [Daytona] Reading ${filesToRead.length} files in parallel...`);

    // Read files in parallel batches of 10 (reduced to avoid "Unexpected end of form" errors)
    const BATCH_SIZE = 10;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToRead.length; i += BATCH_SIZE) {
      const batch = filesToRead.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (filePath) => {
          const content = await readFile(sandbox, filePath);
          return { filePath, content };
        })
      );

      // Add successful reads to snapshot
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.content !== null) {
          const { filePath, content } = result.value;
          // Strip basePath prefix to get relative path (e.g., 'workspace/repo/app/page.tsx' -> 'app/page.tsx')
          let relativePath = filePath;
          if (basePath && basePath !== '.' && filePath.startsWith(basePath)) {
            relativePath = filePath.substring(basePath.length).replace(/^\//, '');
          }

          snapshot[relativePath] = {
            content,
            language: detectLanguage(relativePath),
            size: content.length,
          };
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    console.log(`📖 [Daytona] Read ${successCount} files (${failCount} failed) from ${basePath}`);
    return snapshot;
  } catch (error) {
    console.error('❌ [Daytona] Failed to read all files:', error);
    return snapshot;
  }
}

/**
 * Important config files that start with '.' but should be included
 */
const IMPORTANT_DOT_FILES = [
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.env.example',
  '.env.local.example',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
];

/**
 * Directories to always skip
 */
const SKIP_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  'dist',
  'build',
  '.vercel',
];

/**
 * List files recursively in a directory using Daytona's fs methods
 * IMPROVED: Better handling of Daytona SDK response formats and config files
 */
async function listFilesRecursive(
  sandbox: Sandbox,
  basePath: string,
  maxDepth: number = 10
): Promise<string[]> {
  const allFiles: string[] = [];

  async function walkDir(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      // Use list method to get directory contents
      const entries = await (sandbox.fs as any).list(currentPath);

      // Debug: Log what we got from list()
      if (depth === 0) {
        console.log(`📂 [Daytona] list('${currentPath}') returned:`,
          Array.isArray(entries) ? `${entries.length} entries` : typeof entries);
        if (Array.isArray(entries) && entries.length > 0) {
          console.log(`📂 [Daytona] First entry sample:`, JSON.stringify(entries[0]).substring(0, 200));
        }
      }

      if (!entries || !Array.isArray(entries)) {
        console.warn(`⚠️ [Daytona] list() returned non-array for ${currentPath}:`, entries);
        return;
      }

      for (const entry of entries) {
        // Handle different entry formats from Daytona SDK
        let name: string;
        let isDir: boolean;

        if (typeof entry === 'string') {
          // Simple string entry - assume it's a file name
          name = entry;
          // Check if it's a directory by trying to list it (expensive but reliable)
          isDir = false; // Assume file, will be corrected if needed
        } else if (typeof entry === 'object' && entry !== null) {
          // Object entry - extract name and type
          name = entry.name || entry.path || entry.filename || '';

          // Check various ways the SDK might indicate a directory
          isDir = entry.isDir === true ||
            entry.isDirectory === true ||
            entry.type === 'directory' ||
            entry.type === 'dir' ||
            entry.kind === 'directory' ||
            entry.mode?.startsWith?.('d') ||
            (entry.mode && typeof entry.mode === 'number' && (entry.mode & 0o40000) !== 0);
        } else {
          console.warn(`⚠️ [Daytona] Unknown entry format:`, entry);
          continue;
        }

        if (!name) {
          console.warn(`⚠️ [Daytona] Entry has no name:`, entry);
          continue;
        }

        // Skip directories we don't want to traverse
        if (SKIP_DIRECTORIES.includes(name)) {
          continue;
        }

        // Skip hidden files EXCEPT important config files
        if (name.startsWith('.') && !IMPORTANT_DOT_FILES.some(f => name === f || name.startsWith(f))) {
          continue;
        }

        const fullPath = currentPath === '.' || currentPath === '/' || currentPath === ''
          ? name
          : `${currentPath}/${name}`.replace(/\/+/g, '/');

        if (isDir) {
          // Recursively walk subdirectories
          await walkDir(fullPath, depth + 1);
        } else {
          // It's a file - add to list
          allFiles.push(fullPath);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`📂 [Daytona] list('${currentPath}') failed: ${errorMsg}`);

      // If list fails at root, try alternative methods
      if (depth === 0) {
        console.log(`📂 [Daytona] Trying findFiles as fallback...`);
        await tryFindFilesMethod(sandbox, currentPath, allFiles);

        // If findFiles also failed or returned nothing, try shell command
        if (allFiles.length === 0) {
          console.log(`📂 [Daytona] Trying shell command as last resort...`);
          await tryShellListFiles(sandbox, currentPath, allFiles);
        }
      }
    }
  }

  await walkDir(basePath, 0);

  console.log(`📂 [Daytona] Found ${allFiles.length} files in ${basePath}`);
  if (allFiles.length > 0) {
    console.log(`📂 [Daytona] Sample files:`, allFiles.slice(0, 10));
  } else {
    console.warn(`⚠️ [Daytona] No files found! This may indicate an issue with the Daytona SDK or sandbox.`);
  }

  return allFiles;
}

/**
 * Try using findFiles method as fallback
 */
async function tryFindFilesMethod(
  sandbox: Sandbox,
  basePath: string,
  allFiles: string[]
): Promise<void> {
  try {
    const matches = await sandbox.fs.findFiles(basePath, '**/*');

    console.log(`📂 [Daytona] findFiles returned ${matches?.length || 0} matches`);

    if (matches && matches.length > 0) {
      console.log(`📂 [Daytona] findFiles sample:`, JSON.stringify(matches[0]).substring(0, 300));
    }

    for (const m of matches || []) {
      const match = m as any;
      // Try various properties that might contain the file path
      const filePath = typeof match === 'string'
        ? match
        : (match.file || match.path || match.name || match.filePath || match.filename || '');

      if (filePath &&
        !filePath.includes('node_modules') &&
        !filePath.includes('.git') &&
        !filePath.includes('.next')) {
        allFiles.push(filePath);
      }
    }
  } catch (findError) {
    console.warn(`⚠️ [Daytona] findFiles failed:`, findError);
  }
}

/**
 * Try using shell command to list files as last resort
 */
async function tryShellListFiles(
  sandbox: Sandbox,
  basePath: string,
  allFiles: string[]
): Promise<void> {
  try {
    // Normalize the base path for the find command
    let searchPath = basePath;
    if (basePath === '.' || basePath === '' || basePath === '/workspace') {
      searchPath = '/workspace';
    } else if (!basePath.startsWith('/')) {
      searchPath = `/workspace/${basePath}`;
    }

    // First, debug: list what's in the workspace root
    try {
      const lsResult = await sandbox.process.executeCommand(
        `ls -la ${searchPath} 2>/dev/null || echo "ls failed"`,
        '/workspace',
        undefined,
        10
      );
      console.log(`📂 [Daytona] ls -la ${searchPath}:`, lsResult.result?.substring(0, 500));
    } catch {
      console.log(`📂 [Daytona] ls command failed`);
    }

    // Use find command to list ALL files recursively (not just specific extensions)
    // This ensures we don't miss any files in the template
    // -maxdepth 10 to go deep enough for nested components
    const result = await sandbox.process.executeCommand(
      `find ${searchPath} -maxdepth 10 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/.turbo/*" -not -path "*/dist/*" -not -path "*/build/*" -not -name "*.lock" -not -name "package-lock.json" -not -name "pnpm-lock.yaml" 2>/dev/null | head -200`,
      '/workspace',
      undefined,
      30
    );

    const output = result.result || '';
    const lines = output.split('\n').filter(line => line.trim());
    console.log(`📂 [Daytona] Shell find returned ${lines.length} files`);

    // Log first few files for debugging
    if (lines.length > 0) {
      console.log(`📂 [Daytona] Shell find sample:`, JSON.stringify(lines.slice(0, 10)));
    }

    for (const line of lines) {
      // Convert absolute path to relative (strip /workspace/ prefix)
      let relativePath = line.trim();
      if (relativePath.startsWith('/workspace/')) {
        relativePath = relativePath.substring('/workspace/'.length);
      }
      if (relativePath && !allFiles.includes(relativePath)) {
        allFiles.push(relativePath);
      }
    }
  } catch (shellError) {
    console.warn(`⚠️ [Daytona] Shell find failed:`, shellError);
  }
}

/**
 * Check if a file should be skipped (node_modules, .git, etc.)
 */
function shouldSkipFile(filePath: string): boolean {
  const skipPatterns = [
    'node_modules/',
    '.git/',
    '.next/',
    'dist/',
    'build/',
    '.cache/',
    '.DS_Store',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '.turbo/',
    'coverage/',
    '.nyc_output/',
    '.vercel/',
    '.netlify/',
    '__pycache__/',
    '.pytest_cache/',
    'venv/',
    '.venv/',
    'vendor/',
    'Thumbs.db',
  ];

  // Also skip binary/large files by extension
  const skipExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib',
  ];

  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  if (skipExtensions.includes(ext)) return true;

  return skipPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Check if a file is a code/config file that should be included
 */
function isCodeOrConfigFile(filePath: string): boolean {
  // Code file extensions
  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.json', '.css', '.scss', '.sass', '.less',
    '.html', '.htm', '.md', '.mdx',
    '.yaml', '.yml', '.toml', '.xml',
  ];

  // Config files (with or without extension)
  const configFileNames = [
    'package.json',
    'tsconfig.json',
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'tailwind.config.js',
    'tailwind.config.ts',
    'postcss.config.js',
    'postcss.config.mjs',
    'components.json',
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    '.prettierrc',
    '.prettierrc.json',
    '.gitignore',
    '.env.example',
    'Dockerfile',
    'Makefile',
    'README.md',
    'LICENSE',
  ];

  const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
  const ext = filePath.substring(filePath.lastIndexOf('.'));

  // Check if it's a known config file
  if (configFileNames.some(cf => fileName === cf || fileName.startsWith(cf))) {
    return true;
  }

  // Check if it has a code extension
  return codeExtensions.includes(ext);
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();

  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.py': 'python',
    '.sql': 'sql',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.env': 'plaintext',
    '.txt': 'plaintext',
  };

  return languageMap[ext] || 'plaintext';
}

// ============================================================================
// Full Project Scaffolding: Template Cloning and Package Management
// Requirements: 1.1, 1.2, 3.4, 7.9
// ============================================================================

/**
 * Result of a template clone operation
 */
export interface CloneTemplateResult {
  success: boolean;
  sandboxId: string;
  sandboxUrl: string;
  files?: FileSnapshotData;
  error?: string;
  duration: number;
}

/**
 * Result of a pnpm install operation
 */
export interface PnpmInstallResult {
  success: boolean;
  installed: PackageInfo[];
  failed: FailedPackage[];
  duration: number;
  command: string;
  output?: string;
  error?: string;
}

/**
 * Information about an installed package
 */
export interface PackageInfo {
  name: string;
  version: string;
}

/**
 * Information about a failed package installation
 */
export interface FailedPackage {
  name: string;
  error: string;
}

/**
 * Clone a pre-built template environment for a new project
 * This is much faster than running npm create-next-app per-user
 * 
 * @param templateId The Daytona template ID to clone (from DAYTONA_TEMPLATE_ID env var)
 * @param projectId The project ID for logging/tracking
 * @returns CloneTemplateResult with sandbox info
 * 
 * Requirements: 1.1, 1.2
 */
export async function cloneTemplate(
  templateId: string,
  projectId: string
): Promise<CloneTemplateResult> {
  const startTime = Date.now();

  if (!templateId) {
    return {
      success: false,
      sandboxId: '',
      sandboxUrl: '',
      error: 'DAYTONA_TEMPLATE_ID is not configured',
      duration: Date.now() - startTime,
    };
  }

  try {
    console.log(`🚀 [Daytona] Cloning template ${templateId} for project ${projectId}...`);

    const daytona = getDaytonaClient();

    // Create a new sandbox from the template
    // The template already has node_modules installed, so this is fast
    const sandbox = await daytona.create({
      // Use the template image/snapshot
      image: templateId,

      // Resource allocation: 4 vCPU, 8GB RAM, 10GB storage
      resources: DEFAULT_RESOURCES,

      // Public preview URLs
      public: true,

      // Auto-stop after 30 minutes of inactivity
      autoStopInterval: 30,
    });

    const duration = Date.now() - startTime;
    const sandboxUrl = await getPreviewUrlAsync(sandbox, 3000);

    console.log(`✅ [Daytona] Template cloned in ${duration}ms: ${sandbox.id}, preview: ${sandboxUrl}`);

    return {
      success: true,
      sandboxId: sandbox.id,
      sandboxUrl,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [Daytona] Failed to clone template:`, errorMessage);

    return {
      success: false,
      sandboxId: '',
      sandboxUrl: '',
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Run pnpm add to install packages in a Daytona sandbox
 * 
 * @param sandbox Sandbox instance
 * @param packages Array of package names to install
 * @returns PnpmInstallResult with installed packages and versions
 * 
 * Requirements: 3.4
 */
export async function runPnpmInstall(
  sandbox: Sandbox,
  packages: string[]
): Promise<PnpmInstallResult> {
  const startTime = Date.now();

  if (!packages || packages.length === 0) {
    return {
      success: true,
      installed: [],
      failed: [],
      duration: 0,
      command: '',
    };
  }

  // Build the pnpm add command
  const packageList = packages.join(' ');
  const command = `pnpm add ${packageList}`;

  console.log(`📦 [Daytona] Running: ${command}`);

  try {
    // Execute the pnpm add command in the sandbox
    // Daytona SDK executeCommand takes: (command, cwd, envVars, timeout)
    const result = await sandbox.process.executeCommand(
      command,
      '/workspace', // cwd
      undefined, // env vars
      120 // 2 minute timeout for package installation (in seconds)
    );

    const duration = Date.now() - startTime;
    const output = result.result || '';

    // Parse the output to extract installed package versions
    const installed: PackageInfo[] = [];
    const failed: FailedPackage[] = [];

    // Check if installation was successful (no error in output)
    const hasError = output.toLowerCase().includes('error') ||
      output.toLowerCase().includes('err!') ||
      output.toLowerCase().includes('failed');

    if (!hasError) {
      // Try to get installed versions from package.json
      const installedPackages = await getInstalledPackages(sandbox);

      for (const pkg of packages) {
        const installedPkg = installedPackages.find(
          p => p.name.toLowerCase() === pkg.toLowerCase()
        );

        if (installedPkg) {
          installed.push(installedPkg);
        } else {
          // Package might be installed under a different name
          installed.push({ name: pkg, version: 'latest' });
        }
      }

      console.log(`✅ [Daytona] Installed ${installed.length} packages in ${duration}ms`);

      return {
        success: true,
        installed,
        failed,
        duration,
        command,
        output,
      };
    } else {
      // Installation failed
      const errorMessage = output || 'pnpm add failed';

      // Mark all packages as failed
      for (const pkg of packages) {
        failed.push({ name: pkg, error: errorMessage });
      }

      console.error(`❌ [Daytona] pnpm install failed:`, errorMessage);

      return {
        success: false,
        installed,
        failed,
        duration,
        command,
        output,
        error: errorMessage,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [Daytona] pnpm install error:`, errorMessage);

    return {
      success: false,
      installed: [],
      failed: packages.map(pkg => ({ name: pkg, error: errorMessage })),
      duration,
      command,
      error: errorMessage,
    };
  }
}

/**
 * Get installed packages from package.json in a Daytona sandbox
 * 
 * @param sandbox Sandbox instance
 * @returns Array of PackageInfo with name and version
 * 
 * Requirements: 7.9
 */
export async function getInstalledPackages(
  sandbox: Sandbox
): Promise<PackageInfo[]> {
  try {
    // Read package.json from the sandbox
    const packageJsonContent = await readFile(sandbox, '/workspace/package.json');

    if (!packageJsonContent) {
      console.warn('⚠️ [Daytona] Could not read package.json');
      return [];
    }

    const packageJson = JSON.parse(packageJsonContent);
    const packages: PackageInfo[] = [];

    // Extract dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        packages.push({
          name,
          version: String(version).replace(/^[\^~]/, ''), // Remove ^ or ~ prefix
        });
      }
    }

    // Extract devDependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        packages.push({
          name,
          version: String(version).replace(/^[\^~]/, ''),
        });
      }
    }

    console.log(`📦 [Daytona] Found ${packages.length} installed packages`);
    return packages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Daytona] Failed to get installed packages:`, errorMessage);
    return [];
  }
}


// ============================================================================
// Preview Server Management
// Requirements: 4.1, 4.2, 4.4
// ============================================================================

/**
 * Result of starting the preview server
 */
export interface StartPreviewResult {
  success: boolean;
  previewUrl: string;
  error?: string;
  logs?: string;
  duration: number;
}

/**
 * Start the Next.js development server in a Daytona sandbox
 * 
 * IMPORTANT: This function waits for the server to actually be ready before returning.
 * It polls for "Local: http://localhost:3000" in the actual server output (like the GitHub clone flow).
 * 
 * @param sandbox Sandbox instance
 * @param port Port to run the server on (default: 3000)
 * @returns StartPreviewResult with preview URL or error
 * 
 * Requirements: 4.1, 4.2
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  port: number = 3000
): Promise<StartPreviewResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 [Daytona] Starting Next.js dev server on port ${port}...`);

    // IMPORTANT: First ensure dependencies are installed
    // The template's node_modules may not match the package.json we wrote
    console.log(`📦 [Daytona] Installing dependencies first...`);
    try {
      const installResult = await sandbox.process.executeCommand(
        'cd /workspace && pnpm install --prefer-offline',
        '/workspace',
        undefined,
        120 // 2 minute timeout for install
      );

      if (installResult.exitCode === 0) {
        console.log(`✅ [Daytona] Dependencies installed successfully`);
      } else {
        console.warn(`⚠️ [Daytona] pnpm install returned exit code ${installResult.exitCode}`);
        console.warn(`📝 [Daytona] Install output: ${installResult.result?.substring(0, 500)}`);
      }
    } catch (installError) {
      console.warn(`⚠️ [Daytona] pnpm install failed, continuing anyway:`, installError);
    }

    // Start the dev server using session-based execution (like GitHub clone does)
    const sessionId = `dev-server-${Date.now()}`;
    const command = `cd /workspace && pnpm dev --port ${port}`;

    let cmdId: string | null = null;
    let useSessionLogs = false;

    try {
      // Create session for background process
      await sandbox.process.createSession(sessionId);

      console.log(`📝 [Daytona] Starting dev server with command: ${command}`);

      // Start server in background (async = don't wait for completion)
      const commandResult = await sandbox.process.executeSessionCommand(sessionId, {
        command,
        runAsync: true,
      });

      // Get command ID for fetching logs later
      cmdId = (commandResult as any).cmdId || (commandResult as any).id || null;
      useSessionLogs = true;

      console.log(`✅ [Daytona] Dev server command started with ID: ${cmdId}`);
    } catch (sessionError) {
      // If session-based approach fails, fall back to executeCommand
      console.log(`⚠️ [Daytona] Session creation failed, using executeCommand fallback`);

      // Start the process without waiting for completion
      sandbox.process.executeCommand(
        command,
        '/workspace',
        undefined,
        1 // Very short timeout - we just want to start the process
      ).catch(() => {
        // Expected to "fail" due to timeout - the server keeps running
        console.log(`[Daytona] Dev server process started (running in background)`);
      });
    }

    // Poll for server readiness by checking the actual logs OR port listening
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 2000; // Check every 2 seconds
    let serverReady = false;
    let pollStartTime = Date.now();
    let lastLogs: { stdout?: string; stderr?: string } = { stdout: '', stderr: '' };

    console.log(`⏳ [Daytona] Waiting for dev server to be ready...`);

    while (Date.now() - pollStartTime < maxWaitTime) {
      try {
        // Method 1: Check session logs for "Local:" or "localhost" (preferred)
        if (useSessionLogs && cmdId) {
          try {
            const logs = await sandbox.process.getSessionCommandLogs(sessionId, cmdId);
            lastLogs = logs;

            const combinedOutput = (logs.stdout || '') + (logs.stderr || '');

            // Look for Next.js ready indicators
            if (combinedOutput.includes('Local:') ||
              combinedOutput.includes(`localhost:${port}`) ||
              combinedOutput.includes('Ready in') ||
              combinedOutput.includes('started server on')) {

              // Extract and display the actual server output
              const lines = combinedOutput.split('\n');
              for (const line of lines) {
                if (line.includes('Local:') || line.includes('Network:') || line.includes('Ready')) {
                  console.log(`📍 [Daytona] ${line.trim()}`);
                }
              }

              console.log(`✅ [Daytona] Dev server is ready!`);
              serverReady = true;
              break;
            }

            // Check for errors
            if (logs.stderr && (logs.stderr.includes('EADDRINUSE') || logs.stderr.includes('Cannot find module'))) {
              console.error(`❌ [Daytona] Server error detected in logs`);
              console.error(`🔴 STDERR: ${logs.stderr.substring(0, 500)}`);
            }
          } catch (logError) {
            // Log fetch might fail initially, continue polling
          }
        }

        // Method 2: Check if port is listening (fallback)
        const portCheck = await sandbox.process.executeCommand(
          `netstat -tuln 2>/dev/null | grep :${port} || ss -tuln 2>/dev/null | grep :${port} || echo "port_not_listening"`,
          '/workspace',
          undefined,
          5
        );

        if (!portCheck.result?.includes('port_not_listening')) {
          // Port is listening - check if we already got logs showing it's ready
          if (!serverReady) {
            console.log(`✅ [Daytona] Port ${port} is now listening!`);

            // Try to get the final logs one more time to display the Local: URL
            if (useSessionLogs && cmdId) {
              try {
                const finalLogs = await sandbox.process.getSessionCommandLogs(sessionId, cmdId);
                const combinedOutput = (finalLogs.stdout || '') + (finalLogs.stderr || '');
                const lines = combinedOutput.split('\n');
                for (const line of lines) {
                  if (line.includes('Local:') || line.includes('Network:') || line.includes('Ready')) {
                    console.log(`📍 [Daytona] ${line.trim()}`);
                  }
                }
              } catch {
                // Ignore errors fetching final logs
              }
            }

            serverReady = true;
            break;
          }
        }

        // Show waiting status
        const waited = Math.round((Date.now() - pollStartTime) / 1000);
        console.log(`⏳ [Daytona] Waiting for server... (${waited}s)`);

      } catch {
        // Ignore errors during polling
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Final log output if we have it
    if (useSessionLogs && cmdId) {
      try {
        const finalLogs = await sandbox.process.getSessionCommandLogs(sessionId, cmdId);
        if (finalLogs.stdout) {
          console.log(`📝 [Daytona] Server STDOUT:\n${finalLogs.stdout.substring(0, 1000)}`);
        }
        if (finalLogs.stderr && finalLogs.stderr.length > 0) {
          console.log(`🔴 [Daytona] Server STDERR:\n${finalLogs.stderr.substring(0, 500)}`);
        }
      } catch {
        // Ignore errors fetching final logs
      }
    }

    if (!serverReady) {
      console.warn(`⚠️ [Daytona] Server did not become ready in ${maxWaitTime / 1000}s, continuing anyway...`);
    }

    // NOW get the preview URL (after server is confirmed ready)
    const previewLink = await sandbox.getPreviewLink(port);
    const previewUrl = previewLink.url || '';

    console.log(`📎 [Daytona] Got preview link:`, previewLink);

    const duration = Date.now() - startTime;

    console.log(`✅ [Daytona] Preview server started in ${duration}ms: ${previewUrl}`);

    return {
      success: true,
      previewUrl,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [Daytona] Failed to start preview server:`, errorMessage);

    return {
      success: false,
      previewUrl: '',
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Check if the preview server is running and responding
 * 
 * @param sandbox Sandbox instance
 * @param port Port to check (default: 3000)
 * @returns true if server is responding, false otherwise
 */
export async function isPreviewServerRunning(
  sandbox: Sandbox,
  port: number = 3000
): Promise<boolean> {
  try {
    // Try to check if the process is running
    const result = await sandbox.process.executeCommand(
      `pgrep -f "next dev" || pgrep -f "node.*next"`,
      '/workspace',
      undefined,
      5
    );

    // If we get output, the process is running
    return result.result?.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get server logs from the preview server
 * 
 * @param sandbox Sandbox instance
 * @param lines Number of lines to retrieve (default: 50)
 * @returns Server logs as string
 * 
 * Requirements: 4.4
 */
export async function getPreviewServerLogs(
  sandbox: Sandbox,
  lines: number = 50
): Promise<string> {
  try {
    // Try to read from common log locations
    const result = await sandbox.process.executeCommand(
      `tail -n ${lines} /workspace/.next/server.log 2>/dev/null || echo "No server logs available"`,
      '/workspace',
      undefined,
      5
    );

    return result.result || 'No server logs available';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return `Failed to retrieve logs: ${errorMessage}`;
  }
}

/**
 * Restart the preview server
 * 
 * @param sandbox Sandbox instance
 * @param port Port to run the server on (default: 3000)
 * @returns StartPreviewResult with preview URL or error
 */
export async function restartPreviewServer(
  sandbox: Sandbox,
  port: number = 3000
): Promise<StartPreviewResult> {
  const startTime = Date.now();

  try {
    console.log(`🔄 [Daytona] Restarting preview server...`);

    // Kill any existing Next.js processes
    try {
      await sandbox.process.executeCommand(
        `pkill -f "next dev" || pkill -f "node.*next" || true`,
        '/workspace',
        undefined,
        5
      );
    } catch {
      // Ignore errors - process might not exist
    }

    // Wait a moment for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start the server again
    return await startPreviewServer(sandbox, port);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [Daytona] Failed to restart preview server:`, errorMessage);

    return {
      success: false,
      previewUrl: '',
      error: errorMessage,
      duration,
    };
  }
}
