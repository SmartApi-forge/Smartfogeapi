/**
 * FileTracker Property-Based Tests
 * 
 * Tests for the FileTracker service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 4: Hash Determinism**
 * **Validates: Requirements 3.1**
 * 
 * **Feature: enhanced-context-management, Property 5: Change Detection Accuracy**
 * **Validates: Requirements 3.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FileTracker } from './file-tracker';

describe('FileTracker', () => {
  const fileTracker = new FileTracker();

  describe('computeHash', () => {
    /**
     * **Feature: enhanced-context-management, Property 4: Hash Determinism**
     * **Validates: Requirements 3.1**
     * 
     * For any file content, computing the hash twice SHALL produce identical results.
     */
    it('should produce identical hashes for the same content (Property 4: Hash Determinism)', () => {
      fc.assert(
        fc.property(
          fc.string(), // Generate arbitrary strings as file content
          (content: string) => {
            const hash1 = fileTracker.computeHash(content);
            const hash2 = fileTracker.computeHash(content);
            
            // Hash must be deterministic - same input always produces same output
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    /**
     * Additional property: Hash should be a valid SHA-256 hex string
     */
    it('should produce valid SHA-256 hex strings', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (content: string) => {
            const hash = fileTracker.computeHash(content);
            
            // SHA-256 produces 64 character hex string
            expect(hash).toHaveLength(64);
            // Should only contain hex characters
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property: Different content should produce different hashes
     * (with extremely high probability due to SHA-256 collision resistance)
     */
    it('should produce different hashes for different content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (content1: string, content2: string) => {
            // Skip if contents are the same
            fc.pre(content1 !== content2);
            
            const hash1 = fileTracker.computeHash(content1);
            const hash2 = fileTracker.computeHash(content2);
            
            // Different content should produce different hashes
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Hash should handle various content types including unicode
     */
    it('should handle unicode and special characters', () => {
      // Test with explicit unicode strings to verify hash determinism
      const unicodeStrings = [
        '你好世界', // Chinese
        'مرحبا بالعالم', // Arabic
        '🎉🚀💻', // Emojis
        'Ñoño', // Spanish
        'Привет мир', // Russian
        'こんにちは世界', // Japanese
        'mixed: Hello 世界 🌍',
      ];

      for (const content of unicodeStrings) {
        const hash1 = fileTracker.computeHash(content);
        const hash2 = fileTracker.computeHash(content);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
      }
    });
  });

  describe('detectChanges', () => {
    // Helper to create a file path arbitrary (lowercase only, no 'i' flag)
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
     * **Feature: enhanced-context-management, Property 5: Change Detection Accuracy**
     * **Validates: Requirements 3.2**
     * 
     * For any two file states, the FileTracker SHALL correctly identify 
     * all added, modified, deleted, and unchanged files.
     */
    it('should correctly identify all added, modified, deleted, and unchanged files (Property 5: Change Detection Accuracy)', () => {
      const filesArb = createFilesArb(0, 20);

      fc.assert(
        fc.property(
          filesArb, // Old files
          filesArb, // New files
          (oldFilesObj: Record<string, string>, newFilesObj: Record<string, string>) => {
            // Build oldHashes map from old files
            const oldHashes = new Map<string, string>();
            for (const [path, content] of Object.entries(oldFilesObj)) {
              oldHashes.set(path, fileTracker.computeHash(content));
            }

            // Detect changes
            const changes = fileTracker.detectChanges(oldHashes, newFilesObj);

            // Verify: All categories should be disjoint
            const allPaths = new Set([
              ...changes.added,
              ...changes.modified,
              ...changes.deleted,
              ...changes.unchanged,
            ]);
            expect(allPaths.size).toBe(
              changes.added.length + 
              changes.modified.length + 
              changes.deleted.length + 
              changes.unchanged.length
            );

            // Verify: Added files are in newFiles but not in oldHashes
            for (const path of changes.added) {
              expect(oldHashes.has(path)).toBe(false);
              expect(path in newFilesObj).toBe(true);
            }

            // Verify: Deleted files are in oldHashes but not in newFiles
            for (const path of changes.deleted) {
              expect(oldHashes.has(path)).toBe(true);
              expect(path in newFilesObj).toBe(false);
            }

            // Verify: Modified files are in both but with different hashes
            for (const path of changes.modified) {
              expect(oldHashes.has(path)).toBe(true);
              expect(path in newFilesObj).toBe(true);
              const newHash = fileTracker.computeHash(newFilesObj[path]);
              expect(oldHashes.get(path)).not.toBe(newHash);
            }

            // Verify: Unchanged files are in both with same hashes
            for (const path of changes.unchanged) {
              expect(oldHashes.has(path)).toBe(true);
              expect(path in newFilesObj).toBe(true);
              const newHash = fileTracker.computeHash(newFilesObj[path]);
              expect(oldHashes.get(path)).toBe(newHash);
            }

            // Verify: All old files are accounted for (deleted, modified, or unchanged)
            for (const path of oldHashes.keys()) {
              const isDeleted = changes.deleted.includes(path);
              const isModified = changes.modified.includes(path);
              const isUnchanged = changes.unchanged.includes(path);
              expect(isDeleted || isModified || isUnchanged).toBe(true);
            }

            // Verify: All new files are accounted for (added, modified, or unchanged)
            for (const path of Object.keys(newFilesObj)) {
              const isAdded = changes.added.includes(path);
              const isModified = changes.modified.includes(path);
              const isUnchanged = changes.unchanged.includes(path);
              expect(isAdded || isModified || isUnchanged).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty old state means all new files are added
     */
    it('should mark all files as added when old state is empty', () => {
      const filesArb = createFilesArb(1, 10);

      fc.assert(
        fc.property(filesArb, (newFilesObj: Record<string, string>) => {
          const oldHashes = new Map<string, string>();
          const changes = fileTracker.detectChanges(oldHashes, newFilesObj);

          // All files should be added
          expect(changes.added.length).toBe(Object.keys(newFilesObj).length);
          expect(changes.modified.length).toBe(0);
          expect(changes.deleted.length).toBe(0);
          expect(changes.unchanged.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty new state means all old files are deleted
     */
    it('should mark all files as deleted when new state is empty', () => {
      const filesArb = createFilesArb(1, 10);

      fc.assert(
        fc.property(filesArb, (oldFilesObj: Record<string, string>) => {
          const oldHashes = new Map<string, string>();
          for (const [path, content] of Object.entries(oldFilesObj)) {
            oldHashes.set(path, fileTracker.computeHash(content));
          }

          const changes = fileTracker.detectChanges(oldHashes, {});

          // All files should be deleted
          expect(changes.added.length).toBe(0);
          expect(changes.modified.length).toBe(0);
          expect(changes.deleted.length).toBe(oldHashes.size);
          expect(changes.unchanged.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Identical states means all files are unchanged
     */
    it('should mark all files as unchanged when states are identical', () => {
      const filesArb = createFilesArb(1, 10);

      fc.assert(
        fc.property(filesArb, (filesObj: Record<string, string>) => {
          const oldHashes = new Map<string, string>();
          for (const [path, content] of Object.entries(filesObj)) {
            oldHashes.set(path, fileTracker.computeHash(content));
          }

          // Use same files for new state
          const changes = fileTracker.detectChanges(oldHashes, filesObj);

          // All files should be unchanged
          expect(changes.added.length).toBe(0);
          expect(changes.modified.length).toBe(0);
          expect(changes.deleted.length).toBe(0);
          expect(changes.unchanged.length).toBe(Object.keys(filesObj).length);
        }),
        { numRuns: 100 }
      );
    });
  });
});
