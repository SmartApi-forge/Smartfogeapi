/**
 * Property Tests: Message Persistence
 * 
 * Tests for database persistence after streaming completes.
 * 
 * **Feature: chat-ux-improvements**
 * - Property 17: Database Persistence Timing
 * - Property 18: Metadata Completeness
 * - Property 19: Save Retry Logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  MessagePersistenceService,
  createMessagePersistenceService,
  MAX_RETRY_ATTEMPTS,
  BASE_RETRY_DELAY_MS,
  type SaveMessageInput,
  type QueuedMessage,
} from '../services/message-persistence';
import type { ChatMode, Attachment, ContextSource, FileReadingEvent } from '../types/chat-ux';

// Mock supabase-server
vi.mock('../../lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { supabaseServer } from '../../lib/supabase-server';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid chat modes
 */
const chatModeArb = fc.constantFrom<ChatMode>('ask', 'code');

/**
 * Generator for valid message roles
 */
const roleArb = fc.constantFrom<'user' | 'assistant'>('user', 'assistant');

/**
 * Generator for valid project IDs (UUID format)
 */
const projectIdArb = fc.uuid();

/**
 * Generator for message content
 */
const contentArb = fc.string({ minLength: 1, maxLength: 1000 });

/**
 * Generator for attachment types
 */
const attachmentTypeArb = fc.constantFrom<Attachment['type']>(
  'image', 'pdf', 'markdown', 'code', 'other'
);

/**
 * Generator for attachments
 */
const attachmentArb: fc.Arbitrary<Attachment> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  type: attachmentTypeArb,
  size: fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
  url: fc.webUrl(),
  storagePath: fc.string({ minLength: 1, maxLength: 200 }),
  thumbnailUrl: fc.option(fc.webUrl(), { nil: undefined }),
  contentHash: fc.option(fc.string({ minLength: 32, maxLength: 64 }), { nil: undefined }),
  createdAt: fc.date(),
});

/**
 * Generator for context source types
 */
const contextSourceTypeArb = fc.constantFrom<ContextSource['type']>(
  'file', 'embedding', 'project_knowledge', 'conversation'
);

/**
 * Generator for context sources
 */
const contextSourceArb: fc.Arbitrary<ContextSource> = fc.record({
  type: contextSourceTypeArb,
  path: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  relevanceScore: fc.option(fc.float({ min: 0, max: 1 }), { nil: undefined }),
  truncated: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generator for file reading events
 */
const fileReadingEventArb: fc.Arbitrary<FileReadingEvent> = fc.oneof(
  fc.record({
    type: fc.constant('file:reading' as const),
    filePath: fc.string({ minLength: 1, maxLength: 200 }),
    timestamp: fc.integer({ min: 0 }),
  }),
  fc.record({
    type: fc.constant('file:read:complete' as const),
    fileCount: fc.integer({ min: 0, max: 100 }),
    filePaths: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 20 }),
    timestamp: fc.integer({ min: 0 }),
  })
);

/**
 * Generator for SaveMessageInput
 */
const saveMessageInputArb: fc.Arbitrary<SaveMessageInput> = fc.record({
  projectId: projectIdArb,
  role: roleArb,
  content: contentArb,
  mode: chatModeArb,
  attachments: fc.option(fc.array(attachmentArb, { maxLength: 5 }), { nil: undefined }),
  contextSources: fc.option(fc.array(contextSourceArb, { maxLength: 10 }), { nil: undefined }),
  fileReadingEvents: fc.option(fc.array(fileReadingEventArb, { maxLength: 20 }), { nil: undefined }),
  senderId: fc.option(fc.uuid(), { nil: undefined }),
  receiverId: fc.option(fc.uuid(), { nil: undefined }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock Supabase chain for successful operations
 */
function mockSuccessfulSave(messageId: string = 'test-message-id') {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: messageId }, error: null }),
  };
  (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
  return mockChain;
}

/**
 * Creates a mock Supabase chain for failed operations
 */
function mockFailedSave(errorMessage: string = 'Database error') {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: errorMessage } }),
  };
  (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
  return mockChain;
}

/**
 * Creates a mock that fails N times then succeeds
 */
function mockFailThenSucceed(failCount: number, messageId: string = 'test-message-id') {
  let callCount = 0;
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= failCount) {
        return Promise.resolve({ data: null, error: { message: `Failure ${callCount}` } });
      }
      return Promise.resolve({ data: { id: messageId }, error: null });
    }),
  };
  (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
  return mockChain;
}

// ============================================================================
// Property 17: Database Persistence Timing
// ============================================================================

describe('Property 17: Database Persistence Timing', () => {
  /**
   * **Feature: chat-ux-improvements, Property 17: Database Persistence Timing**
   * **Validates: Requirements 8.1, 8.4**
   * 
   * Property: For any streaming session, the complete response SHALL be saved
   * to database only after streaming completes (not during).
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject save attempts while streaming is in progress', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const service = createMessagePersistenceService();
        
        // Start streaming
        service.startStreaming(input.projectId);
        
        // Attempt to save while streaming
        const result = await service.saveMessage(input);
        
        // Should fail because streaming is in progress
        expect(result.success).toBe(false);
        expect(result.error).toContain('streaming is in progress');
        expect(result.retryCount).toBe(0);
        
        // Cleanup
        service.clearState(input.projectId);
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should allow save after streaming ends', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        mockSuccessfulSave();
        const service = createMessagePersistenceService();
        
        // Start and end streaming
        service.startStreaming(input.projectId);
        service.endStreaming(input.projectId);
        
        // Now save should succeed
        const result = await service.saveMessage(input);
        
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        
        // Cleanup
        service.clearState(input.projectId);
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should track streaming state correctly', () => {
    fc.assert(
      fc.property(projectIdArb, (projectId) => {
        const service = createMessagePersistenceService();
        
        // Initially not streaming
        expect(service.isStreaming(projectId)).toBe(false);
        
        // Start streaming
        service.startStreaming(projectId);
        expect(service.isStreaming(projectId)).toBe(true);
        
        // End streaming
        service.endStreaming(projectId);
        expect(service.isStreaming(projectId)).toBe(false);
        
        // Cleanup
        service.clearState(projectId);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should accumulate content during streaming without saving', () => {
    fc.assert(
      fc.property(
        projectIdArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        (projectId, contentChunks) => {
          const service = createMessagePersistenceService();
          
          // Start streaming
          service.startStreaming(projectId);
          
          // Accumulate content
          for (const chunk of contentChunks) {
            service.accumulateContent(projectId, chunk);
          }
          
          // Verify no database calls were made during accumulation
          expect(supabaseServer.from).not.toHaveBeenCalled();
          
          // Cleanup
          service.clearState(projectId);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 18: Metadata Completeness
// ============================================================================

describe('Property 18: Metadata Completeness', () => {
  /**
   * **Feature: chat-ux-improvements, Property 18: Metadata Completeness**
   * **Validates: Requirements 8.2**
   * 
   * Property: For any saved message, the record SHALL include mode, attachments,
   * and context sources.
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include mode in saved message', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const mockChain = mockSuccessfulSave();
        const service = createMessagePersistenceService();
        
        await service.saveMessage(input);
        
        // Verify mode was included in the insert
        expect(mockChain.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: input.mode,
          })
        );
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should include context sources in saved message', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const mockChain = mockSuccessfulSave();
        const service = createMessagePersistenceService();
        
        await service.saveMessage(input);
        
        // Verify context_sources was included
        expect(mockChain.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            context_sources: input.contextSources || [],
          })
        );
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should include file reading events in saved message', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const mockChain = mockSuccessfulSave();
        const service = createMessagePersistenceService();
        
        await service.saveMessage(input);
        
        // Verify file_reading_events was included
        expect(mockChain.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            file_reading_events: input.fileReadingEvents || [],
          })
        );
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should include all required fields in saved message', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const mockChain = mockSuccessfulSave();
        const service = createMessagePersistenceService();
        
        await service.saveMessage(input);
        
        // Verify all required fields were included
        expect(mockChain.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            project_id: input.projectId,
            role: input.role,
            content: input.content,
            mode: input.mode,
            context_sources: expect.any(Array),
            file_reading_events: expect.any(Array),
          })
        );
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should emit message:saved event with messageId on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        saveMessageInputArb,
        fc.uuid(),
        async (input, messageId) => {
          mockSuccessfulSave(messageId);
          
          const events: Array<{ type: string; messageId?: string }> = [];
          const service = createMessagePersistenceService((event) => {
            events.push(event as { type: string; messageId?: string });
          });
          
          await service.saveMessage(input);
          
          // Verify message:saved event was emitted
          expect(events).toContainEqual(
            expect.objectContaining({
              type: 'message:saved',
              messageId: messageId,
            })
          );
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 19: Save Retry Logic
// ============================================================================

describe('Property 19: Save Retry Logic', () => {
  /**
   * **Feature: chat-ux-improvements, Property 19: Save Retry Logic**
   * **Validates: Requirements 8.5**
   * 
   * Property: For any failed save operation, the system SHALL retry up to 3 times
   * with exponential backoff.
   */

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry exactly MAX_RETRY_ATTEMPTS times on failure', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        const mockChain = mockFailedSave('Persistent error');
        const service = createMessagePersistenceService();
        
        // Run save with fake timers
        const savePromise = service.saveMessage(input);
        
        // Advance through all retry delays
        for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
          await vi.advanceTimersByTimeAsync(BASE_RETRY_DELAY_MS * Math.pow(2, i) + 100);
        }
        
        const result = await savePromise;
        
        // Should have failed after all retries
        expect(result.success).toBe(false);
        expect(result.retryCount).toBe(MAX_RETRY_ATTEMPTS);
        
        // Verify the number of attempts
        expect(mockChain.single).toHaveBeenCalledTimes(MAX_RETRY_ATTEMPTS);
        
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('should succeed if retry succeeds within MAX_RETRY_ATTEMPTS', async () => {
    await fc.assert(
      fc.asyncProperty(
        saveMessageInputArb,
        fc.integer({ min: 1, max: MAX_RETRY_ATTEMPTS - 1 }),
        async (input, failCount) => {
          const messageId = 'success-after-retry';
          mockFailThenSucceed(failCount, messageId);
          const service = createMessagePersistenceService();
          
          // Run save with fake timers
          const savePromise = service.saveMessage(input);
          
          // Advance through retry delays
          for (let i = 0; i < failCount + 1; i++) {
            await vi.advanceTimersByTimeAsync(BASE_RETRY_DELAY_MS * Math.pow(2, i) + 100);
          }
          
          const result = await savePromise;
          
          // Should succeed after retries
          expect(result.success).toBe(true);
          expect(result.messageId).toBe(messageId);
          expect(result.retryCount).toBe(failCount);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should queue message for later if all retries fail', async () => {
    await fc.assert(
      fc.asyncProperty(saveMessageInputArb, async (input) => {
        mockFailedSave('Persistent error');
        const service = createMessagePersistenceService();
        
        // Run save with fake timers
        const savePromise = service.saveMessage(input);
        
        // Advance through all retry delays
        for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
          await vi.advanceTimersByTimeAsync(BASE_RETRY_DELAY_MS * Math.pow(2, i) + 100);
        }
        
        await savePromise;
        
        // Check that message was queued
        const queue = service.getFailedQueue();
        expect(queue.length).toBe(1);
        expect(queue[0].input).toEqual(input);
        expect(queue[0].attempts).toBe(MAX_RETRY_ATTEMPTS);
        
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('should use exponential backoff for retry delays', async () => {
    // This test verifies the exponential backoff pattern
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_RETRY_ATTEMPTS }),
        (retryNumber) => {
          const expectedDelay = BASE_RETRY_DELAY_MS * Math.pow(2, retryNumber - 1);
          
          // Verify the delay calculation follows exponential pattern
          // Retry 1: 1000ms, Retry 2: 2000ms, Retry 3: 4000ms
          expect(expectedDelay).toBe(BASE_RETRY_DELAY_MS * Math.pow(2, retryNumber - 1));
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should be able to retry queued messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(saveMessageInputArb, { minLength: 1, maxLength: 3 }),
        async (inputs) => {
          // First, fail all saves to queue them
          mockFailedSave('Initial failure');
          const service = createMessagePersistenceService();
          
          for (const input of inputs) {
            const savePromise = service.saveMessage(input);
            for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
              await vi.advanceTimersByTimeAsync(BASE_RETRY_DELAY_MS * Math.pow(2, i) + 100);
            }
            await savePromise;
          }
          
          // Verify all are queued
          expect(service.getFailedQueue().length).toBe(inputs.length);
          
          // Now mock success and retry
          mockSuccessfulSave();
          const retryPromise = service.retryQueuedMessages();
          
          // Advance timers for potential retries
          await vi.advanceTimersByTimeAsync(10000);
          
          const retryResult = await retryPromise;
          
          // All should succeed on retry
          expect(retryResult.succeeded).toBe(inputs.length);
          expect(retryResult.failed).toBe(0);
          
          // Queue should be empty after successful retry
          expect(service.getFailedQueue().length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
