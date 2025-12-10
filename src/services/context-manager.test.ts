/**
 * ContextManager Property-Based Tests
 * 
 * Tests for the ContextManager service using fast-check for property-based testing.
 * 
 * Feature: enhanced-context-management
 * 
 * These tests verify the correctness properties defined in the design document.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ContextManager } from './context-manager';
import type { 
  WorkingMemory, 
  ConversationMessage,
  RelevantFile,
} from '../types/context-management';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

// Mock EmbeddingService
vi.mock('./embedding-service', () => ({
  EmbeddingService: {
    searchRelevantFiles: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock VersionManager
vi.mock('./version-manager', () => ({
  VersionManager: {
    getLatestVersion: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock messageOperations
vi.mock('../../lib/supabase-server', () => ({
  messageOperations: {
    getWithFragments: vi.fn(() => Promise.resolve([])),
  },
}));

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
    vi.clearAllMocks();
  });

  /**
   * Property 1: Context Token Limit
   * *For any* project and prompt combination, the generated context SHALL never 
   * exceed the configured token limit (default 20,000 tokens).
   * 
   * **Feature: enhanced-context-management, Property 1: Context Token Limit**
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: Context Token Limit', () => {
    it('should never exceed the configured token limit for any context', async () => {
      const MAX_CONTEXT_TOKENS = 20000;
      const CHARS_PER_TOKEN = 4;
      const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

      await fc.assert(
        fc.asyncProperty(
          // Generate random conversation history
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
              content: fc.string({ minLength: 0, maxLength: 5000 }),
            }),
            { minLength: 0, maxLength: 30 }
          ),
          // Generate random relevant files
          fc.array(
            fc.record({
              path: fc.string({ minLength: 1, maxLength: 100 }),
              content: fc.string({ minLength: 0, maxLength: 10000 }),
              relevance: fc.double({ min: 0, max: 1 }),
              reason: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          // Generate random file tree
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 100 }),
          async (conversationHistory, relevantFiles, fileTree) => {
            // Create working memory with the generated data
            const workingMemory: WorkingMemory = {
              conversationHistory: conversationHistory as ConversationMessage[],
              recentFiles: [],
              currentPrompt: 'test prompt',
            };

            // Apply truncation using the private method (accessed via any)
            const truncated = (contextManager as any).applyTruncation({
              workingMemory,
              relevantFiles: relevantFiles as RelevantFile[],
              fileTree,
            });

            // Calculate total size of truncated context
            const historySize = JSON.stringify(truncated.workingMemory.conversationHistory).length;
            const filesSize = truncated.relevantFiles.reduce(
              (sum: number, f: RelevantFile) => sum + f.content.length, 
              0
            );
            const treeSize = truncated.fileTree.join('\n').length;
            const totalSize = historySize + filesSize + treeSize;

            // Verify total size is within limits
            expect(totalSize).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should estimate tokens correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 10000 }),
          (text) => {
            const tokens = contextManager.estimateTokens(text);
            // Tokens should be approximately text.length / 4
            expect(tokens).toBe(Math.ceil(text.length / 4));
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 2: File Reference Priority
   * *For any* prompt that explicitly references a file by name, that file SHALL 
   * appear in the context with relevance score >= 0.99.
   * 
   * **Feature: enhanced-context-management, Property 2: File Reference Priority**
   * **Validates: Requirements 1.5**
   */
  describe('Property 2: File Reference Priority', () => {
    const EXPLICIT_REFERENCE_RELEVANCE = 0.99;

    it('should give explicitly referenced files relevance >= 0.99 in findRelevantFiles', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid file name (alphanumeric with common extensions)
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}\.(tsx?|jsx?|css|json)$/),
          // Generate file content (non-empty)
          fc.string({ minLength: 10, maxLength: 500 }),
          async (fileName, fileContent) => {
            const filePath = `components/${fileName}`;
            const allFiles: Record<string, string> = {
              [filePath]: fileContent,
              'other-file.ts': 'export const x = 1;',
              'another-file.tsx': 'export const Component = () => <div />;',
            };

            // Create a prompt that explicitly references the file using backticks
            const prompt = `Please modify the file \`${fileName}\` to add a new function`;

            // Call findRelevantFiles (private method accessed via any)
            const relevantFiles = await (contextManager as any).findRelevantFiles(
              'test-project-id',
              prompt,
              allFiles,
              undefined,
              { messageLimit: 20, maxFiles: 10, includeTests: false, isGitHubProject: false }
            );

            // Find the explicitly referenced file in results
            const referencedFile = relevantFiles.find(
              (f: RelevantFile) => f.path === filePath
            );

            // The file MUST be found and have relevance >= 0.99
            expect(referencedFile).toBeDefined();
            if (referencedFile) {
              expect(referencedFile.relevance).toBeGreaterThanOrEqual(EXPLICIT_REFERENCE_RELEVANCE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should find files referenced with various prompt patterns', () => {
      const testCases = [
        { prompt: 'edit header.tsx', file: 'components/header.tsx' },
        { prompt: 'modify `utils.ts`', file: 'lib/utils.ts' },
        { prompt: 'fix "api.ts"', file: 'src/api.ts' },
        { prompt: 'update file: config.json', file: 'config.json' },
        { prompt: 'change `Button.tsx`', file: 'components/Button.tsx' },
        { prompt: 'in sidebar.tsx add a new item', file: 'components/sidebar.tsx' },
      ];

      for (const { prompt, file } of testCases) {
        const allFiles: Record<string, string> = {
          [file]: 'export const content = "test";',
          'other.ts': 'other content',
        };

        const refs = (contextManager as any).findExplicitFileReferences(prompt, allFiles);
        expect(refs, `Expected "${file}" to be found for prompt: "${prompt}"`).toContain(file);
      }
    });

    it('should give exact content matches (quoted code) relevance >= 0.99', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a unique code snippet (alphanumeric to avoid regex issues)
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{14,50}$/),
          async (codeSnippet) => {
            const allFiles: Record<string, string> = {
              'target.ts': `function test() {\n  ${codeSnippet}\n}`,
              'other.ts': 'export const x = 1;',
            };

            // Create a prompt with the exact code snippet quoted
            const prompt = `I see this code: "${codeSnippet}" - can you explain it?`;

            // Call findRelevantFiles
            const relevantFiles = await (contextManager as any).findRelevantFiles(
              'test-project-id',
              prompt,
              allFiles,
              undefined,
              { messageLimit: 20, maxFiles: 10, includeTests: false, isGitHubProject: false }
            );

            // Find the target file
            const targetFile = relevantFiles.find(
              (f: RelevantFile) => f.path === 'target.ts'
            );

            // The file with exact content match MUST be found with high relevance
            expect(targetFile).toBeDefined();
            if (targetFile) {
              expect(targetFile.relevance).toBeGreaterThanOrEqual(EXPLICIT_REFERENCE_RELEVANCE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize explicitly referenced files over semantic matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a file name
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,15}\.(tsx?|jsx?)$/),
          async (fileName) => {
            const explicitFilePath = `components/${fileName}`;
            const allFiles: Record<string, string> = {
              [explicitFilePath]: 'export const ExplicitComponent = () => <div>Explicit</div>;',
              'components/semantic-match.tsx': 'export const SemanticComponent = () => <div>Semantic</div>;',
              'lib/utils.ts': 'export const helper = () => {};',
            };

            // Prompt explicitly references the file
            const prompt = `Update \`${fileName}\` to add a button`;

            const relevantFiles = await (contextManager as any).findRelevantFiles(
              'test-project-id',
              prompt,
              allFiles,
              undefined,
              { messageLimit: 20, maxFiles: 10, includeTests: false, isGitHubProject: false }
            );

            // The explicitly referenced file should be first (highest relevance)
            if (relevantFiles.length > 0) {
              const explicitFile = relevantFiles.find(
                (f: RelevantFile) => f.path === explicitFilePath
              );
              expect(explicitFile).toBeDefined();
              
              // If there are other files, the explicit one should have higher or equal relevance
              for (const file of relevantFiles) {
                if (file.path !== explicitFilePath && explicitFile) {
                  expect(explicitFile.relevance).toBeGreaterThanOrEqual(file.relevance);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Conversation History Limit
   * *For any* context build operation, the conversation history SHALL contain 
   * at most 20 messages.
   * 
   * **Feature: enhanced-context-management, Property 3: Conversation History Limit**
   * **Validates: Requirements 1.2**
   */
  describe('Property 3: Conversation History Limit', () => {
    const MAX_MESSAGE_LIMIT = 20;

    it('should never exceed 20 messages in conversation history after truncation', () => {
      fc.assert(
        fc.property(
          // Generate random number of messages (potentially more than 20)
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
              // Use short content to ensure message count is the limiting factor, not character budget
              content: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (messages) => {
            const workingMemory: WorkingMemory = {
              conversationHistory: messages as ConversationMessage[],
              recentFiles: [],
              currentPrompt: 'test',
            };

            // Apply truncation with message limit enforcement
            const truncated = (contextManager as any).applyTruncationWithMessageLimit({
              workingMemory,
              relevantFiles: [],
              fileTree: [],
            }, MAX_MESSAGE_LIMIT);

            // Conversation history should NEVER exceed 20 messages
            expect(truncated.workingMemory.conversationHistory.length).toBeLessThanOrEqual(MAX_MESSAGE_LIMIT);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve most recent messages when truncating to 20 message limit', () => {
      fc.assert(
        fc.property(
          // Generate more than 20 messages to force truncation
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
              content: fc.string({ minLength: 10, maxLength: 50 }),
            }),
            { minLength: 25, maxLength: 50 }
          ),
          (messages) => {
            const workingMemory: WorkingMemory = {
              conversationHistory: messages as ConversationMessage[],
              recentFiles: [],
              currentPrompt: 'test',
            };

            const truncated = (contextManager as any).applyTruncationWithMessageLimit({
              workingMemory,
              relevantFiles: [],
              fileTree: [],
            }, MAX_MESSAGE_LIMIT);

            const truncatedHistory = truncated.workingMemory.conversationHistory;
            
            // The truncated history should contain the most recent messages
            // Verify the last N messages match (where N is the truncated length)
            const expectedMessages = messages.slice(-truncatedHistory.length);
            
            for (let i = 0; i < truncatedHistory.length; i++) {
              expect(truncatedHistory[i].content).toBe(expectedMessages[i].content);
              expect(truncatedHistory[i].role).toBe(expectedMessages[i].role);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should keep all messages when under the 20 message limit', () => {
      fc.assert(
        fc.property(
          // Generate fewer than 20 messages
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
              content: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 19 }
          ),
          (messages) => {
            const workingMemory: WorkingMemory = {
              conversationHistory: messages as ConversationMessage[],
              recentFiles: [],
              currentPrompt: 'test',
            };

            const truncated = (contextManager as any).applyTruncationWithMessageLimit({
              workingMemory,
              relevantFiles: [],
              fileTree: [],
            }, MAX_MESSAGE_LIMIT);

            // When under the limit, all messages should be preserved
            expect(truncated.workingMemory.conversationHistory.length).toBe(messages.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
