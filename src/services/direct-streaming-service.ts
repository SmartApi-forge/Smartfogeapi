/**
 * Direct Streaming Service
 * 
 * Implements direct UI streaming with concurrent DB storage.
 * Streams tokens to UI immediately while buffering for async DB save.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * - 7.1: Stream tokens directly to UI without waiting for DB
 * - 7.2: Buffer tokens for DB save without blocking UI
 * - 7.3: Emit SSE events immediately as tokens arrive
 * - 7.4: Save to DB asynchronously on completion
 * 
 * **Feature: ui-quality-chat-polish, Property 18: Non-Blocking DB Save**
 * **Validates: Requirements 7.2, 7.4**
 */

import { conversationContextService } from './conversation-context-service';
import { parseCodeBlocks } from './code-block-parser';
import { mergeSnapshots } from './snapshot-merger';
import type { FileSnapshotData, FileChange } from '../types/database';

/**
 * SSE Event types for direct streaming
 */
export interface DirectStreamEvent {
  type:
    | 'thinking'           // Initial thinking indicator
    | 'status'             // Status updates
    | 'progress'           // Progress step (with text shimmer)
    | 'chunk'              // Token/content chunk
    | 'file:start'         // File generation started
    | 'file:complete'      // File generation complete
    | 'complete'           // Generation complete
    | 'error';             // Error occurred
  message?: string;
  content?: string;
  filename?: string;
  filesModified?: string[];
  turnIndex?: number;
  timestamp: number;
  // Progress-specific fields
  step?: string;
  stepIndex?: number;
  totalSteps?: number;
}

/**
 * Token buffer for accumulating content before DB save
 */
interface TokenBuffer {
  content: string;
  startTime: number;
  lastTokenTime: number;
  tokenCount: number;
}

/**
 * DB save result
 */
export interface DBSaveResult {
  success: boolean;
  turnIndex?: number;
  error?: string;
  duration?: number;
}

/**
 * Creates a direct streaming event with timestamp
 */
export function createStreamEvent(
  type: DirectStreamEvent['type'],
  data: Partial<Omit<DirectStreamEvent, 'type' | 'timestamp'>> = {}
): DirectStreamEvent {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  };
}

/**
 * Encodes an event as SSE data format
 */
export function encodeSSE(event: DirectStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Direct Streaming Service class
 * Manages streaming to UI and async DB saves
 */
export class DirectStreamingService {
  private buffer: TokenBuffer;
  private pendingDBSave: Promise<DBSaveResult> | null = null;
  private projectId: string;
  private userMessage: string;

  constructor(projectId: string, userMessage: string) {
    this.projectId = projectId;
    this.userMessage = userMessage;
    this.buffer = {
      content: '',
      startTime: Date.now(),
      lastTokenTime: Date.now(),
      tokenCount: 0,
    };
  }

  /**
   * Add token to buffer (non-blocking)
   * Requirements: 7.2 - Buffer tokens without blocking UI
   */
  addToken(token: string): void {
    this.buffer.content += token;
    this.buffer.lastTokenTime = Date.now();
    this.buffer.tokenCount++;
  }

  /**
   * Get current buffered content
   */
  getBufferedContent(): string {
    return this.buffer.content;
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): { tokenCount: number; duration: number } {
    return {
      tokenCount: this.buffer.tokenCount,
      duration: Date.now() - this.buffer.startTime,
    };
  }

  /**
   * Save to DB asynchronously (non-blocking)
   * Requirements: 7.4 - Save to DB asynchronously on completion
   * 
   * This method starts the DB save but doesn't wait for it.
   * The UI stream can continue/complete while DB save happens in background.
   */
  async saveToDBAsync(
    existingSnapshot: FileSnapshotData | null,
    model: string = 'gpt-4o'
  ): Promise<DBSaveResult> {
    const startTime = Date.now();
    
    try {
      // Parse code blocks from accumulated content
      const parsedFiles = parseCodeBlocks(this.buffer.content);
      
      // Get next turn index
      const messages = await conversationContextService.loadMessages(this.projectId);
      const nextTurnIndex = messages.length > 0 
        ? Math.max(...messages.map(m => m.turn_index)) + 1 
        : 1;

      // Save user message and assistant response
      await conversationContextService.saveMessage({
        project_id: this.projectId,
        turn_index: nextTurnIndex,
        user_message: this.userMessage,
        assistant_response: this.buffer.content,
        model,
      });

      // Merge with existing snapshot if we have parsed files
      if (parsedFiles.length > 0) {
        const newFilesData: FileSnapshotData = {};
        parsedFiles.forEach(file => {
          newFilesData[file.path] = {
            content: file.content,
            language: file.language,
            size: file.content.length,
          };
        });

        const mergedSnapshot = existingSnapshot 
          ? mergeSnapshots(existingSnapshot, newFilesData)
          : newFilesData;

        // Save new snapshot
        const fileCount = Object.keys(mergedSnapshot).length;
        const totalSize = Object.values(mergedSnapshot).reduce(
          (sum, f) => sum + f.size, 
          0
        );

        await conversationContextService.saveSnapshot({
          project_id: this.projectId,
          turn_index: nextTurnIndex,
          files_jsonb: mergedSnapshot,
          file_count: fileCount,
          total_size_bytes: totalSize,
        });

        // Save file changes
        const changes: FileChange[] = parsedFiles.map(file => ({
          file: file.path,
          action: existingSnapshot?.[file.path] ? 'modify' : 'create',
          reason: `Generated from prompt: ${this.userMessage.substring(0, 50)}...`,
        }));

        await conversationContextService.saveChanges({
          project_id: this.projectId,
          turn_index: nextTurnIndex,
          changes,
          execution_status: 'success',
        });
      }

      return {
        success: true,
        turnIndex: nextTurnIndex,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DirectStreamingService] DB save error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Start async DB save (fire and forget)
   * Returns immediately, DB save happens in background
   */
  startAsyncDBSave(
    existingSnapshot: FileSnapshotData | null,
    model: string = 'gpt-4o'
  ): void {
    // Don't await - let it run in background
    this.pendingDBSave = this.saveToDBAsync(existingSnapshot, model);
    
    // Log when complete (but don't block)
    this.pendingDBSave.then(result => {
      if (result.success) {
        console.log(`[DirectStreamingService] DB save completed in ${result.duration}ms`);
      } else {
        console.error(`[DirectStreamingService] DB save failed: ${result.error}`);
      }
    });
  }

  /**
   * Wait for pending DB save to complete (if needed)
   */
  async waitForDBSave(): Promise<DBSaveResult | null> {
    if (this.pendingDBSave) {
      return await this.pendingDBSave;
    }
    return null;
  }

  /**
   * Reset the buffer for a new generation
   */
  reset(): void {
    this.buffer = {
      content: '',
      startTime: Date.now(),
      lastTokenTime: Date.now(),
      tokenCount: 0,
    };
    this.pendingDBSave = null;
  }
}

/**
 * Create a new DirectStreamingService instance
 */
export function createDirectStreamingService(
  projectId: string,
  userMessage: string
): DirectStreamingService {
  return new DirectStreamingService(projectId, userMessage);
}

/**
 * Progress step definitions for generation
 * Used for step-by-step progress messages with text shimmer
 */
export const GENERATION_STEPS = [
  { id: 'thinking', label: 'Thinking...' },
  { id: 'planning', label: 'Planning structure...' },
  { id: 'generating', label: 'Generating code...' },
  { id: 'writing', label: 'Writing files...' },
  { id: 'complete', label: 'Complete!' },
] as const;

export type GenerationStepId = typeof GENERATION_STEPS[number]['id'];

/**
 * Create a progress event for a generation step
 */
export function createProgressEvent(
  stepId: GenerationStepId,
  stepIndex: number,
  message?: string
): DirectStreamEvent {
  const step = GENERATION_STEPS.find(s => s.id === stepId);
  return createStreamEvent('progress', {
    step: stepId,
    stepIndex,
    totalSteps: GENERATION_STEPS.length,
    message: message || step?.label || stepId,
  });
}
