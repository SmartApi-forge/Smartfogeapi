import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Layer 1: In-Memory Cache for embeddings (5 minute TTL)
const embeddingCache = new Map<string, { embedding: number[]; tokens: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

export interface SearchResult {
  filePath: string;
  similarity: number;
  tokens: number;
  language?: string;
  fileType?: string;
  imports?: string[];
  exports?: string[];
}

export class EmbeddingService {
  /**
   * Check if file should be embedded (exclude binary files and assets)
   */
  private static shouldEmbedFile(filePath: string): boolean {
    const skipExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
      '.mp4', '.mov', '.avi', '.webm',
      '.woff', '.woff2', '.ttf', '.eot',
      '.zip', '.tar', '.gz',
      '.map', '.min.js', '.bundle.js',
    ];
    
    const skipFiles = [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
    ];
    
    const pathLower = filePath.toLowerCase();
    
    // Check if file should be skipped
    if (skipExtensions.some(ext => pathLower.endsWith(ext))) {
      return false;
    }
    
    if (skipFiles.some(file => pathLower.includes(file))) {
      return false;
    }
    
    // Skip node_modules and .git
    if (pathLower.includes('node_modules') || pathLower.includes('.git')) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate embedding for a single file with multi-layer caching
   */
  static async embedFile(input: FileEmbeddingInput): Promise<FileEmbeddingResult> {
    const { projectId, versionId, filePath, content, language, imports, exports } = input;
    
    // Check if file should be embedded
    if (!this.shouldEmbedFile(filePath)) {
      console.log(`⊘ Skipping binary/asset file: ${filePath}`);
      throw new Error(`File ${filePath} should not be embedded (binary/asset)`);
    }
    
    // Calculate content hash for caching
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const cacheKey = `${projectId}:${filePath}:${contentHash}`;
    
    // Layer 1: Check in-memory cache (fastest - 0ms)
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`✓ In-memory cache hit for ${filePath}`);
      return {
        id: 'memory-cached',
        filePath,
        embedding: cached.embedding,
        tokens: cached.tokens,
      };
    }
    
    // Layer 2: Check database cache (fast - ~20ms)
    const { data: existing } = await supabase
      .from('file_embeddings')
      .select('id, embedding, tokens')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .eq('content_hash', contentHash)
      .maybeSingle();
    
    if (existing) {
      console.log(`✓ Database cache hit for ${filePath}`);
      
      // Store in memory cache for faster subsequent access
      embeddingCache.set(cacheKey, {
        embedding: existing.embedding,
        tokens: existing.tokens,
        timestamp: Date.now(),
      });
      
      return {
        id: existing.id,
        filePath,
        embedding: existing.embedding,
        tokens: existing.tokens,
      };
    }
    
    // Layer 3: Generate fresh embedding (slow - ~100-200ms)
    console.log(`🔄 Generating embedding for ${filePath}...`);
    const embeddingText = this.prepareFileForEmbedding(filePath, content, language);
    
    try {
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
      
      // Store in memory cache
      embeddingCache.set(cacheKey, {
        embedding,
        tokens,
        timestamp: Date.now(),
      });
      
      console.log(`✓ Embedded ${filePath} (${tokens} tokens)`);
      
      return {
        id: data.id,
        filePath,
        embedding,
        tokens,
      };
    } catch (error: any) {
      console.error(`❌ Failed to embed ${filePath}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Embed multiple files in batch with rate limiting
   */
  static async embedFiles(
    files: FileEmbeddingInput[],
    options: {
      onProgress?: (completed: number, total: number, filePath: string) => void;
    } = {}
  ): Promise<FileEmbeddingResult[]> {
    const { onProgress } = options;
    const results: FileEmbeddingResult[] = [];
    const BATCH_SIZE = 50; // OpenAI limit
    const DELAY_MS = 100; // Rate limit delay
    
    // Filter out files that shouldn't be embedded
    const filesToEmbed = files.filter(f => this.shouldEmbedFile(f.filePath));
    const skippedCount = files.length - filesToEmbed.length;
    
    if (skippedCount > 0) {
      console.log(`⊘ Skipped ${skippedCount} binary/asset files`);
    }
    
    console.log(`📦 Embedding ${filesToEmbed.length} files...`);
    
    for (let i = 0; i < filesToEmbed.length; i += BATCH_SIZE) {
      const batch = filesToEmbed.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filesToEmbed.length / BATCH_SIZE)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (file, idx) => {
          try {
            const result = await this.embedFile(file);
            
            // Report progress
            if (onProgress) {
              onProgress(i + idx + 1, filesToEmbed.length, file.filePath);
            }
            
            return result;
          } catch (error: any) {
            console.error(`Failed to embed ${file.filePath}:`, error.message);
            return null;
          }
        })
      );
      
      results.push(...batchResults.filter(r => r !== null) as FileEmbeddingResult[]);
      
      // Rate limiting delay between batches
      if (i + BATCH_SIZE < filesToEmbed.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    console.log(`✓ Successfully embedded ${results.length}/${filesToEmbed.length} files`);
    
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
  ): Promise<SearchResult[]> {
    const { versionId, limit = 10, threshold = 0.5, fileTypes } = options;
    
    try {
      // Generate query embedding
      console.log(`🔍 Searching for: "${query}"`);
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float',
      });
      
      const queryEmbedding = response.data[0].embedding;
      
      // Call RPC function for vector similarity search
      const { data, error } = await supabase.rpc('search_file_embeddings', {
        query_embedding: queryEmbedding,
        project_id: projectId,
        version_id: versionId || null,
        similarity_threshold: threshold,
        match_limit: limit,
        file_types: fileTypes || null,
      });
      
      if (error) {
        console.error('Vector search error:', error);
        throw new Error(`Failed to search embeddings: ${error.message}`);
      }
      
      const results = (data || []) as SearchResult[];
      console.log(`✓ Found ${results.length} relevant files`);
      
      return results;
    } catch (error: any) {
      console.error('Search error:', error.message);
      return [];
    }
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
    const MAX_CHARS = 8000; // ~2000 tokens for text-embedding-3-small
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
    
    // Clear memory cache for this project
    for (const key of embeddingCache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        embeddingCache.delete(key);
      }
    }
    
    console.log(`✓ Deleted embeddings for project ${projectId}${versionId ? ` version ${versionId}` : ''}`);
  }
  
  /**
   * Clear expired items from in-memory cache
   */
  static clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of embeddingCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL) {
        embeddingCache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`✓ Cleared ${cleared} expired cache entries`);
    }
  }
  
  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    entries: number;
  } {
    return {
      size: embeddingCache.size,
      entries: embeddingCache.size,
    };
  }
}

// Auto-cleanup expired cache entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    EmbeddingService.clearExpiredCache();
  }, 5 * 60 * 1000);
}
