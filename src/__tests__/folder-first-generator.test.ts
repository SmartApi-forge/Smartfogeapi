/**
 * Unit Tests for Folder-First File Generator
 * 
 * Tests the folder-first file generation service to ensure:
 * - Folders are created before files
 * - Parent folders are created before child folders
 * - Files are placed in correct folders
 * - Standard API project structure is created
 * 
 * **Feature: ui-quality-chat-polish**
 * **Validates: Requirements 3.3, 6.1, 6.2, 6.3, 6.4, 6.5**
 */

import { describe, it, expect } from 'vitest';
import {
  planAPIGeneration,
  planAPIGenerationFromPrompt,
  normalizeAPIName,
  emitProgressEvents,
  validateGenerationPlan,
  areFoldersCreatedBeforeFiles,
  getExpectedEventOrder,
  addFileToplan,
  extendPlanWithSwaggerUI,
  type FileGenerationPlan,
  type ProgressEvent,
} from '../services/folder-first-generator';

describe('Folder-First File Generator', () => {
  describe('normalizeAPIName', () => {
    it('should convert to lowercase kebab-case', () => {
      expect(normalizeAPIName('User')).toBe('user');
      expect(normalizeAPIName('UserManagement')).toBe('usermanagement');
      expect(normalizeAPIName('user management')).toBe('user-management');
      expect(normalizeAPIName('USER_API')).toBe('user-api');
    });

    it('should handle special characters', () => {
      expect(normalizeAPIName('user@api')).toBe('user-api');
      expect(normalizeAPIName('user#api!')).toBe('user-api');
    });

    it('should return "api" for empty or invalid input', () => {
      expect(normalizeAPIName('')).toBe('api');
      expect(normalizeAPIName('   ')).toBe('api');
      expect(normalizeAPIName('###')).toBe('api');
    });
  });

  describe('planAPIGeneration', () => {
    it('should create a valid plan with base path', () => {
      const plan = planAPIGeneration('user');
      
      expect(plan.basePath).toBe('user-api');
      expect(plan.folders.length).toBeGreaterThan(0);
      expect(plan.files.length).toBeGreaterThan(0);
    });

    it('should include standard API project folders (Requirements 6.4)', () => {
      const plan = planAPIGeneration('product');
      
      // Should have src/, docs/, tests/ directories
      expect(plan.folders).toContain('product-api/src');
      expect(plan.folders).toContain('product-api/docs');
      expect(plan.folders).toContain('product-api/tests');
    });

    it('should have base path as first folder (Requirements 6.2)', () => {
      const plan = planAPIGeneration('order');
      
      expect(plan.folders[0]).toBe('order-api');
    });

    it('should have parent folders before child folders (Requirements 6.2)', () => {
      const plan = planAPIGeneration('user');
      
      // Check that src comes before src/routes
      const srcIndex = plan.folders.indexOf('user-api/src');
      const routesIndex = plan.folders.indexOf('user-api/src/routes');
      
      expect(srcIndex).toBeLessThan(routesIndex);
    });

    it('should place files in created folders (Requirements 6.3)', () => {
      const plan = planAPIGeneration('user');
      
      for (const file of plan.files) {
        const fileDir = file.path.split('/').slice(0, -1).join('/');
        expect(plan.folders).toContain(fileDir);
      }
    });
  });

  describe('planAPIGenerationFromPrompt', () => {
    it('should extract API name from prompt', () => {
      const plan = planAPIGenerationFromPrompt('Create a REST API for user management');
      
      expect(plan).not.toBeNull();
      expect(plan!.basePath).toBe('user-api');
    });

    it('should default to "api" if no name found', () => {
      const plan = planAPIGenerationFromPrompt('Create something');
      
      expect(plan).not.toBeNull();
      expect(plan!.basePath).toBe('api-api');
    });
  });

  describe('validateGenerationPlan', () => {
    it('should validate a correct plan', () => {
      const plan = planAPIGeneration('user');
      const result = validateGenerationPlan(plan);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing folders for files', () => {
      const invalidPlan: FileGenerationPlan = {
        basePath: 'test-api',
        folders: ['test-api'],
        files: [{ path: 'test-api/src/index.ts', type: 'api' }]
      };
      
      const result = validateGenerationPlan(invalidPlan);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty folder list', () => {
      const invalidPlan: FileGenerationPlan = {
        basePath: 'test-api',
        folders: [],
        files: []
      };
      
      const result = validateGenerationPlan(invalidPlan);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('emitProgressEvents', () => {
    it('should emit events in correct order (Requirements 6.5)', async () => {
      const plan = planAPIGeneration('user');
      const events: ProgressEvent[] = [];
      
      for await (const event of emitProgressEvents(plan)) {
        events.push(event);
      }
      
      // First event should be planning
      expect(events[0].type).toBe('planning');
      
      // Last event should be complete
      expect(events[events.length - 1].type).toBe('complete');
      
      // All folder events should come before file events
      expect(areFoldersCreatedBeforeFiles(events)).toBe(true);
    });

    it('should emit folder:create events for all folders', async () => {
      const plan = planAPIGeneration('user');
      const events: ProgressEvent[] = [];
      
      for await (const event of emitProgressEvents(plan)) {
        events.push(event);
      }
      
      const folderEvents = events.filter(e => e.type === 'folder:create');
      expect(folderEvents.length).toBe(plan.folders.length);
    });

    it('should emit file:generate events for all files', async () => {
      const plan = planAPIGeneration('user');
      const events: ProgressEvent[] = [];
      
      for await (const event of emitProgressEvents(plan)) {
        events.push(event);
      }
      
      const fileEvents = events.filter(e => e.type === 'file:generate');
      expect(fileEvents.length).toBe(plan.files.length);
    });

    it('should include path in folder events', async () => {
      const plan = planAPIGeneration('user');
      const events: ProgressEvent[] = [];
      
      for await (const event of emitProgressEvents(plan)) {
        events.push(event);
      }
      
      const folderEvents = events.filter(e => e.type === 'folder:create');
      for (const event of folderEvents) {
        expect(event.details?.path).toBeDefined();
        expect(plan.folders).toContain(event.details!.path);
      }
    });
  });

  describe('areFoldersCreatedBeforeFiles', () => {
    it('should return true for correct order', () => {
      const events: ProgressEvent[] = [
        { type: 'planning', message: '', timestamp: 1 },
        { type: 'folder:create', message: '', timestamp: 2 },
        { type: 'folder:create', message: '', timestamp: 3 },
        { type: 'file:generate', message: '', timestamp: 4 },
        { type: 'complete', message: '', timestamp: 5 },
      ];
      
      expect(areFoldersCreatedBeforeFiles(events)).toBe(true);
    });

    it('should return false for incorrect order', () => {
      const events: ProgressEvent[] = [
        { type: 'planning', message: '', timestamp: 1 },
        { type: 'file:generate', message: '', timestamp: 2 },
        { type: 'folder:create', message: '', timestamp: 3 }, // folder after file!
        { type: 'complete', message: '', timestamp: 4 },
      ];
      
      expect(areFoldersCreatedBeforeFiles(events)).toBe(false);
    });
  });

  describe('getExpectedEventOrder', () => {
    it('should return correct event sequence', () => {
      const plan = planAPIGeneration('user');
      const expectedOrder = getExpectedEventOrder(plan);
      
      // Should start with planning
      expect(expectedOrder[0]).toBe('planning');
      
      // Should end with complete
      expect(expectedOrder[expectedOrder.length - 1]).toBe('complete');
      
      // Should have correct counts
      const folderCount = expectedOrder.filter(e => e === 'folder:create').length;
      const fileCount = expectedOrder.filter(e => e === 'file:generate').length;
      
      expect(folderCount).toBe(plan.folders.length);
      expect(fileCount).toBe(plan.files.length);
    });
  });

  describe('addFileToplan', () => {
    it('should add file and create missing folders', () => {
      const plan = planAPIGeneration('user');
      const newFile = { path: 'user-api/src/utils/helpers.ts', type: 'api' as const };
      
      const updatedPlan = addFileToplan(plan, newFile);
      
      expect(updatedPlan.files).toContain(newFile);
      expect(updatedPlan.folders).toContain('user-api/src/utils');
    });
  });

  describe('extendPlanWithSwaggerUI', () => {
    it('should add Swagger UI files', () => {
      const plan = planAPIGeneration('user');
      const extendedPlan = extendPlanWithSwaggerUI(plan);
      
      const swaggerFiles = extendedPlan.files.filter(f => 
        f.path.includes('api-docs') || f.path.includes('openapi/route')
      );
      
      expect(swaggerFiles.length).toBeGreaterThan(0);
    });
  });
});
