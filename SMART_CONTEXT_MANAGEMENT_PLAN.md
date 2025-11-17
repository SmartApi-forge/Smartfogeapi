# Smart Context Management Implementation Plan

## 1. Problem Statement

### Current Limitations
After cloning a GitHub repository, the entire project is sent as context to the AI, which creates several critical issues:

1. **Token Limit Exhaustion**: Large projects (1000+ files) easily exceed the 100K token budget
2. **High Costs**: Sending unnecessary files dramatically increases API costs
3. **Poor Performance**: Processing irrelevant code slows down generation
4. **Context Truncation**: Important files may be cut off due to aggressive truncation
5. **Reduced Accuracy**: AI gets distracted by irrelevant code

### Current Implementation Analysis

**Location**: `src/services/context-builder.ts`

```typescript:null start=null
// Current approach - loads EVERYTHING
static async buildContext(projectId: string, messageLimit: number = 20): Promise<GenerationContext> {
  const messages = await this.fetchConversationHistory(projectId, messageLimit);
  const previousVersion = await VersionManager.getLatestVersion(projectId);
  
  // ⚠️ PROBLEM: Gets ALL files from previous version
  const previousFiles = previousVersion?.files || {};
  
  // Truncates if needed, but damage is already done
  const { truncatedHistory, truncatedFiles, isTruncated } = 
    this.truncateIfNeeded(conversationHistory, previousFiles);
}
```

**Key Issues**:
- Line 38: `const previousFiles = previousVersion?.files || {};` - Loads ALL files
- Lines 96-135: Truncation happens AFTER loading everything
- Lines 245-274: `formatForPrompt()` sends ALL files in prompt

## 2. How v0, Bolt, and Loveable Handle This

### v0.dev (Vercel) Approach
1. **Semantic Code Search**: Uses embeddings to find relevant files
2. **AST Parsing**: Understands code structure and dependencies
3. **Smart Chunking**: Splits large files into semantic chunks
4. **Relevance Scoring**: Ranks files by relevance to user query

### Bolt.new (StackBlitz) Approach
1. **Working Set Management**: Maintains active file set
2. **Dependency Graph**: Tracks file relationships
3. **Incremental Context**: Adds files on-demand
4. **File Filtering**: Uses heuristics to exclude build artifacts

### Lovable (GPT Engineer) Approach
1. **Vector Database**: Stores file embeddings in Pinecone/Weaviate
2. **Hybrid Search**: Combines semantic + keyword search
3. **Context Window Management**: Dynamic context allocation
4. **Conversation State**: Tracks relevant files across messages

## 3. Proposed Solution: Multi-Layer Context Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Prompt                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              1. Query Analysis Layer                         │
│  - Extract intent, entities, file mentions                   │
│  - Generate search embedding                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              2. Semantic Search Layer                        │
│  - Search file embeddings (Supabase pgvector)               │
│  - Return top K relevant files                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              3. Dependency Resolution Layer                  │
│  - Find imported/required files                              │
│  - Include config files (package.json, tsconfig)            │
│  - Add type definition files                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              4. Smart Truncation Layer                       │
│  - Calculate token budget per file                           │
│  - Truncate less relevant files                              │
│  - Keep full context for core files                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              5. Context Assembly                             │
│  - Format files for AI prompt                                │
│  - Add conversation history                                  │
│  - Include system instructions                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                    AI Generation
```

## 4. Technical Implementation

### Phase 1: Database Schema for Embeddings

**New Table**: `file_embeddings`

```sql
-- Create table for storing file embeddings
CREATE TABLE file_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES versions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- SHA256 of file content
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small
  file_size INTEGER NOT NULL,
  tokens INTEGER NOT NULL,
  language TEXT, -- typescript, python, etc.
  file_type TEXT, -- component, utility, config, test, etc.
  imports TEXT[], -- List of imported files/modules
  exports TEXT[], -- List of exported symbols
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, version_id, file_path)
);

-- Create index for vector similarity search
CREATE INDEX idx_file_embeddings_vector ON file_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create indexes for filtering
CREATE INDEX idx_file_embeddings_project ON file_embeddings(project_id);
CREATE INDEX idx_file_embeddings_version ON file_embeddings(version_id);
CREATE INDEX idx_file_embeddings_path ON file_embeddings(file_path);
CREATE INDEX idx_file_embeddings_hash ON file_embeddings(content_hash);

-- Create index for metadata queries
CREATE INDEX idx_file_embeddings_metadata ON file_embeddings USING gin(metadata);
```

### Phase 2: New Service - Embedding Service

**Location**: `src/services/embedding-service.ts`

```typescript
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface FileEmbeddingInput {
  projectId: string;
  versionId?: string;
  filePath: string;
  content: string;
  language?: string;
  imports?: string[];
  exports?: string[];
}

export interface FileEmbeddingResult {
  id: string;
  filePath: string;
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  /**
   * Generate embedding for a single file
   */
  static async embedFile(input: FileEmbeddingInput): Promise<FileEmbeddingResult> {
    const { projectId, versionId, filePath, content, language, imports, exports } = input;
    
    // Calculate content hash to avoid re-embedding unchanged files
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    
    // Check if embedding already exists with same hash
    const { data: existing } = await supabase
      .from('file_embeddings')
      .select('id, embedding, tokens')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .eq('content_hash', contentHash)
      .maybeSingle();
    
    if (existing) {
      console.log(`✓ Using cached embedding for ${filePath}`);
      return {
        id: existing.id,
        filePath,
        embedding: existing.embedding,
        tokens: existing.tokens,
      };
    }
    
    // Prepare content for embedding with context
    const embeddingText = this.prepareFileForEmbedding(filePath, content, language);
    
    // Generate embedding using OpenAI
    console.log(`🔄 Generating embedding for ${filePath}...`);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
      encoding_format: 'float',
    });
    
    const embedding = response.data[0].embedding;
    const tokens = response.usage.total_tokens;
    
    // Detect file type
    const fileType = this.detectFileType(filePath, content);
    
    // Store in database
    const { data, error } = await supabase
      .from('file_embeddings')
      .upsert({
        project_id: projectId,
        version_id: versionId || null,
        file_path: filePath,
        content_hash: contentHash,
        embedding,
        file_size: content.length,
        tokens,
        language,
        file_type: fileType,
        imports: imports || [],
        exports: exports || [],
        metadata: {
          last_embedded: new Date().toISOString(),
        },
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Failed to store embedding: ${error.message}`);
    }
    
    console.log(`✓ Embedded ${filePath} (${tokens} tokens)`);
    
    return {
      id: data.id,
      filePath,
      embedding,
      tokens,
    };
  }
  
  /**
   * Embed multiple files in batch (with rate limiting)
   */
  static async embedFiles(
    files: FileEmbeddingInput[]
  ): Promise<FileEmbeddingResult[]> {
    const results: FileEmbeddingResult[] = [];
    const BATCH_SIZE = 50; // OpenAI limit
    const DELAY_MS = 100; // Rate limit delay
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}`);
      
      const batchResults = await Promise.all(
        batch.map(file => this.embedFile(file))
      );
      
      results.push(...batchResults);
      
      // Rate limiting delay between batches
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    return results;
  }
  
  /**
   * Search for relevant files using semantic similarity
   */
  static async searchRelevantFiles(
    projectId: string,
    query: string,
    options: {
      versionId?: string;
      limit?: number;
      threshold?: number;
      fileTypes?: string[];
    } = {}
  ): Promise<Array<{
    filePath: string;
    similarity: number;
    tokens: number;
    language?: string;
    fileType?: string;
  }>> {
    const { versionId, limit = 10, threshold = 0.5, fileTypes } = options;
    
    // Generate query embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    });
    
    const queryEmbedding = response.data[0].embedding;
    
    // Build SQL query for vector similarity search
    let sql = `
      SELECT 
        file_path,
        1 - (embedding <=> $1::vector) as similarity,
        tokens,
        language,
        file_type
      FROM file_embeddings
      WHERE project_id = $2
    `;
    
    const params: any[] = [JSON.stringify(queryEmbedding), projectId];
    
    if (versionId) {
      sql += ` AND version_id = $${params.length + 1}`;
      params.push(versionId);
    }
    
    if (fileTypes && fileTypes.length > 0) {
      sql += ` AND file_type = ANY($${params.length + 1})`;
      params.push(fileTypes);
    }
    
    sql += `
      AND 1 - (embedding <=> $1::vector) > $${params.length + 1}
      ORDER BY embedding <=> $1::vector
      LIMIT $${params.length + 2}
    `;
    
    params.push(threshold, limit);
    
    const { data, error } = await supabase.rpc('search_file_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      version_id: versionId,
      similarity_threshold: threshold,
      match_limit: limit,
    });
    
    if (error) {
      console.error('Vector search error:', error);
      throw new Error(`Failed to search embeddings: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Prepare file content for embedding with metadata
   */
  private static prepareFileForEmbedding(
    filePath: string,
    content: string,
    language?: string
  ): string {
    // Add file path and language as context for better embeddings
    const header = `File: ${filePath}${language ? ` (${language})` : ''}\n\n`;
    
    // Truncate very large files to fit in embedding model
    const MAX_CHARS = 8000; // ~2000 tokens
    const truncatedContent = content.length > MAX_CHARS
      ? content.substring(0, MAX_CHARS) + '\n\n[... truncated ...]'
      : content;
    
    return header + truncatedContent;
  }
  
  /**
   * Detect file type from path and content
   */
  private static detectFileType(filePath: string, content: string): string {
    const path = filePath.toLowerCase();
    
    // Config files
    if (path.match(/package\.json|tsconfig|\.config\./)) return 'config';
    
    // Test files
    if (path.match(/\.test\.|\.spec\.|__tests__|__mocks__/)) return 'test';
    
    // Type definitions
    if (path.match(/\.d\.ts$|types\//)) return 'types';
    
    // Components
    if (path.match(/component|widget|view/) || content.includes('export default function')) {
      return 'component';
    }
    
    // Utilities
    if (path.match(/util|helper|lib/)) return 'utility';
    
    // API/Routes
    if (path.match(/api|route|endpoint|controller/)) return 'api';
    
    // Default
    return 'other';
  }
  
  /**
   * Delete embeddings for a project or version
   */
  static async deleteEmbeddings(projectId: string, versionId?: string): Promise<void> {
    const query = supabase
      .from('file_embeddings')
      .delete()
      .eq('project_id', projectId);
    
    if (versionId) {
      query.eq('version_id', versionId);
    }
    
    const { error } = await query;
    
    if (error) {
      throw new Error(`Failed to delete embeddings: ${error.message}`);
    }
  }
}
```

### Phase 3: Enhanced Context Builder

**Location**: `src/services/smart-context-builder.ts`

```typescript
import { EmbeddingService } from './embedding-service';
import { VersionManager } from './version-manager';
import { messageOperations } from '../../lib/supabase-server';
import type { Version } from '../modules/versions/types';
import type { Message } from '../modules/messages/types';

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
    } = {}
  ): Promise<SmartGenerationContext> {
    const startTime = Date.now();
    const { messageLimit = 20, maxFiles = 15, includeTests = false } = options;
    
    // Step 1: Fetch conversation history
    const messages = await this.fetchConversationHistory(projectId, messageLimit);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    // Step 2: Get latest version
    const previousVersion = await VersionManager.getLatestVersion(projectId);
    const allFiles = previousVersion?.files || {};
    
    // Step 3: Semantic search for relevant files
    console.log(`🔍 Searching for relevant files for: "${userPrompt}"`);
    
    const searchResults = await EmbeddingService.searchRelevantFiles(
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
    
    // Step 4: Build relevant files map with reasons
    const relevantFiles: Record<string, { content: string; relevance: number; reason: string }> = {};
    
    for (const result of searchResults) {
      if (allFiles[result.filePath]) {
        relevantFiles[result.filePath] = {
          content: allFiles[result.filePath],
          relevance: result.similarity,
          reason: this.generateRelevanceReason(result.similarity, result.fileType),
        };
      }
    }
    
    // Step 5: Find dependencies of relevant files
    const dependencyFiles = await this.resolveDependencies(
      relevantFiles,
      allFiles,
      projectId
    );
    
    // Step 6: Always include critical config files
    const configFiles = this.extractConfigFiles(allFiles);
    
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
    
    return {
      conversationHistory,
      relevantFiles: truncated.relevantFiles,
      dependencyFiles: truncated.dependencyFiles,
      configFiles: truncated.configFiles,
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
   * Resolve file dependencies
   */
  private static async resolveDependencies(
    relevantFiles: Record<string, any>,
    allFiles: Record<string, string>,
    projectId: string
  ): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {};
    
    // Get stored import information from embeddings
    const filePaths = Object.keys(relevantFiles);
    
    const { data: embeddingData } = await require('@supabase/supabase-js')
      .createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      .from('file_embeddings')
      .select('file_path, imports')
      .eq('project_id', projectId)
      .in('file_path', filePaths);
    
    if (!embeddingData) return dependencies;
    
    // Collect all imported files
    const importedFiles = new Set<string>();
    for (const file of embeddingData) {
      if (file.imports) {
        file.imports.forEach((imp: string) => {
          // Resolve relative imports to actual file paths
          const resolvedPath = this.resolveImportPath(imp, file.file_path);
          if (resolvedPath && allFiles[resolvedPath]) {
            importedFiles.add(resolvedPath);
          }
        });
      }
    }
    
    // Add imported files to dependencies
    importedFiles.forEach(filePath => {
      if (!relevantFiles[filePath] && allFiles[filePath]) {
        dependencies[filePath] = allFiles[filePath];
      }
    });
    
    console.log(`✓ Resolved ${Object.keys(dependencies).length} dependency files`);
    
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
  private static resolveImportPath(importPath: string, fromFile: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromFile.split('/').slice(0, -1).join('/');
      const parts = importPath.split('/');
      const resolved = [...fromDir.split('/'), ...parts].join('/');
      return resolved.replace(/\/\.\//g, '/').replace(/\/[^/]+\/\.\./g, '');
    }
    
    // Handle absolute imports
    if (importPath.startsWith('@/')) {
      return importPath.replace('@/', '');
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
    
    // Add conversation history
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
}
```

### Phase 4: Integration with Existing System

**Location**: `src/inngest/functions.ts` (Update existing functions)

```typescript
// Update the iterateAPI function to use SmartContextBuilder
import { SmartContextBuilder } from '../services/smart-context-builder';
import { EmbeddingService } from '../services/embedding-service';

export const iterateAPI = inngest.createFunction(
  { id: "iterate-api" },
  { event: "api/iterate" },
  async ({ event, step }) => {
    const { projectId, messageId, prompt } = event.data;
    
    // ... existing version creation code ...
    
    // NEW: Build smart context using semantic search
    const context = await step.run("build-smart-context", async () => {
      return await SmartContextBuilder.buildSmartContext(
        projectId,
        prompt,
        {
          messageLimit: 20,
          maxFiles: 15,
          includeTests: false,
        }
      );
    });
    
    // Use enhanced prompt with smart context
    const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, prompt);
    
    // ... rest of the function ...
  }
);

// NEW: Function to embed files after cloning repository
export const embedRepository = inngest.createFunction(
  { id: "embed-repository" },
  { event: "repository/embedded" },
  async ({ event, step }) => {
    const { projectId, versionId, files } = event.data;
    
    await step.run("generate-embeddings", async () => {
      console.log(`📦 Embedding ${Object.keys(files).length} files...`);
      
      // Prepare files for embedding
      const embeddingInputs = Object.entries(files).map(([path, content]) => ({
        projectId,
        versionId,
        filePath: path,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        language: detectLanguage(path),
        imports: extractImports(content as string),
        exports: extractExports(content as string),
      }));
      
      // Filter out non-code files
      const codeFiles = embeddingInputs.filter(f => 
        !f.filePath.match(/\.(md|txt|json|lock|log|map)$/i) &&
        !f.filePath.includes('node_modules') &&
        !f.filePath.includes('.git')
      );
      
      console.log(`🔄 Embedding ${codeFiles.length} code files...`);
      
      // Batch embed files
      const results = await EmbeddingService.embedFiles(codeFiles);
      
      console.log(`✓ Successfully embedded ${results.length} files`);
      
      return { embedded: results.length };
    });
  }
);

// Helper functions
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
  };
  return langMap[ext || ''] || 'unknown';
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match ES6 imports
  const es6Pattern = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
  let match;
  while ((match = es6Pattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match require()
  const requirePattern = /require\(['"](.+?)['"]\)/g;
  while ((match = requirePattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match Python imports
  const pythonPattern = /(?:from\s+(\S+)\s+)?import\s+(.+)/g;
  while ((match = pythonPattern.exec(content)) !== null) {
    if (match[1]) imports.push(match[1]);
  }
  
  return [...new Set(imports)];
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match ES6 exports
  const exportPattern = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = exportPattern.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return [...new Set(exports)];
}
```

## 5. Implementation Timeline

### Week 1: Foundation
- [ ] Create database schema and migrations
- [ ] Set up pgvector extension in Supabase
- [ ] Implement basic EmbeddingService
- [ ] Write unit tests

### Week 2: Core Features
- [ ] Complete SmartContextBuilder
- [ ] Implement dependency resolution
- [ ] Add caching layer
- [ ] Integration tests

### Week 3: Integration
- [ ] Update iterateAPI function
- [ ] Create embedRepository function
- [ ] Update UI to show file selection
- [ ] End-to-end testing

### Week 4: Optimization & Polish
- [ ] Performance tuning
- [ ] Add monitoring and analytics
- [ ] Documentation
- [ ] Deploy to production

## 6. Success Metrics

### Performance
- **Context Building Time**: < 2 seconds (vs current 5-10s)
- **Token Usage**: 60-70% reduction in average tokens per request
- **Cost Savings**: 50-60% reduction in OpenAI costs
- **Accuracy**: 20-30% improvement in relevant file selection

### User Experience
- **Response Time**: Faster AI responses due to smaller context
- **Relevance**: Better code generation with focused context
- **Scalability**: Support projects with 10,000+ files

## 7. Monitoring & Analytics

Track these metrics in your analytics dashboard:

```typescript
// Track context building metrics
await analytics.track('context_built', {
  projectId,
  totalFiles: stats.totalFiles,
  selectedFiles: stats.selectedFiles,
  totalTokens: stats.totalTokens,
  embeddingSearchTime: stats.embeddingSearchTime,
  buildTime: totalTime,
  relevanceScores: relevantFiles.map(f => f.relevance),
});
```

## 8. Migration Strategy

### For Existing Projects
1. **Batch Processing**: Create background job to embed all existing project files
2. **Incremental Updates**: Only re-embed changed files on new versions
3. **Fallback Mode**: If embeddings not available, fall back to old ContextBuilder
4. **Gradual Rollout**: Enable for new projects first, then migrate existing ones

### Database Migration
```sql
-- Run this migration to add pgvector support
CREATE EXTENSION IF NOT EXISTS vector;

-- Then run the file_embeddings table creation
-- (See Phase 1 above)
```

## 9. Cost Analysis

### Current Costs (per request)
- **Context Tokens**: ~50,000 tokens (all files)
- **GPT-4o Cost**: $0.50 per request
- **Monthly (1000 requests)**: $500

### With Smart Context (projected)
- **Context Tokens**: ~15,000 tokens (relevant files only)
- **GPT-4o Cost**: $0.15 per request
- **Embedding Cost**: $0.002 per request (amortized)
- **Monthly (1000 requests)**: $152 (70% savings!)

## 10. Next Steps

1. **Review and Approve**: Review this plan and provide feedback
2. **Create Migration**: Set up database schema
3. **Implement Phase 1**: Start with EmbeddingService
4. **Testing**: Comprehensive testing of each component
5. **Deploy**: Gradual rollout to production

---

## 11. Finalized Decisions & Strategy

### ✅ Confirmed Approach

1. **Embeddings**: OpenAI `text-embedding-3-small` (best cost/accuracy balance)
2. **Priority**: Cost + Accuracy (with code accuracy being critical)
3. **Caching**: Aggressive multi-layer caching without overloading
4. **Binary Files**: Skip embeddings, store metadata only
5. **Real-time UX**: Show which files are being read/edited/analyzed

### Multi-Layer Caching Strategy

```typescript
// Layer 1: In-Memory Cache (Fastest - 0ms)
const embeddingCache = new Map<string, { embedding: number[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Layer 2: Database Cache (Fast - ~20ms)
// Uses content_hash to avoid re-embedding unchanged files
const { data: cached } = await supabase
  .from('file_embeddings')
  .select('embedding')
  .eq('content_hash', hash)
  .maybeSingle();

// Layer 3: Generate Fresh (Slow - ~100ms)
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: content,
});
```

**Cache Hit Rates Expected**:
- In-memory: 60-70% (for repeated searches in same session)
- Database: 25-30% (unchanged files across sessions)
- Fresh generation: 5-10% (new/modified files only)

### Binary Files & Assets Strategy

**Don't embed these files** (waste of tokens + irrelevant for code generation):
- Images: `.png, .jpg, .gif, .svg, .ico, .webp`
- Videos: `.mp4, .mov, .avi, .webm`
- Fonts: `.woff, .woff2, .ttf, .eot`
- Archives: `.zip, .tar, .gz`
- Build artifacts: `.map, .min.js, .bundle.js`
- Lock files: `package-lock.json, pnpm-lock.yaml`

**Instead, store lightweight metadata**:
```typescript
if (isBinaryOrAsset(filePath)) {
  return {
    filePath,
    type: 'binary',
    size: content.length,
    fileType: getFileType(filePath),
    // No embedding, no content in context
  };
}
```

### Fast-Path Strategy (Hybrid Approach)

To avoid waiting for embeddings, use **instant keyword search** → **semantic search in background**:

```typescript
export class SmartContextBuilder {
  /**
   * FAST PATH: Instant keyword-based file selection
   * Shows results immediately while semantic search runs in background
   */
  static async buildContextFastPath(
    projectId: string,
    userPrompt: string
  ): Promise<{ instant: FileSet; semantic: Promise<FileSet> }> {
    
    // 1. INSTANT: Keyword search (0-50ms)
    const instantResults = this.keywordSearch(userPrompt, allFiles);
    
    // 2. BACKGROUND: Semantic search (100-500ms)
    const semanticPromise = EmbeddingService.searchRelevantFiles(
      projectId,
      userPrompt,
      { limit: 15, threshold: 0.3 }
    );
    
    return {
      instant: instantResults,    // Show these immediately in UI
      semantic: semanticPromise,  // Update UI when ready
    };
  }
  
  /**
   * Keyword search: Scan file paths and extract mentioned files
   */
  private static keywordSearch(
    prompt: string,
    allFiles: Record<string, string>
  ): string[] {
    const mentioned: string[] = [];
    const keywords = this.extractKeywords(prompt);
    
    // Match file paths containing keywords
    for (const [filePath, content] of Object.entries(allFiles)) {
      const pathLower = filePath.toLowerCase();
      
      // Check if file path matches keywords
      if (keywords.some(k => pathLower.includes(k))) {
        mentioned.push(filePath);
      }
      
      // Check for explicit file mentions: "in auth.ts" or "file: auth.ts"
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
```

### Real-Time UI Feedback

**Show users what's happening** to reduce perceived wait time:

```typescript
// Event types for UI updates
type FileActivityEvent = 
  | { type: 'file:analyzing', filePath: string, reason: string }
  | { type: 'file:selected', filePath: string, relevance: number }
  | { type: 'file:reading', filePath: string, size: number }
  | { type: 'file:editing', filePath: string, changes: string[] }
  | { type: 'file:skipped', filePath: string, reason: string }
  | { type: 'context:building', stats: ContextStats }
  | { type: 'context:ready', totalFiles: number, tokenCount: number };

// Emit events during context building
export class SmartContextBuilder {
  static async buildSmartContext(
    projectId: string,
    userPrompt: string,
    options: { onProgress?: (event: FileActivityEvent) => void } = {}
  ): Promise<SmartGenerationContext> {
    const { onProgress } = options;
    
    // Notify: Starting analysis
    onProgress?.({
      type: 'context:building',
      stats: { phase: 'analyzing', progress: 0 }
    });
    
    // Search for relevant files
    const searchResults = await EmbeddingService.searchRelevantFiles(
      projectId,
      userPrompt,
      { limit: 15, threshold: 0.3 }
    );
    
    // Notify: Files selected
    for (const result of searchResults) {
      onProgress?.({
        type: 'file:selected',
        filePath: result.filePath,
        relevance: result.similarity,
      });
    }
    
    // Load file contents
    const relevantFiles: Record<string, any> = {};
    for (const result of searchResults) {
      onProgress?.({
        type: 'file:reading',
        filePath: result.filePath,
        size: allFiles[result.filePath]?.length || 0,
      });
      
      if (allFiles[result.filePath]) {
        relevantFiles[result.filePath] = {
          content: allFiles[result.filePath],
          relevance: result.similarity,
          reason: this.generateRelevanceReason(result.similarity, result.fileType),
        };
      }
    }
    
    // Notify: Context ready
    onProgress?.({
      type: 'context:ready',
      totalFiles: Object.keys(relevantFiles).length,
      tokenCount: stats.totalTokens,
    });
    
    return context;
  }
}
```

**UI Component Example** (React):

```typescript
// components/FileActivityFeed.tsx
import { useState, useEffect } from 'react';
import { FileIcon, CheckCircle, Loader2 } from 'lucide-react';

interface FileActivity {
  filePath: string;
  status: 'analyzing' | 'selected' | 'reading' | 'editing' | 'complete';
  relevance?: number;
  timestamp: number;
}

export function FileActivityFeed({ projectId }: { projectId: string }) {
  const [activities, setActivities] = useState<FileActivity[]>([]);
  
  useEffect(() => {
    // Subscribe to streaming events
    const unsubscribe = streamingService.subscribe(projectId, (event) => {
      if (event.type.startsWith('file:')) {
        setActivities(prev => [
          ...prev,
          {
            filePath: event.filePath,
            status: event.type.split(':')[1] as any,
            relevance: event.relevance,
            timestamp: Date.now(),
          }
        ]);
      }
    });
    
    return unsubscribe;
  }, [projectId]);
  
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      <h3 className="text-sm font-semibold">File Activity</h3>
      {activities.map((activity, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {activity.status === 'complete' ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          
          <FileIcon className="w-4 h-4 text-gray-400" />
          
          <span className="flex-1 truncate font-mono text-xs">
            {activity.filePath}
          </span>
          
          {activity.relevance && (
            <span className="text-xs text-gray-500">
              {Math.round(activity.relevance * 100)}% match
            </span>
          )}
          
          <span className="text-xs text-gray-400 capitalize">
            {activity.status}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| **Initial Response** | < 100ms | Keyword search (instant feedback) |
| **Semantic Search** | < 500ms | Cached embeddings + pgvector |
| **Context Building** | < 2s | Parallel file loading + smart truncation |
| **First Token (AI)** | < 3s | Optimized prompt with relevant files only |
| **Total Time** | < 10s | End-to-end (search → context → AI start) |

### Cost Optimization Summary

**Embedding Costs** (per 1000 files, first time):
- OpenAI `text-embedding-3-small`: $0.020 / 1M tokens
- Average file: ~1000 tokens
- **Total**: $0.02 for 1000 files (one-time cost)
- **Subsequent uses**: $0 (cached by content_hash)

**Generation Costs** (per request):
- Without smart context: ~50K tokens × $2.50/1M = **$0.125/request**
- With smart context: ~15K tokens × $2.50/1M = **$0.0375/request**
- **Savings**: 70% per request

**Monthly Savings** (1000 requests):
- Old: $125/month
- New: $37.50/month + $0.02 embedding cost
- **Net savings**: $87.48/month (70%)

---

## Questions Answered ✅

1. ✅ **Embeddings**: OpenAI `text-embedding-3-small`
2. ✅ **Priority**: Cost + Accuracy (both optimized)
3. ✅ **Caching**: Multi-layer (in-memory + DB + content-hash)
4. ✅ **Binary files**: Skip embeddings, metadata only
5. ✅ **Real-time UX**: File activity feed + progress events
6. ✅ **Speed**: Hybrid approach (keyword instant + semantic background)

---

**This plan provides a production-ready approach to intelligent context management that scales with project size while dramatically reducing costs, improving AI accuracy, and providing excellent real-time user feedback.**
