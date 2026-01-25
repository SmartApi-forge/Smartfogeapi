/**
 * FileReconciler Property-Based Tests
 * 
 * Tests for the FileReconciler service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 8: File Name Reconciliation**
 * **Validates: Requirements 9.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FileReconciler } from './file-reconciler';

describe('FileReconciler', () => {
  const fileReconciler = new FileReconciler();

  describe('normalizePath', () => {
    it('should handle empty and null-like inputs', () => {
      expect(fileReconciler.normalizePath('')).toBe('');
      expect(fileReconciler.normalizePath('   ')).toBe('');
    });

    it('should convert backslashes to forward slashes', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 }),
          (parts: string[]) => {
            const backslashPath = parts.join('\\');
            const normalized = fileReconciler.normalizePath(backslashPath);
            expect(normalized).not.toContain('\\');
            expect(normalized).toBe(parts.join('/'));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove duplicate slashes', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9_\-\/]+$/),
          (path: string) => {
            const normalized = fileReconciler.normalizePath(path);
            expect(normalized).not.toMatch(/\/\//);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('findSimilarFile', () => {
    it('should return null for empty inputs', () => {
      expect(fileReconciler.findSimilarFile('', ['file.ts'])).toBeNull();
      expect(fileReconciler.findSimilarFile('file.ts', [])).toBeNull();
    });

    it('should find case-insensitive matches', () => {
      const existingFiles = ['components/HeroSection.tsx'];
      
      // Various case variations should match
      expect(fileReconciler.findSimilarFile('components/herosection.tsx', existingFiles))
        .toBe('components/HeroSection.tsx');
      expect(fileReconciler.findSimilarFile('components/HEROSECTION.tsx', existingFiles))
        .toBe('components/HeroSection.tsx');
    });

    it('should find separator variations (kebab-case vs PascalCase)', () => {
      const existingFiles = ['components/HeroSection.tsx'];
      
      // hero-section should match HeroSection
      expect(fileReconciler.findSimilarFile('components/hero-section.tsx', existingFiles))
        .toBe('components/HeroSection.tsx');
    });

    it('should find separator variations (snake_case vs PascalCase)', () => {
      const existingFiles = ['components/HeroSection.tsx'];
      
      // hero_section should match HeroSection
      expect(fileReconciler.findSimilarFile('components/hero_section.tsx', existingFiles))
        .toBe('components/HeroSection.tsx');
    });
  });

  describe('reconcile', () => {
    /**
     * **Feature: enhanced-context-management, Property 8: File Name Reconciliation**
     * **Validates: Requirements 9.4**
     * 
     * For any generated file path that differs only in case or separators from 
     * an existing file, the FileReconciler SHALL map it to the existing file.
     */
    it('Property 8: File Name Reconciliation - case differences', () => {
      // Generate file names with various naming conventions
      const fileNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,10}$/);
      const extensionArb = fc.constantFrom('.tsx', '.ts', '.jsx', '.js');
      const dirArb = fc.constantFrom('components', 'src/components', 'lib', 'utils');

      fc.assert(
        fc.property(
          fileNameArb,
          extensionArb,
          dirArb,
          (fileName: string, ext: string, dir: string) => {
            // Create the existing file path (PascalCase)
            const existingPath = `${dir}/${fileName}${ext}`;
            const existingFiles = [existingPath];
            
            // Create a lowercase version of the path
            const lowerCasePath = `${dir}/${fileName.toLowerCase()}${ext}`;
            
            // The reconciler should map the lowercase path to the existing file
            const result = fileReconciler.reconcile(lowerCasePath, existingFiles);
            expect(result).toBe(existingPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: enhanced-context-management, Property 8: File Name Reconciliation**
     * **Validates: Requirements 9.4**
     * 
     * For any generated file path that differs only in separators (kebab-case, snake_case, camelCase)
     * from an existing file, the FileReconciler SHALL map it to the existing file.
     */
    it('Property 8: File Name Reconciliation - separator differences', () => {
      // Helper to convert PascalCase to kebab-case
      const toKebabCase = (str: string): string => {
        return str
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .toLowerCase();
      };

      // Helper to convert PascalCase to snake_case
      const toSnakeCase = (str: string): string => {
        return str
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toLowerCase();
      };

      // Generate multi-word PascalCase names (e.g., HeroSection, NavBar)
      const wordArb = fc.stringMatching(/^[A-Z][a-z]{2,6}$/);
      const pascalNameArb = fc.array(wordArb, { minLength: 2, maxLength: 3 })
        .map(words => words.join(''));
      const extensionArb = fc.constantFrom('.tsx', '.ts', '.jsx', '.js');
      const dirArb = fc.constantFrom('components', 'src/components', 'lib');
      const separatorTypeArb = fc.constantFrom('kebab', 'snake');

      fc.assert(
        fc.property(
          pascalNameArb,
          extensionArb,
          dirArb,
          separatorTypeArb,
          (pascalName: string, ext: string, dir: string, separatorType: string) => {
            // Create the existing file path (PascalCase)
            const existingPath = `${dir}/${pascalName}${ext}`;
            const existingFiles = [existingPath];
            
            // Create a path with different separator convention
            const convertedName = separatorType === 'kebab' 
              ? toKebabCase(pascalName) 
              : toSnakeCase(pascalName);
            const generatedPath = `${dir}/${convertedName}${ext}`;
            
            // The reconciler should map the separator-different path to the existing file
            const result = fileReconciler.reconcile(generatedPath, existingFiles);
            expect(result).toBe(existingPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map kebab-case paths to PascalCase existing files (Property 8)', () => {
      // Test specific cases of kebab-case to PascalCase mapping
      const testCases = [
        { generated: 'components/hero-section.tsx', existing: 'components/HeroSection.tsx' },
        { generated: 'components/nav-bar.tsx', existing: 'components/NavBar.tsx' },
        { generated: 'components/user-profile.tsx', existing: 'components/UserProfile.tsx' },
        { generated: 'lib/api-client.ts', existing: 'lib/ApiClient.ts' },
      ];

      for (const { generated, existing } of testCases) {
        const result = fileReconciler.reconcile(generated, [existing]);
        expect(result).toBe(existing);
      }
    });

    it('should map snake_case paths to PascalCase existing files (Property 8)', () => {
      const testCases = [
        { generated: 'components/hero_section.tsx', existing: 'components/HeroSection.tsx' },
        { generated: 'components/nav_bar.tsx', existing: 'components/NavBar.tsx' },
        { generated: 'utils/string_utils.ts', existing: 'utils/StringUtils.ts' },
      ];

      for (const { generated, existing } of testCases) {
        const result = fileReconciler.reconcile(generated, [existing]);
        expect(result).toBe(existing);
      }
    });


    it('should return generated path when no match exists', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-z0-9_\-\/]*\.[a-z]{1,4}$/).filter(s => s.length > 2 && s.length < 30),
          (generatedPath: string) => {
            // Empty existing files - should return normalized generated path
            const result = fileReconciler.reconcile(generatedPath, []);
            expect(result).toBe(fileReconciler.normalizePath(generatedPath));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prefer exact case-insensitive match over fuzzy match', () => {
      const existingFiles = [
        'components/HeroSection.tsx',
        'components/Hero.tsx',
      ];
      
      // Should match HeroSection exactly, not Hero
      const result = fileReconciler.reconcile('components/herosection.tsx', existingFiles);
      expect(result).toBe('components/HeroSection.tsx');
    });

    it('should handle backslash paths from Windows', () => {
      const existingFiles = ['components/HeroSection.tsx'];
      
      // Windows-style path should be normalized and matched
      const result = fileReconciler.reconcile('components\\herosection.tsx', existingFiles);
      expect(result).toBe('components/HeroSection.tsx');
    });

    it('should handle compatible extension variations', () => {
      // .tsx and .ts should be considered compatible
      const existingFiles = ['components/Button.tsx'];
      
      const result = fileReconciler.reconcile('components/button.ts', existingFiles);
      expect(result).toBe('components/Button.tsx');
    });
  });
});
