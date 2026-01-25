import { createClient } from '@supabase/supabase-js';
import type { 
  Version, 
  CreateVersionInput, 
  UpdateVersionInput,
  VersionComparison,
  FileDiff,
  DetailedFileDiff,
  DetailedVersionComparison,
  LineDiff,
  CreateCompleteVersionInput,
  RestoreVersionInput,
} from '../modules/versions/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Version Manager Service
 * Handles all version-related database operations
 * Stores FULL file snapshots, not diffs
 */
export class VersionManager {
  /**
   * Create a new version
   */
  static async createVersion(input: CreateVersionInput): Promise<Version> {
    const { data, error } = await supabase
      .from('versions')
      .insert({
        project_id: input.project_id,
        version_number: input.version_number,
        name: input.name,
        description: input.description || null,
        files: input.files,
        command_type: input.command_type || null,
        prompt: input.prompt,
        parent_version_id: input.parent_version_id || null,
        status: input.status || 'generating',
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating version:', error);
      throw new Error(`Failed to create version: ${error.message}`);
    }

    return data as Version;
  }

  /**
   * Get a specific version by ID
   */
  static async getVersion(id: string): Promise<Version> {
    const { data, error } = await supabase
      .from('versions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching version:', error);
      throw new Error(`Failed to fetch version: ${error.message}`);
    }

    if (!data) {
      throw new Error('Version not found');
    }

    return data as Version;
  }

  /**
   * Get all versions for a project
   */
  static async listVersions(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Version[]> {
    const { data, error } = await supabase
      .from('versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error listing versions:', error);
      throw new Error(`Failed to list versions: ${error.message}`);
    }

    return (data || []) as Version[];
  }

  /**
   * Get the latest version for a project
   */
  static async getLatestVersion(projectId: string): Promise<Version | null> {
    const { data, error } = await supabase
      .from('versions')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'complete')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest version:', error);
      throw new Error(`Failed to fetch latest version: ${error.message}`);
    }

    return data as Version | null;
  }

  /**
   * Get the next version number for a project
   */
  static async getNextVersionNumber(projectId: string): Promise<number> {
    const { data, error } = await supabase
      .from('versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching version number:', error);
      return 1; // Default to version 1
    }

    if (!data) {
      return 1;
    }

    return (data.version_number || 0) + 1;
  }

  /**
   * Update a version
   */
  static async updateVersion(
    id: string,
    updates: UpdateVersionInput
  ): Promise<Version> {
    const { data, error } = await supabase
      .from('versions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating version:', error);
      throw new Error(`Failed to update version: ${error.message}`);
    }

    return data as Version;
  }

  /**
   * Delete a version
   */
  static async deleteVersion(id: string): Promise<void> {
    const { error } = await supabase
      .from('versions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting version:', error);
      throw new Error(`Failed to delete version: ${error.message}`);
    }
  }

  /**
   * Compare two versions and generate diff
   * For UI display only - actual storage uses full snapshots
   */
  static compareVersions(version1: Version, version2: Version): VersionComparison {
    const diffs: FileDiff[] = [];
    const files1 = version1.files || {};
    const files2 = version2.files || {};
    
    const allFiles = new Set([
      ...Object.keys(files1),
      ...Object.keys(files2),
    ]);

    let filesAdded = 0;
    let filesModified = 0;
    let filesDeleted = 0;
    let filesUnchanged = 0;

    for (const filename of allFiles) {
      const content1 = files1[filename];
      const content2 = files2[filename];

      if (!content1 && content2) {
        // File was added
        diffs.push({
          filename,
          status: 'added',
          newContent: content2,
        });
        filesAdded++;
      } else if (content1 && !content2) {
        // File was deleted
        diffs.push({
          filename,
          status: 'deleted',
          oldContent: content1,
        });
        filesDeleted++;
      } else if (content1 !== content2) {
        // File was modified
        diffs.push({
          filename,
          status: 'modified',
          oldContent: content1,
          newContent: content2,
        });
        filesModified++;
      } else {
        // File unchanged
        diffs.push({
          filename,
          status: 'unchanged',
          oldContent: content1,
          newContent: content2,
        });
        filesUnchanged++;
      }
    }

    return {
      version1,
      version2,
      diffs,
      summary: {
        filesAdded,
        filesModified,
        filesDeleted,
        filesUnchanged,
      },
    };
  }

  /**
   * Get version count for a project
   */
  static async getVersionCount(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from('versions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error counting versions:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get version history chain (follow parent_version_id)
   */
  static async getVersionHistory(versionId: string): Promise<Version[]> {
    const history: Version[] = [];
    let currentId: string | null = versionId;

    while (currentId) {
      const version = await this.getVersion(currentId);
      history.push(version);
      currentId = version.parent_version_id;
    }

    return history.reverse(); // Return oldest to newest
  }

  /**
   * Mark version as complete
   */
  static async markComplete(id: string): Promise<Version> {
    return this.updateVersion(id, { status: 'complete' });
  }

  /**
   * Mark version as failed
   */
  static async markFailed(id: string): Promise<Version> {
    return this.updateVersion(id, { status: 'failed' });
  }

  /**
   * Create a new version with complete file snapshot
   * Merges parent files with changes to ensure complete snapshot
   * Requirements: 5.1
   */
  static async createCompleteVersion(
    input: CreateCompleteVersionInput
  ): Promise<Version> {
    // Get the latest version to use as parent
    const parentVersion = await this.getLatestVersion(input.project_id);
    
    // Start with parent files or empty object
    const parentFiles = parentVersion?.files || {};
    
    // Merge parent files with changes
    const completeFiles = this.mergeFilesWithChanges(
      parentFiles,
      input.changes,
      input.deletedFiles || []
    );
    
    // Get next version number
    const versionNumber = await this.getNextVersionNumber(input.project_id);
    
    // Create the version with complete snapshot
    const createInput: CreateVersionInput = {
      project_id: input.project_id,
      version_number: versionNumber,
      name: input.name,
      description: input.description,
      files: completeFiles,
      command_type: input.command_type,
      prompt: input.prompt,
      parent_version_id: parentVersion?.id,
      status: 'generating',
      metadata: input.metadata || {},
    };
    
    return this.createVersion(createInput);
  }

  /**
   * Merge parent files with changes
   * Ensures new version contains all parent files plus changes
   * Requirements: 5.1
   */
  static mergeFilesWithChanges(
    parentFiles: Record<string, string>,
    changes: Record<string, string>,
    deletedFiles: string[]
  ): Record<string, string> {
    // Start with a copy of parent files
    const result: Record<string, string> = { ...parentFiles };
    
    // Remove deleted files
    for (const deletedFile of deletedFiles) {
      delete result[deletedFile];
    }
    
    // Apply changes (add new files or update existing)
    for (const [path, content] of Object.entries(changes)) {
      result[path] = content;
    }
    
    return result;
  }

  /**
   * Restore a version by creating a new version with the restored file state
   * Requirements: 5.3
   */
  static async restoreVersion(input: RestoreVersionInput): Promise<Version> {
    // Get the version to restore
    const versionToRestore = await this.getVersion(input.versionId);
    
    // Create a new version with the restored files
    const createInput: CreateCompleteVersionInput = {
      project_id: versionToRestore.project_id,
      name: `Restored from v${versionToRestore.version_number}`,
      description: `Restored from version ${versionToRestore.version_number}: ${versionToRestore.name}`,
      changes: versionToRestore.files, // Use all files from restored version
      deletedFiles: [], // No deletions - we want exact state
      prompt: input.prompt || `Restore to version ${versionToRestore.version_number}`,
      metadata: {
        restoredFrom: versionToRestore.id,
        restoredFromVersion: versionToRestore.version_number,
      },
    };
    
    return this.createCompleteVersion(createInput);
  }

  /**
   * Generate line-level diffs between two strings
   * Uses a simple LCS-based diff algorithm
   * Requirements: 5.2
   */
  static generateLineDiffs(
    oldContent: string | undefined,
    newContent: string | undefined
  ): LineDiff[] {
    const oldLines = oldContent ? oldContent.split('\n') : [];
    const newLines = newContent ? newContent.split('\n') : [];
    
    const diffs: LineDiff[] = [];
    
    // Use LCS (Longest Common Subsequence) based diff
    const lcs = this.computeLCS(oldLines, newLines);
    
    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;
    let oldLineNum = 1;
    let newLineNum = 1;
    
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (lcsIdx < lcs.length && 
          oldIdx < oldLines.length && 
          newIdx < newLines.length &&
          oldLines[oldIdx] === lcs[lcsIdx] && 
          newLines[newIdx] === lcs[lcsIdx]) {
        // Unchanged line
        diffs.push({
          lineNumber: newLineNum,
          type: 'unchanged',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
        oldLineNum++;
        newLineNum++;
      } else if (oldIdx < oldLines.length && 
                 (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
        // Removed line
        diffs.push({
          lineNumber: oldLineNum,
          type: 'removed',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        });
        oldIdx++;
        oldLineNum++;
      } else if (newIdx < newLines.length) {
        // Added line
        diffs.push({
          lineNumber: newLineNum,
          type: 'added',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        });
        newIdx++;
        newLineNum++;
      }
    }
    
    return diffs;
  }

  /**
   * Compute Longest Common Subsequence of two arrays
   * Used for line-level diff generation
   */
  private static computeLCS(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    
    // Create DP table
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;
    
    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        lcs.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return lcs;
  }

  /**
   * Generate detailed file diff with line-level changes
   * Requirements: 5.2
   */
  static generateDetailedFileDiff(
    filename: string,
    oldContent: string | undefined,
    newContent: string | undefined
  ): DetailedFileDiff {
    let status: 'added' | 'modified' | 'deleted' | 'unchanged';
    
    if (!oldContent && newContent) {
      status = 'added';
    } else if (oldContent && !newContent) {
      status = 'deleted';
    } else if (oldContent !== newContent) {
      status = 'modified';
    } else {
      status = 'unchanged';
    }
    
    const lineDiffs = this.generateLineDiffs(oldContent, newContent);
    
    const stats = {
      linesAdded: lineDiffs.filter(d => d.type === 'added').length,
      linesRemoved: lineDiffs.filter(d => d.type === 'removed').length,
      linesUnchanged: lineDiffs.filter(d => d.type === 'unchanged').length,
    };
    
    return {
      filename,
      status,
      oldContent,
      newContent,
      lineDiffs,
      stats,
    };
  }

  /**
   * Compare two versions with detailed line-level diffs
   * Requirements: 5.2
   */
  static compareVersionsDetailed(
    version1: Version,
    version2: Version
  ): DetailedVersionComparison {
    const diffs: DetailedFileDiff[] = [];
    const files1 = version1.files || {};
    const files2 = version2.files || {};
    
    const allFiles = new Set([
      ...Object.keys(files1),
      ...Object.keys(files2),
    ]);

    let filesAdded = 0;
    let filesModified = 0;
    let filesDeleted = 0;
    let filesUnchanged = 0;
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;

    for (const filename of allFiles) {
      const content1 = files1[filename];
      const content2 = files2[filename];
      
      const detailedDiff = this.generateDetailedFileDiff(filename, content1, content2);
      diffs.push(detailedDiff);
      
      // Update summary counts
      switch (detailedDiff.status) {
        case 'added':
          filesAdded++;
          break;
        case 'modified':
          filesModified++;
          break;
        case 'deleted':
          filesDeleted++;
          break;
        case 'unchanged':
          filesUnchanged++;
          break;
      }
      
      totalLinesAdded += detailedDiff.stats.linesAdded;
      totalLinesRemoved += detailedDiff.stats.linesRemoved;
    }

    return {
      version1,
      version2,
      diffs,
      summary: {
        filesAdded,
        filesModified,
        filesDeleted,
        filesUnchanged,
        totalLinesAdded,
        totalLinesRemoved,
      },
    };
  }

  /**
   * Get children versions (versions that have this version as parent)
   * Requirements: 5.4
   */
  static async getChildVersions(versionId: string): Promise<Version[]> {
    const { data, error } = await supabase
      .from('versions')
      .select('*')
      .eq('parent_version_id', versionId)
      .order('version_number', { ascending: true });

    if (error) {
      console.error('Error fetching child versions:', error);
      throw new Error(`Failed to fetch child versions: ${error.message}`);
    }

    return (data || []) as Version[];
  }

  /**
   * Get the full version tree for a project
   * Returns versions with their parent relationships
   * Requirements: 5.4
   */
  static async getVersionTree(projectId: string): Promise<{
    versions: Version[];
    relationships: { parentId: string | null; childId: string }[];
  }> {
    const versions = await this.listVersions(projectId, 1000, 0);
    
    const relationships = versions
      .filter(v => v.parent_version_id)
      .map(v => ({
        parentId: v.parent_version_id,
        childId: v.id,
      }));
    
    return { versions, relationships };
  }
}

