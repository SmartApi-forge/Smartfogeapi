/**
 * Daytona Workspace Configuration
 * Centralized configuration for workspace resource allocation
 */

/**
 * Workspace class definitions for Daytona
 * Daytona uses workspace classes instead of timeouts
 * Workspaces have unlimited lifetime and only incur costs while running
 */
export type WorkspaceClass = 'small' | 'medium' | 'large';

/**
 * Default workspace class for most operations
 * Using internal configuration: 4 vCPU, 8GB RAM, 10GB storage
 * 
 * Rationale:
 * - Sufficient for complex Next.js/React builds
 * - 8GB RAM handles large node_modules (vs E2B's 1GB limit)
 * - 4 vCPU enables parallel build processes
 * - 10GB storage for efficient project storage
 */
export const DEFAULT_WORKSPACE_CLASS: WorkspaceClass = 'medium';

/**
 * Workspace class specifications
 * Custom configuration: 4 vCPU, 8GB RAM, 10GB storage
 */
export const WORKSPACE_SPECS = {
  default: { vcpu: 4, ram: '8GB', storage: '10GB' },
};

/**
 * Get workspace class for specific operation type
 * Returns the appropriate workspace class based on operation requirements
 */
export function getWorkspaceClass(operationType: 'clone' | 'build' | 'preview' | 'validation' | 'default' = 'default'): WorkspaceClass {
  switch (operationType) {
    case 'clone':
      return 'medium'; // 4 vCPU, 8GB RAM for repository cloning
    case 'build':
      return 'medium'; // 4 vCPU, 8GB RAM for builds
    case 'preview':
      return 'medium'; // 4 vCPU, 8GB RAM for dev servers
    case 'validation':
      return 'medium'; // 4 vCPU, 8GB RAM for validation
    default:
      return DEFAULT_WORKSPACE_CLASS;
  }
}

/**
 * Command execution timeout in seconds (for Daytona process.executeCommand)
 * Note: Daytona workspaces don't have an overall timeout, only individual commands
 */
export const COMMAND_DEFAULT_TIMEOUT_SEC = 300; // 5 minutes
export const COMMAND_EXTENDED_TIMEOUT_SEC = 900; // 15 minutes for large builds

/**
 * Keepalive interval for active user sessions
 * 5 minutes (300000ms) - how often to check workspace health
 */
export const WORKSPACE_KEEPALIVE_INTERVAL_MS = 300000; // 5 minutes

/**
 * Backward compatibility: Get timeout for specific operation type
 * @deprecated Use getWorkspaceClass instead
 */
export function getSandboxTimeout(operationType: 'clone' | 'build' | 'preview' | 'default' = 'default'): number {
  // Return command timeout in milliseconds for backward compatibility
  switch (operationType) {
    case 'build':
    case 'preview':
      return COMMAND_EXTENDED_TIMEOUT_SEC * 1000;
    default:
      return COMMAND_DEFAULT_TIMEOUT_SEC * 1000;
  }
}
