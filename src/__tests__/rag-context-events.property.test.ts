/**
 * Property Tests: RAG Context Events
 * 
 * Tests RAG context retrieval event emission requirements.
 * 
 * **Feature: chat-ux-improvements, Property 14: RAG Context Events**
 * **Validates: Requirements 6.1, 6.3**
 * 
 * Property: For any RAG retrieval operation, the system SHALL emit 
 * context:retrieved events with source information and relevance scores.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createChatStreamEmitter,
} from '../services/chat-stream-emitter';
import type { 
  ChatStreamEvent, 
  ContextRetrievedStreamEvent,
  ContextSource 
} from '../types/chat-ux';

/**
 * Helper to generate valid context sources with relevance scores
 */
const contextSourceArbitrary = fc.record({
  type: fc.constantFrom('file', 'embedding', 'project_knowledge', 'conversation') as fc.Arbitrary<ContextSource['type']>,
  path: fc.option(
    fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/).map(name => `src/${name}.ts`),
    { nil: undefined }
  ),
  relevanceScore: fc.option(
    fc.float({ min: 0, max: 1, noNaN: true }),
    { nil: undefined }
  ),
  truncated: fc.option(fc.boolean(), { nil: undefined }),
  memoryLayer: fc.option(
    fc.constantFrom('working', 'long_term') as fc.Arbitrary<'working' | 'long_term'>,
    { nil: undefined }
  ),
});

/**
 * Helper to generate arrays of context sources
 */
const contextSourcesArbitrary = fc.array(contextSourceArbitrary, { minLength: 1, maxLength: 10 });

/**
 * Helper to generate token counts
 */
const tokenCountArbitrary = fc.integer({ min: 100, max: 50000 });

/**
 * Emit context:retrieved event synchronously for testing
 */
function emitContextRetrievedSync(
  emitter: ReturnType<typeof createChatStreamEmitter>,
  sources: ContextSource[],
  truncated: boolean,
  tokenCount: number
): void {
  emitter.emitImmediate({
    type: 'context:retrieved',
    sources,
    truncated,
    tokenCount,
    timestamp: Date.now(),
  });
}

describe('Property 14: RAG Context Events', () => {
  /**
   * Property: For any RAG retrieval operation, the system SHALL emit 
   * context:retrieved events with source information.
   * 
   * **Validates: Requirements 6.1**
   */
  it('should emit context:retrieved event with source information', () => {
    fc.assert(
      fc.property(
        contextSourcesArbitrary,
        fc.boolean(),
        tokenCountArbitrary,
        (sources, truncated, tokenCount) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit context:retrieved event
          emitContextRetrievedSync(emitter, sources, truncated, tokenCount);

          // Find the context:retrieved event
          const contextEvent = events.find(
            (e): e is ContextRetrievedStreamEvent => e.type === 'context:retrieved'
          );

          // Verify the event exists
          expect(contextEvent).toBeDefined();

          // Verify sources are included
          expect(contextEvent!.sources).toBeDefined();
          expect(contextEvent!.sources.length).toBe(sources.length);

          // Verify each source has required type field
          for (const source of contextEvent!.sources) {
            expect(source.type).toBeDefined();
            expect(['file', 'embedding', 'project_knowledge', 'conversation']).toContain(source.type);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any RAG retrieval with file sources, the system SHALL 
   * include relevance scores for embedding matches.
   * 
   * **Validates: Requirements 6.3**
   */
  it('should include relevance scores for file sources when provided', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constant('file') as fc.Arbitrary<'file'>,
            path: fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/).map(name => `src/${name}.ts`),
            relevanceScore: fc.float({ min: 0, max: 1, noNaN: true }),
            memoryLayer: fc.constantFrom('working', 'long_term') as fc.Arbitrary<'working' | 'long_term'>,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        tokenCountArbitrary,
        (fileSources, tokenCount) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit context:retrieved event with file sources
          emitContextRetrievedSync(emitter, fileSources, false, tokenCount);

          // Find the context:retrieved event
          const contextEvent = events.find(
            (e): e is ContextRetrievedStreamEvent => e.type === 'context:retrieved'
          );

          // Verify relevance scores are preserved
          for (let i = 0; i < fileSources.length; i++) {
            const originalSource = fileSources[i];
            const emittedSource = contextEvent!.sources[i];
            
            expect(emittedSource.relevanceScore).toBe(originalSource.relevanceScore);
            expect(emittedSource.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(emittedSource.relevanceScore).toBeLessThanOrEqual(1);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any RAG retrieval, the system SHALL include token count.
   * 
   * **Validates: Requirements 6.1**
   */
  it('should include token count in context:retrieved event', () => {
    fc.assert(
      fc.property(
        contextSourcesArbitrary,
        fc.boolean(),
        tokenCountArbitrary,
        (sources, truncated, tokenCount) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit context:retrieved event
          emitContextRetrievedSync(emitter, sources, truncated, tokenCount);

          // Find the context:retrieved event
          const contextEvent = events.find(
            (e): e is ContextRetrievedStreamEvent => e.type === 'context:retrieved'
          );

          // Verify token count is included and matches
          expect(contextEvent!.tokenCount).toBe(tokenCount);
          expect(contextEvent!.tokenCount).toBeGreaterThanOrEqual(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any RAG retrieval, the system SHALL preserve memory layer information.
   * 
   * **Validates: Requirements 6.1**
   */
  it('should preserve memory layer information for sources', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('file', 'embedding') as fc.Arbitrary<'file' | 'embedding'>,
            path: fc.option(
              fc.stringMatching(/^[a-z][a-z0-9-]{2,10}$/).map(name => `src/${name}.ts`),
              { nil: undefined }
            ),
            memoryLayer: fc.constantFrom('working', 'long_term') as fc.Arbitrary<'working' | 'long_term'>,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        tokenCountArbitrary,
        (sources, tokenCount) => {
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit context:retrieved event
          emitContextRetrievedSync(emitter, sources, false, tokenCount);

          // Find the context:retrieved event
          const contextEvent = events.find(
            (e): e is ContextRetrievedStreamEvent => e.type === 'context:retrieved'
          );

          // Verify memory layer is preserved for each source
          for (let i = 0; i < sources.length; i++) {
            const originalSource = sources[i];
            const emittedSource = contextEvent!.sources[i];
            
            expect(emittedSource.memoryLayer).toBe(originalSource.memoryLayer);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context:retrieved event should have a valid timestamp.
   */
  it('should emit context:retrieved event with valid timestamp', () => {
    fc.assert(
      fc.property(
        contextSourcesArbitrary,
        fc.boolean(),
        tokenCountArbitrary,
        (sources, truncated, tokenCount) => {
          const beforeTime = Date.now();
          const events: ChatStreamEvent[] = [];
          const emitter = createChatStreamEmitter(
            (event) => events.push(event),
            performance.now()
          );

          // Emit context:retrieved event
          emitContextRetrievedSync(emitter, sources, truncated, tokenCount);
          const afterTime = Date.now();

          // Find the context:retrieved event
          const contextEvent = events.find(
            (e): e is ContextRetrievedStreamEvent => e.type === 'context:retrieved'
          );

          // Verify timestamp is within expected range
          expect(contextEvent!.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(contextEvent!.timestamp).toBeLessThanOrEqual(afterTime);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
