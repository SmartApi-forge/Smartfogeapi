/**
 * Unit tests for OpenAPI 3.1 Spec Validator
 * 
 * Requirements: 3.8
 * Property 8: OpenAPI Spec Validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateOpenAPISpec,
  isValidOpenAPISpec,
  getValidationErrors,
  assertValidOpenAPISpec,
  formatValidationResult,
  type ValidationResult
} from '../services/openapi-validator';
import { generateCRUDSpec, generateOpenAPISpec, type OpenAPISpec } from '../services/openapi-generator';

describe('OpenAPI Validator', () => {
  describe('validateOpenAPISpec', () => {
    it('should validate a valid OpenAPI 3.1 spec', () => {
      const validSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'A test API'
        },
        servers: [{ url: '/api' }],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              operationId: 'listUsers',
              responses: {
                '200': { description: 'Success' }
              }
            }
          }
        },
        tags: [{ name: 'Users' }]
      };

      const result = validateOpenAPISpec(validSpec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject spec with missing openapi version', () => {
      const invalidSpec = {
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_OPENAPI_VERSION')).toBe(true);
    });

    it('should reject spec with invalid openapi version', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '2.0.0' as '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: { '/test': { get: { summary: '', operationId: 'test', responses: { '200': { description: 'OK' } } } } }
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_OPENAPI_VERSION')).toBe(true);
    });

    it('should reject spec with missing info', () => {
      const invalidSpec = {
        openapi: '3.1.0',
        paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_INFO')).toBe(true);
    });

    it('should reject spec with missing info.title', () => {
      const invalidSpec = {
        openapi: '3.1.0',
        info: { version: '1.0.0' },
        paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_INFO_TITLE')).toBe(true);
    });

    it('should reject spec with missing paths', () => {
      const invalidSpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_PATHS')).toBe(true);
    });

    it('should reject spec with empty paths', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {}
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_PATHS')).toBe(true);
    });

    it('should reject path not starting with /', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          'users': {
            get: { summary: '', operationId: 'test', responses: { '200': { description: 'OK' } } }
          }
        }
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PATH_FORMAT')).toBe(true);
    });

    it('should reject operation with missing responses', () => {
      const invalidSpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: { summary: 'Test' }
          }
        }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_OPERATION_RESPONSES')).toBe(true);
    });

    it('should reject response with missing description', () => {
      const invalidSpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              summary: 'Test',
              responses: { '200': {} }
            }
          }
        }
      } as unknown as OpenAPISpec;

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_RESPONSE_DESCRIPTION')).toBe(true);
    });

    it('should reject invalid status code', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          '/test': {
            get: {
              summary: 'Test',
              operationId: 'test',
              responses: { '999': { description: 'Invalid' } }
            }
          }
        }
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_STATUS_CODE')).toBe(true);
    });

    it('should reject path parameter without required: true', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          '/users/{id}': {
            get: {
              summary: 'Get user',
              operationId: 'getUser',
              parameters: [
                { name: 'id', in: 'path', schema: { type: 'string' } }
              ],
              responses: { '200': { description: 'OK' } }
            }
          }
        }
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_PARAMETER')).toBe(true);
    });

    it('should reject invalid schema reference', () => {
      const invalidSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          '/test': {
            get: {
              summary: 'Test',
              operationId: 'test',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/NonExistent' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {}
        }
      };

      const result = validateOpenAPISpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_SCHEMA_REF')).toBe(true);
    });

    it('should validate JSON string input', () => {
      const jsonSpec = JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: 'Test' },
        servers: [{ url: '/api' }],
        paths: {
          '/test': {
            get: {
              summary: 'Test',
              operationId: 'test',
              responses: { '200': { description: 'OK' } }
            }
          }
        },
        tags: [{ name: 'Test' }]
      });

      const result = validateOpenAPISpec(jsonSpec);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid JSON/YAML string', () => {
      // Invalid JSON/YAML will be parsed as empty object by simple parser
      // which then fails validation for missing required fields
      const result = validateOpenAPISpec('{ invalid json }');
      expect(result.valid).toBe(false);
      // Should fail due to missing openapi version (parsed as empty/invalid object)
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with OpenAPI Generator', () => {
    it('should validate specs generated by generateCRUDSpec', () => {
      const result = generateCRUDSpec('user');
      const validation = validateOpenAPISpec(result.spec);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate specs generated by generateOpenAPISpec', () => {
      const result = generateOpenAPISpec({
        apiName: 'products',
        endpoints: [
          {
            path: '/products',
            method: 'get',
            summary: 'List products',
            operationId: 'listProducts',
            responseSchema: 'ProductList'
          },
          {
            path: '/products',
            method: 'post',
            summary: 'Create product',
            operationId: 'createProduct',
            requestBody: { schemaRef: 'ProductCreate' }
          }
        ],
        schemas: {
          Product: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          ProductList: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' }
          },
          ProductCreate: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      });

      const validation = validateOpenAPISpec(result.spec);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    it('isValidOpenAPISpec should return boolean', () => {
      const validSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          '/test': {
            get: { summary: '', operationId: 'test', responses: { '200': { description: 'OK' } } }
          }
        }
      };

      expect(isValidOpenAPISpec(validSpec)).toBe(true);
      expect(isValidOpenAPISpec({} as OpenAPISpec)).toBe(false);
    });

    it('getValidationErrors should return error messages', () => {
      const errors = getValidationErrors({} as OpenAPISpec);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('openapi');
    });

    it('assertValidOpenAPISpec should throw on invalid spec', () => {
      expect(() => assertValidOpenAPISpec({} as OpenAPISpec)).toThrow('Invalid OpenAPI spec');
    });

    it('assertValidOpenAPISpec should not throw on valid spec', () => {
      const validSpec: OpenAPISpec = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0', description: '' },
        paths: {
          '/test': {
            get: { summary: '', operationId: 'test', responses: { '200': { description: 'OK' } } }
          }
        }
      };

      expect(() => assertValidOpenAPISpec(validSpec)).not.toThrow();
    });

    it('formatValidationResult should format output correctly', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [{ path: 'test', message: 'Test error', code: 'MISSING_INFO' }],
        warnings: [{ path: 'warn', message: 'Test warning', code: 'MISSING_DESCRIPTION' }]
      };

      const formatted = formatValidationResult(result);
      expect(formatted).toContain('invalid');
      expect(formatted).toContain('Errors:');
      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Test warning');
    });
  });
});
