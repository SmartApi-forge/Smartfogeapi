/**
 * Enhanced Context Management Types
 * 
 * Type definitions for the hybrid memory system, agentic planning,
 * execution, and validation components.
 * 
 * Requirements: 1.1, 8.1, 8.2
 */

import { z } from 'zod';

// =============================================================================
// Core Enums and Constants
// =============================================================================

/**
 * Intent types for the PlanningAgent
 * Represents the classified intent of a user prompt
 */
export type Intent = 
  | 'CREATE' 
  | 'MODIFY' 
  | 'CREATE_AND_LINK' 
  | 'FIX_ERROR' 
  | 'QUESTION' 
  | 'REFACTOR' 
  | 'API_GENERATE';

/**
 * Task types for execution planning
 */
export type TaskType = 'create' | 'modify' | 'delete' | 'link';

/**
 * Validation issue types
 */
export type ValidationIssueType = 
  | 'missing_import' 
  | 'missing_directive' 
  | 'syntax_error' 
  | 'type_error' 
  | 'z_index_issue';

/**
 * Validation issue severity levels
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * File relationship types for dependency tracking
 */
export type FileRelationshipType = 'imports' | 'exports' | 'extends' | 'uses';

// =============================================================================
// Working Memory Types (Requirements: 1.1, 1.2)
// =============================================================================

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * File content with metadata
 */
export interface FileContent {
  path: string;
  content: string;
  lastModified?: string;
}

/**
 * Working memory - immediate context for LLM
 * Contains conversation history and recent files
 */
export interface WorkingMemory {
  conversationHistory: ConversationMessage[];
  recentFiles: FileContent[];
  currentPrompt: string;
}

// =============================================================================
// Long-Term Memory Types (Requirements: 1.4)
// =============================================================================

/**
 * Project knowledge - persistent patterns and conventions
 */
export interface ProjectKnowledge {
  uiLibrary: string;
  styling: string;
  stateManagement: string;
  formLibrary: string;
  database: string;
  auth: string;
  importAliases: Record<string, string>;
  componentConventions: string[];
}

/**
 * File relationship for dependency tracking
 */
export interface FileRelationship {
  source: string;
  target: string;
  type: FileRelationshipType;
}

/**
 * Long-term memory - persistent knowledge base
 */
export interface LongTermMemory {
  projectKnowledge: ProjectKnowledge;
  fileRelationships: FileRelationship[];
  architecturalDecisions: string[];
}

// =============================================================================
// Context Types (Requirements: 1.1, 1.3, 1.5)
// =============================================================================

/**
 * Relevant file with relevance scoring
 */
export interface RelevantFile {
  path: string;
  content: string;
  relevance: number;
  reason: string;
}

/**
 * Project patterns detected from codebase
 */
export interface ProjectPatterns {
  uiLibrary: string;
  styling: string;
  formLibrary: string;
  stateManagement: string;
  commonComponents: string[];
  importPatterns: string[];
}

/**
 * Options for context building
 */
export interface ContextOptions {
  messageLimit: number;
  maxFiles: number;
  includeTests: boolean;
  isGitHubProject: boolean;
  errorFileName?: string;
}

/**
 * Complete generation context
 */
export interface GenerationContext {
  workingMemory: WorkingMemory;
  longTermMemory: LongTermMemory;
  relevantFiles: RelevantFile[];
  projectPatterns: ProjectPatterns;
  fileTree: string[];
  /** Whether this is a GitHub cloned project (enables strict modification mode) */
  isGitHubProject?: boolean;
}

// =============================================================================
// Planning Types (Requirements: 8.1, 8.2)
// =============================================================================

/**
 * Task in an execution plan
 */
export interface Task {
  id: string;
  type: TaskType;
  target: string;
  description: string;
  dependencies: string[];
}

/**
 * File target for execution
 */
export interface FileTarget {
  path: string;
  action: 'create' | 'modify' | 'delete';
  reason: string;
}

/**
 * Dependency between tasks
 */
export interface Dependency {
  taskId: string;
  dependsOn: string[];
}

/**
 * Execution plan created by PlanningAgent
 */
export interface ExecutionPlan {
  intent: Intent;
  confidence: number;
  tasks: Task[];
  fileTargets: FileTarget[];
  criticalReminders: string[];
  dependencies: Dependency[];
}

// =============================================================================
// Execution Types (Requirements: 4.1, 4.2, 4.3)
// =============================================================================

/**
 * Generated code with metadata
 */
export interface GeneratedCode {
  content: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
}

/**
 * Change description for a file modification
 */
export interface ChangeDescription {
  file: string;
  action: 'created' | 'modified' | 'deleted';
  description: string;
  linesChanged?: number;
}

/**
 * Result of code execution
 */
export interface ExecutionResult {
  modifiedFiles: Record<string, string>;
  newFiles: Record<string, string>;
  deletedFiles: string[];
  changes: ChangeDescription[];
  description: string;
}

/**
 * Result of applying changes
 */
export interface ApplyResult {
  success: boolean;
  appliedFiles: string[];
  failedFiles: string[];
  errors: string[];
}

/**
 * Result of error recovery attempt
 */
export interface RecoveryResult {
  success: boolean;
  retryCount: number;
  approach: string;
  result?: ExecutionResult;
  error?: string;
}

// =============================================================================
// Validation Types (Requirements: 2.4, 8.4, 12.1, 12.2, 12.4)
// =============================================================================

/**
 * Validation issue found in code
 */
export interface ValidationIssue {
  type: ValidationIssueType;
  severity: ValidationSeverity;
  message: string;
  line?: number;
  autoFixable: boolean;
}

/**
 * Applied fix during validation
 */
export interface AppliedFix {
  type: ValidationIssueType;
  description: string;
  line?: number;
}

/**
 * Context for validation
 */
export interface ValidationContext {
  projectPatterns: ProjectPatterns;
  existingImports: string[];
  isNextJsAppRouter: boolean;
  filePath: string;
  /** Map of component names to their actual import paths in the project */
  availableComponents?: Record<string, string>;
  /** List of all file paths in the project for import validation */
  projectFiles?: string[];
}

/**
 * Result of code validation
 */
export interface ValidationResult {
  isValid: boolean;
  fixedCode: string;
  issues: ValidationIssue[];
  fixes: AppliedFix[];
}

/**
 * Production readiness check result
 */
export interface ReadinessCheck {
  name: string;
  passed: boolean;
  message: string;
  remediation?: string;
}

/**
 * Production readiness report
 */
export interface ReadinessReport {
  isReady: boolean;
  checks: ReadinessCheck[];
  summary: string;
}

// =============================================================================
// File Tracking Types (Requirements: 3.1, 3.2, 3.4)
// =============================================================================

/**
 * File changes detected by FileTracker
 */
export interface FileChanges {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

/**
 * File hash entry for Merkle tree tracking
 */
export interface FileHashEntry {
  path: string;
  hash: string;
  size: number;
}

// =============================================================================
// Environment Variable Types (Requirements: 16.1, 16.3, 16.4)
// =============================================================================

/**
 * Environment variable
 */
export interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
  isRequired: boolean;
}

/**
 * Environment validation result
 */
export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Sandbox Types (Requirements: 6.1, 6.2, 6.3)
// =============================================================================

/**
 * Options for server restart
 */
export interface RestartOptions {
  clearCache: boolean;
  waitForReady: boolean;
  timeout: number;
}

/**
 * Server status
 */
export interface ServerStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
  error?: string;
}

/**
 * Result of file sync operation
 */
export interface SyncResult {
  success: boolean;
  syncedFiles: string[];
  failedFiles: string[];
  duration: number;
}

/**
 * Result of server restart
 */
export interface RestartResult {
  success: boolean;
  duration: number;
  error?: string;
}

// =============================================================================
// Service Interfaces
// =============================================================================

/**
 * ContextManager interface
 * Manages hybrid memory system with working and long-term memory
 */
export interface IContextManager {
  buildContext(
    projectId: string, 
    prompt: string, 
    options: ContextOptions
  ): Promise<GenerationContext>;
  
  getWorkingMemory(projectId: string): Promise<WorkingMemory>;
  getLongTermMemory(projectId: string): Promise<LongTermMemory>;
  updateLongTermMemory(projectId: string, patterns: ProjectPatterns): Promise<void>;
  updateFileRelationships(projectId: string, relationships: FileRelationship[]): Promise<void>;
  addArchitecturalDecision(projectId: string, decision: string): Promise<void>;
  extractFileRelationships(files: Record<string, string>): FileRelationship[];
}

/**
 * PlanningAgent interface
 * Analyzes user intent and creates execution plans
 */
export interface IPlanningAgent {
  analyze(prompt: string, context: GenerationContext): Promise<ExecutionPlan>;
  classifyIntent(prompt: string): Intent;
  createTaskBreakdown(intent: Intent, context: GenerationContext): Task[];
}

/**
 * ExecutionAgent interface
 * Executes plans by coordinating code generation and file operations
 */
export interface IExecutionAgent {
  execute(plan: ExecutionPlan, context: GenerationContext): Promise<ExecutionResult>;
  generateCode(task: Task, context: GenerationContext): Promise<GeneratedCode>;
  applyChanges(changes: ChangeDescription[]): Promise<ApplyResult>;
  handleError(error: Error, retryCount: number): Promise<RecoveryResult>;
}

/**
 * ValidationAgent interface
 * Validates generated code and applies automatic fixes
 */
export interface IValidationAgent {
  validate(
    code: string, 
    filePath: string, 
    context: ValidationContext
  ): Promise<ValidationResult>;
  
  autoFix(code: string, issues: ValidationIssue[]): Promise<string>;
  checkProductionReadiness(projectId: string): Promise<ReadinessReport>;
}

/**
 * FileTracker interface
 * Tracks file changes using content hashes
 */
export interface IFileTracker {
  computeHash(content: string): string;
  getFileHashes(projectId: string): Promise<Map<string, string>>;
  detectChanges(
    oldHashes: Map<string, string>, 
    newFiles: Record<string, string>
  ): FileChanges;
  updateHashes(projectId: string, files: Record<string, string>): Promise<void>;
}

/**
 * FileReconciler interface
 * Reconciles file paths and handles naming conflicts
 */
export interface IFileReconciler {
  reconcile(generatedPath: string, existingFiles: string[]): string;
  normalizePath(path: string): string;
  findSimilarFile(path: string, existingFiles: string[]): string | null;
}

/**
 * EnvManager interface
 * Manages environment variables for projects
 */
export interface IEnvManager {
  saveEnvVariables(projectId: string, variables: EnvVariable[]): Promise<void>;
  getEnvVariables(projectId: string): Promise<EnvVariable[]>;
  detectRequiredVariables(files: Record<string, string>): string[];
  validateEnvFormat(content: string): EnvValidationResult;
}

/**
 * SandboxManager interface (enhanced)
 * Manages sandbox lifecycle and file synchronization
 */
export interface ISandboxManager {
  syncFiles(sandboxId: string, files: Record<string, string>): Promise<SyncResult>;
  restartServer(sandboxId: string, options: RestartOptions): Promise<RestartResult>;
  saveEnvFile(sandboxId: string, content: string): Promise<void>;
  getServerStatus(sandboxId: string): Promise<ServerStatus>;
}

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

export const IntentSchema = z.enum([
  'CREATE', 
  'MODIFY', 
  'CREATE_AND_LINK', 
  'FIX_ERROR', 
  'QUESTION', 
  'REFACTOR', 
  'API_GENERATE'
]);

export const TaskTypeSchema = z.enum(['create', 'modify', 'delete', 'link']);

export const ValidationIssueTypeSchema = z.enum([
  'missing_import', 
  'missing_directive', 
  'syntax_error', 
  'type_error', 
  'z_index_issue'
]);

export const ValidationSeveritySchema = z.enum(['error', 'warning']);

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskTypeSchema,
  target: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
});

export const ExecutionPlanSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(100),
  tasks: z.array(TaskSchema),
  fileTargets: z.array(z.object({
    path: z.string(),
    action: z.enum(['create', 'modify', 'delete']),
    reason: z.string(),
  })),
  criticalReminders: z.array(z.string()),
  dependencies: z.array(z.object({
    taskId: z.string(),
    dependsOn: z.array(z.string()),
  })),
});

export const ValidationIssueSchema = z.object({
  type: ValidationIssueTypeSchema,
  severity: ValidationSeveritySchema,
  message: z.string(),
  line: z.number().optional(),
  autoFixable: z.boolean(),
});

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  fixedCode: z.string(),
  issues: z.array(ValidationIssueSchema),
  fixes: z.array(z.object({
    type: ValidationIssueTypeSchema,
    description: z.string(),
    line: z.number().optional(),
  })),
});

export const FileChangesSchema = z.object({
  added: z.array(z.string()),
  modified: z.array(z.string()),
  deleted: z.array(z.string()),
  unchanged: z.array(z.string()),
});

export const ProjectKnowledgeSchema = z.object({
  uiLibrary: z.string(),
  styling: z.string(),
  stateManagement: z.string(),
  formLibrary: z.string(),
  database: z.string(),
  auth: z.string(),
  importAliases: z.record(z.string()),
  componentConventions: z.array(z.string()),
});

export const ContextOptionsSchema = z.object({
  messageLimit: z.number().default(20),
  maxFiles: z.number().default(10),
  includeTests: z.boolean().default(false),
  isGitHubProject: z.boolean().default(false),
  errorFileName: z.string().optional(),
});
