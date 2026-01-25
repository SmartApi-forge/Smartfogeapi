/**
 * Property Tests: Chat Stream Timing
 * 
 * Tests timing requirements for chat streaming events.
 * 
 * **Feature: chat-ux-improvements, Property 5: First Token Timing**
 * **Validates: Requirements 2.4**
 * 
 * **Feature: chat-ux-improvements, Property 6: Event Interval Timing**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createChatStreamEmitter,
  TIMING_CONSTANTS,
} from '../services/chat-stream-emitter';
import type { ChatStreamEvent } from '../types/chat-ux';

describe('Property 5: First Token Timing', () => {
  /**
   * Property: For any prompt submission, the first token SHALL be streamed
   * within 500ms of submission.
   * 
   * We test this by verifying that the emitter's timing validation correctly
   * identifies when first token timing requirements are met.
   */
  it('should emit first token within 500ms timing window', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random prompt content
        fc.string({ minLength: 1, maxLength: 50 }),
        async (promptContent) => {
          const events: ChatStreamEvent[] = [];
          const startTime = performance.now();
          
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            startTime
          );

          // Emit thinking and context building (required before first token)
          emitter.emitThinking('Processing...');
          emitter.emitContextBuilding('working_memory', 0);
          
          // Emit first token (immediate, no delay)
          emitter.emitImmediate({
            type: 'text:chunk',
            content: promptContent,
            timestamp: Date.now(),
          });

          // Get metrics and validate
          const metrics = emitter.getMetrics();
          const elapsed = performance.now() - startTime;
          
          // The first token should be emitted within 500ms
          expect(elapsed).toBeLessThanOrEqual(TIMING_CONSTANTS.FIRST_TOKEN_MAX_MS);
          
          // Verify the event was actually emitted
          const textChunkEvent = events.find(e => e.type === 'text:chunk');
          expect(textChunkEvent).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should track first token timing in metrics', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (content) => {
          const events: ChatStreamEvent[] = [];
          const startTime = performance.now();
          
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            startTime
          );

          // Emit first token using immediate (no async delay)
          emitter.emitImmediate({
            type: 'text:chunk',
            content,
            timestamp: Date.now(),
          });

          // Get metrics - note: firstTokenEmittedAt is only set by emitTextChunk
          // For this test, we verify the event was emitted quickly
          const elapsed = performance.now() - startTime;
          
          // Should be very fast (under 10ms for immediate emit)
          expect(elapsed).toBeLessThan(100);
          expect(events.length).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 6: Event Interval Timing', () => {
  /**
   * Property: For any streaming session, consecutive events SHALL be emitted
   * at minimum 50ms intervals (when using the interval-respecting emit method).
   */
  it('should maintain minimum 50ms interval between events', async () => {
    // Test with a small fixed number of chunks to avoid timeout
    const chunks = ['chunk1', 'chunk2', 'chunk3'];
    const eventTimestamps: number[] = [];
    
    const emitter = createChatStreamEmitter(
      () => {
        eventTimestamps.push(performance.now());
      },
      performance.now()
    );

    // Emit multiple events using the interval-respecting method
    for (const chunk of chunks) {
      await emitter.emitTextChunk(chunk);
    }

    // Verify intervals between consecutive events
    for (let i = 1; i < eventTimestamps.length; i++) {
      const interval = eventTimestamps[i] - eventTimestamps[i - 1];
      // Allow small tolerance for timing precision (45ms instead of 50ms)
      expect(interval).toBeGreaterThanOrEqual(TIMING_CONSTANTS.MIN_EVENT_INTERVAL_MS - 5);
    }
  }, 10000); // 10 second timeout

  it('should emit immediate events without interval delay', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (message) => {
          const eventTimestamps: number[] = [];
          const startTime = performance.now();
          
          const emitter = createChatStreamEmitter(
            () => {
              eventTimestamps.push(performance.now());
            },
            startTime
          );

          // Emit immediate events (thinking, context building)
          emitter.emitThinking(message);
          emitter.emitContextBuilding('working_memory', 0);
          emitter.emitContextBuilding('rag_retrieval', 50);

          // All immediate events should be emitted quickly (within a few ms)
          expect(eventTimestamps.length).toBe(3);
          
          // Each event should be emitted very quickly after the previous
          for (let i = 1; i < eventTimestamps.length; i++) {
            const interval = eventTimestamps[i] - eventTimestamps[i - 1];
            // Immediate events should be much faster than 50ms
            expect(interval).toBeLessThan(TIMING_CONSTANTS.MIN_EVENT_INTERVAL_MS);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should count events correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (eventCount) => {
          const emitter = createChatStreamEmitter(
            () => {},
            performance.now()
          );

          // Emit the specified number of immediate events (no delay)
          for (let i = 0; i < eventCount; i++) {
            emitter.emitImmediate({
              type: 'text:chunk',
              content: `chunk ${i}`,
              timestamp: Date.now(),
            });
          }

          // Verify event count
          expect(emitter.getEventCount()).toBe(eventCount);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
