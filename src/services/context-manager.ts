/**
 * ContextManager Service - Hybrid Memory System
 * 
 * Manages working memory (conversation history, recent files) and long-term memory
 * (project patterns, architectural decisions, file relationships).
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { createClient } from '@supabase/supabase-js';
import { EmbeddingService } from './embedding-service';
import { VersionManager } from './version-manager';
import { messageOperations } from '../../lib/supabase-server';
import type { Message } from '../modules/messages/types';
import type {
  ContextOptions,
  GenerationContext,
  WorkingMemory,
  LongTermMemory,
  RelevantFile,
  ProjectPatterns,
  ProjectKnowledge,
  FileRelationship,
  ConversationMessage,
  IContextManager,
} from '../types/context-management';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Token limits - Reserve ~8K for system prompt + response, leaving ~20K for context
const MAX_CONTEXT_TOKENS = 20000;
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

// Default conversation history limit (Requirements: 1.2)
const DEFAULT_MESSAGE_LIMIT = 20;

// High relevance score for explicitly referenced files (Requirements: 1.5)
const EXPLICIT_REFERENCE_RELEVANCE = 0.99;

const DEFAULT_PROJECT_KNOWLEDGE: ProjectKnowledge = {
  uiLibrary: 'unknown',
  styling: 'unknown',
  stateManagement: 'unknown',
  formLibrary: 'unknown',
  database: 'unknown',
  auth: 'unknown',
  importAliases: {},
  componentConventions: [],
};

export class ContextManager implements IContextManager {
  /**
   * Build complete generation context for a prompt
   * Requirements: 1.1, 1.2, 1.3, 1.5
   */
  async buildContext(
    projectId: string,
    prompt: string,
    options: Partial<ContextOptions> = {}
  ): Promise<GenerationContext> {
    const startTime = Date.now();
    const opts: ContextOptions = {
      messageLimit: options.messageLimit ?? DEFAULT_MESSAGE_LIMIT,
      maxFiles: options.maxFiles ?? 10,
      includeTests: options.includeTests ?? false,
      isGitHubProject: options.isGitHubProject ?? false,
      errorFileName: options.errorFileName,
    };

    console.log(`🔧 ContextManager: Building context for project ${projectId}`);

    // Step 1: Build working memory
    const workingMemory = await this.getWorkingMemory(projectId, prompt, opts.messageLimit);

    // Step 2: Get long-term memory
    const longTermMemory = await this.getLongTermMemory(projectId);

    // Step 3: Get latest version and all files
    const previousVersion = await VersionManager.getLatestVersion(projectId);
    const allFiles = previousVersion?.files || {};
    const fileTree = Object.keys(allFiles);

    // Step 4: Find relevant files using multi-layer search
    const relevantFiles = await this.findRelevantFiles(projectId, prompt, allFiles, previousVersion?.id, opts);

    // Step 5: Detect project patterns
    const projectPatterns = this.detectProjectPatterns(allFiles, longTermMemory.projectKnowledge);

    // Step 6: Apply intelligent truncation
    const truncatedContext = this.applyTruncation({ workingMemory, relevantFiles, fileTree });

    const duration = Date.now() - startTime;
    console.log(`✅ Context built in ${duration}ms`);

    return {
      workingMemory: truncatedContext.workingMemory,
      longTermMemory,
      relevantFiles: truncatedContext.relevantFiles,
      projectPatterns,
      fileTree: truncatedContext.fileTree,
    };
  }

  async getWorkingMemory(projectId: string, currentPrompt: string = '', messageLimit: number = DEFAULT_MESSAGE_LIMIT): Promise<WorkingMemory> {
    const messages = await this.fetchConversationHistory(projectId, messageLimit);
    const conversationHistory: ConversationMessage[] = messages.map((msg: Message) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    return { conversationHistory, recentFiles: [], currentPrompt };
  }

  async getLongTermMemory(projectId: string): Promise<LongTermMemory> {
    try {
      const { data, error } = await supabase
        .from('project_knowledge')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error || !data) {
        return this.getDefaultLongTermMemory();
      }

      return {
        projectKnowledge: (data.patterns as ProjectKnowledge) || DEFAULT_PROJECT_KNOWLEDGE,
        fileRelationships: (data.file_relationships as FileRelationship[]) || [],
        architecturalDecisions: data.architectural_decisions || [],
      };
    } catch {
      return this.getDefaultLongTermMemory();
    }
  }

  async updateLongTermMemory(projectId: string, patterns: ProjectPatterns): Promise<void> {
    const projectKnowledge: ProjectKnowledge = {
      uiLibrary: patterns.uiLibrary,
      styling: patterns.styling,
      stateManagement: patterns.stateManagement,
      formLibrary: patterns.formLibrary,
      database: 'unknown',
      auth: 'unknown',
      importAliases: {},
      componentConventions: patterns.commonComponents,
    };

    const { error } = await supabase
      .from('project_knowledge')
      .upsert({ project_id: projectId, patterns: projectKnowledge, updated_at: new Date().toISOString() }, { onConflict: 'project_id' });

    if (error) throw new Error(`Failed to update long-term memory: ${error.message}`);
  }

  /**
   * Update file relationships in long-term memory
   * Requirements: 1.4
   */
  async updateFileRelationships(projectId: string, relationships: FileRelationship[]): Promise<void> {
    const { error } = await supabase
      .from('project_knowledge')
      .upsert(
        { 
          project_id: projectId, 
          file_relationships: relationships,
          updated_at: new Date().toISOString() 
        }, 
        { onConflict: 'project_id' }
      );

    if (error) throw new Error(`Failed to update file relationships: ${error.message}`);
  }

  /**
   * Add an architectural decision to long-term memory
   * Requirements: 1.4
   */
  async addArchitecturalDecision(projectId: string, decision: string): Promise<void> {
    // First get existing decisions
    const { data: existing } = await supabase
      .from('project_knowledge')
      .select('architectural_decisions')
      .eq('project_id', projectId)
      .maybeSingle();

    const existingDecisions: string[] = existing?.architectural_decisions || [];
    
    // Avoid duplicates
    if (existingDecisions.includes(decision)) {
      return;
    }

    const updatedDecisions = [...existingDecisions, decision];

    const { error } = await supabase
      .from('project_knowledge')
      .upsert(
        { 
          project_id: projectId, 
          architectural_decisions: updatedDecisions,
          updated_at: new Date().toISOString() 
        }, 
        { onConflict: 'project_id' }
      );

    if (error) throw new Error(`Failed to add architectural decision: ${error.message}`);
  }

  /**
   * Analyze files to extract file relationships (imports/exports)
   * Requirements: 1.4
   */
  extractFileRelationships(files: Record<string, string>): FileRelationship[] {
    const relationships: FileRelationship[] = [];
    
    for (const [filePath, content] of Object.entries(files)) {
      if (typeof content !== 'string') continue;
      
      // Skip non-code files
      if (!filePath.match(/\.(tsx?|jsx?|mjs|cjs)$/)) continue;

      // Extract import statements
      const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Skip external packages
        if (!importPath.startsWith('.') && !importPath.startsWith('@/') && !importPath.startsWith('~/')) {
          continue;
        }

        // Resolve relative path to absolute
        const resolvedPath = this.resolveImportPath(filePath, importPath, Object.keys(files));
        
        if (resolvedPath) {
          relationships.push({
            source: filePath,
            target: resolvedPath,
            type: 'imports',
          });
        }
      }

      // Extract extends/implements for classes
      const extendsRegex = /class\s+\w+\s+extends\s+(\w+)/g;
      while ((match = extendsRegex.exec(content)) !== null) {
        // Note: We'd need to resolve the import to get the actual file
        // For now, we track the relationship if we can find the class
        const className = match[1];
        const targetFile = this.findFileDefiningSymbol(className, files);
        if (targetFile && targetFile !== filePath) {
          relationships.push({
            source: filePath,
            target: targetFile,
            type: 'extends',
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Resolve an import path to an actual file path
   */
  private resolveImportPath(fromFile: string, importPath: string, allFiles: string[]): string | null {
    // Handle alias imports (@/ or ~/)
    if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
      const withoutAlias = importPath.replace(/^[@~]\//, '');
      const possiblePaths = [
        withoutAlias,
        `${withoutAlias}.ts`,
        `${withoutAlias}.tsx`,
        `${withoutAlias}/index.ts`,
        `${withoutAlias}/index.tsx`,
        `src/${withoutAlias}`,
        `src/${withoutAlias}.ts`,
        `src/${withoutAlias}.tsx`,
      ];
      
      for (const path of possiblePaths) {
        if (allFiles.includes(path)) return path;
      }
      return null;
    }

    // Handle relative imports
    const fromDir = fromFile.split('/').slice(0, -1).join('/');
    const segments = importPath.split('/');
    const resolvedSegments = fromDir ? fromDir.split('/') : [];

    for (const segment of segments) {
      if (segment === '..') {
        resolvedSegments.pop();
      } else if (segment !== '.') {
        resolvedSegments.push(segment);
      }
    }

    const basePath = resolvedSegments.join('/');
    const possiblePaths = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.jsx`,
      `${basePath}/index.ts`,
      `${basePath}/index.tsx`,
      `${basePath}/index.js`,
    ];

    for (const path of possiblePaths) {
      if (allFiles.includes(path)) return path;
    }

    return null;
  }

  /**
   * Find the file that defines a given symbol (class, function, etc.)
   */
  private findFileDefiningSymbol(symbolName: string, files: Record<string, string>): string | null {
    const exportPatterns = [
      new RegExp(`export\\s+(?:default\\s+)?class\\s+${symbolName}\\b`),
      new RegExp(`export\\s+(?:default\\s+)?function\\s+${symbolName}\\b`),
      new RegExp(`export\\s+const\\s+${symbolName}\\s*=`),
      new RegExp(`export\\s+\\{[^}]*\\b${symbolName}\\b[^}]*\\}`),
    ];

    for (const [filePath, content] of Object.entries(files)) {
      if (typeof content !== 'string') continue;
      
      for (const pattern of exportPatterns) {
        if (pattern.test(content)) {
          return filePath;
        }
      }
    }

    return null;
  }

  private async findRelevantFiles(
    projectId: string,
    prompt: string,
    allFiles: Record<string, string>,
    versionId: string | undefined,
    options: ContextOptions
  ): Promise<RelevantFile[]> {
    const relevantFiles: Map<string, RelevantFile> = new Map();

    // Layer 1: Explicit file references (0.99)
    const explicitRefs = this.findExplicitFileReferences(prompt, allFiles);
    for (const filePath of explicitRefs) {
      if (allFiles[filePath]) {
        relevantFiles.set(filePath, {
          path: filePath,
          content: allFiles[filePath],
          relevance: EXPLICIT_REFERENCE_RELEVANCE,
          reason: 'Explicitly referenced in prompt',
        });
      }
    }

    // Layer 1.5: Error file
    if (options.errorFileName) {
      const errorFilePath = Object.keys(allFiles).find(path => path.includes(options.errorFileName!));
      if (errorFilePath && allFiles[errorFilePath]) {
        relevantFiles.set(errorFilePath, {
          path: errorFilePath,
          content: allFiles[errorFilePath],
          relevance: EXPLICIT_REFERENCE_RELEVANCE,
          reason: 'File mentioned in error - MUST FIX',
        });
      }
    }

    // Layer 2: Keyword matches (0.95)
    const keywordMatches = this.findFilesByKeywords(prompt, allFiles);
    for (const filePath of keywordMatches) {
      if (!relevantFiles.has(filePath) && allFiles[filePath]) {
        relevantFiles.set(filePath, {
          path: filePath,
          content: allFiles[filePath],
          relevance: 0.95,
          reason: 'Keyword match from prompt',
        });
      }
    }

    // Layer 3: Content matches - exact code snippets get highest priority (0.99), partial matches get 0.90
    const contentMatchResults = this.searchFilesByContentWithScores(prompt, allFiles, options.maxFiles);
    for (const { path: filePath, isExactMatch } of contentMatchResults) {
      if (!relevantFiles.has(filePath) && allFiles[filePath]) {
        // Exact code snippet matches (quoted content found verbatim) get highest priority
        const relevance = isExactMatch ? EXPLICIT_REFERENCE_RELEVANCE : 0.90;
        relevantFiles.set(filePath, {
          path: filePath,
          content: allFiles[filePath],
          relevance,
          reason: isExactMatch ? 'Exact content match from prompt' : 'Content match',
        });
      }
    }

    // Layer 4: Semantic search
    try {
      const searchResults = await EmbeddingService.searchRelevantFiles(projectId, prompt, {
        versionId,
        limit: options.maxFiles,
        threshold: 0.3,
        fileTypes: options.includeTests ? undefined : ['component', 'utility', 'api', 'config'],
      });

      for (const result of searchResults) {
        if (!relevantFiles.has(result.filePath) && allFiles[result.filePath]) {
          relevantFiles.set(result.filePath, {
            path: result.filePath,
            content: allFiles[result.filePath],
            relevance: result.similarity,
            reason: `Semantic match (${Math.round(result.similarity * 100)}%)`,
          });
        }
      }
    } catch (error) {
      console.warn('Semantic search failed:', error);
    }

    return Array.from(relevantFiles.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, options.maxFiles);
  }

  private findExplicitFileReferences(prompt: string, allFiles: Record<string, string>): string[] {
    const matches: string[] = [];
    const filePatterns = [
      /(?:in|file:|edit|modify|update|change|fix)\s+[`"']?([a-zA-Z0-9_\-\/\.]+\.[a-zA-Z]+)[`"']?/gi,
      /[`"']([a-zA-Z0-9_\-\/]+\.[a-zA-Z]+)[`"']/g,
    ];

    for (const pattern of filePatterns) {
      const patternMatches = prompt.matchAll(pattern);
      for (const match of patternMatches) {
        const fileName = match[1];
        const matchingFile = Object.keys(allFiles).find(path => {
          const pathLower = path.toLowerCase();
          const fileNameLower = fileName.toLowerCase();
          return pathLower.endsWith(fileNameLower) || pathLower.includes(`/${fileNameLower}`) || path.split('/').pop()?.toLowerCase() === fileNameLower;
        });
        if (matchingFile) matches.push(matchingFile);
      }
    }

    return [...new Set(matches)];
  }

  private findFilesByKeywords(prompt: string, allFiles: Record<string, string>): string[] {
    const matches: string[] = [];
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'make', 'change', 'update', 'modify', 'add', 'create', 'delete', 'remove', 'fix', 'it', 'this', 'that', 'with', 'from', 'into']);
    const words = prompt.toLowerCase().split(/[\s,.:;!?()[\]{}]+/).filter(w => w.length > 2 && !stopWords.has(w));

    for (const filePath of Object.keys(allFiles)) {
      const pathLower = filePath.toLowerCase();
      const fileNameLower = filePath.split('/').pop()?.toLowerCase() || '';
      for (const keyword of words) {
        if (fileNameLower.includes(keyword) || pathLower.includes(`/${keyword}/`) || pathLower.includes(`/${keyword}`)) {
          matches.push(filePath);
          break;
        }
      }
    }

    return [...new Set(matches)];
  }

  private searchFilesByContent(prompt: string, allFiles: Record<string, string>, limit: number = 10): string[] {
    return this.searchFilesByContentWithScores(prompt, allFiles, limit).map(m => m.path);
  }

  /**
   * Search files by content and return whether matches are exact (verbatim code snippets)
   * Requirements: 1.5 - Files referenced by content get highest priority
   */
  private searchFilesByContentWithScores(prompt: string, allFiles: Record<string, string>, limit: number = 10): Array<{ path: string; score: number; isExactMatch: boolean }> {
    const matches: Array<{ path: string; score: number; isExactMatch: boolean }> = [];
    
    // Extract quoted content (potential code snippets)
    const quotedMatches = prompt.match(/["']([^"']{10,})["']/g);
    const searchTerms: string[] = quotedMatches ? quotedMatches.map(q => q.replace(/["']/g, '')) : [];
    
    // Extract code blocks (```...```)
    const codeBlockMatches = prompt.match(/```[\s\S]*?```/g);
    if (codeBlockMatches) {
      for (const block of codeBlockMatches) {
        const code = block.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim();
        if (code.length >= 10) {
          searchTerms.push(code);
        }
      }
    }
    
    // Extract backtick inline code
    const inlineCodeMatches = prompt.match(/`([^`]{5,})`/g);
    if (inlineCodeMatches) {
      searchTerms.push(...inlineCodeMatches.map(m => m.replace(/`/g, '')));
    }
    
    const capitalPhrases = prompt.match(/[A-Z][A-Z\s]{8,}/g);
    if (capitalPhrases) searchTerms.push(...capitalPhrases.map(p => p.trim()));

    if (searchTerms.length === 0) return [];

    for (const [filePath, content] of Object.entries(allFiles)) {
      if (typeof content !== 'string') continue;
      let score = 0;
      let isExactMatch = false;
      const contentLower = content.toLowerCase();
      
      for (const term of searchTerms) {
        // Exact match (verbatim code snippet found)
        if (content.includes(term)) {
          score += 100;
          isExactMatch = true;
        } else if (contentLower.includes(term.toLowerCase())) {
          score += 50;
        }
      }
      
      if (score > 0) matches.push({ path: filePath, score, isExactMatch });
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private applyTruncation(context: { workingMemory: WorkingMemory; relevantFiles: RelevantFile[]; fileTree: string[] }): { workingMemory: WorkingMemory; relevantFiles: RelevantFile[]; fileTree: string[] } {
    return this.applyTruncationWithMessageLimit(context, DEFAULT_MESSAGE_LIMIT);
  }

  /**
   * Apply truncation with explicit message limit enforcement
   * Requirements: 1.2 - Conversation history SHALL contain at most 20 messages
   * Requirements: 1.3 - Intelligent truncation preserving most relevant content
   */
  private applyTruncationWithMessageLimit(
    context: { workingMemory: WorkingMemory; relevantFiles: RelevantFile[]; fileTree: string[] },
    messageLimit: number
  ): { workingMemory: WorkingMemory; relevantFiles: RelevantFile[]; fileTree: string[] } {
    const historyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.15);
    const filesBudget = Math.floor(MAX_CONTEXT_CHARS * 0.70);
    const treeBudget = Math.floor(MAX_CONTEXT_CHARS * 0.10);

    // First enforce message count limit (Requirements: 1.2)
    const messageLimitedHistory = this.enforceMessageLimit(
      context.workingMemory.conversationHistory, 
      messageLimit
    );
    
    // Then apply character budget truncation (Requirements: 1.3)
    const truncatedHistory = this.truncateConversationHistory(messageLimitedHistory, historyBudget);
    const truncatedFiles = this.truncateRelevantFiles(context.relevantFiles, filesBudget);
    const truncatedTree = this.truncateFileTree(context.fileTree, treeBudget);

    return {
      workingMemory: { ...context.workingMemory, conversationHistory: truncatedHistory },
      relevantFiles: truncatedFiles,
      fileTree: truncatedTree,
    };
  }

  /**
   * Enforce message count limit by keeping only the most recent messages
   * Requirements: 1.2 - Include the last 20 conversation messages
   */
  private enforceMessageLimit(history: ConversationMessage[], limit: number): ConversationMessage[] {
    if (history.length <= limit) {
      return history;
    }
    // Keep the most recent messages (last N messages)
    return history.slice(-limit);
  }

  private truncateConversationHistory(history: ConversationMessage[], budget: number): ConversationMessage[] {
    const truncated: ConversationMessage[] = [];
    let currentSize = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const messageSize = JSON.stringify(history[i]).length;
      if (currentSize + messageSize <= budget) {
        truncated.unshift(history[i]);
        currentSize += messageSize;
      } else break;
    }
    return truncated;
  }

  private truncateRelevantFiles(files: RelevantFile[], budget: number): RelevantFile[] {
    const result: RelevantFile[] = [];
    let used = 0;
    for (const file of files) {
      const size = file.content.length;
      if (used + size <= budget) {
        result.push(file);
        used += size;
      } else if (result.length === 0) {
        result.push({ ...file, content: file.content.substring(0, budget) + '\n[... truncated ...]' });
        break;
      } else break;
    }
    return result;
  }

  private truncateFileTree(fileTree: string[], budget: number): string[] {
    const result: string[] = [];
    let used = 0;
    for (const file of fileTree) {
      if (used + file.length + 1 <= budget) {
        result.push(file);
        used += file.length + 1;
      } else break;
    }
    return result;
  }

  private detectProjectPatterns(allFiles: Record<string, string>, existingKnowledge: ProjectKnowledge): ProjectPatterns {
    const patterns: ProjectPatterns = {
      uiLibrary: existingKnowledge.uiLibrary,
      styling: existingKnowledge.styling,
      formLibrary: existingKnowledge.formLibrary,
      stateManagement: existingKnowledge.stateManagement,
      commonComponents: existingKnowledge.componentConventions,
      importPatterns: [],
    };

    const packageJson = allFiles['package.json'];
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@radix-ui/react-dialog'] || deps['@shadcn/ui']) patterns.uiLibrary = 'shadcn';
        else if (deps['@mui/material']) patterns.uiLibrary = 'mui';
        else if (deps['@chakra-ui/react']) patterns.uiLibrary = 'chakra';
        if (deps['tailwindcss']) patterns.styling = 'tailwind';
        else if (deps['styled-components']) patterns.styling = 'styled-components';
        if (deps['react-hook-form']) patterns.formLibrary = 'react-hook-form';
        else if (deps['formik']) patterns.formLibrary = 'formik';
        if (deps['zustand']) patterns.stateManagement = 'zustand';
        else if (deps['@reduxjs/toolkit'] || deps['redux']) patterns.stateManagement = 'redux';
      } catch { /* ignore */ }
    }

    const componentPaths = Object.keys(allFiles).filter(p => p.includes('/components/') && (p.endsWith('.tsx') || p.endsWith('.jsx')));
    patterns.commonComponents = componentPaths.map(p => p.split('/').pop()?.replace(/\.[^.]+$/, '') || '').filter(Boolean).slice(0, 20);

    return patterns;
  }

  private async fetchConversationHistory(projectId: string, limit: number): Promise<Message[]> {
    try {
      const messages = await messageOperations.getWithFragments({ projectId, limit, offset: 0, includeFragment: false });
      return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch {
      return [];
    }
  }

  private getDefaultLongTermMemory(): LongTermMemory {
    return {
      projectKnowledge: DEFAULT_PROJECT_KNOWLEDGE,
      fileRelationships: [],
      architecturalDecisions: [],
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  getMaxContextTokens(): number {
    return MAX_CONTEXT_TOKENS;
  }
}

export const contextManager = new ContextManager();
