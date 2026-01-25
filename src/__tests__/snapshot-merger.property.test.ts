/**
 * Property Tests: Snapshot Merger
 * 
 * **Feature: v0-lovable-architecture, Property 6: Snapshot Merge Preservation**
 * **Validates: Requirements 3.3**
 * 
 * Property: For any file snapshot merge operation, files not in the changes set 
 * SHALL remain unchanged in the resulting snapshot, and files in the changes set 
 * SHALL be updated to their new content.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  mergeSnapshots,
  deleteFromSnapshot,
  createInitialSnapshot,
  snapshotMerger,
  type MergeResult
} from '../services/snapshot-merger';
import type { FileSnapshotData } from '../types/database';
import type { ParsedFile } from '../services/code-block-parser';

/**
 * Arbitrary for generating valid file names
 */
const fileNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * Arbitrary for generating valid file paths
 */
const filePathArb = fc.tuple(
  fileNameArb,
  fc.constantFrom('.ts', '.tsx', '.js', '.json', '.css', '.html', '.md')
).map(([name, ext]) => `src/${name}${ext}`);

/**
 * Arbitrary for generating file content
 */
const fileContentArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => !s.includes('```'));

/**
 * Arbitrary for generating a ParsedFile
 */
const parsedFileArb = fc.record({
  path: filePathArb,
  content: fileContentArb,
  language: fc.constantFrom('typescript', 'javascript', 'json', 'css', 'html', 'markdown')
});

/**
 * Arbitrary for generating a FileSnapshotData entry
 */
const snapshotEntryArb = fc.record({
  content: fileContentArb,
  language: fc.constantFrom('typescript', 'javascript', 'json', 'css', 'html'),
  size: fc.integer({ min: 1, max: 10000 })
});

/**
 * Generate a snapshot with unique file paths
 */
function generateSnapshot(files: Array<{ path: string; content: string; language: string }>): FileSnapshotData {
  const snapshot: FileSnapshotData = {};
  for (const file of files) {
    snapshot[file.path] = {
      content: file.content,
      language: file.language,
      size: new TextEncoder().encode(file.content).length
    };
  }
  return snapshot;
}

describe('Property 6: Snapshot Merge Preservation', () => {
  /**
   * Property: Files not in the changes set SHALL remain unchanged.
   */
  it('should preserve unchanged files during merge', () => {
    fc.assert(
      fc.property(
        // Generate existing files (2-5 files)
        fc.array(parsedFileArb, { minLength: 2, maxLength: 5 }),
        // Generate new files (1-3 files with different paths)
        fc.array(parsedFileArb, { minLength: 1, maxLength: 3 }),
        (existingFiles, newFiles) => {
          // Ensure unique paths in existing files
          const uniqueExisting = existingFiles.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          // Ensure new files have different paths from existing
          const existingPaths = new Set(uniqueExisting.map(f => f.path));
          const uniqueNew = newFiles
            .filter((file, index, self) =>
              self.findIndex(f => f.path === file.path) === index
            )
            .filter(f => !existingPaths.has(f.path));

          if (uniqueExisting.length === 0 || uniqueNew.length === 0) {
            return true; // Skip if we can't generate valid test data
          }

          // Create existing snapshot
          const existingSnapshot = generateSnapshot(uniqueExisting);

          // Merge with new files
          const result = mergeSnapshots(existingSnapshot, uniqueNew);

          // Verify unchanged files are preserved exactly
          for (const existingFile of uniqueExisting) {
            const mergedFile = result.snapshot[existingFile.path];
            expect(mergedFile).toBeDefined();
            expect(mergedFile.content).toBe(existingFile.content);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Files in the changes set SHALL be updated to their new content.
   */
  it('should update changed files with new content', () => {
    fc.assert(
      fc.property(
        // Generate files to update
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        // Generate new content for the same paths
        fc.array(fileContentArb, { minLength: 1, maxLength: 5 }),
        (files, newContents) => {
          // Ensure unique paths
          const uniqueFiles = files.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueFiles.length === 0) {
            return true;
          }

          // Create existing snapshot
          const existingSnapshot = generateSnapshot(uniqueFiles);

          // Create updated files with new content
          const updatedFiles: ParsedFile[] = uniqueFiles.map((file, i) => ({
            ...file,
            content: newContents[i % newContents.length] || 'updated content'
          }));

          // Merge
          const result = mergeSnapshots(existingSnapshot, updatedFiles);

          // Verify files are updated
          for (const updatedFile of updatedFiles) {
            const mergedFile = result.snapshot[updatedFile.path];
            expect(mergedFile).toBeDefined();
            expect(mergedFile.content).toBe(updatedFile.content);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Merge SHALL correctly calculate file count.
   */
  it('should correctly calculate file count after merge', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 0, maxLength: 5 }),
        fc.array(parsedFileArb, { minLength: 0, maxLength: 5 }),
        (existingFiles, newFiles) => {
          // Ensure unique paths
          const uniqueExisting = existingFiles.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );
          const uniqueNew = newFiles.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          const existingSnapshot = generateSnapshot(uniqueExisting);
          const result = mergeSnapshots(existingSnapshot, uniqueNew);

          // Calculate expected count (existing + new unique paths)
          const allPaths = new Set([
            ...uniqueExisting.map(f => f.path),
            ...uniqueNew.map(f => f.path)
          ]);

          expect(result.fileCount).toBe(allPaths.size);
          expect(Object.keys(result.snapshot).length).toBe(allPaths.size);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Merge SHALL correctly calculate total size.
   */
  it('should correctly calculate total size after merge', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        (files) => {
          const uniqueFiles = files.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueFiles.length === 0) {
            return true;
          }

          const result = createInitialSnapshot(uniqueFiles);

          // Calculate expected total size
          const expectedSize = uniqueFiles.reduce(
            (sum, file) => sum + new TextEncoder().encode(file.content).length,
            0
          );

          expect(result.totalSizeBytes).toBe(expectedSize);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Merge SHALL record correct change types.
   */
  it('should record correct change types (create vs modify)', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 3 }),
        fc.array(parsedFileArb, { minLength: 1, maxLength: 3 }),
        (existingFiles, newFiles) => {
          const uniqueExisting = existingFiles.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );
          const uniqueNew = newFiles.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueExisting.length === 0 || uniqueNew.length === 0) {
            return true;
          }

          const existingSnapshot = generateSnapshot(uniqueExisting);
          const existingPaths = new Set(uniqueExisting.map(f => f.path));

          const result = mergeSnapshots(existingSnapshot, uniqueNew);

          // Verify change types
          for (const change of result.changes) {
            if (existingPaths.has(change.file)) {
              expect(change.action).toBe('modify');
            } else {
              expect(change.action).toBe('create');
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Delete SHALL remove files and record deletions.
   */
  it('should correctly delete files from snapshot', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 2, maxLength: 5 }),
        (files) => {
          const uniqueFiles = files.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueFiles.length < 2) {
            return true;
          }

          const existingSnapshot = generateSnapshot(uniqueFiles);
          
          // Delete first file
          const fileToDelete = uniqueFiles[0].path;
          const result = deleteFromSnapshot(existingSnapshot, [fileToDelete]);

          // Verify file is deleted
          expect(result.snapshot[fileToDelete]).toBeUndefined();
          expect(result.fileCount).toBe(uniqueFiles.length - 1);

          // Verify change is recorded
          expect(result.changes.length).toBe(1);
          expect(result.changes[0].action).toBe('delete');
          expect(result.changes[0].file).toBe(fileToDelete);

          // Verify other files are preserved
          for (let i = 1; i < uniqueFiles.length; i++) {
            expect(result.snapshot[uniqueFiles[i].path]).toBeDefined();
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Empty snapshot merge SHALL create new snapshot.
   */
  it('should create snapshot from empty state', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        (files) => {
          const uniqueFiles = files.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueFiles.length === 0) {
            return true;
          }

          const result = mergeSnapshots(null, uniqueFiles);

          // All files should be created
          expect(result.fileCount).toBe(uniqueFiles.length);
          expect(result.changes.length).toBe(uniqueFiles.length);
          
          for (const change of result.changes) {
            expect(change.action).toBe('create');
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Language detection SHALL work correctly.
   */
  it('should detect language from file extension', () => {
    const testCases: [string, string][] = [
      ['src/app.ts', 'typescript'],
      ['src/app.tsx', 'typescript'],
      ['src/app.js', 'javascript'],
      ['src/app.jsx', 'javascript'],
      ['src/data.json', 'json'],
      ['src/styles.css', 'css'],
      ['src/index.html', 'html'],
      ['README.md', 'markdown'],
      ['src/app.py', 'python']
    ];

    for (const [path, expectedLang] of testCases) {
      expect(snapshotMerger.detectLanguage(path)).toBe(expectedLang);
    }
  });

  /**
   * Property: Merge SHALL be idempotent for same content.
   */
  it('should not record changes when content is identical', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        (files) => {
          const uniqueFiles = files.filter((file, index, self) =>
            self.findIndex(f => f.path === file.path) === index
          );

          if (uniqueFiles.length === 0) {
            return true;
          }

          // Create initial snapshot
          const existingSnapshot = generateSnapshot(uniqueFiles);

          // Merge with same files (same content)
          const result = mergeSnapshots(existingSnapshot, uniqueFiles);

          // No changes should be recorded (content is identical)
          expect(result.changes.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
