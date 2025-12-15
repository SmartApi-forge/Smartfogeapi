'use client';

/**
 * Clickable File Path Component
 * 
 * Renders file paths as clickable links with status indicators.
 * Reuses version card styling for consistency.
 * 
 * Requirements: 9.1, 9.4, 9.5, 9.6
 * - Render file paths as clickable links
 * - Support status indicators (reading, generating, modified, complete)
 * - Reuse version card styling
 */

import { motion } from 'framer-motion';
import { Eye, Loader2, FileEdit, Check, FileCode } from 'lucide-react';
import { FileTypeIcon } from './file-type-icon';
import { TextShimmer } from './ui/text-shimmer';

/**
 * Status types for file paths
 * - reading: File is being read for context
 * - generating: File is being generated/created
 * - modified: File has been modified
 * - complete: Operation on file is complete
 */
export type FilePathStatus = 'reading' | 'generating' | 'modified' | 'complete';

/**
 * Props for ClickableFilePath component
 */
export interface ClickableFilePathProps {
  /** The file path to display */
  path: string;
  /** Current status of the file operation */
  status?: FilePathStatus;
  /** Callback when the file path is clicked */
  onClick?: (path: string) => void;
  /** Whether to show the file type icon */
  showIcon?: boolean;
  /** Whether to show the status indicator */
  showStatus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ClickableFilePath Component
 * 
 * Displays a file path as a clickable link with:
 * - File type icon based on extension
 * - Status indicator (reading, generating, modified, complete)
 * - Shimmer animation for active states
 * - Hover effects matching version card styling
 * 
 * Usage:
 * ```tsx
 * <ClickableFilePath
 *   path="src/components/auth.tsx"
 *   status="generating"
 *   onClick={(path) => openFile(path)}
 * />
 * ```
 */
export function ClickableFilePath({
  path,
  status,
  onClick,
  showIcon = true,
  showStatus = true,
  className = '',
}: ClickableFilePathProps) {
  const isActive = status === 'reading' || status === 'generating';
  
  // Extract filename and directory path
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const hasDirectory = parts.length > 1;
  const directoryPath = hasDirectory ? parts.slice(0, -1).join('/') + '/' : '';
  
  /**
   * Get the appropriate icon for the current status
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'reading':
        return <Eye className="size-3 text-blue-500" />;
      case 'generating':
        return <Loader2 className="size-3 text-amber-500 animate-spin" />;
      case 'modified':
        return <FileEdit className="size-3 text-amber-500" />;
      case 'complete':
        return <Check className="size-3 text-green-500" />;
      default:
        return null;
    }
  };
  
  /**
   * Get the status text label
   */
  const getStatusText = () => {
    switch (status) {
      case 'reading':
        return 'Reading';
      case 'generating':
        return 'Generating';
      case 'modified':
        return 'Modified';
      case 'complete':
        return 'Complete';
      default:
        return null;
    }
  };

  /**
   * Get status-specific background color
   */
  const getStatusBackground = () => {
    switch (status) {
      case 'reading':
        return 'bg-blue-500/5';
      case 'generating':
        return 'bg-amber-500/5';
      case 'modified':
        return 'bg-amber-500/5';
      case 'complete':
        return 'bg-green-500/5';
      default:
        return '';
    }
  };
  
  const handleClick = () => {
    onClick?.(path);
  };
  
  return (
    <motion.button
      onClick={handleClick}
      className={`
        group inline-flex items-center gap-1.5 
        hover:bg-muted/50 px-2 py-0.5 rounded 
        transition-all duration-200
        text-left
        ${isActive ? getStatusBackground() : ''}
        ${className}
      `}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      title={`Click to open ${path}`}
    >
      {/* File Type Icon */}
      {showIcon && (
        <FileTypeIcon 
          filename={path} 
          size={14}
          className="flex-shrink-0"
        />
      )}
      
      {/* File Path & Name */}
      <span className="inline-flex items-baseline gap-0.5 text-xs font-mono min-w-0">
        {/* Directory path (muted) */}
        {hasDirectory && (
          <span className="text-muted-foreground truncate">{directoryPath}</span>
        )}
        
        {/* Filename with shimmer for active states */}
        {isActive ? (
          <TextShimmer 
            as="span"
            duration={1.5}
            className="font-medium text-foreground"
          >
            {filename}
          </TextShimmer>
        ) : (
          <span className={`font-medium group-hover:text-primary transition-colors truncate ${
            status === 'modified' ? 'text-amber-600 dark:text-amber-400' : 
            status === 'complete' ? 'text-green-600 dark:text-green-400' : 
            'text-foreground'
          }`}>
            {filename}
          </span>
        )}
      </span>
      
      {/* Status Indicator */}
      {showStatus && status && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          {getStatusIcon()}
          {isActive && (
            <span className="hidden sm:inline">{getStatusText()}</span>
          )}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Inline version of ClickableFilePath for use within text
 * More compact, no background, just underline on hover
 */
export interface InlineFilePathProps {
  /** The file path to display */
  path: string;
  /** Callback when the file path is clicked */
  onClick?: (path: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function InlineFilePath({
  path,
  onClick,
  className = '',
}: InlineFilePathProps) {
  return (
    <button
      onClick={() => onClick?.(path)}
      className={`
        inline-flex items-center gap-1
        text-primary hover:underline
        font-mono text-xs
        ${className}
      `}
      title={`Click to open ${path}`}
    >
      <FileTypeIcon filename={path} size={12} className="flex-shrink-0" />
      <span>{path}</span>
    </button>
  );
}

export default ClickableFilePath;
