/**
 * Property-Based Tests for Framework Detector
 * 
 * **Feature: v0-lovable-architecture, Property 11: Framework Detection Accuracy**
 * **Validates: Requirements 6.6**
 * 
 * For any package.json content, the framework detector SHALL correctly identify
 * the framework based on dependencies (react, next, vue, express, fastapi, etc.)
 * or return 'unknown'.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectFrameworkFromPackageJson,
  detectPackageManager,
  detectPythonFramework,
  detectFramework,
  type PackageJson,
  type FrameworkDetectionResult,
} from '../services/framework-detector';

describe('Framework Detector Property Tests', () => {
  /**
   * **Feature: v0-lovable-architecture, Property 11: Framework Detection Accuracy**
   * **Validates: Requirements 6.6**
   */
  describe('Property 11: Framework Detection Accuracy', () => {
    // Arbitrary for generating valid package.json with specific framework
    const frameworkDependencies: Record<string, Record<string, string>> = {
      nextjs: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
      react: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      vue: { vue: '^3.0.0' },
      angular: { '@angular/core': '^17.0.0' },
      express: { express: '^4.18.0' },
    };

    const frameworkArb = fc.constantFrom(
      'nextjs',
      'react',
      'vue',
      'angular',
      'express'
    ) as fc.Arbitrary<keyof typeof frameworkDependencies>;

    const packageJsonWithFrameworkArb = (framework: keyof typeof frameworkDependencies) =>
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/.test(s)),
        dependencies: fc.constant(frameworkDependencies[framework]),
        devDependencies: fc.constant({}),
        scripts: fc.constant({ dev: 'npm run dev', build: 'npm run build' }),
      });

    it('should correctly identify Next.js from dependencies', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ next: '^14.0.0', react: '^18.0.0' }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('nextjs');
            expect(result.version).toBe('^14.0.0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify React (without Next.js) from dependencies', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('react');
            expect(result.version).toBe('^18.0.0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify Vue from dependencies', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ vue: '^3.4.0' }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('vue');
            expect(result.version).toBe('^3.4.0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify Express from dependencies', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ express: '^4.18.0' }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({ start: 'node server.js' }),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('express');
            expect(result.version).toBe('^4.18.0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify Angular from dependencies', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ '@angular/core': '^17.0.0' }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('angular');
            expect(result.version).toBe('^17.0.0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return unknown for package.json without recognized frameworks', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ lodash: '^4.17.0', axios: '^1.0.0' }),
            devDependencies: fc.constant({ typescript: '^5.0.0' }),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize Next.js over React when both are present', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({ 
              next: '^14.0.0', 
              react: '^18.0.0',
              'react-dom': '^18.0.0'
            }),
            devDependencies: fc.constant({}),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            // Next.js should be detected, not plain React
            expect(result.framework).toBe('nextjs');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect framework from devDependencies as well', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1 }),
            dependencies: fc.constant({}),
            devDependencies: fc.constant({ vue: '^3.4.0' }),
            scripts: fc.constant({}),
          }),
          (packageJson: PackageJson) => {
            const result = detectFrameworkFromPackageJson(packageJson);
            expect(result.framework).toBe('vue');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Package Manager Detection', () => {
    it('should detect pnpm from pnpm-lock.yaml', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()).map(files => [...files, 'pnpm-lock.yaml']),
          (lockFiles) => {
            const result = detectPackageManager(lockFiles);
            expect(result).toBe('pnpm');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect yarn from yarn.lock', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string().filter(s => !s.includes('pnpm'))).map(files => [...files, 'yarn.lock']),
          (lockFiles) => {
            const result = detectPackageManager(lockFiles);
            expect(result).toBe('yarn');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should default to npm when no lock files match', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string().filter(s => !s.includes('pnpm') && !s.includes('yarn'))),
          (lockFiles) => {
            const result = detectPackageManager(lockFiles);
            expect(result).toBe('npm');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Python Framework Detection', () => {
    it('should detect FastAPI from requirements content', () => {
      fc.assert(
        fc.property(
          fc.string().map(s => `${s}\nfastapi==0.100.0\n${s}`),
          (requirementsContent) => {
            const result = detectPythonFramework(requirementsContent);
            expect(result.framework).toBe('fastapi');
            expect(result.port).toBe(8000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect Flask from requirements content', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('fastapi') && !s.includes('FastAPI')).map(s => `${s}\nflask==2.0.0\n${s}`),
          (requirementsContent) => {
            const result = detectPythonFramework(requirementsContent);
            expect(result.framework).toBe('flask');
            expect(result.port).toBe(5000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect Django from requirements content', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('fastapi') && !s.includes('flask')).map(s => `${s}\ndjango==4.0.0\n${s}`),
          (requirementsContent) => {
            const result = detectPythonFramework(requirementsContent);
            expect(result.framework).toBe('django');
            expect(result.port).toBe(8000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use poetry as package manager when pyproject.toml is present', () => {
      fc.assert(
        fc.property(
          fc.constant('[tool.poetry]\nname = "myproject"'),
          (pyprojectContent) => {
            const result = detectPythonFramework(undefined, pyprojectContent);
            expect(result.packageManager).toBe('poetry');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Framework Detection', () => {
    it('should detect framework from valid JSON package.json content', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('next', 'react', 'vue', 'express'),
          (framework) => {
            const packageJsonContent = JSON.stringify({
              name: 'test-project',
              dependencies: { [framework]: '^1.0.0' },
            });
            const result = detectFramework(packageJsonContent);
            // Should detect a known framework (not unknown)
            if (framework === 'next') {
              expect(result.framework).toBe('nextjs');
            } else {
              expect(result.framework).toBe(framework);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return unknown for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          (invalidJson) => {
            const result = detectFramework(invalidJson);
            expect(result.framework).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return a valid FrameworkDetectionResult structure', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string()),
          fc.array(fc.string()),
          fc.option(fc.string()),
          fc.option(fc.string()),
          (packageJson, lockFiles, requirements, pyproject) => {
            const result = detectFramework(
              packageJson ?? undefined,
              lockFiles,
              requirements ?? undefined,
              pyproject ?? undefined
            );
            
            // Result should always have framework and packageManager
            expect(result).toHaveProperty('framework');
            expect(result).toHaveProperty('packageManager');
            
            // Framework should be one of the valid values
            expect([
              'nextjs', 'react', 'vue', 'angular', 'express',
              'fastapi', 'flask', 'django', 'python', 'unknown'
            ]).toContain(result.framework);
            
            // Package manager should be one of the valid values
            expect([
              'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'unknown'
            ]).toContain(result.packageManager);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
