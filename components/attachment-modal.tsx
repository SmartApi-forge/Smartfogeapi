/**
 * Attachment Modal Component
 * 
 * Displays full-size attachment preview in a centered modal overlay.
 * Shows actual content for text-based files (markdown, code, etc.)
 * Uses Monaco-style editor appearance matching the file explorer.
 * 
 * Requirements: 5.4, 5.5, 5.7
 * - Centered modal overlay for full image/document view
 * - Filename in top-left corner
 * - Click outside to close (background visible)
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import Image from 'next/image';
import { X, Download, ExternalLink, Copy, Check } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { useTheme } from 'next-themes';
import { FileTypeIcon } from './file-type-icon';
import type { Attachment } from '@/src/types/chat-ux';

// Check if file is text-based and can show content
const isTextBasedFile = (filename: string): boolean => {
  const textExtensions = [
    '.md', '.markdown', '.txt', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.less', '.html', '.xml', '.yaml', '.yml', '.toml',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh', '.env', '.gitignore', '.eslintrc', '.prettierrc'
  ];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return textExtensions.includes(ext) || !filename.includes('.');
};

// Get language for syntax highlighting
const getLanguageFromFilename = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', java: 'java', go: 'go', rs: 'rust',
    cpp: 'cpp', c: 'c', cs: 'csharp', rb: 'ruby', php: 'php',
    json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    html: 'html', css: 'css', scss: 'scss', sql: 'sql', sh: 'bash',
  };
  return languageMap[extension] || 'markdown';
};

interface AttachmentModalProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal for viewing attachments
 * Requirements: 5.4, 5.5, 5.7
 */
export function AttachmentModal({
  attachment,
  isOpen,
  onClose,
}: AttachmentModalProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !attachment) {
    return null;
  }

  const isImage = attachment.type === 'image';
  const isPdf = attachment.type === 'pdf';
  const isTextFile = isTextBasedFile(attachment.name);
  const hasContent = attachment.content && attachment.content.length > 0;

  // Copy content to clipboard
  const handleCopy = async () => {
    if (attachment.content) {
      await navigator.clipboard.writeText(attachment.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-modal-title"
    >
      {/* Backdrop - semi-transparent to show background */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal content - Monaco editor style */}
      <div className="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col rounded-lg overflow-hidden shadow-2xl">
        {/* Header with filename - matching code viewer style */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 dark:bg-[#1D1D1D] border-b border-border dark:border-[#333433]">
          <div className="flex items-center gap-2">
            <FileTypeIcon filename={attachment.name} size={16} />
            <h2
              id="attachment-modal-title"
              className="text-sm font-medium text-foreground dark:text-white"
            >
              {attachment.name}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            {/* Copy button for text files */}
            {isTextFile && hasContent && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                aria-label="Copy content"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}

            {/* Download button */}
            <a
              href={attachment.url}
              download={attachment.name}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted dark:hover:bg-gray-700 transition-colors"
              aria-label="Download file"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>

            {/* Open in new tab */}
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-muted dark:hover:bg-gray-700 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted dark:hover:bg-gray-700 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area - Monaco editor style */}
        <div className="bg-muted/30 dark:bg-[#1D1D1D] overflow-hidden">
          {isImage ? (
            <div className="relative flex items-center justify-center p-4 max-h-[80vh] overflow-auto min-w-[300px] min-h-[200px]">
              <Image
                src={attachment.url}
                alt={attachment.name}
                fill
                className="object-contain rounded !relative max-w-full max-h-[75vh]"
                unoptimized
              />
            </div>
          ) : isPdf ? (
            <div className="w-[80vw] h-[80vh] max-w-4xl">
              <iframe
                src={attachment.url}
                title={attachment.name}
                className="w-full h-full border-0"
              />
            </div>
          ) : isTextFile && hasContent ? (
            // Show actual content with syntax highlighting like code viewer
            <div className="w-[80vw] max-w-4xl max-h-[80vh] overflow-auto">
              <Highlight
                theme={resolvedTheme === 'dark' ? themes.vsDark : themes.github}
                code={attachment.content || ''}
                language={getLanguageFromFilename(attachment.name)}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    className={`${className} font-mono p-3 min-h-full`}
                    style={{
                      ...style,
                      margin: 0,
                      background: 'transparent',
                      fontSize: '13px',
                      lineHeight: '20px',
                      fontWeight: '400',
                    }}
                  >
                    {tokens.map((line, i) => (
                      <div
                        key={i}
                        {...getLineProps({ line })}
                        className="flex hover:bg-muted/20 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <span className="inline-block w-10 text-right mr-3 text-gray-500 select-none flex-shrink-0 font-mono" style={{ fontSize: '13px', lineHeight: '20px' }}>
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
            </div>
          ) : (
            // For other file types without content, show download option
            <div className="flex flex-col items-center justify-center p-8 min-w-[300px]">
              <FileTypeIcon filename={attachment.name} size={48} />
              <p className="mt-3 text-sm text-muted-foreground text-center">
                Preview not available for this file type.
              </p>
              <a
                href={attachment.url}
                download={attachment.name}
                className="mt-3 px-4 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm font-medium"
              >
                Download File
              </a>
            </div>
          )}
        </div>

        {/* Status bar - matching code viewer */}
        {isTextFile && hasContent && (
          <div className="bg-muted/30 dark:bg-[#1D1D1D] border-t border-border dark:border-[#333433] px-4 py-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{attachment.content?.split('\n').length || 0} lines</span>
            <span>{getLanguageFromFilename(attachment.name).toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
