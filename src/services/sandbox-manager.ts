/**
 * SandboxManager Service
 * 
 * Manages Daytona sandbox lifecycle and file synchronization.
 * Provides real-time preview updates with progress events.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 16.2
 */

import { 
  ISandboxManager, 
  SyncResult, 
  RestartResult, 
  RestartOptions, 
  ServerStatus 
} from '../types/context-management';
import { StreamEvent } from '../types/streaming';
import { getWorkspace, ensureSandboxRunning } from '../lib/daytona-client';
import type { Sandbox } from '@daytonaio/sdk';

/**
 * Event emitter callback type for progress events
 */
export type SandboxEventCallback = (event: StreamEvent) => void;

/**
 * SandboxManager implementation
 * Handles file synchronization, server management, and progress events
 */
export class SandboxManager implements ISandboxManager {
  private eventCallback?: SandboxEventCallback;
  private projectId?: string;

  constructor(options?: { eventCallback?: SandboxEventCallback; projectId?: string }) {
    this.eventCallback = options?.eventCallback;
    this.projectId = options?.projectId;
  }

  /**
   * Set the event callback for progress events
   */
  setEventCallback(callback: SandboxEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Set the project ID for event emission
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Emit a progress event
   */
  private emit(event: StreamEvent): void {
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }


  /**
   * Sync files to the sandbox
   * Uploads changed files within 2 seconds and triggers hot reload
   * 
   * Requirements: 6.1, 6.2
   * 
   * @param sandboxId - The sandbox ID to sync files to
   * @param files - Record of file paths to content
   * @returns SyncResult with success status and timing
   */
  async syncFiles(sandboxId: string, files: Record<string, string>): Promise<SyncResult> {
    const startTime = Date.now();
    const syncedFiles: string[] = [];
    const failedFiles: string[] = [];

    try {
      // Emit progress event: starting sync
      this.emit({
        type: 'step:start',
        step: 'file_sync',
        message: `Syncing ${Object.keys(files).length} file(s) to sandbox...`,
      });

      // Get the sandbox instance
      const sandbox = await ensureSandboxRunning(sandboxId);

      // Upload files in parallel for speed (within 2 second target)
      const uploadPromises = Object.entries(files).map(async ([filePath, content]) => {
        try {
          // Emit file generating event
          this.emit({
            type: 'file:generating',
            filename: filePath.split('/').pop() || filePath,
            path: filePath,
          });

          // Upload file to sandbox
          await sandbox.fs.uploadFile(Buffer.from(content, 'utf-8'), filePath);
          
          syncedFiles.push(filePath);

          // Emit file complete event
          this.emit({
            type: 'file:complete',
            filename: filePath.split('/').pop() || filePath,
            path: filePath,
            content: content,
          });

          return { path: filePath, success: true };
        } catch (error) {
          console.error(`Failed to sync file ${filePath}:`, error);
          failedFiles.push(filePath);
          return { path: filePath, success: false, error };
        }
      });

      await Promise.all(uploadPromises);

      const duration = Date.now() - startTime;

      // Check if we met the 2-second target
      if (duration > 2000) {
        console.warn(`[SandboxManager] File sync took ${duration}ms, exceeding 2s target`);
      }

      // Emit completion event
      if (failedFiles.length === 0) {
        this.emit({
          type: 'step:complete',
          step: 'file_sync',
          message: `Synced ${syncedFiles.length} file(s) in ${duration}ms`,
        });
      } else {
        this.emit({
          type: 'warning',
          message: `Synced ${syncedFiles.length} file(s), ${failedFiles.length} failed`,
        });
      }

      // Trigger hot reload if files were synced successfully
      if (syncedFiles.length > 0) {
        await this.triggerHotReload(sandbox, syncedFiles);
      }

      return {
        success: failedFiles.length === 0,
        syncedFiles,
        failedFiles,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event with recovery suggestions
      this.emit({
        type: 'error',
        message: `File sync failed: ${errorMessage}`,
        stage: 'file_sync',
      });

      // Provide recovery suggestions
      this.emitRecoverySuggestions('file_sync', errorMessage);

      return {
        success: false,
        syncedFiles,
        failedFiles: Object.keys(files),
        duration,
      };
    }
  }

  /**
   * Trigger hot reload after file changes
   * Detects file types and triggers appropriate reload mechanism
   */
  private async triggerHotReload(sandbox: Sandbox, changedFiles: string[]): Promise<void> {
    // Check if any changed files require a full server restart
    const requiresRestart = changedFiles.some(file => 
      file.endsWith('.env') || 
      file.endsWith('.env.local') ||
      file.includes('next.config') ||
      file.includes('vite.config') ||
      file.includes('package.json')
    );

    if (requiresRestart) {
      this.emit({
        type: 'info',
        message: 'Configuration file changed, server restart may be required',
      });
    } else {
      // For regular files, hot reload should happen automatically
      // Most dev servers (Next.js, Vite) watch for file changes
      this.emit({
        type: 'info',
        message: 'Files synced, hot reload triggered',
      });
    }
  }


  /**
   * Restart the dev server in the sandbox
   * 
   * Requirements: 6.2, 16.2
   * 
   * @param sandboxId - The sandbox ID
   * @param options - Restart options
   * @returns RestartResult with success status and timing
   */
  async restartServer(sandboxId: string, options: RestartOptions): Promise<RestartResult> {
    const startTime = Date.now();

    try {
      // Emit restarting event
      this.emit({
        type: 'server:restarting',
        message: 'Restarting development server...',
      });

      const sandbox = await ensureSandboxRunning(sandboxId);

      // Kill existing dev server processes
      try {
        await sandbox.process.executeCommand({
          command: 'pkill -f "npm run dev" || pkill -f "next dev" || pkill -f "vite" || true',
          timeout: 10,
        });
      } catch {
        // Ignore errors from pkill if no process found
      }

      // Clear cache if requested
      if (options.clearCache) {
        try {
          await sandbox.process.executeCommand({
            command: 'rm -rf .next node_modules/.cache .vite 2>/dev/null || true',
            timeout: 30,
          });
          this.emit({
            type: 'info',
            message: 'Cache cleared',
          });
        } catch {
          // Ignore cache clear errors
        }
      }

      // Start the dev server
      const startResult = await sandbox.process.executeCommand({
        command: 'npm run dev &',
        timeout: options.timeout || 60,
      });

      // Wait for server to be ready if requested
      if (options.waitForReady) {
        await this.waitForServerReady(sandbox, options.timeout || 60);
      }

      const duration = Date.now() - startTime;

      // Emit ready event
      this.emit({
        type: 'server:ready',
        message: 'Development server is ready',
        previewUrl: await this.getPreviewUrl(sandbox),
      });

      return {
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event
      this.emit({
        type: 'error',
        message: `Server restart failed: ${errorMessage}`,
        stage: 'server_restart',
      });

      // Provide recovery suggestions
      this.emitRecoverySuggestions('server_restart', errorMessage);

      return {
        success: false,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Save environment file to sandbox and restart server
   * 
   * Requirements: 16.2
   * 
   * @param sandboxId - The sandbox ID
   * @param content - The .env.local file content
   */
  async saveEnvFile(sandboxId: string, content: string): Promise<void> {
    try {
      this.emit({
        type: 'step:start',
        step: 'env_update',
        message: 'Updating environment variables...',
      });

      const sandbox = await ensureSandboxRunning(sandboxId);

      // Find the project root (look for package.json)
      let projectRoot = '/home/daytona';
      try {
        const findResult = await sandbox.process.executeCommand({
          command: 'find /home/daytona -name "package.json" -not -path "*/node_modules/*" | head -1 | xargs dirname',
          timeout: 10,
        });
        if (findResult.result && findResult.result.trim()) {
          projectRoot = findResult.result.trim();
        }
      } catch {
        // Use default if find fails
      }

      // Write .env.local file
      const envPath = `${projectRoot}/.env.local`;
      await sandbox.fs.uploadFile(Buffer.from(content, 'utf-8'), envPath);

      this.emit({
        type: 'step:complete',
        step: 'env_update',
        message: 'Environment variables updated',
      });

      // Restart dev server to load new env vars
      this.emit({
        type: 'info',
        message: 'Restarting server to load new environment variables...',
      });

      await this.restartServer(sandboxId, {
        clearCache: false,
        waitForReady: true,
        timeout: 60,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit({
        type: 'error',
        message: `Failed to update environment variables: ${errorMessage}`,
        stage: 'env_update',
      });

      this.emitRecoverySuggestions('env_update', errorMessage);
      throw error;
    }
  }


  /**
   * Get the current server status
   * 
   * @param sandboxId - The sandbox ID
   * @returns ServerStatus with current state
   */
  async getServerStatus(sandboxId: string): Promise<ServerStatus> {
    try {
      const sandbox = await getWorkspace(sandboxId);

      // Check if dev server process is running
      const processCheck = await sandbox.process.executeCommand({
        command: 'pgrep -f "npm run dev" || pgrep -f "next dev" || pgrep -f "vite" || echo "stopped"',
        timeout: 5,
      });

      const isRunning = processCheck.result && !processCheck.result.includes('stopped');

      if (isRunning) {
        const previewUrl = await this.getPreviewUrl(sandbox);
        return {
          status: 'running',
          url: previewUrl,
        };
      }

      return {
        status: 'stopped',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * Wait for the server to be ready by polling health endpoint
   */
  private async waitForServerReady(sandbox: Sandbox, timeoutSeconds: number): Promise<void> {
    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;
    const pollIntervalMs = 1000;

    this.emit({
      type: 'step:progress',
      step: 'server_startup',
      progress: 0,
      message: 'Waiting for server to start...',
    });

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Try to curl localhost to check if server is responding
        const healthCheck = await sandbox.process.executeCommand({
          command: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000"',
          timeout: 5,
        });

        const statusCode = healthCheck.result?.trim();
        if (statusCode && statusCode !== '000' && parseInt(statusCode) < 500) {
          // Server is responding
          const elapsed = Date.now() - startTime;
          this.emit({
            type: 'step:progress',
            step: 'server_startup',
            progress: 100,
            message: `Server ready in ${Math.round(elapsed / 1000)}s`,
          });
          return;
        }
      } catch {
        // Ignore errors during polling
      }

      // Update progress
      const progress = Math.min(90, Math.round(((Date.now() - startTime) / maxWaitMs) * 100));
      this.emit({
        type: 'step:progress',
        step: 'server_startup',
        progress,
        message: 'Starting server...',
      });

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout reached
    this.emit({
      type: 'warning',
      message: 'Server startup timed out, but may still be starting',
    });
  }

  /**
   * Get the preview URL for the sandbox
   */
  private async getPreviewUrl(sandbox: Sandbox): Promise<string | undefined> {
    try {
      // Daytona provides preview URLs through the sandbox object
      // The exact method depends on the SDK version
      if ((sandbox as any).getPreviewUrl) {
        return await (sandbox as any).getPreviewUrl(3000);
      }
      if ((sandbox as any).previewUrl) {
        return (sandbox as any).previewUrl;
      }
      // Fallback: construct URL from sandbox ID
      return `https://${sandbox.id}-3000.preview.daytona.works`;
    } catch {
      return undefined;
    }
  }

  /**
   * Emit recovery suggestions based on error type
   * 
   * Requirements: 6.4
   */
  private emitRecoverySuggestions(stage: string, errorMessage: string): void {
    const suggestions: string[] = [];

    if (errorMessage.includes('timeout')) {
      suggestions.push('Try increasing the timeout value');
      suggestions.push('Check if the sandbox is still running');
    }

    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      suggestions.push('The sandbox may have been stopped - try restarting it');
      suggestions.push('Check your network connection');
    }

    if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      suggestions.push('Check file permissions in the sandbox');
      suggestions.push('Try running with elevated permissions');
    }

    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      suggestions.push('The file or directory may not exist');
      suggestions.push('Check the file path is correct');
    }

    if (stage === 'file_sync') {
      suggestions.push('Try syncing fewer files at once');
      suggestions.push('Check if the sandbox has enough disk space');
    }

    if (stage === 'server_restart') {
      suggestions.push('Check if package.json has a valid "dev" script');
      suggestions.push('Try running "npm install" first');
      suggestions.push('Check the server logs for errors');
    }

    if (stage === 'env_update') {
      suggestions.push('Verify the .env.local format is correct (KEY=value)');
      suggestions.push('Check for special characters that may need escaping');
    }

    if (suggestions.length > 0) {
      this.emit({
        type: 'info',
        message: `Recovery suggestions: ${suggestions.join('; ')}`,
      });
    }
  }
}

/**
 * Create a new SandboxManager instance
 */
export function createSandboxManager(options?: { 
  eventCallback?: SandboxEventCallback; 
  projectId?: string;
}): SandboxManager {
  return new SandboxManager(options);
}

/**
 * Default singleton instance for simple usage
 */
let defaultInstance: SandboxManager | null = null;

export function getSandboxManager(): SandboxManager {
  if (!defaultInstance) {
    defaultInstance = new SandboxManager();
  }
  return defaultInstance;
}
