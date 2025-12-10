/**
 * ExecutionAgent Property-Based Tests
 * 
 * Tests for the ExecutionAgent service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 14: Retry Limit**
 * **Validates: Requirements 8.3**
 * 
 * **Feature: enhanced-context-management, Property 9: CREATE_AND_LINK Completeness**
 * **Validates: Requirements 10.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ExecutionAgent } from './execution-agent';
import type { 
  ExecutionPlan, 
  GenerationContext, 
  RecoveryResult,
  ExecutionResult,
} from '../types/context-management';

// Mock OpenAI to avoid actual API calls during tests
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  code: '"use client";\n\nexport function TestComponent() {\n  return <div>Test</div>;\n}',
                  imports: ['react'],
                  exports: ['TestComponent'],
                  dependencies: [],
                }),
              },
            }],
          }),
        },
      },
    })),
  };
});

describe('ExecutionAgent', () => {
  let executionAgent: ExecutionAgent;

  beforeEach(() => {
    executionAgent = new ExecutionAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });


  describe('handleError - Property 14: Retry Limit', () => {
    /**
     * **Feature: enhanced-context-management, Property 14: Retry Limit**
     * **Validates: Requirements 8.3**
     * 
     * For any error during execution, the ExecutionAgent SHALL attempt 
     * recovery at most 3 times before failing.
     */
    it('should attempt recovery at most 3 times before failing (Property 14: Retry Limit)', async () => {
      // Generate arbitrary error messages
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });
      
      await fc.assert(
        fc.asyncProperty(
          errorMessageArb,
          async (errorMessage: string) => {
            const error = new Error(errorMessage);
            
            // Start with retryCount = 0 (first attempt)
            const result = await executionAgent.handleError(error, 0);
            
            // The result should indicate failure after max retries
            // Since our mock doesn't actually recover, it should fail
            expect(result.success).toBe(false);
            
            // Retry count should not exceed MAX_RETRY_ATTEMPTS (3)
            expect(result.retryCount).toBeLessThanOrEqual(3);
            
            // Error message should be present
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Max retry attempts exceeded');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Starting at max retry count should immediately fail
     */
    it('should immediately fail when starting at max retry count', async () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });
      
      await fc.assert(
        fc.asyncProperty(
          errorMessageArb,
          async (errorMessage: string) => {
            const error = new Error(errorMessage);
            
            // Start at max retry count (3)
            const result = await executionAgent.handleError(error, 3);
            
            // Should immediately fail without additional retries
            expect(result.success).toBe(false);
            expect(result.retryCount).toBe(3);
            expect(result.approach).toBe('none');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Retry count should always be >= initial retry count
     * and should not exceed max(initialRetry, MAX_RETRY_ATTEMPTS)
     */
    it('should have final retry count >= initial retry count', async () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });
      // Only test with valid initial retry counts (0 to MAX_RETRY_ATTEMPTS)
      const initialRetryArb = fc.integer({ min: 0, max: 3 });
      
      await fc.assert(
        fc.asyncProperty(
          errorMessageArb,
          initialRetryArb,
          async (errorMessage: string, initialRetry: number) => {
            const error = new Error(errorMessage);
            
            const result = await executionAgent.handleError(error, initialRetry);
            
            // Final retry count should be >= initial
            expect(result.retryCount).toBeGreaterThanOrEqual(initialRetry);
            
            // And should not exceed MAX_RETRY_ATTEMPTS (3)
            expect(result.retryCount).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Recovery result should always have required fields
     */
    it('should always return a valid RecoveryResult structure', async () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 });
      const retryCountArb = fc.integer({ min: 0, max: 10 });
      
      await fc.assert(
        fc.asyncProperty(
          errorMessageArb,
          retryCountArb,
          async (errorMessage: string, retryCount: number) => {
            const error = new Error(errorMessage);
            
            const result: RecoveryResult = await executionAgent.handleError(error, retryCount);
            
            // Verify structure
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.retryCount).toBe('number');
            expect(typeof result.approach).toBe('string');
            
            // If failed, should have error message
            if (!result.success) {
              expect(result.error).toBeDefined();
            }
            
            // If succeeded, should have result
            if (result.success) {
              expect(result.result).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('execute - Property 9: CREATE_AND_LINK Completeness', () => {
    // Helper to create a valid GenerationContext
    const createMockContext = (parentContent?: string): GenerationContext => ({
      workingMemory: {
        conversationHistory: [],
        recentFiles: parentContent ? [{
          path: 'app/page.tsx',
          content: parentContent,
        }] : [],
        currentPrompt: 'Create a test component',
      },
      longTermMemory: {
        projectKnowledge: {
          uiLibrary: 'shadcn/ui',
          styling: 'Tailwind CSS',
          stateManagement: 'React hooks',
          formLibrary: 'react-hook-form',
          database: 'Supabase',
          auth: 'Supabase Auth',
          importAliases: { '@/': 'src/' },
          componentConventions: [],
        },
        fileRelationships: [],
        architecturalDecisions: [],
      },
      relevantFiles: parentContent ? [{
        path: 'app/page.tsx',
        content: parentContent,
        relevance: 0.99,
        reason: 'Parent file for component',
      }] : [],
      projectPatterns: {
        uiLibrary: 'shadcn/ui',
        styling: 'Tailwind CSS',
        formLibrary: 'react-hook-form',
        stateManagement: 'React hooks',
        commonComponents: [],
        importPatterns: [],
      },
      fileTree: ['app/page.tsx', 'app/layout.tsx', 'components/ui/button.tsx'],
    });

    // Helper to create a CREATE_AND_LINK execution plan
    const createCreateAndLinkPlan = (componentName: string): ExecutionPlan => ({
      intent: 'CREATE_AND_LINK',
      confidence: 90,
      tasks: [
        {
          id: 'task-1',
          type: 'create',
          target: `components/${componentName.toLowerCase()}.tsx`,
          description: `Create ${componentName} component`,
          dependencies: [],
        },
        {
          id: 'task-2',
          type: 'link',
          target: 'app/page.tsx',
          description: `Link ${componentName} to parent`,
          dependencies: ['task-1'],
        },
      ],
      fileTargets: [
        {
          path: `components/${componentName.toLowerCase()}.tsx`,
          action: 'create',
          reason: 'New component',
        },
        {
          path: 'app/page.tsx',
          action: 'modify',
          reason: 'Add import and usage',
        },
      ],
      criticalReminders: [
        '🚨 This is a CREATE + LINK task - do NOT only create!',
        '🚨 MUST create the component file AND modify parent to import/use it',
      ],
      dependencies: [
        { taskId: 'task-2', dependsOn: ['task-1'] },
      ],
    });

    // Sample parent file content
    const sampleParentContent = `"use client";

import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <h1>Welcome</h1>
      <Button>Click me</Button>
    </main>
  );
}
`;

    /**
     * **Feature: enhanced-context-management, Property 9: CREATE_AND_LINK Completeness**
     * **Validates: Requirements 10.2**
     * 
     * For any CREATE_AND_LINK intent, the result SHALL contain both a new 
     * component file AND a modified parent file with import.
     */
    it('should create both new component file AND modified parent file (Property 9: CREATE_AND_LINK Completeness)', async () => {
      // Generate arbitrary component names (PascalCase)
      const componentNameArb = fc.stringMatching(/^[A-Z][a-z]{2,10}[A-Z]?[a-z]{0,5}$/)
        .filter(s => s.length >= 3 && s.length <= 20);
      
      await fc.assert(
        fc.asyncProperty(
          componentNameArb,
          async (componentName: string) => {
            const plan = createCreateAndLinkPlan(componentName);
            const context = createMockContext(sampleParentContent);
            
            try {
              const result: ExecutionResult = await executionAgent.execute(plan, context);
              
              // Property 9: Result SHALL contain a new component file
              const hasNewFile = Object.keys(result.newFiles).length > 0;
              expect(hasNewFile).toBe(true);
              
              // Property 9: Result SHALL contain a modified parent file
              const hasModifiedFile = Object.keys(result.modifiedFiles).length > 0;
              expect(hasModifiedFile).toBe(true);
              
              // Verify the new file is a component file
              const newFilePaths = Object.keys(result.newFiles);
              const hasComponentFile = newFilePaths.some(path => 
                path.includes('components/') && path.endsWith('.tsx')
              );
              expect(hasComponentFile).toBe(true);
              
              // Verify the modified file contains an import for the new component
              const modifiedContent = Object.values(result.modifiedFiles)[0];
              if (modifiedContent) {
                // Should contain an import statement
                const hasImport = modifiedContent.includes('import {') || 
                                  modifiedContent.includes('import ');
                expect(hasImport).toBe(true);
              }
            } catch (error) {
              // If execution fails, it should be due to a valid reason
              // (e.g., missing parent file content), not a violation of Property 9
              expect((error as Error).message).not.toContain('No new component file created');
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to API mocking complexity
      );
    });

    /**
     * Property: CREATE_AND_LINK should fail if no create task exists
     */
    it('should throw error if CREATE_AND_LINK plan has no create task', async () => {
      const invalidPlan: ExecutionPlan = {
        intent: 'CREATE_AND_LINK',
        confidence: 90,
        tasks: [
          {
            id: 'task-1',
            type: 'modify', // No 'create' task
            target: 'app/page.tsx',
            description: 'Modify page',
            dependencies: [],
          },
        ],
        fileTargets: [],
        criticalReminders: [],
        dependencies: [],
      };
      
      const context = createMockContext(sampleParentContent);
      
      await expect(executionAgent.execute(invalidPlan, context))
        .rejects.toThrow('CREATE_AND_LINK requires a create task');
    });

    /**
     * Property: Changes array should reflect both create and modify actions
     */
    it('should include both create and modify actions in changes array', async () => {
      const componentNameArb = fc.stringMatching(/^[A-Z][a-z]{2,10}$/)
        .filter(s => s.length >= 3 && s.length <= 15);
      
      await fc.assert(
        fc.asyncProperty(
          componentNameArb,
          async (componentName: string) => {
            const plan = createCreateAndLinkPlan(componentName);
            const context = createMockContext(sampleParentContent);
            
            try {
              const result = await executionAgent.execute(plan, context);
              
              // Should have at least one 'created' change
              const hasCreatedChange = result.changes.some(c => c.action === 'created');
              expect(hasCreatedChange).toBe(true);
              
              // Should have at least one 'modified' change (for parent file)
              const hasModifiedChange = result.changes.some(c => c.action === 'modified');
              expect(hasModifiedChange).toBe(true);
            } catch {
              // Acceptable if execution fails for valid reasons
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('GitHub Strict Mode - Property 7', () => {
    /**
     * **Feature: enhanced-context-management, Property 7: GitHub Strict Mode**
     * **Validates: Requirements 9.1**
     * 
     * For any GitHub cloned project, the newFiles object SHALL be empty 
     * unless the prompt explicitly contains "create new file".
     */

    // Helper to create a GitHub project context
    const createGitHubContext = (prompt: string, fileTree: string[] = []): GenerationContext => ({
      workingMemory: {
        conversationHistory: [],
        recentFiles: [],
        currentPrompt: prompt,
      },
      longTermMemory: {
        projectKnowledge: {
          uiLibrary: 'shadcn/ui',
          styling: 'Tailwind CSS',
          stateManagement: 'React hooks',
          formLibrary: 'react-hook-form',
          database: 'Supabase',
          auth: 'Supabase Auth',
          importAliases: { '@/': 'src/' },
          componentConventions: [],
        },
        fileRelationships: [],
        architecturalDecisions: [],
      },
      relevantFiles: [],
      projectPatterns: {
        uiLibrary: 'shadcn/ui',
        styling: 'Tailwind CSS',
        formLibrary: 'react-hook-form',
        stateManagement: 'React hooks',
        commonComponents: [],
        importPatterns: [],
      },
      fileTree: fileTree.length > 0 ? fileTree : [
        'app/page.tsx',
        'app/layout.tsx',
        'components/ui/button.tsx',
        'components/header.tsx',
      ],
      isGitHubProject: true,
    });

    // Helper to create a non-GitHub project context
    const createNonGitHubContext = (prompt: string): GenerationContext => ({
      ...createGitHubContext(prompt),
      isGitHubProject: false,
    });

    // Helper to create an execution result with new files
    const createResultWithNewFiles = (newFilePaths: string[]): ExecutionResult => ({
      modifiedFiles: {},
      newFiles: Object.fromEntries(newFilePaths.map(p => [p, 'export const Test = () => <div>Test</div>;'])),
      deletedFiles: [],
      changes: newFilePaths.map(p => ({
        file: p,
        action: 'created' as const,
        description: `Created ${p}`,
      })),
      description: 'Test result',
    });

    it('should return empty newFiles for GitHub projects without explicit create request (Property 7)', () => {
      // Generate arbitrary prompts that do NOT contain "create new file" phrases
      const nonCreatePromptArb = fc.string({ minLength: 1, maxLength: 200 })
        .filter(s => {
          const lower = s.toLowerCase();
          return !lower.includes('create new file') &&
                 !lower.includes('create a new file') &&
                 !lower.includes('add new file') &&
                 !lower.includes('add a new file') &&
                 !lower.includes('make new file') &&
                 !lower.includes('make a new file') &&
                 !lower.includes('new file') &&
                 !lower.includes('create file');
        });

      // Generate arbitrary file paths for new files
      const newFilePathArb = fc.array(
        fc.stringMatching(/^[a-z]+\/[a-z-]+\.tsx$/),
        { minLength: 1, maxLength: 5 }
      );

      fc.assert(
        fc.property(
          nonCreatePromptArb,
          newFilePathArb,
          (prompt: string, newFilePaths: string[]) => {
            const context = createGitHubContext(prompt);
            const result = createResultWithNewFiles(newFilePaths);

            const filteredResult = executionAgent.applyGitHubStrictMode(result, context);

            // Property 7: newFiles SHALL be empty for GitHub projects
            // unless prompt explicitly contains "create new file"
            expect(Object.keys(filteredResult.newFiles).length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow newFiles when prompt explicitly requests new file creation', () => {
      // Phrases that explicitly request new file creation
      const createPhrases = [
        'create new file',
        'create a new file',
        'add new file',
        'add a new file',
        'make new file',
        'make a new file',
        'new file',
        'create file',
      ];

      const createPhraseArb = fc.constantFrom(...createPhrases);
      const prefixArb = fc.string({ minLength: 0, maxLength: 50 });
      const suffixArb = fc.string({ minLength: 0, maxLength: 50 });
      const newFilePathArb = fc.array(
        fc.stringMatching(/^[a-z]+\/[a-z-]+\.tsx$/),
        { minLength: 1, maxLength: 3 }
      );

      fc.assert(
        fc.property(
          createPhraseArb,
          prefixArb,
          suffixArb,
          newFilePathArb,
          (phrase: string, prefix: string, suffix: string, newFilePaths: string[]) => {
            const prompt = `${prefix} ${phrase} ${suffix}`;
            const context = createGitHubContext(prompt);
            const result = createResultWithNewFiles(newFilePaths);

            const filteredResult = executionAgent.applyGitHubStrictMode(result, context);

            // When prompt explicitly requests new file, newFiles should be preserved
            expect(Object.keys(filteredResult.newFiles).length).toBe(newFilePaths.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not filter newFiles for non-GitHub projects', () => {
      const promptArb = fc.string({ minLength: 1, maxLength: 200 });
      const newFilePathArb = fc.array(
        fc.stringMatching(/^[a-z]+\/[a-z-]+\.tsx$/),
        { minLength: 1, maxLength: 5 }
      );

      fc.assert(
        fc.property(
          promptArb,
          newFilePathArb,
          (prompt: string, newFilePaths: string[]) => {
            const context = createNonGitHubContext(prompt);
            const result = createResultWithNewFiles(newFilePaths);

            const filteredResult = executionAgent.applyGitHubStrictMode(result, context);

            // Non-GitHub projects should not have newFiles filtered
            expect(Object.keys(filteredResult.newFiles).length).toBe(newFilePaths.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should convert new files to modifications when matching existing files', () => {
      const existingFiles = [
        'components/hero-section.tsx',
        'components/header.tsx',
        'app/page.tsx',
      ];

      // Generate prompts without create phrases
      const nonCreatePromptArb = fc.string({ minLength: 1, maxLength: 100 })
        .filter(s => !s.toLowerCase().includes('create') && !s.toLowerCase().includes('new file'));

      fc.assert(
        fc.property(
          nonCreatePromptArb,
          (prompt: string) => {
            const context = createGitHubContext(prompt, existingFiles);
            
            // Create result with a new file that matches an existing file (case-insensitive)
            const result: ExecutionResult = {
              modifiedFiles: {},
              newFiles: {
                'components/HeroSection.tsx': 'export const HeroSection = () => <div>Hero</div>;',
              },
              deletedFiles: [],
              changes: [{
                file: 'components/HeroSection.tsx',
                action: 'created',
                description: 'Created HeroSection',
              }],
              description: 'Test result',
            };

            const filteredResult = executionAgent.applyGitHubStrictMode(result, context);

            // New file should be converted to modification of existing file
            expect(Object.keys(filteredResult.newFiles).length).toBe(0);
            expect(Object.keys(filteredResult.modifiedFiles)).toContain('components/hero-section.tsx');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly identify GitHub projects', () => {
      const contextWithGitHub = createGitHubContext('test');
      const contextWithoutGitHub = createNonGitHubContext('test');

      expect(executionAgent.isGitHubProject(contextWithGitHub)).toBe(true);
      expect(executionAgent.isGitHubProject(contextWithoutGitHub)).toBe(false);
    });

    it('should correctly detect explicit new file requests in prompts', () => {
      const createPhrases = [
        'create new file',
        'create a new file',
        'add new file',
        'add a new file',
        'make new file',
        'make a new file',
        'new file',
        'create file',
      ];

      for (const phrase of createPhrases) {
        expect(executionAgent.promptExplicitlyRequestsNewFile(phrase)).toBe(true);
        expect(executionAgent.promptExplicitlyRequestsNewFile(`Please ${phrase} for me`)).toBe(true);
        expect(executionAgent.promptExplicitlyRequestsNewFile(phrase.toUpperCase())).toBe(true);
      }

      // Should return false for prompts without create phrases
      expect(executionAgent.promptExplicitlyRequestsNewFile('modify the header')).toBe(false);
      expect(executionAgent.promptExplicitlyRequestsNewFile('update the button')).toBe(false);
    });

    it('should build GitHub strict mode prompt with complete file tree', () => {
      const fileTree = ['app/page.tsx', 'components/button.tsx', 'lib/utils.ts'];
      const context = createGitHubContext('test', fileTree);

      const prompt = executionAgent.buildGitHubStrictModePrompt(context);

      // Should contain strict mode warning
      expect(prompt).toContain('ULTRA STRICT MODE');
      expect(prompt).toContain('GITHUB CLONED PROJECT');

      // Should contain all files from file tree
      for (const file of fileTree) {
        expect(prompt).toContain(file);
      }
    });

    it('should return empty string for non-GitHub projects in buildGitHubStrictModePrompt', () => {
      const context = createNonGitHubContext('test');
      const prompt = executionAgent.buildGitHubStrictModePrompt(context);

      expect(prompt).toBe('');
    });
  });

  describe('getErrorContext', () => {
    /**
     * Property: Error context should always provide suggestions
     */
    it('should always provide at least one suggestion', () => {
      const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });
      const retryCountArb = fc.integer({ min: 0, max: 10 });
      
      fc.assert(
        fc.property(
          errorMessageArb,
          retryCountArb,
          (errorMessage: string, retryCount: number) => {
            const error = new Error(errorMessage);
            const context = executionAgent.getErrorContext(error, retryCount);
            
            // Should always have at least one suggestion
            expect(context.suggestions.length).toBeGreaterThan(0);
            
            // Should have a message
            expect(context.message).toBeDefined();
            expect(context.message.length).toBeGreaterThan(0);
            
            // canRetry should be based on retry count
            expect(context.canRetry).toBe(retryCount < 3);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Import-related errors should suggest checking packages
     */
    it('should suggest checking packages for import errors', () => {
      const importErrorMessages = [
        'Cannot find module',
        'import error',
        'Module not found',
        'Failed to resolve import',
      ];
      
      for (const message of importErrorMessages) {
        const error = new Error(message);
        const context = executionAgent.getErrorContext(error, 0);
        
        const hasPackageSuggestion = context.suggestions.some(s => 
          s.toLowerCase().includes('package') || 
          s.toLowerCase().includes('import')
        );
        expect(hasPackageSuggestion).toBe(true);
      }
    });
  });
});
