'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Edit, Sparkles, Trash2, FileCode2 } from 'lucide-react';
import type { Version } from '../src/modules/versions/types';
import { FileTypeIcon } from './file-type-icon';

interface VersionCardProps {
  version: Version;
  isActive: boolean;
  onClick: () => void;
  previousVersion?: Version;
  onFileClick?: (filename: string) => void;
}

/**
 * Version Card Component
 * Displays a single version with collapsible file list
 * Shows version number, name, and file changes
 */
export function VersionCard({ version, isActive, onClick, previousVersion, onFileClick }: VersionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const files = Object.keys(version.files || {});
  const fileCount = files.length;

  // Calculate file changes compared to previous version
  const getFileStatus = (filename: string): 'new' | 'modified' | 'unchanged' => {
    if (!previousVersion) return 'new';
    
    const previousFiles = previousVersion.files || {};
    if (!previousFiles[filename]) return 'new';
    if (previousFiles[filename] !== version.files[filename]) return 'modified';
    return 'unchanged';
  };

  const filesGrouped = {
    new: files.filter(f => getFileStatus(f) === 'new'),
    modified: files.filter(f => getFileStatus(f) === 'modified'),
    unchanged: files.filter(f => getFileStatus(f) === 'unchanged'),
  };

  const getVersionIcon = () => {
    switch (version.command_type) {
      case 'CREATE':
        return <Sparkles className="size-4 text-blue-500" />;
      case 'MODIFY':
        return <Edit className="size-4 text-amber-500" />;
      case 'CREATE_AND_LINK':
        return <FileCode2 className="size-4 text-purple-500" />;
      case 'FIX_ERROR':
        return <FileCode2 className="size-4 text-red-500" />;
      case 'QUESTION':
        return <FileCode2 className="size-4 text-green-500" />;
      default:
        return <FileCode2 className="size-4 text-green-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-lg border transition-all duration-200 ${
        isActive
          ? 'border-primary bg-white dark:bg-primary/5 shadow-md'
          : 'border-border bg-white dark:bg-card hover:border-primary/50 hover:shadow-sm'
      }`}
    >
      {/* Card Header - Minimal design */}
      <div
        className="px-3 py-2.5 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight
            className={`size-4 flex-shrink-0 text-muted-foreground transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <h3 className="text-sm font-medium text-foreground truncate">
            {version.name}
          </h3>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            v{version.version_number}
          </span>
        </div>
        <button className="p-1 hover:bg-muted rounded transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
            <circle cx="8" cy="3" r="1" fill="currentColor"/>
            <circle cx="8" cy="8" r="1" fill="currentColor"/>
            <circle cx="8" cy="13" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Expandable File List - Clean minimal design */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-3 py-2 space-y-0.5">
              {files.map((filename) => {
                const status = getFileStatus(filename);
                
                // Extract just filename (last part) and full path
                const parts = filename.split('/');
                const name = parts[parts.length - 1]; // Just the filename
                const fullPath = filename; // Complete path
                
                return (
                  <div
                    key={filename}
                    className="flex items-center gap-2 py-1 rounded px-2 -mx-2"
                  >
                    <FileTypeIcon 
                      filename={filename} 
                      size={16}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileClick?.(filename);
                        }}
                        className="text-sm text-foreground truncate hover:underline cursor-pointer text-left"
                      >
                        {name}
                      </button>
                      <span className="text-xs text-muted-foreground truncate">{fullPath}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator */}
      {version.status === 'generating' && (
        <div className="px-3 py-1.5 bg-blue-500/10 border-t border-blue-500/20">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Generating...
          </p>
        </div>
      )}
      {version.status === 'failed' && (
        <div className="px-3 py-1.5 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-600 dark:text-red-400">
            Generation failed
          </p>
        </div>
      )}
    </motion.div>
  );
}

