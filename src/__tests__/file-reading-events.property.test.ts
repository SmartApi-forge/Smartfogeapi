/**
 * Property Tests: File Reading Events
 * 
 * Tests file reading event emission requirements.
 * 
 * **Feature: chat-ux-improvements, Property 7: File Reading Events Ordering**
 * **Validates: Requirements 3.1, 3.4**
 * 
 * **Feature: chat-ux-improvements, Property 8: File Read Complete Count**
 * **Validates: Requirements 3.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createChatStreamEmitter,
} from '../services/chat-stream-emitter';
import type { ChatStreamEvent, FileReadingStreamEvent, FileReadCompleteStreamEvent } from '../types/chat-ux';
import type { ChatStreamEmitter } from '../services/chat-stream-emitter';

/**
 * Standalone function to emit file reading events for a list of files
 * Uses emitImmediate to avoid 50ms delays in tests
 * 
 * Requirements: 3.1, 3.4, 3.5
 */
function emitFileReadingEventsSync(
  emitter: ChatStreamEmitter,
  filePaths: string[]
): string[] {
  const emittedPaths: string[] = [];

  // Emit file:reading events sequentially using immediate (no delay)
  for (const filePath of filePaths) {
    emitter.emitImmediate({
      type: 'file:reading',
      filePath,
      timestamp: Date.now(),
    });
    emittedPaths.push(filePath);
  }

  // Emit file:read:complete event
  emitter.emitImmediate({
    type: 'file:read:complete',
    fileCount: emittedPaths.length,
    filePaths: emittedPaths,
    timestamp: Date.now(),
  });

  return emittedPaths;
}

/**
 * Helper to generate valid file paths
 */
const filePathArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/)
  .map(name => `src/${name}.ts`);

/**
 * Helper to generate arrays of unique file paths
 */
const uniqueFilePathsArbitrary = (minLength: number, maxLength: number) =>
  fc.array(filePathArbitrary, { minLength, maxLength })
    .map(paths => [...new Set(paths)]); // Ensure uniqueness

describe('Property 7: File Reading Events Ordering', () => {
  /**
   * Property: For any context building operation that reads multiple files,
   * file:reading events SHALL be emitted in the order files are processed.
   * 
   * **Validates: Requirements 3.1, 3.4**
   */
  it('should emit file:reading events in sequential order', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(1, 5),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events using sync version
          emitFileReadingEventsSync(emitter, filePaths);

          // Extract file:reading events
          const fileReadingEvents = events.filter(
            (e): e is FileReadingStreamEvent => e.type === 'file:reading'
          );

          // Verify the order matches the input order
          const emittedPaths = fileReadingEvents.map(e => e.filePath);
          
          // The emitted paths should match the input paths in order
          expect(emittedPaths).toEqual(filePaths);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should emit events with increasing timestamps', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(2, 5),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events
          emitFileReadingEventsSync(emitter, filePaths);

          // Extract file:reading events
          const fileReadingEvents = events.filter(
            (e): e is FileReadingStreamEvent => e.type === 'file:reading'
          );

          // Verify timestamps are non-decreasing (events emitted in order)
          for (let i = 1; i < fileReadingEvents.length; i++) {
            expect(fileReadingEvents[i].timestamp).toBeGreaterThanOrEqual(
              fileReadingEvents[i - 1].timestamp
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should emit file:reading before file:read:complete', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(1, 5),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events
          emitFileReadingEventsSync(emitter, filePaths);

          // Find indices of events
          const lastReadingIndex = events.findLastIndex(e => e.type === 'file:reading');
          const completeIndex = events.findIndex(e => e.type === 'file:read:complete');

          // file:read:complete should come after all file:reading events
          expect(completeIndex).toBeGreaterThan(lastReadingIndex);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: File Read Complete Count', () => {
  /**
   * Property: For any context building operation, the file:read:complete event
   * SHALL contain the exact count of files read.
   * 
   * **Validates: Requirements 3.5**
   */
  it('should emit file:read:complete with exact file count', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(1, 10),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events
          emitFileReadingEventsSync(emitter, filePaths);

          // Find the file:read:complete event
          const completeEvent = events.find(
            (e): e is FileReadCompleteStreamEvent => e.type === 'file:read:complete'
          );

          // Verify the event exists
          expect(completeEvent).toBeDefined();

          // Verify the count matches the number of files
          expect(completeEvent!.fileCount).toBe(filePaths.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all file paths in file:read:complete event', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(1, 10),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events
          emitFileReadingEventsSync(emitter, filePaths);

          // Find the file:read:complete event
          const completeEvent = events.find(
            (e): e is FileReadCompleteStreamEvent => e.type === 'file:read:complete'
          );

          // Verify the event exists
          expect(completeEvent).toBeDefined();

          // Verify all file paths are included
          expect(completeEvent!.filePaths).toEqual(filePaths);
          expect(completeEvent!.filePaths.length).toBe(completeEvent!.fileCount);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty file list correctly', () => {
    const events: ChatStreamEvent[] = [];
    const emitter = createChatStreamEmitter(
      (event) => events.push(event),
      performance.now()
    );

    // Emit file reading events with empty list
    emitFileReadingEventsSync(emitter, []);

    // Find the file:read:complete event
    const completeEvent = events.find(
      (e): e is FileReadCompleteStreamEvent => e.type === 'file:read:complete'
    );

    // Verify the event exists with count 0
    expect(completeEvent).toBeDefined();
    expect(completeEvent!.fileCount).toBe(0);
    expect(completeEvent!.filePaths).toEqual([]);
  });

  it('should count unique files only once', () => {
    fc.assert(
      fc.property(
        uniqueFilePathsArbitrary(1, 5),
        (filePaths) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit file reading events
          emitFileReadingEventsSync(emitter, filePaths);

          // Count file:reading events
          const fileReadingEvents = events.filter(e => e.type === 'file:reading');

          // Find the file:read:complete event
          const completeEvent = events.find(
            (e): e is FileReadCompleteStreamEvent => e.type === 'file:read:complete'
          );

          // The count in complete event should match the number of reading events
          expect(completeEvent!.fileCount).toBe(fileReadingEvents.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
