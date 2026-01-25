/**
 * Property-Based Tests for No Inngest in Codebase
 * 
 * **Feature: v0-lovable-architecture, Property 22: No Inngest in Codebase**
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**
 * 
 * For any operation in the system (code generation, GitHub clone, or any other),
 * the system SHALL NOT use Inngest functions, inngest.send() calls, or the Inngest package.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper function to recursively get all TypeScript files in a directory
 */
function getTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, and other build directories
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist', 'build', '.kiro'].includes(entry.name)) {
        continue;
      }
      getTypeScriptFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      // Skip test files for this check (they may contain comments about Inngest)
      if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Helper function to check if a file contains Inngest imports or usage
 */
function checkFileForInngest(filePath: string): {
  hasInngestImport: boolean;
  hasInngestSend: boolean;
  hasInngestFunction: boolean;
  details: string[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const details: string[] = [];
  
  // Check for Inngest imports (excluding comments)
  const importPatterns = [
    /^import\s+.*from\s+['"]inngest['"]/m,
    /^import\s+.*from\s+['"]@inngest\//m,
    /^import\s+\{.*inngest.*\}\s+from/m,
  ];
  
  const hasInngestImport = importPatterns.some(pattern => {
    // Check each line that's not a comment
    const lines = content.split('\n');
    return lines.some(line => {
      const trimmed = line.trim();
      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return false;
      }
      return pattern.test(line);
    });
  });
  
  if (hasInngestImport) {
    details.push(`Found Inngest import in ${filePath}`);
  }
  
  // Check for inngest.send() calls (excluding comments)
  const lines = content.split('\n');
  const hasInngestSend = lines.some(line => {
    const trimmed = line.trim();
    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return false;
    }
    return /inngest\.send\s*\(/.test(line);
  });
  
  if (hasInngestSend) {
    details.push(`Found inngest.send() call in ${filePath}`);
  }
  
  // Check for Inngest function definitions (excluding comments)
  const hasInngestFunction = lines.some(line => {
    const trimmed = line.trim();
    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return false;
    }
    return /inngest\.createFunction\s*\(/.test(line);
  });
  
  if (hasInngestFunction) {
    details.push(`Found inngest.createFunction() in ${filePath}`);
  }
  
  return {
    hasInngestImport,
    hasInngestSend,
    hasInngestFunction,
    details,
  };
}

describe('No Inngest in Codebase Property Tests', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 22: No Inngest in Codebase**
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**
   */
  describe('Property 22: No Inngest in Codebase', () => {
    // Get all TypeScript files in the project
    const projectRoot = path.resolve(__dirname, '../..');
    const srcDir = path.join(projectRoot, 'src');
    const appDir = path.join(projectRoot, 'app');
    const serverDir = path.join(projectRoot, 'server');
    const hooksDir = path.join(projectRoot, 'hooks');
    const libDir = path.join(projectRoot, 'lib');
    
    const allFiles: string[] = [];
    
    // Collect files from all relevant directories
    if (fs.existsSync(srcDir)) {
      getTypeScriptFiles(srcDir, allFiles);
    }
    if (fs.existsSync(appDir)) {
      getTypeScriptFiles(appDir, allFiles);
    }
    if (fs.existsSync(serverDir)) {
      getTypeScriptFiles(serverDir, allFiles);
    }
    if (fs.existsSync(hooksDir)) {
      getTypeScriptFiles(hooksDir, allFiles);
    }
    if (fs.existsSync(libDir)) {
      getTypeScriptFiles(libDir, allFiles);
    }

    it('should not have any Inngest imports in source files', () => {
      const filesWithInngestImports: string[] = [];
      
      for (const file of allFiles) {
        const result = checkFileForInngest(file);
        if (result.hasInngestImport) {
          filesWithInngestImports.push(...result.details);
        }
      }
      
      expect(filesWithInngestImports).toEqual([]);
    });

    it('should not have any inngest.send() calls in source files', () => {
      const filesWithInngestSend: string[] = [];
      
      for (const file of allFiles) {
        const result = checkFileForInngest(file);
        if (result.hasInngestSend) {
          filesWithInngestSend.push(...result.details);
        }
      }
      
      expect(filesWithInngestSend).toEqual([]);
    });

    it('should not have any Inngest function definitions in source files', () => {
      const filesWithInngestFunctions: string[] = [];
      
      for (const file of allFiles) {
        const result = checkFileForInngest(file);
        if (result.hasInngestFunction) {
          filesWithInngestFunctions.push(...result.details);
        }
      }
      
      expect(filesWithInngestFunctions).toEqual([]);
    });

    it('should not have src/inngest directory', () => {
      const inngestDir = path.join(projectRoot, 'src', 'inngest');
      const dirExists = fs.existsSync(inngestDir);
      
      // If directory exists, check if it has any .ts files
      if (dirExists) {
        const files = fs.readdirSync(inngestDir).filter(f => f.endsWith('.ts'));
        expect(files).toEqual([]);
      }
    });

    it('should not have app/api/inngest route', () => {
      const inngestRoute = path.join(projectRoot, 'app', 'api', 'inngest', 'route.ts');
      expect(fs.existsSync(inngestRoute)).toBe(false);
    });

    it('should not have inngest in package.json dependencies', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      
      const inngestPackages = [
        ...Object.keys(dependencies).filter(dep => dep.includes('inngest')),
        ...Object.keys(devDependencies).filter(dep => dep.includes('inngest')),
      ];
      
      expect(inngestPackages).toEqual([]);
    });

    /**
     * Property-based test: For any randomly selected source file,
     * it should not contain active Inngest code
     */
    it('should not have Inngest code in any randomly selected source file', () => {
      if (allFiles.length === 0) {
        // Skip if no files found
        return;
      }
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: allFiles.length - 1 }),
          (fileIndex) => {
            const file = allFiles[fileIndex];
            const result = checkFileForInngest(file);
            
            // None of the Inngest patterns should be found
            expect(result.hasInngestImport).toBe(false);
            expect(result.hasInngestSend).toBe(false);
            expect(result.hasInngestFunction).toBe(false);
          }
        ),
        { numRuns: Math.min(100, allFiles.length) }
      );
    });
  });
});
