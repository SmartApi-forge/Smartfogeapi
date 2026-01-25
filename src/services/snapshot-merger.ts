/**
 * SnapshotMerger Utility
 * 
 * Merges new file changes with existing file snapshots.
 * Preserves unchanged files and updates changed files.
 * Handles partial edits with `// ... existing code ...` markers.
 * 
 * Requirements: 3.3, 16.5
 */

import type { FileSnapshotData, FileChange } from '../types/database';
import type { ParsedFile } from './code-block-parser';
import { mergePartialEdit, hasPartialEditMarkers } from './partial-edit-merger';

export interface MergeResult {
  /** The merged snapshot data */
  snapshot: FileSnapshotData;
  /** List of changes that were applied */
  changes: FileChange[];
  /** Total number of files in the merged snapshot */
  fileCount: number;
  /** Total size in bytes of all files */
  totalSizeBytes: number;
}

/**
 * Detect the language from a file path based on extension.
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.includes('.') 
    ? '.' + filePath.split('.').pop()?.toLowerCase()
    : '';

  const extensionMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.json': 'json',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.py': 'python',
    '.sql': 'sql',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.svg': 'svg',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.astro': 'astro',
    '.prisma': 'prisma',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.env': 'env',
    '.txt': 'text'
  };

  return extensionMap[ext] || 'text';
}

/**
 * Merge new files with an existing snapshot.
 * 
 * Requirements:
 * - 3.3: Merge changes with the existing snapshot to create a new snapshot
 * 
 * @param existingSnapshot - The current file snapshot (can be null for new projects)
 * @param newFiles - Array of new/modified files from code generation
 * @param reason - Optional reason for the changes (used in change records)
 * @returns MergeResult containing the merged snapshot and change records
 */
export function mergeSnapshots(
  existingSnapshot: FileSnapshotData | null,
  newFiles: ParsedFile[],
  reason: string = 'Code generation'
): MergeResult {
  // Start with existing files or empty object
  const mergedSnapshot: FileSnapshotData = existingSnapshot 
    ? { ...existingSnapshot } 
    : {};
  
  const changes: FileChange[] = [];

  // Process each new file
  for (const file of newFiles) {
    const existingFile = mergedSnapshot[file.path];
    let finalContent = file.content;
    
    if (existingFile) {
      // File exists - check if new content has partial edit markers
      // Requirements: 16.5 - Merge partial edits with existing content
      if (hasPartialEditMarkers(file.content)) {
        const mergeResult = mergePartialEdit(existingFile.content, file.content);
        if (mergeResult.success) {
          finalContent = mergeResult.content;
          console.log(`[SnapshotMerger] Merged partial edit for ${file.path} (${mergeResult.markersProcessed} markers)`);
        } else {
          console.warn(`[SnapshotMerger] Failed to merge partial edit for ${file.path}: ${mergeResult.error}`);
          // Fall back to using the new content as-is
        }
      }
      
      // Check if content actually changed after potential merge
      if (existingFile.content !== finalContent) {
        changes.push({
          file: file.path,
          action: 'modify',
          reason
        });
      }
    } else {
      // New file - if it has partial edit markers but no existing file, strip the markers
      if (hasPartialEditMarkers(file.content)) {
        console.warn(`[SnapshotMerger] New file ${file.path} has partial edit markers but no existing content to merge`);
        // For new files with markers, we can't merge so just use as-is
        // The markers will remain but at least the file is created
      }
      
      changes.push({
        file: file.path,
        action: 'create',
        reason
      });
    }

    // Update or add the file with final (potentially merged) content
    mergedSnapshot[file.path] = {
      content: finalContent,
      language: file.language || detectLanguage(file.path),
      size: new TextEncoder().encode(finalContent).length
    };
  }

  // Calculate totals
  const filePaths = Object.keys(mergedSnapshot);
  const fileCount = filePaths.length;
  const totalSizeBytes = filePaths.reduce(
    (sum, path) => sum + mergedSnapshot[path].size,
    0
  );

  return {
    snapshot: mergedSnapshot,
    changes,
    fileCount,
    totalSizeBytes
  };
}

/**
 * Delete files from a snapshot.
 * 
 * @param existingSnapshot - The current file snapshot
 * @param filesToDelete - Array of file paths to delete
 * @param reason - Optional reason for the deletion
 * @returns MergeResult containing the updated snapshot and change records
 */
export function deleteFromSnapshot(
  existingSnapshot: FileSnapshotData,
  filesToDelete: string[],
  reason: string = 'File deletion'
): MergeResult {
  const mergedSnapshot: FileSnapshotData = { ...existingSnapshot };
  const changes: FileChange[] = [];

  for (const filePath of filesToDelete) {
    if (mergedSnapshot[filePath]) {
      delete mergedSnapshot[filePath];
      changes.push({
        file: filePath,
        action: 'delete',
        reason
      });
    }
  }

  // Calculate totals
  const filePaths = Object.keys(mergedSnapshot);
  const fileCount = filePaths.length;
  const totalSizeBytes = filePaths.reduce(
    (sum, path) => sum + mergedSnapshot[path].size,
    0
  );

  return {
    snapshot: mergedSnapshot,
    changes,
    fileCount,
    totalSizeBytes
  };
}

/**
 * Create an initial snapshot from a list of files.
 * Used when importing from GitHub or creating a new project.
 * 
 * @param files - Array of files to include in the snapshot
 * @returns MergeResult containing the new snapshot
 */
export function createInitialSnapshot(files: ParsedFile[]): MergeResult {
  return mergeSnapshots(null, files, 'Initial project setup');
}

/**
 * Get the list of file paths in a snapshot.
 */
export function getSnapshotFilePaths(snapshot: FileSnapshotData): string[] {
  return Object.keys(snapshot);
}

/**
 * Get a specific file from a snapshot.
 */
export function getFileFromSnapshot(
  snapshot: FileSnapshotData,
  filePath: string
): { content: string; language: string; size: number } | null {
  return snapshot[filePath] || null;
}

/**
 * SnapshotMerger service interface
 */
export const snapshotMerger = {
  merge: mergeSnapshots,
  delete: deleteFromSnapshot,
  createInitial: createInitialSnapshot,
  getFilePaths: getSnapshotFilePaths,
  getFile: getFileFromSnapshot,
  detectLanguage
};

export default snapshotMerger;
