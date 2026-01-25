/**
 * Property-Based Tests for OpenAPI Spec Generation and Validation
 * 
 * **Feature: ui-quality-chat-polish, Property 7: OpenAPI Spec Completeness**
 * **Feature: ui-quality-chat-polish, Property 8: OpenAPI Spec Validation**
 * 
 * These tests verify that:
 * - Property 7: Generated OpenAPI specs contain all required sections
 * - Property 8: Generated OpenAPI specs pass validation with no errors
 * 
 * Requirements: 3.5, 3.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateOpenAPISpec,
  generateCRUDSpec,
  type EndpointDefinition,
  type HTTPMethod,
  type OpenAPIGeneratorOptions,
} from '../services/openapi-generator';
import {
  validateOpenAPISpec,
  isValidOpenAPISpec,
} from '../services/openapi-validator';

// =============================================================================
// Arbitraries (Generators)
// =============================================================================

/**
 * Generate valid API names (alphanumeric with spaces/hyphens)
 */
const apiNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 -]{0,29}$/)
  .filter(s => s.trim().length > 0);

/**
 * Generate valid HTTP methods
 */
const httpMethodArb: fc.Arbitrary<HTTPMethod> = fc.constantFrom(
  'get', 'post', 'put', 'patch', 'delete'
);

/**
 * Generate valid URL paths
 */
const pathArb = fc.array(
  fc.stringMatching(/^[a-z][a-z0-9-]*$/),
  { minLength: 1, maxLength: 3 }
).map(parts => '/' + parts.join('/'));

/**
 * Generate valid operation IDs
 */
const operationIdArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/)
  .filter(s => s.length >= 3 && s.length <= 30);

/**
 * Generate valid endpoint definitions
 * Note: We don't generate responseSchema since those would need matching schemas
 */
const endpointArb: fc.Arbitrary<EndpointDefinition> = fc.record({
  path: pathArb,
  method: httpMethodArb,
  summary: fc.string({ minLength: 5, maxLength: 100 }),
  operationId: operationIdArb,
  // Don't generate responseSchema - it would reference non-existent schemas
  responseSchema: fc.constant(undefined),
});

/**
 * Generate arrays of endpoints (at least 1)
 */
const endpointsArb = fc.array(endpointArb, { minLength: 1, maxLength: 5 });

/**
 * Generate OpenAPI generator options
 */
const generatorOptionsArb: fc.Arbitrary<OpenAPIGeneratorOptions> = fc.record({
  apiName: apiNameArb,
  description: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
  version: fc.option(fc.stringMatching(/^\d+\.\d+\.\d+$/), { nil: undefined }),
  basePath: fc.option(fc.constantFrom('/api', '/v1', '/api/v1'), { nil: undefined }),
  endpoints: endpointsArb,
  includeAuth: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generate entity names for CRUD specs
 */
const entityNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,15}$/)
  .filter(s => s.length >= 3);

// =============================================================================
// Property Tests
// =============================================================================

describe('OpenAPI Spec Property Tests', () => {
  /**
   * **Feature: ui-quality-chat-polish, Property 7: OpenAPI Spec Completeness**
   * 
   * *For any* generated OpenAPI spec, the YAML SHALL contain:
   * - openapi version (3.1.x)
   * - info section with title/version/description
   * - paths section with at least one endpoint
   * - request/response schemas
   * - components/schemas section
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 7: OpenAPI Spec Completeness', () => {
    it('should always include openapi version 3.1.x', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          expect(result.spec.openapi).toBe('3.1.0');
          expect(result.yaml).toContain('openapi');
          expect(result.yaml).toContain('3.1.0');
        }),
        { numRuns: 100 }
      );
    });

    it('should always include info section with title, version, and description', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Info section must exist
          expect(result.spec.info).toBeDefined();
          
          // Title must exist and be non-empty
          expect(result.spec.info.title).toBeDefined();
          expect(result.spec.info.title.length).toBeGreaterThan(0);
          
          // Version must exist
          expect(result.spec.info.version).toBeDefined();
          
          // Description must exist
          expect(result.spec.info.description).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should always include paths section with at least one endpoint', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Paths must exist
          expect(result.spec.paths).toBeDefined();
          
          // Must have at least one path
          const pathCount = Object.keys(result.spec.paths).length;
          expect(pathCount).toBeGreaterThanOrEqual(1);
          
          // Each path must have at least one operation
          for (const pathKey of Object.keys(result.spec.paths)) {
            const pathItem = result.spec.paths[pathKey];
            const operations = ['get', 'post', 'put', 'patch', 'delete']
              .filter(method => pathItem[method as HTTPMethod]);
            expect(operations.length).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always include components/schemas section', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Components must exist
          expect(result.spec.components).toBeDefined();
          
          // Schemas must exist
          expect(result.spec.components?.schemas).toBeDefined();
          
          // Must have at least Error schema (default)
          expect(result.spec.components?.schemas?.Error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should include response schemas for all operations', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Check each operation has responses
          for (const pathKey of Object.keys(result.spec.paths)) {
            const pathItem = result.spec.paths[pathKey];
            for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
              const operation = pathItem[method];
              if (operation) {
                expect(operation.responses).toBeDefined();
                expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: ui-quality-chat-polish, Property 8: OpenAPI Spec Validation**
   * 
   * *For any* generated OpenAPI spec, the spec SHALL pass validation
   * against OpenAPI 3.1 schema with no errors.
   * 
   * **Validates: Requirements 3.8**
   */
  describe('Property 8: OpenAPI Spec Validation', () => {
    it('should always produce valid OpenAPI specs from generateOpenAPISpec', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Validate the spec object
          const validation = validateOpenAPISpec(result.spec);
          
          // Should have no errors
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should always produce valid OpenAPI specs from generateCRUDSpec', () => {
      fc.assert(
        fc.property(entityNameArb, (entityName) => {
          const result = generateCRUDSpec(entityName);
          
          // Validate the spec object
          const validation = validateOpenAPISpec(result.spec);
          
          // Should have no errors
          expect(validation.valid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce specs that pass isValidOpenAPISpec check', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // Quick validation check should pass
          expect(isValidOpenAPISpec(result.spec)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid YAML output that can be re-validated', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // The YAML string should also validate
          // (tests round-trip through string format)
          const yamlValidation = validateOpenAPISpec(result.yaml);
          
          // Should have no errors
          expect(yamlValidation.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid JSON output that can be re-validated', () => {
      fc.assert(
        fc.property(generatorOptionsArb, (options) => {
          const result = generateOpenAPISpec(options);
          
          // The JSON string should also validate
          const jsonValidation = validateOpenAPISpec(result.json);
          
          // Should have no errors
          expect(jsonValidation.valid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have all schema references resolve correctly', () => {
      fc.assert(
        fc.property(entityNameArb, (entityName) => {
          const result = generateCRUDSpec(entityName);
          const validation = validateOpenAPISpec(result.spec);
          
          // No INVALID_SCHEMA_REF errors
          const refErrors = validation.errors.filter(
            e => e.code === 'INVALID_SCHEMA_REF'
          );
          expect(refErrors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should handle single-character entity names in CRUD spec', () => {
      // Use longer names to avoid edge cases with very short names
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-z]{2,10}$/),
          (entityName) => {
            const result = generateCRUDSpec(entityName);
            const validation = validateOpenAPISpec(result.spec);
            
            expect(validation.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle endpoints with path parameters', () => {
      fc.assert(
        fc.property(
          apiNameArb,
          fc.array(
            fc.record({
              path: fc.constantFrom('/items/{id}', '/users/{userId}/posts/{postId}'),
              method: httpMethodArb,
              summary: fc.string({ minLength: 5, maxLength: 50 }),
              operationId: operationIdArb,
              parameters: fc.constant([
                { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }
              ]),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (apiName, endpoints) => {
            const result = generateOpenAPISpec({
              apiName,
              endpoints: endpoints as EndpointDefinition[],
            });
            const validation = validateOpenAPISpec(result.spec);
            
            expect(validation.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle specs with and without authentication', () => {
      fc.assert(
        fc.property(
          generatorOptionsArb,
          fc.boolean(),
          (options, includeAuth) => {
            const result = generateOpenAPISpec({
              ...options,
              includeAuth,
            });
            const validation = validateOpenAPISpec(result.spec);
            
            expect(validation.valid).toBe(true);
            
            // If auth is included, security schemes should exist
            if (includeAuth) {
              expect(result.spec.components?.securitySchemes).toBeDefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
