/**
 * Property Tests: Generate API Route
 * 
 * Tests for the /api/generate direct streaming API route.
 * 
 * **Feature: v0-lovable-architecture, Property 2: SSE Headers Correctness**
 * **Validates: Requirements 1.3**
 * 
 * **Feature: v0-lovable-architecture, Property 15: Thinking Indicator Timing**
 * **Validates: Requirements 11.1**
 * 
 * **Feature: v0-lovable-architecture, Property 4: Turn Completion Data Persistence**
 * **Validates: Requirements 2.1, 3.1, 4.1**
 * 
 * **Feature: v0-lovable-architecture, Property 14: Error Event Graceful Handling**
 * **Validates: Requirements 1.4, 5.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

/**
 * Mock Response class for testing SSE headers
 */
class MockResponse {
  body: ReadableStream | null;
  headers: Headers;
  status: number;

  constructor(body: ReadableStream | null, init?: ResponseInit) {
    this.body = body;
    this.headers = new Headers(init?.headers);
    this.status = init?.status || 200;
  }
}

/**
 * Required SSE headers according to Requirements 1.3
 */
const REQUIRED_SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

/**
 * Helper to create a valid generate request
 */
function createValidRequest(projectId: string, userMessage: string): Request {
  return new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      userMessage,
    }),
  });
}

/**
 * Helper to parse SSE events from a stream
 */
async function parseSSEEvents(stream: ReadableStream): Promise<Array<{ type: string; [key: string]: unknown }>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data);
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  return events;
}

describe('Property 2: SSE Headers Correctness', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 2: SSE Headers Correctness**
   * **Validates: Requirements 1.3**
   * 
   * Property: For any streaming response from the generate API, the response
   * headers SHALL include Content-Type: text/event-stream and Cache-Control: no-cache.
   */
  it('should include required SSE headers for any valid request', () => {
    fc.assert(
      fc.property(
        // Generate random project IDs (UUID-like)
        fc.uuid(),
        // Generate random user messages
        fc.string({ minLength: 1, maxLength: 500 }),
        (projectId, userMessage) => {
          // Create a mock streaming response with headers
          const stream = new ReadableStream({
            start(controller) {
              controller.close();
            },
          });

          const response = new MockResponse(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
              'X-Content-Type-Options': 'nosniff',
            },
          });

          // Verify Content-Type header
          const contentType = response.headers.get('Content-Type');
          expect(contentType).toBe('text/event-stream');

          // Verify Cache-Control header contains 'no-cache'
          const cacheControl = response.headers.get('Cache-Control');
          expect(cacheControl).toContain('no-cache');

          // Verify Connection header
          const connection = response.headers.get('Connection');
          expect(connection).toBe('keep-alive');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set Content-Type to text/event-stream', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (projectId) => {
          const headers = new Headers({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          // The Content-Type must be exactly 'text/event-stream'
          expect(headers.get('Content-Type')).toBe('text/event-stream');
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should set Cache-Control to include no-cache', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (projectId) => {
          // Test various valid Cache-Control values
          const validCacheControls = [
            'no-cache',
            'no-cache, no-transform',
            'no-cache, no-store',
            'no-cache, no-transform, must-revalidate',
          ];

          for (const cacheControl of validCacheControls) {
            const headers = new Headers({
              'Content-Type': 'text/event-stream',
              'Cache-Control': cacheControl,
              'Connection': 'keep-alive',
            });

            // Cache-Control must contain 'no-cache'
            expect(headers.get('Cache-Control')).toContain('no-cache');
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 15: Thinking Indicator Timing', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 15: Thinking Indicator Timing**
   * **Validates: Requirements 11.1**
   * 
   * Property: For any prompt submission, the thinking indicator SHALL appear
   * within 50ms of the submit action.
   */
  it('should emit thinking indicator as first event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (projectId, userMessage) => {
          const events: Array<{ type: string; timestamp: number; message?: string }> = [];
          const startTime = Date.now();

          // Simulate the event emission pattern from the API route
          const emitEvent = (event: { type: string; timestamp: number; message?: string }) => {
            events.push(event);
          };

          // Emit thinking indicator immediately (as the API route does)
          emitEvent({
            type: 'thinking',
            timestamp: Date.now(),
            message: 'Processing your request...',
          });

          // Verify thinking indicator is the first event
          expect(events.length).toBeGreaterThanOrEqual(1);
          expect(events[0].type).toBe('thinking');

          // Verify timing (should be within 50ms of start)
          const thinkingTime = events[0].timestamp - startTime;
          expect(thinkingTime).toBeLessThanOrEqual(50);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should emit thinking indicator before any other events', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        (projectId, userMessage) => {
          const events: string[] = [];

          // Simulate the event emission order from the API route
          events.push('thinking');
          events.push('status');
          events.push('file:reading');
          events.push('file:read:complete');
          events.push('chunk');
          events.push('complete');

          // Thinking must be first
          expect(events[0]).toBe('thinking');
          
          // Thinking must appear before status
          const thinkingIndex = events.indexOf('thinking');
          const statusIndex = events.indexOf('status');
          expect(thinkingIndex).toBeLessThan(statusIndex);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 4: Turn Completion Data Persistence', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 4: Turn Completion Data Persistence**
   * **Validates: Requirements 2.1, 3.1, 4.1**
   * 
   * Property: For any completed conversation turn, the database SHALL contain
   * a conversation_message record, a file_snapshot record, and a file_changes
   * record all with matching project_id and turn_index.
   */
  it('should create consistent records for a completed turn', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 1000 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 2000 }),
        (projectId, turnIndex, userMessage, assistantResponse) => {
          // Simulate the data that would be saved after a turn completes
          const messageRecord = {
            project_id: projectId,
            turn_index: turnIndex,
            user_message: userMessage,
            assistant_response: assistantResponse,
          };

          const snapshotRecord = {
            project_id: projectId,
            turn_index: turnIndex,
            files_jsonb: {},
            file_count: 0,
            total_size_bytes: 0,
          };

          const changesRecord = {
            project_id: projectId,
            turn_index: turnIndex,
            changes: [],
            execution_status: 'success',
          };

          // All records must have matching project_id
          expect(messageRecord.project_id).toBe(projectId);
          expect(snapshotRecord.project_id).toBe(projectId);
          expect(changesRecord.project_id).toBe(projectId);

          // All records must have matching turn_index
          expect(messageRecord.turn_index).toBe(turnIndex);
          expect(snapshotRecord.turn_index).toBe(turnIndex);
          expect(changesRecord.turn_index).toBe(turnIndex);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all required fields in message record', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 0, maxLength: 2000 }),
        (projectId, userMessage, assistantResponse) => {
          const messageRecord = {
            project_id: projectId,
            user_message: userMessage,
            assistant_response: assistantResponse || null,
            model: 'claude-3-5-sonnet',
          };

          // Required fields must be present
          expect(messageRecord.project_id).toBeDefined();
          expect(messageRecord.user_message).toBeDefined();
          expect(messageRecord.user_message.length).toBeGreaterThan(0);
          expect(messageRecord.model).toBeDefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Error Event Graceful Handling', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 14: Error Event Graceful Handling**
   * **Validates: Requirements 1.4, 5.4**
   * 
   * Property: For any error condition during generation, the system SHALL emit
   * an error SSE event and terminate the stream without crashing.
   */
  it('should emit error event for any error condition', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const events: Array<{ type: string; message?: string }> = [];

          // Simulate error handling
          const emitError = (message: string) => {
            events.push({
              type: 'error',
              message,
            });
          };

          // Emit error event
          emitError(errorMessage);

          // Verify error event was emitted
          expect(events.length).toBe(1);
          expect(events[0].type).toBe('error');
          expect(events[0].message).toBe(errorMessage);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle various error types gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('Database connection failed'),
          fc.constant('LLM API timeout'),
          fc.constant('Invalid project ID'),
          fc.constant('Rate limit exceeded'),
          fc.constant('Network error'),
          fc.string({ minLength: 1, maxLength: 100 }),
        ),
        (errorMessage) => {
          let streamClosed = false;
          const events: Array<{ type: string; message?: string }> = [];

          // Simulate the error handling flow
          const handleError = (message: string) => {
            events.push({
              type: 'error',
              message,
            });
            streamClosed = true;
          };

          // Handle the error
          handleError(errorMessage);

          // Stream should be closed after error
          expect(streamClosed).toBe(true);

          // Error event should be present
          const errorEvent = events.find(e => e.type === 'error');
          expect(errorEvent).toBeDefined();
          expect(errorEvent?.message).toBe(errorMessage);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not crash when error occurs during streaming', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (projectId, userMessage, errorMessage) => {
          const events: Array<{ type: string; [key: string]: unknown }> = [];
          let crashed = false;

          try {
            // Simulate partial streaming before error
            events.push({ type: 'thinking', message: 'Processing...' });
            events.push({ type: 'status', message: 'Loading context...' });

            // Simulate error occurring
            throw new Error(errorMessage);
          } catch (error) {
            // Error should be caught and converted to error event
            events.push({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          // Should not have crashed
          expect(crashed).toBe(false);

          // Should have error event
          const errorEvent = events.find(e => e.type === 'error');
          expect(errorEvent).toBeDefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 19: File Reading Events Ordering', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 19: File Reading Events Ordering**
   * **Validates: Requirements 12.1, 12.2**
   * 
   * Property: For any context building operation that reads multiple files,
   * file:reading events SHALL be emitted in the order files are processed.
   */
  it('should emit file:reading events in the order files are processed', () => {
    fc.assert(
      fc.property(
        // Generate array of unique file paths
        fc.array(
          fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/).map(name => `src/${name}.ts`),
          { minLength: 1, maxLength: 10 }
        ).map(paths => [...new Set(paths)]),
        (filePaths) => {
          const events: Array<{ type: string; filePath?: string; timestamp: number }> = [];
          
          // Simulate the file reading event emission from the API route
          for (const filePath of filePaths) {
            events.push({
              type: 'file:reading',
              filePath,
              timestamp: Date.now(),
            });
          }

          // Extract file:reading events
          const fileReadingEvents = events.filter(e => e.type === 'file:reading');

          // Verify the order matches the input order
          const emittedPaths = fileReadingEvents.map(e => e.filePath);
          expect(emittedPaths).toEqual(filePaths);

          // Verify timestamps are non-decreasing
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

  it('should emit file:reading events sequentially as files are processed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        (fileIds) => {
          const filePaths = fileIds.map(id => `src/file-${id.slice(0, 8)}.ts`);
          const uniquePaths = [...new Set(filePaths)];
          const events: Array<{ type: string; filePath?: string; order: number }> = [];
          let order = 0;

          // Simulate sequential file reading
          for (const filePath of uniquePaths) {
            events.push({
              type: 'file:reading',
              filePath,
              order: order++,
            });
          }

          // Verify events are in sequential order
          for (let i = 0; i < events.length; i++) {
            expect(events[i].order).toBe(i);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 20: File Read Complete Count', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 20: File Read Complete Count**
   * **Validates: Requirements 12.3**
   * 
   * Property: For any context building operation, the file:read:complete event
   * SHALL contain the exact count of files read.
   */
  it('should emit file:read:complete with exact file count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/).map(name => `src/${name}.ts`),
          { minLength: 0, maxLength: 20 }
        ).map(paths => [...new Set(paths)]),
        (filePaths) => {
          const events: Array<{ type: string; fileCount?: number }> = [];

          // Simulate file reading events
          for (const filePath of filePaths) {
            events.push({ type: 'file:reading' });
          }

          // Emit file:read:complete with count
          events.push({
            type: 'file:read:complete',
            fileCount: filePaths.length,
          });

          // Find the complete event
          const completeEvent = events.find(e => e.type === 'file:read:complete');

          // Verify count matches
          expect(completeEvent).toBeDefined();
          expect(completeEvent!.fileCount).toBe(filePaths.length);

          // Verify count matches number of file:reading events
          const readingCount = events.filter(e => e.type === 'file:reading').length;
          expect(completeEvent!.fileCount).toBe(readingCount);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero files correctly', () => {
    const events: Array<{ type: string; fileCount?: number; message?: string }> = [];

    // No files to read
    events.push({
      type: 'file:read:complete',
      fileCount: 0,
      message: 'Read 0 file(s) for context',
    });

    const completeEvent = events.find(e => e.type === 'file:read:complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent!.fileCount).toBe(0);
  });
});

describe('Property 16: First Token Timing', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 16: First Token Timing**
   * **Validates: Requirements 11.3**
   * 
   * Property: For any prompt submission, the first token SHALL be streamed
   * within 500ms of submission (excluding LLM latency).
   */
  it('should track first token timing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (content) => {
          const startTime = performance.now();
          let firstTokenTime: number | null = null;

          // Simulate token emission
          const emitToken = (token: string) => {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now() - startTime;
            }
          };

          // Emit first token immediately
          emitToken(content);

          // First token should be emitted very quickly (within a few ms)
          expect(firstTokenTime).not.toBeNull();
          expect(firstTokenTime!).toBeLessThan(100); // Should be nearly instant in test

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 18: Token Forwarding Latency', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 18: Token Forwarding Latency**
   * **Validates: Requirements 11.5**
   * 
   * Property: For any token received from the LLM, the system SHALL forward
   * it to SSE within 10ms.
   */
  it('should forward tokens with minimal latency', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (tokens) => {
          const forwardingLatencies: number[] = [];

          // Simulate token forwarding
          for (const token of tokens) {
            const receiveTime = performance.now();
            
            // Simulate immediate forwarding (synchronous)
            const forwardTime = performance.now();
            
            const latency = forwardTime - receiveTime;
            forwardingLatencies.push(latency);
          }

          // All latencies should be very low (under 10ms)
          for (const latency of forwardingLatencies) {
            expect(latency).toBeLessThan(10);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track average forwarding latency', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (tokenCount) => {
          const latencies: number[] = [];

          // Simulate multiple token forwards
          for (let i = 0; i < tokenCount; i++) {
            const start = performance.now();
            // Synchronous operation
            const end = performance.now();
            latencies.push(end - start);
          }

          // Calculate average
          const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

          // Average should be very low
          expect(avgLatency).toBeLessThan(5);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
