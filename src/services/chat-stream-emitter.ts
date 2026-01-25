/**
 * Chat Stream Emitter Service
 * 
 * Provides immediate event emission for chat streaming with timing guarantees.
 * 
 * Requirements: 2.1, 2.3, 2.4
 * - Emit thinking indicator within 50ms of request
 * - Emit context:building events within 100ms
 * - Stream first token within 500ms
 */

import type {
  ChatStreamEvent,
  ContextSource,
  ChatMode,
} from '../types/chat-ux';

// Timing constants (in milliseconds)
export const TIMING_CONSTANTS = {
  THINKING_INDICATOR_MAX_MS: 50,
  CONTEXT_BUILDING_MAX_MS: 100,
  FIRST_TOKEN_MAX_MS: 500,
  MIN_EVENT_INTERVAL_MS: 50,
} as const;

/**
 * Event emitter callback type
 */
export type EventEmitterCallback = (event: ChatStreamEvent) => void;

/**
 * Timing metrics for tracking performance
 */
export interface TimingMetrics {
  requestStartTime: number;
  thinkingEmittedAt?: number;
  contextBuildingEmittedAt?: number;
  firstTokenEmittedAt?: number;
  lastEventTime: number;
}

/**
 * Chat Stream Emitter class
 * Handles immediate event emission with timing tracking
 */
export class ChatStreamEmitter {
  private callback: EventEmitterCallback;
  private metrics: TimingMetrics;
  private eventCount: number = 0;

  constructor(callback: EventEmitterCallback, requestStartTime: number = performance.now()) {
    this.callback = callback;
    this.metrics = {
      requestStartTime,
      lastEventTime: requestStartTime,
    };
  }

  /**
   * Creates a timestamp for events
   */
  private createTimestamp(): number {
    return Date.now();
  }


  /**
   * Emits an event immediately without interval check
   * Used for critical timing events like thinking indicator
   */
  emitImmediate(event: ChatStreamEvent): void {
    this.callback(event);
    this.metrics.lastEventTime = performance.now();
    this.eventCount++;
  }

  /**
   * Emits an event respecting minimum interval between events
   * Returns a promise that resolves after the event is emitted
   */
  async emit(event: ChatStreamEvent): Promise<void> {
    const now = performance.now();
    const elapsed = now - this.metrics.lastEventTime;

    // Ensure minimum interval between events (50ms)
    if (elapsed < TIMING_CONSTANTS.MIN_EVENT_INTERVAL_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, TIMING_CONSTANTS.MIN_EVENT_INTERVAL_MS - elapsed)
      );
    }

    this.callback(event);
    this.metrics.lastEventTime = performance.now();
    this.eventCount++;
  }

  /**
   * Emits thinking indicator event
   * REQUIREMENT 2.1: Must be emitted within 50ms of request
   */
  emitThinking(message: string = 'Processing your request...'): void {
    const event: ChatStreamEvent = {
      type: 'thinking',
      message,
      timestamp: this.createTimestamp(),
    };
    
    this.emitImmediate(event);
    this.metrics.thinkingEmittedAt = performance.now();
    
    const elapsed = this.metrics.thinkingEmittedAt - this.metrics.requestStartTime;
    console.log(`[ChatStreamEmitter] Thinking indicator emitted at ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Emits context building event
   * REQUIREMENT 2.3: Must be emitted within 100ms of request
   */
  emitContextBuilding(
    stage: 'working_memory' | 'long_term_memory' | 'rag_retrieval',
    progress: number
  ): void {
    const event: ChatStreamEvent = {
      type: 'context:building',
      stage,
      progress: Math.max(0, Math.min(100, progress)),
      timestamp: this.createTimestamp(),
    };

    this.emitImmediate(event);
    
    if (!this.metrics.contextBuildingEmittedAt) {
      this.metrics.contextBuildingEmittedAt = performance.now();
      const elapsed = this.metrics.contextBuildingEmittedAt - this.metrics.requestStartTime;
      console.log(`[ChatStreamEmitter] Context building emitted at ${elapsed.toFixed(2)}ms`);
    }
  }

  /**
   * Emits context retrieved event
   */
  async emitContextRetrieved(
    sources: ContextSource[],
    truncated: boolean,
    tokenCount: number
  ): Promise<void> {
    await this.emit({
      type: 'context:retrieved',
      sources,
      truncated,
      tokenCount,
      timestamp: this.createTimestamp(),
    });
  }

  /**
   * Emits file reading event
   */
  async emitFileReading(filePath: string): Promise<void> {
    await this.emit({
      type: 'file:reading',
      filePath,
      timestamp: this.createTimestamp(),
    });
  }

  /**
   * Emits file read complete event
   */
  async emitFileReadComplete(fileCount: number, filePaths: string[]): Promise<void> {
    await this.emit({
      type: 'file:read:complete',
      fileCount,
      filePaths,
      timestamp: this.createTimestamp(),
    });
  }

  /**
   * Emits text chunk event (for Ask mode)
   * REQUIREMENT 2.4: First token must be within 500ms
   */
  async emitTextChunk(content: string): Promise<void> {
    const event: ChatStreamEvent = {
      type: 'text:chunk',
      content,
      timestamp: this.createTimestamp(),
    };

    await this.emit(event);

    if (!this.metrics.firstTokenEmittedAt) {
      this.metrics.firstTokenEmittedAt = performance.now();
      const elapsed = this.metrics.firstTokenEmittedAt - this.metrics.requestStartTime;
      console.log(`[ChatStreamEmitter] First token emitted at ${elapsed.toFixed(2)}ms`);
    }
  }

  /**
   * Emits message saved event
   */
  async emitMessageSaved(messageId: string): Promise<void> {
    await this.emit({
      type: 'message:saved',
      messageId,
      timestamp: this.createTimestamp(),
    });
  }

  /**
   * Gets timing metrics for testing and monitoring
   */
  getMetrics(): TimingMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets the number of events emitted
   */
  getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Validates timing requirements
   * Returns an object with validation results
   */
  validateTiming(): {
    thinkingWithin50ms: boolean;
    contextBuildingWithin100ms: boolean;
    firstTokenWithin500ms: boolean;
  } {
    const { requestStartTime, thinkingEmittedAt, contextBuildingEmittedAt, firstTokenEmittedAt } = this.metrics;

    return {
      thinkingWithin50ms: thinkingEmittedAt !== undefined
        ? (thinkingEmittedAt - requestStartTime) <= TIMING_CONSTANTS.THINKING_INDICATOR_MAX_MS
        : false,
      contextBuildingWithin100ms: contextBuildingEmittedAt !== undefined
        ? (contextBuildingEmittedAt - requestStartTime) <= TIMING_CONSTANTS.CONTEXT_BUILDING_MAX_MS
        : false,
      firstTokenWithin500ms: firstTokenEmittedAt !== undefined
        ? (firstTokenEmittedAt - requestStartTime) <= TIMING_CONSTANTS.FIRST_TOKEN_MAX_MS
        : false,
    };
  }
}

/**
 * Factory function to create a ChatStreamEmitter
 */
export function createChatStreamEmitter(
  callback: EventEmitterCallback,
  requestStartTime?: number
): ChatStreamEmitter {
  return new ChatStreamEmitter(callback, requestStartTime);
}
