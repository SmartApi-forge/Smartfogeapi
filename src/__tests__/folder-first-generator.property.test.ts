/**
 * Property-Based Tests for Folder-First File Generator
 * 
 * **Feature: ui-quality-chat-polish, Property 5: Folder Creation Order**
 * **Validates: Requirements 3.3, 6.2, 6.5**
 * 
 * For any file generation plan, all folder creation events SHALL be emitted
 * before any file write events.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  planAPIGeneration,
  emitProgressEvents,
  areFoldersCreatedBeforeFiles,
  validateGenerationPlan,
  normalizeAPIName,
  addFileToplan,
  extendPlanWithSwaggerUI,
  type FileGenerationPlan,
  type ProgressEvent,
  type ProgressEventType,
} from '../services/folder-first-generator';

describe('Folder-First Generator Property Tests', () => {
  /**
   * **Feature: ui-quality-chat-polish, Property 5: Folder Creation Order**
   * **Validates: Requirements 3.3, 6.2, 6.5**
   */
  describe('Property 5: Folder Creation Order', () => {
    // Arbitrary for valid API names
    const apiNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9\s_-]{0,20}$/)
      .filter(s => s.trim().length > 0);

    // Arbitrary for common API name patterns
    const commonApiNameArb = fc.constantFrom(
      'user',
      'product',
      'order',
      'payment',
      'auth',
      'customer',
      'inventory',
      'notification',
      'analytics',
      'report',
      'User Management',
      'Product Catalog',
      'Order Processing',
      'Payment Gateway',
      'Customer Service',
    );

    it('should emit all folder:create events before any file:generate events', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          // Property: All folder events must come before file events
          expect(areFoldersCreatedBeforeFiles(events)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should emit folder:create events for every folder in the plan', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          const folderEvents = events.filter(e => e.type === 'folder:create');
          
          // Property: Number of folder events equals number of folders in plan
          expect(folderEvents.length).toBe(plan.folders.length);
          
          // Property: Each folder in plan has a corresponding event
          const eventPaths = folderEvents.map(e => e.details?.path);
          for (const folder of plan.folders) {
            expect(eventPaths).toContain(folder);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should emit file:generate events for every file in the plan', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          const fileEvents = events.filter(e => e.type === 'file:generate');
          
          // Property: Number of file events equals number of files in plan
          expect(fileEvents.length).toBe(plan.files.length);
          
          // Property: Each file in plan has a corresponding event
          const eventPaths = fileEvents.map(e => e.details?.path);
          for (const file of plan.files) {
            expect(eventPaths).toContain(file.path);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always start with planning event and end with complete event', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          // Property: First event is planning
          expect(events[0].type).toBe('planning');
          
          // Property: Last event is complete
          expect(events[events.length - 1].type).toBe('complete');
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain folder order: parent folders before child folders', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          const folderEvents = events.filter(e => e.type === 'folder:create');
          const folderPaths = folderEvents.map(e => e.details?.path).filter(Boolean) as string[];
          
          // Property: For each folder, its parent must appear earlier in the list
          for (let i = 0; i < folderPaths.length; i++) {
            const folder = folderPaths[i];
            const parts = folder.split('/');
            
            if (parts.length > 1) {
              const parentPath = parts.slice(0, -1).join('/');
              const parentIndex = folderPaths.indexOf(parentPath);
              
              // Parent must exist and come before child
              if (parentIndex !== -1) {
                expect(parentIndex).toBeLessThan(i);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid plans for any normalized API name', () => {
      fc.assert(
        fc.property(apiNameArb, (apiName) => {
          const plan = planAPIGeneration(apiName);
          const validation = validateGenerationPlan(plan);
          
          // Property: All generated plans should be valid
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure all files are placed in created folders', () => {
      fc.assert(
        fc.property(commonApiNameArb, (apiName) => {
          const plan = planAPIGeneration(apiName);
          const folderSet = new Set(plan.folders);
          
          // Property: Every file's directory must be in the folders list
          for (const file of plan.files) {
            const fileDir = file.path.split('/').slice(0, -1).join('/');
            expect(folderSet.has(fileDir)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain folder-before-file order even with extended plans', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const basePlan = planAPIGeneration(apiName);
          const extendedPlan = extendPlanWithSwaggerUI(basePlan);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(extendedPlan)) {
            events.push(event);
          }
          
          // Property: Extended plans should still have folders before files
          expect(areFoldersCreatedBeforeFiles(events)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain folder-before-file order when adding custom files', async () => {
      const customFileArb = fc.record({
        relativePath: fc.constantFrom(
          'src/utils/helpers.ts',
          'src/middleware/auth.ts',
          'src/config/database.ts',
          'tests/integration/api.test.ts',
        ),
        type: fc.constantFrom('api', 'types', 'config', 'test') as fc.Arbitrary<'api' | 'types' | 'config' | 'test'>,
      });

      await fc.assert(
        fc.asyncProperty(commonApiNameArb, customFileArb, async (apiName, customFile) => {
          const basePlan = planAPIGeneration(apiName);
          const newFile = {
            path: `${basePlan.basePath}/${customFile.relativePath}`,
            type: customFile.type,
          };
          const updatedPlan = addFileToplan(basePlan, newFile);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(updatedPlan)) {
            events.push(event);
          }
          
          // Property: Plans with added files should still have folders before files
          expect(areFoldersCreatedBeforeFiles(events)).toBe(true);
          
          // Property: The new file's directory should be in the folders
          const fileDir = newFile.path.split('/').slice(0, -1).join('/');
          expect(updatedPlan.folders).toContain(fileDir);
        }),
        { numRuns: 100 }
      );
    });

    it('should include standard API project structure folders', () => {
      fc.assert(
        fc.property(commonApiNameArb, (apiName) => {
          const plan = planAPIGeneration(apiName);
          const normalizedName = normalizeAPIName(apiName);
          const basePath = `${normalizedName}-api`;
          
          // Property: Plan should include src/, docs/, tests/ directories (Requirements 6.4)
          expect(plan.folders).toContain(`${basePath}/src`);
          expect(plan.folders).toContain(`${basePath}/docs`);
          expect(plan.folders).toContain(`${basePath}/tests`);
        }),
        { numRuns: 100 }
      );
    });

    it('should have base path as the first folder', () => {
      fc.assert(
        fc.property(commonApiNameArb, (apiName) => {
          const plan = planAPIGeneration(apiName);
          
          // Property: Base path should be the first folder (Requirements 6.2)
          expect(plan.folders[0]).toBe(plan.basePath);
        }),
        { numRuns: 100 }
      );
    });

    it('should emit events with valid timestamps in chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          // Property: All events should have timestamps
          for (const event of events) {
            expect(event.timestamp).toBeDefined();
            expect(typeof event.timestamp).toBe('number');
            expect(event.timestamp).toBeGreaterThan(0);
          }
          
          // Property: Timestamps should be in non-decreasing order
          for (let i = 1; i < events.length; i++) {
            expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should produce consistent event type sequence', async () => {
      await fc.assert(
        fc.asyncProperty(commonApiNameArb, async (apiName) => {
          const plan = planAPIGeneration(apiName);
          const events: ProgressEvent[] = [];
          
          for await (const event of emitProgressEvents(plan)) {
            events.push(event);
          }
          
          const eventTypes = events.map(e => e.type);
          
          // Property: Event sequence should be planning -> folder:create* -> file:generate* -> complete
          let phase: 'planning' | 'folders' | 'files' | 'complete' = 'planning';
          
          for (const type of eventTypes) {
            switch (phase) {
              case 'planning':
                expect(type).toBe('planning');
                phase = 'folders';
                break;
              case 'folders':
                if (type === 'file:generate') {
                  phase = 'files';
                } else if (type === 'complete') {
                  phase = 'complete';
                } else {
                  expect(type).toBe('folder:create');
                }
                break;
              case 'files':
                if (type === 'complete') {
                  phase = 'complete';
                } else {
                  expect(type).toBe('file:generate');
                }
                break;
              case 'complete':
                expect(type).toBe('complete');
                break;
            }
          }
          
          // Property: Should end in complete phase
          expect(phase).toBe('complete');
        }),
        { numRuns: 100 }
      );
    });
  });
});
