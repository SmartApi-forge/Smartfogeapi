/**
 * API Route Generator Service
 * 
 * Generates API routes for Next.js projects, supporting both App Router
 * and Pages Router patterns. Follows project's existing patterns for
 * error handling, validation, and response formats.
 * 
 * Requirements: 15.1, 15.2
 * Property 12: API Route Location - Generated files SHALL be placed in 
 * app/api/ or pages/api/ directory based on project structure.
 */

import type { ProjectPatterns, GenerationContext } from '../types/context-management';

/**
 * Router type detection result
 */
export type RouterType = 'app' | 'pages' | 'unknown';

/**
 * HTTP methods supported for API routes
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API route generation options
 */
export interface APIRouteOptions {
  routeName: string;
  methods: HTTPMethod[];
  description?: string;
  withValidation?: boolean;
  withAuth?: boolean;
  requestBodyType?: string;
  responseType?: string;
}

/**
 * Generated API route result
 */
export interface GeneratedAPIRoute {
  routePath: string;
  routeCode: string;
  typesCode?: string;
  typesPath?: string;
  clientCode?: string;
  clientPath?: string;
}

/**
 * Full-stack feature generation options
 */
export interface FullStackFeatureOptions {
  featureName: string;
  description: string;
  methods: HTTPMethod[];
  withValidation?: boolean;
  withAuth?: boolean;
  requestBodyType?: string;
  responseType?: string;
  componentType?: 'form' | 'list' | 'detail' | 'crud';
}

/**
 * Generated full-stack feature result
 */
export interface GeneratedFullStackFeature {
  apiRoute: GeneratedAPIRoute;
  componentPath: string;
  componentCode: string;
  sharedTypesPath: string;
  sharedTypesCode: string;
}

/**
 * API Route Generator Service
 * 
 * Generates API routes for Next.js projects, supporting both App Router
 * and Pages Router patterns.
 */
export class APIRouteGenerator {
  /**
   * Detect the router type used in the project
   * 
   * Property 12: API Route Location
   * Requirements: 15.1
   * 
   * @param fileTree - List of files in the project
   * @returns The detected router type
   */
  detectRouterType(fileTree: string[]): RouterType {
    // Check for App Router indicators
    const hasAppRouter = fileTree.some(f => 
      f.startsWith('app/') && 
      (f.includes('/page.tsx') || f.includes('/page.ts') || 
       f.includes('/layout.tsx') || f.includes('/layout.ts') ||
       f.includes('/route.ts') || f.includes('/route.tsx'))
    );

    // Check for Pages Router indicators
    const hasPagesRouter = fileTree.some(f => 
      f.startsWith('pages/') && 
      (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js'))
    );

    // Check for existing API routes
    const hasAppApiRoutes = fileTree.some(f => f.startsWith('app/api/'));
    const hasPagesApiRoutes = fileTree.some(f => f.startsWith('pages/api/'));

    // Prioritize based on existing API routes
    if (hasAppApiRoutes && !hasPagesApiRoutes) {
      return 'app';
    }
    if (hasPagesApiRoutes && !hasAppApiRoutes) {
      return 'pages';
    }

    // Fall back to general router detection
    if (hasAppRouter) {
      return 'app';
    }
    if (hasPagesRouter) {
      return 'pages';
    }

    return 'unknown';
  }

  /**
   * Get the API route directory path based on router type
   * 
   * Property 12: API Route Location
   * Requirements: 15.1
   * 
   * @param routerType - The router type
   * @param routeName - The name of the route
   * @returns The full path for the API route file
   */
  getAPIRoutePath(routerType: RouterType, routeName: string): string {
    const normalizedName = this.toKebabCase(routeName);
    
    switch (routerType) {
      case 'app':
        return `app/api/${normalizedName}/route.ts`;
      case 'pages':
        return `pages/api/${normalizedName}.ts`;
      default:
        // Default to App Router for new projects
        return `app/api/${normalizedName}/route.ts`;
    }
  }


  /**
   * Generate an API route for Next.js App Router
   * 
   * Requirements: 15.1, 15.2
   * 
   * @param options - API route generation options
   * @param context - Generation context with project patterns
   * @returns Generated API route code
   */
  generateAppRouterRoute(
    options: APIRouteOptions,
    context?: GenerationContext
  ): GeneratedAPIRoute {
    const { routeName, methods, description, withValidation, withAuth, requestBodyType, responseType } = options;
    const routePath = this.getAPIRoutePath('app', routeName);
    
    const imports: string[] = [
      `import { NextRequest, NextResponse } from 'next/server';`,
    ];

    if (withValidation) {
      imports.push(`import { z } from 'zod';`);
    }

    if (withAuth) {
      imports.push(`import { createClient } from '@/lib/supabase/server';`);
    }

    const handlers: string[] = [];

    // Generate validation schema if needed
    let validationSchema = '';
    if (withValidation && requestBodyType) {
      validationSchema = `
const requestSchema = z.object({
  // TODO: Define your request schema based on ${requestBodyType}
  id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
`;
    }

    // Generate auth check helper if needed
    let authHelper = '';
    if (withAuth) {
      authHelper = `
async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }
  
  return { user, error: null };
}
`;
    }

    // Generate handlers for each method
    for (const method of methods) {
      const handler = this.generateAppRouterHandler(method, {
        withValidation: withValidation || false,
        withAuth: withAuth || false,
        description: description || '',
        responseType: responseType || 'unknown',
      });
      handlers.push(handler);
    }

    const routeCode = `${imports.join('\n')}
${validationSchema}${authHelper}
/**
 * ${description || `API route for ${routeName}`}
 * 
 * Methods: ${methods.join(', ')}
 */
${handlers.join('\n\n')}
`;

    return {
      routePath,
      routeCode: routeCode.trim(),
    };
  }

  /**
   * Generate an API route for Next.js Pages Router
   * 
   * Requirements: 15.1, 15.2
   * 
   * @param options - API route generation options
   * @param context - Generation context with project patterns
   * @returns Generated API route code
   */
  generatePagesRouterRoute(
    options: APIRouteOptions,
    context?: GenerationContext
  ): GeneratedAPIRoute {
    const { routeName, methods, description, withValidation, withAuth, requestBodyType, responseType } = options;
    const routePath = this.getAPIRoutePath('pages', routeName);
    
    const imports: string[] = [
      `import type { NextApiRequest, NextApiResponse } from 'next';`,
    ];

    if (withValidation) {
      imports.push(`import { z } from 'zod';`);
    }

    if (withAuth) {
      imports.push(`import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';`);
    }

    // Generate validation schema if needed
    let validationSchema = '';
    if (withValidation && requestBodyType) {
      validationSchema = `
const requestSchema = z.object({
  // TODO: Define your request schema based on ${requestBodyType}
  id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
`;
    }

    // Generate method handlers
    const methodHandlers = methods.map(method => 
      this.generatePagesRouterMethodHandler(method, {
        withValidation: withValidation || false,
        withAuth: withAuth || false,
        responseType: responseType || 'unknown',
      })
    ).join('\n\n    ');

    const authCheck = withAuth ? `
  // Check authentication
  const supabase = createPagesServerClient({ req, res });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
` : '';

    const routeCode = `${imports.join('\n')}
${validationSchema}
/**
 * ${description || `API route for ${routeName}`}
 * 
 * Methods: ${methods.join(', ')}
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
${authCheck}
  try {
    ${methodHandlers}
    
    // Method not allowed
    res.setHeader('Allow', ${JSON.stringify(methods)});
    return res.status(405).json({ error: \`Method \${method} Not Allowed\` });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
`;

    return {
      routePath,
      routeCode: routeCode.trim(),
    };
  }


  /**
   * Generate an API route based on detected router type
   * 
   * Property 12: API Route Location
   * Requirements: 15.1, 15.2
   * 
   * @param options - API route generation options
   * @param context - Generation context with project patterns
   * @returns Generated API route
   */
  generateAPIRoute(
    options: APIRouteOptions,
    context: GenerationContext
  ): GeneratedAPIRoute {
    const routerType = this.detectRouterType(context.fileTree || []);
    
    console.log(`🔧 Generating API route for ${routerType} router: ${options.routeName}`);
    
    if (routerType === 'pages') {
      return this.generatePagesRouterRoute(options, context);
    }
    
    // Default to App Router
    return this.generateAppRouterRoute(options, context);
  }

  /**
   * Generate a handler function for App Router
   */
  private generateAppRouterHandler(
    method: HTTPMethod,
    options: {
      withValidation: boolean;
      withAuth: boolean;
      description: string;
      responseType: string;
    }
  ): string {
    const { withValidation, withAuth, responseType } = options;
    
    const authCheck = withAuth ? `
  const { user, error: authError } = await requireAuth();
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }
` : '';

    const validationCode = withValidation && (method === 'POST' || method === 'PUT' || method === 'PATCH') ? `
  const body = await request.json();
  const validationResult = requestSchema.safeParse(body);
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validationResult.error.errors },
      { status: 400 }
    );
  }
  
  const validatedData = validationResult.data;
` : '';

    switch (method) {
      case 'GET':
        return `export async function GET(request: NextRequest) {
  try {${authCheck}
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // TODO: Implement GET logic
    const data = { message: 'GET request successful', id };
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;

      case 'POST':
        return `export async function POST(request: NextRequest) {
  try {${authCheck}${validationCode}
    const body = ${withValidation ? 'validatedData' : 'await request.json()'};
    
    // TODO: Implement POST logic
    const result = { message: 'Created successfully', data: body };
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;

      case 'PUT':
        return `export async function PUT(request: NextRequest) {
  try {${authCheck}${validationCode}
    const body = ${withValidation ? 'validatedData' : 'await request.json()'};
    
    // TODO: Implement PUT logic
    const result = { message: 'Updated successfully', data: body };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;

      case 'PATCH':
        return `export async function PATCH(request: NextRequest) {
  try {${authCheck}${validationCode}
    const body = ${withValidation ? 'validatedData' : 'await request.json()'};
    
    // TODO: Implement PATCH logic
    const result = { message: 'Patched successfully', data: body };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;

      case 'DELETE':
        return `export async function DELETE(request: NextRequest) {
  try {${authCheck}
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }
    
    // TODO: Implement DELETE logic
    
    return NextResponse.json({ message: 'Deleted successfully', id });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;

      default:
        return '';
    }
  }

  /**
   * Generate a method handler for Pages Router
   */
  private generatePagesRouterMethodHandler(
    method: HTTPMethod,
    options: {
      withValidation: boolean;
      withAuth: boolean;
      responseType: string;
    }
  ): string {
    const { withValidation } = options;
    
    const validationCode = withValidation && (method === 'POST' || method === 'PUT' || method === 'PATCH') ? `
      const validationResult = requestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        });
      }
      const validatedData = validationResult.data;` : '';

    switch (method) {
      case 'GET':
        return `if (method === 'GET') {
      const { id } = req.query;
      
      // TODO: Implement GET logic
      const data = { message: 'GET request successful', id };
      
      return res.status(200).json(data);
    }`;

      case 'POST':
        return `if (method === 'POST') {${validationCode}
      const body = ${withValidation ? 'validatedData' : 'req.body'};
      
      // TODO: Implement POST logic
      const result = { message: 'Created successfully', data: body };
      
      return res.status(201).json(result);
    }`;

      case 'PUT':
        return `if (method === 'PUT') {${validationCode}
      const body = ${withValidation ? 'validatedData' : 'req.body'};
      
      // TODO: Implement PUT logic
      const result = { message: 'Updated successfully', data: body };
      
      return res.status(200).json(result);
    }`;

      case 'PATCH':
        return `if (method === 'PATCH') {${validationCode}
      const body = ${withValidation ? 'validatedData' : 'req.body'};
      
      // TODO: Implement PATCH logic
      const result = { message: 'Patched successfully', data: body };
      
      return res.status(200).json(result);
    }`;

      case 'DELETE':
        return `if (method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      
      // TODO: Implement DELETE logic
      
      return res.status(200).json({ message: 'Deleted successfully', id });
    }`;

      default:
        return '';
    }
  }


  /**
   * Generate a full-stack feature with API route and frontend component
   * 
   * Requirements: 18.1, 18.2, 18.5
   * 
   * Creates frontend components and API routes together, ensuring frontend
   * correctly calls generated endpoints with type safety between frontend and backend.
   * 
   * @param options - Full-stack feature generation options
   * @param context - Generation context with project patterns
   * @returns Generated full-stack feature with all files
   */
  generateFullStackFeature(
    options: FullStackFeatureOptions,
    context: GenerationContext
  ): GeneratedFullStackFeature {
    const { featureName, description, methods, withValidation, withAuth, componentType } = options;
    const routerType = this.detectRouterType(context.fileTree || []);
    
    console.log(`🚀 Generating full-stack feature: ${featureName}`);
    console.log(`   Router type: ${routerType}`);
    console.log(`   Component type: ${componentType || 'default'}`);

    // Generate shared types first for type safety
    const sharedTypes = this.generateSharedTypes(featureName, options);
    
    // Generate API route
    const apiRoute = this.generateAPIRoute({
      routeName: featureName,
      methods,
      description,
      withValidation,
      withAuth,
      requestBodyType: `${this.toPascalCase(featureName)}Request`,
      responseType: `${this.toPascalCase(featureName)}Response`,
    }, context);

    // Generate frontend component with API integration
    const component = this.generateFrontendComponent(featureName, options, context, routerType);

    return {
      apiRoute,
      componentPath: component.path,
      componentCode: component.code,
      sharedTypesPath: sharedTypes.path,
      sharedTypesCode: sharedTypes.code,
    };
  }

  /**
   * Generate shared TypeScript types for frontend and backend
   * 
   * Requirements: 18.5
   * Maintains type safety between frontend and backend
   */
  private generateSharedTypes(
    featureName: string,
    options: FullStackFeatureOptions
  ): { path: string; code: string } {
    const pascalName = this.toPascalCase(featureName);
    const path = `types/${this.toKebabCase(featureName)}.ts`;

    const code = `/**
 * Shared types for ${featureName} feature
 * 
 * These types are used by both frontend and backend to ensure type safety.
 */

import { z } from 'zod';

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Request body for creating/updating ${featureName}
 */
export interface ${pascalName}Request {
  id?: string;
  // TODO: Add your request fields here
  data?: Record<string, unknown>;
}

/**
 * Response from ${featureName} API
 */
export interface ${pascalName}Response {
  success: boolean;
  message?: string;
  data?: ${pascalName}Data;
  error?: string;
}

/**
 * ${pascalName} data structure
 */
export interface ${pascalName}Data {
  id: string;
  // TODO: Add your data fields here
  createdAt: string;
  updatedAt: string;
}

/**
 * List response for ${featureName}
 */
export interface ${pascalName}ListResponse {
  success: boolean;
  data: ${pascalName}Data[];
  total: number;
  page: number;
  pageSize: number;
}

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

export const ${pascalName}RequestSchema = z.object({
  id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export const ${pascalName}DataSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ${pascalName}ResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: ${pascalName}DataSchema.optional(),
  error: z.string().optional(),
});

// =============================================================================
// Type Guards
// =============================================================================

export function is${pascalName}Data(value: unknown): value is ${pascalName}Data {
  return ${pascalName}DataSchema.safeParse(value).success;
}

export function is${pascalName}Response(value: unknown): value is ${pascalName}Response {
  return ${pascalName}ResponseSchema.safeParse(value).success;
}
`;

    return { path, code };
  }

  /**
   * Generate frontend component with API integration
   * 
   * Requirements: 18.1, 18.2
   * Creates frontend components that correctly call generated endpoints
   */
  private generateFrontendComponent(
    featureName: string,
    options: FullStackFeatureOptions,
    context: GenerationContext,
    routerType: RouterType
  ): { path: string; code: string } {
    const pascalName = this.toPascalCase(featureName);
    const kebabName = this.toKebabCase(featureName);
    const path = `components/${kebabName}.tsx`;
    const componentType = options.componentType || 'form';

    // Determine API endpoint path
    const apiEndpoint = routerType === 'pages' 
      ? `/api/${kebabName}`
      : `/api/${kebabName}`;

    let code: string;

    switch (componentType) {
      case 'form':
        code = this.generateFormComponent(pascalName, kebabName, apiEndpoint, options, context);
        break;
      case 'list':
        code = this.generateListComponent(pascalName, kebabName, apiEndpoint, options, context);
        break;
      case 'detail':
        code = this.generateDetailComponent(pascalName, kebabName, apiEndpoint, options, context);
        break;
      case 'crud':
        code = this.generateCRUDComponent(pascalName, kebabName, apiEndpoint, options, context);
        break;
      default:
        code = this.generateFormComponent(pascalName, kebabName, apiEndpoint, options, context);
    }

    return { path, code };
  }


  /**
   * Generate a form component with API integration
   */
  private generateFormComponent(
    pascalName: string,
    kebabName: string,
    apiEndpoint: string,
    options: FullStackFeatureOptions,
    context: GenerationContext
  ): string {
    const formLibrary = context.projectPatterns?.formLibrary || 'react-hook-form';
    const uiLibrary = context.projectPatterns?.uiLibrary || 'shadcn';

    if (formLibrary === 'react-hook-form' && uiLibrary === 'shadcn') {
      return this.generateShadcnFormComponent(pascalName, kebabName, apiEndpoint, options);
    }

    // Default form component
    return `'use client';

import { useState } from 'react';
import type { ${pascalName}Request, ${pascalName}Response } from '@/types/${kebabName}';

interface ${pascalName}FormProps {
  onSuccess?: (data: ${pascalName}Response) => void;
  onError?: (error: string) => void;
}

/**
 * ${pascalName} Form Component
 * 
 * Handles form submission to ${apiEndpoint}
 */
export function ${pascalName}Form({ onSuccess, onError }: ${pascalName}FormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data: ${pascalName}Request = {
      // TODO: Extract form fields
      data: Object.fromEntries(formData.entries()),
    };

    try {
      const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}
      
      {/* TODO: Add your form fields here */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

export default ${pascalName}Form;
`;
  }

  /**
   * Generate a shadcn/ui form component with react-hook-form
   */
  private generateShadcnFormComponent(
    pascalName: string,
    kebabName: string,
    apiEndpoint: string,
    options: FullStackFeatureOptions
  ): string {
    return `'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { ${pascalName}Request, ${pascalName}Response } from '@/types/${kebabName}';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  // TODO: Add more fields as needed
});

type FormValues = z.infer<typeof formSchema>;

interface ${pascalName}FormProps {
  onSuccess?: (data: ${pascalName}Response) => void;
  onError?: (error: string) => void;
  defaultValues?: Partial<FormValues>;
}

/**
 * ${pascalName} Form Component
 * 
 * Uses react-hook-form with zod validation and shadcn/ui components.
 * Submits to ${apiEndpoint}
 */
export function ${pascalName}Form({ onSuccess, onError, defaultValues }: ${pascalName}FormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      ...defaultValues,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values as ${pascalName}Request),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      toast.success(result.message || 'Success!');
      onSuccess?.(result);
      form.reset();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormDescription>
                This is the display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* TODO: Add more form fields here */}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Submitting...' : 'Submit'}
        </Button>
      </form>
    </Form>
  );
}

export default ${pascalName}Form;
`;
  }


  /**
   * Generate a list component with API integration
   */
  private generateListComponent(
    pascalName: string,
    kebabName: string,
    apiEndpoint: string,
    options: FullStackFeatureOptions,
    context: GenerationContext
  ): string {
    return `'use client';

import { useEffect, useState } from 'react';
import type { ${pascalName}Data, ${pascalName}ListResponse } from '@/types/${kebabName}';

interface ${pascalName}ListProps {
  onSelect?: (item: ${pascalName}Data) => void;
  onDelete?: (id: string) => void;
}

/**
 * ${pascalName} List Component
 * 
 * Fetches and displays a list of items from ${apiEndpoint}
 */
export function ${pascalName}List({ onSelect, onDelete }: ${pascalName}ListProps) {
  const [items, setItems] = useState<${pascalName}Data[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}');
      const result: ${pascalName}ListResponse = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      setItems(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(items.filter(item => item.id !== id));
      onDelete?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-md">
        {error}
        <button 
          onClick={fetchItems}
          className="ml-4 text-blue-600 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No items found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect?.(item)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{item.id}</h3>
              <p className="text-sm text-gray-500">
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ${pascalName}List;
`;
  }

  /**
   * Generate a detail component with API integration
   */
  private generateDetailComponent(
    pascalName: string,
    kebabName: string,
    apiEndpoint: string,
    options: FullStackFeatureOptions,
    context: GenerationContext
  ): string {
    return `'use client';

import { useEffect, useState } from 'react';
import type { ${pascalName}Data, ${pascalName}Response } from '@/types/${kebabName}';

interface ${pascalName}DetailProps {
  id: string;
  onBack?: () => void;
  onEdit?: (item: ${pascalName}Data) => void;
}

/**
 * ${pascalName} Detail Component
 * 
 * Fetches and displays a single item from ${apiEndpoint}
 */
export function ${pascalName}Detail({ id, onBack, onEdit }: ${pascalName}DetailProps) {
  const [item, setItem] = useState<${pascalName}Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`);
      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch item');
      }

      setItem(result.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-md">
        {error}
        <button 
          onClick={fetchItem}
          className="ml-4 text-blue-600 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8 text-center text-gray-500">
        Item not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="text-blue-600 hover:underline"
          >
            ← Back
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      <div className="p-6 border rounded-lg">
        <h2 className="text-xl font-bold mb-4">Item Details</h2>
        
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">ID</dt>
            <dd className="mt-1">{item.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1">{new Date(item.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Updated At</dt>
            <dd className="mt-1">{new Date(item.updatedAt).toLocaleString()}</dd>
          </div>
          {/* TODO: Add more fields */}
        </dl>
      </div>
    </div>
  );
}

export default ${pascalName}Detail;
`;
  }


  /**
   * Generate a CRUD component with full API integration
   */
  private generateCRUDComponent(
    pascalName: string,
    kebabName: string,
    apiEndpoint: string,
    options: FullStackFeatureOptions,
    context: GenerationContext
  ): string {
    return `'use client';

import { useState, useCallback } from 'react';
import type { ${pascalName}Data, ${pascalName}Response, ${pascalName}Request } from '@/types/${kebabName}';

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

interface ${pascalName}CRUDProps {
  initialMode?: ViewMode;
}

/**
 * ${pascalName} CRUD Component
 * 
 * Full CRUD operations for ${apiEndpoint}
 */
export function ${pascalName}CRUD({ initialMode = 'list' }: ${pascalName}CRUDProps) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [selectedItem, setSelectedItem] = useState<${pascalName}Data | null>(null);
  const [items, setItems] = useState<${pascalName}Data[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch items');
      }

      setItems(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create item
  const createItem = async (data: ${pascalName}Request) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create item');
      }

      await fetchItems();
      setMode('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Update item
  const updateItem = async (id: string, data: ${pascalName}Request) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update item');
      }

      await fetchItems();
      setMode('list');
      setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete item
  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete item');
      }

      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ${pascalName}Request = {
      data: Object.fromEntries(formData.entries()),
    };

    if (mode === 'edit' && selectedItem) {
      await updateItem(selectedItem.id, data);
    } else {
      await createItem(data);
    }
  };

  // Render form
  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={mode === 'edit' && selectedItem ? '' : ''}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </div>

      {/* TODO: Add more form fields */}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('list');
            setSelectedItem(null);
          }}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  // Render list
  const renderList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">${pascalName} List</h2>
        <button
          onClick={() => setMode('create')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create New
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No items found.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 border rounded-lg flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{item.id}</p>
                <p className="text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setMode('detail');
                  }}
                  className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  View
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setMode('edit');
                  }}
                  className="px-3 py-1 text-green-600 hover:bg-green-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render detail
  const renderDetail = () => {
    if (!selectedItem) return null;

    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setMode('list');
            setSelectedItem(null);
          }}
          className="text-blue-600 hover:underline"
        >
          ← Back to list
        </button>

        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-bold mb-4">Item Details</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">ID</dt>
              <dd>{selectedItem.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd>{new Date(selectedItem.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Updated</dt>
              <dd>{new Date(selectedItem.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {error && (
        <div className="mb-4 p-4 text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {mode === 'list' && renderList()}
      {mode === 'create' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Create ${pascalName}</h2>
          {renderForm()}
        </div>
      )}
      {mode === 'edit' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Edit ${pascalName}</h2>
          {renderForm()}
        </div>
      )}
      {mode === 'detail' && renderDetail()}
    </div>
  );
}

export default ${pascalName}CRUD;
`;
  }

  /**
   * Generate a client-side API hook for the feature
   * 
   * Requirements: 18.2
   * Ensures frontend correctly calls generated endpoints
   */
  generateClientHook(
    featureName: string,
    context: GenerationContext
  ): { path: string; code: string } {
    const pascalName = this.toPascalCase(featureName);
    const kebabName = this.toKebabCase(featureName);
    const camelName = this.toCamelCase(featureName);
    const routerType = this.detectRouterType(context.fileTree || []);
    const apiEndpoint = `/api/${kebabName}`;
    const path = `hooks/use-${kebabName}.ts`;

    const code = `'use client';

import { useState, useCallback } from 'react';
import type { 
  ${pascalName}Data, 
  ${pascalName}Request, 
  ${pascalName}Response,
  ${pascalName}ListResponse 
} from '@/types/${kebabName}';

interface Use${pascalName}Options {
  onSuccess?: (data: ${pascalName}Response) => void;
  onError?: (error: string) => void;
}

interface Use${pascalName}Return {
  // State
  data: ${pascalName}Data | null;
  items: ${pascalName}Data[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetch${pascalName}: (id: string) => Promise<void>;
  fetchAll${pascalName}s: () => Promise<void>;
  create${pascalName}: (data: ${pascalName}Request) => Promise<${pascalName}Response | null>;
  update${pascalName}: (id: string, data: ${pascalName}Request) => Promise<${pascalName}Response | null>;
  delete${pascalName}: (id: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * Custom hook for ${pascalName} API operations
 * 
 * Provides type-safe API calls to ${apiEndpoint}
 */
export function use${pascalName}(options: Use${pascalName}Options = {}): Use${pascalName}Return {
  const { onSuccess, onError } = options;
  
  const [data, setData] = useState<${pascalName}Data | null>(null);
  const [items, setItems] = useState<${pascalName}Data[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
    onError?.(message);
  }, [onError]);

  const fetch${pascalName} = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`);
      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch');
      }

      setData(result.data || null);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchAll${pascalName}s = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}');
      const result: ${pascalName}ListResponse = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }

      setItems(result.data || []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const create${pascalName} = useCallback(async (requestData: ${pascalName}Request): Promise<${pascalName}Response | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create');
      }

      onSuccess?.(result);
      return result;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, onSuccess]);

  const update${pascalName} = useCallback(async (id: string, requestData: ${pascalName}Request): Promise<${pascalName}Response | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result: ${pascalName}Response = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update');
      }

      onSuccess?.(result);
      return result;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, onSuccess]);

  const delete${pascalName} = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete');
      }

      return true;
    } catch (err) {
      handleError(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const reset = useCallback(() => {
    setData(null);
    setItems([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    items,
    isLoading,
    error,
    fetch${pascalName},
    fetchAll${pascalName}s,
    create${pascalName},
    update${pascalName},
    delete${pascalName},
    reset,
  };
}

export default use${pascalName};
`;

    return { path, code };
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

// Export singleton instance
export const apiRouteGenerator = new APIRouteGenerator();
