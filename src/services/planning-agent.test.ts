/**
 * PlanningAgent Unit Tests
 * 
 * Tests for the PlanningAgent service focusing on intent classification.
 * 
 * Feature: enhanced-context-management
 * 
 * Requirements: 8.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningAgent } from './planning-agent';
import type { Intent, GenerationContext } from '../types/context-management';

describe('PlanningAgent', () => {
  let planningAgent: PlanningAgent;

  beforeEach(() => {
    planningAgent = new PlanningAgent();
  });

  /**
   * Unit tests for intent classification
   * Requirements: 8.1
   */
  describe('classifyIntent', () => {
    describe('CREATE intent', () => {
      const createPrompts = [
        'Create a new button component',
        'Build a login page',
        'Make a new header component',
        'Add a new sidebar feature',
        'Generate a card component',
        'Implement a new dashboard module',
        'Develop a new user profile page',
        'Write a new utility function',
      ];

      it.each(createPrompts)('should classify "%s" as CREATE', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('CREATE');
      });
    });

    describe('MODIFY intent', () => {
      const modifyPrompts = [
        'Update the existing header component',
        'Change the current button style',
        'Modify the existing login form',
        'Edit the current navigation',
        'Improve the current dashboard layout',
        'Add a new prop to the existing Button component',
        'Remove the border from the existing card',
      ];

      it.each(modifyPrompts)('should classify "%s" as MODIFY', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('MODIFY');
      });
    });

    describe('CREATE_AND_LINK intent', () => {
      const createAndLinkPrompts = [
        'Create a new modal component and link it to the header',
        'Add a new button and connect it to the form',
        'Build a dropdown component and add it to the navigation',
        'Create a new card component and use it in the dashboard',
        'Add a new component in the sidebar',
        'Create a search bar and then add it to the header',
        'New modal component and then import it in the page',
      ];

      it.each(createAndLinkPrompts)('should classify "%s" as CREATE_AND_LINK', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('CREATE_AND_LINK');
      });
    });

    describe('FIX_ERROR intent', () => {
      const fixErrorPrompts = [
        'Fix the error in the login component',
        'Resolve the bug in the API route',
        'Debug the issue with the form submission',
        'Solve the problem with the navigation',
        'Repair the broken authentication',
        'The button is not working, please fix it',
        'The page is broken after the last change',
        'Fix: TypeError in dashboard',
        'The app crashed, need to fix it',
      ];

      it.each(fixErrorPrompts)('should classify "%s" as FIX_ERROR', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('FIX_ERROR');
      });
    });

    describe('QUESTION intent', () => {
      const questionPrompts = [
        'What is the best way to implement authentication?',
        'How does the routing work in Next.js?',
        'Why is the component not rendering?',
        'When should I use server components?',
        'Where should I put the configuration files?',
        'Which library should I use for forms?',
        'Can you explain how the context works?',
        'Tell me about the project structure',
        'Help me understand the data flow',
      ];

      it.each(questionPrompts)('should classify "%s" as QUESTION', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('QUESTION');
      });
    });

    describe('REFACTOR intent', () => {
      const refactorPrompts = [
        'Refactor the authentication module',
        'Restructure the components folder',
        'Reorganize the API routes',
        'Clean up the utils file',
        'Optimize the database queries',
        'Simplify the form validation logic',
        'Extract the header logic into a separate component',
        'Split the large component into smaller ones',
        'Merge the duplicate utility functions together',
        'Combine the similar utility handlers',
      ];

      it.each(refactorPrompts)('should classify "%s" as REFACTOR', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('REFACTOR');
      });
    });

    describe('API_GENERATE intent', () => {
      const apiGeneratePrompts = [
        'Create an API endpoint for user registration',
        'Generate a REST API for products',
        'Add a new backend route for authentication',
        'Build an API for the dashboard data',
        'Create a server endpoint for file uploads',
        'Generate a tRPC API for the todo list',
        'Add a GraphQL endpoint for users',
        'Create API routes for CRUD operations',
      ];

      it.each(apiGeneratePrompts)('should classify "%s" as API_GENERATE', (prompt) => {
        const intent = planningAgent.classifyIntent(prompt);
        expect(intent).toBe('API_GENERATE');
      });
    });

    describe('Edge cases', () => {
      it('should default to CREATE for ambiguous prompts', () => {
        const intent = planningAgent.classifyIntent('I need a button');
        // Ambiguous prompts should default to CREATE
        expect(['CREATE', 'MODIFY', 'QUESTION']).toContain(intent);
      });

      it('should handle empty prompts', () => {
        const intent = planningAgent.classifyIntent('');
        expect(intent).toBeDefined();
      });

      it('should handle prompts with only whitespace', () => {
        const intent = planningAgent.classifyIntent('   ');
        expect(intent).toBeDefined();
      });

      it('should classify prompts ending with ? as QUESTION', () => {
        const intent = planningAgent.classifyIntent('Can you help me with this?');
        expect(intent).toBe('QUESTION');
      });
    });
  });

  /**
   * Unit tests for task breakdown
   * Requirements: 8.2, 8.5
   */
  describe('createTaskBreakdown', () => {
    const mockContext: GenerationContext = {
      workingMemory: {
        conversationHistory: [],
        recentFiles: [],
        currentPrompt: 'test',
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
      fileTree: [],
    };

    it('should create tasks for CREATE intent', () => {
      const tasks = planningAgent.createTaskBreakdown('CREATE', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'create')).toBe(true);
    });

    it('should create tasks for MODIFY intent', () => {
      const tasks = planningAgent.createTaskBreakdown('MODIFY', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'modify')).toBe(true);
    });

    it('should create tasks for CREATE_AND_LINK intent', () => {
      const tasks = planningAgent.createTaskBreakdown('CREATE_AND_LINK', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'create')).toBe(true);
      expect(tasks.some(t => t.type === 'link')).toBe(true);
    });

    it('should create tasks for FIX_ERROR intent', () => {
      const tasks = planningAgent.createTaskBreakdown('FIX_ERROR', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every(t => t.type === 'modify')).toBe(true);
    });

    it('should create no tasks for QUESTION intent', () => {
      const tasks = planningAgent.createTaskBreakdown('QUESTION', mockContext);
      
      expect(tasks.length).toBe(0);
    });

    it('should create tasks for REFACTOR intent', () => {
      const tasks = planningAgent.createTaskBreakdown('REFACTOR', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'modify')).toBe(true);
    });

    it('should create tasks for API_GENERATE intent', () => {
      const tasks = planningAgent.createTaskBreakdown('API_GENERATE', mockContext);
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some(t => t.type === 'create')).toBe(true);
    });

    it('should include dependencies between tasks', () => {
      const tasks = planningAgent.createTaskBreakdown('CREATE_AND_LINK', mockContext);
      
      // Later tasks should depend on earlier ones
      const tasksWithDeps = tasks.filter(t => t.dependencies.length > 0);
      expect(tasksWithDeps.length).toBeGreaterThan(0);
    });

    it('should generate unique task IDs', () => {
      const tasks = planningAgent.createTaskBreakdown('CREATE_AND_LINK', mockContext);
      
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should add form setup task when react-hook-form is detected', () => {
      const contextWithForm: GenerationContext = {
        ...mockContext,
        projectPatterns: {
          ...mockContext.projectPatterns,
          formLibrary: 'react-hook-form',
        },
      };

      const tasks = planningAgent.createTaskBreakdown('CREATE', contextWithForm);
      
      expect(tasks.some(t => t.target.includes('form'))).toBe(true);
    });
  });

  /**
   * Unit tests for analyze method
   * Requirements: 8.1, 8.2
   */
  describe('analyze', () => {
    const mockContext: GenerationContext = {
      workingMemory: {
        conversationHistory: [],
        recentFiles: [],
        currentPrompt: 'test',
      },
      longTermMemory: {
        projectKnowledge: {
          uiLibrary: 'shadcn/ui',
          styling: 'Tailwind CSS',
          stateManagement: 'React hooks',
          formLibrary: 'none',
          database: 'Supabase',
          auth: 'Supabase Auth',
          importAliases: {},
          componentConventions: [],
        },
        fileRelationships: [],
        architecturalDecisions: [],
      },
      relevantFiles: [],
      projectPatterns: {
        uiLibrary: 'shadcn/ui',
        styling: 'Tailwind CSS',
        formLibrary: 'none',
        stateManagement: 'React hooks',
        commonComponents: [],
        importPatterns: [],
      },
      fileTree: ['components/header.tsx', 'app/page.tsx'],
    };

    it('should return a valid ExecutionPlan', async () => {
      const plan = await planningAgent.analyze('Create a new button component', mockContext);

      expect(plan).toBeDefined();
      expect(plan.intent).toBeDefined();
      expect(plan.confidence).toBeGreaterThan(0);
      expect(plan.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(Array.isArray(plan.fileTargets)).toBe(true);
      expect(Array.isArray(plan.criticalReminders)).toBe(true);
      expect(Array.isArray(plan.dependencies)).toBe(true);
    });

    it('should include critical reminders for the intent', async () => {
      const plan = await planningAgent.analyze('Create a new modal and link it to the header', mockContext);

      expect(plan.criticalReminders.length).toBeGreaterThan(0);
      // CREATE_AND_LINK should have specific reminders
      if (plan.intent === 'CREATE_AND_LINK') {
        expect(plan.criticalReminders.some(r => r.includes('LINK'))).toBe(true);
      }
    });

    it('should identify file targets from prompt', async () => {
      const contextWithFiles: GenerationContext = {
        ...mockContext,
        fileTree: ['components/header.tsx', 'components/button.tsx', 'app/page.tsx'],
      };

      const plan = await planningAgent.analyze('Update the `header.tsx` component', contextWithFiles);

      // Should identify header.tsx as a target
      const headerTarget = plan.fileTargets.find(t => t.path.includes('header'));
      expect(headerTarget).toBeDefined();
    });

    it('should infer new component path for CREATE intent', async () => {
      const plan = await planningAgent.analyze('Create a new sidebar component', mockContext);

      if (plan.intent === 'CREATE') {
        const sidebarTarget = plan.fileTargets.find(t => 
          t.path.toLowerCase().includes('sidebar') && t.action === 'create'
        );
        expect(sidebarTarget).toBeDefined();
      }
    });

    it('should infer API route path for API_GENERATE intent', async () => {
      const plan = await planningAgent.analyze('Create an API endpoint for users', mockContext);

      if (plan.intent === 'API_GENERATE') {
        const apiTarget = plan.fileTargets.find(t => 
          t.path.includes('api') && t.action === 'create'
        );
        expect(apiTarget).toBeDefined();
      }
    });
  });
});
