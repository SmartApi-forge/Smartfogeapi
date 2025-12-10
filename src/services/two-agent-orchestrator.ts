import OpenAI from 'openai';
import { DecisionAgent, DecisionResult } from './decision-agent';
import { PromptLoader } from './prompt-loader';
import { SmartContextBuilder, SmartGenerationContext } from './smart-context-builder';
import { CodeValidator } from './code-validator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TwoAgentResult {
  modifiedFiles: Record<string, string>;
  newFiles: Record<string, string>;
  deletedFiles: string[];
  changes: Array<{ file: string; description: string }>;
  description: string;
  isAnswer?: boolean;
  answer?: string;
}

export class TwoAgentOrchestrator {
  
  static async execute(
    userPrompt: string,
    context: SmartGenerationContext,
    options: {
      projectId: string;
      versionId?: string;
      isGitHubProject?: boolean;
      repoFullName?: string;
      onProgress?: (stage: string, message: string) => Promise<void>;
    }
  ): Promise<TwoAgentResult> {
    const { projectId, versionId, isGitHubProject = false, repoFullName, onProgress } = options;

    if (onProgress) await onProgress('Planning', 'Analyzing your request...');
    
    console.log('🤖 Stage 1: Decision Agent analyzing request...');
    
    const decisionResult = await DecisionAgent.analyze(userPrompt, {
      conversationHistory: context.conversationHistory,
      existingFiles: Object.keys(context.previousFiles || {}),
      projectType: this.detectProjectType(context),
    });

    console.log(`✓ Decision Agent classified as: ${decisionResult.intent} (mode: ${decisionResult.mode})`);
    console.log(`  Tasks: ${decisionResult.tasks.length} steps`);
    console.log(`  Critical reminders: ${decisionResult.criticalReminders.length}`);

    if (decisionResult.mode === 'question_mode') {
      if (onProgress) await onProgress('Answering', 'Generating answer...');
      return await this.answerQuestion(userPrompt, context, decisionResult);
    }

    if (onProgress) await onProgress('Generating', 'Creating code changes...');
    return await this.generateCode(userPrompt, context, decisionResult, options);
  }

  private static async answerQuestion(
    userPrompt: string,
    context: SmartGenerationContext,
    decisionResult: DecisionResult
  ): Promise<TwoAgentResult> {
    const systemPrompt = PromptLoader.buildSystemPrompt(
      'question_mode',
      decisionResult,
      {
        projectType: this.detectProjectType(context),
        relevantFiles: Object.keys(context.relevantFiles || {}),
      }
    );

    const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, userPrompt);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      modifiedFiles: {},
      newFiles: {},
      deletedFiles: [],
      changes: [],
      description: result.description || 'Answered question',
      isAnswer: true,
      answer: result.answer || 'Unable to generate answer',
    };
  }

  private static async generateCode(
    userPrompt: string,
    context: SmartGenerationContext,
    decisionResult: DecisionResult,
    options: {
      projectId: string;
      versionId?: string;
      isGitHubProject?: boolean;
      repoFullName?: string;
      onProgress?: (stage: string, message: string) => Promise<void>;
    }
  ): Promise<TwoAgentResult> {
    const { isGitHubProject = false, repoFullName, onProgress } = options;

    const patterns = this.analyzeProjectPatterns(context);
    const framework = this.detectFramework(context);
    
    let systemPrompt = PromptLoader.buildSystemPrompt(
      decisionResult.mode,
      decisionResult,
      {
        projectType: this.detectProjectType(context),
        framework,
        uiLibrary: patterns.uiLibrary,
        relevantFiles: Object.keys(context.relevantFiles || {}),
      }
    );

    if (isGitHubProject) {
      systemPrompt = `${systemPrompt}

═══════════════════════════════════════════════════════════════════════════════
🚨 GITHUB PROJECT - ULTRA STRICT MODE
═══════════════════════════════════════════════════════════════════════════════

This is a CLONED GitHub project (${repoFullName}).

CRITICAL RULES:
1. You are ABSOLUTELY FORBIDDEN from creating new files unless explicitly requested
2. ONLY modify existing files listed in the relevant files section
3. The "newFiles" object MUST be empty {} unless user explicitly says "create new file X"
4. Creating new files will BREAK the user's application

IF YOU CREATE A NEW FILE INSTEAD OF MODIFYING EXISTING ONES, YOU HAVE FAILED.
`;
    }

    const relevantFilePaths = Object.keys(context.relevantFiles || {});
    const allExistingFilePaths = Object.keys(context.previousFiles || {});
    
    const uiComponents = allExistingFilePaths
      .filter(f => f.includes('components/ui/') && (f.endsWith('.tsx') || f.endsWith('.ts')))
      .map(f => f.split('/').pop()?.replace(/\.(tsx|ts)$/, ''))
      .filter(Boolean);
    
    const availableComponentsStr = uiComponents.length > 0
      ? `AVAILABLE UI COMPONENTS (you can import these from @/components/ui/...):\n${uiComponents.map(c => `  - ${c}`).join('\n')}`
      : `⚠️ NO UI COMPONENTS FOUND in components/ui/ - use plain HTML with Tailwind CSS instead of shadcn imports`;

    const fileTargetingRules = this.buildFileTargetingRules(decisionResult, allExistingFilePaths, userPrompt);
    
    const contextAdditions = `

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Relevant Files (Priority targets for modification):
${relevantFilePaths.length > 0 ? relevantFilePaths.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'None identified'}

All Existing Files (${allExistingFilePaths.length} total):
${allExistingFilePaths.slice(0, 30).join('\n')}
${allExistingFilePaths.length > 30 ? `... and ${allExistingFilePaths.length - 30} more files` : ''}

${availableComponentsStr}

${fileTargetingRules}

Project Patterns:
- UI Library: ${patterns.uiLibrary}
- Styling: ${patterns.styling}
- Forms: ${patterns.formLibrary}
- State Management: ${patterns.stateManagement}
- Common Components: ${patterns.commonComponents.slice(0, 5).join(', ')}

Import Patterns (Follow these):
${patterns.importPatterns.slice(0, 3).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
`;

    systemPrompt += contextAdditions;

    const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, userPrompt);

    console.log('🤖 Stage 2: Coding Agent generating code...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const rawResult = JSON.parse(completion.choices[0].message.content || '{}');
    
    const validatedResult = this.postProcessResult(rawResult, decisionResult, allExistingFilePaths, userPrompt);

    console.log(`✓ Coding Agent generated:`);
    console.log(`  - Modified files: ${Object.keys(validatedResult.modifiedFiles || {}).length}`);
    console.log(`  - New files: ${Object.keys(validatedResult.newFiles || {}).length}`);

    return {
      modifiedFiles: validatedResult.modifiedFiles || {},
      newFiles: validatedResult.newFiles || {},
      deletedFiles: validatedResult.deletedFiles || [],
      changes: validatedResult.changes || [],
      description: validatedResult.description || 'Code changes generated',
    };
  }

  private static buildFileTargetingRules(
    decisionResult: DecisionResult,
    existingFiles: string[],
    userPrompt: string
  ): string {
    const promptLower = userPrompt.toLowerCase();
    
    let rules = `
═══════════════════════════════════════════════════════════════════════════════
🎯 FILE TARGETING RULES (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════════════════════

`;
    
    if (decisionResult.intent === 'CREATE' || decisionResult.intent === 'CREATE_AND_LINK') {
      const componentFiles = existingFiles.filter(f => f.includes('components/'));
      const pageFiles = existingFiles.filter(f => f.includes('app/') && f.endsWith('page.tsx'));
      
      rules += `INTENT: ${decisionResult.intent} - You MUST create new files!

🚨 CRITICAL CREATE RULES:
1. CREATE NEW FILE(S) in the "newFiles" object - do NOT put new code in "modifiedFiles"
2. New components go in: components/ directory
3. New pages go in: app/{page-name}/page.tsx
4. DO NOT inline new component code into app/page.tsx or other existing files

Suggested file targets from Decision Agent:
- Files to CREATE: ${decisionResult.fileTargets?.toCreate?.join(', ') || 'Determine from prompt'}
- Files to MODIFY (for linking only): ${decisionResult.fileTargets?.toModify?.join(', ') || 'Only if linking needed'}

Existing component files (for reference, NOT for inlining new code):
${componentFiles.slice(0, 10).join('\n') || 'None'}

`;
    } else if (decisionResult.intent === 'MODIFY') {
      rules += `INTENT: MODIFY - You should ONLY modify existing files!

🚨 CRITICAL MODIFY RULES:
1. ONLY edit files listed in "Relevant Files" section above
2. DO NOT create new files - put changes in "modifiedFiles" only
3. "newFiles" should be empty {}
4. Preserve ALL existing code that isn't being changed

Files you CAN modify:
${decisionResult.fileTargets?.toModify?.join('\n') || 'Files from Relevant Files section'}

`;
    } else if (decisionResult.intent === 'FIX_ERROR') {
      rules += `INTENT: FIX_ERROR - Minimal changes only!

🚨 CRITICAL ERROR FIX RULES:
1. ONLY modify the file with the error
2. Make MINIMAL changes to fix the issue
3. DO NOT add new features or refactor
4. DO NOT create new files

Target file: ${decisionResult.entities?.errorFile || 'See error message'}

`;
    }
    
    rules += `
═══════════════════════════════════════════════════════════════════════════════
⚠️ KEYWORD MATCHING WARNING
═══════════════════════════════════════════════════════════════════════════════

DO NOT modify files just because their names match keywords in the prompt!

Examples of WRONG behavior:
- Prompt says "create a pricing page" → DO NOT modify app/page.tsx just because it contains "page"
- Prompt says "add authentication" → DO NOT modify app/page.tsx just because it's a page
- Prompt says "create user profile component" → DO NOT modify components/header.tsx just because it's a component

CORRECT behavior:
- "create a pricing page" → CREATE new file: app/pricing/page.tsx
- "add authentication" → CREATE new file: components/auth-dialog.tsx (or modify specific auth file if exists)
- "create user profile component" → CREATE new file: components/user-profile.tsx

Only modify app/page.tsx if the user EXPLICITLY says:
- "modify the homepage"
- "change the main page"
- "update the landing page"
- "add X to the homepage"

═══════════════════════════════════════════════════════════════════════════════
`;
    
    return rules;
  }

  private static postProcessResult(
    result: any,
    decisionResult: DecisionResult,
    existingFiles: string[],
    userPrompt: string
  ): any {
    const validated = { ...result };
    const promptLower = userPrompt.toLowerCase();
    
    if (decisionResult.intent === 'CREATE' || decisionResult.intent === 'CREATE_AND_LINK') {
      if (validated.modifiedFiles && Object.keys(validated.modifiedFiles).length > 0) {
        const homePage = validated.modifiedFiles['app/page.tsx'];
        if (homePage && !promptLower.includes('homepage') && !promptLower.includes('main page') && !promptLower.includes('landing page')) {
          const originalHomePage = existingFiles.includes('app/page.tsx');
          if (originalHomePage) {
            console.log('⚠️ Post-processing: Removing app/page.tsx modification (not explicitly requested)');
            delete validated.modifiedFiles['app/page.tsx'];
          }
        }
      }
      
      if (!validated.newFiles || Object.keys(validated.newFiles).length === 0) {
        console.log('⚠️ Warning: CREATE intent but no new files generated');
      }
    }
    
    if (decisionResult.intent === 'MODIFY' || decisionResult.intent === 'FIX_ERROR') {
      if (validated.newFiles && Object.keys(validated.newFiles).length > 0) {
        console.log('⚠️ Post-processing: Clearing newFiles for MODIFY/FIX_ERROR intent');
        validated.newFiles = {};
      }
    }
    
    return validated;
  }

  private static detectProjectType(context: SmartGenerationContext): string {
    const files = Object.keys(context.previousFiles || {});
    
    if (files.some(f => f.includes('app/') && f.endsWith('page.tsx'))) {
      return 'Next.js App Router';
    }
    if (files.some(f => f.includes('pages/') && f.endsWith('.tsx'))) {
      return 'Next.js Pages Router';
    }
    if (files.some(f => f.includes('src/App.tsx') || f.includes('src/main.tsx'))) {
      return 'React with Vite';
    }
    
    return 'Next.js App Router';
  }

  private static detectFramework(context: SmartGenerationContext): string {
    const packageJson = context.previousFiles?.['package.json'];
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        if (pkg.dependencies?.next) return 'Next.js';
        if (pkg.dependencies?.react) return 'React';
        if (pkg.dependencies?.vue) return 'Vue';
      } catch (e) {}
    }
    return 'Next.js';
  }

  private static analyzeProjectPatterns(context: SmartGenerationContext): {
    uiLibrary: string;
    styling: string;
    formLibrary: string;
    stateManagement: string;
    commonComponents: string[];
    importPatterns: string[];
  } {
    const files = context.previousFiles || {};
    const fileContents = Object.values(files).join('\n');
    
    let uiLibrary = 'None detected';
    if (fileContents.includes('@/components/ui/')) uiLibrary = 'shadcn/ui';
    else if (fileContents.includes('@chakra-ui')) uiLibrary = 'Chakra UI';
    else if (fileContents.includes('@mui/material')) uiLibrary = 'Material UI';
    
    let styling = 'Tailwind CSS';
    if (fileContents.includes('styled-components')) styling = 'styled-components';
    else if (fileContents.includes('@emotion')) styling = 'Emotion';
    
    let formLibrary = 'None detected';
    if (fileContents.includes('react-hook-form')) formLibrary = 'react-hook-form';
    else if (fileContents.includes('formik')) formLibrary = 'Formik';
    
    let stateManagement = 'React useState';
    if (fileContents.includes('zustand')) stateManagement = 'Zustand';
    else if (fileContents.includes('redux')) stateManagement = 'Redux';
    else if (fileContents.includes('jotai')) stateManagement = 'Jotai';
    
    const componentFiles = Object.keys(files).filter(f => f.includes('components/'));
    const commonComponents = componentFiles
      .map(f => f.split('/').pop()?.replace(/\.(tsx|ts)$/, ''))
      .filter(Boolean) as string[];
    
    const importPatterns: string[] = [];
    const importRegex = /^import .+ from ['"](.+)['"];?$/gm;
    let match;
    const sampleFile = Object.values(files)[0] || '';
    while ((match = importRegex.exec(sampleFile)) !== null) {
      if (importPatterns.length < 5) {
        importPatterns.push(match[0]);
      }
    }
    
    return {
      uiLibrary,
      styling,
      formLibrary,
      stateManagement,
      commonComponents,
      importPatterns,
    };
  }
}
