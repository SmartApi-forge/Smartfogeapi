/**
 * Markdown Preview Component
 * 
 * Renders markdown content with full GFM support including:
 * - Headings, lists, code blocks, tables, links, images
 * - Mermaid diagram support for architecture/flow diagrams
 * - Syntax highlighting for code blocks
 * - Dark/light theme support
 * 
 * Requirements: 5.2, 5.3, 5.4
 * - 5.2: Support headings, lists, code blocks, tables, links, images
 * - 5.3: Syntax highlighting for code blocks
 * - 5.4: Dark/light theme support
 */

'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Mermaid diagram component - renders mermaid diagrams
 */
function MermaidDiagram({ code, isDark }: { code: string; isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        // Dynamically import mermaid to avoid SSR issues
        const mermaid = (await import('mermaid')).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError('Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code, isDark]);

  if (error) {
    return (
      <div className="my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">{code}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="my-6 flex justify-center overflow-x-auto bg-muted/30 dark:bg-muted/10 rounded-lg p-4 border border-border/50"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Code block component with copy button and syntax highlighting
 */
function CodeBlock({ 
  language, 
  children, 
  isDark 
}: { 
  language: string; 
  children: string; 
  isDark: boolean;
}) {
  const [copied, setCopied] = useState(false);

  // Handle mermaid diagrams
  if (language === 'mermaid') {
    return <MermaidDiagram code={children} isDark={isDark} />;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-5 rounded-lg overflow-hidden border border-border/50 shadow-sm">
      {/* Language badge and copy button */}
      <div className="absolute top-0 right-0 flex items-center gap-2 p-2.5 z-10">
        {language && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/90 text-muted-foreground font-medium uppercase tracking-wide">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-muted/80 transition-all opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
      
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: '1.25rem',
          paddingTop: '2.5rem',
          fontSize: '13px',
          lineHeight: '1.6',
          borderRadius: '0.5rem',
          fontFamily: 'var(--font-geist-mono), "Geist Mono", ui-monospace, monospace',
        }}
        showLineNumbers={children.split('\n').length > 3}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: isDark ? '#4a5568' : '#a0aec0',
          fontSize: '12px',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Markdown Preview Component
 * 
 * Renders markdown with full GFM support, syntax highlighting, and mermaid diagrams.
 * Works for both API and non-API projects.
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const components = useMemo(() => ({
    // Headings with improved typography
    h1: ({ children }: any) => (
      <h1 className="text-[1.75rem] font-bold mt-8 mb-4 pb-3 border-b border-border tracking-tight text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-[1.375rem] font-semibold mt-8 mb-4 pb-2 border-b border-border/40 tracking-tight text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-[1.125rem] font-semibold mt-6 mb-3 tracking-tight text-foreground">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-base font-semibold mt-5 mb-2 text-foreground">{children}</h4>
    ),
    h5: ({ children }: any) => (
      <h5 className="text-sm font-semibold mt-4 mb-2 text-foreground">{children}</h5>
    ),
    h6: ({ children }: any) => (
      <h6 className="text-sm font-medium mt-4 mb-2 text-muted-foreground">{children}</h6>
    ),

    // Paragraphs with better line height and spacing
    p: ({ children }: any) => (
      <p className="my-4 leading-[1.8] text-[15px] text-foreground/90">{children}</p>
    ),

    // Lists with improved spacing
    ul: ({ children }: any) => (
      <ul className="my-4 ml-6 list-disc space-y-2 text-[15px]">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="my-4 ml-6 list-decimal space-y-2 text-[15px]">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-[1.7] text-foreground/90 pl-1">{children}</li>
    ),

    // Blockquotes with better styling
    blockquote: ({ children }: any) => (
      <blockquote className="my-5 pl-5 py-1 border-l-4 border-primary/60 bg-muted/30 rounded-r-md italic text-foreground/80">
        {children}
      </blockquote>
    ),

    // Code blocks and inline code
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && (language || codeString.includes('\n'))) {
        return (
          <CodeBlock language={language} isDark={isDark}>
            {codeString}
          </CodeBlock>
        );
      }

      return (
        <code
          className="px-1.5 py-0.5 rounded-md bg-muted/70 font-mono text-[13px] text-primary/90 font-medium"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Pre blocks (wrapper for code)
    pre: ({ children }: any) => <>{children}</>,

    // Links with better styling
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 hover:decoration-primary/60 transition-colors inline-flex items-center gap-1"
      >
        {children}
        <ExternalLink className="size-3 opacity-60" />
      </a>
    ),

    // Images - using Next.js Image component for optimization
    img: ({ src, alt }: any) => {
      if (!src) return null;
      
      return (
        <span className="block my-6 relative w-full">
          <Image
            src={src}
            alt={alt || ''}
            width={800}
            height={400}
            className="rounded-lg max-w-full h-auto border border-border shadow-sm object-contain"
            loading="lazy"
            unoptimized={src.startsWith('data:') || src.startsWith('http')}
          />
          {alt && (
            <span className="block text-center text-sm text-muted-foreground mt-2 italic">
              {alt}
            </span>
          )}
        </span>
      );
    },

    // Tables with improved styling
    table: ({ children }: any) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border shadow-sm">
        <table className="w-full border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-muted/60 dark:bg-muted/30">{children}</thead>
    ),
    tbody: ({ children }: any) => <tbody className="divide-y divide-border">{children}</tbody>,
    tr: ({ children }: any) => (
      <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
    ),
    th: ({ children }: any) => (
      <th className="px-4 py-3 text-left font-semibold text-sm text-foreground border-b border-border">{children}</th>
    ),
    td: ({ children }: any) => (
      <td className="px-4 py-3 text-sm text-foreground/90">{children}</td>
    ),

    // Horizontal rule
    hr: () => <hr className="my-8 border-border/60" />,

    // Strong and emphasis
    strong: ({ children }: any) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }: any) => <em className="italic">{children}</em>,

    // Strikethrough (GFM)
    del: ({ children }: any) => (
      <del className="line-through text-muted-foreground">{children}</del>
    ),

    // Task lists (GFM)
    input: ({ checked, ...props }: any) => (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-2 rounded border-border accent-primary"
        {...props}
      />
    ),
  }), [isDark]);

  return (
    <div
      className={cn(
        'markdown-preview',
        'max-w-none',
        'text-foreground',
        // Base font styling
        'font-sans text-[15px] leading-relaxed',
        // Smooth scrolling
        'scroll-smooth',
        className
      )}
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownPreview;
