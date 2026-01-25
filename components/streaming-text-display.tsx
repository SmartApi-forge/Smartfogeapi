'use client';

/**
 * Streaming Text Display Component
 * 
 * Displays streaming text with typing animation and progressive syntax highlighting.
 * Uses TokenBuffer for smooth 50ms batch display.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.6
 * - Stream tokens to frontend in real-time
 * - Display tokens with typing animation
 * - Apply syntax highlighting progressively for code blocks
 * - Display partial response with continuation option on interruption
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlight, themes } from 'prism-react-renderer';
import { useTheme } from 'next-themes';
import { Loader2, RefreshCw } from 'lucide-react';
import { createTokenBuffer, DEFAULT_FLUSH_INTERVAL_MS } from '../src/services/token-buffer';

interface StreamingTextDisplayProps {
  /** Content to display - can be updated incrementally */
  content: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Whether the stream was interrupted */
  isInterrupted?: boolean;
  /** Callback to continue from interruption */
  onContinue?: () => void;
  /** Custom flush interval in ms (default: 50ms) */
  flushInterval?: number;
  /** Whether to show typing cursor */
  showCursor?: boolean;
  /** Custom class name */
  className?: string;
}

interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse content to extract code blocks
 */
function parseCodeBlocks(content: string): { blocks: CodeBlock[]; textSegments: string[] } {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  const textSegments: string[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      textSegments.push(content.slice(lastIndex, match.index));
    }
    
    blocks.push({
      language: match[1] || 'text',
      code: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last code block
  if (lastIndex < content.length) {
    textSegments.push(content.slice(lastIndex));
  }
  
  return { blocks, textSegments };
}

/**
 * Code block component with syntax highlighting
 */
function CodeBlockDisplay({ language, code }: { language: string; code: string }) {
  const { resolvedTheme } = useTheme();
  const codeTheme = resolvedTheme === 'dark' ? themes.vsDark : themes.github;
  
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border">
      <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
        {language}
      </div>
      <Highlight theme={codeTheme} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} p-3 overflow-x-auto`}
            style={{
              ...style,
              margin: 0,
              fontSize: '13px',
              lineHeight: '1.5',
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/**
 * Streaming Text Display Component
 */
export function StreamingTextDisplay({
  content,
  isStreaming,
  isInterrupted = false,
  onContinue,
  flushInterval = DEFAULT_FLUSH_INTERVAL_MS,
  showCursor = true,
  className = '',
}: StreamingTextDisplayProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bufferRef = useRef<ReturnType<typeof createTokenBuffer> | null>(null);
  const contentRef = useRef(content);
  const lastProcessedLengthRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize token buffer
  useEffect(() => {
    bufferRef.current = createTokenBuffer(
      (flushedContent) => {
        setDisplayedContent(prev => prev + flushedContent);
      },
      flushInterval
    );

    return () => {
      bufferRef.current?.destroy();
    };
  }, [flushInterval]);

  // Process new content through buffer
  useEffect(() => {
    if (!bufferRef.current) return;

    const newContent = content.slice(lastProcessedLengthRef.current);
    
    if (newContent.length > 0) {
      setIsTyping(true);
      
      // Add new tokens to buffer
      for (const char of newContent) {
        bufferRef.current.addToken(char);
      }
      
      lastProcessedLengthRef.current = content.length;
    }

    // If streaming stopped, flush remaining buffer
    if (!isStreaming && bufferRef.current.getBufferLength() > 0) {
      const remaining = bufferRef.current.flush();
      if (remaining) {
        setDisplayedContent(prev => prev + remaining);
      }
      setIsTyping(false);
    }

    contentRef.current = content;
  }, [content, isStreaming]);

  // Handle interruption
  useEffect(() => {
    if (isInterrupted && bufferRef.current) {
      const remaining = bufferRef.current.interrupt();
      if (remaining) {
        setDisplayedContent(prev => prev + remaining);
      }
      setIsTyping(false);
    }
  }, [isInterrupted]);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isTyping && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedContent, isTyping]);

  // Parse content for code blocks
  const { blocks, textSegments } = useMemo(
    () => parseCodeBlocks(displayedContent),
    [displayedContent]
  );

  // Render content with code blocks
  const renderContent = useCallback(() => {
    if (blocks.length === 0) {
      return <span className="whitespace-pre-wrap">{displayedContent}</span>;
    }

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    blocks.forEach((block, i) => {
      // Add text before this code block
      const textBefore = displayedContent.slice(currentIndex, block.startIndex);
      if (textBefore) {
        elements.push(
          <span key={`text-${i}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>
        );
      }

      // Add code block
      elements.push(
        <CodeBlockDisplay
          key={`code-${i}`}
          language={block.language}
          code={block.code}
        />
      );

      currentIndex = block.endIndex;
    });

    // Add remaining text after last code block
    const remainingText = displayedContent.slice(currentIndex);
    if (remainingText) {
      elements.push(
        <span key="text-final" className="whitespace-pre-wrap">
          {remainingText}
        </span>
      );
    }

    return elements;
  }, [displayedContent, blocks]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Main content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {renderContent()}
        
        {/* Typing cursor */}
        <AnimatePresence>
          {showCursor && isTyping && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
              style={{
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Streaming indicator */}
      <AnimatePresence>
        {isStreaming && !isInterrupted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Generating response...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interruption notice with continue option */}
      <AnimatePresence>
        {isInterrupted && onContinue && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Response interrupted
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The response was interrupted. You can continue from where it left off.
              </p>
            </div>
            <button
              onClick={onContinue}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-md transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Continue
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for cursor blink animation */}
      <style jsx global>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default StreamingTextDisplay;
