/**
 * Property Tests: Mode Handler
 * 
 * Tests mode-specific response types and conversation history preservation.
 * 
 * **Feature: chat-ux-improvements, Property 1: Mode-Specific Response Type**
 * **Validates: Requirements 1.2, 1.3**
 * 
 * **Feature: chat-ux-improvements, Property 3: Conversation History Preservation**
 * **Validates: Requirements 1.6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ModeHandler,
  createModeHandler,
  hasFileModifications,
  isTextStreamEvent,
  isCodeStreamEvent,
} from '../services/mode-handler';
import type {
  ChatMode,
  AskModeResponse,
  CodeModeResponse,
  ChatMessage,
} from '../types/chat-ux';

/**
 * Arbitrary for generating valid ChatMode values
 */
const chatModeArb = fc.constantFrom<ChatMode>('ask', 'code');

/**
 * Arbitrary for generating valid ChatMessage objects
 */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  id: fc.uuid(),
  projectId: fc.uuid(),
  role: fc.constantFrom<'user' | 'assistant'>('user', 'assistant'),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  mode: chatModeArb,
  attachments: fc.constant([] as ChatMessage['attachments']),
  contextSources: fc.constant([] as ChatMessage['contextSources']),
  fileReadingEvents: fc.constant([] as ChatMessage['fileReadingEvents']),
  createdAt: fc.date(),
});

/**
 * Arbitrary for generating conversation history
 */
const conversationHistoryArb = fc.array(chatMessageArb, { minLength: 0, maxLength: 10 });

/**
 * Arbitrary for generating Ask mode responses
 */
const askModeResponseArb: fc.Arbitrary<AskModeResponse> = fc.record({
  type: fc.constant('text' as const),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  sources: fc.constant([]),
});

/**
 * Arbitrary for generating Code mode responses
 */
const codeModeResponseArb: fc.Arbitrary<CodeModeResponse> = fc.record({
  type: fc.constant('code' as const),
  modifiedFiles: fc.dictionary(
    fc.stringMatching(/^[a-z]+\/[a-z]+\.(tsx?|jsx?|css|json)$/),
    fc.string({ minLength: 10, maxLength: 200 })
  ),
  newFiles: fc.dictionary(
    fc.stringMatching(/^[a-z]+\/[a-z]+\.(tsx?|jsx?|css|json)$/),
    fc.string({ minLength: 10, maxLength: 200 })
  ),
  deletedFiles: fc.array(fc.stringMatching(/^[a-z]+\/[a-z]+\.(tsx?|jsx?|css|json)$/), { maxLength: 3 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

describe('Property 1: Mode-Specific Response Type', () => {
  /**
   * Property: For any prompt in Ask mode, the response SHALL contain only 
   * text content without file modifications.
   * 
   * **Feature: chat-ux-improvements, Property 1: Mode-Specific Response Type**
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Ask mode responses', () => {
    it('should validate Ask mode responses as text type without file modifications', () => {
      fc.assert(
        fc.property(askModeResponseArb, (response) => {
          const modeHandler = createModeHandler('ask');
          
          // Ask mode responses should be valid
          const isValid = modeHandler.validateResponseType(response, 'ask');
          expect(isValid).toBe(true);
          
          // Ask mode responses should NOT have file modifications
          expect(hasFileModifications(response)).toBe(false);
          
          // Response type should be 'text'
          expect(response.type).toBe('text');
          
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('should reject Code mode responses when Ask mode is expected', () => {
      fc.assert(
        fc.property(codeModeResponseArb, (response) => {
          const modeHandler = createModeHandler('ask');
          
          // Code mode responses should NOT be valid for Ask mode
          const isValid = modeHandler.validateResponseType(response, 'ask');
          expect(isValid).toBe(false);
          
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: For any prompt in Code mode, the response SHALL contain 
   * file modifications.
   * 
   * **Feature: chat-ux-improvements, Property 1: Mode-Specific Response Type**
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Code mode responses', () => {
    it('should validate Code mode responses with proper structure', () => {
      fc.assert(
        fc.property(codeModeResponseArb, (response) => {
          const modeHandler = createModeHandler('code');
          
          // Code mode responses should be valid
          const isValid = modeHandler.validateResponseType(response, 'code');
          expect(isValid).toBe(true);
          
          // Response type should be 'code'
          expect(response.type).toBe('code');
          
          // Should have the required structure
          expect(typeof response.modifiedFiles).toBe('object');
          expect(typeof response.newFiles).toBe('object');
          expect(Array.isArray(response.deletedFiles)).toBe(true);
          
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('should reject Ask mode responses when Code mode is expected', () => {
      fc.assert(
        fc.property(askModeResponseArb, (response) => {
          const modeHandler = createModeHandler('code');
          
          // Ask mode responses should NOT be valid for Code mode
          const isValid = modeHandler.validateResponseType(response, 'code');
          expect(isValid).toBe(false);
          
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: hasFileModifications correctly identifies responses with file changes
   */
  describe('File modification detection', () => {
    it('should detect file modifications in Code mode responses', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('code' as const),
            modifiedFiles: fc.dictionary(
              fc.stringMatching(/^[a-z]+\.(tsx?|jsx?)$/),
              fc.string({ minLength: 10 }),
              { minKeys: 1, maxKeys: 3 }
            ),
            newFiles: fc.constant({} as Record<string, string>),
            deletedFiles: fc.constant([] as string[]),
            description: fc.string(),
          }),
          (response) => {
            // Response with modifiedFiles should have file modifications
            expect(hasFileModifications(response)).toBe(true);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should detect new files as file modifications', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('code' as const),
            modifiedFiles: fc.constant({} as Record<string, string>),
            newFiles: fc.dictionary(
              fc.stringMatching(/^[a-z]+\.(tsx?|jsx?)$/),
              fc.string({ minLength: 10 }),
              { minKeys: 1, maxKeys: 3 }
            ),
            deletedFiles: fc.constant([] as string[]),
            description: fc.string(),
          }),
          (response) => {
            // Response with newFiles should have file modifications
            expect(hasFileModifications(response)).toBe(true);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should detect deleted files as file modifications', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('code' as const),
            modifiedFiles: fc.constant({} as Record<string, string>),
            newFiles: fc.constant({} as Record<string, string>),
            deletedFiles: fc.array(
              fc.stringMatching(/^[a-z]+\.(tsx?|jsx?)$/),
              { minLength: 1, maxLength: 3 }
            ),
            description: fc.string(),
          }),
          (response) => {
            // Response with deletedFiles should have file modifications
            expect(hasFileModifications(response)).toBe(true);
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return false for Ask mode responses', () => {
      fc.assert(
        fc.property(askModeResponseArb, (response) => {
          // Ask mode responses should never have file modifications
          expect(hasFileModifications(response)).toBe(false);
          return true;
        }),
        { numRuns: 30 }
      );
    });
  });
});

describe('Property 3: Conversation History Preservation', () => {
  /**
   * Property: For any mode switch operation, the conversation history 
   * length SHALL remain unchanged.
   * 
   * **Feature: chat-ux-improvements, Property 3: Conversation History Preservation**
   * **Validates: Requirements 1.6**
   */
  it('should preserve conversation history length on mode switch', () => {
    fc.assert(
      fc.property(
        conversationHistoryArb,
        chatModeArb,
        chatModeArb,
        (history, initialMode, newMode) => {
          const modeHandler = createModeHandler(initialMode);
          
          // Set initial conversation history
          modeHandler.setConversationHistory(history);
          const lengthBefore = modeHandler.getConversationHistoryLength();
          
          // Switch mode
          modeHandler.setMode(newMode);
          const lengthAfter = modeHandler.getConversationHistoryLength();
          
          // History length should be preserved
          expect(lengthAfter).toBe(lengthBefore);
          expect(lengthAfter).toBe(history.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve conversation history content on mode switch', () => {
    fc.assert(
      fc.property(
        conversationHistoryArb,
        chatModeArb,
        chatModeArb,
        (history, initialMode, newMode) => {
          const modeHandler = createModeHandler(initialMode);
          
          // Set initial conversation history
          modeHandler.setConversationHistory(history);
          const historyBefore = modeHandler.getConversationHistory();
          
          // Switch mode
          modeHandler.setMode(newMode);
          const historyAfter = modeHandler.getConversationHistory();
          
          // History content should be preserved
          expect(historyAfter.length).toBe(historyBefore.length);
          
          for (let i = 0; i < historyBefore.length; i++) {
            expect(historyAfter[i].id).toBe(historyBefore[i].id);
            expect(historyAfter[i].content).toBe(historyBefore[i].content);
            expect(historyAfter[i].role).toBe(historyBefore[i].role);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve history through multiple mode switches', () => {
    fc.assert(
      fc.property(
        conversationHistoryArb,
        fc.array(chatModeArb, { minLength: 1, maxLength: 10 }),
        (history, modeSwitches) => {
          const modeHandler = createModeHandler('ask');
          
          // Set initial conversation history
          modeHandler.setConversationHistory(history);
          const initialLength = history.length;
          
          // Perform multiple mode switches
          for (const mode of modeSwitches) {
            modeHandler.setMode(mode);
            
            // History length should remain constant
            expect(modeHandler.getConversationHistoryLength()).toBe(initialLength);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly report mode after switch', () => {
    fc.assert(
      fc.property(
        chatModeArb,
        chatModeArb,
        (initialMode, newMode) => {
          const modeHandler = createModeHandler(initialMode);
          
          // Initial mode should be set correctly
          expect(modeHandler.getMode()).toBe(initialMode);
          
          // Switch mode
          modeHandler.setMode(newMode);
          
          // New mode should be reported correctly
          expect(modeHandler.getMode()).toBe(newMode);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
