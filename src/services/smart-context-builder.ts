import { EmbeddingService, SearchResult } from './embedding-service';
import { VersionManager } from './version-manager';
import { messageOperations } from '../../lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import type { Version } from '../modules/versions/types';
import type { Message } from '../modules/messages/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reduced to stay under OpenAI's 30K TPM rate limit
// Reserve ~8K for system prompt + response, leaving ~20K for context
const MAX_CONTEXT_TOKENS = 20000;
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

export interface SmartGenerationContext {
  conversationHistory: Array<{ role: string; content: string }>;
  relevantFiles: Record<string, {
    content: string;
    relevance: number;
    reason: string;
  }>;
  dependencyFiles: Record<string, string>;
  configFiles: Record<string, string>;
  // Full snapshot of previous version files for diffing and sandbox updates
  previousFiles: Record<string, string>;
  previousVersion: Version | null;
  projectId: string;
  summary: string;
  stats: {
    totalFiles: number;
    selectedFiles: number;
    totalTokens: number;
    embeddingSearchTime: number;
  };
}

/**
 * Smart Context Builder Service
 * Uses semantic search to intelligently select relevant files
 */
export class SmartContextBuilder {
  /**
   * Build smart context using semantic search
   */
  static async buildSmartContext(
    projectId: string,
    userPrompt: string,
    options: {
      messageLimit?: number;
      maxFiles?: number;
      includeTests?: boolean;
      isGitHubProject?: boolean;
      errorFileName?: string | null;
    } = {}
  ): Promise<SmartGenerationContext> {
    const startTime = Date.now();
    // Reduced defaults to stay under OpenAI rate limits
    const { messageLimit = 10, maxFiles = 5, includeTests = false, isGitHubProject = false, errorFileName = null } = options;
    
    console.log(`🔧 Building smart context for project ${projectId}`);
    console.log(`📝 User prompt: "${userPrompt}"`);
    
    if (isGitHubProject) {
      console.log(`🤖 GitHub Project Mode: STRICT modification-only (no new files unless explicitly requested)`);
    }
    
    // Step 1: Fetch conversation history
    const messages = await this.fetchConversationHistory(projectId, messageLimit);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    // Step 2: Get latest version
    const previousVersion = await VersionManager.getLatestVersion(projectId);
    const allFiles = previousVersion?.files || {};
    
    console.log(`📁 Total files in project: ${Object.keys(allFiles).length}`);
    
    // Step 2.1: If error file specified, prioritize it
    if (errorFileName) {
      console.log(`🐛 Prioritizing error file: ${errorFileName}`);
      const errorFilePath = Object.keys(allFiles).find(path => path.includes(errorFileName));
      if (errorFilePath) {
        console.log(`✓ Found error file: ${errorFilePath}`);
      } else {
        console.log(`⚠️ Error file not found in project files`);
      }
    }
    
    // Step 2.5: Extract keywords and find matching files by path
    // This catches explicit file references that semantic search might miss
    const keywordMatches = this.findFilesByKeywords(userPrompt, allFiles);
    console.log(`🎯 Keyword matches: ${keywordMatches.length} files`);
    if (keywordMatches.length > 0) {
      console.log(`   Matched files: ${keywordMatches.join(', ')}`);
    }
    
    // Step 2.5.5: 🚨 CRITICAL - Search for UI elements mentioned in prompt within file CONTENTS
    // This finds files containing "sign in button", "login button", etc. even if filename doesn't match
    const uiElementMatches = this.findFilesContainingUIElements(userPrompt, allFiles);
    console.log(`🎯 UI element content matches: ${uiElementMatches.length} files`);
    if (uiElementMatches.length > 0) {
      console.log(`   Files containing UI elements: ${uiElementMatches.join(', ')}`);
    }
    
    // Step 2.6: For GitHub projects, be extra aggressive about finding relevant files
    // Look for files that might be related even if not explicitly mentioned
    let contextualMatches: string[] = [];
    if (isGitHubProject && keywordMatches.length === 0 && uiElementMatches.length === 0) {
      console.log(`🔍 GitHub project with no keyword matches - searching for contextual files...`);
      contextualMatches = this.findContextualFiles(userPrompt, allFiles);
      console.log(`📍 Contextual matches: ${contextualMatches.length} files`);
      if (contextualMatches.length > 0) {
        console.log(`   Matched files: ${contextualMatches.join(', ')}`);
      }
    }
    
    // Step 3: Semantic search for relevant files
    console.log(`🔍 Searching for relevant files for: "${userPrompt}"`);
    
    let searchResults = await EmbeddingService.searchRelevantFiles(
      projectId,
      userPrompt,
      {
        versionId: previousVersion?.id,
        limit: maxFiles,
        threshold: 0.3, // Lower threshold to get more candidates
        fileTypes: includeTests ? undefined : ['component', 'utility', 'api', 'config'],
      }
    );
    
    const embeddingSearchTime = Date.now() - startTime;
    console.log(`✓ Found ${searchResults.length} relevant files in ${embeddingSearchTime}ms`);
    
    // Step 3.5: Fallback to content-based search if embeddings found nothing
    let contentMatches: string[] = [];
    if (searchResults.length === 0 && keywordMatches.length === 0) {
      console.log(`⚠️ No results from embeddings or keywords, falling back to content search...`);
      contentMatches = this.searchFilesByContent(userPrompt, allFiles, maxFiles);
      console.log(`📝 Content search found: ${contentMatches.length} files`);
      if (contentMatches.length > 0) {
        console.log(`   Matched files: ${contentMatches.join(', ')}`);
      }
    }
    
    // Step 4: Build relevant files map with reasons
    const relevantFiles: Record<string, { content: string; relevance: number; reason: string }> = {};
    
    // Step 4a: Add error file FIRST with highest relevance (0.99) if specified
    if (errorFileName) {
      const errorFilePath = Object.keys(allFiles).find(path => path.includes(errorFileName));
      if (errorFilePath && allFiles[errorFilePath]) {
        relevantFiles[errorFilePath] = {
          content: allFiles[errorFilePath],
          relevance: 0.99, // Highest relevance for error files
          reason: 'File mentioned in error message - MUST FIX THIS FILE',
        };
        console.log(`✓ Added error file to relevant files: ${errorFilePath}`);
      }
    }
    
    // Step 4b: Add keyword-matched files with high relevance (0.95)
    // These are files that match keywords in the user's prompt (e.g., "hero" -> "HeroSection.tsx")
    for (const filePath of keywordMatches) {
      if (allFiles[filePath]) {
        relevantFiles[filePath] = {
          content: allFiles[filePath],
          relevance: 0.95, // High relevance for keyword matches
          reason: 'Keyword match from prompt',
        };
      }
    }
    
    // Step 4b.5: Add UI element content matches with HIGHEST relevance (0.98)
    // These are files that CONTAIN the actual UI element mentioned (e.g., "sign in button")
    for (const filePath of uiElementMatches) {
      if (allFiles[filePath] && !relevantFiles[filePath]) {
        relevantFiles[filePath] = {
          content: allFiles[filePath],
          relevance: 0.98, // Highest relevance - file contains the actual element to modify
          reason: 'Contains UI element mentioned in prompt - THIS FILE NEEDS MODIFICATION',
        };
      }
    }
    
    // Step 4a.5: Add contextual matches with high relevance (0.92)
    for (const filePath of contextualMatches) {
      if (allFiles[filePath] && !relevantFiles[filePath]) {
        relevantFiles[filePath] = {
          content: allFiles[filePath],
          relevance: 0.92, // High relevance for contextual matches
          reason: 'Contextual match - likely related to request',
        };
      }
    }
    
    // Step 4b: Add content-matched files with high relevance (0.90)
    // These are files that contain the actual text from the prompt
    for (const filePath of contentMatches) {
      if (allFiles[filePath] && !relevantFiles[filePath]) {
        relevantFiles[filePath] = {
          content: allFiles[filePath],
          relevance: 0.90, // High relevance for content matches
          reason: 'Content match - file contains text from prompt',
        };
      }
    }
    
    // Step 4c: Add semantic search results (skip if already added by keyword/content match)
    for (const result of searchResults) {
      if (allFiles[result.filePath] && !relevantFiles[result.filePath]) {
        relevantFiles[result.filePath] = {
          content: allFiles[result.filePath],
          relevance: result.similarity,
          reason: this.generateRelevanceReason(result.similarity, result.fileType),
        };
      }
    }
    
    console.log(`📊 Total relevant files: ${Object.keys(relevantFiles).length}`);
    console.log(`   Breakdown: ${keywordMatches.length} keyword + ${uiElementMatches.length} UI element + ${contentMatches.length} content + ${contextualMatches.length} contextual + ${searchResults.length} semantic`);
    if (Object.keys(relevantFiles).length > 0) {
      console.log(`   Files: ${Object.keys(relevantFiles).join(', ')}`);
    }
    
    // Step 5: Find dependencies of relevant files
    const dependencyFiles = await this.resolveDependencies(
      relevantFiles,
      allFiles,
      projectId,
      searchResults
    );
    
    console.log(`🔗 Found ${Object.keys(dependencyFiles).length} dependency files`);
    
    // Step 6: Always include critical config files
    const configFiles = this.extractConfigFiles(allFiles);
    console.log(`⚙️ Included ${Object.keys(configFiles).length} config files`);
    
    // Step 7: Calculate tokens and truncate if needed
    const { truncated, stats } = this.smartTruncate({
      relevantFiles,
      dependencyFiles,
      configFiles,
      conversationHistory,
    });
    
    // Step 8: Generate summary
    const summary = this.generateSummary({
      selectedFiles: Object.keys(truncated.relevantFiles).length,
      totalFiles: Object.keys(allFiles).length,
      conversationMessages: conversationHistory.length,
      searchResults: searchResults.length,
    });
    
    console.log(`✅ Smart context built: ${stats.selectedFiles}/${stats.totalFiles} files, ${stats.totalTokens} tokens`);
    
    return {
      conversationHistory: truncated.conversationHistory,
      relevantFiles: truncated.relevantFiles,
      dependencyFiles: truncated.dependencyFiles,
      configFiles: truncated.configFiles,
      // Expose full previous version files for downstream workflows (diffing, sandbox updates)
      previousFiles: allFiles,
      previousVersion,
      projectId,
      summary,
      stats: {
        ...stats,
        embeddingSearchTime,
      },
    };
  }
  
  /**
   * Resolve file dependencies from imports
   */
  private static async resolveDependencies(
    relevantFiles: Record<string, any>,
    allFiles: Record<string, string>,
    projectId: string,
    searchResults: SearchResult[]
  ): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {};
    
    // Use imports from search results
    for (const result of searchResults) {
      if (result.imports && result.imports.length > 0) {
        for (const importPath of result.imports) {
          // Resolve relative imports to actual file paths
          const resolvedPath = this.resolveImportPath(importPath, result.filePath, allFiles);
          
          if (resolvedPath && allFiles[resolvedPath] && !relevantFiles[resolvedPath]) {
            dependencies[resolvedPath] = allFiles[resolvedPath];
          }
        }
      }
    }
    
    return dependencies;
  }
  
  /**
   * Extract critical config files
   */
  private static extractConfigFiles(allFiles: Record<string, string>): Record<string, string> {
    const configFiles: Record<string, string> = {};
    const configPatterns = [
      'package.json',
      'tsconfig.json',
      'next.config',
      'vite.config',
      'tailwind.config',
      '.env',
      'README.md',
    ];
    
    for (const [path, content] of Object.entries(allFiles)) {
      if (configPatterns.some(pattern => path.includes(pattern))) {
        configFiles[path] = content;
      }
    }
    
    return configFiles;
  }
  
  /**
   * Smart truncation with priority system
   */
  private static smartTruncate(context: {
    relevantFiles: Record<string, { content: string; relevance: number; reason: string }>;
    dependencyFiles: Record<string, string>;
    configFiles: Record<string, string>;
    conversationHistory: Array<{ role: string; content: string }>;
  }) {
    // Allocate token budget - OPTIMIZED for 30K TPM rate limit:
    // - 10% for conversation (reduced)
    // - 5% for config files (reduced)
    // - 70% for highly relevant files (increased - most important)
    // - 5% for dependency files (reduced)
    // - 10% buffer
    
    const historyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.10);
    const configBudget = Math.floor(MAX_CONTEXT_CHARS * 0.05);
    const relevantBudget = Math.floor(MAX_CONTEXT_CHARS * 0.70);
    const dependencyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.05);
    
    // Truncate each category
    const truncatedHistory = this.truncateHistory(context.conversationHistory, historyBudget);
    const truncatedConfig = this.truncateFiles(context.configFiles, configBudget);
    const truncatedRelevant = this.truncateRelevantFiles(context.relevantFiles, relevantBudget);
    const truncatedDeps = this.truncateFiles(context.dependencyFiles, dependencyBudget);
    
    // Calculate stats
    const totalTokens = Math.floor(
      (JSON.stringify(truncatedHistory).length +
       JSON.stringify(truncatedConfig).length +
       JSON.stringify(truncatedRelevant).length +
       JSON.stringify(truncatedDeps).length) / CHARS_PER_TOKEN
    );
    
    return {
      truncated: {
        conversationHistory: truncatedHistory,
        relevantFiles: truncatedRelevant,
        dependencyFiles: truncatedDeps,
        configFiles: truncatedConfig,
      },
      stats: {
        totalFiles: Object.keys(truncatedRelevant).length + 
                   Object.keys(truncatedDeps).length + 
                   Object.keys(truncatedConfig).length,
        selectedFiles: Object.keys(truncatedRelevant).length,
        totalTokens,
      },
    };
  }
  
  /**
   * Truncate files with relevance priority
   */
  private static truncateRelevantFiles(
    files: Record<string, { content: string; relevance: number; reason: string }>,
    budget: number
  ): Record<string, { content: string; relevance: number; reason: string }> {
    const sorted = Object.entries(files).sort(
      ([, a], [, b]) => b.relevance - a.relevance
    );
    
    const result: Record<string, any> = {};
    let used = 0;
    
    for (const [path, data] of sorted) {
      const size = data.content.length;
      
      if (used + size <= budget) {
        result[path] = data;
        used += size;
      } else if (Object.keys(result).length === 0) {
        // Must include at least one file, even if truncated
        const remaining = budget - used;
        result[path] = {
          ...data,
          content: data.content.substring(0, remaining) + '\n\n[... truncated ...]',
        };
        break;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  /**
   * Generate relevance reason
   */
  private static generateRelevanceReason(similarity: number, fileType?: string): string {
    if (similarity > 0.8) return `Highly relevant ${fileType || 'file'} (${Math.round(similarity * 100)}% match)`;
    if (similarity > 0.6) return `Relevant ${fileType || 'file'} (${Math.round(similarity * 100)}% match)`;
    return `Related ${fileType || 'file'} (${Math.round(similarity * 100)}% match)`;
  }
  
  /**
   * Resolve import path to actual file path
   */
  private static resolveImportPath(
    importPath: string,
    fromFile: string,
    allFiles: Record<string, string>
  ): string | null {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromFile.split('/').slice(0, -1).join('/');
      const parts = importPath.split('/');
      
      // Build resolved path
      let resolved = fromDir;
      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
          resolved = resolved.split('/').slice(0, -1).join('/');
        } else {
          resolved += '/' + part;
        }
      }
      
      // Try common extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (allFiles[fullPath]) {
          return fullPath;
        }
      }
    }
    
    // Handle absolute imports (e.g., @/...)
    if (importPath.startsWith('@/')) {
      const pathWithoutAlias = importPath.replace('@/', 'src/');
      
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const fullPath = pathWithoutAlias + ext;
        if (allFiles[fullPath]) {
          return fullPath;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Generate context summary
   */
  private static generateSummary(stats: {
    selectedFiles: number;
    totalFiles: number;
    conversationMessages: number;
    searchResults: number;
  }): string {
    return `Selected ${stats.selectedFiles}/${stats.totalFiles} files using semantic search (found ${stats.searchResults} matches). Conversation: ${stats.conversationMessages} messages.`;
  }
  
  /**
   * Truncate conversation history
   */
  private static truncateHistory(
    history: Array<{ role: string; content: string }>,
    budget: number
  ): Array<{ role: string; content: string }> {
    const truncated: Array<{ role: string; content: string }> = [];
    let currentSize = 0;
    
    // Start from most recent
    for (let i = history.length - 1; i >= 0; i--) {
      const message = history[i];
      const messageSize = JSON.stringify(message).length;
      
      if (currentSize + messageSize <= budget) {
        truncated.unshift(message);
        currentSize += messageSize;
      } else {
        break;
      }
    }
    
    return truncated;
  }
  
  /**
   * Truncate generic files
   */
  private static truncateFiles(
    files: Record<string, string>,
    budget: number
  ): Record<string, string> {
    const result: Record<string, string> = {};
    let used = 0;
    
    for (const [path, content] of Object.entries(files)) {
      const size = content.length;
      
      if (used + size <= budget) {
        result[path] = content;
        used += size;
      } else {
        const remaining = budget - used;
        if (remaining > 100) {
          result[path] = content.substring(0, remaining) + '\n[... truncated ...]';
        }
        break;
      }
    }
    
    return result;
  }
  
  /**
   * Fetch conversation history
   */
  private static async fetchConversationHistory(
    projectId: string,
    limit: number
  ): Promise<Message[]> {
    try {
      const messages = await messageOperations.getWithFragments({
        projectId,
        limit,
        offset: 0,
        includeFragment: false,
      });
      
      return messages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }
  
  /**
   * Format context for AI prompt
   * OPTIMIZED: Aggressive truncation to stay under OpenAI rate limits
   */
  static formatForPrompt(context: SmartGenerationContext, newPrompt: string): string {
    const sections: string[] = [];
    const MAX_FILE_CONTENT = 3000; // Max chars per file to include
    const MAX_TOTAL_CHARS = 60000; // ~15K tokens max for context
    let totalChars = 0;
    
    // Add stats (minimal)
    sections.push(`# Context: ${context.summary}\n`);
    totalChars += sections[sections.length - 1].length;
    
    // Add conversation history (last 3 messages only, truncated)
    if (context.conversationHistory.length > 0) {
      sections.push('## Recent Conversation\n');
      context.conversationHistory.slice(-3).forEach(msg => {
        const truncatedContent = msg.content.length > 500 
          ? msg.content.substring(0, 500) + '...' 
          : msg.content;
        sections.push(`**${msg.role}**: ${truncatedContent}\n`);
      });
      totalChars += sections.slice(-4).reduce((sum, s) => sum + s.length, 0);
    }
    
    // Skip config files to save tokens - they're usually not needed for edits
    // Only include package.json if it exists and is small
    const packageJson = context.configFiles['package.json'];
    if (packageJson && packageJson.length < 1000) {
      sections.push('\n## package.json (dependencies)\n```\n' + packageJson + '\n```\n');
      totalChars += sections[sections.length - 1].length;
    }
    
    // Add ONLY the most relevant files (top 3 max), heavily truncated
    if (Object.keys(context.relevantFiles).length > 0) {
      sections.push('\n## Files to Modify\n');
      const sortedFiles = Object.entries(context.relevantFiles)
        .sort(([, a], [, b]) => b.relevance - a.relevance)
        .slice(0, 3); // Max 3 files
      
      for (const [filename, data] of sortedFiles) {
        if (totalChars > MAX_TOTAL_CHARS) break;
        
        const truncatedContent = data.content.length > MAX_FILE_CONTENT
          ? data.content.substring(0, MAX_FILE_CONTENT) + '\n\n[... truncated for brevity ...]'
          : data.content;
        
        const fileSection = `### ${filename}\n\`\`\`\n${truncatedContent}\n\`\`\`\n`;
        sections.push(fileSection);
        totalChars += fileSection.length;
      }
    }
    
    // Skip dependency files to save tokens - AI can infer imports
    
    // Add new request
    sections.push('\n## New Request\n');
    sections.push(newPrompt);
    
    return sections.join('\n');
  }
  
  /**
   * Fallback to keyword-based search if embeddings not available
   */
  static keywordSearch(
    prompt: string,
    allFiles: Record<string, string>
  ): string[] {
    const mentioned: string[] = [];
    const keywords = this.extractKeywords(prompt);
    
    // Match file paths containing keywords
    for (const filePath of Object.keys(allFiles)) {
      const pathLower = filePath.toLowerCase();
      
      // Check if file path matches keywords
      if (keywords.some(k => pathLower.includes(k))) {
        mentioned.push(filePath);
      }
      
      // Check for explicit file mentions
      const filePattern = /(?:in|file:|edit|modify|update)\s+([\w\/\-\.]+)/gi;
      const matches = prompt.matchAll(filePattern);
      for (const match of matches) {
        if (filePath.includes(match[1])) {
          mentioned.push(filePath);
        }
      }
    }
    
    return [...new Set(mentioned)];
  }
  
  /**
   * Search for files by content - finds files containing text from the prompt
   * This is a fallback when embeddings and keyword matching both fail
   */
  private static searchFilesByContent(
    prompt: string,
    allFiles: Record<string, string>,
    limit: number = 10
  ): string[] {
    const matches: Array<{ path: string; score: number }> = [];
    
    // Extract quoted strings and significant phrases from prompt
    const quotedMatches = prompt.match(/["']([^"']{10,})["']/g);
    const searchTerms: string[] = [];
    
    if (quotedMatches) {
      // User provided explicit text in quotes - search for exact matches
      searchTerms.push(...quotedMatches.map(q => q.replace(/["']/g, '')));
      console.log(`   Searching for quoted text: ${searchTerms.join(' | ')}`);
    }
    
    // Also extract capitalized phrases (e.g., "TRANSFORM IDEAS INTO REALITY")
    const capitalPhrases = prompt.match(/[A-Z][A-Z\s]{8,}/g);
    if (capitalPhrases) {
      searchTerms.push(...capitalPhrases.map(p => p.trim()));
      console.log(`   Searching for capitalized phrases: ${capitalPhrases.join(' | ')}`);
    }
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Search each file for the terms
    for (const [filePath, content] of Object.entries(allFiles)) {
      if (typeof content !== 'string') continue;
      
      let score = 0;
      const contentLower = content.toLowerCase();
      
      for (const term of searchTerms) {
        const termLower = term.toLowerCase();
        
        // Check for exact match
        if (content.includes(term)) {
          score += 100; // Exact case match - highest score
          console.log(`   ✓ Exact match "${term}" in ${filePath}`);
        } else if (contentLower.includes(termLower)) {
          score += 50; // Case-insensitive match
          console.log(`   ✓ Case-insensitive match "${term}" in ${filePath}`);
        }
      }
      
      if (score > 0) {
        matches.push({ path: filePath, score });
      }
    }
    
    // Sort by score descending and return top N
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.path);
  }
  
  /**
   * Find files by keywords extracted from the user prompt
   * This catches explicit file references that semantic search might miss
   */
  private static findFilesByKeywords(
    prompt: string,
    allFiles: Record<string, string>
  ): string[] {
    const matches: string[] = [];
    const promptLower = prompt.toLowerCase();
    
    // Extract meaningful keywords from prompt
    // Remove common words and split into tokens
    const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'make', 'change', 'update', 'modify', 'add', 'create', 'delete', 'remove', 'fix', 'it', 'this', 'that', 'with', 'from', 'into'];
    const words = promptLower
      .split(/[\s,.:;!?]+/)
      .filter(w => w.length > 2 && !stopWords.includes(w));
    
    console.log(`🔑 Extracted keywords from prompt: ${words.join(', ')}`);
    
    // For each file, check if any keyword matches the file path
    for (const [filePath, _] of Object.entries(allFiles)) {
      const pathLower = filePath.toLowerCase();
      const fileNameLower = filePath.split('/').pop()?.toLowerCase() || '';
      
      // Check if any keyword matches the file name or path
      for (const keyword of words) {
        // Direct match in file name (e.g., "hero" matches "HeroSection.tsx")
        if (fileNameLower.includes(keyword)) {
          matches.push(filePath);
          console.log(`   ✓ Keyword "${keyword}" matched file: ${filePath}`);
          break;
        }
        
        // Match in directory path (e.g., "landing" matches "components/landing/...")
        if (pathLower.includes(`/${keyword}/`) || pathLower.includes(`/${keyword}`)) {
          matches.push(filePath);
          console.log(`   ✓ Keyword "${keyword}" matched path: ${filePath}`);
          break;
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(matches)];
  }
  
  /**
   * Extract keywords from prompt
   */
  private static extractKeywords(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const keywords: string[] = [];
    
    // Common code-related keywords
    const patterns = [
      'auth', 'api', 'component', 'service', 'util', 'helper',
      'route', 'page', 'model', 'controller', 'middleware',
      'config', 'test', 'type', 'interface', 'hook'
    ];
    
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        keywords.push(pattern);
      }
    }
    
    return keywords;
  }
  
  /**
   * 🚨 CRITICAL: Find files that CONTAIN specific UI elements mentioned in the prompt
   * This searches file CONTENTS, not just filenames
   * 
   * Example: "link sign in button to sign in page"
   * - Extracts: "sign in button", "sign in"
   * - Searches all files for: <button>Sign In</button>, onClick, "Sign In", etc.
   * - Returns files that actually contain the button, not just files named "button.tsx"
   */
  private static findFilesContainingUIElements(
    prompt: string,
    allFiles: Record<string, string>
  ): string[] {
    const matches: Array<{ path: string; score: number; reason: string }> = [];
    const promptLower = prompt.toLowerCase();
    
    // Extract UI element phrases from prompt
    // Look for patterns like "sign in button", "login button", "submit button", "navbar", etc.
    const uiElementPatterns = [
      // Button patterns
      /(?:the\s+)?(\w+(?:\s+\w+)?)\s+button/gi,
      // Link patterns  
      /(?:the\s+)?(\w+(?:\s+\w+)?)\s+link/gi,
      // Generic element patterns
      /(?:the\s+)?(\w+)\s+(?:in|on|at)\s+(?:the\s+)?(\w+)/gi,
    ];
    
    const extractedElements: string[] = [];
    
    // Extract element names from prompt
    for (const pattern of uiElementPatterns) {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        if (match[1]) {
          extractedElements.push(match[1].toLowerCase());
        }
        if (match[2]) {
          extractedElements.push(match[2].toLowerCase());
        }
      }
    }
    
    // Also extract common UI terms directly mentioned
    const commonUITerms = [
      'sign in', 'signin', 'sign-in', 'login', 'log in', 'log-in',
      'sign up', 'signup', 'sign-up', 'register',
      'logout', 'log out', 'log-out', 'sign out', 'signout',
      'navbar', 'nav bar', 'navigation', 'header', 'footer',
      'sidebar', 'menu', 'dropdown', 'modal', 'dialog', 'popup',
      'form', 'input', 'submit', 'cancel', 'close', 'open',
      'hero', 'banner', 'card', 'list', 'table', 'grid'
    ];
    
    for (const term of commonUITerms) {
      if (promptLower.includes(term)) {
        extractedElements.push(term);
      }
    }
    
    // Remove duplicates
    const uniqueElements = [...new Set(extractedElements)];
    
    if (uniqueElements.length === 0) {
      return [];
    }
    
    console.log(`🔍 Searching file contents for UI elements: ${uniqueElements.join(', ')}`);
    
    // Search each file's CONTENT for these elements
    for (const [filePath, content] of Object.entries(allFiles)) {
      // Only search component/page files
      if (!filePath.match(/\.(tsx|jsx|ts|js|vue|svelte)$/)) {
        continue;
      }
      
      if (typeof content !== 'string') continue;
      
      const contentLower = content.toLowerCase();
      let score = 0;
      const foundElements: string[] = [];
      
      for (const element of uniqueElements) {
        const elementLower = element.toLowerCase();
        
        // Check for various patterns in the file content
        const patterns = [
          // JSX text content: >Sign In<
          new RegExp(`>\\s*${this.escapeRegex(element)}\\s*<`, 'i'),
          // String literals: "Sign In", 'Sign In'
          new RegExp(`["']${this.escapeRegex(element)}["']`, 'i'),
          // Variable/prop names: signIn, SignIn, sign_in
          new RegExp(`\\b${element.replace(/\s+/g, '[-_]?')}\\b`, 'i'),
          // className or id containing the term
          new RegExp(`(?:className|id)=["'][^"']*${this.escapeRegex(element)}[^"']*["']`, 'i'),
          // Button/Link with text
          new RegExp(`<(?:button|Button|Link|a)[^>]*>\\s*${this.escapeRegex(element)}`, 'i'),
        ];
        
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            score += 20;
            if (!foundElements.includes(element)) {
              foundElements.push(element);
            }
          }
        }
        
        // Also check for simple substring match (lower priority)
        if (contentLower.includes(elementLower)) {
          score += 5;
          if (!foundElements.includes(element)) {
            foundElements.push(element);
          }
        }
      }
      
      if (score > 0) {
        matches.push({
          path: filePath,
          score,
          reason: `Contains: ${foundElements.join(', ')}`,
        });
        console.log(`   ✓ Found "${foundElements.join(', ')}" in ${filePath} (score: ${score})`);
      }
    }
    
    // Sort by score descending and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 files
      .map(m => m.path);
  }
  
  /**
   * Escape special regex characters in a string
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Find contextually relevant files based on prompt intent
   * This is more aggressive than keyword matching and looks for files that might be related
   * even if not explicitly mentioned (useful for GitHub projects)
   */
  private static findContextualFiles(
    prompt: string,
    allFiles: Record<string, string>
  ): string[] {
    const matches: string[] = [];
    const promptLower = prompt.toLowerCase();
    
    // Extract action words and subjects from prompt
    const actionWords = ['change', 'update', 'modify', 'fix', 'improve', 'enhance', 'refactor', 'edit', 'adjust', 'alter'];
    const hasAction = actionWords.some(word => promptLower.includes(word));
    
    if (!hasAction) {
      return []; // Only use contextual matching for modification requests
    }
    
    // Extract potential UI/component references
    const uiTerms = ['button', 'header', 'footer', 'nav', 'menu', 'hero', 'section', 'card', 'modal', 'dialog', 'form', 'input', 'text', 'title', 'heading', 'image', 'icon', 'banner', 'landing', 'home', 'page'];
    const mentionedTerms = uiTerms.filter(term => promptLower.includes(term));
    
    if (mentionedTerms.length === 0) {
      return []; // No UI terms found
    }
    
    console.log(`   Searching for files related to: ${mentionedTerms.join(', ')}`);
    
    // Search for files that might contain these UI elements
    for (const [filePath, content] of Object.entries(allFiles)) {
      // Skip non-component files
      if (!filePath.match(/\.(tsx|jsx|ts|js|vue|svelte)$/)) {
        continue;
      }
      
      const filePathLower = filePath.toLowerCase();
      const contentLower = typeof content === 'string' ? content.toLowerCase() : '';
      
      // Check if file path or content mentions any of the UI terms
      for (const term of mentionedTerms) {
        if (filePathLower.includes(term) || contentLower.includes(term)) {
          matches.push(filePath);
          console.log(`   ✓ Found "${term}" in ${filePath}`);
          break; // Only add each file once
        }
      }
    }
    
    return [...new Set(matches)];
  }
}
