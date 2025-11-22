'use client';

import { FileIcon, Loader2, FileEdit, Eye } from 'lucide-react';
import { FileTypeIcon } from './file-type-icon';
import { TextShimmer } from './ui/text-shimmer';
import { motion } from 'framer-motion';

export interface ClickableFileLinkProps {
  filename: string;
  status?: 'reading' | 'writing' | 'complete' | 'idle';
  onClick?: () => void;
  showIcon?: boolean;
  showStatus?: boolean;
  className?: string;
}

/**
 * Clickable File Link Component
 * 
 * Displays a file name with:
 * - Shimmer animation when reading/writing
 * - Icon based on file type
 * - Status indicator
 * - Clickable to navigate to file in editor
 * 
 * Usage:
 * ```tsx
 * <ClickableFileLink
 *   filename="src/auth.ts"
 *   status="writing"
 *   onClick={() => handleFileClick('src/auth.ts')}
 * />
 * ```
 */
export function ClickableFileLink({
  filename,
  status = 'idle',
  onClick,
  showIcon = true,
  showStatus = true,
  className = '',
}: ClickableFileLinkProps) {
  const isActive = status === 'reading' || status === 'writing';
  
  // Extract just the filename (last part of path)
  const parts = filename.split('/');
  const displayName = parts[parts.length - 1];
  const hasPath = parts.length > 1;
  const pathPrefix = hasPath ? parts.slice(0, -1).join('/') + '/' : '';
  
  const getStatusIcon = () => {
    switch (status) {
      case 'reading':
        return <Eye className="size-3 text-blue-500" />;
      case 'writing':
        return <Loader2 className="size-3 text-green-500 animate-spin" />;
      case 'complete':
        return <span className="text-green-500 text-xs">✓</span>;
      default:
        return null;
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'reading':
        return 'Reading';
      case 'writing':
        return 'Writing';
      case 'complete':
        return 'Complete';
      default:
        return null;
    }
  };
  
  return (
    <motion.button
      onClick={onClick}
      className={`
        group inline-flex items-center gap-1.5 
        hover:bg-muted/50 px-2 py-0.5 rounded 
        transition-all duration-200
        ${isActive ? 'bg-primary/5' : ''}
        ${className}
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* File Icon */}
      {showIcon && (
        <FileTypeIcon 
          filename={filename} 
          size={14}
          className="flex-shrink-0"
        />
      )}
      
      {/* File Path & Name */}
      <span className="inline-flex items-baseline gap-0.5 text-xs font-mono">
        {hasPath && (
          <span className="text-muted-foreground">{pathPrefix}</span>
        )}
        
        {isActive ? (
          <TextShimmer 
            as="span"
            duration={1.5}
            className="font-medium text-primary"
          >
            {displayName}
          </TextShimmer>
        ) : (
          <span className="font-medium group-hover:text-primary transition-colors">
            {displayName}
          </span>
        )}
      </span>
      
      {/* Status Indicator */}
      {showStatus && status !== 'idle' && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {getStatusIcon()}
          {isActive && <span className="hidden sm:inline">{getStatusText()}</span>}
        </span>
      )}
    </motion.button>
  );
}
