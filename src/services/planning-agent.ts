/**
 * PlanningAgent Service
 * 
 * Analyzes user intent and creates structured execution plans.
 * This is an enhanced version of the DecisionAgent with better
 * task breakdown and dependency management.
 * 
 * Requirements: 8.1, 8.2, 8.5
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  Intent,
  Task,
  TaskType,
  FileTarget,
  Dependency,
  ExecutionPlan,
  GenerationContext,
  IPlanningAgent,
} from '../types/context-management';

// Lazy-load OpenAI client to allow tests to run without API key
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Intent classification patterns for rule-based fallback
 */
const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  CREATE: [
    /\b(create|build|make|add|generate|new)\b.*\b(component|page|file|feature|module)\b/i,
    /\b(implement|develop|write)\b.*\b(new|a|an)\b/i,
  ],
  MODIFY: [
    /\b(update|change|modify|edit|improve)\b.*\b(existing|current|the)\b/i,
    /\b(add|remove|replace)\b.*\b(to|from|in)\b.*\b(existing|current)\b/i,
  ],
  CREATE_AND_LINK: [
    /\b(create|add|build)\b.*\b(and|then)\b.*\b(link|connect|add|use|import)\b/i,
    /\b(create|add)\b.*\b(component|module)\b.*\b(in|to|for)\b/i,
    /\b(new)\b.*\b(component|module)\b.*\b(and|then)\b.*\b(add|use|import)\b/i,
  ],
  FIX_ERROR: [
    /\b(fix|resolve|debug|solve|repair)\b.*\b(error|bug|issue|problem|crash)\b/i,
    /\b(error|bug|issue|problem)\b.*\b(fix|resolve|debug|solve)\b/i,
    /\b(not working|broken|failing|crashed)\b/i,
    /^fix:/i,  // Matches "Fix: ..." format
    /\bfix\b.*\b(it|this|that)\b/i,  // Matches "fix it", "fix this"
  ],
  QUESTION: [
    /^(what|why|when|where|which|who|can you explain|explain|tell me)\b/i,
    /\b(understand|clarify|describe|help me understand)\b/i,
  ],
  REFACTOR: [
    /\b(refactor|restructure|reorganize|clean up|optimize|simplify)\b/i,
    /\b(extract|split)\b.*\b(component|function|module|into)\b/i,
    /\b(merge|combine)\b.*\b(duplicate|similar|utility|function|handler)\b/i,
  ],
  API_GENERATE: [
    /\b(api|endpoint|backend|server)\b.*\b(create|generate|add|build)\b/i,
    /\b(create|generate|add|build)\b.*\b(api|endpoint|backend)\b/i,
    /\b(rest|graphql|trpc)\b.*\b(api|endpoint)\b/i,
  ],
};

/**
 * Critical reminders for each intent type
 */
const INTENT_REMINDERS: Record<Intent, string[]> = {
  CREATE: [
    '🚨 Create complete, working code with all necessary imports',
    '🚨 Follow project patterns and conventions',
    '🚨 Include proper TypeScript types',
  ],
  MODIFY: [
    '🚨 MODIFY existing files - do NOT create new ones unless necessary',
    '🚨 Preserve all existing functionality not explicitly requested to change',
    '🚨 Make minimal, targeted changes',
  ],
  CREATE_AND_LINK: [
    '🚨 This is a CREATE + LINK task - do NOT only create!',
    '🚨 MUST create the component file AND modify parent to import/use it',
    '🚨 Add import statement at correct location in parent file',
    '🚨 Add JSX usage in appropriate render location',
  ],
  FIX_ERROR: [
    '🚨 ONLY fix the error - do NOT add features or refactor',
    '🚨 Make minimal changes to resolve the issue',
    '🚨 Preserve all existing functionality',
  ],
  QUESTION: [
    '🚨 Do NOT modify any files - just answer the question',
    '🚨 Provide clear, helpful explanation',
  ],
  REFACTOR: [
    '🚨 Preserve all existing functionality',
    '🚨 Update all affected imports and references',
    '🚨 Maintain type safety throughout',
  ],
  API_GENERATE: [
    '🚨 Generate API routes in correct directory (app/api/ or pages/api/)',
    '🚨 Include proper error handling and validation',
    '🚨 Follow project patterns for API responses',
    '🚨 Include TypeScript types for request/response',
  ],
};

/**
 * PlanningAgent - Analyzes user intent and creates execution plans
 * 
 * Implements IPlanningAgent interface from context-management types.
 */
export class PlanningAgent implements IPlanningAgent {
  private static decisionPrompt: string | null = null;

  /**
   * Load decision agent prompt from file
   */
  private static getDecisionPrompt(): string {
    if (!this.decisionPrompt) {
      try {
        const promptPath = join(process.cwd(), 'src/prompts/decision-agent.txt');
        this.decisionPrompt = readFileSync(promptPath, 'utf-8');
      } catch {
        // Fallback prompt if file doesn't exist
        this.decisionPrompt = `You are a planning agent that analyzes user requests and creates execution plans.
Analyze the user's request and return a JSON object with:
- intent: One of CREATE, MODIFY, CREATE_AND_LINK, FIX_ERROR, QUESTION, REFACTOR, API_GENERATE
- confidence: A number from 0 to 100 indicating confidence in the classification
- summary: A brief summary of what the user wants
- tasks: An array of task descriptions
- fileTargets: Object with toCreate and toModify arrays of file paths`;
      }
    }
    return this.decisionPrompt;
  }

  /**
   * Analyze user prompt and create an execution plan
   * 
   * Requirements: 8.1
   */
  async analyze(prompt: string, context: GenerationContext): Promise<ExecutionPlan> {
    console.log('🤔 PlanningAgent analyzing request...');
    console.log(`   User prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

    // First, classify the intent
    const intent = this.classifyIntent(prompt);
    console.log(`   Classified intent: ${intent}`);

    // Try AI-based analysis for better task breakdown
    let aiResult: Partial<ExecutionPlan> | null = null;
    try {
      aiResult = await this.analyzeWithAI(prompt, context, intent);
    } catch (error) {
      console.warn('AI analysis failed, using rule-based fallback:', error);
    }

    // Create task breakdown
    const tasks = this.createTaskBreakdown(intent, context);

    // Merge AI results with rule-based results
    const fileTargets = this.identifyFileTargets(prompt, context, intent);
    const dependencies = this.buildDependencies(tasks);
    const criticalReminders = INTENT_REMINDERS[intent] || [];

    const plan: ExecutionPlan = {
      intent,
      confidence: aiResult?.confidence ?? this.calculateConfidence(prompt, intent),
      tasks: aiResult?.tasks?.length ? aiResult.tasks : tasks,
      fileTargets: aiResult?.fileTargets?.length ? aiResult.fileTargets : fileTargets,
      criticalReminders: [...criticalReminders, ...(aiResult?.criticalReminders || [])],
      dependencies: aiResult?.dependencies?.length ? aiResult.dependencies : dependencies,
    };

    console.log(`✓ PlanningAgent created plan: ${plan.intent} (${plan.confidence}% confidence)`);
    console.log(`   Tasks: ${plan.tasks.length} steps`);
    console.log(`   File targets: ${plan.fileTargets.length}`);

    return plan;
  }

  /**
   * Classify the intent of a user prompt
   * 
   * Requirements: 8.1
   */
  classifyIntent(prompt: string): Intent {
    const lowerPrompt = prompt.toLowerCase();
    const isQuestion = prompt.trim().endsWith('?');

    // Check patterns in order of specificity (most specific first)
    
    // 1. If it's a question (ends with ?), check QUESTION first
    if (isQuestion && this.matchesPatterns(prompt, INTENT_PATTERNS.QUESTION)) {
      return 'QUESTION';
    }

    // 2. Check for CREATE_AND_LINK (most specific action)
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.CREATE_AND_LINK)) {
      return 'CREATE_AND_LINK';
    }

    // 3. Check for FIX_ERROR
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.FIX_ERROR)) {
      return 'FIX_ERROR';
    }

    // 4. Check for REFACTOR (before MODIFY since "refactor" is more specific)
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.REFACTOR)) {
      return 'REFACTOR';
    }

    // 5. Check for API_GENERATE
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.API_GENERATE)) {
      return 'API_GENERATE';
    }

    // 6. Check for QUESTION (non-question-mark patterns)
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.QUESTION)) {
      return 'QUESTION';
    }

    // 7. Check for MODIFY
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.MODIFY)) {
      return 'MODIFY';
    }

    // 8. Check for CREATE
    if (this.matchesPatterns(prompt, INTENT_PATTERNS.CREATE)) {
      return 'CREATE';
    }

    // 9. Default heuristics
    // If prompt mentions existing files, likely MODIFY
    if (lowerPrompt.includes('existing') || lowerPrompt.includes('current')) {
      return 'MODIFY';
    }

    // If prompt is a question
    if (isQuestion) {
      return 'QUESTION';
    }

    // Default to CREATE for new feature requests
    return 'CREATE';
  }

  /**
   * Create a task breakdown for the given intent
   * 
   * Requirements: 8.2, 8.5
   */
  createTaskBreakdown(intent: Intent, context: GenerationContext): Task[] {
    const tasks: Task[] = [];
    let taskId = 1;

    const createTask = (
      type: TaskType,
      target: string,
      description: string,
      deps: string[] = []
    ): Task => ({
      id: `task-${taskId++}`,
      type,
      target,
      description,
      dependencies: deps,
    });

    switch (intent) {
      case 'CREATE':
        tasks.push(createTask('create', 'new-component', 'Create the requested component/feature'));
        tasks.push(createTask('modify', 'imports', 'Add necessary imports', ['task-1']));
        break;

      case 'MODIFY':
        tasks.push(createTask('modify', 'target-file', 'Locate and modify the target file'));
        tasks.push(createTask('modify', 'related-files', 'Update any related files if needed', ['task-1']));
        break;

      case 'CREATE_AND_LINK':
        tasks.push(createTask('create', 'new-component', 'Create the new component file'));
        tasks.push(createTask('modify', 'parent-file', 'Add import statement to parent file', ['task-1']));
        tasks.push(createTask('link', 'parent-file', 'Add component usage in parent render', ['task-2']));
        break;

      case 'FIX_ERROR':
        tasks.push(createTask('modify', 'error-file', 'Locate the error in the specified file'));
        tasks.push(createTask('modify', 'error-file', 'Apply minimal fix to resolve the error', ['task-1']));
        break;

      case 'QUESTION':
        // No file tasks for questions
        break;

      case 'REFACTOR':
        tasks.push(createTask('modify', 'target-files', 'Identify all files affected by refactoring'));
        tasks.push(createTask('modify', 'target-files', 'Apply refactoring changes', ['task-1']));
        tasks.push(createTask('modify', 'imports', 'Update all import statements', ['task-2']));
        break;

      case 'API_GENERATE':
        tasks.push(createTask('create', 'api-route', 'Create API route file'));
        tasks.push(createTask('create', 'types', 'Create TypeScript types for request/response', ['task-1']));
        tasks.push(createTask('create', 'client-hook', 'Create client-side fetch function or hook', ['task-1']));
        break;
    }

    // Add context-specific tasks based on project patterns
    if (context.projectPatterns) {
      if (context.projectPatterns.formLibrary === 'react-hook-form' && 
          (intent === 'CREATE' || intent === 'CREATE_AND_LINK')) {
        tasks.push(createTask('modify', 'form-setup', 'Set up react-hook-form with proper validation'));
      }
    }

    return tasks;
  }

  /**
   * Check if prompt matches any of the given patterns
   */
  private matchesPatterns(prompt: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(prompt));
  }

  /**
   * Calculate confidence score for intent classification
   */
  private calculateConfidence(prompt: string, intent: Intent): number {
    const patterns = INTENT_PATTERNS[intent];
    if (!patterns) return 50;

    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        matchCount++;
      }
    }

    // Base confidence + bonus for multiple pattern matches
    const baseConfidence = 60;
    const matchBonus = Math.min(matchCount * 15, 35);
    
    return Math.min(baseConfidence + matchBonus, 95);
  }

  /**
   * Identify file targets based on prompt and context
   */
  private identifyFileTargets(
    prompt: string,
    context: GenerationContext,
    intent: Intent
  ): FileTarget[] {
    const targets: FileTarget[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Extract file references from prompt
    const filePatterns = [
      /`([^`]+\.(tsx?|jsx?|css|json))`/g,  // Backtick quoted
      /"([^"]+\.(tsx?|jsx?|css|json))"/g,   // Double quoted
      /'([^']+\.(tsx?|jsx?|css|json))'/g,   // Single quoted
      /\b(\w+[-\w]*\.(tsx?|jsx?|css|json))\b/g, // Bare file names
    ];

    const mentionedFiles = new Set<string>();
    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        mentionedFiles.add(match[1]);
      }
    }

    // Match mentioned files to existing files
    const existingFiles = context.fileTree || [];
    for (const mentioned of mentionedFiles) {
      const matchingFile = existingFiles.find(f => 
        f.endsWith(mentioned) || f.includes(mentioned)
      );

      if (matchingFile) {
        targets.push({
          path: matchingFile,
          action: intent === 'CREATE' ? 'create' : 'modify',
          reason: `Explicitly mentioned in prompt`,
        });
      }
    }

    // Add targets based on intent
    if (intent === 'CREATE' || intent === 'CREATE_AND_LINK') {
      // Try to infer new file path from prompt - multiple patterns
      const componentPatterns = [
        /(?:create|add|build)\s+(?:a\s+)?(?:new\s+)?(\w+)\s+(?:component|page)/i,
        /(?:create|add|build)\s+(?:a\s+)?(?:new\s+)?(\w+)(?:\s+component)?/i,
      ];
      
      for (const pattern of componentPatterns) {
        const componentMatch = prompt.match(pattern);
        if (componentMatch && componentMatch[1]) {
          const componentName = componentMatch[1];
          // Skip common words that aren't component names
          if (!['a', 'an', 'the', 'new', 'api', 'endpoint'].includes(componentName.toLowerCase())) {
            targets.push({
              path: `components/${this.toKebabCase(componentName)}.tsx`,
              action: 'create',
              reason: `New component inferred from prompt`,
            });
            break; // Only add one target
          }
        }
      }
    }

    if (intent === 'API_GENERATE') {
      // Infer API route path
      const apiMatch = prompt.match(/(?:api|endpoint)\s+(?:for\s+)?(\w+)/i);
      if (apiMatch) {
        const routeName = apiMatch[1];
        targets.push({
          path: `app/api/${this.toKebabCase(routeName)}/route.ts`,
          action: 'create',
          reason: `API route inferred from prompt`,
        });
      }
    }

    return targets;
  }

  /**
   * Build dependency graph for tasks
   */
  private buildDependencies(tasks: Task[]): Dependency[] {
    return tasks
      .filter(task => task.dependencies.length > 0)
      .map(task => ({
        taskId: task.id,
        dependsOn: task.dependencies,
      }));
  }

  /**
   * Convert PascalCase or camelCase to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }

  /**
   * Use AI for more sophisticated analysis
   */
  private async analyzeWithAI(
    prompt: string,
    context: GenerationContext,
    classifiedIntent: Intent
  ): Promise<Partial<ExecutionPlan> | null> {
    try {
      const existingFiles = context.fileTree || [];
      const recentMessages = context.workingMemory?.conversationHistory?.slice(-3) || [];

      const contextInfo = `
<context>
Project Patterns:
- UI Library: ${context.projectPatterns?.uiLibrary || 'unknown'}
- Styling: ${context.projectPatterns?.styling || 'unknown'}
- Form Library: ${context.projectPatterns?.formLibrary || 'unknown'}
- State Management: ${context.projectPatterns?.stateManagement || 'unknown'}

Existing Files (${existingFiles.length} total):
${existingFiles.slice(0, 30).join('\n')}
${existingFiles.length > 30 ? `... and ${existingFiles.length - 30} more files` : ''}

Recent Conversation:
${recentMessages.map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`).join('\n')}

Pre-classified Intent: ${classifiedIntent}
</context>
`;

      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: PlanningAgent.getDecisionPrompt(),
          },
          {
            role: 'user',
            content: `${contextInfo}\n\nUser Request: ${prompt}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      // Convert AI result to ExecutionPlan format
      return {
        confidence: result.confidence || 70,
        tasks: this.convertAITasks(result.tasks || []),
        fileTargets: this.convertAIFileTargets(result.fileTargets || {}),
        criticalReminders: result.criticalReminders || [],
      };
    } catch (error) {
      console.warn('AI analysis error:', error);
      return null;
    }
  }

  /**
   * Convert AI task strings to Task objects
   */
  private convertAITasks(aiTasks: string[]): Task[] {
    return aiTasks.map((description, index) => ({
      id: `task-${index + 1}`,
      type: this.inferTaskType(description),
      target: this.inferTaskTarget(description),
      description,
      dependencies: index > 0 ? [`task-${index}`] : [],
    }));
  }

  /**
   * Infer task type from description
   */
  private inferTaskType(description: string): TaskType {
    const lower = description.toLowerCase();
    if (lower.includes('create') || lower.includes('add new') || lower.includes('generate')) {
      return 'create';
    }
    if (lower.includes('delete') || lower.includes('remove')) {
      return 'delete';
    }
    if (lower.includes('link') || lower.includes('connect') || lower.includes('import')) {
      return 'link';
    }
    return 'modify';
  }

  /**
   * Infer task target from description
   */
  private inferTaskTarget(description: string): string {
    // Try to extract file path or component name
    const fileMatch = description.match(/`([^`]+)`/) || 
                      description.match(/"([^"]+)"/) ||
                      description.match(/(\w+\.(tsx?|jsx?|css|json))/);
    if (fileMatch) {
      return fileMatch[1];
    }
    return 'target';
  }

  /**
   * Convert AI file targets to FileTarget objects
   */
  private convertAIFileTargets(aiTargets: { toCreate?: string[]; toModify?: string[] }): FileTarget[] {
    const targets: FileTarget[] = [];

    if (aiTargets.toCreate) {
      for (const path of aiTargets.toCreate) {
        targets.push({
          path,
          action: 'create',
          reason: 'Identified by AI analysis',
        });
      }
    }

    if (aiTargets.toModify) {
      for (const path of aiTargets.toModify) {
        targets.push({
          path,
          action: 'modify',
          reason: 'Identified by AI analysis',
        });
      }
    }

    return targets;
  }
}

// Export singleton instance for convenience
export const planningAgent = new PlanningAgent();
