/**
 * Property Tests: Code Block Parser
 * 
 * **Feature: v0-lovable-architecture, Property 12: Code Block Parsing Round-Trip**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 * 
 * Property: For any LLM response containing code blocks in the format 
 * ```language\nfilepath\ncontent```, parsing SHALL extract all valid file paths 
 * and their associated content, and the number of parsed files SHALL equal 
 * the number of valid code blocks.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseCodeBlocks,
  formatCodeBlocks,
  formatCodeBlocksLegacy,
  codeBlockParser,
  type ParsedFile
} from '../services/code-block-parser';

/**
 * Arbitrary for generating valid file names (alphanumeric with dashes/underscores)
 */
const fileNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * Arbitrary for generating valid file paths
 */
const validFilePathArb = fc.oneof(
  // TypeScript files
  fc.tuple(
    fileNameArb,
    fc.constantFrom('.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.py', '.sql')
  ).map(([name, ext]) => `src/${name}${ext}`),
  // Nested paths
  fc.tuple(
    fileNameArb,
    fileNameArb,
    fc.constantFrom('.ts', '.tsx', '.js', '.json', '.css')
  ).map(([dir, name, ext]) => `src/${dir}/${name}${ext}`)
);

/**
 * Arbitrary for generating valid code content (no triple backticks)
 */
const validCodeContentArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => !s.includes('```'));

/**
 * Arbitrary for generating valid language identifiers
 */
const validLanguageArb = fc.constantFrom(
  'typescript', 'javascript', 'python', 'json', 'html', 'css', 'sql', 'markdown', 'yaml', 'shell'
);

/**
 * Arbitrary for generating a valid ParsedFile
 */
const parsedFileArb = fc.record({
  path: validFilePathArb,
  content: validCodeContentArb,
  language: validLanguageArb
});

describe('Property 12: Code Block Parsing Round-Trip', () => {
  /**
   * Property: Parsing formatted code blocks SHALL recover the original files.
   * This tests the v0-style format round-trip.
   */
  it('should round-trip v0-style code blocks correctly', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        (files) => {
          // Ensure unique paths
          const uniqueFiles = files.filter((file, index, self) => 
            self.findIndex(f => f.path === file.path) === index
          );

          // Format files into code blocks
          const formatted = formatCodeBlocks(uniqueFiles);

          // Parse them back
          const result = parseCodeBlocks(formatted);

          // Should recover all files
          expect(result.files.length).toBe(uniqueFiles.length);

          // Each file should match
          for (const original of uniqueFiles) {
            const parsed = result.files.find(f => f.path === original.path);
            expect(parsed).toBeDefined();
            expect(parsed?.content).toBe(original.content);
            expect(parsed?.language).toBe(original.language);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Parsing formatted legacy code blocks SHALL recover the original files.
   */
  it('should round-trip legacy-style code blocks correctly', () => {
    fc.assert(
      fc.property(
        fc.array(parsedFileArb, { minLength: 1, maxLength: 5 }),
        (files) => {
          // Ensure unique paths
          const uniqueFiles = files.filter((file, index, self) => 
            self.findIndex(f => f.path === file.path) === index
          );

          // Format files into legacy code blocks
          const formatted = formatCodeBlocksLegacy(uniqueFiles);

          // Parse them back
          const result = parseCodeBlocks(formatted);

          // Should recover all files
          expect(result.files.length).toBe(uniqueFiles.length);

          // Each file should match
          for (const original of uniqueFiles) {
            const parsed = result.files.find(f => f.path === original.path);
            expect(parsed).toBeDefined();
            expect(parsed?.content).toBe(original.content);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Number of parsed files SHALL equal number of valid code blocks.
   */
  it('should parse correct number of code blocks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (numBlocks) => {
          // Generate unique file paths
          const files: ParsedFile[] = [];
          for (let i = 0; i < numBlocks; i++) {
            files.push({
              path: `src/file-${i}.ts`,
              content: `// File ${i} content\nexport const value${i} = ${i};`,
              language: 'typescript'
            });
          }

          // Format and parse
          const formatted = formatCodeBlocks(files);
          const result = parseCodeBlocks(formatted);

          // Count should match
          expect(result.files.length).toBe(numBlocks);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid code blocks (no file path) SHALL be skipped.
   */
  it('should skip code blocks without valid file paths', () => {
    // Code block without file path
    const responseWithInvalidBlock = `
Here's some code:

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

And here's a valid file:

\`\`\`typescript file="src/valid.ts"
export const valid = true;
\`\`\`
`;

    const result = parseCodeBlocks(responseWithInvalidBlock);
    
    // Should only parse the valid file
    expect(result.files.length).toBe(1);
    expect(result.files[0].path).toBe('src/valid.ts');
  });

  /**
   * Property: Empty response SHALL return empty files array.
   */
  it('should handle empty response', () => {
    const result = parseCodeBlocks('');
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  /**
   * Property: Response with no code blocks SHALL return empty files array.
   */
  it('should handle response with no code blocks', () => {
    const response = 'This is just a text response with no code blocks.';
    const result = parseCodeBlocks(response);
    expect(result.files).toEqual([]);
  });

  /**
   * Property: File paths SHALL be validated correctly.
   */
  it('should validate file paths correctly', () => {
    fc.assert(
      fc.property(
        validFilePathArb,
        (path) => {
          // All generated paths should be valid
          expect(codeBlockParser.isValidFilePath(path)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Code-like strings SHALL NOT be valid file paths.
   */
  it('should reject code-like strings as file paths', () => {
    const invalidPaths = [
      'import { something } from "module"',
      'export const x = 1;',
      'const y = 2;',
      'function foo() {}',
      'class MyClass {}',
      'if (condition) {',
      '// This is a comment',
      '/* Block comment */',
      '{ key: value }',
      'return value;'
    ];

    for (const path of invalidPaths) {
      expect(codeBlockParser.isValidFilePath(path)).toBe(false);
    }
  });

  /**
   * Property: Language detection SHALL work for common extensions.
   */
  it('should detect language from file extension', () => {
    const testCases: [string, string][] = [
      ['src/app.ts', 'typescript'],
      ['src/app.tsx', 'typescript'],
      ['src/app.js', 'javascript'],
      ['src/app.jsx', 'javascript'],
      ['src/app.py', 'python'],
      ['src/data.json', 'json'],
      ['src/styles.css', 'css'],
      ['src/index.html', 'html'],
      ['README.md', 'markdown'],
      ['schema.sql', 'sql']
    ];

    for (const [path, expectedLang] of testCases) {
      expect(codeBlockParser.detectLanguageFromPath(path)).toBe(expectedLang);
    }
  });

  /**
   * Property: Duplicate file paths SHALL be deduplicated (first wins).
   */
  it('should deduplicate files with same path', () => {
    const response = `
\`\`\`typescript file="src/app.ts"
// First version
export const first = true;
\`\`\`

\`\`\`typescript file="src/app.ts"
// Second version
export const second = true;
\`\`\`
`;

    const result = parseCodeBlocks(response);
    
    // Should only have one file
    expect(result.files.length).toBe(1);
    // First one wins
    expect(result.files[0].content).toContain('first');
  });

  /**
   * Property: Mixed v0 and legacy formats SHALL both be parsed.
   */
  it('should parse mixed format code blocks', () => {
    const response = `
\`\`\`typescript file="src/v0-style.ts"
export const v0 = true;
\`\`\`

\`\`\`typescript
src/legacy-style.ts
export const legacy = true;
\`\`\`
`;

    const result = parseCodeBlocks(response);
    
    // Should parse both
    expect(result.files.length).toBe(2);
    expect(result.files.some(f => f.path === 'src/v0-style.ts')).toBe(true);
    expect(result.files.some(f => f.path === 'src/legacy-style.ts')).toBe(true);
  });

  /**
   * Property: Content with special characters SHALL be preserved.
   */
  it('should preserve special characters in content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('```')),
        (content) => {
          const file: ParsedFile = {
            path: 'src/test.ts',
            content,
            language: 'typescript'
          };

          const formatted = formatCodeBlocks([file]);
          const result = parseCodeBlocks(formatted);

          expect(result.files.length).toBe(1);
          expect(result.files[0].content).toBe(content);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
