import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Prompt Loader Service
 * Loads and combines modular prompt files
 */
export class PromptLoader {
  private static cache: Map<string, string> = new Map();

  /**
   * Load a prompt file from disk (with caching)
   */
  private static loadPromptFile(path: string): string {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    const fullPath = join(process.cwd(), 'src/prompts', path);
    const content = readFileSync(fullPath, 'utf-8');
    this.cache.set(path, content);
    return content;
  }

  /**
   * Build coding agent prompt based on mode
   */
  static buildCodingPrompt(
    mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode',
    options: {
      includeFrameworkRules?: boolean;
      includeExamples?: boolean;
    } = {}
  ): string {
    const { includeFrameworkRules = true, includeExamples = false } = options;

    // Always include base rules
    const baseRules = this.loadPromptFile('coding-agent/base-rules.txt');

    // Load mode-specific rules
    const modeRules = this.loadPromptFile(`coding-agent/${mode}.txt`);

    // Optionally load shared rules
    let sharedRules = '';
    if (includeFrameworkRules) {
      // Framework rules are already in base-rules.txt
    }

    // Combine prompts
    const combinedPrompt = `
${baseRules}

═══════════════════════════════════════════════════════════════════════════════
MODE-SPECIFIC INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

${modeRules}

═══════════════════════════════════════════════════════════════════════════════
`;

    return combinedPrompt.trim();
  }

  /**
   * Build complete system prompt with context
   */
  static buildSystemPrompt(
    mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode',
    decisionResult: {
      tasks: string[];
      criticalReminders: string[];
      summary: string;
    },
    context: {
      projectType?: string;
      framework?: string;
      uiLibrary?: string;
      relevantFiles?: string[];
    } = {}
  ): string {
    const { projectType = 'Next.js', framework = 'Next.js App Router', uiLibrary = 'shadcn/ui', relevantFiles = [] } = context;

    const modePrompt = this.buildCodingPrompt(mode);

    const executionPlan = `
═══════════════════════════════════════════════════════════════════════════════
EXECUTION PLAN FROM DECISION AGENT
═══════════════════════════════════════════════════════════════════════════════

Summary: ${decisionResult.summary}

Tasks to Complete:
${decisionResult.tasks.map((task, i) => `${task}`).join('\n')}

Critical Reminders:
${decisionResult.criticalReminders.join('\n')}

Project Context:
- Type: ${projectType}
- Framework: ${framework}
- UI Library: ${uiLibrary}
- Relevant Files: ${relevantFiles.length > 0 ? relevantFiles.slice(0, 10).join(', ') : 'None provided'}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

Follow the execution plan above step-by-step. Complete ALL tasks listed.

${mode === 'link_mode' ? `
🚨 CRITICAL FOR LINKING TASKS:
This is a CREATE + LINK task. You MUST:
1. Create the new component
2. Find the parent component
3. MODIFY the parent component to import and use the new component
4. Add state management if needed
5. Wire up event handlers

DO NOT only create the component - you MUST also modify the parent!
` : ''}

${mode === 'error_fix_mode' ? `
🚨 CRITICAL FOR ERROR FIXING:
This is an ERROR FIX task. You MUST:
1. ONLY fix the error mentioned
2. Make minimal changes
3. DO NOT create new files or add features
4. Return ONLY the fixed file
` : ''}

${mode === 'question_mode' ? `
🚨 CRITICAL FOR QUESTIONS:
This is a QUESTION. You MUST:
1. Provide a clear, accurate answer
2. DO NOT modify any files
3. Base answer on the code context provided
4. Cite specific files when explaining
` : ''}

Now proceed with the implementation.

═══════════════════════════════════════════════════════════════════════════════
`;

    return `${modePrompt}\n\n${executionPlan}`;
  }

  /**
   * Clear prompt cache (useful for development/testing)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
