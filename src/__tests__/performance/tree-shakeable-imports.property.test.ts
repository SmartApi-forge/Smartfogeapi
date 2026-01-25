/**
 * Property Test: Tree-Shakeable Import Pattern
 * **Feature: nextjs-performance-optimization, Property 5: Tree-Shakeable Import Pattern**
 * **Validates: Requirements 4.4**
 * 
 * This property test verifies that large library imports use named imports
 * for specific functions/components rather than default or namespace imports,
 * enabling tree-shaking.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Large libraries that should use named imports for tree-shaking
const LARGE_LIBRARIES = [
  'framer-motion',
  'lucide-react',
  '@tabler/icons-react',
];

// Directories to scan for imports
const SCAN_DIRECTORIES = [
  'components',
  'app',
  'src/components',
];

/**
 * Recursively get all TSX files in a directory
 */
function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    return files;
  }
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        files.push(...getTsxFiles(fullPath));
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Check if a file has namespace imports from a specific library
 * Namespace imports: import * as X from 'library'
 */
function hasNamespaceImport(content: string, library: string): boolean {
  // Escape special regex characters in library name
  const escapedLibrary = library.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namespacePattern = new RegExp(
    `import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${escapedLibrary}['"]`,
    'g'
  );
  return namespacePattern.test(content);
}

/**
 * Check if a file has default imports from a specific library
 * Default imports: import X from 'library' (without curly braces)
 */
function hasDefaultImport(content: string, library: string): boolean {
  // Escape special regex characters in library name
  const escapedLibrary = library.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: import SomeName from 'library' but NOT import { ... } from 'library'
  const defaultPattern = new RegExp(
    `import\\s+(?!\\{)([A-Z]\\w*)\\s+from\\s+['"]${escapedLibrary}['"]`,
    'g'
  );
  return defaultPattern.test(content);
}

/**
 * Check if a file has barrel re-exports from a specific library
 * Barrel exports: export * from 'library'
 */
function hasBarrelExport(content: string, library: string): boolean {
  // Escape special regex characters in library name
  const escapedLibrary = library.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const barrelPattern = new RegExp(
    `export\\s+\\*\\s+from\\s+['"]${escapedLibrary}['"]`,
    'g'
  );
  return barrelPattern.test(content);
}

/**
 * Get all files that import from a specific library
 */
function getFilesImportingLibrary(library: string): { file: string; content: string }[] {
  const results: { file: string; content: string }[] = [];
  
  for (const dir of SCAN_DIRECTORIES) {
    const fullDir = join(process.cwd(), dir);
    const files = getTsxFiles(fullDir);
    
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes(`from '${library}'`) || content.includes(`from "${library}"`)) {
        results.push({ file, content });
      }
    }
  }
  
  return results;
}

describe('Property 5: Tree-Shakeable Import Pattern', () => {
  /**
   * Property: For any import statement from large libraries,
   * the import SHALL use named imports for specific functions/components
   * rather than default or namespace imports, enabling tree-shaking.
   */
  it('should not have namespace imports (import * as) from large libraries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LARGE_LIBRARIES),
        (library) => {
          const filesWithImports = getFilesImportingLibrary(library);
          
          for (const { file, content } of filesWithImports) {
            if (hasNamespaceImport(content, library)) {
              throw new Error(
                `File ${file} uses namespace import (import * as) from '${library}'. ` +
                `Use named imports instead for tree-shaking: import { specific, components } from '${library}'`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: LARGE_LIBRARIES.length }
    );
  });

  it('should not have default imports from large libraries (except where valid)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LARGE_LIBRARIES),
        (library) => {
          const filesWithImports = getFilesImportingLibrary(library);
          
          for (const { file, content } of filesWithImports) {
            if (hasDefaultImport(content, library)) {
              throw new Error(
                `File ${file} uses default import from '${library}'. ` +
                `Use named imports instead for tree-shaking: import { specific, components } from '${library}'`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: LARGE_LIBRARIES.length }
    );
  });

  it('should not have barrel re-exports (export *) from large libraries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LARGE_LIBRARIES),
        (library) => {
          const filesWithImports = getFilesImportingLibrary(library);
          
          for (const { file, content } of filesWithImports) {
            if (hasBarrelExport(content, library)) {
              throw new Error(
                `File ${file} uses barrel re-export (export *) from '${library}'. ` +
                `Use named re-exports instead: export { specific, components } from '${library}'`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: LARGE_LIBRARIES.length }
    );
  });

  /**
   * Specific verification: All framer-motion imports should be named imports
   */
  it('should have all framer-motion imports as named imports', () => {
    const filesWithMotion = getFilesImportingLibrary('framer-motion');
    
    expect(filesWithMotion.length).toBeGreaterThan(0);
    
    for (const { file, content } of filesWithMotion) {
      // Should have named imports like: import { motion, AnimatePresence } from 'framer-motion'
      const hasNamedImport = /import\s+\{[^}]+\}\s+from\s+['"]framer-motion['"]/.test(content);
      
      expect(hasNamedImport).toBe(true);
      expect(hasNamespaceImport(content, 'framer-motion')).toBe(false);
    }
  });

  /**
   * Specific verification: All lucide-react imports should be named imports
   */
  it('should have all lucide-react imports as named imports', () => {
    const filesWithLucide = getFilesImportingLibrary('lucide-react');
    
    expect(filesWithLucide.length).toBeGreaterThan(0);
    
    for (const { file, content } of filesWithLucide) {
      // Should have named imports like: import { Icon1, Icon2 } from 'lucide-react'
      const hasNamedImport = /import\s+\{[^}]+\}\s+from\s+['"]lucide-react['"]/.test(content);
      
      expect(hasNamedImport).toBe(true);
      expect(hasNamespaceImport(content, 'lucide-react')).toBe(false);
    }
  });

  /**
   * Specific verification: All @tabler/icons-react imports should be named imports
   */
  it('should have all @tabler/icons-react imports as named imports', () => {
    const filesWithTabler = getFilesImportingLibrary('@tabler/icons-react');
    
    // May have 0 files if not used
    for (const { file, content } of filesWithTabler) {
      // Should have named imports like: import { IconX, IconY } from '@tabler/icons-react'
      const hasNamedImport = /import\s+\{[^}]+\}\s+from\s+['"]@tabler\/icons-react['"]/.test(content);
      
      expect(hasNamedImport).toBe(true);
      expect(hasNamespaceImport(content, '@tabler/icons-react')).toBe(false);
    }
  });

  /**
   * Property: The motion-wrapper.tsx should use named exports, not barrel exports
   */
  it('should have motion-wrapper using named exports instead of barrel exports', () => {
    const wrapperPath = join(process.cwd(), 'components/motion-wrapper.tsx');
    
    if (existsSync(wrapperPath)) {
      const content = readFileSync(wrapperPath, 'utf-8');
      
      // Should NOT have: export * from 'framer-motion'
      expect(content).not.toMatch(/export\s+\*\s+from\s+['"]framer-motion['"]/);
      
      // Should have named exports: export { motion, AnimatePresence }
      expect(content).toMatch(/export\s+\{[^}]+\}/);
    }
  });
});
