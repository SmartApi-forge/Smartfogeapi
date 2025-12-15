import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * PromptLoader Service
 * 
 * Simplified for V0/Lovable architecture - uses unified system prompt
 * instead of multiple mode-specific prompts.
 */
export class PromptLoader {
  private static cache: Map<string, string> = new Map();

  private static loadPromptFile(path: string): string {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    const fullPath = join(process.cwd(), 'src/prompts', path);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      this.cache.set(path, content);
      return content;
    } catch (error) {
      console.warn(`[PromptLoader] Could not load prompt file: ${path}`);
      return '';
    }
  }

  /**
   * Load the unified system prompt
   * This is the primary method for the V0/Lovable architecture
   */
  static loadUnifiedPrompt(): string {
    return this.loadPromptFile('system-prompt.txt');
  }

  /**
   * Build coding prompt - simplified for V0/Lovable architecture
   * Now uses unified system prompt instead of mode-specific prompts
   * 
   * @deprecated Use loadUnifiedPrompt() instead
   */
  static buildCodingPrompt(
    mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode',
    options: {
      includeFrameworkRules?: boolean;
      includeExamples?: boolean;
    } = {}
  ): string {
    // For backward compatibility, return unified prompt with mode hint
    const unifiedPrompt = this.loadUnifiedPrompt();
    
    // Add mode-specific hint
    const modeHint = this.getModeHint(mode);
    
    return `${unifiedPrompt}\n\n${modeHint}`;
  }

  /**
   * Get a hint for the specific mode
   */
  private static getModeHint(mode: string): string {
    const hints: Record<string, string> = {
      'create_mode': 'MODE: Creating new files. Focus on generating complete, new code.',
      'modify_mode': 'MODE: Modifying existing files. Use partial edit patterns.',
      'link_mode': 'MODE: Creating and linking components. Create new files and update imports.',
      'error_fix_mode': 'MODE: Fixing errors. Make minimal changes to resolve the issue.',
      'question_mode': 'MODE: Answering questions. Provide clear explanations without code changes.',
    };
    return hints[mode] || '';
  }

  /**
   * Build system prompt with context
   * Simplified for V0/Lovable architecture
   * 
   * @deprecated Use loadUnifiedPrompt() with custom context instead
   */
  static buildSystemPrompt(
    mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode',
    decisionResult: {
      tasks: string[];
      criticalReminders: string[];
      summary: string;
      intent?: string;
      fileTargets?: {
        toCreate?: string[];
        toModify?: string[];
      };
    },
    context: {
      projectType?: string;
      framework?: string;
      uiLibrary?: string;
      relevantFiles?: string[];
    } = {}
  ): string {
    const { projectType = 'Next.js', framework = 'Next.js App Router', uiLibrary = 'shadcn/ui', relevantFiles = [] } = context;

    // Use unified prompt as base
    const basePrompt = this.loadUnifiedPrompt();
    const modeHint = this.getModeHint(mode);

    // Build simplified context section
    const contextSection = `
═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Summary: ${decisionResult.summary}
Framework: ${framework}
UI Library: ${uiLibrary}
Relevant Files: ${relevantFiles.length > 0 ? relevantFiles.slice(0, 10).join(', ') : 'None provided'}

${modeHint}

Tasks:
${decisionResult.tasks.map((task) => `- ${task}`).join('\n')}

${decisionResult.criticalReminders.length > 0 ? `Reminders:\n${decisionResult.criticalReminders.join('\n')}` : ''}
═══════════════════════════════════════════════════════════════════════════════
`;

    return `${basePrompt}\n\n${contextSection}`;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}