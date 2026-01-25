/**
 * Lightweight API Generator
 * 
 * Creates standalone folder structures and files for API-only projects,
 * bypassing the full Next.js template scaffolding.
 * 
 * **Feature: lightweight-api-generation**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
 * 
 * @module lightweight-api-generator
 */

/**
 * HTTP methods supported for API endpoints
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Configuration for a single API endpoint
 */
export interface EndpointConfig {
  /** The URL path for the endpoint (e.g., '/users', '/users/:id') */
  path: string;
  /** HTTP methods supported by this endpoint */
  methods: HttpMethod[];
  /** Name of the resource (e.g., 'user', 'product') */
  resourceName: string;
}

/**
 * Configuration for generating a lightweight API project
 */
export interface LightweightAPIConfig {
  /** Project name in kebab-case (e.g., 'user-management-api') */
  projectName: string;
  /** List of endpoints to generate */
  endpoints: EndpointConfig[];
  /** Whether to include OpenAPI specification */
  includeOpenAPI: boolean;
  /** Whether to include README documentation */
  includeReadme: boolean;
}

/**
 * File type classification for generated files
 */
export type GeneratedFileType = 'route' | 'type' | 'openapi' | 'readme' | 'package' | 'index';

/**
 * Represents a generated file with its path and content
 */
export interface GeneratedFile {
  /** Full path relative to project root (e.g., 'user-api/src/routes/users.ts') */
  path: string;
  /** File content */
  content: string;
  /** Type of file for categorization */
  type: GeneratedFileType;
}

/**
 * Result of generating a lightweight API project
 */
export interface GeneratedAPIProject {
  /** List of folders to create (in order, parents before children) */
  folders: string[];
  /** List of files to create */
  files: GeneratedFile[];
}

/**
 * Standard folder structure for lightweight API projects
 * Requirement 2.3: Create standard subfolders: src/, src/routes/, docs/, types/
 */
const STANDARD_SUBFOLDERS = [
  'src',
  'src/routes',
  'types',
  'docs'
] as const;

/**
 * Generates the folder structure for a lightweight API project
 * 
 * Requirement 2.2: Create folders before files inside them
 * Requirement 2.3: Create standard subfolders
 * 
 * @param projectName - The project name in kebab-case
 * @returns Array of folder paths in creation order (parents before children)
 * 
 * @example
 * ```typescript
 * generateFolderStructure('user-api')
 * // Returns: ['user-api', 'user-api/src', 'user-api/src/routes', 'user-api/types', 'user-api/docs']
 * ```
 */
export function generateFolderStructure(projectName: string): string[] {
  // Validate project name
  if (!projectName || projectName.trim().length === 0) {
    throw new Error('Project name cannot be empty');
  }

  const sanitizedName = sanitizeProjectName(projectName);
  
  // Create folders in order: root first, then subfolders
  // This ensures parents are created before children (Requirement 2.2)
  const folders: string[] = [sanitizedName];
  
  for (const subfolder of STANDARD_SUBFOLDERS) {
    folders.push(`${sanitizedName}/${subfolder}`);
  }
  
  return folders;
}

/**
 * Generates a minimal package.json for the API project
 * 
 * @param projectName - The project name in kebab-case
 * @returns JSON string of package.json content
 */
export function generatePackageJson(projectName: string): string {
  const sanitizedName = sanitizeProjectName(projectName);
  
  const packageJson = {
    name: sanitizedName,
    version: '1.0.0',
    type: 'module',
    main: 'dist/index.js',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      zod: '^3.22.0'
    },
    devDependencies: {
      typescript: '^5.0.0',
      tsx: '^4.0.0',
      '@types/node': '^20.0.0'
    }
  };
  
  return JSON.stringify(packageJson, null, 2);
}

/**
 * Generates a basic index.ts entry point
 * 
 * @param projectName - The project name
 * @returns TypeScript content for index.ts
 */
export function generateIndexFile(projectName: string): string {
  return `/**
 * ${projectName} - API Entry Point
 * 
 * This file exports all routes and types for the API.
 */

// Export routes
export * from './routes';

// Export types
export * from '../types';

console.log('${projectName} API initialized');
`;
}

/**
 * Generates a comprehensive README.md for the API project with Mermaid diagrams
 * 
 * @param projectName - The project name
 * @param endpoints - List of endpoints (optional)
 * @returns Markdown content for README.md
 */
export function generateReadme(projectName: string, endpoints: EndpointConfig[] = []): string {
  const endpointDocs = endpoints.length > 0
    ? endpoints.map(ep => `| ${ep.methods.join(', ')} | ${ep.path} | ${ep.resourceName} operations |`).join('\n')
    : '| GET | /items | List all items |\n| POST | /items | Create a new item |\n| GET | /items/:id | Get item by ID |\n| PUT | /items/:id | Update item |\n| DELETE | /items/:id | Delete item |';

  return `# ${projectName}

A lightweight REST API project generated by SmartAPIForge.

## Architecture

\`\`\`mermaid
graph TD
    Client[Client Application] --> API[API Server]
    API --> Routes[Route Handlers]
    Routes --> Validation[Zod Validation]
    Validation --> Business[Business Logic]
    Business --> DB[(Database)]
    
    subgraph "API Layer"
        Routes
        Validation
    end
    
    subgraph "Data Layer"
        Business
        DB
    end
\`\`\`

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

\`\`\`bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
${endpointDocs}

## Request/Response Examples

### List Items

\`\`\`bash
curl -X GET http://localhost:3000/items
\`\`\`

**Response:**
\`\`\`json
{
  "data": [],
  "total": 0
}
\`\`\`

### Create Item

\`\`\`bash
curl -X POST http://localhost:3000/items \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Example", "description": "An example item"}'
\`\`\`

**Response:**
\`\`\`json
{
  "id": "uuid",
  "name": "Example",
  "description": "An example item",
  "createdAt": "2024-01-01T00:00:00Z"
}
\`\`\`

## Data Models

\`\`\`mermaid
erDiagram
    ITEM {
        string id PK "Unique identifier"
        string name "Item name"
        string description "Item description"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }
\`\`\`

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "error": "ErrorType",
  "message": "Human readable message",
  "details": []
}
\`\`\`

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid request body |
| 404 | NotFoundError | Resource not found |
| 500 | InternalError | Server error |

## Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── routes/      # API route handlers
│   │   └── *.ts     # Individual route files
│   └── index.ts     # Entry point
├── types/           # TypeScript interfaces and Zod schemas
│   └── *.ts         # Type definitions
├── docs/            # API documentation
│   └── openapi.yaml # OpenAPI 3.1 specification
├── package.json     # Project dependencies
└── README.md        # This file
\`\`\`

## API Documentation

See \`docs/openapi.yaml\` for the complete OpenAPI 3.1 specification.

You can view the interactive documentation by importing the spec into:
- [Swagger Editor](https://editor.swagger.io/)
- [Stoplight Studio](https://stoplight.io/studio)
- [Postman](https://www.postman.com/)

## License

MIT
`;
}

/**
 * Determines the appropriate subfolder for a file based on its type
 * 
 * Requirement 2.5: Place files in appropriate subfolders based on type
 * 
 * @param fileType - The type of file
 * @returns The subfolder path (without project name prefix)
 */
export function getSubfolderForFileType(fileType: GeneratedFileType): string {
  switch (fileType) {
    case 'route':
      return 'src/routes';
    case 'type':
      return 'types';
    case 'openapi':
      return 'docs';
    case 'readme':
      return ''; // Root level
    case 'package':
      return ''; // Root level
    case 'index':
      return 'src';
    default:
      return '';
  }
}

/**
 * Generates a complete lightweight API project structure
 * 
 * Requirement 2.1: Create root folder named after the API
 * Requirement 2.2: Create folders before files
 * Requirement 2.3: Create standard subfolders
 * Requirement 2.5: Place files in appropriate subfolders
 * 
 * @param config - Configuration for the API project
 * @returns Generated project with folders and files
 * 
 * @example
 * ```typescript
 * const project = generateLightweightAPI({
 *   projectName: 'user-management-api',
 *   endpoints: [{ path: '/users', methods: ['GET', 'POST'], resourceName: 'user' }],
 *   includeOpenAPI: true,
 *   includeReadme: true
 * });
 * ```
 */
export function generateLightweightAPI(config: LightweightAPIConfig): GeneratedAPIProject {
  const { projectName, endpoints, includeOpenAPI, includeReadme } = config;
  
  // Validate and sanitize project name
  const sanitizedName = sanitizeProjectName(projectName);
  
  // Generate folder structure (Requirement 2.2, 2.3)
  const folders = generateFolderStructure(sanitizedName);
  
  const files: GeneratedFile[] = [];
  
  // Generate package.json (always included)
  files.push({
    path: `${sanitizedName}/package.json`,
    content: generatePackageJson(sanitizedName),
    type: 'package'
  });
  
  // Generate index.ts entry point
  files.push({
    path: `${sanitizedName}/src/index.ts`,
    content: generateIndexFile(sanitizedName),
    type: 'index'
  });
  
  // Generate README if requested
  if (includeReadme) {
    files.push({
      path: `${sanitizedName}/README.md`,
      content: generateReadme(sanitizedName, endpoints),
      type: 'readme'
    });
  }
  
  // Note: OpenAPI spec is generated by the LLM, not as a placeholder
  // This ensures the spec contains actual paths and schemas based on the user's request
  // The LLM is instructed to generate docs/openapi.yaml with complete endpoint definitions
  
  // Note: Route files and type files are generated by the LLM
  // This generator provides the structure; content comes from AI
  
  return { folders, files };
}

/**
 * Generates a placeholder OpenAPI specification
 * 
 * @param projectName - The project name
 * @param endpoints - List of endpoints
 * @returns YAML content for openapi.yaml
 */
function generateOpenAPIPlaceholder(projectName: string, endpoints: EndpointConfig[]): string {
  const paths = endpoints.length > 0
    ? endpoints.map(ep => `  ${ep.path}:\n    # ${ep.methods.join(', ')} operations for ${ep.resourceName}`).join('\n')
    : '  # Paths will be defined here';

  return `openapi: 3.1.0
info:
  title: ${projectName}
  version: 1.0.0
  description: API generated by SmartAPIForge

servers:
  - url: http://localhost:3000
    description: Development server

paths:
${paths}

components:
  schemas:
    # Schemas will be defined here
`;
}

/**
 * Sanitizes a project name to ensure it's valid for file system and package.json
 * 
 * Requirement 2.4: Convert spaces to kebab-case
 * 
 * @param name - The raw project name
 * @returns Sanitized project name in kebab-case
 */
export function sanitizeProjectName(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'generated-api';
  }
  
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

/**
 * Creates a file path by combining project name, subfolder, and filename
 * 
 * @param projectName - The project name
 * @param fileType - The type of file
 * @param filename - The filename (without path)
 * @returns Full file path
 */
export function createFilePath(
  projectName: string,
  fileType: GeneratedFileType,
  filename: string
): string {
  const subfolder = getSubfolderForFileType(fileType);
  const sanitizedName = sanitizeProjectName(projectName);
  
  if (subfolder) {
    return `${sanitizedName}/${subfolder}/${filename}`;
  }
  return `${sanitizedName}/${filename}`;
}
