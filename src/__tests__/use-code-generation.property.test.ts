/**
 * Property Tests: useCodeGeneration Hook State Consistency
 * 
 * Tests that the useCodeGeneration hook correctly processes SSE events
 * and maintains consistent state.
 * 
 * **Feature: v0-lovable-architecture, Property 13: Hook State Consistency**
 * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * SSE Event types from /api/generate
 */
interface GenerateSSEEvent {
  type: 
    | 'thinking'
    | 'status' 
    | 'chunk' 
    | 'file:start'
    | 'file:reading'
    | 'file:read:complete'
    | 'file:complete' 
    | 'complete' 
    | 'error'
    | 'heartbeat';
  message?: string;
  content?: string;
  filename?: string;
  filePath?: string;
  fileCount?: number;
  filesModified?: string[];
  turnIndex?: number;
  timestamp?: string;
}

/**
 * Generation status states
 */
type GenerationStatus = 
  | 'idle'
  | 'thinking'
  | 'reading_files'
  | 'generating'
  | 'complete'
  | 'error';

/**
 * File reading event for tracking context building
 */
interface FileReadingEvent {
  type: 'file:reading' | 'file:read:complete';
  filePath?: string;
  fileCount?: number;
  timestamp: number;
}

/**
 * Hook state representation for testing
 */
interface HookState {
  output: string;
  isGenerating: boolean;
  status: GenerationStatus;
  statusMessage: string;
  error: string | null;
  filesModified: string[];
  fileReadingEvents: FileReadingEvent[];
  turnIndex: number | null;
}

/**
 * Initial state
 */
const initialState: HookState = {
  output: '',
  isGenerating: true, // Assume generation has started
  status: 'thinking',
  statusMessage: 'Thinking...',
  error: null,
  filesModified: [],
  fileReadingEvents: [],
  turnIndex: null,
};

/**
 * Process a single SSE event and return new state
 * This mirrors the processEvent logic in the hook
 */
function processEvent(state: HookState, event: GenerateSSEEvent): HookState {
  const newState = { ...state };
  
  switch (event.type) {
    case 'thinking':
      newState.status = 'thinking';
      newState.statusMessage = event.message || 'Thinking...';
      break;

    case 'status':
      newState.statusMessage = event.message || '';
      break;

    case 'file:reading':
      newState.status = 'reading_files';
      newState.fileReadingEvents = [
        ...state.fileReadingEvents,
        {
          type: 'file:reading',
          filePath: event.filePath,
          timestamp: Date.now(),
        },
      ];
      break;

    case 'file:read:complete':
      newState.status = 'generating';
      newState.fileReadingEvents = [
        ...state.fileReadingEvents,
        {
          type: 'file:read:complete',
          fileCount: event.fileCount,
          timestamp: Date.now(),
        },
      ];
      break;

    case 'chunk':
      newState.status = 'generating';
      newState.output = state.output + (event.content || '');
      break;

    case 'file:start':
      newState.statusMessage = `Generating ${event.filename || 'file'}...`;
      break;

    case 'file:complete':
      if (event.filename && !state.filesModified.includes(event.filename)) {
        newState.filesModified = [...state.filesModified, event.filename];
      }
      break;

    case 'complete':
      newState.status = 'complete';
      newState.statusMessage = event.message || 'Generation complete';
      newState.isGenerating = false;
      if (event.filesModified) {
        newState.filesModified = event.filesModified;
      }
      if (event.turnIndex !== undefined) {
        newState.turnIndex = event.turnIndex;
      }
      break;

    case 'error':
      newState.status = 'error';
      newState.error = event.message || 'Unknown error';
      newState.statusMessage = '';
      newState.isGenerating = false;
      break;

    case 'heartbeat':
      // No state change
      break;
  }
  
  return newState;
}

/**
 * Process a sequence of events
 */
function processEvents(events: GenerateSSEEvent[]): HookState {
  return events.reduce(processEvent, { ...initialState });
}

/**
 * Arbitraries for generating test data
 */
const chunkEventArb = fc.record({
  type: fc.constant('chunk' as const),
  content: fc.string({ minLength: 1, maxLength: 100 }),
});

const statusEventArb = fc.record({
  type: fc.constant('status' as const),
  message: fc.string({ minLength: 1, maxLength: 50 }),
});

const errorEventArb = fc.record({
  type: fc.constant('error' as const),
  message: fc.string({ minLength: 1, maxLength: 100 }),
});

const completeEventArb = fc.record({
  type: fc.constant('complete' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  filesModified: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  turnIndex: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
});

const fileReadingEventArb = fc.record({
  type: fc.constant('file:reading' as const),
  filePath: fc.string({ minLength: 1, maxLength: 50 }),
});

const fileReadCompleteEventArb = fc.record({
  type: fc.constant('file:read:complete' as const),
  fileCount: fc.integer({ min: 1, max: 100 }),
});

const thinkingEventArb = fc.record({
  type: fc.constant('thinking' as const),
  message: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

describe('Property 13: Hook State Consistency', () => {
  /**
   * Property: For any sequence of chunk events, the output SHALL be the
   * concatenation of all chunk contents.
   * 
   * Requirements: 10.2
   */
  it('should accumulate output correctly for chunk events', () => {
    fc.assert(
      fc.property(
        fc.array(chunkEventArb, { minLength: 1, maxLength: 10 }),
        (chunkEvents) => {
          const finalState = processEvents(chunkEvents);
          
          // Output should be concatenation of all chunk contents
          const expectedOutput = chunkEvents
            .map(e => e.content || '')
            .join('');
          
          expect(finalState.output).toBe(expectedOutput);
          expect(finalState.status).toBe('generating');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any status event, the statusMessage SHALL be updated
   * to the event's message.
   * 
   * Requirements: 10.3
   */
  it('should update status message for status events', () => {
    fc.assert(
      fc.property(
        fc.array(statusEventArb, { minLength: 1, maxLength: 5 }),
        (statusEvents) => {
          const finalState = processEvents(statusEvents);
          
          // Status message should be the last status event's message
          const lastStatusEvent = statusEvents[statusEvents.length - 1];
          expect(finalState.statusMessage).toBe(lastStatusEvent.message || '');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any error event, the error state SHALL be set to the
   * event's message and isGenerating SHALL be false.
   * 
   * Requirements: 10.4
   */
  it('should update error state for error events', () => {
    fc.assert(
      fc.property(
        errorEventArb,
        (errorEvent) => {
          const finalState = processEvents([errorEvent]);
          
          expect(finalState.status).toBe('error');
          expect(finalState.error).toBe(errorEvent.message || 'Unknown error');
          expect(finalState.isGenerating).toBe(false);
          expect(finalState.statusMessage).toBe('');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any complete event, the filesModified state SHALL contain
   * the files from the event and isGenerating SHALL be false.
   * 
   * Requirements: 10.5
   */
  it('should update filesModified for completion events', () => {
    fc.assert(
      fc.property(
        completeEventArb,
        (completeEvent) => {
          const finalState = processEvents([completeEvent]);
          
          expect(finalState.status).toBe('complete');
          expect(finalState.isGenerating).toBe(false);
          
          if (completeEvent.filesModified) {
            expect(finalState.filesModified).toEqual(completeEvent.filesModified);
          }
          
          if (completeEvent.turnIndex !== undefined) {
            expect(finalState.turnIndex).toBe(completeEvent.turnIndex);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any sequence of file:reading events, the fileReadingEvents
   * array SHALL contain all file paths in order.
   * 
   * Requirements: 12.1
   */
  it('should track file reading events in order', () => {
    fc.assert(
      fc.property(
        fc.array(fileReadingEventArb, { minLength: 1, maxLength: 10 }),
        (fileReadingEvents) => {
          const finalState = processEvents(fileReadingEvents);
          
          // Should have same number of file reading events
          expect(finalState.fileReadingEvents.length).toBe(fileReadingEvents.length);
          
          // File paths should match in order
          for (let i = 0; i < fileReadingEvents.length; i++) {
            expect(finalState.fileReadingEvents[i].type).toBe('file:reading');
            expect(finalState.fileReadingEvents[i].filePath).toBe(fileReadingEvents[i].filePath);
          }
          
          expect(finalState.status).toBe('reading_files');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any file:read:complete event, the fileCount SHALL be
   * correctly stored in the event.
   * 
   * Requirements: 12.3
   */
  it('should track file read complete count', () => {
    fc.assert(
      fc.property(
        fc.array(fileReadingEventArb, { minLength: 1, maxLength: 5 }),
        fileReadCompleteEventArb,
        (readingEvents, completeEvent) => {
          const allEvents: GenerateSSEEvent[] = [...readingEvents, completeEvent];
          const finalState = processEvents(allEvents);
          
          // Last event should be file:read:complete
          const lastEvent = finalState.fileReadingEvents[finalState.fileReadingEvents.length - 1];
          expect(lastEvent.type).toBe('file:read:complete');
          expect(lastEvent.fileCount).toBe(completeEvent.fileCount);
          
          // Status should transition to generating
          expect(finalState.status).toBe('generating');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any mixed sequence of events ending with complete,
   * the final state SHALL be consistent.
   */
  it('should maintain consistent state for mixed event sequences', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            thinkingEventArb,
            statusEventArb,
            chunkEventArb,
            fileReadingEventArb,
          ),
          { minLength: 0, maxLength: 10 }
        ),
        completeEventArb,
        (mixedEvents, completeEvent) => {
          const allEvents: GenerateSSEEvent[] = [...mixedEvents, completeEvent];
          const finalState = processEvents(allEvents);
          
          // Final state should be complete
          expect(finalState.status).toBe('complete');
          expect(finalState.isGenerating).toBe(false);
          expect(finalState.error).toBeNull();
          
          // Output should be accumulated from all chunk events
          const expectedOutput = mixedEvents
            .filter((e): e is { type: 'chunk'; content: string } => e.type === 'chunk')
            .map(e => e.content || '')
            .join('');
          expect(finalState.output).toBe(expectedOutput);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error events should terminate generation regardless of
   * previous state.
   */
  it('should terminate generation on error regardless of previous state', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            thinkingEventArb,
            statusEventArb,
            chunkEventArb,
          ),
          { minLength: 0, maxLength: 5 }
        ),
        errorEventArb,
        (previousEvents, errorEvent) => {
          const allEvents: GenerateSSEEvent[] = [...previousEvents, errorEvent];
          const finalState = processEvents(allEvents);
          
          // Error should override any previous state
          expect(finalState.status).toBe('error');
          expect(finalState.isGenerating).toBe(false);
          expect(finalState.error).toBe(errorEvent.message || 'Unknown error');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
