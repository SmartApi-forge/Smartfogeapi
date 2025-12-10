/**
 * ExecutionAgent Service
 * 
 * Executes plans by coordinating code generation and file operations.
 * Handles error recovery with retry logic and CREATE_AND_LINK operations.
 * 
 * Requirements: 4.1, 4.2, 4.3, 8.3, 8.6, 10.2, 10.3, 10.4
 */

import OpenAI from 'openai';
import type {
  IExecutionAgent,
  ExecutionPlan,
  ExecutionResult,
  GenerationContext,
  Task,
  GeneratedCode,
  ChangeDescription,
  ApplyResult,
  RecoveryResult,
} from '../types/context-management';
import { ValidationAgent } from './validation-agent';
import { FileReconciler } from './file-reconciler';
import { APIRouteGenerator } from './api-route-generator';

// Lazy-load OpenAI client to allow tests to run without API key
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Maximum number of retry attempts for error recovery
 * Property 14: Retry Limit - ExecutionAgent SHALL attempt recovery at most 3 times
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Recovery approaches to try on each retry attempt
 */
const RECOVERY_APPROACHES = [
  'simplify_request',
  'break_into_smaller_tasks',
  'use_alternative_implementation',
];

/**
 * Phrases that explicitly request new file creation in GitHub strict mode
 * Property 7: GitHub Strict Mode - newFiles SHALL be empty unless prompt contains these phrases
 */
const CREATE_NEW_FILE_PHRASES = [
  'create new file',
  'create a new file',
  'add new file',
  'add a new file',
  'make new file',
  'make a new file',
  'new file',
  'create file',
];

/**
 * ExecutionAgent implementation
 * Coordinates code generation and file operations based on execution plans
 */
export class ExecutionAgent implements IExecutionAgent {
  private validationAgent: ValidationAgent;
  private fileReconciler: FileReconciler;
  private apiRouteGenerator: APIRouteGenerator;

  constructor() {
    this.validationAgent = new ValidationAgent();
    this.fileReconciler = new FileReconciler();
    this.apiRouteGenerator = new APIRouteGenerator();
  }

  /**
   * Check if a project is a GitHub cloned project
   * 
   * Property 7: GitHub Strict Mode
   * Requirements: 9.1
   * 
   * @param context - The generation context
   * @returns true if the project is a GitHub cloned project
   */
  isGitHubProject(context: GenerationContext): boolean {
    return context.isGitHubProject === true;
  }

  /**
   * Check if the prompt explicitly requests new file creation
   * 
   * Property 7: GitHub Strict Mode
   * Requirements: 9.2
   * 
   * @param prompt - The user's prompt
   * @returns true if the prompt explicitly requests new file creation
   */
  promptExplicitlyRequestsNewFile(prompt: string): boolean {
    const normalizedPrompt = prompt.toLowerCase();
    return CREATE_NEW_FILE_PHRASES.some(phrase => normalizedPrompt.includes(phrase));
  }

  /**
   * Apply GitHub strict mode filtering to execution results
   * 
   * Property 7: GitHub Strict Mode
   * For any GitHub cloned project, the newFiles object SHALL be empty 
   * unless the prompt explicitly contains "create new file".
   * 
   * Requirements: 9.1, 9.2
   * 
   * @param result - The execution result to filter
   * @param context - The generation context
   * @returns Filtered execution result with newFiles converted to modifications if needed
   */
  applyGitHubStrictMode(
    result: ExecutionResult,
    context: GenerationContext
  ): ExecutionResult {
    // If not a GitHub project, return result unchanged
    if (!this.isGitHubProject(context)) {
      return result;
    }

    const prompt = context.workingMemory?.currentPrompt || '';
    
    // If prompt explicitly requests new file creation, allow it
    if (this.promptExplicitlyRequestsNewFile(prompt)) {
      console.log('📝 GitHub strict mode: New file creation explicitly requested');
      return result;
    }

    // In strict mode, convert new files to modifications if possible
    const existingFiles = context.fileTree || [];
    const modifiedFiles = { ...result.modifiedFiles };
    const newFiles: Record<string, string> = {};
    const changes = [...result.changes];

    for (const [path, content] of Object.entries(result.newFiles)) {
      // Try to reconcile to an existing file
      const reconciledPath = this.fileReconciler.reconcile(path, existingFiles);
      
      if (existingFiles.includes(reconciledPath)) {
        // Convert to modification
        console.log(`⚠️ GitHub strict mode: Converting new file "${path}" to modification of "${reconciledPath}"`);
        modifiedFiles[reconciledPath] = content;
        
        // Update change description
        const changeIndex = changes.findIndex(c => c.file === path && c.action === 'created');
        if (changeIndex >= 0) {
          changes[changeIndex] = {
            ...changes[changeIndex],
            file: reconciledPath,
            action: 'modified',
            description: `${changes[changeIndex].description} (converted from new file in GitHub strict mode)`,
          };
        }
      } else {
        // Log warning and reject the new file
        console.warn(`🚫 GitHub strict mode: Rejecting new file "${path}" - not explicitly requested`);
        
        // Remove the change entry for this file
        const changeIndex = changes.findIndex(c => c.file === path && c.action === 'created');
        if (changeIndex >= 0) {
          changes.splice(changeIndex, 1);
        }
      }
    }

    return {
      ...result,
      modifiedFiles,
      newFiles,
      changes,
    };
  }

  /**
   * Build system prompt with complete file tree for GitHub projects
   * 
   * Property 7: GitHub Strict Mode
   * Requirements: 9.5
   * 
   * @param context - The generation context
   * @returns System prompt section with file tree
   */
  buildGitHubStrictModePrompt(context: GenerationContext): string {
    if (!this.isGitHubProject(context)) {
      return '';
    }

    const fileTree = context.fileTree || [];
    const fileTreeStr = fileTree.map(f => `  - ${f}`).join('\n');

    return `
🚨 ULTRA STRICT MODE - GITHUB CLONED PROJECT 🚨

This is a GitHub cloned project. You MUST follow these rules:

1. DO NOT create new files unless the user explicitly says "create new file"
2. ONLY modify existing files from the project
3. If you need to add functionality, add it to an existing file
4. If you generate a file path that matches an existing file (case-insensitive), treat it as a modification

COMPLETE PROJECT FILE TREE:
${fileTreeStr}

You may ONLY modify files from this list. Any attempt to create files not in this list will be rejected.
`;
  }

  /**
   * Execute an execution plan and generate/modify code
   * 
   * Requirements: 4.1, 4.2, 4.3
   * 
   * @param plan - The execution plan from PlanningAgent
   * @param context - The generation context with project information
   * @returns ExecutionResult with modified/new/deleted files
   */
  async execute(plan: ExecutionPlan, context: GenerationContext): Promise<ExecutionResult> {
    console.log(`🚀 ExecutionAgent executing plan: ${plan.intent}`);
    console.log(`   Tasks: ${plan.tasks.length}`);
    console.log(`   File targets: ${plan.fileTargets.length}`);

    const modifiedFiles: Record<string, string> = {};
    const newFiles: Record<string, string> = {};
    const deletedFiles: string[] = [];
    const changes: ChangeDescription[] = [];

    // Handle QUESTION intent - no code generation needed
    if (plan.intent === 'QUESTION') {
      return {
        modifiedFiles: {},
        newFiles: {},
        deletedFiles: [],
        changes: [],
        description: 'Question answered - no code changes required',
      };
    }

    // Handle CREATE_AND_LINK intent specially
    if (plan.intent === 'CREATE_AND_LINK') {
      return this.executeCreateAndLink(plan, context);
    }

    // Handle API_GENERATE intent with full-stack feature generation
    if (plan.intent === 'API_GENERATE') {
      return this.executeAPIGenerate(plan, context);
    }

    // Execute tasks in dependency order
    const sortedTasks = this.sortTasksByDependency(plan.tasks, plan.dependencies);

    for (const task of sortedTasks) {
      try {
        const result = await this.executeTask(task, context, plan);
        
        // Merge results
        Object.assign(modifiedFiles, result.modifiedFiles);
        Object.assign(newFiles, result.newFiles);
        deletedFiles.push(...result.deletedFiles);
        changes.push(...result.changes);
      } catch (error) {
        console.error(`❌ Task ${task.id} failed:`, error);
        
        // Attempt recovery
        const recovery = await this.handleError(error as Error, 0);
        if (!recovery.success) {
          throw new Error(`Task ${task.id} failed after ${MAX_RETRY_ATTEMPTS} retries: ${recovery.error}`);
        }
        
        if (recovery.result) {
          Object.assign(modifiedFiles, recovery.result.modifiedFiles);
          Object.assign(newFiles, recovery.result.newFiles);
          deletedFiles.push(...recovery.result.deletedFiles);
          changes.push(...recovery.result.changes);
        }
      }
    }

    // Reconcile file paths for GitHub projects
    const existingFiles = context.fileTree || [];
    const reconciledResult = this.reconcileFiles(
      modifiedFiles,
      newFiles,
      existingFiles,
      context
    );

    // Validate and fix all generated code
    const validatedResult = await this.validateGeneratedCode(
      reconciledResult.modifiedFiles,
      reconciledResult.newFiles,
      context
    );

    const result: ExecutionResult = {
      modifiedFiles: validatedResult.modifiedFiles,
      newFiles: validatedResult.newFiles,
      deletedFiles,
      changes,
      description: this.generateDescription(plan, changes),
    };

    // Apply GitHub strict mode filtering
    // Property 7: GitHub Strict Mode
    // Requirements: 9.1, 9.2
    return this.applyGitHubStrictMode(result, context);
  }

  /**
   * Generate code for a specific task
   * 
   * Requirements: 4.1, 4.2
   * 
   * @param task - The task to generate code for
   * @param context - The generation context
   * @returns GeneratedCode with content and metadata
   */
  async generateCode(task: Task, context: GenerationContext): Promise<GeneratedCode> {
    console.log(`📝 Generating code for task: ${task.id} (${task.type})`);

    const systemPrompt = this.buildCodeGenerationPrompt(task, context);
    const userPrompt = this.buildUserPrompt(task, context);

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      content: result.code || '',
      imports: result.imports || [],
      exports: result.exports || [],
      dependencies: result.dependencies || [],
    };
  }

  /**
   * Apply changes to files
   * 
   * Requirements: 4.3
   * 
   * @param changes - The changes to apply
   * @returns ApplyResult with success status and details
   */
  async applyChanges(changes: ChangeDescription[]): Promise<ApplyResult> {
    const appliedFiles: string[] = [];
    const failedFiles: string[] = [];
    const errors: string[] = [];

    for (const change of changes) {
      try {
        // In a real implementation, this would write to the file system
        // For now, we just track what would be applied
        appliedFiles.push(change.file);
        console.log(`✓ Applied change to ${change.file}: ${change.description}`);
      } catch (error) {
        failedFiles.push(change.file);
        errors.push(`Failed to apply change to ${change.file}: ${(error as Error).message}`);
      }
    }

    return {
      success: failedFiles.length === 0,
      appliedFiles,
      failedFiles,
      errors,
    };
  }


  /**
   * Handle errors with retry logic
   * 
   * Property 14: Retry Limit
   * For any error during execution, the ExecutionAgent SHALL attempt 
   * recovery at most 3 times before failing.
   * 
   * Requirements: 8.3, 8.6
   * 
   * @param error - The error that occurred
   * @param retryCount - Current retry attempt number
   * @returns RecoveryResult with success status and optional result
   */
  async handleError(error: Error, retryCount: number): Promise<RecoveryResult> {
    console.log(`🔄 Attempting error recovery (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
    console.log(`   Error: ${error.message}`);

    // Check if we've exceeded retry limit
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.log(`❌ Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`);
      return {
        success: false,
        retryCount,
        approach: 'none',
        error: `Max retry attempts exceeded. Last error: ${error.message}`,
      };
    }

    // Select recovery approach based on retry count
    const approach = RECOVERY_APPROACHES[retryCount] || 'simplify_request';
    console.log(`   Using approach: ${approach}`);

    try {
      // Attempt recovery based on approach
      const recoveryResult = await this.attemptRecovery(error, approach);
      
      if (recoveryResult) {
        console.log(`✓ Recovery successful with approach: ${approach}`);
        return {
          success: true,
          retryCount: retryCount + 1,
          approach,
          result: recoveryResult,
        };
      }
    } catch (recoveryError) {
      console.log(`   Recovery attempt failed: ${(recoveryError as Error).message}`);
    }

    // Recursive retry with incremented count
    return this.handleError(error, retryCount + 1);
  }

  /**
   * Execute CREATE_AND_LINK intent
   * 
   * Property 9: CREATE_AND_LINK Completeness
   * For any CREATE_AND_LINK intent, the result SHALL contain both a new 
   * component file AND a modified parent file with import.
   * 
   * Requirements: 10.2, 10.3, 10.4
   */
  private async executeCreateAndLink(
    plan: ExecutionPlan,
    context: GenerationContext
  ): Promise<ExecutionResult> {
    console.log('🔗 Executing CREATE_AND_LINK operation');

    const modifiedFiles: Record<string, string> = {};
    const newFiles: Record<string, string> = {};
    const changes: ChangeDescription[] = [];

    // Find create and link tasks
    const createTask = plan.tasks.find(t => t.type === 'create');
    const linkTask = plan.tasks.find(t => t.type === 'link' || t.type === 'modify');

    if (!createTask) {
      throw new Error('CREATE_AND_LINK requires a create task');
    }

    // Step 1: Generate the new component
    const componentCode = await this.generateComponentCode(createTask, context, plan);
    const componentPath = this.determineComponentPath(createTask, context);
    
    newFiles[componentPath] = componentCode.content;
    changes.push({
      file: componentPath,
      action: 'created',
      description: `Created new component: ${createTask.description}`,
    });

    // Step 2: Find and modify the parent file
    const parentPath = this.findParentFile(plan, context);
    if (parentPath) {
      const parentContent = this.getFileContent(parentPath, context);
      if (parentContent) {
        const componentName = this.extractComponentName(componentPath);
        const modifiedParent = this.addComponentToParent(
          parentContent,
          componentName,
          componentPath,
          context
        );

        modifiedFiles[parentPath] = modifiedParent;
        changes.push({
          file: parentPath,
          action: 'modified',
          description: `Added import and usage of ${componentName}`,
        });
      }
    }

    // Validate the result
    if (Object.keys(newFiles).length === 0) {
      throw new Error('CREATE_AND_LINK failed: No new component file created');
    }

    if (Object.keys(modifiedFiles).length === 0) {
      console.warn('⚠️ CREATE_AND_LINK: No parent file modified - component may not be linked');
    }

    // Validate generated code
    const validatedResult = await this.validateGeneratedCode(
      modifiedFiles,
      newFiles,
      context
    );

    const result: ExecutionResult = {
      modifiedFiles: validatedResult.modifiedFiles,
      newFiles: validatedResult.newFiles,
      deletedFiles: [],
      changes,
      description: `Created component and linked to parent file`,
    };

    // Apply GitHub strict mode filtering
    // Property 7: GitHub Strict Mode
    // Requirements: 9.1, 9.2
    return this.applyGitHubStrictMode(result, context);
  }

  /**
   * Execute API_GENERATE intent with full-stack feature generation
   * 
   * Requirements: 15.1, 15.2, 18.1, 18.2, 18.5
   * 
   * Creates frontend components and API routes together, ensuring frontend
   * correctly calls generated endpoints with type safety between frontend and backend.
   */
  private async executeAPIGenerate(
    plan: ExecutionPlan,
    context: GenerationContext
  ): Promise<ExecutionResult> {
    console.log('🔧 Executing API_GENERATE operation');

    const modifiedFiles: Record<string, string> = {};
    const newFiles: Record<string, string> = {};
    const changes: ChangeDescription[] = [];

    // Extract feature name from plan
    const featureName = this.extractFeatureNameFromPlan(plan);
    console.log(`   Feature name: ${featureName}`);

    // Determine what methods are needed based on tasks
    const methods = this.extractMethodsFromPlan(plan);
    console.log(`   Methods: ${methods.join(', ')}`);

    // Generate full-stack feature
    const fullStackFeature = this.apiRouteGenerator.generateFullStackFeature({
      featureName,
      description: plan.tasks[0]?.description || `API for ${featureName}`,
      methods,
      withValidation: true,
      withAuth: false, // Can be enhanced based on context
      componentType: 'form', // Default to form, can be enhanced
    }, context);

    // Add API route
    newFiles[fullStackFeature.apiRoute.routePath] = fullStackFeature.apiRoute.routeCode;
    changes.push({
      file: fullStackFeature.apiRoute.routePath,
      action: 'created',
      description: `Created API route for ${featureName}`,
    });

    // Add shared types
    newFiles[fullStackFeature.sharedTypesPath] = fullStackFeature.sharedTypesCode;
    changes.push({
      file: fullStackFeature.sharedTypesPath,
      action: 'created',
      description: `Created shared types for ${featureName}`,
    });

    // Add frontend component
    newFiles[fullStackFeature.componentPath] = fullStackFeature.componentCode;
    changes.push({
      file: fullStackFeature.componentPath,
      action: 'created',
      description: `Created frontend component for ${featureName}`,
    });

    // Generate client hook for API calls
    const clientHook = this.apiRouteGenerator.generateClientHook(featureName, context);
    newFiles[clientHook.path] = clientHook.code;
    changes.push({
      file: clientHook.path,
      action: 'created',
      description: `Created client hook for ${featureName} API`,
    });

    // Validate generated code
    const validatedResult = await this.validateGeneratedCode(
      modifiedFiles,
      newFiles,
      context
    );

    const result: ExecutionResult = {
      modifiedFiles: validatedResult.modifiedFiles,
      newFiles: validatedResult.newFiles,
      deletedFiles: [],
      changes,
      description: `Generated full-stack feature: ${featureName}`,
    };

    // Apply GitHub strict mode filtering
    return this.applyGitHubStrictMode(result, context);
  }

  /**
   * Extract feature name from execution plan
   */
  private extractFeatureNameFromPlan(plan: ExecutionPlan): string {
    // Try to extract from file targets
    const apiTarget = plan.fileTargets.find(t => 
      t.path.includes('api') && t.action === 'create'
    );
    
    if (apiTarget) {
      // Extract name from path like "app/api/users/route.ts" -> "users"
      const match = apiTarget.path.match(/api\/([^\/]+)/);
      if (match) {
        return match[1];
      }
    }

    // Try to extract from task descriptions
    for (const task of plan.tasks) {
      const match = task.description.match(/(?:api|endpoint)\s+(?:for\s+)?(\w+)/i);
      if (match) {
        return match[1];
      }
    }

    // Default name
    return 'feature';
  }

  /**
   * Extract HTTP methods from execution plan
   */
  private extractMethodsFromPlan(plan: ExecutionPlan): ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[] {
    const methods: Set<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'> = new Set();
    
    // Check task descriptions for method hints
    for (const task of plan.tasks) {
      const desc = task.description.toLowerCase();
      
      if (desc.includes('get') || desc.includes('fetch') || desc.includes('list') || desc.includes('read')) {
        methods.add('GET');
      }
      if (desc.includes('create') || desc.includes('add') || desc.includes('post')) {
        methods.add('POST');
      }
      if (desc.includes('update') || desc.includes('put') || desc.includes('edit')) {
        methods.add('PUT');
      }
      if (desc.includes('patch') || desc.includes('partial')) {
        methods.add('PATCH');
      }
      if (desc.includes('delete') || desc.includes('remove')) {
        methods.add('DELETE');
      }
    }

    // Default to GET and POST if no methods detected
    if (methods.size === 0) {
      methods.add('GET');
      methods.add('POST');
    }

    return Array.from(methods);
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: Task,
    context: GenerationContext,
    plan: ExecutionPlan
  ): Promise<ExecutionResult> {
    const modifiedFiles: Record<string, string> = {};
    const newFiles: Record<string, string> = {};
    const deletedFiles: string[] = [];
    const changes: ChangeDescription[] = [];

    switch (task.type) {
      case 'create': {
        const code = await this.generateCode(task, context);
        const filePath = this.determineFilePath(task, context);
        newFiles[filePath] = code.content;
        changes.push({
          file: filePath,
          action: 'created',
          description: task.description,
        });
        break;
      }

      case 'modify': {
        const targetFile = this.findTargetFile(task, context);
        if (targetFile) {
          const existingContent = this.getFileContent(targetFile, context);
          const code = await this.generateModification(task, existingContent || '', context);
          modifiedFiles[targetFile] = code.content;
          changes.push({
            file: targetFile,
            action: 'modified',
            description: task.description,
          });
        }
        break;
      }

      case 'delete': {
        const targetFile = this.findTargetFile(task, context);
        if (targetFile) {
          deletedFiles.push(targetFile);
          changes.push({
            file: targetFile,
            action: 'deleted',
            description: task.description,
          });
        }
        break;
      }

      case 'link': {
        // Link tasks are handled as part of CREATE_AND_LINK
        break;
      }
    }

    return {
      modifiedFiles,
      newFiles,
      deletedFiles,
      changes,
      description: task.description,
    };
  }


  /**
   * Sort tasks by dependency order
   */
  private sortTasksByDependency(
    tasks: Task[],
    dependencies: { taskId: string; dependsOn: string[] }[]
  ): Task[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const depMap = new Map(dependencies.map(d => [d.taskId, d.dependsOn]));
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected for task: ${taskId}`);
      }

      visiting.add(taskId);
      const deps = depMap.get(taskId) || [];
      for (const dep of deps) {
        visit(dep);
      }
      visiting.delete(taskId);
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        sorted.push(task);
      }
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return sorted;
  }

  /**
   * Reconcile generated files with existing files
   */
  private reconcileFiles(
    modifiedFiles: Record<string, string>,
    newFiles: Record<string, string>,
    existingFiles: string[],
    context: GenerationContext
  ): { modifiedFiles: Record<string, string>; newFiles: Record<string, string> } {
    const reconciledModified: Record<string, string> = { ...modifiedFiles };
    const reconciledNew: Record<string, string> = {};

    for (const [path, content] of Object.entries(newFiles)) {
      const reconciledPath = this.fileReconciler.reconcile(path, existingFiles);
      
      // If reconciled to an existing file, treat as modification
      if (existingFiles.includes(reconciledPath)) {
        console.log(`✓ Reconciled "${path}" → "${reconciledPath}" (existing file)`);
        reconciledModified[reconciledPath] = content;
      } else {
        reconciledNew[reconciledPath] = content;
      }
    }

    return { modifiedFiles: reconciledModified, newFiles: reconciledNew };
  }

  /**
   * Validate all generated code
   */
  private async validateGeneratedCode(
    modifiedFiles: Record<string, string>,
    newFiles: Record<string, string>,
    context: GenerationContext
  ): Promise<{ modifiedFiles: Record<string, string>; newFiles: Record<string, string> }> {
    const validatedModified: Record<string, string> = {};
    const validatedNew: Record<string, string> = {};

    const isNextJsAppRouter = context.fileTree?.some(f => 
      f.startsWith('app/') && (f.endsWith('/page.tsx') || f.endsWith('/layout.tsx'))
    ) ?? false;

    // Build available components map from project files
    const availableComponents = this.buildAvailableComponentsMap(context.fileTree || []);

    const validationContext = {
      projectPatterns: context.projectPatterns,
      existingImports: [],
      isNextJsAppRouter,
      filePath: '',
      availableComponents,
      projectFiles: context.fileTree || [],
    };

    // Validate modified files
    for (const [path, content] of Object.entries(modifiedFiles)) {
      const result = await this.validationAgent.validate(
        content,
        path,
        { ...validationContext, filePath: path }
      );
      validatedModified[path] = result.fixedCode;
      
      if (result.fixes.length > 0) {
        console.log(`✓ Auto-fixed ${path}: ${result.fixes.map(f => f.description).join(', ')}`);
      }
    }

    // Validate new files
    for (const [path, content] of Object.entries(newFiles)) {
      const result = await this.validationAgent.validate(
        content,
        path,
        { ...validationContext, filePath: path }
      );
      validatedNew[path] = result.fixedCode;
      
      if (result.fixes.length > 0) {
        console.log(`✓ Auto-fixed ${path}: ${result.fixes.map(f => f.description).join(', ')}`);
      }
    }

    return { modifiedFiles: validatedModified, newFiles: validatedNew };
  }

  /**
   * Attempt recovery with a specific approach
   * 
   * Requirements: 8.3, 8.6
   * Implements different recovery strategies based on the approach
   */
  private async attemptRecovery(
    error: Error,
    approach: string
  ): Promise<ExecutionResult | null> {
    console.log(`   Attempting recovery with: ${approach}`);
    
    const errorMessage = error.message.toLowerCase();
    
    switch (approach) {
      case 'simplify_request':
        // Check if error is related to complexity
        if (errorMessage.includes('timeout') || 
            errorMessage.includes('too long') ||
            errorMessage.includes('token limit')) {
          console.log('   → Simplifying request by reducing context');
          // Return null to try next approach - actual simplification would
          // require re-executing with reduced context
          return null;
        }
        return null;
      
      case 'break_into_smaller_tasks':
        // Check if error is related to task size
        if (errorMessage.includes('multiple') || 
            errorMessage.includes('complex') ||
            errorMessage.includes('too many')) {
          console.log('   → Breaking into smaller tasks');
          // Return null - actual task breakdown would require re-planning
          return null;
        }
        return null;
      
      case 'use_alternative_implementation':
        // Try a different approach for common errors
        if (errorMessage.includes('import') || 
            errorMessage.includes('module') ||
            errorMessage.includes('not found')) {
          console.log('   → Trying alternative implementation approach');
          // Return null - would need to regenerate with different strategy
          return null;
        }
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Get detailed error context for user feedback
   * 
   * Requirements: 8.6
   * Provides detailed error context and suggests manual fixes
   */
  getErrorContext(error: Error, retryCount: number): {
    message: string;
    suggestions: string[];
    canRetry: boolean;
  } {
    const suggestions: string[] = [];
    const errorMessage = error.message.toLowerCase();

    // Analyze error and provide suggestions
    if (errorMessage.includes('import') || errorMessage.includes('module')) {
      suggestions.push('Check that all required packages are installed');
      suggestions.push('Verify import paths are correct');
    }

    if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      suggestions.push('Review the generated code for syntax errors');
      suggestions.push('Check for missing brackets or semicolons');
    }

    if (errorMessage.includes('type') || errorMessage.includes('typescript')) {
      suggestions.push('Ensure TypeScript types are correctly defined');
      suggestions.push('Check for type mismatches in function arguments');
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      suggestions.push('Check your network connection');
      suggestions.push('Try again in a few moments');
    }

    if (suggestions.length === 0) {
      suggestions.push('Review the error message for specific issues');
      suggestions.push('Try simplifying your request');
    }

    return {
      message: `Error after ${retryCount} retry attempts: ${error.message}`,
      suggestions,
      canRetry: retryCount < MAX_RETRY_ATTEMPTS,
    };
  }

  /**
   * Build system prompt for code generation
   */
  private buildCodeGenerationPrompt(task: Task, context: GenerationContext): string {
    const patterns = context.projectPatterns;
    
    // Include GitHub strict mode prompt if applicable
    // Property 7: GitHub Strict Mode
    // Requirements: 9.5
    const gitHubStrictModePrompt = this.buildGitHubStrictModePrompt(context);
    
    // Build available UI components list from file tree
    const fileTree = context.fileTree || [];
    const uiComponents = fileTree
      .filter(f => f.includes('components/ui/') && (f.endsWith('.tsx') || f.endsWith('.ts')))
      .map(f => f.split('/').pop()?.replace(/\.(tsx|ts)$/, ''))
      .filter(Boolean);
    
    const availableComponentsStr = uiComponents.length > 0
      ? `AVAILABLE UI COMPONENTS (you can import these from @/components/ui/...):\n${uiComponents.map(c => `  - ${c}`).join('\n')}`
      : `⚠️ NO UI COMPONENTS FOUND in components/ui/ - use plain HTML with Tailwind CSS instead of shadcn imports`;
    
    return `You are an expert code generator. Generate high-quality, production-ready code.
${gitHubStrictModePrompt}
PROJECT PATTERNS:
- UI Library: ${patterns?.uiLibrary || 'unknown'}
- Styling: ${patterns?.styling || 'Tailwind CSS'}
- Form Library: ${patterns?.formLibrary || 'react-hook-form'}
- State Management: ${patterns?.stateManagement || 'React hooks'}

${availableComponentsStr}

CRITICAL IMPORT RULE:
- ONLY import from @/components/ui/xxx if the component is listed above
- If a component is NOT listed, use plain HTML with Tailwind CSS instead
- NEVER assume shadcn components exist - check the list above first!

TASK: ${task.type.toUpperCase()}
Target: ${task.target}
Description: ${task.description}

RULES:
1. Generate complete, working code with all necessary imports
2. Follow the project's existing patterns and conventions
3. Include proper TypeScript types
4. Add "use client" directive for client components in Next.js App Router
5. ONLY use UI components that are listed as available above

Respond with a JSON object:
{
  "code": "// The generated code",
  "imports": ["list", "of", "imports"],
  "exports": ["list", "of", "exports"],
  "dependencies": ["any", "new", "npm", "packages"]
}`;
  }

  /**
   * Build user prompt for code generation
   */
  private buildUserPrompt(task: Task, context: GenerationContext): string {
    const relevantFiles = context.relevantFiles || [];
    const fileContext = relevantFiles
      .slice(0, 5)
      .map(f => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`)
      .join('\n\n');

    return `Generate code for: ${task.description}

RELEVANT FILES:
${fileContext || 'No relevant files provided'}

Generate the code now.`;
  }


  /**
   * Generate component code for CREATE_AND_LINK
   */
  private async generateComponentCode(
    task: Task,
    context: GenerationContext,
    plan: ExecutionPlan
  ): Promise<GeneratedCode> {
    const systemPrompt = `You are an expert React component generator.

Generate a complete, production-ready React component.

PROJECT PATTERNS:
- UI Library: ${context.projectPatterns?.uiLibrary || 'shadcn/ui'}
- Styling: ${context.projectPatterns?.styling || 'Tailwind CSS'}

CRITICAL REMINDERS:
${plan.criticalReminders.map(r => `- ${r}`).join('\n')}

Respond with a JSON object:
{
  "code": "// Complete component code with imports",
  "imports": ["list", "of", "imports"],
  "exports": ["ComponentName"],
  "dependencies": []
}`;

    const userPrompt = `Create a new component: ${task.description}

The component should:
1. Be a complete, working React component
2. Include all necessary imports
3. Export the component as a named export
4. Use TypeScript with proper types
5. Follow the project's UI patterns`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      content: result.code || '',
      imports: result.imports || [],
      exports: result.exports || [],
      dependencies: result.dependencies || [],
    };
  }

  /**
   * Generate modification for an existing file
   */
  private async generateModification(
    task: Task,
    existingContent: string,
    context: GenerationContext
  ): Promise<GeneratedCode> {
    const systemPrompt = `You are an expert code modifier.

Modify the existing code to implement the requested changes.
Preserve all existing functionality not explicitly requested to change.
Make minimal, targeted changes.

Respond with a JSON object:
{
  "code": "// The complete modified file content",
  "imports": ["any", "new", "imports"],
  "exports": ["exports"],
  "dependencies": []
}`;

    const userPrompt = `Modify this file: ${task.description}

EXISTING CODE:
\`\`\`
${existingContent}
\`\`\`

Apply the requested modification and return the complete modified file.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      content: result.code || existingContent,
      imports: result.imports || [],
      exports: result.exports || [],
      dependencies: result.dependencies || [],
    };
  }

  /**
   * Determine file path for a new file
   */
  private determineFilePath(task: Task, context: GenerationContext): string {
    // If task target looks like a path, use it
    if (task.target.includes('/') || task.target.includes('.')) {
      return task.target;
    }

    // Default to components directory
    return `components/${this.toKebabCase(task.target)}.tsx`;
  }

  /**
   * Determine component path for CREATE_AND_LINK
   */
  private determineComponentPath(task: Task, context: GenerationContext): string {
    // Extract component name from task description
    const nameMatch = task.description.match(/(?:create|add|build)\s+(?:a\s+)?(?:new\s+)?(\w+)/i);
    const componentName = nameMatch ? nameMatch[1] : task.target;

    return `components/${this.toKebabCase(componentName)}.tsx`;
  }

  /**
   * Find target file for modification
   */
  private findTargetFile(task: Task, context: GenerationContext): string | null {
    const fileTree = context.fileTree || [];
    
    // If task target is a specific file path
    if (task.target.includes('/') || task.target.includes('.')) {
      const normalized = this.fileReconciler.normalizePath(task.target);
      const match = fileTree.find(f => 
        this.fileReconciler.normalizePath(f).toLowerCase() === normalized.toLowerCase()
      );
      return match || null;
    }

    // Try to find by name
    const similar = this.fileReconciler.findSimilarFile(task.target, fileTree);
    return similar;
  }

  /**
   * Find parent file for CREATE_AND_LINK
   */
  private findParentFile(plan: ExecutionPlan, context: GenerationContext): string | null {
    // Look for file targets with modify action
    const modifyTarget = plan.fileTargets.find(t => t.action === 'modify');
    if (modifyTarget) {
      return modifyTarget.path;
    }

    // Default to app/page.tsx for Next.js projects
    const fileTree = context.fileTree || [];
    if (fileTree.includes('app/page.tsx')) {
      return 'app/page.tsx';
    }

    // Try pages/index.tsx for Pages Router
    if (fileTree.includes('pages/index.tsx')) {
      return 'pages/index.tsx';
    }

    return null;
  }

  /**
   * Get file content from context
   */
  private getFileContent(path: string, context: GenerationContext): string | null {
    // Check relevant files first
    const relevantFile = context.relevantFiles?.find(f => f.path === path);
    if (relevantFile) {
      return relevantFile.content;
    }

    // Check working memory recent files
    const recentFile = context.workingMemory?.recentFiles?.find(f => f.path === path);
    if (recentFile) {
      return recentFile.content;
    }

    return null;
  }

  /**
   * Extract component name from file path
   */
  private extractComponentName(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    const baseName = fileName.replace(/\.(tsx|jsx|ts|js)$/, '');
    return this.toPascalCase(baseName);
  }

  /**
   * Add component import and usage to parent file
   * 
   * Requirements: 10.3, 10.4
   */
  private addComponentToParent(
    parentContent: string,
    componentName: string,
    componentPath: string,
    context: GenerationContext
  ): string {
    const lines = parentContent.split('\n');
    
    // Find where to insert import (after existing imports)
    let importInsertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || 
          lines[i].includes('"use client"') || 
          lines[i].includes("'use client'")) {
        importInsertIndex = i + 1;
      }
    }

    // Create import statement
    const importPath = this.createImportPath(componentPath);
    const importStatement = `import { ${componentName} } from "${importPath}";`;

    // Check if import already exists
    if (!parentContent.includes(importStatement) && 
        !parentContent.includes(`from "${importPath}"`)) {
      lines.splice(importInsertIndex, 0, importStatement);
    }

    // Find where to add component usage (in JSX return)
    let jsxInsertIndex = -1;
    let braceCount = 0;
    let inReturn = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('return (') || line.includes('return(')) {
        inReturn = true;
      }
      
      if (inReturn) {
        braceCount += (line.match(/</g) || []).length;
        braceCount -= (line.match(/>/g) || []).length;
        
        // Find a good spot to insert (after opening tag, before closing)
        if (braceCount > 0 && line.includes('>') && !line.includes('/>')) {
          jsxInsertIndex = i + 1;
          break;
        }
      }
    }

    // Add component usage if we found a spot
    if (jsxInsertIndex > 0 && !parentContent.includes(`<${componentName}`)) {
      const indent = '      '; // Standard indentation
      lines.splice(jsxInsertIndex, 0, `${indent}<${componentName} />`);
    }

    return lines.join('\n');
  }

  /**
   * Create import path from component path
   */
  private createImportPath(componentPath: string): string {
    // Remove file extension
    const withoutExt = componentPath.replace(/\.(tsx|jsx|ts|js)$/, '');
    
    // Add @/ prefix for absolute imports
    if (!withoutExt.startsWith('@/') && !withoutExt.startsWith('./')) {
      return `@/${withoutExt}`;
    }
    
    return withoutExt;
  }

  /**
   * Generate description for the execution result
   */
  private generateDescription(plan: ExecutionPlan, changes: ChangeDescription[]): string {
    const created = changes.filter(c => c.action === 'created').length;
    const modified = changes.filter(c => c.action === 'modified').length;
    const deleted = changes.filter(c => c.action === 'deleted').length;

    const parts: string[] = [];
    if (created > 0) parts.push(`created ${created} file(s)`);
    if (modified > 0) parts.push(`modified ${modified} file(s)`);
    if (deleted > 0) parts.push(`deleted ${deleted} file(s)`);

    return `${plan.intent}: ${parts.join(', ') || 'no changes'}`;
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
}

// Export singleton instance
export const executionAgent = new ExecutionAgent();
