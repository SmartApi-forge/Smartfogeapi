/**
 * ModeHandler Service (Simplified for V0/Lovable Architecture)
 * 
 * Handles Ask/Code mode switching and mode-specific response generation.
 * Preserves conversation history across mode switches.
 * 
 * Simplified from complex orchestration to direct streaming approach.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.6, 10.2
 * - Display mode toggle with Ask and Code options
 * - Ask mode: conversational responses without code modifications
 * - Code mode: code modifications with file changes using ```lang file="path" format
 * - Preserve conversation history on mode switch
 */

import OpenAI from 'openai';
import type {
  ChatMode,
  ChatMessage,
  ChatStreamEvent,
  GenerationContext,
  Attachment,
  AskModeResponse,
  CodeModeResponse,
} from '../types/chat-ux';
import {
  buildMessageContentWithAttachments,
  summarizeAttachments,
} from './attachment-context-integration';

// Lazy-load OpenAI client to allow tests to run without API key
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Stream event types for mode-specific responses
 */
export interface FileGeneratingEvent {
  type: 'file:generating';
  filePath: string;
  timestamp: number;
}

export interface CodeChunkEvent {
  type: 'code:chunk';
  filePath: string;
  content: string;
  timestamp: number;
}

export interface FileCompleteEvent {
  type: 'file:complete';
  filePath: string;
  content: string;
  timestamp: number;
}

export type ModeStreamEvent = ChatStreamEvent | FileGeneratingEvent | CodeChunkEvent | FileCompleteEvent;


/**
 * ModeHandler class implementation (Simplified)
 * 
 * Manages chat mode state and generates mode-specific responses.
 * Removed complex orchestration - now uses direct streaming.
 * 
 * Property 1: Mode-Specific Response Type
 * - Ask mode responses contain only text content without file modifications
 * - Code mode responses contain file modifications
 * 
 * Property 3: Conversation History Preservation
 * - Mode switch operations preserve conversation history length
 */
export class ModeHandler {
  private currentMode: ChatMode = 'code';
  private conversationHistory: ChatMessage[] = [];

  constructor(initialMode: ChatMode = 'code') {
    this.currentMode = initialMode;
  }

  /**
   * Set the current chat mode
   * Requirements: 1.1
   * 
   * Property 3: Conversation History Preservation
   * Mode switch preserves conversation history length
   */
  setMode(mode: ChatMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    console.log(`[ModeHandler] Mode switched from ${previousMode} to ${mode}`);
  }

  /**
   * Get the current chat mode
   * Requirements: 1.1
   */
  getMode(): ChatMode {
    return this.currentMode;
  }

  /**
   * Get the current conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Get the conversation history length
   * Used for Property 3 validation
   */
  getConversationHistoryLength(): number {
    return this.conversationHistory.length;
  }

  /**
   * Add a message to conversation history
   */
  addToHistory(message: ChatMessage): void {
    this.conversationHistory.push(message);
  }

  /**
   * Set conversation history (for initialization)
   */
  setConversationHistory(history: ChatMessage[]): void {
    this.conversationHistory = [...history];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Generate a response based on the current mode
   * 
   * Requirements: 1.2, 1.3, 1.4, 1.5
   * - Ask mode: conversational responses, stream text events
   * - Code mode: code modifications using ```lang file="path" format
   * 
   * Property 1: Mode-Specific Response Type
   * Property 2: Mode-Specific Streaming Events
   */
  async *generateResponse(
    prompt: string,
    context: GenerationContext
  ): AsyncGenerator<ModeStreamEvent> {
    if (this.currentMode === 'ask') {
      yield* this.generateAskModeResponse(prompt, context);
    } else {
      yield* this.generateCodeModeResponse(prompt, context);
    }
  }

  /**
   * Generate Ask mode response
   * 
   * Requirements: 1.2, 1.4, 5.8
   * - Generate conversational responses without code modifications
   * - Stream text events directly to chat
   * 
   * Property 1: Ask mode responses contain only text content
   * Property 2: Ask mode emits text streaming events
   */
  private async *generateAskModeResponse(
    prompt: string,
    context: GenerationContext
  ): AsyncGenerator<ModeStreamEvent> {
    const systemPrompt = this.buildAskModeSystemPrompt(context);
    const attachments = context.attachments || [];
    const messages = this.buildConversationMessages(prompt, systemPrompt, attachments);

    const hasImageAttachments = attachments.some(a => a.type === 'image');
    const model = hasImageAttachments ? 'gpt-4o' : 'gpt-4o';

    try {
      const stream = await getOpenAIClient().chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield {
            type: 'text:chunk',
            content,
            timestamp: Date.now(),
          };
        }
      }
    } catch (error) {
      console.error('[ModeHandler] Ask mode generation error:', error);
      yield {
        type: 'text:chunk',
        content: `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generate Code mode response (Simplified for V0/Lovable Architecture)
   * 
   * Requirements: 1.3, 1.5, 5.8, 16.6
   * - Generate code modifications using ```lang file="path/to/file" format
   * - Stream file:generating and code:chunk events
   * - No JSON response format - uses code block format directly
   * 
   * Property 1: Code mode responses contain file modifications
   * Property 2: Code mode emits file:generating and code:chunk events
   */
  private async *generateCodeModeResponse(
    prompt: string,
    context: GenerationContext
  ): AsyncGenerator<ModeStreamEvent> {
    const systemPrompt = this.buildCodeModeSystemPrompt(context);
    const attachments = context.attachments || [];
    const messages = this.buildConversationMessages(prompt, systemPrompt, attachments);

    const hasImageAttachments = attachments.some(a => a.type === 'image');
    const model = hasImageAttachments ? 'gpt-4o' : 'gpt-4o';

    try {
      const stream = await getOpenAIClient().chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: 0.7,
      });

      let accumulatedContent = '';
      let currentFile: string | null = null;
      let currentFileContent = '';
      let inCodeBlock = false;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          accumulatedContent += content;

          // Parse streaming content for code blocks with file="path" format
          // Format: ```language file="path/to/file"
          const codeBlockStartMatch = accumulatedContent.match(/```(\w+)\s+file="([^"]+)"\n/);
          
          if (codeBlockStartMatch && !inCodeBlock) {
            const filePath = codeBlockStartMatch[2];
            if (filePath !== currentFile) {
              // Complete previous file if exists
              if (currentFile && currentFileContent) {
                yield {
                  type: 'file:complete',
                  filePath: currentFile,
                  content: currentFileContent.trim(),
                  timestamp: Date.now(),
                };
              }
              
              currentFile = filePath;
              currentFileContent = '';
              inCodeBlock = true;
              
              yield {
                type: 'file:generating',
                filePath: currentFile,
                timestamp: Date.now(),
              };
              
              // Remove the matched header from accumulated content
              accumulatedContent = accumulatedContent.slice(codeBlockStartMatch.index! + codeBlockStartMatch[0].length);
            }
          }

          // Check for code block end
          if (inCodeBlock && accumulatedContent.includes('```')) {
            const endIndex = accumulatedContent.indexOf('```');
            const codeContent = accumulatedContent.slice(0, endIndex);
            currentFileContent += codeContent;
            
            if (currentFile) {
              yield {
                type: 'file:complete',
                filePath: currentFile,
                content: currentFileContent.trim(),
                timestamp: Date.now(),
              };
            }
            
            inCodeBlock = false;
            currentFile = null;
            currentFileContent = '';
            accumulatedContent = accumulatedContent.slice(endIndex + 3);
          } else if (inCodeBlock && currentFile) {
            // Stream code chunks while in code block
            currentFileContent += content;
            yield {
              type: 'code:chunk',
              filePath: currentFile,
              content,
              timestamp: Date.now(),
            };
          } else if (!inCodeBlock) {
            // Stream text content outside code blocks
            yield {
              type: 'text:chunk',
              content,
              timestamp: Date.now(),
            };
          }
        }
      }

      // Handle any remaining file content
      if (currentFile && currentFileContent) {
        yield {
          type: 'file:complete',
          filePath: currentFile,
          content: currentFileContent.trim(),
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error('[ModeHandler] Code mode generation error:', error);
      yield {
        type: 'text:chunk',
        content: `Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build system prompt for Ask mode
   */
  private buildAskModeSystemPrompt(context: GenerationContext): string {
    const contextInfo = context.contextSources
      .map(s => `- ${s.type}: ${s.path || 'N/A'}`)
      .join('\n');

    const attachmentInfo = context.attachments && context.attachments.length > 0
      ? `\n\nAttachments provided:\n${context.attachments.map(a => `- ${a.name} (${a.type})`).join('\n')}`
      : '';

    return `You are a helpful AI assistant in Ask mode. Provide conversational responses to help developers understand concepts, explain code, and answer questions.

IMPORTANT: You are in ASK MODE. Do NOT generate code modifications or file changes. Only provide explanations and answers.

Project Context:
${contextInfo || 'No specific context available'}${attachmentInfo}

Guidelines:
- Provide clear, concise explanations
- Use code examples only for illustration (not as file modifications)
- Reference relevant files from the project when helpful
- Be conversational and helpful`;
  }

  /**
   * Build system prompt for Code mode (V0/Lovable style)
   * 
   * Requirements: 16.6 - Use ```lang file="path/to/file" format
   */
  private buildCodeModeSystemPrompt(context: GenerationContext): string {
    const contextInfo = context.contextSources
      .map(s => `- ${s.type}: ${s.path || 'N/A'}`)
      .join('\n');

    const attachmentInfo = context.attachments && context.attachments.length > 0
      ? `\n\nAttachments provided:\n${context.attachments.map(a => `- ${a.name} (${a.type})`).join('\n')}`
      : '';

    return `You are an AI code generation assistant in Code mode. Generate code modifications and new files based on user requests.

IMPORTANT: You are in CODE MODE. Generate actual code modifications and file changes.

Project Context:
${contextInfo || 'No specific context available'}${attachmentInfo}

## Code Block Format
Use this format for all file modifications:
\`\`\`language file="path/to/file"
// file content here
\`\`\`

Example:
\`\`\`typescript file="src/components/Button.tsx"
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="btn">{children}</button>;
}
\`\`\`

## Editing Existing Files
When editing existing files, use \`// ... existing code ...\` to indicate unchanged sections:
\`\`\`typescript file="src/App.tsx"
// ... existing code ...
// <CHANGE> Added new import
import { Button } from './components/Button';
// ... existing code ...
\`\`\`

Guidelines:
- Generate complete, working code
- Follow existing project patterns
- Include all necessary imports
- Ensure type safety for TypeScript files
- Write a brief 2-4 sentence summary after code changes`;
  }

  /**
   * Build conversation messages for OpenAI API
   */
  private buildConversationMessages(
    prompt: string,
    systemPrompt: string,
    attachments: Attachment[] = []
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of this.conversationHistory) {
      if (msg.attachments && msg.attachments.length > 0) {
        const contentWithAttachments = buildMessageContentWithAttachments(
          msg.content,
          msg.attachments
        );
        if (msg.role === 'user') {
          messages.push({
            role: 'user',
            content: contentWithAttachments as OpenAI.Chat.ChatCompletionContentPart[],
          });
        } else {
          messages.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      } else {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Add current prompt with attachments
    if (attachments && attachments.length > 0) {
      console.log(`[ModeHandler] Processing attachments: ${summarizeAttachments(attachments)}`);
      const contentWithAttachments = buildMessageContentWithAttachments(prompt, attachments);
      messages.push({
        role: 'user',
        content: contentWithAttachments as OpenAI.Chat.ChatCompletionContentPart[],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    return messages;
  }

  /**
   * Parse a complete response into structured format
   * 
   * Property 1: Mode-Specific Response Type validation helper
   */
  parseResponse(content: string, mode: ChatMode): AskModeResponse | CodeModeResponse {
    if (mode === 'ask') {
      return {
        type: 'text',
        content,
        sources: [],
      };
    }

    // Parse code blocks from content
    const modifiedFiles: Record<string, string> = {};
    const newFiles: Record<string, string> = {};
    
    // Match code blocks with file="path" format
    const codeBlockRegex = /```(\w+)\s+file="([^"]+)"\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const filePath = match[2];
      const fileContent = match[3].trim();
      
      // Determine if it's a new file or modification based on content
      if (fileContent.includes('// ... existing code ...')) {
        modifiedFiles[filePath] = fileContent;
      } else {
        newFiles[filePath] = fileContent;
      }
    }

    return {
      type: 'code',
      modifiedFiles,
      newFiles,
      deletedFiles: [],
      description: this.extractDescription(content),
    };
  }

  /**
   * Extract description from response (text outside code blocks)
   */
  private extractDescription(content: string): string {
    // Remove code blocks and get remaining text
    const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '').trim();
    // Take first paragraph or first 200 chars
    const firstParagraph = withoutCodeBlocks.split('\n\n')[0] || '';
    return firstParagraph.slice(0, 200);
  }

  /**
   * Validate that a response matches the expected mode type
   * 
   * Property 1: Mode-Specific Response Type
   */
  validateResponseType(
    response: AskModeResponse | CodeModeResponse,
    expectedMode: ChatMode
  ): boolean {
    if (expectedMode === 'ask') {
      if (response.type !== 'text') return false;
      const askResponse = response as AskModeResponse;
      return typeof askResponse.content === 'string';
    } else {
      if (response.type !== 'code') return false;
      const codeResponse = response as CodeModeResponse;
      return (
        typeof codeResponse.modifiedFiles === 'object' &&
        typeof codeResponse.newFiles === 'object' &&
        Array.isArray(codeResponse.deletedFiles)
      );
    }
  }
}

/**
 * Factory function to create a ModeHandler instance
 */
export function createModeHandler(initialMode: ChatMode = 'code'): ModeHandler {
  return new ModeHandler(initialMode);
}

/**
 * Check if a response contains file modifications
 * Helper for Property 1 validation
 */
export function hasFileModifications(response: AskModeResponse | CodeModeResponse): boolean {
  if (response.type === 'text') return false;
  const codeResponse = response as CodeModeResponse;
  return (
    Object.keys(codeResponse.modifiedFiles).length > 0 ||
    Object.keys(codeResponse.newFiles).length > 0 ||
    codeResponse.deletedFiles.length > 0
  );
}

/**
 * Check if a stream event is a text event (Ask mode)
 */
export function isTextStreamEvent(event: ModeStreamEvent): boolean {
  return event.type === 'text:chunk';
}

/**
 * Check if a stream event is a code event (Code mode)
 */
export function isCodeStreamEvent(event: ModeStreamEvent): boolean {
  return event.type === 'file:generating' || 
         event.type === 'code:chunk' || 
         event.type === 'file:complete';
}
