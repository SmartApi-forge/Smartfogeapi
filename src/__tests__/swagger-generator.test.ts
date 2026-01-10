/**
 * Unit tests for Swagger UI Generator
 * 
 * Requirements: 3.9, 3.10
 */

import { describe, it, expect } from 'vitest';
import {
  generateSwaggerUIPage,
  generateOpenAPIRoute,
  generateDocsLayout,
  generateDocsReadme,
  generateSwaggerFiles,
  generateCompleteSwaggerDocs,
  getSwaggerDependencies,
  hasSwaggerDependency,
  getPackageJsonAdditions,
  generateMinimalSwaggerPage,
  generateInlineSpecRoute,
  type SwaggerUIConfig,
} from '../services/swagger-generator';

describe('Swagger Generator', () => {
  const sampleSpec = `openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: Success`;

  describe('generateSwaggerUIPage', () => {
    it('should generate a valid Next.js page component', () => {
      const config: SwaggerUIConfig = {
        specPath: '/api/openapi',
        docsPath: '/api-docs',
        title: 'Test API Documentation',
      };

      const result = generateSwaggerUIPage(config);

      expect(result).toContain("'use client'");
      expect(result).toContain('swagger-ui-react');
      expect(result).toContain('SwaggerUI');
      expect(result).toContain('/api/openapi');
    });

    it('should include dynamic import for SSR safety', () => {
      const config: SwaggerUIConfig = {
        specPath: '/api/openapi',
        docsPath: '/api-docs',
        title: 'Test API',
      };

      const result = generateSwaggerUIPage(config);

      expect(result).toContain('dynamic');
      expect(result).toContain('ssr: false');
    });

    it('should apply dark theme when specified', () => {
      const config: SwaggerUIConfig = {
        specPath: '/api/openapi',
        docsPath: '/api-docs',
        title: 'Test API',
        theme: 'dark',
      };

      const result = generateSwaggerUIPage(config);

      expect(result).toContain('bg-gray-900');
    });

    it('should apply light theme by default', () => {
      const config: SwaggerUIConfig = {
        specPath: '/api/openapi',
        docsPath: '/api-docs',
        title: 'Test API',
      };

      const result = generateSwaggerUIPage(config);

      expect(result).toContain('bg-white');
    });

    it('should include configurable options', () => {
      const config: SwaggerUIConfig = {
        specPath: '/api/openapi',
        docsPath: '/api-docs',
        title: 'Test API',
        docExpansion: 'full',
        showRequestDuration: false,
        enableFilter: false,
      };

      const result = generateSwaggerUIPage(config);

      expect(result).toContain('docExpansion="full"');
      expect(result).toContain('displayRequestDuration={false}');
      expect(result).toContain('filter={false}');
    });
  });

  describe('generateOpenAPIRoute', () => {
    it('should generate a valid Next.js API route', () => {
      const result = generateOpenAPIRoute(sampleSpec);

      expect(result).toContain('NextResponse');
      expect(result).toContain('export async function GET()');
      expect(result).toContain('application/x-yaml');
    });

    it('should include CORS headers', () => {
      const result = generateOpenAPIRoute(sampleSpec);

      expect(result).toContain('Access-Control-Allow-Origin');
      expect(result).toContain('Access-Control-Allow-Methods');
    });

    it('should include OPTIONS handler for CORS preflight', () => {
      const result = generateOpenAPIRoute(sampleSpec);

      expect(result).toContain('export async function OPTIONS()');
    });

    it('should embed the spec content', () => {
      const result = generateOpenAPIRoute(sampleSpec);

      expect(result).toContain('openAPISpec');
      expect(result).toContain('Test API');
    });

    it('should use JSON content type when specified', () => {
      const result = generateOpenAPIRoute(sampleSpec, 'json');

      expect(result).toContain('application/json');
    });
  });

  describe('generateDocsLayout', () => {
    it('should generate a valid layout component', () => {
      const result = generateDocsLayout('My API Docs');

      expect(result).toContain('Metadata');
      expect(result).toContain('My API Docs');
      expect(result).toContain('export default function ApiDocsLayout');
    });

    it('should include metadata for SEO', () => {
      const result = generateDocsLayout('Test API');

      expect(result).toContain('title:');
      expect(result).toContain('description:');
    });
  });

  describe('generateDocsReadme', () => {
    it('should generate a README with API name', () => {
      const result = generateDocsReadme('User API', '/api-docs');

      expect(result).toContain('User API');
      expect(result).toContain('/api-docs');
    });

    it('should include usage instructions', () => {
      const result = generateDocsReadme('Test API', '/docs');

      expect(result).toContain('Try it out');
      expect(result).toContain('Swagger UI');
      expect(result).toContain('/api/openapi');
    });
  });

  describe('generateSwaggerFiles', () => {
    it('should generate all required files', () => {
      const result = generateSwaggerFiles({
        apiName: 'User',
        specContent: sampleSpec,
      });

      expect(result.docsPage).toBeTruthy();
      expect(result.specRoute).toBeTruthy();
      expect(result.specYaml).toBe(sampleSpec);
    });

    it('should include correct file paths', () => {
      const result = generateSwaggerFiles({
        apiName: 'User',
        specContent: sampleSpec,
      });

      expect(result.filePaths.docsPage).toBe('app/api-docs/page.tsx');
      expect(result.filePaths.specRoute).toBe('app/api/openapi/route.ts');
      expect(result.filePaths.specYaml).toBe('public/openapi.yaml');
    });

    it('should include layout path when includeLayout is true', () => {
      const result = generateSwaggerFiles({
        apiName: 'User',
        specContent: sampleSpec,
        includeLayout: true,
      });

      expect(result.filePaths.docsLayout).toBe('app/api-docs/layout.tsx');
    });

    it('should respect basePath option', () => {
      const result = generateSwaggerFiles({
        apiName: 'User',
        specContent: sampleSpec,
        basePath: 'my-api',
      });

      expect(result.filePaths.docsPage).toBe('my-api/app/api-docs/page.tsx');
      expect(result.filePaths.specRoute).toBe('my-api/app/api/openapi/route.ts');
    });

    it('should include swagger-ui-react dependency', () => {
      const result = generateSwaggerFiles({
        apiName: 'User',
        specContent: sampleSpec,
      });

      expect(result.dependencies['swagger-ui-react']).toBeTruthy();
    });
  });

  describe('generateCompleteSwaggerDocs', () => {
    it('should generate all files as a record', () => {
      const result = generateCompleteSwaggerDocs({
        apiName: 'Product',
        specContent: sampleSpec,
      });

      expect(Object.keys(result).length).toBeGreaterThanOrEqual(4);
      expect(result['app/api-docs/page.tsx']).toBeTruthy();
      expect(result['app/api/openapi/route.ts']).toBeTruthy();
      expect(result['public/openapi.yaml']).toBe(sampleSpec);
      expect(result['docs/API_DOCS.md']).toBeTruthy();
    });

    it('should include layout file', () => {
      const result = generateCompleteSwaggerDocs({
        apiName: 'Product',
        specContent: sampleSpec,
        includeLayout: true,
      });

      expect(result['app/api-docs/layout.tsx']).toBeTruthy();
    });
  });

  describe('Utility Functions', () => {
    it('getSwaggerDependencies should return dependencies', () => {
      const deps = getSwaggerDependencies();

      expect(deps['swagger-ui-react']).toBeTruthy();
    });

    it('hasSwaggerDependency should detect swagger-ui-react', () => {
      expect(hasSwaggerDependency({
        dependencies: { 'swagger-ui-react': '^5.0.0' }
      })).toBe(true);

      expect(hasSwaggerDependency({
        dependencies: { 'react': '^18.0.0' }
      })).toBe(false);

      expect(hasSwaggerDependency({})).toBe(false);
    });

    it('getPackageJsonAdditions should return correct structure', () => {
      const additions = getPackageJsonAdditions();

      expect(additions.dependencies).toBeTruthy();
      expect(additions.dependencies['swagger-ui-react']).toBeTruthy();
    });

    it('generateMinimalSwaggerPage should generate minimal code', () => {
      const result = generateMinimalSwaggerPage('/api/spec');

      expect(result).toContain('SwaggerUI');
      expect(result).toContain('/api/spec');
      expect(result.length).toBeLessThan(500);
    });

    it('generateInlineSpecRoute should embed spec as JSON', () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' } };
      const result = generateInlineSpecRoute(spec);

      expect(result).toContain('NextResponse.json');
      expect(result).toContain('"openapi"');
      expect(result).toContain('"3.1.0"');
    });
  });
});
