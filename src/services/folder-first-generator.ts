/**
 * Folder-First File Generator
 * 
 * Creates folder structure before files during API generation.
 * Ensures proper project organization with folders created first,
 * then files written inside them.
 * 
 * **Feature: ui-quality-chat-polish**
 * **Validates: Requirements 3.3, 6.1, 6.2, 6.3, 6.4, 6.5**
 */

import { extractAPIName } from './api-detector';

/**
 * Types of files that can be generated
 */
export type GeneratedFileType = 'api' | 'openapi' | 'docs' | 'test' | 'types' | 'config';

/**
 * A file to be generated with its metadata
 */
export interface GeneratedFile {
  /** Full path of the file relative to project root */
  path: string;
  /** Type of file for categorization */
  type: GeneratedFileType;
  /** Optional initial content (can be populated later) */
  content?: string;
}

/**
 * Plan for generating an API project
 */
export interface FileGenerationPlan {
  /** Base path for the API project */
  basePath: string;
  /** Folders to create (in order - parents before children) */
  folders: string[];
  /** Files to write (after folders are created) */
  files: GeneratedFile[];
}

/**
 * Progress event types for folder-first generation
 */
export type ProgressEventType = 
  | 'planning'
  | 'folder:create'
  | 'file:generate'
  | 'file:write'
  | 'complete';

/**
 * Progress event emitted during generation
 */
export interface ProgressEvent {
  /** Type of progress event */
  type: ProgressEventType;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: {
    /** Path being created/written */
    path?: string;
    /** File type if applicable */
    fileType?: GeneratedFileType;
    /** Total count for progress tracking */
    totalCount?: number;
    /** Current index for progress tracking */
    currentIndex?: number;
  };
  /** Timestamp of the event */
  timestamp: number;
}

/**
 * Callback for progress events
 */
export type ProgressCallback = (event: ProgressEvent) => void | Promise<void>;

/**
 * Standard folder structure for API projects
 * Requirements: 6.4
 */
const API_PROJECT_FOLDERS = [
  'src',
  'src/routes',
  'src/types',
  'src/middleware',
  'docs',
  'tests'
] as const;

/**
 * Standard files for API projects
 */
const API_PROJECT_FILES: Array<{ relativePath: string; type: GeneratedFileType }> = [
  { relativePath: 'src/routes/index.ts', type: 'api' },
  { relativePath: 'src/types/index.ts', type: 'types' },
  { relativePath: 'docs/openapi.yaml', type: 'openapi' },
  { relativePath: 'docs/README.md', type: 'docs' },
  { relativePath: 'tests/api.test.ts', type: 'test' }
];

/**
 * Normalizes an API name to a valid folder name
 * 
 * @param name - Raw API name
 * @returns Normalized folder name (kebab-case)
 */
export function normalizeAPIName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'api';
}

/**
 * Plans the folder and file structure for an API project
 * 
 * Requirements: 6.1, 6.2, 6.4
 * - Determines folder structure needed
 * - Creates parent folders before child folders
 * - Creates standard structure (src/, docs/, tests/)
 * 
 * @param apiName - Name of the API (e.g., "user", "product")
 * @returns FileGenerationPlan with folders and files
 * 
 * @example
 * ```typescript
 * const plan = planAPIGeneration("user");
 * // plan.folders = ['user-api', 'user-api/src', 'user-api/src/routes', ...]
 * // plan.files = [{ path: 'user-api/src/routes/index.ts', type: 'api' }, ...]
 * ```
 */
export function planAPIGeneration(apiName: string): FileGenerationPlan {
  const normalizedName = normalizeAPIName(apiName);
  const basePath = `${normalizedName}-api`;
  
  // Build folder list with base path first, then subfolders
  // Requirements: 6.2 - parent folders before child folders
  const folders: string[] = [basePath];
  
  for (const folder of API_PROJECT_FOLDERS) {
    folders.push(`${basePath}/${folder}`);
  }
  
  // Build file list with full paths
  // Requirements: 6.3 - files written to correct folder path
  const files: GeneratedFile[] = API_PROJECT_FILES.map(file => ({
    path: `${basePath}/${file.relativePath}`,
    type: file.type
  }));
  
  return {
    basePath,
    folders,
    files
  };
}

/**
 * Plans API generation from a user prompt
 * 
 * @param prompt - User's input prompt
 * @returns FileGenerationPlan or null if no API name could be extracted
 */
export function planAPIGenerationFromPrompt(prompt: string): FileGenerationPlan | null {
  const apiName = extractAPIName(prompt);
  
  if (!apiName) {
    // Default to generic "api" if no name found
    return planAPIGeneration('api');
  }
  
  return planAPIGeneration(apiName);
}

/**
 * Creates a progress event
 * 
 * @param type - Event type
 * @param message - Human-readable message
 * @param details - Optional details
 * @returns ProgressEvent
 */
function createProgressEvent(
  type: ProgressEventType,
  message: string,
  details?: ProgressEvent['details']
): ProgressEvent {
  return {
    type,
    message,
    details,
    timestamp: Date.now()
  };
}

/**
 * Emits progress events for a file generation plan
 * 
 * Requirements: 6.5 - show folder creation before file writing
 * 
 * This generator yields progress events in the correct order:
 * 1. Planning event
 * 2. Folder creation events (in order)
 * 3. File generation events (in order)
 * 4. Complete event
 * 
 * @param plan - The file generation plan
 * @yields ProgressEvent for each step
 * 
 * @example
 * ```typescript
 * const plan = planAPIGeneration("user");
 * for await (const event of emitProgressEvents(plan)) {
 *   console.log(event.message);
 * }
 * ```
 */
export async function* emitProgressEvents(
  plan: FileGenerationPlan
): AsyncGenerator<ProgressEvent> {
  // 1. Planning event
  yield createProgressEvent(
    'planning',
    `Planning ${plan.basePath} project structure...`,
    { totalCount: plan.folders.length + plan.files.length }
  );
  
  // 2. Folder creation events (Requirements: 6.2, 6.5)
  for (let i = 0; i < plan.folders.length; i++) {
    const folder = plan.folders[i];
    yield createProgressEvent(
      'folder:create',
      `Creating folder: ${folder}`,
      {
        path: folder,
        currentIndex: i,
        totalCount: plan.folders.length
      }
    );
  }
  
  // 3. File generation events (after all folders)
  for (let i = 0; i < plan.files.length; i++) {
    const file = plan.files[i];
    yield createProgressEvent(
      'file:generate',
      `Generating: ${file.path}`,
      {
        path: file.path,
        fileType: file.type,
        currentIndex: i,
        totalCount: plan.files.length
      }
    );
  }
  
  // 4. Complete event
  yield createProgressEvent(
    'complete',
    `Created ${plan.folders.length} folders and ${plan.files.length} files`,
    {
      totalCount: plan.folders.length + plan.files.length
    }
  );
}

/**
 * Validates that a file generation plan has correct structure
 * 
 * Requirements: 6.2, 6.3
 * - All folders are created before files
 * - All file paths are within created folders
 * 
 * @param plan - The plan to validate
 * @returns Validation result with any errors
 */
export function validateGenerationPlan(plan: FileGenerationPlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check that base path is first folder
  if (plan.folders.length === 0) {
    errors.push('Plan must have at least one folder');
  } else if (!plan.folders[0].includes(plan.basePath)) {
    errors.push('Base path must be the first folder');
  }
  
  // Check folder ordering (parents before children)
  const createdFolders = new Set<string>();
  for (const folder of plan.folders) {
    const parentPath = folder.split('/').slice(0, -1).join('/');
    if (parentPath && !createdFolders.has(parentPath) && parentPath !== '') {
      // Check if parent is in the list but comes later
      const parentIndex = plan.folders.indexOf(parentPath);
      const currentIndex = plan.folders.indexOf(folder);
      if (parentIndex > currentIndex) {
        errors.push(`Folder "${folder}" listed before its parent "${parentPath}"`);
      }
    }
    createdFolders.add(folder);
  }
  
  // Check that all files are in created folders
  for (const file of plan.files) {
    const fileDir = file.path.split('/').slice(0, -1).join('/');
    if (!createdFolders.has(fileDir)) {
      errors.push(`File "${file.path}" is not in a created folder`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gets the ordered list of events that should be emitted for a plan
 * 
 * This is useful for testing that events are emitted in the correct order.
 * Requirements: 6.5 - folder creation before file writing
 * 
 * @param plan - The file generation plan
 * @returns Array of event types in order
 */
export function getExpectedEventOrder(plan: FileGenerationPlan): ProgressEventType[] {
  const events: ProgressEventType[] = ['planning'];
  
  // All folder events first
  for (let i = 0; i < plan.folders.length; i++) {
    events.push('folder:create');
  }
  
  // Then all file events
  for (let i = 0; i < plan.files.length; i++) {
    events.push('file:generate');
  }
  
  events.push('complete');
  
  return events;
}

/**
 * Checks if all folder events come before file events in an event sequence
 * 
 * Requirements: 6.5
 * 
 * @param events - Array of progress events
 * @returns true if folders are created before files
 */
export function areFoldersCreatedBeforeFiles(events: ProgressEvent[]): boolean {
  let seenFileEvent = false;
  
  for (const event of events) {
    if (event.type === 'file:generate' || event.type === 'file:write') {
      seenFileEvent = true;
    }
    
    if (event.type === 'folder:create' && seenFileEvent) {
      // Found a folder event after a file event - invalid order
      return false;
    }
  }
  
  return true;
}

/**
 * Adds a custom file to a generation plan
 * 
 * @param plan - The plan to modify
 * @param file - The file to add
 * @returns Updated plan with the new file
 */
export function addFileToplan(
  plan: FileGenerationPlan,
  file: GeneratedFile
): FileGenerationPlan {
  // Ensure the file's directory exists in folders
  const fileDir = file.path.split('/').slice(0, -1).join('/');
  const folders = [...plan.folders];
  
  if (!folders.includes(fileDir)) {
    // Add the directory (and any missing parents)
    const parts = fileDir.split('/');
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!folders.includes(currentPath)) {
        folders.push(currentPath);
      }
    }
    // Sort to ensure parents come before children
    folders.sort((a, b) => a.split('/').length - b.split('/').length);
  }
  
  return {
    ...plan,
    folders,
    files: [...plan.files, file]
  };
}

/**
 * Creates a plan for Swagger UI files
 * 
 * @param basePath - Base path of the API project
 * @returns Additional files for Swagger UI
 */
export function planSwaggerUIFiles(basePath: string): GeneratedFile[] {
  return [
    {
      path: `${basePath}/app/api-docs/page.tsx`,
      type: 'docs'
    },
    {
      path: `${basePath}/app/api/openapi/route.ts`,
      type: 'api'
    }
  ];
}

/**
 * Extends a plan with Swagger UI support
 * 
 * @param plan - The base plan
 * @returns Extended plan with Swagger UI files
 */
export function extendPlanWithSwaggerUI(plan: FileGenerationPlan): FileGenerationPlan {
  const swaggerFiles = planSwaggerUIFiles(plan.basePath);
  let extendedPlan = { ...plan };
  
  for (const file of swaggerFiles) {
    extendedPlan = addFileToplan(extendedPlan, file);
  }
  
  return extendedPlan;
}
