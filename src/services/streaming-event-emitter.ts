/**
 * StreamingEventEmitter Service
 * 
 * Provides a clean API for emitting streaming events during code generation phases.
 * Wraps the StreamingService with phase-specific methods for step:start, code:chunk,
 * file:generating, file:complete, complete, and error events.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.5, 14.6
 */

import { streamingService } from './streaming-service';
import type { StreamEvent } from '../types/streaming';

/**
 * Generation phases for step:start events
 * Requirements: 14.1
 */
export type GenerationPhase = 
  | 'planning'
  | 'generating'
  | 'validating'
  | 'applying'
  | 'syncing'
  | 'restarting';

/**
 * Phase display names and messages
 */
const PHASE_MESSAGES: Record<GenerationPhase, { step: string; message: string }> = {
  planning: { step: 'Planning', message: 'Analyzing request and creating execution plan...' },
  generating: { step: 'Generating', message: 'Generating code based on plan...' },
  validating: { step: 'Validating', message: 'Validating generated code...' },
  applying: { step: 'Applying', message: 'Applying changes to files...' },
  syncing: { step: 'Syncing', message: 'Syncing files to sandbox...' },
  restarting: { step: 'Restarting', message: 'Restarting development server...' },
};

/**
 * Options for completion event
 */
export interface CompletionOptions {
  summary: string;
  totalFiles: number;
  versionId?: string;
  sandboxUrl?: string;
}

/**
 * Options for error event
 */
export interface ErrorOptions {
  message: string;
  stage?: string;
  versionId?: string;
  recoverySteps?: string[];
  errorCode?: string;
  context?: Record<string, unknown>;
}

/**
 * Common error types and their default recovery suggestions
 */
const ERROR_RECOVERY_SUGGESTIONS: Record<string, string[]> = {
  'syntax_error': [
    'Check for missing brackets, parentheses, or semicolons',
    'Verify all imports are correctly formatted',
    'Review the generated code for typos',
  ],
  'import_error': [
    'Verify the package is installed in your project',
    'Check if the import path is correct',
    'Ensure the module exports the expected symbols',
  ],
  'type_error': [
    'Check that all variables have correct types',
    'Verify function parameters match expected types',
    'Review TypeScript type definitions',
  ],
  'file_not_found': [
    'Verify the file path is correct',
    'Check if the file exists in the project',
    'Ensure the file was not deleted or moved',
  ],
  'sandbox_error': [
    'Try restarting the sandbox',
    'Check if the sandbox is running',
    'Verify network connectivity',
  ],
  'timeout': [
    'Try simplifying your request',
    'Break the task into smaller steps',
    'Check your network connection',
  ],
  'validation_failed': [
    'Review the generated code for issues',
    'Check if all required dependencies are installed',
    'Verify the code follows project conventions',
  ],
  'default': [
    'Try rephrasing your request',
    'Break down complex requests into smaller steps',
    'Check the project configuration',
  ],
};

/**
 * StreamingEventEmitter class
 * Provides methods for emitting streaming events during code generation
 */
export class StreamingEventEmitter {
  private projectId: string;
  private versionId?: string;
  private currentPhase?: GenerationPhase;
  private fileProgress: Map<string, number> = new Map();

  constructor(projectId: string, versionId?: string) {
    this.projectId = projectId;
    this.versionId = versionId;
  }

  /**
   * Set the current version ID for all subsequent events
   */
  setVersionId(versionId: string): void {
    this.versionId = versionId;
  }

  /**
   * Emit step:start event for a generation phase
   * 
   * Requirements: 14.1
   * WHEN code generation starts THEN the system SHALL emit step:start events 
   * for each phase (Planning, Generating, Validating, Applying)
   * 
   * @param phase - The generation phase starting
   */
  async emitPhaseStart(phase: GenerationPhase): Promise<void> {
    this.currentPhase = phase;
    const { step, message } = PHASE_MESSAGES[phase];
    
    const event: StreamEvent = {
      type: 'step:start',
      step,
      message,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Phase started: ${phase}`);
  }

  /**
   * Emit step:complete event for a generation phase
   * 
   * @param phase - The generation phase that completed
   * @param message - Optional custom completion message
   */
  async emitPhaseComplete(phase: GenerationPhase, message?: string): Promise<void> {
    const { step } = PHASE_MESSAGES[phase];
    
    const event: StreamEvent = {
      type: 'step:complete',
      step,
      message: message || `${step} complete`,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Phase completed: ${phase}`);
  }

  /**
   * Emit file:generating event when starting to generate a file
   * 
   * Requirements: 14.3
   * WHEN files are being processed THEN the system SHALL emit 
   * file:generating and file:complete events
   * 
   * @param filename - The name of the file being generated
   * @param path - The full path of the file
   */
  async emitFileGenerating(filename: string, path: string): Promise<void> {
    this.fileProgress.set(path, 0);
    
    const event: StreamEvent = {
      type: 'file:generating',
      filename,
      path,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] File generating: ${path}`);
  }

  /**
   * Emit code:chunk event with progress percentage
   * 
   * Requirements: 14.2
   * WHEN generating code THEN the system SHALL emit code:chunk events 
   * with progress percentage
   * 
   * @param filename - The name of the file being generated
   * @param chunk - The code chunk being generated
   * @param progress - Progress percentage (0-100)
   */
  async emitCodeChunk(filename: string, chunk: string, progress: number): Promise<void> {
    // Clamp progress to 0-100
    const clampedProgress = Math.max(0, Math.min(100, progress));
    
    const event: StreamEvent = {
      type: 'code:chunk',
      filename,
      chunk,
      progress: clampedProgress,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
  }

  /**
   * Emit file:complete event when a file is fully generated
   * 
   * Requirements: 14.3
   * 
   * @param filename - The name of the completed file
   * @param content - The full content of the file
   * @param path - The full path of the file
   */
  async emitFileComplete(filename: string, content: string, path: string): Promise<void> {
    this.fileProgress.set(path, 100);
    
    const event: StreamEvent = {
      type: 'file:complete',
      filename,
      content,
      path,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] File complete: ${path}`);
  }

  /**
   * Emit validation:start event
   * 
   * @param stage - The validation stage starting
   */
  async emitValidationStart(stage: string): Promise<void> {
    const event: StreamEvent = {
      type: 'validation:start',
      stage,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Validation started: ${stage}`);
  }

  /**
   * Emit validation:complete event
   * 
   * @param stage - The validation stage that completed
   * @param result - Whether validation passed
   * @param summary - Summary of validation results
   */
  async emitValidationComplete(
    stage: string, 
    result: boolean, 
    summary?: string
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'validation:complete',
      stage,
      result,
      summary,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Validation complete: ${stage} - ${result ? 'passed' : 'failed'}`);
  }

  /**
   * Emit info event for validation fixes or other informational messages
   * 
   * Requirements: 14.4
   * WHEN validation fixes are applied THEN the system SHALL emit 
   * info events describing each fix
   * 
   * @param message - The informational message
   */
  async emitInfo(message: string): Promise<void> {
    const event: StreamEvent = {
      type: 'info',
      message,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Info: ${message}`);
  }

  /**
   * Emit warning event
   * 
   * @param message - The warning message
   */
  async emitWarning(message: string): Promise<void> {
    const event: StreamEvent = {
      type: 'warning',
      message,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Warning: ${message}`);
  }

  /**
   * Emit complete event when generation is finished
   * 
   * Requirements: 14.5
   * WHEN the process completes THEN the system SHALL emit complete event 
   * with summary and version ID
   * 
   * @param options - Completion options including summary and file count
   */
  async emitComplete(options: CompletionOptions): Promise<void> {
    const event: StreamEvent = {
      type: 'complete',
      summary: options.summary,
      totalFiles: options.totalFiles,
      versionId: options.versionId || this.versionId,
      sandboxUrl: options.sandboxUrl,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Complete: ${options.summary}`);
  }

  /**
   * Emit error event with detailed message and recovery suggestions
   * 
   * Requirements: 14.6
   * IF any error occurs THEN the system SHALL emit error event with 
   * detailed message and recovery suggestions
   * 
   * @param options - Error options including message and recovery steps
   */
  async emitError(options: ErrorOptions): Promise<void> {
    // Get recovery suggestions - use provided ones or infer from error code/message
    let recoverySteps = options.recoverySteps;
    
    if (!recoverySteps || recoverySteps.length === 0) {
      // Try to infer recovery steps from error code or message
      recoverySteps = this.inferRecoverySteps(options.errorCode, options.message);
    }

    // Build detailed error message with recovery suggestions
    let detailedMessage = options.message;
    
    if (recoverySteps.length > 0) {
      detailedMessage += '\n\nSuggested recovery steps:\n';
      detailedMessage += recoverySteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
    }

    const event: StreamEvent = {
      type: 'error',
      message: detailedMessage,
      stage: options.stage || this.currentPhase,
      versionId: options.versionId || this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Error: ${options.message}`);
  }

  /**
   * Infer recovery steps from error code or message
   * 
   * @param errorCode - Optional error code
   * @param message - Error message
   * @returns Array of recovery suggestions
   */
  private inferRecoverySteps(errorCode?: string, message?: string): string[] {
    // First try error code
    if (errorCode && ERROR_RECOVERY_SUGGESTIONS[errorCode]) {
      return ERROR_RECOVERY_SUGGESTIONS[errorCode];
    }

    // Try to infer from message content
    const lowerMessage = (message || '').toLowerCase();
    
    if (lowerMessage.includes('syntax') || lowerMessage.includes('parse')) {
      return ERROR_RECOVERY_SUGGESTIONS['syntax_error'];
    }
    if (lowerMessage.includes('import') || lowerMessage.includes('module')) {
      return ERROR_RECOVERY_SUGGESTIONS['import_error'];
    }
    if (lowerMessage.includes('type') || lowerMessage.includes('typescript')) {
      return ERROR_RECOVERY_SUGGESTIONS['type_error'];
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('missing file')) {
      return ERROR_RECOVERY_SUGGESTIONS['file_not_found'];
    }
    if (lowerMessage.includes('sandbox') || lowerMessage.includes('container')) {
      return ERROR_RECOVERY_SUGGESTIONS['sandbox_error'];
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return ERROR_RECOVERY_SUGGESTIONS['timeout'];
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return ERROR_RECOVERY_SUGGESTIONS['validation_failed'];
    }

    // Return default suggestions
    return ERROR_RECOVERY_SUGGESTIONS['default'];
  }

  /**
   * Emit server:restarting event
   * 
   * @param message - The restart message
   */
  async emitServerRestarting(message: string): Promise<void> {
    const event: StreamEvent = {
      type: 'server:restarting',
      message,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Server restarting: ${message}`);
  }

  /**
   * Emit server:ready event
   * 
   * @param message - The ready message
   * @param previewUrl - Optional preview URL
   */
  async emitServerReady(message: string, previewUrl?: string): Promise<void> {
    const event: StreamEvent = {
      type: 'server:ready',
      message,
      previewUrl,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
    console.log(`[StreamingEventEmitter] Server ready: ${message}`);
  }

  /**
   * Emit step:progress event for incremental progress updates
   * 
   * @param step - The current step name
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  async emitStepProgress(step: string, progress: number, message?: string): Promise<void> {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    
    const event: StreamEvent = {
      type: 'step:progress',
      step,
      progress: clampedProgress,
      message,
      versionId: this.versionId,
    };

    await streamingService.emit(this.projectId, event);
  }

  // Sandbox sync event methods
  // Requirements: 6.1, 6.3, 6.4

  /**
   * Emit sandbox sync start event
   * 
   * Requirements: 6.1, 14.1
   * 
   * @param fileCount - Number of files to sync
   */
  async emitSandboxSyncStart(fileCount: number): Promise<void> {
    await streamingService.emitSandboxSyncStart(this.projectId, fileCount, this.versionId);
    console.log(`[StreamingEventEmitter] Sandbox sync started: ${fileCount} files`);
  }

  /**
   * Emit sandbox sync progress event
   * 
   * Requirements: 6.1
   * 
   * @param syncedCount - Number of files synced so far
   * @param totalCount - Total number of files to sync
   * @param currentFile - Current file being synced
   */
  async emitSandboxSyncProgress(syncedCount: number, totalCount: number, currentFile: string): Promise<void> {
    await streamingService.emitSandboxSyncProgress(
      this.projectId,
      syncedCount,
      totalCount,
      currentFile,
      this.versionId
    );
  }

  /**
   * Emit sandbox sync complete event
   * 
   * Requirements: 6.1
   * 
   * @param syncedFiles - List of successfully synced files
   * @param failedFiles - List of files that failed to sync
   * @param duration - Time taken for sync in milliseconds
   */
  async emitSandboxSyncComplete(syncedFiles: string[], failedFiles: string[], duration: number): Promise<void> {
    await streamingService.emitSandboxSyncComplete(
      this.projectId,
      syncedFiles,
      failedFiles,
      duration,
      this.versionId
    );
    console.log(`[StreamingEventEmitter] Sandbox sync complete: ${syncedFiles.length} synced, ${failedFiles.length} failed, ${duration}ms`);
  }

  /**
   * Emit sandbox sync error event with recovery suggestions
   * 
   * Requirements: 6.4
   * 
   * @param message - Error message
   * @param failedFiles - List of files that failed to sync
   * @param recoverySuggestions - List of recovery suggestions
   */
  async emitSandboxSyncError(message: string, failedFiles: string[], recoverySuggestions: string[]): Promise<void> {
    await streamingService.emitSandboxSyncError(
      this.projectId,
      message,
      failedFiles,
      recoverySuggestions,
      this.versionId
    );
    console.log(`[StreamingEventEmitter] Sandbox sync error: ${message}`);
  }

  /**
   * Emit preview updating event
   * 
   * Requirements: 6.3
   * 
   * @param message - Update message
   */
  async emitPreviewUpdating(message: string): Promise<void> {
    await streamingService.emitPreviewUpdating(this.projectId, message, this.versionId);
    console.log(`[StreamingEventEmitter] Preview updating: ${message}`);
  }

  /**
   * Emit preview ready event
   * 
   * Requirements: 6.3
   * 
   * @param previewUrl - The preview URL
   * @param message - Ready message
   */
  async emitPreviewReady(previewUrl: string, message: string): Promise<void> {
    await streamingService.emitPreviewReady(this.projectId, previewUrl, message, this.versionId);
    console.log(`[StreamingEventEmitter] Preview ready: ${previewUrl}`);
  }

  /**
   * Sync files to sandbox with progress events
   * Convenience method that wraps streamingService.syncFilesWithProgress
   * 
   * Requirements: 6.1, 6.2
   * 
   * @param files - Record of file paths to content
   * @returns Sync result
   */
  async syncFilesToSandbox(files: Record<string, string>): Promise<{
    success: boolean;
    syncedFiles: string[];
    failedFiles: string[];
    duration: number;
  } | undefined> {
    return streamingService.syncFilesWithProgress(this.projectId, files, this.versionId);
  }

  /**
   * Sync files and restart server with full progress tracking
   * Convenience method that wraps streamingService.syncAndRestartWithProgress
   * 
   * Requirements: 6.1, 6.2, 6.3
   * 
   * @param files - Record of file paths to content
   * @returns Combined result of sync and restart
   */
  async syncAndRestartSandbox(files: Record<string, string>): Promise<{
    syncResult?: { success: boolean; syncedFiles: string[]; failedFiles: string[]; duration: number };
    restartResult?: { success: boolean; duration: number; error?: string };
    previewUrl?: string;
  }> {
    return streamingService.syncAndRestartWithProgress(this.projectId, files, this.versionId);
  }

  /**
   * Get the current phase
   */
  getCurrentPhase(): GenerationPhase | undefined {
    return this.currentPhase;
  }

  /**
   * Get file progress for a specific file
   */
  getFileProgress(path: string): number {
    return this.fileProgress.get(path) || 0;
  }

  /**
   * Calculate overall progress based on completed files
   * 
   * @param totalFiles - Total number of files to generate
   * @returns Progress percentage (0-100)
   */
  calculateOverallProgress(totalFiles: number): number {
    if (totalFiles === 0) return 100;
    
    let totalProgress = 0;
    this.fileProgress.forEach(progress => {
      totalProgress += progress;
    });
    
    return Math.round(totalProgress / totalFiles);
  }
}

/**
 * Factory function to create a StreamingEventEmitter
 * 
 * @param projectId - The project ID to emit events for
 * @param versionId - Optional version ID
 * @returns StreamingEventEmitter instance
 */
export function createStreamingEventEmitter(
  projectId: string, 
  versionId?: string
): StreamingEventEmitter {
  return new StreamingEventEmitter(projectId, versionId);
}
