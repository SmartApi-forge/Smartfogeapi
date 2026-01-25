/**
 * OpenAPI 3.1 Spec Generator Service
 * 
 * Generates complete OpenAPI 3.1 specifications for API projects.
 * Includes: openapi version (3.1.0), info with summary, servers, paths,
 * components/schemas, securitySchemes, and example values.
 * 
 * Requirements: 3.5, 3.6
 * Property 7: OpenAPI Spec Completeness
 * Property 8: OpenAPI Spec Validation
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface EndpointDefinition {
  path: string;
  method: HTTPMethod;
  summary: string;
  description?: string;
  operationId: string;
  tags?: string[];
  parameters?: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responseSchema?: string;
  requiresAuth?: boolean;
}

export interface ParameterDefinition {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SchemaDefinition;
  example?: unknown;
}

export interface RequestBodyDefinition {
  description?: string;
  required?: boolean;
  schemaRef?: string;
  schema?: SchemaDefinition;
}


export interface SchemaDefinition {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  format?: string;
  description?: string;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
  enum?: (string | number)[];
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  $ref?: string;
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description: string;
  summary?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
    identifier?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, {
    default: string;
    enum?: string[];
    description?: string;
  }>;
}


export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
}

export interface OpenAPIOperation {
  summary: string;
  description?: string;
  operationId: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema: SchemaDefinition;
  example?: unknown;
  examples?: Record<string, { value: unknown; summary?: string }>;
}


export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, {
    schema: SchemaDefinition;
    example?: unknown;
    examples?: Record<string, { value: unknown; summary?: string }>;
  }>;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, {
    schema: SchemaDefinition;
    example?: unknown;
    examples?: Record<string, { value: unknown; summary?: string }>;
  }>;
  headers?: Record<string, {
    description?: string;
    schema: SchemaDefinition;
  }>;
}

export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}


export interface OpenAPISpec {
  openapi: '3.1.0';
  info: OpenAPIInfo;
  jsonSchemaDialect?: string;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  webhooks?: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, SchemaDefinition>;
    responses?: Record<string, OpenAPIResponse>;
    parameters?: Record<string, OpenAPIParameter>;
    requestBodies?: Record<string, OpenAPIRequestBody>;
    headers?: Record<string, { description?: string; schema: SchemaDefinition }>;
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
  externalDocs?: { url: string; description?: string };
}

export interface OpenAPIGeneratorOptions {
  apiName: string;
  description?: string;
  version?: string;
  basePath?: string;
  endpoints: EndpointDefinition[];
  schemas?: Record<string, SchemaDefinition>;
  includeAuth?: boolean;
  authType?: 'bearer' | 'apiKey' | 'basic';
}


export interface OpenAPIGeneratorResult {
  spec: OpenAPISpec;
  yaml: string;
  json: string;
}

// =============================================================================
// YAML Serializer (Simple implementation without external dependency)
// =============================================================================

/**
 * Converts a JavaScript object to YAML format
 * Simple implementation for OpenAPI spec serialization
 */
function toYAML(obj: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }
  
  if (typeof obj === 'number') {
    return String(obj);
  }
  
  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (needsQuoting(obj)) {
      return `"${escapeString(obj)}"`;
    }
    // Multi-line strings
    if (obj.includes('\n')) {
      const lines = obj.split('\n');
      return '|\n' + lines.map(line => spaces + '  ' + line).join('\n');
    }
    return obj;
  }

  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    return obj.map(item => {
      const itemYaml = toYAML(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Object items need special handling
        const lines = itemYaml.split('\n');
        return `${spaces}- ${lines[0]}\n${lines.slice(1).map(l => spaces + '  ' + l.trim()).filter(l => l.trim()).join('\n')}`;
      }
      return `${spaces}- ${itemYaml}`;
    }).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return '{}';
    }
    return entries.map(([key, value]) => {
      const valueYaml = toYAML(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      return `${spaces}${key}: ${valueYaml}`;
    }).join('\n');
  }
  
  return String(obj);
}


function needsQuoting(str: string): boolean {
  // Quote strings that could be misinterpreted
  const specialValues = ['true', 'false', 'null', 'yes', 'no', 'on', 'off'];
  if (specialValues.includes(str.toLowerCase())) {
    return true;
  }
  // Quote strings starting with special characters
  if (/^[@#%&*!|>'{}\[\],?:-]/.test(str)) {
    return true;
  }
  // Quote strings containing special characters
  if (/[:#{}[\],&*?|<>=!%@`]/.test(str)) {
    return true;
  }
  // Quote empty strings
  if (str === '') {
    return true;
  }
  // Quote strings that look like numbers
  if (/^-?\d+\.?\d*$/.test(str)) {
    return true;
  }
  return false;
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}


// =============================================================================
// Default Schemas
// =============================================================================

const DEFAULT_ERROR_SCHEMA: SchemaDefinition = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'Error type or code',
      example: 'ValidationError',
    },
    message: {
      type: 'string',
      description: 'Human-readable error message',
      example: 'Invalid request parameters',
    },
    details: {
      type: 'array',
      description: 'Additional error details',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', example: 'email' },
          message: { type: 'string', example: 'Invalid email format' },
        },
      },
    },
  },
  required: ['error'],
};


const DEFAULT_PAGINATION_SCHEMA: SchemaDefinition = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      description: 'Current page number',
      minimum: 1,
      example: 1,
    },
    pageSize: {
      type: 'integer',
      description: 'Number of items per page',
      minimum: 1,
      maximum: 100,
      example: 20,
    },
    total: {
      type: 'integer',
      description: 'Total number of items',
      example: 150,
    },
    totalPages: {
      type: 'integer',
      description: 'Total number of pages',
      example: 8,
    },
  },
  required: ['page', 'pageSize', 'total', 'totalPages'],
};

// =============================================================================
// Helper Functions
// =============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}


function generateExampleValue(schema: SchemaDefinition): unknown {
  if (schema.example !== undefined) {
    return schema.example;
  }
  
  if (schema.examples && schema.examples.length > 0) {
    return schema.examples[0];
  }
  
  if (schema.default !== undefined) {
    return schema.default;
  }
  
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  
  switch (schema.type) {
    case 'string':
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().split('T')[0];
      if (schema.format === 'uri') return 'https://example.com';
      return 'string';
    case 'number':
    case 'integer':
      return schema.minimum ?? 1;
    case 'boolean':
      return true;
    case 'array':
      return schema.items ? [generateExampleValue(schema.items)] : [];
    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleValue(propSchema);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}


// =============================================================================
// Main Generator Functions
// =============================================================================

/**
 * Generate standard response schemas for an entity
 */
function generateEntitySchemas(
  entityName: string,
  baseSchema?: SchemaDefinition
): Record<string, SchemaDefinition> {
  const pascalName = toPascalCase(entityName);
  
  const entitySchema: SchemaDefinition = baseSchema || {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: `Unique identifier for the ${entityName}`,
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp',
        example: new Date().toISOString(),
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
        example: new Date().toISOString(),
      },
    },
    required: ['id', 'createdAt', 'updatedAt'],
  };


  return {
    [pascalName]: entitySchema,
    [`${pascalName}Create`]: {
      type: 'object',
      description: `Request body for creating a ${entityName}`,
      properties: Object.fromEntries(
        Object.entries(entitySchema.properties || {})
          .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
      ),
      required: (entitySchema.required || []).filter(
        r => !['id', 'createdAt', 'updatedAt'].includes(r)
      ),
    },
    [`${pascalName}Update`]: {
      type: 'object',
      description: `Request body for updating a ${entityName}`,
      properties: Object.fromEntries(
        Object.entries(entitySchema.properties || {})
          .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
      ),
    },
    [`${pascalName}List`]: {
      type: 'object',
      description: `Paginated list of ${entityName}s`,
      properties: {
        data: {
          type: 'array',
          items: { $ref: `#/components/schemas/${pascalName}` },
        },
        pagination: { $ref: '#/components/schemas/Pagination' },
      },
      required: ['data', 'pagination'],
    },
  };
}


/**
 * Generate standard error responses
 */
function generateErrorResponses(): Record<string, OpenAPIResponse> {
  return {
    '400': {
      description: 'Bad Request - Invalid input parameters',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
          examples: {
            validationError: {
              value: {
                error: 'ValidationError',
                message: 'Invalid request parameters',
                details: [{ field: 'email', message: 'Invalid email format' }],
              },
              summary: 'Validation error example',
            },
          },
        },
      },
    },
    '401': {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
          examples: {
            unauthorized: {
              value: { error: 'Unauthorized', message: 'Authentication required' },
              summary: 'Unauthorized error',
            },
          },
        },
      },
    },

    '403': {
      description: 'Forbidden - Insufficient permissions',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
          examples: {
            forbidden: {
              value: { error: 'Forbidden', message: 'Insufficient permissions' },
              summary: 'Forbidden error',
            },
          },
        },
      },
    },
    '404': {
      description: 'Not Found - Resource does not exist',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
          examples: {
            notFound: {
              value: { error: 'NotFound', message: 'Resource not found' },
              summary: 'Not found error',
            },
          },
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' },
          examples: {
            serverError: {
              value: { error: 'InternalError', message: 'An unexpected error occurred' },
              summary: 'Server error',
            },
          },
        },
      },
    },
  };
}


/**
 * Generate an OpenAPI operation from an endpoint definition
 */
function generateOperation(
  endpoint: EndpointDefinition,
  options: OpenAPIGeneratorOptions
): OpenAPIOperation {
  const errorResponses = generateErrorResponses();
  const pascalName = toPascalCase(options.apiName);
  
  const operation: OpenAPIOperation = {
    summary: endpoint.summary,
    description: endpoint.description,
    operationId: endpoint.operationId,
    tags: endpoint.tags || [pascalName],
    responses: {},
  };
  
  // Add parameters
  if (endpoint.parameters && endpoint.parameters.length > 0) {
    operation.parameters = endpoint.parameters.map(param => ({
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required ?? (param.in === 'path'),
      schema: param.schema,
      example: param.example ?? generateExampleValue(param.schema),
    }));
  }

  
  // Add request body for POST, PUT, PATCH
  if (['post', 'put', 'patch'].includes(endpoint.method) && endpoint.requestBody) {
    const schemaRef = endpoint.requestBody.schemaRef 
      ? { $ref: `#/components/schemas/${endpoint.requestBody.schemaRef}` }
      : endpoint.requestBody.schema || { type: 'object' as const };
    
    operation.requestBody = {
      description: endpoint.requestBody.description || `${endpoint.summary} request body`,
      required: endpoint.requestBody.required ?? true,
      content: {
        'application/json': {
          schema: schemaRef,
          example: generateExampleValue(schemaRef.$ref ? { type: 'object' } : schemaRef),
        },
      },
    };
  }
  
  // Generate success response based on method
  const successStatus = endpoint.method === 'post' ? '201' : endpoint.method === 'delete' ? '204' : '200';
  const successDescription = endpoint.method === 'post' 
    ? 'Created successfully' 
    : endpoint.method === 'delete' 
      ? 'Deleted successfully' 
      : 'Successful response';

  
  if (endpoint.method === 'delete') {
    operation.responses[successStatus] = {
      description: successDescription,
    };
  } else {
    const responseSchemaRef = endpoint.responseSchema 
      ? { $ref: `#/components/schemas/${endpoint.responseSchema}` }
      : { type: 'object' as const, properties: { success: { type: 'boolean' as const, example: true } } };
    
    operation.responses[successStatus] = {
      description: successDescription,
      content: {
        'application/json': {
          schema: responseSchemaRef,
          example: generateExampleValue(responseSchemaRef.$ref ? { type: 'object' } : responseSchemaRef),
        },
      },
    };
  }
  
  // Add error responses
  operation.responses['400'] = errorResponses['400'];
  if (endpoint.requiresAuth || options.includeAuth) {
    operation.responses['401'] = errorResponses['401'];
    operation.responses['403'] = errorResponses['403'];
    operation.security = [{ bearerAuth: [] }];
  }
  if (['get', 'put', 'patch', 'delete'].includes(endpoint.method)) {
    operation.responses['404'] = errorResponses['404'];
  }
  operation.responses['500'] = errorResponses['500'];
  
  return operation;
}


/**
 * Generate security schemes based on auth type
 */
function generateSecuritySchemes(
  authType: 'bearer' | 'apiKey' | 'basic' = 'bearer'
): Record<string, OpenAPISecurityScheme> {
  switch (authType) {
    case 'bearer':
      return {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token authentication',
        },
      };
    case 'apiKey':
      return {
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication',
        },
      };
    case 'basic':
      return {
        basicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Basic HTTP authentication',
        },
      };
    default:
      return {};
  }
}


// =============================================================================
// Main Export: generateOpenAPISpec
// =============================================================================

/**
 * Generate a complete OpenAPI 3.1 specification
 * 
 * Requirements: 3.5, 3.6
 * Property 7: OpenAPI Spec Completeness - The YAML SHALL contain: openapi version (3.1.x),
 * info section with title/version/description, paths section with at least one endpoint,
 * request/response schemas, and components/schemas section.
 * 
 * @param options - Configuration options for the OpenAPI spec
 * @returns Complete OpenAPI spec in object, YAML, and JSON formats
 */
export function generateOpenAPISpec(options: OpenAPIGeneratorOptions): OpenAPIGeneratorResult {
  const {
    apiName,
    description,
    version = '1.0.0',
    basePath = '/api',
    endpoints,
    schemas = {},
    includeAuth = true,
    authType = 'bearer',
  } = options;
  
  const pascalName = toPascalCase(apiName);

  
  // Build the OpenAPI spec
  const spec: OpenAPISpec = {
    openapi: '3.1.0',
    info: {
      title: `${pascalName} API`,
      version,
      description: description || `REST API for ${apiName} management`,
      summary: `${pascalName} API endpoints`,
    },
    servers: [
      {
        url: basePath,
        description: 'API server',
      },
    ],
    paths: {},
    components: {
      schemas: {
        Error: DEFAULT_ERROR_SCHEMA,
        Pagination: DEFAULT_PAGINATION_SCHEMA,
        ...schemas,
      },
      securitySchemes: includeAuth ? generateSecuritySchemes(authType) : undefined,
    },
    tags: [
      {
        name: pascalName,
        description: `${pascalName} operations`,
      },
    ],
  };

  
  // Add global security if auth is enabled
  if (includeAuth) {
    spec.security = [{ bearerAuth: [] }];
  }
  
  // Generate paths from endpoints
  for (const endpoint of endpoints) {
    const pathKey = endpoint.path;
    
    if (!spec.paths[pathKey]) {
      spec.paths[pathKey] = {};
    }
    
    const operation = generateOperation(endpoint, options);
    spec.paths[pathKey][endpoint.method] = operation;
  }
  
  // Generate YAML and JSON outputs
  const yaml = toYAML(spec);
  const json = JSON.stringify(spec, null, 2);
  
  return {
    spec,
    yaml,
    json,
  };
}


// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate a standard CRUD API spec for an entity
 * 
 * @param entityName - Name of the entity (e.g., 'user', 'product')
 * @param entitySchema - Optional custom schema for the entity
 * @param options - Additional options
 * @returns Complete OpenAPI spec for CRUD operations
 */
export function generateCRUDSpec(
  entityName: string,
  entitySchema?: SchemaDefinition,
  options?: Partial<OpenAPIGeneratorOptions>
): OpenAPIGeneratorResult {
  const pascalName = toPascalCase(entityName);
  const pluralName = entityName.endsWith('s') ? entityName : `${entityName}s`;
  
  // Generate entity schemas
  const entitySchemas = generateEntitySchemas(entityName, entitySchema);

  
  // Define CRUD endpoints
  const endpoints: EndpointDefinition[] = [
    {
      path: `/${pluralName}`,
      method: 'get',
      summary: `List all ${pluralName}`,
      description: `Retrieve a paginated list of ${pluralName}`,
      operationId: `list${pascalName}s`,
      parameters: [
        {
          name: 'page',
          in: 'query',
          description: 'Page number',
          schema: { type: 'integer', minimum: 1, default: 1 },
          example: 1,
        },
        {
          name: 'pageSize',
          in: 'query',
          description: 'Items per page',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          example: 20,
        },
      ],
      responseSchema: `${pascalName}List`,
    },
    {
      path: `/${pluralName}`,
      method: 'post',
      summary: `Create a new ${entityName}`,
      description: `Create a new ${entityName} with the provided data`,
      operationId: `create${pascalName}`,
      requestBody: {
        schemaRef: `${pascalName}Create`,
        required: true,
      },
      responseSchema: pascalName,
    },

    {
      path: `/${pluralName}/{id}`,
      method: 'get',
      summary: `Get ${entityName} by ID`,
      description: `Retrieve a specific ${entityName} by its unique identifier`,
      operationId: `get${pascalName}ById`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: `Unique identifier of the ${entityName}`,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
      responseSchema: pascalName,
    },
    {
      path: `/${pluralName}/{id}`,
      method: 'put',
      summary: `Update ${entityName}`,
      description: `Update an existing ${entityName} with new data`,
      operationId: `update${pascalName}`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: `Unique identifier of the ${entityName}`,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
      requestBody: {
        schemaRef: `${pascalName}Update`,
      },
      responseSchema: pascalName,
    },

    {
      path: `/${pluralName}/{id}`,
      method: 'delete',
      summary: `Delete ${entityName}`,
      description: `Permanently delete a ${entityName}`,
      operationId: `delete${pascalName}`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: `Unique identifier of the ${entityName}`,
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
    },
  ];
  
  return generateOpenAPISpec({
    apiName: entityName,
    endpoints,
    schemas: entitySchemas,
    ...options,
  });
}

/**
 * Generate endpoints from a simple route definition
 */
export function createEndpoint(
  path: string,
  method: HTTPMethod,
  summary: string,
  options?: Partial<EndpointDefinition>
): EndpointDefinition {
  const operationId = options?.operationId || 
    `${method}${path.split('/').filter(Boolean).map(s => toPascalCase(s.replace(/[{}]/g, ''))).join('')}`;
  
  return {
    path,
    method,
    summary,
    operationId,
    ...options,
  };
}
