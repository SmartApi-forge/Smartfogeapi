import { StreamEvent, StreamEventWithTimestamp } from '../types/streaming';
import { supabaseServer } from '../../lib/supabase-server';
import { createSandboxManager, SandboxManager, SandboxEventCallback } from './sandbox-manager';

type ConnectionCallback = (data: string) => void;

interface Connection {
  projectId: string;
  callback: ConnectionCallback;
  timestamp: number;
}

/**
 * Project sandbox mapping for preview updates
 * Requirements: 6.1, 14.1
 */
interface ProjectSandbox {
  sandboxId: string;
  sandboxManager: SandboxManager;
  lastSyncTime: number;
}

/**
 * Streaming service for managing Server-Sent Events connections
 * Enables real-time progress updates during API generation
 * 
 * Enhanced with SandboxManager integration for preview updates
 * Requirements: 6.1, 14.1
 */
class StreamingService {
  private connections: Map<string, Connection[]> = new Map();
  private projectSandboxes: Map<string, ProjectSandbox> = new Map();
  private static instance: StreamingService;

  private constructor() {
    // Cleanup old connections every 5 minutes
    setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000);
    // Cleanup stale sandbox mappings every 10 minutes
    setInterval(() => this.cleanupStaleSandboxes(), 10 * 60 * 1000);
  }

  static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  /**
   * Add a new SSE connection for a project
   */
  addConnection(projectId: string, callback: ConnectionCallback): () => void {
    const connections = this.connections.get(projectId) || [];
    const connection: Connection = {
      projectId,
      callback,
      timestamp: Date.now(),
    };

    connections.push(connection);
    this.connections.set(projectId, connections);

    console.log(`[StreamingService] Added connection for project ${projectId}. Total connections: ${connections.length}`);

    // Return cleanup function
    return () => {
      this.removeConnection(projectId, callback);
    };
  }

  /**
   * Remove a specific SSE connection
   */
  removeConnection(projectId: string, callback: ConnectionCallback): void {
    const connections = this.connections.get(projectId) || [];
    const filtered = connections.filter((conn) => conn.callback !== callback);

    if (filtered.length === 0) {
      this.connections.delete(projectId);
    } else {
      this.connections.set(projectId, filtered);
    }

    console.log(`[StreamingService] Removed connection for project ${projectId}. Remaining: ${filtered.length}`);
  }

  /**
   * Emit an event to all connections for a specific project
   */
  async emit(projectId: string, event: StreamEvent): Promise<void> {
    const connections = this.connections.get(projectId);

    if (!connections || connections.length === 0) {
      console.log(`[StreamingService] No connections for project ${projectId}. Event: ${event.type}`);
      return;
    }

    const eventWithTimestamp: StreamEventWithTimestamp = {
      ...event,
      timestamp: Date.now(),
    };

    const formattedData = this.formatSSE(eventWithTimestamp);

    console.log(`[StreamingService] Emitting ${event.type} to ${connections.length} connection(s) for project ${projectId}`);

    // Send to all connections
    connections.forEach((connection) => {
      try {
        connection.callback(formattedData);
      } catch (error) {
        console.error(`[StreamingService] Error sending to connection:`, error);
      }
    });

    // Save relevant events to database for persistence
    await this.saveEventToDatabase(projectId, eventWithTimestamp);
  }


  /**
   * Save generation event to database for persistence across reloads
   */
  private async saveEventToDatabase(projectId: string, event: StreamEventWithTimestamp): Promise<void> {
    try {
      // Save progress events for persistence
      const relevantEvents: Record<string, { icon: string; messageFormatter: (event: any) => string }> = {
        'project:created': {
          icon: 'processing',
          messageFormatter: (e) => 'Project created'
        },
        'step:start': {
          icon: 'processing',
          messageFormatter: (e) => e.message || e.step
        },
        'step:complete': {
          icon: 'complete',
          messageFormatter: (e) => `✓ ${e.message || e.step}`
        },
        'file:complete': {
          icon: 'complete',
          messageFormatter: (e) => `✓ Created ${e.filename}`
        },
        'validation:start': {
          icon: 'processing',
          messageFormatter: (e) => e.stage || 'Validating...'
        },
        'validation:complete': { 
          icon: 'complete', 
          messageFormatter: (e) => `✓ ${e.summary || e.stage || 'Code validated successfully'}` 
        },
        'complete': { 
          icon: 'complete', 
          messageFormatter: (e) => `✓ ${e.summary}` 
        },
        'error': {
          icon: 'error',
          messageFormatter: (e) => `✗ ${e.message}`
        }
      };

      const eventConfig = relevantEvents[event.type];
      if (!eventConfig) {
        return; // Skip events that shouldn't be persisted
      }

      const message = eventConfig.messageFormatter(event);
      
      // For step:complete events, check if we already have this step saved to avoid duplicates
      if (event.type === 'step:complete' || event.type === 'file:complete') {
        const { data: existing } = await supabaseServer
          .from('generation_events')
          .select('id')
          .eq('project_id', projectId)
          .eq('event_type', event.type)
          .eq('message', message)
          .maybeSingle();

        if (existing) {
          console.log(`[StreamingService] Event already exists, skipping: ${event.type} for project ${projectId}`);
          return;
        }
      }
      
      const { error } = await supabaseServer
        .from('generation_events')
        .insert({
          project_id: projectId,
          event_type: event.type,
          filename: 'filename' in event ? event.filename : null,
          message,
          icon: eventConfig.icon,
          timestamp: new Date(event.timestamp).toISOString(),
          metadata: event,
          version_id: 'versionId' in event ? event.versionId : null,
        });

      if (error) {
        console.error('[StreamingService] Error saving event to database:', error);
      } else {
        console.log(`[StreamingService] Saved ${event.type} event to database for project ${projectId}`);
      }
    } catch (error) {
      console.error('[StreamingService] Error in saveEventToDatabase:', error);
    }
  }

  /**
   * Close all connections for a project
   */
  closeProject(projectId: string): void {
    const connections = this.connections.get(projectId);

    if (connections) {
      console.log(`[StreamingService] Closing ${connections.length} connection(s) for project ${projectId}`);

      // Send close event
      connections.forEach((connection) => {
        try {
          connection.callback('event: close\ndata: {}\n\n');
        } catch (error) {
          console.error(`[StreamingService] Error closing connection:`, error);
        }
      });

      this.connections.delete(projectId);
    }
    
    // Also disconnect sandbox
    this.disconnectSandbox(projectId);
  }

  /**
   * Format event data as SSE
   */
  private formatSSE(event: StreamEventWithTimestamp): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  /**
   * Remove connections that haven't been used in over 1 hour
   */
  private cleanupStaleConnections(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleaned = 0;

    this.connections.forEach((connections, projectId) => {
      const active = connections.filter((conn) => conn.timestamp > oneHourAgo);

      if (active.length === 0) {
        this.connections.delete(projectId);
        cleaned += connections.length;
      } else if (active.length < connections.length) {
        this.connections.set(projectId, active);
        cleaned += connections.length - active.length;
      }
    });

    if (cleaned > 0) {
      console.log(`[StreamingService] Cleaned up ${cleaned} stale connection(s)`);
    }
  }

  /**
   * Get connection count for a project
   */
  getConnectionCount(projectId: string): number {
    return this.connections.get(projectId)?.length || 0;
  }

  /**
   * Get total connection count across all projects
   */
  getTotalConnections(): number {
    let total = 0;
    this.connections.forEach((connections) => {
      total += connections.length;
    });
    return total;
  }


  /**
   * Connect a project to a sandbox for preview updates
   * Requirements: 6.1, 14.1
   */
  connectSandbox(projectId: string, sandboxId: string): SandboxManager {
    const eventCallback: SandboxEventCallback = (event: StreamEvent) => {
      this.emit(projectId, event);
    };

    const sandboxManager = createSandboxManager({
      eventCallback,
      projectId,
    });

    this.projectSandboxes.set(projectId, {
      sandboxId,
      sandboxManager,
      lastSyncTime: Date.now(),
    });

    console.log(`[StreamingService] Connected sandbox ${sandboxId} to project ${projectId}`);
    return sandboxManager;
  }

  /**
   * Get the sandbox manager for a project
   */
  getSandboxManager(projectId: string): SandboxManager | undefined {
    return this.projectSandboxes.get(projectId)?.sandboxManager;
  }

  /**
   * Sync files to a project's sandbox
   * Requirements: 6.1
   */
  async syncFilesToSandbox(projectId: string, files: Record<string, string>): Promise<{ success: boolean; syncedFiles: string[]; failedFiles: string[]; duration: number } | undefined> {
    const projectSandbox = this.projectSandboxes.get(projectId);
    
    if (!projectSandbox) {
      console.log(`[StreamingService] No sandbox connected for project ${projectId}`);
      return undefined;
    }

    projectSandbox.lastSyncTime = Date.now();
    return projectSandbox.sandboxManager.syncFiles(projectSandbox.sandboxId, files);
  }

  /**
   * Disconnect a project's sandbox
   */
  disconnectSandbox(projectId: string): void {
    if (this.projectSandboxes.has(projectId)) {
      this.projectSandboxes.delete(projectId);
      console.log(`[StreamingService] Disconnected sandbox from project ${projectId}`);
    }
  }


  /**
   * Cleanup stale sandbox mappings (not synced in over 1 hour)
   */
  private cleanupStaleSandboxes(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleaned = 0;

    this.projectSandboxes.forEach((sandbox, projectId) => {
      if (sandbox.lastSyncTime < oneHourAgo) {
        this.projectSandboxes.delete(projectId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[StreamingService] Cleaned up ${cleaned} stale sandbox mapping(s)`);
    }
  }

  /**
   * Get sandbox connection count
   */
  getSandboxConnectionCount(): number {
    return this.projectSandboxes.size;
  }

  // Enhanced streaming event methods for context management
  // Requirements: 14.1, 14.2, 14.3, 14.5, 14.6

  async emitPhaseStart(projectId: string, phase: string, message: string, versionId?: string): Promise<void> {
    await this.emit(projectId, { type: 'step:start', step: phase, message, versionId });
  }

  async emitPhaseComplete(projectId: string, phase: string, message: string, versionId?: string): Promise<void> {
    await this.emit(projectId, { type: 'step:complete', step: phase, message, versionId });
  }

  async emitFileGenerating(projectId: string, filename: string, path: string, versionId?: string): Promise<void> {
    await this.emit(projectId, { type: 'file:generating', filename, path, versionId });
  }

  async emitFileComplete(projectId: string, filename: string, content: string, path: string, versionId?: string): Promise<void> {
    await this.emit(projectId, { type: 'file:complete', filename, content, path, versionId });
  }

  async emitCodeChunk(projectId: string, filename: string, chunk: string, progress: number, versionId?: string): Promise<void> {
    await this.emit(projectId, { type: 'code:chunk', filename, chunk, progress: Math.max(0, Math.min(100, progress)), versionId });
  }

  // Enhanced sandbox sync methods for preview updates
  // Requirements: 6.1, 14.1

  /**
   * Emit sandbox sync start event
   * Requirements: 6.1, 14.1
   */
  async emitSandboxSyncStart(projectId: string, fileCount: number, versionId?: string): Promise<void> {
    await this.emit(projectId, {
      type: 'sandbox:sync:start',
      fileCount,
      message: `Syncing ${fileCount} file(s) to sandbox...`,
      versionId,
    });
  }

  /**
   * Emit sandbox sync progress event
   * Requirements: 6.1
   */
  async emitSandboxSyncProgress(
    projectId: string,
    syncedCount: number,
    totalCount: number,
    currentFile: string,
    versionId?: string
  ): Promise<void> {
    const progress = totalCount > 0 ? Math.round((syncedCount / totalCount) * 100) : 0;
    await this.emit(projectId, {
      type: 'sandbox:sync:progress',
      syncedCount,
      totalCount,
      currentFile,
      progress,
      versionId,
    });
  }

  /**
   * Emit sandbox sync complete event
   * Requirements: 6.1
   */
  async emitSandboxSyncComplete(
    projectId: string,
    syncedFiles: string[],
    failedFiles: string[],
    duration: number,
    versionId?: string
  ): Promise<void> {
    const message = failedFiles.length === 0
      ? `Synced ${syncedFiles.length} file(s) in ${duration}ms`
      : `Synced ${syncedFiles.length} file(s), ${failedFiles.length} failed`;
    
    await this.emit(projectId, {
      type: 'sandbox:sync:complete',
      syncedFiles,
      failedFiles,
      duration,
      message,
      versionId,
    });
  }

  /**
   * Emit sandbox sync error event with recovery suggestions
   * Requirements: 6.4
   */
  async emitSandboxSyncError(
    projectId: string,
    message: string,
    failedFiles: string[],
    recoverySuggestions: string[],
    versionId?: string
  ): Promise<void> {
    await this.emit(projectId, {
      type: 'sandbox:sync:error',
      message,
      failedFiles,
      recoverySuggestions,
      versionId,
    });
  }

  /**
   * Emit preview updating event
   * Requirements: 6.3
   */
  async emitPreviewUpdating(projectId: string, message: string, versionId?: string): Promise<void> {
    await this.emit(projectId, {
      type: 'preview:updating',
      message,
      versionId,
    });
  }

  /**
   * Emit preview ready event
   * Requirements: 6.3
   */
  async emitPreviewReady(projectId: string, previewUrl: string, message: string, versionId?: string): Promise<void> {
    await this.emit(projectId, {
      type: 'preview:ready',
      previewUrl,
      message,
      versionId,
    });
  }

  /**
   * Sync files to sandbox with streaming progress events
   * This is the main integration point between streaming and sandbox manager
   * 
   * Requirements: 6.1, 6.2, 14.1
   * - Syncs all changed files to sandbox within 2 seconds
   * - Emits progress events during sync
   * - Triggers hot reload or server restart as appropriate
   * 
   * @param projectId - The project ID
   * @param files - Record of file paths to content
   * @param versionId - Optional version ID for event tracking
   * @returns Sync result with success status and timing
   */
  async syncFilesWithProgress(
    projectId: string,
    files: Record<string, string>,
    versionId?: string
  ): Promise<{ success: boolean; syncedFiles: string[]; failedFiles: string[]; duration: number } | undefined> {
    const projectSandbox = this.projectSandboxes.get(projectId);
    
    if (!projectSandbox) {
      console.log(`[StreamingService] No sandbox connected for project ${projectId}`);
      return undefined;
    }

    const fileCount = Object.keys(files).length;
    const startTime = Date.now();

    // Emit sync start event
    await this.emitSandboxSyncStart(projectId, fileCount, versionId);

    // Track progress
    let syncedCount = 0;
    const syncedFiles: string[] = [];
    const failedFiles: string[] = [];

    try {
      // Sync files with progress tracking
      for (const [filePath, content] of Object.entries(files)) {
        try {
          // Emit progress event
          await this.emitSandboxSyncProgress(
            projectId,
            syncedCount,
            fileCount,
            filePath,
            versionId
          );

          // Sync individual file using sandbox manager
          const singleFileResult = await projectSandbox.sandboxManager.syncFiles(
            projectSandbox.sandboxId,
            { [filePath]: content }
          );

          if (singleFileResult.success) {
            syncedFiles.push(filePath);
          } else {
            failedFiles.push(filePath);
          }

          syncedCount++;
        } catch (error) {
          console.error(`[StreamingService] Failed to sync file ${filePath}:`, error);
          failedFiles.push(filePath);
          syncedCount++;
        }
      }

      const duration = Date.now() - startTime;
      projectSandbox.lastSyncTime = Date.now();

      // Emit completion event
      await this.emitSandboxSyncComplete(projectId, syncedFiles, failedFiles, duration, versionId);

      // Check if we met the 2-second target (Requirement 6.1)
      if (duration > 2000) {
        console.warn(`[StreamingService] File sync took ${duration}ms, exceeding 2s target`);
        await this.emit(projectId, {
          type: 'warning',
          message: `File sync took ${duration}ms (target: 2000ms)`,
          versionId,
        });
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
      await this.emitSandboxSyncError(
        projectId,
        `File sync failed: ${errorMessage}`,
        Object.keys(files),
        [
          'Try syncing fewer files at once',
          'Check if the sandbox is still running',
          'Verify network connectivity',
          'Check if the sandbox has enough disk space',
        ],
        versionId
      );

      return {
        success: false,
        syncedFiles,
        failedFiles: Object.keys(files),
        duration,
      };
    }
  }

  /**
   * Sync files and restart server with full progress tracking
   * Combines file sync with server restart for complete preview update
   * 
   * Requirements: 6.1, 6.2, 6.3
   * 
   * @param projectId - The project ID
   * @param files - Record of file paths to content
   * @param versionId - Optional version ID for event tracking
   * @returns Combined result of sync and restart
   */
  async syncAndRestartWithProgress(
    projectId: string,
    files: Record<string, string>,
    versionId?: string
  ): Promise<{
    syncResult?: { success: boolean; syncedFiles: string[]; failedFiles: string[]; duration: number };
    restartResult?: { success: boolean; duration: number; error?: string };
    previewUrl?: string;
  }> {
    const projectSandbox = this.projectSandboxes.get(projectId);
    
    if (!projectSandbox) {
      console.log(`[StreamingService] No sandbox connected for project ${projectId}`);
      return {};
    }

    // Step 1: Sync files
    const syncResult = await this.syncFilesWithProgress(projectId, files, versionId);

    if (!syncResult || !syncResult.success) {
      return { syncResult };
    }

    // Step 2: Check if restart is needed
    const requiresRestart = Object.keys(files).some(file =>
      file.endsWith('.env') ||
      file.endsWith('.env.local') ||
      file.includes('next.config') ||
      file.includes('vite.config') ||
      file.includes('package.json')
    );

    if (requiresRestart) {
      // Emit preview updating event
      await this.emitPreviewUpdating(projectId, 'Restarting server to apply configuration changes...', versionId);

      // Restart server
      const restartResult = await projectSandbox.sandboxManager.restartServer(
        projectSandbox.sandboxId,
        {
          clearCache: false,
          waitForReady: true,
          timeout: 60,
        }
      );

      // Get preview URL
      const serverStatus = await projectSandbox.sandboxManager.getServerStatus(projectSandbox.sandboxId);
      const previewUrl = serverStatus.url;

      if (previewUrl) {
        await this.emitPreviewReady(projectId, previewUrl, 'Preview updated and ready!', versionId);
      }

      return {
        syncResult,
        restartResult,
        previewUrl,
      };
    } else {
      // Hot reload should happen automatically
      await this.emit(projectId, {
        type: 'info',
        message: 'Files synced, hot reload triggered',
        versionId,
      });

      // Get preview URL
      const serverStatus = await projectSandbox.sandboxManager.getServerStatus(projectSandbox.sandboxId);
      const previewUrl = serverStatus.url;

      if (previewUrl) {
        await this.emitPreviewReady(projectId, previewUrl, 'Preview updated!', versionId);
      }

      return {
        syncResult,
        previewUrl,
      };
    }
  }

}

/**
 * Singleton instance of StreamingService
 * Export for use across the application
 */
export const streamingService = StreamingService.getInstance();
