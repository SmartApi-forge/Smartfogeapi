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
      // Build context for decision agent
      const contextInfo = `
<context>
Project Type: ${projectType}
Existing Files: ${existingFiles.length > 0 ? existingFiles.slice(0, 20).join(', ') : 'New project (no files yet)'}
${existingFiles.length > 20 ? `... and ${existingFiles.length - 20} more files` : ''}

Recent Conversation:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`).join('\n')}
</context>
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cheap for classification
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
        temperature: 0.3, // Lower temperature for consistent classification
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      console.log(`✓ Decision Agent classified as: ${result.intent} (${result.confidence}% confidence)`);
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Tasks: ${result.tasks?.length || 0} steps`);

      return result as DecisionResult;
    } catch (error) {
      console.error('Decision Agent error:', error);
      
      // Fallback classification
      return this.fallbackClassification(userPrompt);
    }
  }

  /**
   * Fallback classification when AI fails
   */
  private static fallbackClassification(userPrompt: string): DecisionResult {
    const lowerPrompt = userPrompt.toLowerCase();

    // Check for linking keywords
    if (lowerPrompt.includes('link') || lowerPrompt.includes('connect') || lowerPrompt.includes('and')) {
      const hasCreate = lowerPrompt.includes('create') || lowerPrompt.includes('add') || lowerPrompt.includes('build');
      
      if (hasCreate) {
        return {
          intent: 'CREATE_AND_LINK',
          confidence: 0.7,
          summary: 'Create component and link to existing element',
          entities: {},
          tasks: [
            '1. Create the requested component',
            '2. Find the target element to link to',
            '3. Modify parent component to import and use new component',
          ],
          criticalReminders: [
            '🚨 This is a CREATE + LINK task - do NOT only create!',
            '🚨 MUST modify parent component to link',
          ],
          fileTargets: {},
          mode: 'link_mode',
        };
      }
    }

    // Check for error indicators
    if (lowerPrompt.includes('error') || lowerPrompt.includes('fix') || lowerPrompt.includes('bug')) {
      return {
        intent: 'FIX_ERROR',
        confidence: 0.8,
        summary: 'Fix error in existing code',
        entities: {},
        tasks: [
          '1. Locate the error in the specified file',
          '2. Identify root cause',
          '3. Apply minimal fix',
        ],
        criticalReminders: [
          '🚨 ONLY fix the error - do NOT add features',
          '🚨 Make minimal changes',
        ],
        fileTargets: {},
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

    // Default to CREATE
    return {
      intent: 'CREATE',
      confidence: 0.6,
      summary: 'Create new component or feature',
      entities: {},
      tasks: [
        '1. Create the requested component/feature',
        '2. Include all necessary code and imports',
        '3. Follow project patterns',
      ],
      criticalReminders: ['🚨 Create complete, working code'],
      fileTargets: {},
      mode: 'create_mode',
    };
  }
}
