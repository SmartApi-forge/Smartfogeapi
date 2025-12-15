/**
 * Message Persistence Service
 * 
 * Handles database persistence for chat messages after streaming completes.
 * 
 * Requirements: 8.1, 8.2, 8.5, 8.6
 * - Save complete response only after streaming completes (8.1)
 * - Include all metadata (mode, attachments, context sources) (8.2)
 * - Retry up to 3 times with exponential backoff (8.5)
 * - Emit message:saved event on success (8.6)
 */

import { supabaseServer } from '../../lib/supabase-server';
import type {
  ChatMessage,
  ChatMode,
  Attachment,
  ContextSource,
  FileReadingEvent,
  ChatStreamEvent,
} from '../types/chat-ux';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum retry attempts for save operations
 * Requirement 8.5: Retry up to 3 times
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
export const BASE_RETRY_DELAY_MS = 1000;

/**
 * Maximum delay between retries (in milliseconds)
 */
export const MAX_RETRY_DELAY_MS = 10000;

// ============================================================================
// Types
// ============================================================================

/**
 * Input for saving a message after streaming completes
 */
export interface SaveMessageInput {
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  mode: ChatMode;
  attachments?: Attachment[];
  contextSources?: ContextSource[];
  fileReadingEvents?: FileReadingEvent[];
  senderId?: string;
  receiverId?: string;
}

/**
 * Result of a save operation
 */
export interface SaveMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount: number;
}

/**
 * Queued message for later retry
 */
export interface QueuedMessage {
  input: SaveMessageInput;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

/**
 * Persistence state for tracking streaming status
 */
export interface PersistenceState {
  isStreaming: boolean;
  streamStartTime?: number;
  streamEndTime?: number;
  pendingContent: string;
}

// ============================================================================
// Message Persistence Service
// ============================================================================

/**
 * Service for persisting chat messages to the database
 * Handles post-streaming persistence with retry logic
 */
export class MessagePersistenceService {
  private failedQueue: QueuedMessage[] = [];
  private persistenceStates: Map<string, PersistenceState> = new Map();
  private eventCallback?: (event: ChatStreamEvent) => void;

  constructor(eventCallback?: (event: ChatStreamEvent) => void) {
    this.eventCallback = eventCallback;
  }

  /**
   * Sets the event callback for emitting message:saved events
   */
  setEventCallback(callback: (event: ChatStreamEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Marks streaming as started for a project
   * Requirement 8.4: Do not save partial responses during streaming
   */
  startStreaming(projectId: string): void {
    this.persistenceStates.set(projectId, {
      isStreaming: true,
      streamStartTime: Date.now(),
      pendingContent: '',
    });
  }

  /**
   * Marks streaming as complete for a project
   */
  endStreaming(projectId: string): void {
    const state = this.persistenceStates.get(projectId);
    if (state) {
      state.isStreaming = false;
      state.streamEndTime = Date.now();
    }
  }

  /**
   * Checks if streaming is in progress for a project
   */
  isStreaming(projectId: string): boolean {
    return this.persistenceStates.get(projectId)?.isStreaming ?? false;
  }

  /**
   * Accumulates content during streaming (for tracking, not saving)
   */
  accumulateContent(projectId: string, content: string): void {
    const state = this.persistenceStates.get(projectId);
    if (state) {
      state.pendingContent += content;
    }
  }

  /**
   * Saves a message to the database after streaming completes
   * Requirement 8.1: Save complete response only after streaming completes
   * Requirement 8.2: Include all metadata
   * Requirement 8.5: Retry with exponential backoff
   * Requirement 8.6: Emit message:saved event on success
   */
  async saveMessage(input: SaveMessageInput): Promise<SaveMessageResult> {
    // Check if streaming is still in progress
    if (this.isStreaming(input.projectId)) {
      console.warn('[MessagePersistence] Attempted to save while streaming is in progress');
      return {
        success: false,
        error: 'Cannot save while streaming is in progress',
        retryCount: 0,
      };
    }

    let lastError: string | undefined;
    let retryCount = 0;

    // Retry loop with exponential backoff
    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
        const result = await this.attemptSave(input);
        
        // Emit message:saved event on success
        if (result.success && result.messageId && this.eventCallback) {
          this.eventCallback({
            type: 'message:saved',
            messageId: result.messageId,
            timestamp: Date.now(),
          });
        }

        return { ...result, retryCount };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retryCount++;

        if (retryCount < MAX_RETRY_ATTEMPTS) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1),
            MAX_RETRY_DELAY_MS
          );
          console.log(`[MessagePersistence] Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} after ${delay}ms`);
          await this.delay(delay);
        }
      }
    }

    // All retries failed - queue for later
    console.error(`[MessagePersistence] All ${MAX_RETRY_ATTEMPTS} retries failed, queuing for later`);
    this.queueForLater(input, lastError);

    return {
      success: false,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Attempts to save a message to the database
   */
  private async attemptSave(input: SaveMessageInput): Promise<SaveMessageResult> {
    const { data, error } = await supabaseServer
      .from('messages')
      .insert({
        project_id: input.projectId,
        role: input.role,
        content: input.content,
        type: 'text',
        mode: input.mode,
        context_sources: input.contextSources || [],
        file_reading_events: input.fileReadingEvents || [],
        sender_id: input.senderId,
        receiver_id: input.receiverId,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Save attachments if present
    if (input.attachments && input.attachments.length > 0) {
      await this.saveAttachments(data.id, input.projectId, input.attachments);
    }

    return {
      success: true,
      messageId: data.id,
      retryCount: 0,
    };
  }

  /**
   * Saves attachments for a message
   */
  private async saveAttachments(
    messageId: string,
    projectId: string,
    attachments: Attachment[]
  ): Promise<void> {
    const attachmentRows = attachments.map((attachment) => ({
      message_id: messageId,
      project_id: projectId,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      storage_path: attachment.storagePath,
      thumbnail_path: attachment.thumbnailUrl || null,
      content_hash: attachment.contentHash || null,
    }));

    const { error } = await supabaseServer
      .from('message_attachments')
      .insert(attachmentRows);

    if (error) {
      console.error('[MessagePersistence] Error saving attachments:', error);
      // Don't throw - message was saved successfully, attachments are secondary
    }
  }

  /**
   * Queues a failed message for later retry
   * Requirement 8.5: Queue for later if all retries fail
   */
  private queueForLater(input: SaveMessageInput, lastError?: string): void {
    this.failedQueue.push({
      input,
      queuedAt: Date.now(),
      attempts: MAX_RETRY_ATTEMPTS,
      lastError,
    });
  }

  /**
   * Gets the failed message queue
   */
  getFailedQueue(): QueuedMessage[] {
    return [...this.failedQueue];
  }

  /**
   * Retries all queued messages
   */
  async retryQueuedMessages(): Promise<{ succeeded: number; failed: number }> {
    const queue = [...this.failedQueue];
    this.failedQueue = [];

    let succeeded = 0;
    let failed = 0;

    for (const item of queue) {
      const result = await this.saveMessage(item.input);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { succeeded, failed };
  }

  /**
   * Clears the persistence state for a project
   */
  clearState(projectId: string): void {
    this.persistenceStates.delete(projectId);
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Conversation History Loading
// ============================================================================

/**
 * Loads conversation history for a project
 * Requirement 8.3: Load saved conversation on page reload
 */
export async function loadConversationHistory(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<ChatMessage[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data: messages, error } = await supabaseServer
    .from('messages')
    .select(`
      id,
      project_id,
      role,
      content,
      mode,
      context_sources,
      file_reading_events,
      created_at
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[MessagePersistence] Error loading conversation history:', error);
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  // Load attachments for each message
  const messageIds = messages.map((m) => m.id);
  const { data: attachments } = await supabaseServer
    .from('message_attachments')
    .select('*')
    .in('message_id', messageIds);

  // Map attachments to messages
  const attachmentsByMessage = new Map<string, Attachment[]>();
  if (attachments) {
    for (const att of attachments) {
      const list = attachmentsByMessage.get(att.message_id) || [];
      list.push({
        id: att.id,
        name: att.name,
        type: att.type as Attachment['type'],
        size: att.size,
        url: att.storage_path, // URL would be constructed from storage_path
        storagePath: att.storage_path,
        thumbnailUrl: att.thumbnail_path || undefined,
        contentHash: att.content_hash || undefined,
        createdAt: new Date(att.created_at),
      });
      attachmentsByMessage.set(att.message_id, list);
    }
  }

  // Transform to ChatMessage format
  return messages.map((msg) => ({
    id: msg.id,
    projectId: msg.project_id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    mode: (msg.mode || 'code') as ChatMode,
    attachments: attachmentsByMessage.get(msg.id) || [],
    contextSources: (msg.context_sources || []) as ContextSource[],
    fileReadingEvents: (msg.file_reading_events || []) as FileReadingEvent[],
    createdAt: new Date(msg.created_at),
  }));
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new MessagePersistenceService instance
 */
export function createMessagePersistenceService(
  eventCallback?: (event: ChatStreamEvent) => void
): MessagePersistenceService {
  return new MessagePersistenceService(eventCallback);
}
