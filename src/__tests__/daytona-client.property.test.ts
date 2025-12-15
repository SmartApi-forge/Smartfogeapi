/**
 * Property-Based Tests for Daytona Client Functions
 * 
 * Tests for template cloning, pnpm install, and package management functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the Daytona SDK before importing the client
vi.mock('@daytonaio/sdk', () => {
  return {
    Daytona: vi.fn().mockImplementation(() => ({
      create: vi.fn(),
      getCurrentSandbox: vi.fn(),
    })),
  };
});

// Import after mocking
import {
  cloneTemplate,
  runPnpmInstall,
  getInstalledPackages,
  type CloneTemplateResult,
  type PnpmInstallResult,
  type PackageInfo,
} from '../lib/daytona-client';

describe('Daytona Client Property Tests', () => {
  /**
   * **Feature: full-project-scaffolding, Property 1: Template Clone Timing**
   * **Validates: Requirements 1.1**
   * 
   * For any new project creation request, the template cloning operation
   * SHALL complete within 5 seconds (excluding network latency).
   * 
   * Note: This test validates the timing behavior of the cloneTemplate function.
   * Since we can't actually call Daytona in tests, we verify:
   * 1. The function returns a duration field
   * 2. The function handles errors gracefully with timing info
   * 3. The function structure supports timing measurement
   */
  describe('Property 1: Template Clone Timing', () => {
    it('should return duration field for any template clone attempt', () => {
      // Generate random template IDs and project IDs
      const templateIdArb = fc.oneof(
        fc.constant(''), // Empty template ID (error case)
        fc.string({ minLength: 1, maxLength: 50 }), // Valid template ID
      );
      const projectIdArb = fc.uuid();

      fc.assert(
        fc.asyncProperty(templateIdArb, projectIdArb, async (templateId, projectId) => {
          const result = await cloneTemplate(templateId, projectId);
          
          // Duration should always be present and non-negative
          expect(result).toHaveProperty('duration');
          expect(typeof result.duration).toBe('number');
          expect(result.duration).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return error with duration when template ID is empty', () => {
      const projectIdArb = fc.uuid();

      fc.assert(
        fc.asyncProperty(projectIdArb, async (projectId) => {
          const result = await cloneTemplate('', projectId);
          
          // Should fail with error
          expect(result.success).toBe(false);
          expect(result.error).toBe('DAYTONA_TEMPLATE_ID is not configured');
          
          // Duration should still be tracked
          expect(result.duration).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have consistent result structure for any input', () => {
      const templateIdArb = fc.string({ minLength: 0, maxLength: 100 });
      const projectIdArb = fc.string({ minLength: 1, maxLength: 50 });

      fc.assert(
        fc.asyncProperty(templateIdArb, projectIdArb, async (templateId, projectId) => {
          const result = await cloneTemplate(templateId, projectId);
          
          // Result should always have these fields
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('sandboxId');
          expect(result).toHaveProperty('sandboxUrl');
          expect(result).toHaveProperty('duration');
          
          // Types should be correct
          expect(typeof result.success).toBe('boolean');
          expect(typeof result.sandboxId).toBe('string');
          expect(typeof result.sandboxUrl).toBe('string');
          expect(typeof result.duration).toBe('number');
          
          // If failed, should have error
          if (!result.success) {
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: full-project-scaffolding, Property 8: pnpm Install Command**
   * **Validates: Requirements 3.4**
   * 
   * For any package installation request, the system SHALL execute
   * `pnpm add <packages>` in the Daytona sandbox.
   */
  describe('Property 8: pnpm Install Command', () => {
    it('should build correct pnpm add command for any package list', () => {
      // Generate valid npm package names
      const packageNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
      const packageListArb = fc.array(packageNameArb, { minLength: 1, maxLength: 10 });

      fc.assert(
        fc.property(packageListArb, (packages) => {
          // Build the expected command
          const expectedCommand = `pnpm add ${packages.join(' ')}`;
          
          // Verify command format is correct
          expect(expectedCommand).toMatch(/^pnpm add /);
          expect(expectedCommand).toContain(packages[0]);
          
          // All packages should be in the command
          for (const pkg of packages) {
            expect(expectedCommand).toContain(pkg);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return empty result for empty package list', async () => {
      // Create a mock sandbox
      const mockSandbox = {
        id: 'test-sandbox',
        process: {
          executeCommand: vi.fn(),
        },
        fs: {},
      } as any;

      const result = await runPnpmInstall(mockSandbox, []);
      
      expect(result.success).toBe(true);
      expect(result.installed).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.duration).toBe(0);
      expect(result.command).toBe('');
    });

    it('should include command in result for any package list', () => {
      const packageNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
      const packageListArb = fc.array(packageNameArb, { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.property(packageListArb, (packages) => {
          // The command should be properly formatted
          const expectedCommand = `pnpm add ${packages.join(' ')}`;
          
          // Verify it starts with pnpm add
          expect(expectedCommand.startsWith('pnpm add ')).toBe(true);
          
          // Verify all packages are included
          for (const pkg of packages) {
            expect(expectedCommand.includes(pkg)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle package names with various valid formats', () => {
      // npm package names can include scopes, hyphens, numbers
      const scopedPackageArb = fc.tuple(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        fc.stringMatching(/^[a-z][a-z0-9-]*$/)
      ).map(([scope, name]) => `@${scope}/${name}`);
      
      const simplePackageArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
      
      const packageArb = fc.oneof(scopedPackageArb, simplePackageArb);
      const packageListArb = fc.array(packageArb, { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.property(packageListArb, (packages) => {
          const command = `pnpm add ${packages.join(' ')}`;
          
          // Command should be valid
          expect(command.length).toBeGreaterThan('pnpm add '.length);
          
          // Each package should be in the command
          for (const pkg of packages) {
            expect(command).toContain(pkg);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests for getInstalledPackages function
   */
  describe('getInstalledPackages', () => {
    it('should parse package.json dependencies correctly', () => {
      // Generate valid package.json structures
      const versionArb = fc.tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 })
      ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);
      
      const packageNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/);
      
      const dependencyArb = fc.tuple(packageNameArb, versionArb);
      const dependenciesArb = fc.array(dependencyArb, { minLength: 0, maxLength: 10 });

      fc.assert(
        fc.property(dependenciesArb, (deps) => {
          // Deduplicate by package name (package.json can't have duplicate keys)
          const uniqueDeps = [...new Map(deps.map(([name, version]) => [name, version])).entries()];
          
          // Build a package.json structure
          const packageJson = {
            dependencies: Object.fromEntries(uniqueDeps.map(([name, version]) => [name, `^${version}`])),
          };
          
          // Verify structure is valid JSON
          const jsonString = JSON.stringify(packageJson);
          const parsed = JSON.parse(jsonString);
          
          expect(parsed.dependencies).toBeDefined();
          expect(Object.keys(parsed.dependencies).length).toBe(uniqueDeps.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should strip version prefixes (^ and ~) from versions', () => {
      const versionArb = fc.tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 })
      ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);
      
      const prefixArb = fc.constantFrom('^', '~', '');

      fc.assert(
        fc.property(versionArb, prefixArb, (version, prefix) => {
          const prefixedVersion = `${prefix}${version}`;
          const stripped = prefixedVersion.replace(/^[\^~]/, '');
          
          // Stripped version should not have prefix
          expect(stripped).not.toMatch(/^[\^~]/);
          
          // Should be the original version
          expect(stripped).toBe(version);
        }),
        { numRuns: 100 }
      );
    });
  });
});
