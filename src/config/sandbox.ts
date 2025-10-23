/**
 * E2B Sandbox Configuration
 * Centralized configuration for sandbox timeouts and resource management
 */

/**
 * Default sandbox timeout in milliseconds
 * 5 minutes (300000ms) - reasonable default for most operations
 * 
 * Rationale:
 * - Prevents resource leaks from abandoned sandboxes
 * - Sufficient for clone, install, and preview operations
 * - Can be extended per-operation if needed
 * 
 * For longer operations:
 * - Implement progress checkpoints
 * - Split work into smaller workflows
 * - Use keepalive endpoints for active user sessions
 */
export const SANDBOX_DEFAULT_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Extended timeout for operations that may take longer
 * 10 minutes (600000ms) - for complex builds or large repos
 */
export const SANDBOX_EXTENDED_TIMEOUT_MS = 600000; // 10 minutes

/**
 * Minimum timeout - prevents too-short timeouts
 * 2 minutes (120000ms)
 */
export const SANDBOX_MIN_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Maximum timeout - prevents indefinite resource usage
 * 30 minutes (1800000ms)
 */
export const SANDBOX_MAX_TIMEOUT_MS = 1800000; // 30 minutes

/**
 * Keepalive interval for active user sessions
 * 2 minutes (120000ms) - how often to send keepalive signals
 */
export const SANDBOX_KEEPALIVE_INTERVAL_MS = 120000; // 2 minutes

/**
 * Get timeout for specific operation type
 */
export function getSandboxTimeout(operationType: 'clone' | 'build' | 'preview' | 'default' = 'default'): number {
  switch (operationType) {
    case 'clone':
      return SANDBOX_DEFAULT_TIMEOUT_MS; // 5 minutes for cloning
    case 'build':
      return SANDBOX_EXTENDED_TIMEOUT_MS; // 10 minutes for builds
    case 'preview':
      return SANDBOX_EXTENDED_TIMEOUT_MS; // 10 minutes for preview
    default:
      return SANDBOX_DEFAULT_TIMEOUT_MS;
  }
}
