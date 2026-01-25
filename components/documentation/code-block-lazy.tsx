"use client"

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

// Lazy load the actual CodeBlock component
const CodeBlock = dynamic(
  () => import('./code-block').then((mod) => ({ default: mod.CodeBlock })),
  {
    loading: () => <CodeBlockSkeleton />,
    ssr: false, // Syntax highlighting happens on client
  }
);

interface CodeBlockLazyProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

/**
 * Lazy-loaded CodeBlock Component
 * 
 * Implements code splitting for syntax highlighting to reduce initial bundle size.
 * The Shiki syntax highlighter is only loaded when code blocks are rendered.
 * 
 * Requirements: 8.4, 8.5
 */
export function CodeBlockLazy(props: CodeBlockLazyProps) {
  return <CodeBlock {...props} />;
}

/**
 * Loading skeleton for CodeBlock
 */
function CodeBlockSkeleton({ filename }: { filename?: string }) {
  return (
    <figure className="relative group my-6" role="status" aria-label="Loading code block">
      {filename && (
        <figcaption className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-t-lg">
          <span className="text-sm font-mono text-muted-foreground">
            {filename}
          </span>
        </figcaption>
      )}
      <div
        className={cn(
          'relative overflow-x-auto bg-muted border border-border p-4',
          filename ? 'rounded-b-lg' : 'rounded-lg'
        )}
      >
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
          <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
          <div className="h-4 bg-muted-foreground/20 rounded w-5/6"></div>
        </div>
      </div>
    </figure>
  );
}
