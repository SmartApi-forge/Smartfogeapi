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

/**
 * Two-Agent Orchestrator
 * Coordinates Decision Agent and Coding Agent for better code generation
 */
export class TwoAgentOrchestrator {
  
  /**
   * Execute the two-agent workflow
   */
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

    // STAGE 1: Decision Agent - Analyze request and create plan
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

    // If it's a question, just answer it (no code generation)
    if (decisionResult.mode === 'question_mode') {
      if (onProgress) await onProgress('Answering', 'Generating answer...');
      return await this.answerQuestion(userPrompt, context, decisionResult);
    }

    // STAGE 2: Coding Agent - Generate/modify code based on plan
    if (onProgress) await onProgress('Generating', 'Generating code...');
    
    console.log('🤖 Stage 2: Coding Agent generating code...');
    
    return await this.generateCode(userPrompt, context, decisionResult, {
      projectId,
      versionId,
      isGitHubProject,
      repoFullName,
      onProgress,
    });
  }

  /**
   * Answer a question (no code generation)
   */
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

  /**
   * Generate or modify code based on decision
   */
  private static async generateCode(
    userPrompt: string,
    context: SmartGenerationContext,
    decisionResult: DecisionResult,
    options: {
      projectId: string;
      versionId?: string;
      isGitHubProject: boolean;
      repoFullName?: string;
      onProgress?: (stage: string, message: string) => Promise<void>;
    }
  ): Promise<TwoAgentResult> {
    const { isGitHubProject, repoFullName, onProgress } = options;

    // Build system prompt based on mode
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

    // Add GitHub project warning if applicable
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

    // Add project-specific context
    const relevantFilePaths = Object.keys(context.relevantFiles || {});
    const allExistingFilePaths = Object.keys(context.previousFiles || {});
    
    const contextAdditions = `

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Relevant Files (Priority targets for modification):
${relevantFilePaths.length > 0 ? relevantFilePaths.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'None identified'}

All Existing Files (${allExistingFilePaths.length} total):
${allExistingFilePaths.slice(0, 30).join('\n')}
${allExistingFilePaths.length > 30 ? `... and ${allExistingFilePaths.length - 30} more files` : ''}

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

    // Build user prompt with file contents
    const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, userPrompt);

    // Generate code with streaming - IMPROVED with better error handling
    let completion;
    let rawOutput = '';
    let chunkCount = 0;
    const startTime = Date.now();
    
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        stream_options: { include_usage: true }, // Get token usage
      });

      // Immediately report streaming started
      if (onProgress) {
        await onProgress('Streaming', 'AI response started...');
      }

      // Collect streaming response with faster progress updates
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          rawOutput += content;
          chunkCount++;
          
          // Report progress MORE FREQUENTLY for better UX (every 5 chunks instead of 20)
          if (onProgress && chunkCount % 5 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            await onProgress('Generating', `Generating code... (${elapsed}s, ${chunkCount} chunks)`);
          }
        }
        
        // Also report on finish reason
        if (chunk.choices[0]?.finish_reason) {
          if (onProgress) {
            await onProgress('Processing', 'Finalizing response...');
          }
        }
      }
      
      // Final progress update
      if (onProgress) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        await onProgress('Complete', `Generated ${rawOutput.length} characters in ${elapsed}s`);
      }
      
    } catch (streamError: any) {
      console.error('Streaming error:', streamError);
      
      // Report streaming error to user
      if (onProgress) {
        await onProgress('Error', `Streaming failed: ${streamError.message}`);
      }
      
      // If streaming fails, try non-streaming as fallback
      console.log('Retrying without streaming...');
      if (onProgress) {
        await onProgress('Retrying', 'Retrying without streaming...');
      }
      
      const fallbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      
      rawOutput = fallbackResponse.choices[0].message.content || '';
      
      if (onProgress) {
        await onProgress('Complete', 'Generated response (non-streaming)');
      }
    }

    // Parse JSON response
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawOutput;
    const result = JSON.parse(jsonStr);

    // Post-process results
    return this.postProcessResults(result, context, decisionResult);
  }

  /**
   * Post-process generated code results
   */
  private static postProcessResults(
    result: any,
    context: SmartGenerationContext,
    decisionResult: DecisionResult
  ): TwoAgentResult {
    let modifiedFiles = result.modifiedFiles || {};
    let newFiles = result.newFiles || {};
    const deletedFiles = result.deletedFiles || [];

    // Reconcile duplicate files (e.g., AI creates "hero-section.tsx" when "HeroSection.tsx" exists)
    const parentFiles = context.previousFiles || {};
    const reconciledModified: Record<string, string> = { ...modifiedFiles };
    const reconciledNew: Record<string, string> = {};
    
    const normalizePath = (p: string): string => {
      const parts = p.split('/');
      const file = parts.pop() || '';
      const name = file.replace(/\.[^.]+$/, '');
      const ext = file.substring(file.lastIndexOf('.'));
      const normalized = name.toLowerCase().replace(/[-_]/g, '');
      return [...parts.map(p => p.toLowerCase()), normalized + ext.toLowerCase()].join('/');
    };

    const normalizedToActual = new Map<string, string>();
    for (const existingPath of Object.keys(parentFiles)) {
      const normalized = normalizePath(existingPath);
      normalizedToActual.set(normalized, existingPath);
    }

    for (const [newPath, content] of Object.entries(newFiles)) {
      // If file already exists with exact path, treat as modification
      if (parentFiles[newPath]) {
        console.log(`✓ Reconciling: "${newPath}" already exists, treating as modification`);
        reconciledModified[newPath] = content as string;
        continue;
      }

      // Check for aliases (different naming but same file)
      const norm = normalizePath(newPath);
      const candidate = normalizedToActual.get(norm);

      if (candidate && candidate !== newPath) {
        console.log(`✓ Reconciling: "${newPath}" → "${candidate}" (alias detected)`);
        reconciledModified[candidate] = content as string;
      } else {
        // Truly new file
        reconciledNew[newPath] = content as string;
      }
    }

    modifiedFiles = reconciledModified;
    newFiles = reconciledNew;

    // ✨ NEW: Validate and auto-fix all generated files
    const allGeneratedFiles = { ...modifiedFiles, ...newFiles };
    const validatedModified: Record<string, string> = {};
    const validatedNew: Record<string, string> = {};
    let totalFixedImports = 0;

    console.log(`🔍 Validating ${Object.keys(allGeneratedFiles).length} generated files...`);

    // 🚨 CRITICAL: Check for inline component anti-pattern (CREATE_AND_LINK mode only)
    if (decisionResult.mode === 'link_mode') {
      // Check if component was inlined in parent file instead of created separately
      for (const [filepath, code] of Object.entries(modifiedFiles)) {
        const codeStr = code as string;
        
        // Detect component definitions in modified files (bad for link mode)
        const componentMatch = codeStr.match(/function\s+([A-Z][a-zA-Z]*)\s*\(/);
        const isAppPage = filepath.includes('app/page.tsx') || filepath.includes('app\\page.tsx');
        
        if (componentMatch && isAppPage && Object.keys(newFiles).length === 0) {
          console.warn('⚠️  AI inlined component instead of creating separate file!');
          console.warn('   Auto-extracting component to separate file...');
          
          const componentName = componentMatch[1];
          
          // Extract the component code
          const componentExtracted = this.extractInlineComponent(codeStr, componentName);
          
          if (componentExtracted) {
            console.log(`✓ Extracted ${componentName} to components/${this.toKebabCase(componentName)}.tsx`);
            
            // Add to newFiles
            newFiles[`components/${this.toKebabCase(componentName)}.tsx`] = componentExtracted.componentCode;
            
            // Update modifiedFiles with cleaned code (component removed + import added)
            modifiedFiles[filepath] = componentExtracted.cleanedParentCode;
            
            console.log(`✓ Auto-corrected inline component issue`);
          } else {
            console.error('❌ Failed to extract inline component automatically');
            console.error('   Please check the AI generation logic');
          }
        }
      }
    }

    for (const [filepath, code] of Object.entries(modifiedFiles)) {
      const validation = CodeValidator.validateAndFix(
        code as string,
        filepath,
        { ...parentFiles, ...allGeneratedFiles }
      );

      if (validation.addedImports.length > 0) {
        console.log(`✓ Auto-fixed ${filepath}:`);
        validation.addedImports.forEach((imp) => console.log(`  + ${imp}`));
        totalFixedImports += validation.addedImports.length;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => console.log(`  ⚠️  ${warning}`));
      }

      if (validation.errors.length > 0) {
        validation.errors.forEach((error) => console.log(`  ❌ ${error}`));
      }

      validatedModified[filepath] = validation.fixedCode;
    }

    for (const [filepath, code] of Object.entries(newFiles)) {
      const validation = CodeValidator.validateAndFix(
        code as string,
        filepath,
        { ...parentFiles, ...allGeneratedFiles }
      );

      if (validation.addedImports.length > 0) {
        console.log(`✓ Auto-fixed ${filepath}:`);
        validation.addedImports.forEach((imp) => console.log(`  + ${imp}`));
        totalFixedImports += validation.addedImports.length;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => console.log(`  ⚠️  ${warning}`));
      }

      if (validation.errors.length > 0) {
        validation.errors.forEach((error) => console.log(`  ❌ ${error}`));
      }

      validatedNew[filepath] = validation.fixedCode;
    }

    if (totalFixedImports > 0) {
      console.log(`✅ Auto-fixed ${totalFixedImports} missing imports across all files`);
    }

    return {
      modifiedFiles: validatedModified,
      newFiles: validatedNew,
      deletedFiles,
      changes: result.changes || [],
      description: result.description || 'Generated code',
    };
  }

  /**
   * Detect project type from context
   */
  private static detectProjectType(context: SmartGenerationContext): string {
    const files = Object.keys(context.previousFiles || {});
    
    if (files.some(f => f.includes('next.config'))) return 'Next.js';
    if (files.some(f => f.includes('vite.config'))) return 'React (Vite)';
    if (files.some(f => f.includes('vue.config'))) return 'Vue.js';
    if (files.some(f => f.includes('angular.json'))) return 'Angular';
    
    return 'Next.js'; // Default
  }

  /**
   * Detect framework from context
   */
  private static detectFramework(context: SmartGenerationContext): string {
    const files = Object.keys(context.previousFiles || {});
    
    if (files.some(f => f.startsWith('app/') && f.endsWith('/page.tsx'))) {
      return 'Next.js App Router';
    }
    if (files.some(f => f.startsWith('pages/') && f.endsWith('.tsx'))) {
      return 'Next.js Pages Router';
    }
    
    return 'Next.js App Router'; // Default
  }

  /**
   * Analyze project patterns
   */
  private static analyzeProjectPatterns(context: SmartGenerationContext): {
    uiLibrary: string;
    styling: string;
    formLibrary: string;
    stateManagement: string;
    commonComponents: string[];
    importPatterns: string[];
  } {
    const files = context.previousFiles || {};
    const allContent = Object.values(files).join('\n');

    return {
      uiLibrary: allContent.includes('shadcn') || allContent.includes('@/components/ui') ? 'shadcn/ui' : 'none',
      styling: allContent.includes('tailwindcss') || allContent.includes('className=') ? 'Tailwind CSS' : 'CSS',
      formLibrary: allContent.includes('react-hook-form') ? 'react-hook-form' : 'none',
      stateManagement: allContent.includes('zustand') ? 'Zustand' : 'React hooks',
      commonComponents: Object.keys(files).filter(f => f.includes('components/')).slice(0, 10),
      importPatterns: this.extractImportPatterns(files),
    };
  }

  /**
   * Extract common import patterns
   */
  private static extractImportPatterns(files: Record<string, string>): string[] {
    const imports = new Set<string>();
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    
    for (const content of Object.values(files)) {
      if (typeof content !== 'string') continue;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('@/') || match[1].startsWith('./')) {
          imports.add(match[1]);
        }
      }
    }
    
    return Array.from(imports).slice(0, 10);
  }

  /**
   * Extract inline component from parent file and create separate file
   */
  private static extractInlineComponent(
    code: string,
    componentName: string
  ): { componentCode: string; cleanedParentCode: string } | null {
    try {
      // Find the component function definition
      const componentRegex = new RegExp(
        `function\\s+${componentName}\\s*\\([^)]*\\)[^{]*\\{`,
        'g'
      );
      
      const match = componentRegex.exec(code);
      if (!match) return null;
      
      // Find the start of the component
      const startIndex = match.index;
      
      // Find the matching closing brace
      let braceCount = 0;
      let inComponent = false;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < code.length; i++) {
        if (code[i] === '{') {
          braceCount++;
          inComponent = true;
        } else if (code[i] === '}') {
          braceCount--;
          if (inComponent && braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      // Extract component code
      const componentFunction = code.substring(startIndex, endIndex);
      
      // Create component file with proper structure
      const componentCode = `"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export ${componentFunction}
`;
      
      // Remove component from parent and add import
      const beforeComponent = code.substring(0, startIndex);
      const afterComponent = code.substring(endIndex);
      
      // Find where to insert import (after existing imports)
      const lines = beforeComponent.split('\n');
      let importInsertIndex = 0;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('import ') || lines[i].includes('"use client"') || lines[i].includes("'use client'")) {
          importInsertIndex = i + 1;
          break;
        }
      }
      
      // Add import statement
      const importStatement = `import { ${componentName} } from "@/components/${this.toKebabCase(componentName)}";`;
      lines.splice(importInsertIndex, 0, importStatement);
      
      const cleanedParentCode = lines.join('\n') + afterComponent;
      
      return {
        componentCode,
        cleanedParentCode,
      };
    } catch (error) {
      console.error('Error extracting component:', error);
      return null;
    }
  }

  /**
   * Convert PascalCase to kebab-case
   */
  private static toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }
}
