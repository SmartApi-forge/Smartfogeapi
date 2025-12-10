import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DecisionResult {
  intent: 'CREATE' | 'MODIFY' | 'CREATE_AND_LINK' | 'FIX_ERROR' | 'QUESTION';
  confidence: number;
  summary: string;
  entities: {
    toCreate?: string[];
    toModify?: string[];
    toLink?: {
      source: string;
      target: string;
      parentFile: string;
    };
    errorFile?: string;
    errorType?: string;
    errorMessage?: string;
  };
  tasks: string[];
  criticalReminders: string[];
  fileTargets: {
    toCreate?: string[];
    toModify?: string[];
  };
  mode: 'create_mode' | 'modify_mode' | 'link_mode' | 'error_fix_mode' | 'question_mode';
}

/**
 * Decision Agent - Analyzes user requests and creates execution plans
 * IMPROVED: Better file targeting based on semantic analysis instead of keyword matching
 */
export class DecisionAgent {
  private static decisionPrompt: string | null = null;

  /**
   * Load decision agent prompt from file
   */
  private static getDecisionPrompt(): string {
    if (!this.decisionPrompt) {
      const promptPath = join(process.cwd(), 'src/prompts/decision-agent.txt');
      this.decisionPrompt = readFileSync(promptPath, 'utf-8');
    }
    return this.decisionPrompt;
  }

  /**
   * Analyze user request and create execution plan
   * IMPROVED: Better semantic analysis for file targeting
   */
  static async analyze(
    userPrompt: string,
    context: {
      conversationHistory?: Array<{ role: string; content: string }>;
      existingFiles?: string[];
      projectType?: string;
    } = {}
  ): Promise<DecisionResult> {
    const { conversationHistory = [], existingFiles = [], projectType = 'Next.js App Router' } = context;

    console.log('🤔 Decision Agent analyzing request...');
    console.log(`   User prompt: "${userPrompt}"`);

    try {
      // Build context for decision agent with IMPROVED file analysis
      const fileAnalysis = this.analyzeExistingFiles(existingFiles, userPrompt);
      
      const contextInfo = `
<context>
Project Type: ${projectType}

EXISTING FILES ANALYSIS:
Total files: ${existingFiles.length}
${fileAnalysis.summary}

Relevant existing files for this request:
${fileAnalysis.relevantFiles.slice(0, 15).map(f => `  - ${f.path} (${f.reason})`).join('\n') || '  None identified'}

Component files:
${fileAnalysis.componentFiles.slice(0, 10).join(', ') || 'None'}

Page files:
${fileAnalysis.pageFiles.slice(0, 10).join(', ') || 'None'}

Recent Conversation:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`).join('\n')}
</context>

CRITICAL FILE TARGETING RULES:
1. DO NOT target files just because their names match keywords in the prompt
2. Only modify files that SEMANTICALLY relate to the requested change
3. If the user asks for a NEW feature/component, CREATE a new file - do NOT inline in existing files
4. If a component needs to be created, it goes in components/ directory
5. If a page needs to be created, it goes in app/ directory
6. Only modify app/page.tsx if the user SPECIFICALLY asks to change the homepage
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getDecisionPrompt(),
          },
          {
            role: 'user',
            content: `${contextInfo}\n\nUser Request: ${userPrompt}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      // POST-PROCESS: Validate and fix file targets
      const validatedResult = this.validateFileTargets(result, existingFiles, userPrompt);

      console.log(`✓ Decision Agent classified as: ${validatedResult.intent} (${validatedResult.confidence}% confidence)`);
      console.log(`   Mode: ${validatedResult.mode}`);
      console.log(`   Tasks: ${validatedResult.tasks?.length || 0} steps`);
      console.log(`   Files to create: ${validatedResult.fileTargets?.toCreate?.join(', ') || 'None'}`);
      console.log(`   Files to modify: ${validatedResult.fileTargets?.toModify?.join(', ') || 'None'}`);

      return validatedResult as DecisionResult;
    } catch (error) {
      console.error('Decision Agent error:', error);
      return this.fallbackClassification(userPrompt, existingFiles);
    }
  }

  /**
   * NEW: Analyze existing files to understand project structure
   */
  private static analyzeExistingFiles(
    existingFiles: string[],
    userPrompt: string
  ): {
    summary: string;
    relevantFiles: Array<{ path: string; reason: string }>;
    componentFiles: string[];
    pageFiles: string[];
    apiFiles: string[];
    utilFiles: string[];
  } {
    const componentFiles = existingFiles.filter(f => 
      f.includes('components/') && (f.endsWith('.tsx') || f.endsWith('.jsx'))
    );
    const pageFiles = existingFiles.filter(f => 
      (f.includes('app/') && f.endsWith('page.tsx')) || 
      (f.includes('pages/') && !f.includes('api/'))
    );
    const apiFiles = existingFiles.filter(f => 
      f.includes('api/') && (f.endsWith('route.ts') || f.endsWith('.ts'))
    );
    const utilFiles = existingFiles.filter(f => 
      f.includes('lib/') || f.includes('utils/') || f.includes('hooks/')
    );

    // Find files relevant to the user's request
    const promptLower = userPrompt.toLowerCase();
    const relevantFiles: Array<{ path: string; reason: string }> = [];

    // Extract key concepts from prompt
    const concepts = this.extractConcepts(userPrompt);
    
    for (const file of existingFiles) {
      const fileName = file.split('/').pop()?.toLowerCase() || '';
      const fileDir = file.split('/').slice(0, -1).join('/').toLowerCase();
      
      // Check if file is semantically related (not just keyword matching)
      for (const concept of concepts) {
        if (fileName.includes(concept.toLowerCase()) || 
            fileDir.includes(concept.toLowerCase())) {
          relevantFiles.push({
            path: file,
            reason: `Contains concept: ${concept}`,
          });
          break;
        }
      }
    }

    return {
      summary: `Components: ${componentFiles.length}, Pages: ${pageFiles.length}, APIs: ${apiFiles.length}, Utils: ${utilFiles.length}`,
      relevantFiles,
      componentFiles,
      pageFiles,
      apiFiles,
      utilFiles,
    };
  }

  /**
   * NEW: Extract semantic concepts from user prompt
   */
  private static extractConcepts(prompt: string): string[] {
    const concepts: string[] = [];
    
    // Extract noun phrases that could be component/feature names
    const words = prompt.split(/\s+/);
    const actionWords = ['create', 'add', 'make', 'build', 'implement', 'update', 'modify', 'change', 'fix'];
    const skipWords = ['a', 'an', 'the', 'to', 'in', 'on', 'for', 'with', 'and', 'or', 'that', 'this', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can'];
    
    let inAction = false;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (actionWords.includes(word)) {
        inAction = true;
        continue;
      }
      
      if (inAction && !skipWords.includes(word) && word.length > 2) {
        concepts.push(word);
        // Also check for compound terms
        if (i + 1 < words.length) {
          const nextWord = words[i + 1].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!skipWords.includes(nextWord) && nextWord.length > 2) {
            concepts.push(`${word}${nextWord}`);
          }
        }
      }
    }

    return concepts;
  }

  /**
   * NEW: Validate and fix file targets to prevent wrong file modification
   */
  private static validateFileTargets(
    result: any,
    existingFiles: string[],
    userPrompt: string
  ): any {
    const validated = { ...result };
    const promptLower = userPrompt.toLowerCase();

    // Rule 1: If creating a new component/feature, ensure it's in fileTargets.toCreate
    const isCreatingNew = promptLower.includes('create') || 
                          promptLower.includes('add') || 
                          promptLower.includes('new');
    
    const isModifyingExisting = promptLower.includes('update') || 
                                promptLower.includes('modify') || 
                                promptLower.includes('change') ||
                                promptLower.includes('fix');

    // Rule 2: Don't modify app/page.tsx unless explicitly requested
    if (validated.fileTargets?.toModify) {
      const filtered = validated.fileTargets.toModify.filter((file: string) => {
        const isHomePage = file === 'app/page.tsx' || file.endsWith('/app/page.tsx');
        
        if (isHomePage) {
          // Only allow if prompt specifically mentions homepage or main page
          const mentionsHome = promptLower.includes('homepage') || 
                              promptLower.includes('main page') ||
                              promptLower.includes('landing page') ||
                              (promptLower.includes('page') && promptLower.includes('home'));
          
          if (!mentionsHome) {
            console.log(`   ⚠️ Removing app/page.tsx from targets (not specifically mentioned)`);
            return false;
          }
        }
        return true;
      });
      
      validated.fileTargets.toModify = filtered;
    }

    // Rule 3: If intent is CREATE or CREATE_AND_LINK, ensure toCreate has proper paths
    if ((result.intent === 'CREATE' || result.intent === 'CREATE_AND_LINK') && 
        (!validated.fileTargets?.toCreate || validated.fileTargets.toCreate.length === 0)) {
      
      // Try to infer what to create from the prompt
      const componentMatch = promptLower.match(/(?:create|add|build|make)\s+(?:a\s+)?(?:new\s+)?(\w+)\s*(?:component|dialog|modal|form|page|section)?/i);
      
      if (componentMatch) {
        const componentName = componentMatch[1];
        if (!['a', 'an', 'the', 'new'].includes(componentName)) {
          const kebabName = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          
          // Determine if it's a page or component
          if (promptLower.includes('page')) {
            validated.fileTargets = validated.fileTargets || {};
            validated.fileTargets.toCreate = [`app/${kebabName}/page.tsx`];
          } else {
            validated.fileTargets = validated.fileTargets || {};
            validated.fileTargets.toCreate = [`components/${kebabName}.tsx`];
          }
          
          console.log(`   ✓ Inferred component to create: ${validated.fileTargets.toCreate[0]}`);
        }
      }
    }

    // Rule 4: If CREATE_AND_LINK, ensure we have both create and modify targets
    if (result.intent === 'CREATE_AND_LINK') {
      // Find the parent file to link to
      if (!validated.fileTargets?.toModify || validated.fileTargets.toModify.length === 0) {
        // Look for header, nav, or layout files
        const linkTargets = existingFiles.filter(f => 
          f.includes('header') || 
          f.includes('nav') || 
          f.includes('layout') ||
          f === 'app/page.tsx'
        );
        
        if (linkTargets.length > 0) {
          validated.fileTargets = validated.fileTargets || {};
          validated.fileTargets.toModify = [linkTargets[0]];
          console.log(`   ✓ Inferred link target: ${linkTargets[0]}`);
        }
      }
    }

    return validated;
  }

  /**
   * Fallback classification when AI fails - IMPROVED with file analysis
   */
  private static fallbackClassification(userPrompt: string, existingFiles: string[] = []): DecisionResult {
    const lowerPrompt = userPrompt.toLowerCase();

    // Check for linking keywords
    if (lowerPrompt.includes('link') || lowerPrompt.includes('connect') || lowerPrompt.includes('and')) {
      const hasCreate = lowerPrompt.includes('create') || lowerPrompt.includes('add') || lowerPrompt.includes('build');
      
      if (hasCreate) {
        // Extract what to create
        const componentMatch = lowerPrompt.match(/(?:create|add|build)\s+(?:a\s+)?(?:new\s+)?(\w+)/i);
        const componentName = componentMatch ? componentMatch[1] : 'component';
        const kebabName = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        
        return {
          intent: 'CREATE_AND_LINK',
          confidence: 0.7,
          summary: `Create ${componentName} component and link to existing element`,
          entities: {
            toCreate: [`components/${kebabName}.tsx`],
          },
          tasks: [
            `1. Create new component file: components/${kebabName}.tsx`,
            '2. Find the target element to link to',
            '3. Modify parent component to import and use new component',
          ],
          criticalReminders: [
            '🚨 This is a CREATE + LINK task - do NOT only create!',
            '🚨 CREATE a separate component file - do NOT inline the code',
            '🚨 MUST modify parent component to link',
          ],
          fileTargets: {
            toCreate: [`components/${kebabName}.tsx`],
            toModify: existingFiles.filter(f => f.includes('header') || f.includes('nav') || f === 'app/page.tsx').slice(0, 1),
          },
          mode: 'link_mode',
        };
      }
    }

    // Check for error indicators
    if (lowerPrompt.includes('error') || lowerPrompt.includes('fix') || lowerPrompt.includes('bug')) {
      // Try to extract the error file
      const fileMatch = lowerPrompt.match(/in\s+(\w+\.tsx?)/i) || lowerPrompt.match(/(\w+\.tsx?)/i);
      const errorFile = fileMatch ? fileMatch[1] : undefined;
      
      return {
        intent: 'FIX_ERROR',
        confidence: 0.8,
        summary: 'Fix error in existing code',
        entities: {
          errorFile,
        },
        tasks: [
          '1. Locate the error in the specified file',
          '2. Identify root cause',
          '3. Apply minimal fix',
        ],
        criticalReminders: [
          '🚨 ONLY fix the error - do NOT add features',
          '🚨 Make minimal changes',
        ],
        fileTargets: {
          toModify: errorFile ? [errorFile] : [],
        },
        mode: 'error_fix_mode',
      };
    }

    // Check for question indicators
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];
    const isQuestion = questionWords.some(word => lowerPrompt.includes(word)) || userPrompt.includes('?');
    
    if (isQuestion) {
      return {
        intent: 'QUESTION',
        confidence: 0.8,
        summary: 'Answer user question',
        entities: {},
        tasks: [],
        criticalReminders: ['🚨 Do NOT modify any files - just answer the question'],
        fileTargets: {},
        mode: 'question_mode',
      };
    }

    // Check for modify keywords
    const modifyWords = ['update', 'change', 'modify', 'edit', 'refactor'];
    if (modifyWords.some(word => lowerPrompt.includes(word))) {
      return {
        intent: 'MODIFY',
        confidence: 0.7,
        summary: 'Modify existing code',
        entities: {},
        tasks: [
          '1. Find the file to modify',
          '2. Apply requested changes',
          '3. Preserve existing functionality',
        ],
        criticalReminders: [
          '🚨 MODIFY existing files - do NOT create new ones',
          '🚨 Preserve all other functionality',
        ],
        fileTargets: {},
        mode: 'modify_mode',
      };
    }

    // Default to CREATE with proper file target
    const componentMatch = lowerPrompt.match(/(?:create|add|build|make)\s+(?:a\s+)?(?:new\s+)?(\w+)/i);
    const componentName = componentMatch ? componentMatch[1] : 'feature';
    const kebabName = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    
    return {
      intent: 'CREATE',
      confidence: 0.6,
      summary: `Create new ${componentName}`,
      entities: {
        toCreate: [`components/${kebabName}.tsx`],
      },
      tasks: [
        `1. Create the new component: components/${kebabName}.tsx`,
        '2. Include all necessary code and imports',
        '3. Follow project patterns',
      ],
      criticalReminders: [
        '🚨 CREATE a new file - do NOT modify existing files unless necessary',
        '🚨 Create complete, working code',
      ],
      fileTargets: {
        toCreate: [`components/${kebabName}.tsx`],
      },
      mode: 'create_mode',
    };
  }
}