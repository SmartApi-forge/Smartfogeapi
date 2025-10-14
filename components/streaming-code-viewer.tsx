'use client';

import React, { useEffect, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { GeneratedFile } from '../src/types/streaming';

interface StreamingCodeViewerProps {
  files: GeneratedFile[];
  currentFile?: string;
  isStreaming: boolean;
  selectedFile?: string;
}

/**
 * Code viewer component with typing animation for streaming code
 * Shows code being written in real-time with syntax highlighting
 */
export function StreamingCodeViewer({
  files,
  currentFile,
  isStreaming,
  selectedFile,
}: StreamingCodeViewerProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Determine which file to display
  const fileToDisplay = files.find(
    (f) => f.filename === (selectedFile || currentFile)
  ) || files.find((f) => f.filename === currentFile) || files[files.length - 1];

  useEffect(() => {
    if (!fileToDisplay) {
      setDisplayedContent('');
      return;
    }

    const targetContent = fileToDisplay.content;

    // If file is complete and not currently streaming, show full content immediately
    if (fileToDisplay.isComplete && !isStreaming) {
      setDisplayedContent(targetContent);
      setIsTyping(false);
      return;
    }

    // If content changed (new chunk arrived), animate the typing
    if (displayedContent.length < targetContent.length) {
      setIsTyping(true);

      // Add characters in chunks for smooth animation
      const chunkSize = 20; // characters per frame (increased for faster typing)
      const delay = 30; // ms between frames (reduced for faster animation)

      const timer = setInterval(() => {
        setDisplayedContent((prev) => {
          const nextLength = Math.min(prev.length + chunkSize, targetContent.length);
          const newContent = targetContent.slice(0, nextLength);

          if (nextLength >= targetContent.length) {
            setIsTyping(false);
            clearInterval(timer);
          }

          return newContent;
        });
      }, delay);

      return () => clearInterval(timer);
    }
  }, [fileToDisplay, displayedContent.length, isStreaming]);

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
          <p>Waiting for code generation to start...</p>
        </div>
      </div>
    );
  }

  if (!fileToDisplay) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Select a file to view</p>
      </div>
    );
  }

  const language = getLanguageFromFilename(fileToDisplay.filename);

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="bg-secondary/50 border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{fileToDisplay.filename}</span>
          {!fileToDisplay.isComplete && isStreaming && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 text-xs text-blue-500"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Writing...</span>
            </motion.div>
          )}
          {fileToDisplay.isComplete && (
            <span className="text-xs text-green-500">✓ Complete</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {displayedContent.split('\n').length} lines
        </span>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto relative">
        <Highlight
          theme={themes.vsDark}
          code={displayedContent || '// Waiting for code...'}
          language={language}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} text-sm leading-5 p-3 min-h-full`}
              style={{
                ...style,
                margin: 0,
                background: '#1D1D1D',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                fontSize: '14px',
              }}
            >
              {tokens.map((line, i) => (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  className="flex hover:bg-gray-800/30 transition-colors"
                >
                  <span className="inline-block w-10 text-right mr-3 text-gray-500 select-none flex-shrink-0 text-xs leading-5">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>

        {/* Blinking cursor at the end */}
        {isTyping && (
          <motion.div
            className="absolute bottom-4 left-[4.5rem] w-2 h-4 bg-blue-500"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="bg-secondary/30 border-t px-4 py-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {fileToDisplay.isComplete
            ? 'Ready'
            : `Writing code... (${Math.round((displayedContent.length / (fileToDisplay.content.length || 1)) * 100)}%)`}
        </span>
        <span>{language.toUpperCase()}</span>
      </div>
    </div>
  );
}

/**
 * Determine programming language from filename for syntax highlighting
 */
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sql: 'sql',
    sh: 'bash',
    dockerfile: 'dockerfile',
  };

  return languageMap[extension] || 'javascript';
}

