import { readFileSync } from 'fs';
import { join } from 'path';

export class PromptLoader {
  private static cache: Map<string, string> = new Map();

  private static loadPromptFile(path: string): string {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    const fullPath = join(process.cwd(), 'src/prompts', path);
    const content = readFileSync(fullPath, 'utf-8');
    this.cache.set(path, content);
    return content;
  }

  static buildCodingPrompt(
    mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode',
    options: {
      includeFrameworkRules?: boolean;
      includeExamples?: boolean;
    } = {}
  ): string {
    const { includeFrameworkRules = true, includeExamples = false } = options;

    const baseRules = this.loadPromptFile('coding-agent/base-rules.txt');
    const modeRules = this.loadPromptFile(`coding-agent/${mode}.txt`);

    let sharedRules = '';
    if (includeFrameworkRules) {
    }

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

    const modePrompt = this.buildCodingPrompt(mode);

    const fileTargetGuidance = this.buildFileTargetGuidance(mode, decisionResult);

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

${fileTargetGuidance}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

Follow the execution plan above step-by-step. Complete ALL tasks listed.

${mode === 'create_mode' ? `
🚨 CRITICAL FOR CREATE TASKS:
This is a CREATE task. You MUST:
1. CREATE new file(s) in the "newFiles" object
2. DO NOT put new code in "modifiedFiles" unless you're linking to existing code
3. New components go in: components/ directory
4. New pages go in: app/{page-name}/page.tsx
5. DO NOT inline new component code into app/page.tsx

WRONG: Adding new component code directly to app/page.tsx
RIGHT: Creating components/my-component.tsx with the new component
` : ''}

${mode === 'link_mode' ? `
🚨 CRITICAL FOR LINKING TASKS:
This is a CREATE + LINK task. You MUST:
1. Create the new component in "newFiles"
2. Find the parent component
3. MODIFY the parent component to import and use the new component
4. Add state management if needed
5. Wire up event handlers

DO NOT only create the component - you MUST also modify the parent!
` : ''}

${mode === 'modify_mode' ? `
🚨 CRITICAL FOR MODIFY TASKS:
This is a MODIFY task. You MUST:
1. ONLY modify existing files - put changes in "modifiedFiles"
2. DO NOT create new files - "newFiles" should be empty {}
3. Preserve ALL existing code that isn't being changed
4. Only change what was specifically requested
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

  private static buildFileTargetGuidance(
    mode: string,
    decisionResult: {
      intent?: string;
      fileTargets?: {
        toCreate?: string[];
        toModify?: string[];
      };
    }
  ): string {
    const { intent, fileTargets } = decisionResult;
    
    let guidance = `
═══════════════════════════════════════════════════════════════════════════════
FILE TARGETING GUIDANCE (FROM DECISION AGENT)
═══════════════════════════════════════════════════════════════════════════════

Intent: ${intent || 'Not specified'}

`;

    if (fileTargets?.toCreate && fileTargets.toCreate.length > 0) {
      guidance += `Files to CREATE (put in "newFiles" object):
${fileTargets.toCreate.map(f => `  ✅ ${f}`).join('\n')}

`;
    }

    if (fileTargets?.toModify && fileTargets.toModify.length > 0) {
      guidance += `Files to MODIFY (put in "modifiedFiles" object):
${fileTargets.toModify.map(f => `  📝 ${f}`).join('\n')}

`;
    }

    guidance += `
⚠️ IMPORTANT FILE TARGETING RULES:
1. DO NOT modify files just because their name matches keywords in the prompt
2. If creating a new feature/component, CREATE a new file - do NOT inline
3. Only modify app/page.tsx if explicitly requested for the homepage
4. Follow the file paths suggested above by the Decision Agent
`;

    return guidance;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}