'use client';

/**
 * Chat Message Component
 * 
 * Renders chat messages with integrated UX improvements:
 * - ClickableFilePath for all file paths in messages
 * - FileReadingIndicator for context building
 * - ContextSourceIndicator for RAG retrieval display
 * 
 * Requirements: 3.2, 6.2, 9.1
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, User, Bot } from 'lucide-react';
import { ClickableFilePath, InlineFilePath } from './clickable-file-path';
import { FileReadingIndicator, FileReadingItem } from './file-reading-indicator';
import { ContextSourceIndicator } from './context-source-indicator';
import { TextShimmer } from './ui/text-shimmer';
import type { ChatMessage as ChatMessageType, ContextSource, FileReadingEvent, ChatMode } from '@/src/types/chat-ux';

/**
 * Regex pattern to match file paths in text
 * Matches patterns like: src/components/auth.tsx, ./lib/utils.ts, /app/page.tsx
 */
const FILE_PATH_REGEX = /(?:^|[\s'"({\[])([./]?(?:[\w-]+\/)+[\w.-]+\.[a-zA-Z]{1,10})(?=[\s'")\]},;:]|$)/g;

/**
 * Props for ChatMessage component
 */
export interface ChatMessageProps {
  /** The message to display */
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    mode?: ChatMode;
    isStreaming?: boolean;
    streamIcon?: 'generating' | 'processing' | 'complete';
  };
  /** Context sources used for this message (RAG retrieval) */
  contextSources?: ContextSource[];
  /** File reading events for this message */
  fileReadingEvents?: FileReadingEvent[];
  /** Whether file reading is currently in progress */
  isReadingFiles?: boolean;
  /** Token count used for context */
  contextTokenCount?: number;
  /** Callback when a file path is clicked */
  onFileClick?: (path: string) => void;
  /** Animation index for staggered animations */
  animationIndex?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Parse message content and replace file paths with clickable components
 */
function parseMessageWithFilePaths(
  content: string,
  onFileClick?: (path: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex state
  FILE_PATH_REGEX.lastIndex = 0;
  
  while ((match = FILE_PATH_REGEX.exec(content)) !== null) {
    const filePath = match[1];
    const matchStart = match.index + (match[0].length - filePath.length - (match[0].endsWith(filePath) ? 0 : 1));
    
    // Add text before the match
    if (matchStart > lastIndex) {
      parts.push(content.slice(lastIndex, matchStart));
    }
    
    // Add clickable file path
    parts.push(
      <InlineFilePath
        key={`${filePath}-${matchStart}`}
        path={filePath}
        onClick={onFileClick}
      />
    );
    
    lastIndex = matchStart + filePath.length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [content];
}

/**
 * Convert FileReadingEvent[] to FileReadingItem[] for the indicator
 */
function convertToFileReadingItems(events: FileReadingEvent[]): FileReadingItem[] {
  const items: FileReadingItem[] = [];
  const fileStatus = new Map<string, 'reading' | 'complete'>();
  
  // Process events to determine final status of each file
  events.forEach(event => {
    if (event.type === 'file:reading' && event.filePath) {
      fileStatus.set(event.filePath, 'reading');
    } else if (event.type === 'file:read:complete') {
      // Mark all files as complete
      fileStatus.forEach((_, path) => {
        fileStatus.set(path, 'complete');
      });
    }
  });
  
  // Convert to items
  fileStatus.forEach((status, path) => {
    const event = events.find(e => e.filePath === path);
    items.push({
      path,
      status,
      timestamp: event?.timestamp || Date.now(),
    });
  });
  
  return items;
}

/**
 * ChatMessage Component
 * 
 * Renders a single chat message with:
 * - Clickable file paths in message content
 * - File reading indicator when context is being built
 * - Context source indicator showing RAG retrieval info
 * - Streaming animation for in-progress messages
 */
export function ChatMessage({
  message,
  contextSources = [],
  fileReadingEvents = [],
  isReadingFiles = false,
  contextTokenCount = 0,
  onFileClick,
  animationIndex = 0,
  className = '',
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const streamIcon = message.streamIcon;
  
  // Convert file reading events to items for the indicator
  const fileReadingItems = useMemo(
    () => convertToFileReadingItems(fileReadingEvents),
    [fileReadingEvents]
  );
  
  // Parse message content for file paths (only for assistant messages)
  const parsedContent = useMemo(() => {
    if (isUser) {
      return message.content;
    }
    return parseMessageWithFilePaths(message.content, onFileClick);
  }, [message.content, isUser, onFileClick]);
  
  // Check if we have context sources to display
  const hasContextSources = contextSources.length > 0;
  const isTruncated = contextSources.some(s => s.truncated);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: animationIndex * 0.05 }}
      className={`text-sm ${className}`}
    >
      {/* File Reading Indicator - shown before assistant messages when reading */}
      {!isUser && (isReadingFiles || fileReadingItems.length > 0) && (
        <div className="mb-2">
          <FileReadingIndicator
            files={fileReadingItems}
            isReading={isReadingFiles}
            totalCount={fileReadingItems.length}
            onFileClick={onFileClick}
            defaultExpanded={isReadingFiles}
          />
        </div>
      )}
      
      {/* Context Source Indicator - shown before assistant messages */}
      {!isUser && hasContextSources && (
        <div className="mb-2">
          <ContextSourceIndicator
            sources={contextSources}
            truncated={isTruncated}
            tokenCount={contextTokenCount}
            onFileClick={onFileClick}
            defaultExpanded={false}
          />
        </div>
      )}
      
      {/* Message Content */}
      {isUser ? (
        // User message - right aligned
        <div className="flex justify-end mb-1.5">
          <div className="rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 bg-[#EBEBEB] dark:bg-[#262626] border border-[#d1d5db] dark:border-[#262626] max-w-[90%]">
            <div className="whitespace-pre-wrap break-words leading-[1.5] text-[14px] sm:text-[15px] text-gray-900 dark:text-white font-medium">
              {message.content}
            </div>
          </div>
        </div>
      ) : (
        // Assistant message - left aligned with optional streaming animation
        <div className="flex gap-2 sm:gap-3 items-start mb-1.5 pr-2 sm:pr-4">
          {/* Spinner for streaming messages */}
          {isStreaming && (streamIcon === 'generating' || streamIcon === 'processing') && (
            <Loader2 className="size-4 animate-spin text-primary mt-1 flex-shrink-0" />
          )}
          
          <div className="whitespace-pre-wrap break-words leading-[1.5] text-[14px] sm:text-[15px] flex-1">
            {isStreaming && (streamIcon === 'generating' || streamIcon === 'processing') ? (
              <TextShimmer 
                duration={1.5} 
                className="text-[14px] sm:text-[15px] font-normal text-foreground"
              >
                {typeof parsedContent === 'string' ? parsedContent : message.content}
              </TextShimmer>
            ) : (
              <span className="text-foreground dark:text-gray-200">
                {parsedContent}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ChatMessage;
