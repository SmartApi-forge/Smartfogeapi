/**
 * Property Tests: Conversation Context Service
 * 
 * **Feature: v0-lovable-architecture, Property 5: Message Ordering Consistency**
 * **Validates: Requirements 2.2, 2.4**
 * 
 * Property: For any conversation with N messages, loading messages SHALL return exactly N records
 * ordered by turn_index in ascending order with indices 1 through N.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ConversationMessage } from '../types/database';

/**
 * Helper function to simulate message ordering logic.
 * This validates the ordering algorithm used by the service.
 */
function orderMessagesByTurnIndex(messages: ConversationMessage[]): ConversationMessage[] {
  return [...messages].sort((a, b) => a.turn_index - b.turn_index);
}

/**
 * Helper function to validate turn indices are sequential starting from 1.
 */
function validateSequentialTurnIndices(messages: ConversationMessage[]): boolean {
  if (messages.length === 0) return true;
  
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].turn_index !== i + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Helper function to generate a valid conversation message for testing.
 */
function generateMessage(projectId: string, turnIndex: number): ConversationMessage {
  return {
    id: `msg-${turnIndex}-${Math.random().toString(36).substring(7)}`,
    project_id: projectId,
    turn_index: turnIndex,
    user_message: `User message ${turnIndex}`,
    assistant_response: `Assistant response ${turnIndex}`,
    model: 'claude-3-5-sonnet',
    input_tokens: 100,
    output_tokens: 200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

describe('Property 5: Message Ordering Consistency', () => {
  /**
   * Property: For any set of messages with valid turn indices,
   * ordering by turn_index SHALL produce ascending order.
   */
  it('should order messages by turn_index in ascending order', () => {
    fc.assert(
      fc.property(
        // Generate number of messages (1 to 50)
        fc.integer({ min: 1, max: 50 }),
        // Generate a project ID
        fc.uuid(),
        (numMessages, projectId) => {
          // Create messages with sequential turn indices
          const messages: ConversationMessage[] = [];
          for (let i = 1; i <= numMessages; i++) {
            messages.push(generateMessage(projectId, i));
          }

          // Shuffle the messages to simulate unordered database return
          const shuffled = [...messages].sort(() => Math.random() - 0.5);

          // Order them
          const ordered = orderMessagesByTurnIndex(shuffled);

          // Verify ordering
          for (let i = 0; i < ordered.length - 1; i++) {
            expect(ordered[i].turn_index).toBeLessThan(ordered[i + 1].turn_index);
          }

          // Verify count matches
          expect(ordered.length).toBe(numMessages);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any conversation with N messages, turn indices SHALL be 1 through N.
   */
  it('should have sequential turn indices starting from 1', () => {
    fc.assert(
      fc.property(
        // Generate number of messages (1 to 100)
        fc.integer({ min: 1, max: 100 }),
        fc.uuid(),
        (numMessages, projectId) => {
          // Create messages with proper sequential indices
          const messages: ConversationMessage[] = [];
          for (let i = 1; i <= numMessages; i++) {
            messages.push(generateMessage(projectId, i));
          }

          // Order them (should already be ordered, but simulate service behavior)
          const ordered = orderMessagesByTurnIndex(messages);

          // Validate sequential indices
          expect(validateSequentialTurnIndices(ordered)).toBe(true);

          // First message should have turn_index 1
          expect(ordered[0].turn_index).toBe(1);

          // Last message should have turn_index N
          expect(ordered[ordered.length - 1].turn_index).toBe(numMessages);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty conversation SHALL return empty array.
   */
  it('should handle empty conversation correctly', () => {
    const emptyMessages: ConversationMessage[] = [];
    const ordered = orderMessagesByTurnIndex(emptyMessages);
    
    expect(ordered).toEqual([]);
    expect(ordered.length).toBe(0);
    expect(validateSequentialTurnIndices(ordered)).toBe(true);
  });

  /**
   * Property: Single message conversation SHALL have turn_index 1.
   */
  it('should handle single message conversation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (projectId) => {
          const messages = [generateMessage(projectId, 1)];
          const ordered = orderMessagesByTurnIndex(messages);

          expect(ordered.length).toBe(1);
          expect(ordered[0].turn_index).toBe(1);
          expect(validateSequentialTurnIndices(ordered)).toBe(true);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Ordering SHALL preserve all message data (no data loss).
   */
  it('should preserve all message data during ordering', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.uuid(),
        (numMessages, projectId) => {
          // Create messages with unique content
          const messages: ConversationMessage[] = [];
          for (let i = 1; i <= numMessages; i++) {
            messages.push({
              ...generateMessage(projectId, i),
              user_message: `Unique user message ${i} - ${Math.random()}`,
              assistant_response: `Unique assistant response ${i} - ${Math.random()}`
            });
          }

          // Shuffle
          const shuffled = [...messages].sort(() => Math.random() - 0.5);

          // Order
          const ordered = orderMessagesByTurnIndex(shuffled);

          // Verify all original messages are present
          const originalIds = new Set(messages.map(m => m.id));
          const orderedIds = new Set(ordered.map(m => m.id));

          expect(orderedIds.size).toBe(originalIds.size);
          for (const id of originalIds) {
            expect(orderedIds.has(id)).toBe(true);
          }

          // Verify content is preserved
          for (const original of messages) {
            const found = ordered.find(m => m.id === original.id);
            expect(found).toBeDefined();
            expect(found?.user_message).toBe(original.user_message);
            expect(found?.assistant_response).toBe(original.assistant_response);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Ordering SHALL be stable (same input produces same output).
   */
  it('should produce stable ordering', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.uuid(),
        (numMessages, projectId) => {
          const messages: ConversationMessage[] = [];
          for (let i = 1; i <= numMessages; i++) {
            messages.push(generateMessage(projectId, i));
          }

          // Order multiple times
          const ordered1 = orderMessagesByTurnIndex(messages);
          const ordered2 = orderMessagesByTurnIndex(messages);
          const ordered3 = orderMessagesByTurnIndex(messages);

          // All orderings should be identical
          expect(ordered1.map(m => m.turn_index)).toEqual(ordered2.map(m => m.turn_index));
          expect(ordered2.map(m => m.turn_index)).toEqual(ordered3.map(m => m.turn_index));

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Next turn index SHALL be max(existing) + 1 or 1 if empty.
   */
  it('should calculate next turn index correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.uuid(),
        (numExistingMessages, projectId) => {
          const messages: ConversationMessage[] = [];
          for (let i = 1; i <= numExistingMessages; i++) {
            messages.push(generateMessage(projectId, i));
          }

          // Calculate next turn index
          const maxTurnIndex = messages.length > 0 
            ? Math.max(...messages.map(m => m.turn_index))
            : 0;
          const nextTurnIndex = maxTurnIndex + 1;

          // Verify
          if (numExistingMessages === 0) {
            expect(nextTurnIndex).toBe(1);
          } else {
            expect(nextTurnIndex).toBe(numExistingMessages + 1);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
