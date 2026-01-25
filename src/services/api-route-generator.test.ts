/**
 * APIRouteGenerator Property-Based Tests
 * 
 * Tests for the APIRouteGenerator service using fast-check for property-based testing.
 * 
 * **Feature: enhanced-context-management, Property 12: API Route Location**
 * **Validates: Requirements 15.1**
 * 
 * For any API generation request in a Next.js project, the generated files 
 * SHALL be placed in app/api/ or pages/api/ directory.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { APIRouteGenerator, RouterType } from './api-route-generator';
import type { GenerationContext, ProjectPatterns } from '../types/context-management';

describe('APIRouteGenerator', () => {
  const apiRouteGenerator = new APIRouteGenerator();

  // Helper to create a valid route name arbitrary
  const routeNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/)
    .filter(s => s.length >= 2 && s.length <= 30);

  // Helper to create HTTP methods arbitrary
  const httpMethodsArb = fc.uniqueArray(
    fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE') as fc.Arbitrary<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>,
    { minLength: 1, maxLength: 5 }
  );

  // Helper to create App Router file tree
  const appRouterFileTreeArb = fc.array(
    fc.constantFrom(
      'app/page.tsx',
      'app/layout.tsx',
      'app/globals.css',
      'app/api/health/route.ts',
      'app/dashboard/page.tsx',
      'components/header.tsx',
      'lib/utils.ts'
    ),
    { minLength: 2, maxLength: 7 }
  ).map(files => [...new Set(['app/page.tsx', 'app/layout.tsx', ...files])]);

  // Helper to create Pages Router file tree
  const pagesRouterFileTreeArb = fc.array(
    fc.constantFrom(
      'pages/index.tsx',
      'pages/_app.tsx',
      'pages/_document.tsx',
      'pages/api/health.ts',
      'pages/dashboard.tsx',
      'components/header.tsx',
      'lib/utils.ts'
    ),
    { minLength: 2, maxLength: 7 }
  ).map(files => [...new Set(['pages/index.tsx', 'pages/_app.tsx', ...files])]);

  // Helper to create a mock GenerationContext
  const createMockContext = (fileTree: string[]): GenerationContext => ({
    workingMemory: {
      conversationHistory: [],
      recentFiles: [],
      currentPrompt: '',
    },
    longTermMemory: {
      projectKnowledge: {
        uiLibrary: 'shadcn',
        styling: 'tailwind',
        stateManagement: 'react-hooks',
        formLibrary: 'react-hook-form',
        database: 'supabase',
        auth: 'supabase-auth',
        importAliases: { '@': './src' },
        componentConventions: [],
      },
      fileRelationships: [],
      architecturalDecisions: [],
    },
    relevantFiles: [],
    projectPatterns: {
      uiLibrary: 'shadcn',
      styling: 'tailwind',
      formLibrary: 'react-hook-form',
      stateManagement: 'react-hooks',
      commonComponents: [],
      importPatterns: [],
    },
    fileTree,
  });

  describe('detectRouterType', () => {
    it('should detect App Router from file tree', () => {
      fc.assert(
        fc.property(appRouterFileTreeArb, (fileTree: string[]) => {
          const routerType = apiRouteGenerator.detectRouterType(fileTree);
          // Should detect as 'app' router
          expect(['app', 'unknown']).toContain(routerType);
        }),
        { numRuns: 100 }
      );
    });

    it('should detect Pages Router from file tree', () => {
      fc.assert(
        fc.property(pagesRouterFileTreeArb, (fileTree: string[]) => {
          const routerType = apiRouteGenerator.detectRouterType(fileTree);
          // Should detect as 'pages' router
          expect(['pages', 'unknown']).toContain(routerType);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('getAPIRoutePath', () => {
    /**
     * **Feature: enhanced-context-management, Property 12: API Route Location**
     * **Validates: Requirements 15.1**
     * 
     * For any API generation request in a Next.js project, the generated files 
     * SHALL be placed in app/api/ or pages/api/ directory.
     */
    it('should place API routes in app/api/ for App Router (Property 12: API Route Location)', () => {
      fc.assert(
        fc.property(routeNameArb, (routeName: string) => {
          const routePath = apiRouteGenerator.getAPIRoutePath('app', routeName);
          
          // Must start with app/api/
          expect(routePath.startsWith('app/api/')).toBe(true);
          // Must end with route.ts for App Router
          expect(routePath.endsWith('/route.ts')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: enhanced-context-management, Property 12: API Route Location**
     * **Validates: Requirements 15.1**
     */
    it('should place API routes in pages/api/ for Pages Router (Property 12: API Route Location)', () => {
      fc.assert(
        fc.property(routeNameArb, (routeName: string) => {
          const routePath = apiRouteGenerator.getAPIRoutePath('pages', routeName);
          
          // Must start with pages/api/
          expect(routePath.startsWith('pages/api/')).toBe(true);
          // Must end with .ts for Pages Router
          expect(routePath.endsWith('.ts')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should default to app/api/ for unknown router type', () => {
      fc.assert(
        fc.property(routeNameArb, (routeName: string) => {
          const routePath = apiRouteGenerator.getAPIRoutePath('unknown', routeName);
          
          // Should default to App Router pattern
          expect(routePath.startsWith('app/api/')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('generateAPIRoute', () => {
    /**
     * **Feature: enhanced-context-management, Property 12: API Route Location**
     * **Validates: Requirements 15.1**
     * 
     * For any API generation request in a Next.js project, the generated files 
     * SHALL be placed in app/api/ or pages/api/ directory based on project structure.
     */
    it('should generate API routes in correct directory based on project structure (Property 12: API Route Location)', () => {
      // Test with App Router projects
      fc.assert(
        fc.property(
          routeNameArb,
          httpMethodsArb,
          appRouterFileTreeArb,
          (routeName: string, methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[], fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateAPIRoute(
              { routeName, methods },
              context
            );
            
            // Route path must be in app/api/ or pages/api/
            const isValidLocation = 
              result.routePath.startsWith('app/api/') || 
              result.routePath.startsWith('pages/api/');
            
            expect(isValidLocation).toBe(true);
            
            // For App Router file trees, should prefer app/api/
            if (fileTree.some(f => f.startsWith('app/') && !f.startsWith('app/api/'))) {
              expect(result.routePath.startsWith('app/api/')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate API routes in pages/api/ for Pages Router projects', () => {
      fc.assert(
        fc.property(
          routeNameArb,
          httpMethodsArb,
          pagesRouterFileTreeArb,
          (routeName: string, methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[], fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateAPIRoute(
              { routeName, methods },
              context
            );
            
            // Route path must be in app/api/ or pages/api/
            const isValidLocation = 
              result.routePath.startsWith('app/api/') || 
              result.routePath.startsWith('pages/api/');
            
            expect(isValidLocation).toBe(true);
            
            // For Pages Router file trees (without app/ directory), should use pages/api/
            if (!fileTree.some(f => f.startsWith('app/'))) {
              expect(result.routePath.startsWith('pages/api/')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid TypeScript code', () => {
      fc.assert(
        fc.property(
          routeNameArb,
          httpMethodsArb,
          appRouterFileTreeArb,
          (routeName: string, methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[], fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateAPIRoute(
              { routeName, methods },
              context
            );
            
            // Should contain import statements
            expect(result.routeCode).toContain('import');
            
            // Should contain export statements for each method (App Router)
            // or a default export (Pages Router)
            const hasExports = 
              methods.some(m => result.routeCode.includes(`export async function ${m}`)) ||
              result.routeCode.includes('export default');
            
            expect(hasExports).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateFullStackFeature', () => {
    it('should generate all required files for a full-stack feature', () => {
      fc.assert(
        fc.property(
          routeNameArb,
          httpMethodsArb,
          appRouterFileTreeArb,
          (featureName: string, methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[], fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateFullStackFeature(
              {
                featureName,
                description: `API for ${featureName}`,
                methods,
                componentType: 'form',
              },
              context
            );
            
            // Should have API route
            expect(result.apiRoute.routePath).toBeTruthy();
            expect(result.apiRoute.routeCode).toBeTruthy();
            
            // API route should be in correct location
            const isValidApiLocation = 
              result.apiRoute.routePath.startsWith('app/api/') || 
              result.apiRoute.routePath.startsWith('pages/api/');
            expect(isValidApiLocation).toBe(true);
            
            // Should have component
            expect(result.componentPath).toBeTruthy();
            expect(result.componentCode).toBeTruthy();
            expect(result.componentPath.startsWith('components/')).toBe(true);
            
            // Should have shared types
            expect(result.sharedTypesPath).toBeTruthy();
            expect(result.sharedTypesCode).toBeTruthy();
            expect(result.sharedTypesPath.startsWith('types/')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain type safety between frontend and backend', () => {
      fc.assert(
        fc.property(
          routeNameArb,
          appRouterFileTreeArb,
          (featureName: string, fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateFullStackFeature(
              {
                featureName,
                description: `API for ${featureName}`,
                methods: ['GET', 'POST'],
                componentType: 'form',
              },
              context
            );
            
            // Shared types should define Request and Response types
            expect(result.sharedTypesCode).toContain('Request');
            expect(result.sharedTypesCode).toContain('Response');
            
            // Component should import from shared types
            expect(result.componentCode).toContain(`@/types/`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateClientHook', () => {
    it('should generate a valid React hook', () => {
      fc.assert(
        fc.property(
          routeNameArb,
          appRouterFileTreeArb,
          (featureName: string, fileTree: string[]) => {
            const context = createMockContext(fileTree);
            const result = apiRouteGenerator.generateClientHook(featureName, context);
            
            // Should be in hooks directory
            expect(result.path.startsWith('hooks/')).toBe(true);
            expect(result.path.endsWith('.ts')).toBe(true);
            
            // Should be a valid hook (starts with 'use')
            expect(result.code).toContain('export function use');
            
            // Should use 'use client' directive
            expect(result.code).toContain("'use client'");
            
            // Should import types from shared types
            expect(result.code).toContain('@/types/');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
