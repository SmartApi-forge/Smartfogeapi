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
 */

import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';

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

  const config: any = {
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL || 'https://api.daytona.works',
    target: process.env.DAYTONA_TARGET || 'us',
  };

  // If the SDK ever requires an organization ID for certain key types,
  // allow it to be provided via env without forcing it for normal keys.
  if (process.env.DAYTONA_ORGANIZATION_ID) {
    (config as any).organizationId = process.env.DAYTONA_ORGANIZATION_ID;
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
 * @param sandboxId Sandbox ID
 * @returns Sandbox instance
 */
export async function getWorkspace(sandboxId: string): Promise<Sandbox> {
  const daytona = getDaytonaClient();

  // Note: Daytona SDK might use different method names
  // Try multiple approaches for compatibility
  try {
    // Debug: Log available methods on daytona object
    console.log('Available Daytona methods:', Object.keys(daytona).filter(key => typeof (daytona as any)[key] === 'function'));
    
    // Try getSandbox first (from official docs)
    if (typeof daytona.getSandbox === 'function') {
      return await daytona.getSandbox(sandboxId);
    }
    // Try get method as alternative
    if (typeof (daytona as any).get === 'function') {
      return await (daytona as any).get(sandboxId);
    }
    // Try connect method (similar to E2B pattern)
    if (typeof (daytona as any).connect === 'function') {
      return await (daytona as any).connect(sandboxId);
    }
    
    // Log all available methods for debugging
    console.error('Daytona object methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(daytona)));
    console.error('\nPossible issues:');
    console.error('1. @daytonaio/sdk package not installed - run: npm install @daytonaio/sdk');
    console.error('2. SDK version mismatch - check package.json');
    console.error('3. Method name in SDK is different from documentation');
    throw new Error('Daytona SDK does not have getSandbox, get, or connect method. See logs above for debugging.');
  } catch (error) {
    console.error('Failed to get workspace:', error);
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
 * @param sandboxId Sandbox ID
 * @returns Sandbox instance (started if it was stopped)
 */
export async function ensureSandboxRunning(sandboxId: string): Promise<Sandbox> {
  try {
    const sandbox = await getWorkspace(sandboxId);
    
    // Check if sandbox is stopped and restart if needed
    // Note: Sandbox status might be available via sandbox.status or similar
    // If SDK doesn't provide status, we can try to make an API call and catch errors
    try {
      // Try to ping the sandbox by listing files (lightweight operation)
      await sandbox.fs.listDir('/');
      console.log(`✅ Sandbox ${sandboxId} is running`);
      return sandbox;
    } catch (error) {
      // If ping fails, try to start the sandbox
      console.log(`⏸️ Sandbox ${sandboxId} appears stopped, attempting to start...`);
      await sandbox.start();
      console.log(`▶️ Successfully restarted sandbox ${sandboxId}`);
      return sandbox;
    }
  } catch (error) {
    console.error(`Failed to ensure sandbox ${sandboxId} is running:`, error);
    throw error;
  }
}

/**
 * Keep a sandbox alive by making periodic API calls
 * This resets the auto-stop timer
 * @param sandboxId Sandbox ID
 */
export async function keepSandboxAlive(sandboxId: string): Promise<void> {
  try {
    const sandbox = await getWorkspace(sandboxId);
    
    // Make a lightweight API call to reset the auto-stop timer
    // Just listing the root directory is enough
    await sandbox.fs.listDir('/');
    console.log(`💓 Keep-alive ping sent to sandbox ${sandboxId}`);
  } catch (error) {
    console.error(`Failed to keep sandbox ${sandboxId} alive:`, error);
    // Don't throw - keep-alive is not critical
  }
}

/**
 * List all sandboxes for debugging
 */
export async function listWorkspaces(): Promise<any[]> {
  const daytona = getDaytonaClient();
  return await daytona.listSandboxes();
}
