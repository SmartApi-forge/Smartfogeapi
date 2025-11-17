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

const MAX_CONTEXT_TOKENS = 100000; // ~75K for context
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
    } = {}
  ): Promise<SmartGenerationContext> {
    const startTime = Date.now();
    const { messageLimit = 20, maxFiles = 15, includeTests = false, isGitHubProject = false } = options;
    
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
    
    // Step 2.5: Extract keywords and find matching files by path
    // This catches explicit file references that semantic search might miss
    const keywordMatches = this.findFilesByKeywords(userPrompt, allFiles);
    console.log(`🎯 Keyword matches: ${keywordMatches.length} files`);
    if (keywordMatches.length > 0) {
      console.log(`   Matched files: ${keywordMatches.join(', ')}`);
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
    
    // Step 4a: Add keyword-matched files FIRST with high relevance (0.95)
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
    
    console.log(`📊 Total relevant files: ${Object.keys(relevantFiles).length} (${keywordMatches.length} keyword + ${contentMatches.length} content + ${Object.keys(relevantFiles).length - keywordMatches.length - contentMatches.length} semantic)`);
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
    // Allocate token budget:
    // - 20% for conversation
    // - 10% for config files
    // - 40% for highly relevant files
    // - 20% for dependency files
    // - 10% buffer
    
    const historyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.20);
    const configBudget = Math.floor(MAX_CONTEXT_CHARS * 0.10);
    const relevantBudget = Math.floor(MAX_CONTEXT_CHARS * 0.40);
    const dependencyBudget = Math.floor(MAX_CONTEXT_CHARS * 0.20);
    
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
   */
  static formatForPrompt(context: SmartGenerationContext, newPrompt: string): string {
    const sections: string[] = [];
    
    // Add stats
    sections.push(`# Context Summary\n${context.summary}\n`);
    
    // Add conversation history (last 5 messages)
    if (context.conversationHistory.length > 0) {
      sections.push('## Recent Conversation\n');
      context.conversationHistory.slice(-5).forEach(msg => {
        sections.push(`**${msg.role}**: ${msg.content}\n`);
      });
    }
    
    // Add config files
    if (Object.keys(context.configFiles).length > 0) {
      sections.push('\n## Configuration Files\n');
      Object.entries(context.configFiles).forEach(([filename, content]) => {
        sections.push(`### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`);
      });
    }
    
    // Add relevant files with reasons
    if (Object.keys(context.relevantFiles).length > 0) {
      sections.push('\n## Relevant Files (Semantic Search Results)\n');
      Object.entries(context.relevantFiles)
        .sort(([, a], [, b]) => b.relevance - a.relevance)
        .forEach(([filename, data]) => {
          sections.push(`### ${filename}\n*${data.reason}*\n\`\`\`\n${data.content}\n\`\`\`\n`);
        });
    }
    
    // Add dependency files
    if (Object.keys(context.dependencyFiles).length > 0) {
      sections.push('\n## Related Dependencies\n');
      Object.entries(context.dependencyFiles).forEach(([filename, content]) => {
        sections.push(`### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`);
      });
    }
    
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
}
