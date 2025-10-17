'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, FileCode, Edit, Sparkles, Trash2 } from 'lucide-react';
import type { Version } from '../src/modules/versions/types';

interface VersionCardProps {
  version: Version;
  isActive: boolean;
  onClick: () => void;
  previousVersion?: Version;
}

/**
 * Version Card Component
 * Displays a single version with collapsible file list
 * Shows version number, name, and file changes
 */
export function VersionCard({ version, isActive, onClick, previousVersion }: VersionCardProps) {
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
      case 'CREATE_FILE':
        return <Sparkles className="size-4 text-blue-500" />;
      case 'MODIFY_FILE':
        return <Edit className="size-4 text-amber-500" />;
      case 'DELETE_FILE':
        return <Trash2 className="size-4 text-red-500" />;
      case 'REFACTOR_CODE':
        return <FileCode className="size-4 text-purple-500" />;
      default:
        return <FileCode className="size-4 text-green-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-lg border transition-all duration-200 ${
        isActive
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
      }`}
    >
      {/* Card Header */}
      <div
        className="px-3 py-2.5 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            {getVersionIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {version.name}
              </h3>
              <span className="text-xs text-muted-foreground">
                v{version.version_number}
              </span>
            </div>
            {version.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {version.description}
              </p>
            )}
          </div>
        </div>

        {/* File Count & Expand Button */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
            {isExpanded ? 'Hide' : 'Show'} files
          </button>
        </div>
      </div>

      {/* Expandable File List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-3 py-2 space-y-1.5 bg-muted/30">
              {/* New Files */}
              {filesGrouped.new.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    New ({filesGrouped.new.length})
                  </p>
                  {filesGrouped.new.map((filename) => (
                    <div
                      key={filename}
                      className="flex items-center gap-1.5 text-xs py-1"
                    >
                      <Sparkles className="size-3 text-blue-500 flex-shrink-0" />
                      <span className="truncate text-foreground">{filename}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Modified Files */}
              {filesGrouped.modified.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Modified ({filesGrouped.modified.length})
                  </p>
                  {filesGrouped.modified.map((filename) => (
                    <div
                      key={filename}
                      className="flex items-center gap-1.5 text-xs py-1"
                    >
                      <Edit className="size-3 text-amber-500 flex-shrink-0" />
                      <span className="truncate text-foreground">{filename}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Unchanged Files - collapsed by default */}
              {filesGrouped.unchanged.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Unchanged ({filesGrouped.unchanged.length})
                  </summary>
                  <div className="mt-1 ml-2 space-y-0.5">
                    {filesGrouped.unchanged.slice(0, 5).map((filename) => (
                      <div
                        key={filename}
                        className="flex items-center gap-1.5 text-xs py-0.5"
                      >
                        <FileCode className="size-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{filename}</span>
                      </div>
                    ))}
                    {filesGrouped.unchanged.length > 5 && (
                      <p className="text-xs text-muted-foreground pl-4">
                        +{filesGrouped.unchanged.length - 5} more...
                      </p>
                    )}
                  </div>
                </details>
              )}
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

