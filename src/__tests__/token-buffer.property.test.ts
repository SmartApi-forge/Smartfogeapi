/**
 * Property Tests: Token Buffering
 * 
 * **Feature: chat-ux-improvements, Property 16: Token Buffering**
 * **Validates: Requirements 7.5**
 * 
 * Property: For any streaming session, tokens SHALL be buffered and flushed in 50ms batches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  TokenBuffer,
  createTokenBuffer,
  DEFAULT_FLUSH_INTERVAL_MS,
  MAX_BUFFER_SIZE,
} from '../services/token-buffer';

describe('Property 16: Token Buffering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Property: All tokens added to the buffer SHALL eventually be flushed.
   * No tokens should be lost during buffering.
   */
  it('should preserve all tokens through buffering (no data loss)', () => {
    fc.assert(
      fc.property(
        // Generate random string of tokens
        fc.string({ minLength: 1, maxLength: 200 }),
        (tokens) => {
          const flushedContent: string[] = [];
          const buffer = createTokenBuffer(
            (content) => flushedContent.push(content),
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add all tokens
          for (const char of tokens) {
            buffer.addToken(char);
          }

          // Advance time to trigger flush
          vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS + 10);

          // Flush any remaining
          const remaining = buffer.flush();
          if (remaining) {
            flushedContent.push(remaining);
          }

          // All content should be preserved
          const totalFlushed = flushedContent.join('');
          expect(totalFlushed).toBe(tokens);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tokens SHALL be flushed in batches at the configured interval.
   */
  it('should flush tokens at configured interval', () => {
    fc.assert(
      fc.property(
        // Generate flush interval between 10ms and 100ms
        fc.integer({ min: 10, max: 100 }),
        // Generate tokens
        fc.string({ minLength: 10, maxLength: 50 }),
        (interval, tokens) => {
          let flushCount = 0;
          const buffer = createTokenBuffer(
            () => { flushCount++; },
            interval
          );

          // Add tokens one by one
          for (const char of tokens) {
            buffer.addToken(char);
          }

          // Before interval passes, should not have flushed
          const initialFlushCount = flushCount;

          // Advance time by interval
          vi.advanceTimersByTime(interval + 1);

          // Should have flushed at least once
          expect(flushCount).toBeGreaterThan(initialFlushCount);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Buffer SHALL force flush when exceeding max size.
   */
  it('should force flush when buffer exceeds max size', () => {
    fc.assert(
      fc.property(
        // Generate string larger than max buffer size
        fc.string({ minLength: MAX_BUFFER_SIZE + 1, maxLength: MAX_BUFFER_SIZE + 100 }),
        (tokens) => {
          let flushCount = 0;
          const buffer = createTokenBuffer(
            () => { flushCount++; },
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add all tokens at once (without advancing time)
          for (const char of tokens) {
            buffer.addToken(char);
          }

          // Should have flushed at least once due to size limit
          expect(flushCount).toBeGreaterThanOrEqual(1);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Manual flush SHALL return all buffered content.
   */
  it('should return all buffered content on manual flush', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (tokens) => {
          const buffer = createTokenBuffer(undefined, DEFAULT_FLUSH_INTERVAL_MS);

          // Add tokens without triggering auto-flush
          for (const char of tokens) {
            buffer.addToken(char);
          }

          // Manual flush should return all content
          const flushed = buffer.flush();
          expect(flushed).toBe(tokens);

          // Buffer should be empty after flush
          expect(buffer.getBufferLength()).toBe(0);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Interrupted buffer SHALL return remaining content.
   */
  it('should return remaining content on interruption', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (tokens) => {
          const flushedContent: string[] = [];
          const buffer = createTokenBuffer(
            (content) => flushedContent.push(content),
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add tokens
          for (const char of tokens) {
            buffer.addToken(char);
          }

          // Interrupt and get remaining
          const remaining = buffer.interrupt();
          if (remaining) {
            flushedContent.push(remaining);
          }

          // All content should be preserved
          const totalFlushed = flushedContent.join('');
          expect(totalFlushed).toBe(tokens);

          // Buffer should be interrupted
          expect(buffer.isBufferInterrupted()).toBe(true);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Tokens added after interruption SHALL be ignored.
   */
  it('should ignore tokens added after interruption', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (beforeInterrupt, afterInterrupt) => {
          const flushedContent: string[] = [];
          const buffer = createTokenBuffer(
            (content) => flushedContent.push(content),
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add tokens before interrupt
          for (const char of beforeInterrupt) {
            buffer.addToken(char);
          }

          // Interrupt
          const remaining = buffer.interrupt();
          if (remaining) {
            flushedContent.push(remaining);
          }

          // Try to add more tokens (should be ignored)
          for (const char of afterInterrupt) {
            buffer.addToken(char);
          }

          // Advance time
          vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS + 10);

          // Only content before interrupt should be present
          const totalFlushed = flushedContent.join('');
          expect(totalFlushed).toBe(beforeInterrupt);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Buffer state SHALL accurately track statistics.
   */
  it('should accurately track buffer statistics', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (tokens) => {
          const buffer = createTokenBuffer(undefined, DEFAULT_FLUSH_INTERVAL_MS);

          // Add tokens
          for (const char of tokens) {
            buffer.addToken(char);
          }

          const state = buffer.getState();

          // Total tokens received should match input length
          expect(state.totalTokensReceived).toBe(tokens.length);

          // Flush interval should be set correctly
          expect(state.flushInterval).toBe(DEFAULT_FLUSH_INTERVAL_MS);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Clear SHALL empty the buffer without flushing.
   */
  it('should clear buffer without flushing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (tokens) => {
          let flushCount = 0;
          const buffer = createTokenBuffer(
            () => { flushCount++; },
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add tokens
          for (const char of tokens) {
            buffer.addToken(char);
          }

          const flushCountBefore = flushCount;

          // Clear buffer
          buffer.clear();

          // Should not have triggered additional flush
          expect(flushCount).toBe(flushCountBefore);

          // Buffer should be empty
          expect(buffer.getBufferLength()).toBe(0);
          expect(buffer.peek()).toBe('');

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Resume after interruption SHALL allow new tokens.
   */
  it('should accept tokens after resume', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (beforeInterrupt, afterResume) => {
          const flushedContent: string[] = [];
          const buffer = createTokenBuffer(
            (content) => flushedContent.push(content),
            DEFAULT_FLUSH_INTERVAL_MS
          );

          // Add tokens before interrupt
          for (const char of beforeInterrupt) {
            buffer.addToken(char);
          }

          // Interrupt and resume
          const remaining = buffer.interrupt();
          if (remaining) {
            flushedContent.push(remaining);
          }
          buffer.resume();

          // Add tokens after resume
          for (const char of afterResume) {
            buffer.addToken(char);
          }

          // Advance time and flush
          vi.advanceTimersByTime(DEFAULT_FLUSH_INTERVAL_MS + 10);
          const finalRemaining = buffer.flush();
          if (finalRemaining) {
            flushedContent.push(finalRemaining);
          }

          // All content should be present
          const totalFlushed = flushedContent.join('');
          expect(totalFlushed).toBe(beforeInterrupt + afterResume);

          buffer.destroy();
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
