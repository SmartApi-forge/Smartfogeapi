/**
 * Property-Based Tests for Template Service
 * 
 * **Feature: full-project-scaffolding, Property 15: Template Package Check**
 * **Validates: Requirements 7.9**
 * 
 * For any package in the pre-installed list, the isPackageInTemplate function
 * SHALL return true.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isPackageInTemplate,
  getTemplatePackages,
  filterMissingPackages,
  getTemplateStatus,
} from '../services/template-service';
import {
  TEMPLATE_PACKAGES,
  TEMPLATE_UI_PACKAGES,
  TEMPLATE_ANIMATION_PACKAGES,
  TEMPLATE_DATA_PACKAGES,
  TEMPLATE_UTILITY_PACKAGES,
  TEMPLATE_CORE_PACKAGES,
  PACKAGE_NAME_MAP,
} from '../config/template';

describe('Template Service Property Tests', () => {
  /**
   * **Feature: full-project-scaffolding, Property 15: Template Package Check**
   * **Validates: Requirements 7.9**
   */
  describe('Property 15: Template Package Check', () => {
    it('should return true for any package in the pre-installed list', () => {
      // Create arbitrary from actual template packages
      const templatePackageArb = fc.constantFrom(...TEMPLATE_PACKAGES);
      
      fc.assert(
        fc.property(templatePackageArb, (packageName) => {
          const result = isPackageInTemplate(packageName);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for packages regardless of case', () => {
      const templatePackageArb = fc.constantFrom(...TEMPLATE_PACKAGES);
      const caseTransformArb = fc.constantFrom(
        (s: string) => s.toLowerCase(),
        (s: string) => s.toUpperCase(),
        (s: string) => s, // original
      );

      fc.assert(
        fc.property(
          templatePackageArb,
          caseTransformArb,
          (packageName, transform) => {
            const transformedName = transform(packageName);
            const result = isPackageInTemplate(transformedName);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return true for all UI packages', () => {
      const uiPackageArb = fc.constantFrom(...TEMPLATE_UI_PACKAGES);
      
      fc.assert(
        fc.property(uiPackageArb, (packageName) => {
          expect(isPackageInTemplate(packageName)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for all animation packages', () => {
      const animationPackageArb = fc.constantFrom(...TEMPLATE_ANIMATION_PACKAGES);
      
      fc.assert(
        fc.property(animationPackageArb, (packageName) => {
          expect(isPackageInTemplate(packageName)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for all data/state packages', () => {
      const dataPackageArb = fc.constantFrom(...TEMPLATE_DATA_PACKAGES);
      
      fc.assert(
        fc.property(dataPackageArb, (packageName) => {
          expect(isPackageInTemplate(packageName)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for all utility packages', () => {
      const utilityPackageArb = fc.constantFrom(...TEMPLATE_UTILITY_PACKAGES);
      
      fc.assert(
        fc.property(utilityPackageArb, (packageName) => {
          expect(isPackageInTemplate(packageName)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for all core packages', () => {
      const corePackageArb = fc.constantFrom(...TEMPLATE_CORE_PACKAGES);
      
      fc.assert(
        fc.property(corePackageArb, (packageName) => {
          expect(isPackageInTemplate(packageName)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return true for package aliases', () => {
      const aliasArb = fc.constantFrom(...Object.keys(PACKAGE_NAME_MAP));
      
      fc.assert(
        fc.property(aliasArb, (alias) => {
          const result = isPackageInTemplate(alias);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for packages not in template', () => {
      // Packages that are definitely NOT in the template
      const notInTemplateArb = fc.constantFrom(
        'three',
        'chart.js',
        'stripe',
        'd3',
        'socket.io',
        'mongoose',
        'prisma',
        'graphql',
        'apollo-client',
        'redux',
        'mobx',
        'rxjs',
        'ember',
        'backbone',
        'jquery',
        'moment', // we use date-fns instead
        'webpack',
        'rollup',
        'vite',
        'esbuild',
      );
      
      fc.assert(
        fc.property(notInTemplateArb, (packageName) => {
          const result = isPackageInTemplate(packageName);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle whitespace in package names', () => {
      const templatePackageArb = fc.constantFrom(...TEMPLATE_PACKAGES);
      const whitespaceArb = fc.constantFrom('', ' ', '  ', '\t', '\n');
      
      fc.assert(
        fc.property(
          templatePackageArb,
          whitespaceArb,
          whitespaceArb,
          (packageName, prefix, suffix) => {
            const paddedName = `${prefix}${packageName}${suffix}`;
            const result = isPackageInTemplate(paddedName);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getTemplatePackages', () => {
    it('should return all packages from TEMPLATE_PACKAGES', () => {
      const packages = getTemplatePackages();
      
      // Should contain all template packages
      for (const pkg of TEMPLATE_PACKAGES) {
        expect(packages).toContain(pkg);
      }
      
      // Should have same length
      expect(packages.length).toBe(TEMPLATE_PACKAGES.length);
    });

    it('should return a new array each time (not mutate original)', () => {
      const packages1 = getTemplatePackages();
      const packages2 = getTemplatePackages();
      
      // Should be equal but not same reference
      expect(packages1).toEqual(packages2);
      expect(packages1).not.toBe(packages2);
      
      // Mutating one should not affect the other
      packages1.push('test-package');
      expect(packages2).not.toContain('test-package');
    });
  });

  describe('filterMissingPackages', () => {
    it('should return empty array when all packages are in template', () => {
      const templatePackagesArb = fc.array(
        fc.constantFrom(...TEMPLATE_PACKAGES),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(templatePackagesArb, (packages) => {
          const missing = filterMissingPackages(packages);
          expect(missing).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it('should return all packages when none are in template', () => {
      const notInTemplateArb = fc.array(
        fc.constantFrom('three', 'chart.js', 'stripe', 'd3', 'socket.io'),
        { minLength: 1, maxLength: 5 }
      );
      
      fc.assert(
        fc.property(notInTemplateArb, (packages) => {
          const missing = filterMissingPackages(packages);
          expect(missing.length).toBe(packages.length);
          expect(missing).toEqual(packages);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly filter mixed package lists', () => {
      const inTemplateArb = fc.constantFrom(...TEMPLATE_PACKAGES.slice(0, 5));
      const notInTemplateArb = fc.constantFrom('three', 'chart.js', 'stripe');
      
      fc.assert(
        fc.property(
          fc.array(inTemplateArb, { minLength: 1, maxLength: 3 }),
          fc.array(notInTemplateArb, { minLength: 1, maxLength: 3 }),
          (inTemplate, notInTemplate) => {
            const mixed = [...inTemplate, ...notInTemplate];
            const missing = filterMissingPackages(mixed);
            
            // Missing should only contain packages not in template
            for (const pkg of missing) {
              expect(isPackageInTemplate(pkg)).toBe(false);
            }
            
            // All not-in-template packages should be in missing
            for (const pkg of notInTemplate) {
              expect(missing).toContain(pkg);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getTemplateStatus', () => {
    it('should return valid status object', () => {
      const status = getTemplateStatus();
      
      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('templateId');
      expect(status).toHaveProperty('packageCount');
      
      expect(typeof status.configured).toBe('boolean');
      expect(typeof status.templateId).toBe('string');
      expect(typeof status.packageCount).toBe('number');
      
      expect(status.packageCount).toBe(TEMPLATE_PACKAGES.length);
    });
  });
});
