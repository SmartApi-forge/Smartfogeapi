'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClickableFileLink } from './clickable-file-link';
import { Loader2, CheckCircle } from 'lucide-react';

export interface FileActivity {
  id: string;
  filePath: string;
  status: 'analyzing' | 'reading' | 'writing' | 'complete';
  relevance?: number;
  timestamp: number;
}

interface FileActivityFeedProps {
  activities: FileActivity[];
  onFileClick?: (filePath: string) => void;
  maxItems?: number;
  className?: string;
}

/**
 * File Activity Feed Component
 * 
 * Shows real-time file activity in the chat interface:
 * - Which files are being analyzed
 * - Which files are being read
 * - Which files are being edited/written
 * - Relevance score for each file
 * 
 * Features:
 * - Automatic scroll to latest activity
 * - Shimmer animation on active files
 * - Clickable files that navigate to editor
 * - Clean, minimal design
 * 
 * Usage:
 * ```tsx
 * <FileActivityFeed
 *   activities={fileActivities}
 *   onFileClick={(path) => setSelectedFile(path)}
 * />
 * ```
 */
export function FileActivityFeed({
  activities,
  onFileClick,
  maxItems = 10,
  className = '',
}: FileActivityFeedProps) {
  // Show only recent activities
  const recentActivities = activities.slice(-maxItems);
  
  // Group activities by status for better visualization
  const activeFiles = recentActivities.filter(
    a => a.status === 'reading' || a.status === 'writing' || a.status === 'analyzing'
  );
  const completedFiles = recentActivities.filter(a => a.status === 'complete');
  
  if (recentActivities.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Active Files Section */}
      {activeFiles.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
            Processing
          </h4>
          <AnimatePresence mode="popLayout">
            {activeFiles.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/30 border border-border/50"
              >
                {/* Status Icon */}
                {activity.status === 'analyzing' && (
                  <Loader2 className="size-3 text-blue-500 animate-spin flex-shrink-0" />
                )}
                
                {/* Clickable File Link with Shimmer */}
                <ClickableFileLink
                  filename={activity.filePath}
                  status={activity.status as any}
                  onClick={() => onFileClick?.(activity.filePath)}
                  showIcon={true}
                  showStatus={false}
                  className="flex-1 min-w-0"
                />
                
                {/* Relevance Score */}
                {activity.relevance !== undefined && activity.relevance > 0 && (
                  <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">
                    {Math.round(activity.relevance * 100)}%
                  </span>
                )}
                
                {/* Status Text */}
                <span className="text-xs text-muted-foreground flex-shrink-0 capitalize">
                  {activity.status}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      
      {/* Completed Files Section */}
      {completedFiles.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
            Ready
          </h4>
          <div className="space-y-1">
            {completedFiles.slice(-5).map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/30 transition-colors"
              >
                <CheckCircle className="size-3 text-green-500 flex-shrink-0" />
                
                <ClickableFileLink
                  filename={activity.filePath}
                  status="complete"
                  onClick={() => onFileClick?.(activity.filePath)}
                  showIcon={true}
                  showStatus={false}
                  className="flex-1 min-w-0"
                />
                
                {activity.relevance !== undefined && activity.relevance > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0 font-medium">
                    {Math.round(activity.relevance * 100)}% match
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact File Activity Badge
 * 
 * Shows a small badge with file activity count
 * Used in message bubbles to indicate file changes
 */
interface FileActivityBadgeProps {
  fileCount: number;
  status?: 'active' | 'complete';
  onClick?: () => void;
}

export function FileActivityBadge({ 
  fileCount, 
  status = 'complete',
  onClick 
}: FileActivityBadgeProps) {
  if (fileCount === 0) return null;
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        transition-colors
        ${status === 'active' 
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
          : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
        }
      `}
    >
      {status === 'active' && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {status === 'complete' && (
        <CheckCircle className="size-3" />
      )}
      <span>
        {fileCount} {fileCount === 1 ? 'file' : 'files'}
      </span>
    </motion.button>
  );
}
