/**
 * FileTracker Service
 * 
 * Tracks file changes using content hashes (SHA-256) for efficient re-indexing.
 * Uses Merkle tree comparison to identify only changed files.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileChanges, FileHashEntry, IFileTracker } from '../types/context-management';

/**
 * Database row type for file_hashes table
 */
interface FileHashRow {
  id: string;
  project_id: string;
  version_id: string | null;
  file_path: string;
  content_hash: string;
  file_size: number | null;
  created_at: string;
}

/**
 * Lazy-load supabase client to avoid initialization errors in tests
 */
let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    // Dynamic import to avoid initialization at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../../lib/supabase');
    _supabaseClient = supabase;
  }
  return _supabaseClient!;
}

/**
 * FileTracker implementation
 * Provides content hashing and change detection for project files
 */
export class FileTracker implements IFileTracker {
  private supabaseClient: SupabaseClient | null;

  /**
   * Create a FileTracker instance
   * @param supabaseClient - Optional Supabase client for dependency injection (useful for testing)
   */
  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient || null;
  }

  /**
   * Get the Supabase client (lazy-loaded or injected)
   */
  private getClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    return getSupabaseClient();
  }
  /**
   * Compute SHA-256 hash of file content
   * 
   * Property 4: Hash Determinism
   * For any file content, computing the hash twice SHALL produce identical results.
   * 
   * @param content - The file content to hash
   * @returns SHA-256 hash as hex string
   */
  computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Get stored file hashes for a project
   * 
   * Retrieves the latest file hashes from the database for efficient
   * change detection using Merkle tree comparison.
   * 
   * @param projectId - The project ID
   * @returns Map of file paths to content hashes
   */
  async getFileHashes(projectId: string): Promise<Map<string, string>> {
    const { data, error } = await this.getClient()
      .from('file_hashes')
      .select('file_path, content_hash')
      .eq('project_id', projectId)
      .is('version_id', null) // Get current state (not version-specific)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching file hashes:', error);
      return new Map();
    }

    // Build map from results, using only the most recent hash per file
    const hashMap = new Map<string, string>();
    const seenPaths = new Set<string>();
    
    for (const row of data || []) {
      if (!seenPaths.has(row.file_path)) {
        hashMap.set(row.file_path, row.content_hash);
        seenPaths.add(row.file_path);
      }
    }

    return hashMap;
  }

  /**
   * Get file hashes for a specific version
   * 
   * @param projectId - The project ID
   * @param versionId - The version ID
   * @returns Map of file paths to content hashes
   */
  async getFileHashesForVersion(
    projectId: string,
    versionId: string
  ): Promise<Map<string, string>> {
    const { data, error } = await this.getClient()
      .from('file_hashes')
      .select('file_path, content_hash')
      .eq('project_id', projectId)
      .eq('version_id', versionId);

    if (error) {
      console.error('Error fetching version file hashes:', error);
      return new Map();
    }

    const hashMap = new Map<string, string>();
    for (const row of data || []) {
      hashMap.set(row.file_path, row.content_hash);
    }

    return hashMap;
  }

  /**
   * Detect changes between old and new file states
   * 
   * Property 5: Change Detection Accuracy
   * For any two file states, the FileTracker SHALL correctly identify 
   * all added, modified, deleted, and unchanged files.
   * 
   * @param oldHashes - Previous file hashes
   * @param newFiles - Current file contents
   * @returns FileChanges object with categorized files
   */
  detectChanges(
    oldHashes: Map<string, string>,
    newFiles: Record<string, string>
  ): FileChanges {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    // Check each new file
    for (const [path, content] of Object.entries(newFiles)) {
      const newHash = this.computeHash(content);
      const oldHash = oldHashes.get(path);

      if (oldHash === undefined) {
        // File doesn't exist in old state - it's new
        added.push(path);
      } else if (oldHash !== newHash) {
        // File exists but hash changed - it's modified
        modified.push(path);
      } else {
        // File exists and hash matches - unchanged
        unchanged.push(path);
      }
    }

    // Check for deleted files (in old but not in new)
    for (const path of oldHashes.keys()) {
      if (!(path in newFiles)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted, unchanged };
  }

  /**
   * Update stored hashes for a project
   * 
   * Persists the current file hashes to the database for future
   * change detection. Uses upsert to handle both new and existing files.
   * 
   * @param projectId - The project ID
   * @param files - Current file contents
   * @param versionId - Optional version ID to associate hashes with
   */
  async updateHashes(
    projectId: string,
    files: Record<string, string>,
    versionId?: string
  ): Promise<void> {
    if (Object.keys(files).length === 0) {
      return;
    }

    // Compute hashes for all files
    const hashEntries = this.computeAllHashes(files);

    // Prepare records for upsert
    const records = hashEntries.map(entry => ({
      project_id: projectId,
      version_id: versionId || null,
      file_path: entry.path,
      content_hash: entry.hash,
      file_size: entry.size,
    }));

    // If no versionId, delete existing current-state hashes first
    // to ensure we have a clean slate
    if (!versionId) {
      const { error: deleteError } = await this.getClient()
        .from('file_hashes')
        .delete()
        .eq('project_id', projectId)
        .is('version_id', null);

      if (deleteError) {
        console.error('Error deleting old file hashes:', deleteError);
        throw new Error(`Failed to clear old file hashes: ${deleteError.message}`);
      }
    }

    // Insert new hashes in batches to avoid hitting limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      const { error } = await this.getClient()
        .from('file_hashes')
        .insert(batch);

      if (error) {
        console.error('Error inserting file hashes:', error);
        throw new Error(`Failed to update file hashes: ${error.message}`);
      }
    }
  }

  /**
   * Delete all hashes for a project
   * 
   * @param projectId - The project ID
   */
  async deleteProjectHashes(projectId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('file_hashes')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting project hashes:', error);
      throw new Error(`Failed to delete project hashes: ${error.message}`);
    }
  }

  /**
   * Compute hashes for all files
   * 
   * @param files - File contents
   * @returns Array of FileHashEntry objects
   */
  computeAllHashes(files: Record<string, string>): FileHashEntry[] {
    return Object.entries(files).map(([path, content]) => ({
      path,
      hash: this.computeHash(content),
      size: content.length,
    }));
  }

  /**
   * Get files that need re-indexing based on hash changes
   * 
   * Compares current files against stored hashes and returns
   * only the files that have been added or modified.
   * 
   * @param projectId - The project ID
   * @param currentFiles - Current file contents
   * @returns Object with files needing re-indexing and deleted file paths
   */
  async getFilesNeedingReindex(
    projectId: string,
    currentFiles: Record<string, string>
  ): Promise<{ filesToReindex: Record<string, string>; deletedPaths: string[] }> {
    const oldHashes = await this.getFileHashes(projectId);
    const changes = this.detectChanges(oldHashes, currentFiles);

    // Files to reindex are added + modified files
    const filesToReindex: Record<string, string> = {};
    for (const path of [...changes.added, ...changes.modified]) {
      filesToReindex[path] = currentFiles[path];
    }

    return {
      filesToReindex,
      deletedPaths: changes.deleted,
    };
  }
}

// Export singleton instance
export const fileTracker = new FileTracker();
