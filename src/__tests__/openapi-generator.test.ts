/**
 * OpenAPI Generator Tests
 * 
 * Tests for the OpenAPI 3.1 spec generator service.
 * 
 * Requirements: 3.5, 3.6
 * Property 7: OpenAPI Spec Completeness
 */

import { describe, it, expect } from 'vitest';
import { 
  generateOpenAPISpec, 
  generateCRUDSpec, 
  createEndpoint,
  type OpenAPIGeneratorOptions,
  type EndpointDefinition,
} from '../services/openapi-generator';

describe('OpenAPI Generator', () => {
  describe('generateOpenAPISpec', () => {
    it('should generate a valid OpenAPI 3.1.0 spec', () => {
      const options: OpenAPIGeneratorOptions = {
        apiName: 'user',
        description: 'User management API',
        endpoints: [
          createEndpoint('/users', 'get', 'List all users'),
        ],
      };

      const result = generateOpenAPISpec(options);

      expect(result.spec.openapi).toBe('3.1.0');
      expect(result.spec.info.title).toBe('User API');
      expect(result.spec.info.description).toBe('User management API');
      expect(result.spec.info.summary).toBe('User API endpoints');
    });


    it('should include servers configuration', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        basePath: '/api/v1',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
      });

      expect(result.spec.servers).toBeDefined();
      expect(result.spec.servers?.length).toBeGreaterThan(0);
      expect(result.spec.servers?.[0].url).toBe('/api/v1');
    });

    it('should generate paths for all endpoints', () => {
      const endpoints: EndpointDefinition[] = [
        createEndpoint('/users', 'get', 'List users'),
        createEndpoint('/users', 'post', 'Create user'),
        createEndpoint('/users/{id}', 'get', 'Get user'),
        createEndpoint('/users/{id}', 'put', 'Update user'),
        createEndpoint('/users/{id}', 'delete', 'Delete user'),
      ];

      const result = generateOpenAPISpec({
        apiName: 'user',
        endpoints,
      });

      expect(Object.keys(result.spec.paths)).toHaveLength(2);
      expect(result.spec.paths['/users']).toBeDefined();
      expect(result.spec.paths['/users/{id}']).toBeDefined();
      expect(result.spec.paths['/users'].get).toBeDefined();
      expect(result.spec.paths['/users'].post).toBeDefined();
      expect(result.spec.paths['/users/{id}'].get).toBeDefined();
      expect(result.spec.paths['/users/{id}'].put).toBeDefined();
      expect(result.spec.paths['/users/{id}'].delete).toBeDefined();
    });


    it('should include components/schemas section', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
        schemas: {
          Item: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      });

      expect(result.spec.components?.schemas).toBeDefined();
      expect(result.spec.components?.schemas?.Error).toBeDefined();
      expect(result.spec.components?.schemas?.Pagination).toBeDefined();
      expect(result.spec.components?.schemas?.Item).toBeDefined();
    });

    it('should include securitySchemes when auth is enabled', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
        includeAuth: true,
        authType: 'bearer',
      });

      expect(result.spec.components?.securitySchemes).toBeDefined();
      expect(result.spec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(result.spec.components?.securitySchemes?.bearerAuth.type).toBe('http');
      expect(result.spec.components?.securitySchemes?.bearerAuth.scheme).toBe('bearer');
    });


    it('should generate proper HTTP status codes', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [
          createEndpoint('/items', 'get', 'List items'),
          createEndpoint('/items', 'post', 'Create item'),
          createEndpoint('/items/{id}', 'delete', 'Delete item'),
        ],
      });

      // GET should have 200
      expect(result.spec.paths['/items'].get?.responses['200']).toBeDefined();
      // POST should have 201
      expect(result.spec.paths['/items'].post?.responses['201']).toBeDefined();
      // DELETE should have 204
      expect(result.spec.paths['/items/{id}'].delete?.responses['204']).toBeDefined();
      // All should have error responses
      expect(result.spec.paths['/items'].get?.responses['400']).toBeDefined();
      expect(result.spec.paths['/items'].get?.responses['500']).toBeDefined();
    });

    it('should generate YAML output', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
      });

      expect(result.yaml).toBeDefined();
      expect(result.yaml).toContain('openapi:');
      expect(result.yaml).toContain('3.1.0');
      expect(result.yaml).toContain('info:');
      expect(result.yaml).toContain('paths:');
    });


    it('should generate JSON output', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
      });

      expect(result.json).toBeDefined();
      const parsed = JSON.parse(result.json);
      expect(parsed.openapi).toBe('3.1.0');
    });

    it('should include example values in schemas', () => {
      const result = generateOpenAPISpec({
        apiName: 'test',
        endpoints: [createEndpoint('/items', 'get', 'List items')],
      });

      // Error schema should have examples
      const errorSchema = result.spec.components?.schemas?.Error;
      expect(errorSchema?.properties?.error?.example).toBeDefined();
      expect(errorSchema?.properties?.message?.example).toBeDefined();
    });
  });

  describe('generateCRUDSpec', () => {
    it('should generate all CRUD endpoints', () => {
      const result = generateCRUDSpec('product');

      expect(result.spec.paths['/products']).toBeDefined();
      expect(result.spec.paths['/products'].get).toBeDefined();
      expect(result.spec.paths['/products'].post).toBeDefined();
      expect(result.spec.paths['/products/{id}']).toBeDefined();
      expect(result.spec.paths['/products/{id}'].get).toBeDefined();
      expect(result.spec.paths['/products/{id}'].put).toBeDefined();
      expect(result.spec.paths['/products/{id}'].delete).toBeDefined();
    });


    it('should generate entity schemas', () => {
      const result = generateCRUDSpec('product');

      expect(result.spec.components?.schemas?.Product).toBeDefined();
      expect(result.spec.components?.schemas?.ProductCreate).toBeDefined();
      expect(result.spec.components?.schemas?.ProductUpdate).toBeDefined();
      expect(result.spec.components?.schemas?.ProductList).toBeDefined();
    });

    it('should use custom entity schema', () => {
      const result = generateCRUDSpec('product', {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Widget' },
          price: { type: 'number', example: 29.99 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'price', 'createdAt', 'updatedAt'],
      });

      const productSchema = result.spec.components?.schemas?.Product;
      expect(productSchema?.properties?.name?.example).toBe('Widget');
      expect(productSchema?.properties?.price?.example).toBe(29.99);
    });
  });

  describe('createEndpoint', () => {
    it('should create endpoint with auto-generated operationId', () => {
      const endpoint = createEndpoint('/users/{id}', 'get', 'Get user by ID');

      expect(endpoint.path).toBe('/users/{id}');
      expect(endpoint.method).toBe('get');
      expect(endpoint.summary).toBe('Get user by ID');
      expect(endpoint.operationId).toBe('getUsersId');
    });

    it('should use custom operationId when provided', () => {
      const endpoint = createEndpoint('/users/{id}', 'get', 'Get user', {
        operationId: 'getUserById',
      });

      expect(endpoint.operationId).toBe('getUserById');
    });
  });
});
