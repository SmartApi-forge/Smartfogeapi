/**
 * Property Test: Image Component Usage
 * **Feature: nextjs-performance-optimization, Property 2: Image Component Usage**
 * **Validates: Requirements 2.2**
 * 
 * This property test verifies that all images in the application are rendered
 * using the `next/image` component rather than raw HTML `<img>` tags,
 * ensuring automatic optimization, lazy loading, and format conversion.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Directories to scan for image usage
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
    } else if (entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Check if a file contains raw HTML img tags
 * Matches: <img, <img/, <img src, etc.
 * Does NOT match: <Image (next/image component)
 */
function hasRawImgTag(content: string): { found: boolean; matches: string[] } {
  // Pattern to match raw <img tags (case-insensitive for the tag name)
  // This matches <img followed by whitespace, /, or >
  const imgPattern = /<img(?:\s|\/|>)/gi;
  const matches = content.match(imgPattern) || [];
  
  return {
    found: matches.length > 0,
    matches,
  };
}

/**
 * Check if a file imports next/image
 */
function hasNextImageImport(content: string): boolean {
  return /import\s+(?:Image|\{[^}]*Image[^}]*\})\s+from\s+['"]next\/image['"]/.test(content);
}

/**
 * Get all TSX files from scan directories
 */
function getAllTsxFiles(): string[] {
  const allFiles: string[] = [];
  
  for (const dir of SCAN_DIRECTORIES) {
    const fullDir = join(process.cwd(), dir);
    allFiles.push(...getTsxFiles(fullDir));
  }
  
  return allFiles;
}

describe('Property 2: Image Component Usage', () => {
  /**
   * Property: For any TSX file in the application,
   * the file SHALL NOT contain raw HTML <img> tags.
   * All images must use the next/image component.
   */
  it('should not have raw <img> tags in any TSX file', () => {
    const allFiles = getAllTsxFiles();
    
    // Ensure we have files to test
    expect(allFiles.length).toBeGreaterThan(0);
    
    fc.assert(
      fc.property(
        fc.constantFrom(...allFiles),
        (filePath) => {
          const content = readFileSync(filePath, 'utf-8');
          const { found, matches } = hasRawImgTag(content);
          
          if (found) {
            const relativePath = filePath.replace(process.cwd(), '');
            throw new Error(
              `File ${relativePath} contains raw <img> tag(s). ` +
              `Found ${matches.length} occurrence(s). ` +
              `Use next/image component instead: import Image from 'next/image'`
            );
          }
          
          return true;
        }
      ),
      { numRuns: Math.min(allFiles.length, 100) }
    );
  });

  /**
   * Property: For any TSX file that renders images,
   * the file SHALL import from 'next/image'.
   */
  it('should have next/image import in files that use Image component', () => {
    const allFiles = getAllTsxFiles();
    
    fc.assert(
      fc.property(
        fc.constantFrom(...allFiles),
        (filePath) => {
          const content = readFileSync(filePath, 'utf-8');
          
          // Check if file uses <Image component (capital I)
          const usesImageComponent = /<Image\s/.test(content);
          
          if (usesImageComponent) {
            const hasImport = hasNextImageImport(content);
            
            if (!hasImport) {
              const relativePath = filePath.replace(process.cwd(), '');
              throw new Error(
                `File ${relativePath} uses <Image> component but doesn't import from 'next/image'. ` +
                `Add: import Image from 'next/image'`
              );
            }
          }
          
          return true;
        }
      ),
      { numRuns: Math.min(allFiles.length, 100) }
    );
  });

  /**
   * Specific verification: Components directory should have no raw img tags
   */
  it('should have no raw img tags in components directory', () => {
    const componentsDir = join(process.cwd(), 'components');
    const files = getTsxFiles(componentsDir);
    
    expect(files.length).toBeGreaterThan(0);
    
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const { found } = hasRawImgTag(content);
      const relativePath = file.replace(process.cwd(), '');
      
      expect(found, `Raw <img> tag found in ${relativePath}`).toBe(false);
    }
  });

  /**
   * Specific verification: App directory should have no raw img tags
   */
  it('should have no raw img tags in app directory', () => {
    const appDir = join(process.cwd(), 'app');
    const files = getTsxFiles(appDir);
    
    expect(files.length).toBeGreaterThan(0);
    
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const { found } = hasRawImgTag(content);
      const relativePath = file.replace(process.cwd(), '');
      
      expect(found, `Raw <img> tag found in ${relativePath}`).toBe(false);
    }
  });

  /**
   * Verification: Files using Image component should have proper attributes
   * (width, height, alt are required by next/image)
   */
  it('should have Image components with required attributes', () => {
    const allFiles = getAllTsxFiles();
    
    for (const file of allFiles) {
      const content = readFileSync(file, 'utf-8');
      
      // Find all Image component usages
      const imageUsages = content.match(/<Image\s[^>]*>/g) || [];
      
      for (const usage of imageUsages) {
        const relativePath = file.replace(process.cwd(), '');
        
        // Check for alt attribute (required for accessibility)
        expect(
          /alt=/.test(usage),
          `Image in ${relativePath} missing alt attribute: ${usage.substring(0, 50)}...`
        ).toBe(true);
        
        // Check for width and height OR fill attribute
        const hasWidthHeight = /width=/.test(usage) && /height=/.test(usage);
        const hasFill = /fill/.test(usage);
        
        expect(
          hasWidthHeight || hasFill,
          `Image in ${relativePath} missing width/height or fill: ${usage.substring(0, 50)}...`
        ).toBe(true);
      }
    }
  });
});
