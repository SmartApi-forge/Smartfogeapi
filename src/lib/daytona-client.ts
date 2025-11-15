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

// Initialize Daytona client with configuration
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  apiUrl: process.env.DAYTONA_API_URL || 'https://api.daytona.works',
  target: process.env.DAYTONA_TARGET || 'us',
});

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
}

/**
 * Create a new Daytona workspace (sandbox)
 * Uses internal configuration instead of external snapshots
 * @param config Sandbox configuration
 * @returns Created sandbox instance
 */
export async function createWorkspace(config: SandboxConfig = {}): Promise<Sandbox> {
  const sandbox = await daytona.create({
    // Use Node.js 22 with Debian (full tooling support)
    image: config.image || 'node:22-bookworm',
    
    // Resource allocation: 4 vCPU, 8GB RAM, 10GB storage
    resources: config.resources || DEFAULT_RESOURCES,
    
    // Public preview URLs (true = publicly accessible)
    public: config.public ?? true,
    
    // Environment variables for the sandbox
    envVars: config.envVars || {},
  });

  console.log(`✅ Created Daytona workspace: ${sandbox.id} with ${config.resources?.cpu || DEFAULT_RESOURCES.cpu} vCPU, ${config.resources?.memory || DEFAULT_RESOURCES.memory}GB RAM`);
  return sandbox;
}

/**
 * Get an existing Daytona workspace by ID
 * @param sandboxId Sandbox ID
 * @returns Sandbox instance
 */
export async function getWorkspace(sandboxId: string): Promise<Sandbox> {
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
  if (typeof sandboxId === 'string') {
    const sandbox = await daytona.getSandbox(sandboxId);
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
    const sandbox = await daytona.getSandbox(sandboxId);
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
  const sandbox = await daytona.getSandbox(sandboxId);
  await sandbox.start();
  console.log(`▶️ Started Daytona workspace: ${sandboxId}`);
  return sandbox;
}

/**
 * List all sandboxes for debugging
 */
export async function listWorkspaces(): Promise<any[]> {
  return await daytona.listSandboxes();
}
