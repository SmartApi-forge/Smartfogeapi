/**
 * VersionManager Property-Based Tests
 * 
 * Tests for the VersionManager service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 6: Version Completeness**
 * **Validates: Requirements 5.1**
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase before importing VersionManager
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(),
            })),
          })),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  })),
}));

// Import after mocking
import { VersionManager } from './version-manager';

describe('VersionManager', () => {
  describe('mergeFilesWithChanges', () => {
    // Helper to create a file path arbitrary
    const createFilePathArb = () => fc.stringMatching(/^[a-z][a-z0-9_\-\/]*\.[a-z]{1,4}$/)
      .filter(s => s.length > 2 && s.length < 50);

    // Helper to create a files arbitrary
    const createFilesArb = (minLength = 0, maxLength = 20) => {
      const filePathArb = createFilePathArb();
      const fileContentArb = fc.string({ minLength: 0, maxLength: 500 });
      const fileEntryArb = fc.tuple(filePathArb, fileContentArb);
      return fc.uniqueArray(fileEntryArb, {
        selector: ([path]) => path,
        minLength,
        maxLength,
      }).map(entries => Object.fromEntries(entries));
    };

    /**
     * **Feature: enhanced-context-management, Property 6: Version Completeness**
     * **Validates: Requirements 5.1**
     * 
     * For any new version, the files object SHALL contain all parent files 
     * plus all changes (merged correctly).
     */
    it('should contain all parent files plus changes (Property 6: Version Completeness)', () => {
      fc.assert(
        fc.property(
          createFilesArb(0, 15), // Parent files
          createFilesArb(0, 10), // Changes (new/modified files)
          (parentFiles: Record<string, string>, changes: Record<string, string>) => {
            // No deletions in this test
            const deletedFiles: string[] = [];
            
            const result = VersionManager.mergeFilesWithChanges(
              parentFiles,
              changes,
              deletedFiles
            );
            
            // Property 1: All parent files should be in result (unless overwritten by changes)
            for (const [path, content] of Object.entries(parentFiles)) {
              expect(path in result).toBe(true);
              // If not in changes, content should be unchanged
              if (!(path in changes)) {
                expect(result[path]).toBe(content);
              }
            }
            
            // Property 2: All changes should be in result with correct content
            for (const [path, content] of Object.entries(changes)) {
              expect(result[path]).toBe(content);
            }
            
            // Property 3: Result should contain exactly the union of parent and changes
            const expectedPaths = new Set([
              ...Object.keys(parentFiles),
              ...Object.keys(changes),
            ]);
            expect(Object.keys(result).length).toBe(expectedPaths.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Deleted files should not appear in result
     */
    it('should not contain deleted files', () => {
      fc.assert(
        fc.property(
          createFilesArb(3, 15), // Parent files (at least 3 to have something to delete)
          createFilesArb(0, 5),  // Changes
          (parentFiles: Record<string, string>, changes: Record<string, string>) => {
            const parentPaths = Object.keys(parentFiles);
            // Delete up to half of parent files
            const numToDelete = Math.min(Math.floor(parentPaths.length / 2), 3);
            const deletedFiles = parentPaths.slice(0, numToDelete);
            
            const result = VersionManager.mergeFilesWithChanges(
              parentFiles,
              changes,
              deletedFiles
            );
            
            // Deleted files should not be in result (unless re-added by changes)
            for (const deletedPath of deletedFiles) {
              if (!(deletedPath in changes)) {
                expect(deletedPath in result).toBe(false);
              }
            }
            
            // Non-deleted parent files should still be present
            for (const path of parentPaths) {
              if (!deletedFiles.includes(path)) {
                expect(path in result).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Changes should override parent files with same path
     */
    it('should override parent files with changes', () => {
      fc.assert(
        fc.property(
          createFilesArb(1, 10), // Parent files
          fc.string({ minLength: 1, maxLength: 500 }), // New content
          (parentFiles: Record<string, string>, newContent: string) => {
            const parentPaths = Object.keys(parentFiles);
            fc.pre(parentPaths.length > 0);
            
            // Pick a random parent file to modify
            const pathToModify = parentPaths[0];
            const changes = { [pathToModify]: newContent };
            
            const result = VersionManager.mergeFilesWithChanges(
              parentFiles,
              changes,
              []
            );
            
            // The modified file should have the new content
            expect(result[pathToModify]).toBe(newContent);
            
            // Other files should be unchanged
            for (const [path, content] of Object.entries(parentFiles)) {
              if (path !== pathToModify) {
                expect(result[path]).toBe(content);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty parent with changes should equal changes
     */
    it('should return changes when parent is empty', () => {
      fc.assert(
        fc.property(
          createFilesArb(1, 10), // Changes only
          (changes: Record<string, string>) => {
            const result = VersionManager.mergeFilesWithChanges({}, changes, []);
            
            // Result should exactly equal changes
            expect(result).toEqual(changes);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty changes should return parent minus deletions
     */
    it('should return parent minus deletions when changes is empty', () => {
      fc.assert(
        fc.property(
          createFilesArb(2, 10), // Parent files
          (parentFiles: Record<string, string>) => {
            const parentPaths = Object.keys(parentFiles);
            const deletedFiles = parentPaths.slice(0, 1); // Delete first file
            
            const result = VersionManager.mergeFilesWithChanges(
              parentFiles,
              {},
              deletedFiles
            );
            
            // Result should have all parent files except deleted ones
            expect(Object.keys(result).length).toBe(parentPaths.length - deletedFiles.length);
            
            for (const [path, content] of Object.entries(parentFiles)) {
              if (!deletedFiles.includes(path)) {
                expect(result[path]).toBe(content);
              } else {
                expect(path in result).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateLineDiffs', () => {
    /**
     * Property: Line diffs should account for all lines
     */
    it('should account for all lines in both old and new content', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          (oldLines: string[], newLines: string[]) => {
            const oldContent = oldLines.join('\n');
            const newContent = newLines.join('\n');
            
            const diffs = VersionManager.generateLineDiffs(oldContent, newContent);
            
            // Count lines by type
            const addedCount = diffs.filter(d => d.type === 'added').length;
            const removedCount = diffs.filter(d => d.type === 'removed').length;
            const unchangedCount = diffs.filter(d => d.type === 'unchanged').length;
            
            // All old lines should be either removed or unchanged
            // All new lines should be either added or unchanged
            // The unchanged lines are shared between old and new
            expect(removedCount + unchangedCount).toBeLessThanOrEqual(oldLines.length + 1);
            expect(addedCount + unchangedCount).toBeLessThanOrEqual(newLines.length + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Identical content should have no added or removed lines
     */
    it('should have no changes for identical content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (content: string) => {
            const diffs = VersionManager.generateLineDiffs(content, content);
            
            const addedCount = diffs.filter(d => d.type === 'added').length;
            const removedCount = diffs.filter(d => d.type === 'removed').length;
            
            expect(addedCount).toBe(0);
            expect(removedCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty old content means all new lines are added
     */
    it('should mark all lines as added when old content is empty', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (newLines: string[]) => {
            const newContent = newLines.join('\n');
            
            const diffs = VersionManager.generateLineDiffs('', newContent);
            
            const addedCount = diffs.filter(d => d.type === 'added').length;
            const removedCount = diffs.filter(d => d.type === 'removed').length;
            
            expect(addedCount).toBe(newLines.length);
            expect(removedCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty new content means all old lines are removed
     */
    it('should mark all lines as removed when new content is empty', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (oldLines: string[]) => {
            const oldContent = oldLines.join('\n');
            
            const diffs = VersionManager.generateLineDiffs(oldContent, '');
            
            const addedCount = diffs.filter(d => d.type === 'added').length;
            const removedCount = diffs.filter(d => d.type === 'removed').length;
            
            expect(removedCount).toBe(oldLines.length);
            expect(addedCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateDetailedFileDiff', () => {
    /**
     * Property: Status should correctly reflect file state
     */
    it('should correctly identify file status', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          (oldContent: string | undefined, newContent: string | undefined) => {
            // Skip case where both are undefined (not a valid file state)
            fc.pre(oldContent !== undefined || newContent !== undefined);
            
            const diff = VersionManager.generateDetailedFileDiff(
              'test.ts',
              oldContent,
              newContent
            );
            
            if (!oldContent && newContent) {
              expect(diff.status).toBe('added');
            } else if (oldContent && !newContent) {
              expect(diff.status).toBe('deleted');
            } else if (oldContent !== newContent) {
              expect(diff.status).toBe('modified');
            } else {
              expect(diff.status).toBe('unchanged');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Stats should match line diff counts
     */
    it('should have consistent stats with line diffs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.string({ minLength: 0, maxLength: 200 }),
          (oldContent: string, newContent: string) => {
            const diff = VersionManager.generateDetailedFileDiff(
              'test.ts',
              oldContent,
              newContent
            );
            
            const addedFromDiffs = diff.lineDiffs.filter(d => d.type === 'added').length;
            const removedFromDiffs = diff.lineDiffs.filter(d => d.type === 'removed').length;
            const unchangedFromDiffs = diff.lineDiffs.filter(d => d.type === 'unchanged').length;
            
            expect(diff.stats.linesAdded).toBe(addedFromDiffs);
            expect(diff.stats.linesRemoved).toBe(removedFromDiffs);
            expect(diff.stats.linesUnchanged).toBe(unchangedFromDiffs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
