/**
 * Token Buffer Service
 * 
 * Buffers tokens for smooth 50ms batch display during streaming.
 * Handles streaming interruption gracefully.
 * 
 * Requirements: 7.5
 * WHILE streaming THEN the system SHALL buffer tokens for smooth display (50ms batches)
 */

import type { TokenBuffer as ITokenBuffer } from '../types/chat-ux';

// Default flush interval in milliseconds
export const DEFAULT_FLUSH_INTERVAL_MS = 50;

// Maximum buffer size before forced flush
export const MAX_BUFFER_SIZE = 500;

/**
 * Token buffer state
 */
export interface TokenBufferState {
  buffer: string;
  lastFlushTime: number;
  flushInterval: number;
  isInterrupted: boolean;
  totalTokensReceived: number;
  totalFlushes: number;
}

/**
 * Callback type for flush events
 */
export type FlushCallback = (content: string) => void;

/**
 * TokenBuffer class
 * Buffers tokens and flushes them at regular intervals for smooth display
 */
export class TokenBuffer implements ITokenBuffer {
  private buffer: string = '';
  private flushInterval: number = DEFAULT_FLUSH_INTERVAL_MS;
  private lastFlushTime: number = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushCallback: FlushCallback | null = null;
  private isInterrupted: boolean = false;
  private totalTokensReceived: number = 0;
  private totalFlushes: number = 0;

  constructor(flushCallback?: FlushCallback, flushInterval?: number) {
    this.flushCallback = flushCallback || null;
    if (flushInterval !== undefined) {
      this.flushInterval = flushInterval;
    }
    this.lastFlushTime = performance.now();
  }

  /**
   * Add a token to the buffer
   * Automatically flushes if buffer is full or interval has passed
   */
  addToken(token: string): void {
    if (this.isInterrupted) {
      return;
    }

    this.buffer += token;
    this.totalTokensReceived++;

    // Force flush if buffer exceeds max size
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flushNow();
      return;
    }

    // Schedule flush if not already scheduled
    this.scheduleFlush();
  }

  /**
   * Schedule a flush after the interval
   */
  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return; // Already scheduled
    }

    const elapsed = performance.now() - this.lastFlushTime;
    const remaining = Math.max(0, this.flushInterval - elapsed);

    this.flushTimer = setTimeout(() => {
      this.flushNow();
    }, remaining);
  }

  /**
   * Flush the buffer immediately
   */
  private flushNow(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const content = this.buffer;
    this.buffer = '';
    this.lastFlushTime = performance.now();
    this.totalFlushes++;

    if (this.flushCallback) {
      this.flushCallback(content);
    }
  }

  /**
   * Flush the buffer and return its contents
   * Used for manual flushing
   */
  flush(): string {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const content = this.buffer;
    this.buffer = '';
    this.lastFlushTime = performance.now();
    
    if (content.length > 0) {
      this.totalFlushes++;
    }

    return content;
  }

  /**
   * Set the flush interval
   */
  setFlushInterval(ms: number): void {
    this.flushInterval = Math.max(1, ms);
  }

  /**
   * Get the current flush interval
   */
  getFlushInterval(): number {
    return this.flushInterval;
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = '';
  }

  /**
   * Handle streaming interruption
   * Returns any remaining buffered content
   */
  interrupt(): string {
    this.isInterrupted = true;
    return this.flush();
  }

  /**
   * Resume after interruption
   */
  resume(): void {
    this.isInterrupted = false;
  }

  /**
   * Check if the buffer is interrupted
   */
  isBufferInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * Get the current buffer contents without flushing
   */
  peek(): string {
    return this.buffer;
  }

  /**
   * Get the current buffer length
   */
  getBufferLength(): number {
    return this.buffer.length;
  }

  /**
   * Get buffer state for debugging/testing
   */
  getState(): TokenBufferState {
    return {
      buffer: this.buffer,
      lastFlushTime: this.lastFlushTime,
      flushInterval: this.flushInterval,
      isInterrupted: this.isInterrupted,
      totalTokensReceived: this.totalTokensReceived,
      totalFlushes: this.totalFlushes,
    };
  }

  /**
   * Set the flush callback
   */
  setFlushCallback(callback: FlushCallback): void {
    this.flushCallback = callback;
  }

  /**
   * Destroy the buffer and clean up resources
   */
  destroy(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = '';
    this.flushCallback = null;
    this.isInterrupted = true;
  }
}

/**
 * Factory function to create a TokenBuffer
 */
export function createTokenBuffer(
  flushCallback?: FlushCallback,
  flushInterval?: number
): TokenBuffer {
  return new TokenBuffer(flushCallback, flushInterval);
}
