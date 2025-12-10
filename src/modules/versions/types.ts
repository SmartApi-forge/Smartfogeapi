import { z } from 'zod';

// Command types for version creation (DecisionAgent intent types)
export type CommandType = 
  | 'CREATE' 
  | 'MODIFY' 
  | 'CREATE_AND_LINK' 
  | 'FIX_ERROR' 
  | 'QUESTION';

export type VersionStatus = 'generating' | 'complete' | 'failed';

// Database schema types
export interface Version {
  id: string;
  project_id: string;
  version_number: number;
  name: string;
  description: string | null;
  files: Record<string, string>; // filename -> content
  command_type: CommandType | null;
  prompt: string;
  parent_version_id: string | null;
  status: VersionStatus;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Zod schemas for validation
export const createVersionSchema = z.object({
  project_id: z.string().uuid(),
  version_number: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  files: z.record(z.string()),
  command_type: z.enum(['CREATE', 'MODIFY', 'CREATE_AND_LINK', 'FIX_ERROR', 'QUESTION']).optional(),
  prompt: z.string().min(1),
  parent_version_id: z.string().uuid().optional(),
  status: z.enum(['generating', 'complete', 'failed']).default('generating'),
  metadata: z.record(z.any()).default({}),
});

export const updateVersionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  files: z.record(z.string()).optional(),
  status: z.enum(['generating', 'complete', 'failed']).optional(),
  metadata: z.record(z.any()).optional(),
});

export const getVersionSchema = z.object({
  id: z.string().uuid(),
});

export const getVersionsSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const getLatestVersionSchema = z.object({
  projectId: z.string().uuid(),
});

// Input/Output types
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;
export type GetVersionInput = z.infer<typeof getVersionSchema>;
export type GetVersionsInput = z.infer<typeof getVersionsSchema>;
export type GetLatestVersionInput = z.infer<typeof getLatestVersionSchema>;

// Command classification types
export interface CommandClassification {
  type: CommandType;
  confidence: number; // 0-100
  shouldCreateNewVersion: boolean;
  entities: string[]; // Extracted file names, function names, etc.
  reasoning: string;
}

export const classifyCommandSchema = z.object({
  prompt: z.string().min(1),
  projectId: z.string().uuid(),
  currentFiles: z.array(z.string()).optional(), // List of existing files for context
});

export type ClassifyCommandInput = z.infer<typeof classifyCommandSchema>;

// Version comparison types
export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  oldContent?: string;
  newContent?: string;
}

/**
 * Line-level diff entry for detailed version comparison
 * Requirements: 5.2
 */
export interface LineDiff {
  lineNumber: number;
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number; // For removed/unchanged lines
  newLineNumber?: number; // For added/unchanged lines
}

/**
 * Detailed file diff with line-level changes
 * Requirements: 5.2
 */
export interface DetailedFileDiff {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  oldContent?: string;
  newContent?: string;
  lineDiffs: LineDiff[];
  stats: {
    linesAdded: number;
    linesRemoved: number;
    linesUnchanged: number;
  };
}

/**
 * Enhanced version comparison with line-level diffs
 * Requirements: 5.2
 */
export interface DetailedVersionComparison {
  version1: Version;
  version2: Version;
  diffs: DetailedFileDiff[];
  summary: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    filesUnchanged: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
  };
}

export interface VersionComparison {
  version1: Version;
  version2: Version;
  diffs: FileDiff[];
  summary: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    filesUnchanged: number;
  };
}

/**
 * Input for creating a version with complete snapshot
 * Requirements: 5.1
 */
export interface CreateCompleteVersionInput {
  project_id: string;
  name: string;
  description?: string;
  changes: Record<string, string>; // Only the changed/new files
  deletedFiles?: string[]; // Files to remove from parent
  command_type?: CommandType;
  prompt: string;
  metadata?: Record<string, any>;
}

/**
 * Input for restoring a version
 * Requirements: 5.3
 */
export interface RestoreVersionInput {
  versionId: string;
  prompt?: string;
}

