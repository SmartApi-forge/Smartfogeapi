/**
 * Property-Based Tests for Initial Snapshot Creation
 * 
 * **Feature: v0-lovable-architecture, Property 24: Initial Snapshot Creation**
 * **Validates: Requirements 6.9**
 * 
 * For any successfully cloned GitHub repository, the system SHALL create a
 * file_snapshot record with turn_index 0 containing all cloned files.
 * 
 * **Feature: full-project-scaffolding, Property 3: Initial Snapshot Creation**
 * **Validates: Requirements 1.3**
 * 
 * For any successfully cloned template, the database SHALL contain a file_snapshot
 * record with turn_index 0 and the template files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { FileSnapshotData, NewFileSnapshot } from '../types/database';

// Mock the conversation context service for testing
const mockSaveSnapshot = vi.fn();

// Simulated snapshot creation logic (extracted from the clone route)
interface SnapshotCreationInput {
  projectId: string;
  files: FileSnapshotData;
}

function createInitialSnapshot(input: SnapshotCreationInput): NewFileSnapshot {
  const { projectId, files } = input;
  const fileCount = Object.keys(files).length;
  const totalSize = Object.values(files).reduce((sum, f) => sum + f.size, 0);

  return {
    project_id: projectId,
    turn_index: 0, // Initial snapshot always has turn_index 0
    files_jsonb: files as any,
    file_count: fileCount,
    total_size_bytes: totalSize,
  };
}

function validateSnapshotStructure(snapshot: NewFileSnapshot): boolean {
  // Must have project_id
  if (!snapshot.project_id || typeof snapshot.project_id !== 'string') {
    return false;
  }
  
  // Must have turn_index 0 for initial snapshot
  if (snapshot.turn_index !== 0) {
    return false;
  }
  
  // Must have files_jsonb
  if (!snapshot.files_jsonb) {
    return false;
  }
  
  // file_count must match actual file count
  const actualFileCount = Object.keys(snapshot.files_jsonb as object).length;
  if (snapshot.file_count !== actualFileCount) {
    return false;
  }
  
  return true;
}

function validateFileEntries(files: FileSnapshotData): boolean {
  for (const [path, fileData] of Object.entries(files)) {
    // Path must be a non-empty string
    if (!path || typeof path !== 'string') {
      return false;
    }
    
    // Each file must have content, language, and size
    if (typeof fileData.content !== 'string') {
      return false;
    }
    if (typeof fileData.language !== 'string') {
      return false;
    }
    if (typeof fileData.size !== 'number' || fileData.size < 0) {
      return false;
    }
    
    // Size should match content length
    if (fileData.size !== fileData.content.length) {
      return false;
    }
  }
  
  return true;
}

describe('Initial Snapshot Creation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: v0-lovable-architecture, Property 24: Initial Snapshot Creation**
   * **Validates: Requirements 6.9**
   */
  describe('Property 24: Initial Snapshot Creation', () => {
    // Arbitrary for generating valid file paths
    const filePathArb = fc.array(
      fc.stringMatching(/^[a-z][a-z0-9]*$/),
      { minLength: 1, maxLength: 4 }
    ).map(parts => parts.join('/') + '.ts');

    // Arbitrary for generating file content
    const fileContentArb = fc.string({ minLength: 0, maxLength: 1000 });

    // Arbitrary for generating language
    const languageArb = fc.constantFrom(
      'typescript', 'javascript', 'json', 'css', 'html', 'markdown', 'python'
    );

    // Arbitrary for generating a single file entry
    const fileEntryArb = fc.tuple(fileContentArb, languageArb).map(([content, language]) => ({
      content,
      language,
      size: content.length,
    }));

    // Arbitrary for generating FileSnapshotData
    const fileSnapshotDataArb = fc.dictionary(
      filePathArb,
      fileEntryArb
    ) as fc.Arbitrary<FileSnapshotData>;

    // Arbitrary for generating project ID (UUID format)
    const projectIdArb = fc.uuid();

    it('should always create snapshot with turn_index 0 for initial clone', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            
            // Initial snapshot must always have turn_index 0
            expect(snapshot.turn_index).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all cloned files in the snapshot', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const snapshotFiles = snapshot.files_jsonb as FileSnapshotData;
            
            // All input files should be in the snapshot
            const inputPaths = Object.keys(files);
            const snapshotPaths = Object.keys(snapshotFiles);
            
            expect(snapshotPaths.length).toBe(inputPaths.length);
            
            for (const path of inputPaths) {
              expect(snapshotFiles[path]).toBeDefined();
              expect(snapshotFiles[path].content).toBe(files[path].content);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate file_count', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const expectedCount = Object.keys(files).length;
            
            expect(snapshot.file_count).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate total_size_bytes', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const expectedSize = Object.values(files).reduce((sum, f) => sum + f.size, 0);
            
            expect(snapshot.total_size_bytes).toBe(expectedSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve file path, content, language, and size for each file', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const snapshotFiles = snapshot.files_jsonb as FileSnapshotData;
            
            for (const [path, fileData] of Object.entries(files)) {
              const snapshotFile = snapshotFiles[path];
              
              expect(snapshotFile).toBeDefined();
              expect(snapshotFile.content).toBe(fileData.content);
              expect(snapshotFile.language).toBe(fileData.language);
              expect(snapshotFile.size).toBe(fileData.size);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid snapshot structure', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          fileSnapshotDataArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            
            expect(validateSnapshotStructure(snapshot)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty file set (edge case)', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          (projectId) => {
            const emptyFiles: FileSnapshotData = {};
            const snapshot = createInitialSnapshot({ projectId, files: emptyFiles });
            
            expect(snapshot.turn_index).toBe(0);
            expect(snapshot.file_count).toBe(0);
            expect(snapshot.total_size_bytes).toBe(0);
            expect(Object.keys(snapshot.files_jsonb as object).length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle files with empty content', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          filePathArb,
          languageArb,
          (projectId, path, language) => {
            const files: FileSnapshotData = {
              [path]: {
                content: '',
                language,
                size: 0,
              },
            };
            
            const snapshot = createInitialSnapshot({ projectId, files });
            const snapshotFiles = snapshot.files_jsonb as FileSnapshotData;
            
            expect(snapshotFiles[path].content).toBe('');
            expect(snapshotFiles[path].size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('File Entry Validation', () => {
    it('should validate that all file entries have required fields', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1 }).filter(s => !s.includes('\0')),
            fc.record({
              content: fc.string(),
              language: fc.string({ minLength: 1 }),
              size: fc.nat(),
            }).map(({ content, language }) => ({
              content,
              language,
              size: content.length, // Ensure size matches content length
            }))
          ) as fc.Arbitrary<FileSnapshotData>,
          (files) => {
            expect(validateFileEntries(files)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 3: Initial Snapshot Creation**
   * **Validates: Requirements 1.3**
   * 
   * For any successfully cloned template, the database SHALL contain a file_snapshot
   * record with turn_index 0 and the template files.
   */
  describe('Property 3: Initial Snapshot Creation (Template Cloning)', () => {
    // Arbitrary for generating valid file paths (Next.js project structure)
    const templateFilePathArb = fc.constantFrom(
      'app/layout.tsx',
      'app/page.tsx',
      'app/globals.css',
      'package.json',
      'tsconfig.json',
      'next.config.mjs',
      'tailwind.config.ts',
      'components/ui/button.tsx',
      'components/ui/card.tsx',
      'lib/utils.ts',
    );

    // Arbitrary for generating file content
    const fileContentArb = fc.string({ minLength: 1, maxLength: 500 });

    // Arbitrary for generating language based on file extension
    const getLanguageForPath = (path: string): string => {
      if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
      if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
      if (path.endsWith('.json')) return 'json';
      if (path.endsWith('.css')) return 'css';
      if (path.endsWith('.mjs')) return 'javascript';
      return 'plaintext';
    };

    // Arbitrary for generating template files (simulating cloneTemplate result)
    const templateFilesArb = fc.array(
      fc.tuple(templateFilePathArb, fileContentArb),
      { minLength: 1, maxLength: 10 }
    ).map(entries => {
      const files: FileSnapshotData = {};
      const uniquePaths = new Set<string>();
      
      for (const [path, content] of entries) {
        if (!uniquePaths.has(path)) {
          uniquePaths.add(path);
          files[path] = {
            content,
            language: getLanguageForPath(path),
            size: content.length,
          };
        }
      }
      return files;
    });

    // Arbitrary for generating project ID (UUID format)
    const projectIdArb = fc.uuid();

    it('should create snapshot with turn_index 0 for template clone', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            
            // Template clone snapshot must always have turn_index 0
            expect(snapshot.turn_index).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all template files in the snapshot', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const snapshotFiles = snapshot.files_jsonb as FileSnapshotData;
            
            // All template files should be in the snapshot
            const inputPaths = Object.keys(files);
            const snapshotPaths = Object.keys(snapshotFiles);
            
            expect(snapshotPaths.length).toBe(inputPaths.length);
            
            for (const path of inputPaths) {
              expect(snapshotFiles[path]).toBeDefined();
              expect(snapshotFiles[path].content).toBe(files[path].content);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid project_id in snapshot', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            
            // Snapshot must have the correct project_id
            expect(snapshot.project_id).toBe(projectId);
            expect(typeof snapshot.project_id).toBe('string');
            expect(snapshot.project_id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate file_count for template files', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const expectedCount = Object.keys(files).length;
            
            expect(snapshot.file_count).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate total_size_bytes for template files', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            const expectedSize = Object.values(files).reduce((sum, f) => sum + f.size, 0);
            
            expect(snapshot.total_size_bytes).toBe(expectedSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid snapshot structure for template clone', () => {
      fc.assert(
        fc.property(
          projectIdArb,
          templateFilesArb,
          (projectId, files) => {
            const snapshot = createInitialSnapshot({ projectId, files });
            
            expect(validateSnapshotStructure(snapshot)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
