/**
 * EnvManager Property-Based Tests
 * 
 * Tests for the EnvManager service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 13: Env File Format**
 * **Validates: Requirements 16.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EnvManager } from './env-manager';

describe('EnvManager', () => {
  const envManager = new EnvManager();

  describe('validateEnvFormat', () => {
    /**
     * **Feature: enhanced-context-management, Property 13: Env File Format**
     * **Validates: Requirements 16.1**
     * 
     * For any environment variable save operation, the resulting .env.local 
     * content SHALL be valid KEY=value format.
     */
    it('should validate that formatted env content is always valid (Property 13: Env File Format)', () => {
      // Generate valid env variable keys (start with letter/underscore, alphanumeric + underscore)
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,30}$/);
      
      // Generate env variable values (any string)
      const envValueArb = fc.string({ minLength: 0, maxLength: 100 });
      
      // Generate array of env variables
      const envVariablesArb = fc.array(
        fc.record({
          key: envKeyArb,
          value: envValueArb,
          isSecret: fc.boolean(),
          isRequired: fc.boolean(),
        }),
        { minLength: 0, maxLength: 20 }
      ).map(vars => {
        // Ensure unique keys
        const seen = new Set<string>();
        return vars.filter(v => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        });
      });

      fc.assert(
        fc.property(envVariablesArb, (variables) => {
          // Format the variables into env file content
          const content = envManager.formatEnvContent(variables);
          
          // Validate the formatted content
          const result = envManager.validateEnvFormat(content);
          
          // The formatted content should always be valid
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Round-trip consistency
     * Formatting then parsing should preserve the variables
     */
    it('should preserve variables through format-parse round trip', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,30}$/);
      const envValueArb = fc.string({ minLength: 0, maxLength: 50 })
        .filter(s => !s.includes('\n')); // Exclude newlines for simpler round-trip
      
      const envVariablesArb = fc.array(
        fc.record({
          key: envKeyArb,
          value: envValueArb,
          isSecret: fc.boolean(),
          isRequired: fc.boolean(),
        }),
        { minLength: 1, maxLength: 10 }
      ).map(vars => {
        const seen = new Set<string>();
        return vars.filter(v => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        });
      });

      fc.assert(
        fc.property(envVariablesArb, (variables) => {
          // Format then parse
          const content = envManager.formatEnvContent(variables);
          const parsed = envManager.parseEnvContent(content);
          
          // Should have same number of variables
          expect(parsed.length).toBe(variables.length);
          
          // Each original variable should be present with same key and value
          for (const original of variables) {
            const found = parsed.find(p => p.key === original.key);
            expect(found).toBeDefined();
            expect(found?.value).toBe(original.value);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Valid keys are accepted
     */
    it('should accept valid KEY=value format', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,30}$/);
      const envValueArb = fc.string({ minLength: 0, maxLength: 50 })
        .filter(s => !s.includes('\n'));
      
      const envLineArb = fc.tuple(envKeyArb, envValueArb)
        .map(([key, value]) => `${key}=${value}`);
      
      const envContentArb = fc.array(envLineArb, { minLength: 1, maxLength: 10 })
        .map(lines => lines.join('\n'));

      fc.assert(
        fc.property(envContentArb, (content) => {
          const result = envManager.validateEnvFormat(content);
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty content is valid
     */
    it('should accept empty content as valid', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\n', '\n\n', '  \n  '),
          (content) => {
            const result = envManager.validateEnvFormat(content);
            expect(result.isValid).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * Property: Comments are ignored
     */
    it('should ignore comment lines', () => {
      const commentArb = fc.string({ minLength: 0, maxLength: 50 })
        .filter(s => !s.includes('\n'))
        .map(s => `# ${s}`);
      
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{0,30}$/);
      const envValueArb = fc.string({ minLength: 0, maxLength: 50 })
        .filter(s => !s.includes('\n'));
      
      const envLineArb = fc.tuple(envKeyArb, envValueArb)
        .map(([key, value]) => `${key}=${value}`);
      
      const contentArb = fc.tuple(
        fc.array(commentArb, { minLength: 0, maxLength: 3 }),
        fc.array(envLineArb, { minLength: 1, maxLength: 5 }),
        fc.array(commentArb, { minLength: 0, maxLength: 3 })
      ).map(([before, vars, after]) => [...before, ...vars, ...after].join('\n'));

      fc.assert(
        fc.property(contentArb, (content) => {
          const result = envManager.validateEnvFormat(content);
          expect(result.isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Invalid keys are rejected
     */
    it('should reject invalid key formats', () => {
      // Keys that start with numbers or contain invalid characters
      const invalidKeyArb = fc.oneof(
        fc.stringMatching(/^[0-9][A-Z0-9_]*$/), // Starts with number
        fc.stringMatching(/^[A-Z][A-Z0-9]*-[A-Z0-9]*$/) // Contains hyphen
      );
      
      const envValueArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('\n'));
      
      const invalidLineArb = fc.tuple(invalidKeyArb, envValueArb)
        .map(([key, value]) => `${key}=${value}`);

      fc.assert(
        fc.property(invalidLineArb, (content) => {
          const result = envManager.validateEnvFormat(content);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Lines without = are rejected
     */
    it('should reject lines without equals sign', () => {
      const invalidLineArb = fc.string({ minLength: 1, maxLength: 30 })
        .filter(s => {
          // Must not contain = or newlines
          if (s.includes('=') || s.includes('\n')) return false;
          // After trimming, must not be empty or a comment
          const trimmed = s.trim();
          if (trimmed.length === 0 || trimmed.startsWith('#')) return false;
          return true;
        });

      fc.assert(
        fc.property(invalidLineArb, (content) => {
          const result = envManager.validateEnvFormat(content);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes("Missing '=' separator"))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('detectRequiredVariables', () => {
    /**
     * Property: Detected variables match process.env references
     */
    it('should detect all process.env references', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      
      // Generate code with process.env references
      const codeWithEnvArb = fc.array(envKeyArb, { minLength: 1, maxLength: 5 })
        .map(keys => {
          const uniqueKeys = [...new Set(keys)];
          return {
            keys: uniqueKeys,
            code: uniqueKeys.map(k => `const ${k.toLowerCase()} = process.env.${k};`).join('\n')
          };
        });

      fc.assert(
        fc.property(codeWithEnvArb, ({ keys, code }) => {
          const detected = envManager.detectRequiredVariables({ 'test.ts': code });
          
          // All keys should be detected
          for (const key of keys) {
            expect(detected).toContain(key);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Bracket notation is also detected
     */
    it('should detect bracket notation process.env references', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      
      const codeWithBracketEnvArb = fc.array(envKeyArb, { minLength: 1, maxLength: 5 })
        .map(keys => {
          const uniqueKeys = [...new Set(keys)];
          return {
            keys: uniqueKeys,
            code: uniqueKeys.map((k, i) => 
              i % 2 === 0 
                ? `const v${i} = process.env['${k}'];`
                : `const v${i} = process.env["${k}"];`
            ).join('\n')
          };
        });

      fc.assert(
        fc.property(codeWithBracketEnvArb, ({ keys, code }) => {
          const detected = envManager.detectRequiredVariables({ 'test.ts': code });
          
          for (const key of keys) {
            expect(detected).toContain(key);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Results are sorted alphabetically
     */
    it('should return sorted results', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      
      const codeWithEnvArb = fc.array(envKeyArb, { minLength: 2, maxLength: 10 })
        .map(keys => keys.map(k => `process.env.${k}`).join('\n'));

      fc.assert(
        fc.property(codeWithEnvArb, (code) => {
          const detected = envManager.detectRequiredVariables({ 'test.ts': code });
          
          // Should be sorted
          const sorted = [...detected].sort();
          expect(detected).toEqual(sorted);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: No duplicates in results
     */
    it('should return unique results', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      
      // Generate code with duplicate references
      const codeWithDuplicatesArb = fc.array(envKeyArb, { minLength: 1, maxLength: 5 })
        .map(keys => {
          // Duplicate each key multiple times
          const duplicated = keys.flatMap(k => [k, k, k]);
          return duplicated.map(k => `process.env.${k}`).join('\n');
        });

      fc.assert(
        fc.property(codeWithDuplicatesArb, (code) => {
          const detected = envManager.detectRequiredVariables({ 'test.ts': code });
          
          // Should have no duplicates
          const unique = new Set(detected);
          expect(detected.length).toBe(unique.size);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('mergeEnvContent', () => {
    /**
     * Property: Existing variables are preserved
     */
    it('should preserve existing variables when merging', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      const envValueArb = fc.string({ minLength: 1, maxLength: 30 })
        .filter(s => !s.includes('\n'));
      
      const existingVarsArb = fc.array(
        fc.record({
          key: envKeyArb,
          value: envValueArb,
          isSecret: fc.boolean(),
          isRequired: fc.boolean(),
        }),
        { minLength: 1, maxLength: 5 }
      ).map(vars => {
        const seen = new Set<string>();
        return vars.filter(v => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        });
      });

      fc.assert(
        fc.property(existingVarsArb, (existingVars) => {
          const existingContent = envManager.formatEnvContent(existingVars);
          
          // Create new variables with different keys
          const newVars = existingVars.map(v => ({
            ...v,
            key: `NEW_${v.key}`,
            value: 'new_value',
          }));
          
          const merged = envManager.mergeEnvContent(existingContent, newVars);
          const parsed = envManager.parseEnvContent(merged);
          
          // All existing variables should be preserved
          for (const existing of existingVars) {
            const found = parsed.find(p => p.key === existing.key);
            expect(found).toBeDefined();
            expect(found?.value).toBe(existing.value);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: New variables are added
     */
    it('should add new variables that do not exist', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      const envValueArb = fc.string({ minLength: 1, maxLength: 30 })
        .filter(s => !s.includes('\n'));
      
      const varsArb = fc.array(
        fc.record({
          key: envKeyArb,
          value: envValueArb,
          isSecret: fc.boolean(),
          isRequired: fc.boolean(),
        }),
        { minLength: 1, maxLength: 5 }
      ).map(vars => {
        const seen = new Set<string>();
        return vars.filter(v => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        });
      });

      fc.assert(
        fc.property(varsArb, varsArb, (existingVars, newVars) => {
          // Ensure new vars have different keys
          const existingKeys = new Set(existingVars.map(v => v.key));
          const uniqueNewVars = newVars
            .filter(v => !existingKeys.has(v.key))
            .map(v => ({ ...v, key: `NEW_${v.key}` }));
          
          if (uniqueNewVars.length === 0) return; // Skip if no unique new vars
          
          const existingContent = envManager.formatEnvContent(existingVars);
          const merged = envManager.mergeEnvContent(existingContent, uniqueNewVars);
          const parsed = envManager.parseEnvContent(merged);
          
          // All new variables should be added
          for (const newVar of uniqueNewVars) {
            const found = parsed.find(p => p.key === newVar.key);
            expect(found).toBeDefined();
            expect(found?.value).toBe(newVar.value);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Existing variables are not overwritten
     */
    it('should not overwrite existing variables', () => {
      const envKeyArb = fc.stringMatching(/^[A-Z][A-Z0-9_]{2,20}$/);
      const envValueArb = fc.string({ minLength: 1, maxLength: 30 })
        .filter(s => !s.includes('\n'));
      
      const varsArb = fc.array(
        fc.record({
          key: envKeyArb,
          value: envValueArb,
          isSecret: fc.boolean(),
          isRequired: fc.boolean(),
        }),
        { minLength: 1, maxLength: 5 }
      ).map(vars => {
        const seen = new Set<string>();
        return vars.filter(v => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        });
      });

      fc.assert(
        fc.property(varsArb, (existingVars) => {
          const existingContent = envManager.formatEnvContent(existingVars);
          
          // Try to overwrite with different values
          const overwriteVars = existingVars.map(v => ({
            ...v,
            value: 'OVERWRITTEN_VALUE',
          }));
          
          const merged = envManager.mergeEnvContent(existingContent, overwriteVars);
          const parsed = envManager.parseEnvContent(merged);
          
          // Original values should be preserved
          for (const existing of existingVars) {
            const found = parsed.find(p => p.key === existing.key);
            expect(found).toBeDefined();
            expect(found?.value).toBe(existing.value);
            expect(found?.value).not.toBe('OVERWRITTEN_VALUE');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
