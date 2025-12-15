'use client';

/**
 * File Reading Indicator Component
 * 
 * Displays real-time feedback about which files are being read for context.
 * Shows a collapsible list of files with clickable paths.
 * 
 * Requirements: 3.2, 3.6
 * - Display "Reading {file_path}" with clickable path
 * - Show collapsible list of files being read
 * - Use same styling as version card file links
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Eye, CheckCircle, Loader2 } from 'lucide-react';
import { ClickableFileLink } from './clickable-file-link';
import { TextShimmer } from './ui/text-shimmer';

/**
 * File reading status
 */
export type FileReadingStatus = 'reading' | 'complete';

/**
 * File reading item
 */
export interface FileReadingItem {
  path: string;
  status: FileReadingStatus;
  timestamp: number;
}

/**
 * Props for FileReadingIndicator component
 */
export interface FileReadingIndicatorProps {
  /** List of files being read or already read */
  files: FileReadingItem[];
  /** Whether file reading is currently in progress */
  isReading: boolean;
  /** Total count of files read (shown when complete) */
  totalCount?: number;
  /** Callback when a file path is clicked */
  onFileClick?: (path: string) => void;
  /** Whether the list is initially expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FileReadingIndicator Component
 * 
 * Shows which files are being read for context with:
 * - Animated "Reading..." indicator when active
 * - Collapsible list of file paths
 * - Clickable file paths that navigate to editor
 * - Completion summary when done
 * 
 * Usage:
 * ```tsx
 * <FileReadingIndicator
 *   files={[
 *     { path: 'src/auth.ts', status: 'reading', timestamp: Date.now() },
 *     { path: 'src/utils.ts', status: 'complete', timestamp: Date.now() - 1000 },
 *   ]}
 *   isReading={true}
 *   onFileClick={(path) => openFile(path)}
 * />
 * ```
 */
export function FileReadingIndicator({
  files,
  isReading,
  totalCount,
  onFileClick,
  defaultExpanded = false,
  className = '',
}: FileReadingIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Auto-expand when reading starts
  useEffect(() => {
    if (isReading && files.length > 0) {
      setIsExpanded(true);
    }
  }, [isReading, files.length]);

  // Get the currently reading file (most recent with 'reading' status)
  const currentlyReading = files.find(f => f.status === 'reading');
  const completedFiles = files.filter(f => f.status === 'complete');
  const readingFiles = files.filter(f => f.status === 'reading');
  
  // Calculate display count
  const displayCount = totalCount ?? files.length;

  if (files.length === 0 && !isReading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-lg border border-border bg-card/50 overflow-hidden ${className}`}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors"
      >
        {/* Expand/Collapse Icon */}
        <ChevronRight
          className={`size-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />

        {/* Status Icon */}
        {isReading ? (
          <Loader2 className="size-4 text-primary animate-spin flex-shrink-0" />
        ) : (
          <CheckCircle className="size-4 text-green-500 flex-shrink-0" />
        )}

        {/* Status Text */}
        <div className="flex-1 text-left">
          {isReading ? (
            <span className="text-sm">
              <TextShimmer as="span" duration={1.5} className="text-primary font-medium">
                Reading files for context
              </TextShimmer>
              {currentlyReading && (
                <span className="text-muted-foreground ml-1">
                  ({readingFiles.length} active)
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Read {displayCount} {displayCount === 1 ? 'file' : 'files'} for context
            </span>
          )}
        </div>

        {/* File Count Badge */}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {files.length}
        </span>
      </button>

      {/* Collapsible File List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
              {/* Currently Reading Files */}
              {readingFiles.map((file) => (
                <FileReadingRow
                  key={file.path}
                  file={file}
                  onFileClick={onFileClick}
                />
              ))}

              {/* Completed Files */}
              {completedFiles.map((file) => (
                <FileReadingRow
                  key={file.path}
                  file={file}
                  onFileClick={onFileClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Individual file reading row
 */
interface FileReadingRowProps {
  file: FileReadingItem;
  onFileClick?: (path: string) => void;
}

function FileReadingRow({ file, onFileClick }: FileReadingRowProps) {
  const isReading = file.status === 'reading';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 py-1 px-2 -mx-2 rounded ${
        isReading ? 'bg-primary/5' : 'hover:bg-muted/30'
      } transition-colors`}
    >
      {/* Status Icon */}
      {isReading ? (
        <Eye className="size-3 text-primary flex-shrink-0" />
      ) : (
        <CheckCircle className="size-3 text-green-500 flex-shrink-0" />
      )}

      {/* File Link */}
      <ClickableFileLink
        filename={file.path}
        status={isReading ? 'reading' : 'complete'}
        onClick={() => onFileClick?.(file.path)}
        showIcon={true}
        showStatus={false}
        className="flex-1 min-w-0"
      />

      {/* Status Text */}
      {isReading && (
        <span className="text-xs text-primary flex-shrink-0">
          Reading...
        </span>
      )}
    </motion.div>
  );
}

/**
 * Compact version of the file reading indicator
 * Shows just the current file being read without the full list
 */
export interface CompactFileReadingIndicatorProps {
  /** Current file being read */
  currentFile?: string;
  /** Whether reading is in progress */
  isReading: boolean;
  /** Callback when file path is clicked */
  onFileClick?: (path: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function CompactFileReadingIndicator({
  currentFile,
  isReading,
  onFileClick,
  className = '',
}: CompactFileReadingIndicatorProps) {
  if (!isReading || !currentFile) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={`flex items-center gap-2 text-sm ${className}`}
    >
      <Eye className="size-3 text-primary animate-pulse" />
      <span className="text-muted-foreground">Reading</span>
      <ClickableFileLink
        filename={currentFile}
        status="reading"
        onClick={() => onFileClick?.(currentFile)}
        showIcon={true}
        showStatus={false}
      />
    </motion.div>
  );
}

export default FileReadingIndicator;
