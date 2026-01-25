'use client';

/**
 * Context Source Indicator Component
 * 
 * Displays information about context sources used for RAG retrieval.
 * Shows "Context from: {sources}" indicator with relevance scores.
 * 
 * Requirements: 6.2, 6.4, 6.5
 * - Display "Context from: {sources}" indicator
 * - Show relevance scores
 * - Indicate "Using project patterns" when applicable
 * - Show memory layer access (working/long-term)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Database, 
  FileText, 
  MessageSquare, 
  Sparkles,
  Brain,
  Clock,
  AlertCircle
} from 'lucide-react';
import { ClickableFileLink } from './clickable-file-link';
import type { ContextSource } from '../src/types/chat-ux';

/**
 * Props for ContextSourceIndicator component
 */
export interface ContextSourceIndicatorProps {
  /** List of context sources used */
  sources: ContextSource[];
  /** Whether context was truncated due to token limits */
  truncated: boolean;
  /** Total token count used */
  tokenCount: number;
  /** Callback when a file path is clicked */
  onFileClick?: (path: string) => void;
  /** Whether the list is initially expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon for source type
 */
function getSourceIcon(type: ContextSource['type']) {
  switch (type) {
    case 'file':
      return FileText;
    case 'embedding':
      return Database;
    case 'project_knowledge':
      return Sparkles;
    case 'conversation':
      return MessageSquare;
    default:
      return FileText;
  }
}

/**
 * Get label for source type
 */
function getSourceLabel(type: ContextSource['type']): string {
  switch (type) {
    case 'file':
      return 'File';
    case 'embedding':
      return 'Semantic Search';
    case 'project_knowledge':
      return 'Project Patterns';
    case 'conversation':
      return 'Conversation History';
    default:
      return 'Unknown';
  }
}

/**
 * Get memory layer icon and label
 */
function getMemoryLayerInfo(layer?: 'working' | 'long_term') {
  if (layer === 'long_term') {
    return { icon: Brain, label: 'Long-term Memory', color: 'text-purple-500' };
  }
  return { icon: Clock, label: 'Working Memory', color: 'text-blue-500' };
}

/**
 * Format relevance score as percentage
 */
function formatRelevanceScore(score?: number): string {
  if (score === undefined || score === null) return '';
  return `${Math.round(score * 100)}%`;
}

/**
 * ContextSourceIndicator Component
 * 
 * Shows which context sources were used for RAG retrieval with:
 * - Summary of source types
 * - Collapsible list of individual sources
 * - Relevance scores for files
 * - Memory layer indicators
 * - Truncation warning when applicable
 * 
 * Usage:
 * ```tsx
 * <ContextSourceIndicator
 *   sources={[
 *     { type: 'file', path: 'src/auth.ts', relevanceScore: 0.95, memoryLayer: 'working' },
 *     { type: 'embedding', memoryLayer: 'long_term' },
 *   ]}
 *   truncated={false}
 *   tokenCount={15000}
 *   onFileClick={(path) => openFile(path)}
 * />
 * ```
 */
export function ContextSourceIndicator({
  sources,
  truncated,
  tokenCount,
  onFileClick,
  defaultExpanded = false,
  className = '',
}: ContextSourceIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Group sources by type
  const fileSources = sources.filter(s => s.type === 'file');
  const embeddingSources = sources.filter(s => s.type === 'embedding');
  const projectKnowledgeSources = sources.filter(s => s.type === 'project_knowledge');
  const conversationSources = sources.filter(s => s.type === 'conversation');

  // Build summary text
  const summaryParts: string[] = [];
  if (fileSources.length > 0) {
    summaryParts.push(`${fileSources.length} ${fileSources.length === 1 ? 'file' : 'files'}`);
  }
  if (embeddingSources.length > 0) {
    summaryParts.push('semantic search');
  }
  if (projectKnowledgeSources.length > 0) {
    summaryParts.push('project patterns');
  }
  if (conversationSources.length > 0) {
    summaryParts.push('conversation');
  }

  const summaryText = summaryParts.length > 0 
    ? summaryParts.join(', ') 
    : 'no sources';

  if (sources.length === 0) {
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

        {/* Context Icon */}
        <Database className="size-4 text-primary flex-shrink-0" />

        {/* Summary Text */}
        <div className="flex-1 text-left">
          <span className="text-sm">
            <span className="text-muted-foreground">Context from: </span>
            <span className="font-medium">{summaryText}</span>
          </span>
        </div>

        {/* Token Count Badge */}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {Math.round(tokenCount / 1000)}K tokens
        </span>

        {/* Truncation Warning */}
        {truncated && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <AlertCircle className="size-3" />
            <span className="hidden sm:inline">Truncated</span>
          </span>
        )}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="px-3 py-2 space-y-3 max-h-64 overflow-y-auto">
              {/* Project Patterns Indicator */}
              {projectKnowledgeSources.length > 0 && (
                <SourceSection
                  title="Using Project Patterns"
                  icon={Sparkles}
                  iconColor="text-amber-500"
                  memoryLayer="long_term"
                />
              )}

              {/* Semantic Search Indicator */}
              {embeddingSources.length > 0 && (
                <SourceSection
                  title="Semantic Search"
                  icon={Database}
                  iconColor="text-purple-500"
                  memoryLayer="long_term"
                />
              )}

              {/* Conversation History */}
              {conversationSources.length > 0 && (
                <SourceSection
                  title="Conversation History"
                  icon={MessageSquare}
                  iconColor="text-blue-500"
                  memoryLayer="working"
                />
              )}

              {/* File Sources */}
              {fileSources.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <FileText className="size-3" />
                    <span>Files ({fileSources.length})</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {fileSources.map((source, index) => (
                      <FileSourceRow
                        key={source.path || index}
                        source={source}
                        onFileClick={onFileClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Truncation Warning Detail */}
              {truncated && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Context truncated</span>
                    <p className="text-amber-500/80 mt-0.5">
                      Some content was truncated to fit within token limits. 
                      The most relevant files were prioritized.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


/**
 * Source section component for non-file sources
 */
interface SourceSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  memoryLayer: 'working' | 'long_term';
}

function SourceSection({ title, icon: Icon, iconColor, memoryLayer }: SourceSectionProps) {
  const memoryInfo = getMemoryLayerInfo(memoryLayer);
  const MemoryIcon = memoryInfo.icon;

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${iconColor}`} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className={`flex items-center gap-1 text-xs ${memoryInfo.color}`}>
        <MemoryIcon className="size-3" />
        <span>{memoryInfo.label}</span>
      </div>
    </div>
  );
}

/**
 * File source row component
 */
interface FileSourceRowProps {
  source: ContextSource;
  onFileClick?: (path: string) => void;
}

function FileSourceRow({ source, onFileClick }: FileSourceRowProps) {
  const memoryInfo = getMemoryLayerInfo(source.memoryLayer);
  const relevanceText = formatRelevanceScore(source.relevanceScore);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {source.path && (
          <ClickableFileLink
            filename={source.path}
            status={source.truncated ? 'reading' : 'complete'}
            onClick={() => onFileClick?.(source.path!)}
            showIcon={true}
            showStatus={false}
            className="flex-1 min-w-0"
          />
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Relevance Score */}
        {relevanceText && (
          <span className={`text-xs font-mono ${
            (source.relevanceScore || 0) >= 0.8 
              ? 'text-green-500' 
              : (source.relevanceScore || 0) >= 0.5 
                ? 'text-amber-500' 
                : 'text-muted-foreground'
          }`}>
            {relevanceText}
          </span>
        )}

        {/* Truncation Indicator */}
        {source.truncated && (
          <span className="text-xs text-amber-500" title="Content truncated">
            ⚠
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Compact version of the context source indicator
 * Shows just a summary without the full list
 */
export interface CompactContextSourceIndicatorProps {
  /** List of context sources used */
  sources: ContextSource[];
  /** Whether context was truncated */
  truncated: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function CompactContextSourceIndicator({
  sources,
  truncated,
  className = '',
}: CompactContextSourceIndicatorProps) {
  const fileCount = sources.filter(s => s.type === 'file').length;
  const hasEmbedding = sources.some(s => s.type === 'embedding');
  const hasProjectKnowledge = sources.some(s => s.type === 'project_knowledge');

  if (sources.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
    >
      <Database className="size-3" />
      <span>
        Context: {fileCount > 0 && `${fileCount} files`}
        {hasEmbedding && (fileCount > 0 ? ', ' : '') + 'semantic search'}
        {hasProjectKnowledge && ' + patterns'}
        {truncated && ' (truncated)'}
      </span>
    </motion.div>
  );
}

export default ContextSourceIndicator;
