import type { MDXComponents } from 'mdx/types'
import { cn } from '@/lib/utils'
import { Callout } from '@/components/documentation/callout'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/documentation/tabs'
import { Card, CardGrid } from '@/components/documentation/card'

/**
 * Custom MDX Components
 * 
 * These components are used to render MDX content with custom styling
 * and functionality. They replace the default HTML elements.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Custom components for MDX
    Callout,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Card,
    CardGrid,
    
    // Headings with custom styling
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          "scroll-mt-20 text-4xl font-bold tracking-tight mb-8",
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "scroll-mt-20 text-3xl font-semibold tracking-tight mt-12 mb-6 border-b border-border pb-2",
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "scroll-mt-20 text-2xl font-semibold mt-8 mb-4",
          className
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }) => (
      <h4
        className={cn(
          "scroll-mt-20 text-xl font-semibold mt-6 mb-3",
          className
        )}
        {...props}
      />
    ),
    
    // Paragraphs
    p: ({ className, ...props }) => (
      <p
        className={cn("leading-7 mb-4", className)}
        {...props}
      />
    ),
    
    // Links
    a: ({ className, ...props }) => (
      <a
        className={cn(
          "text-primary font-medium no-underline hover:underline",
          className
        )}
        {...props}
      />
    ),
    
    // Lists
    ul: ({ className, ...props }) => (
      <ul
        className={cn("my-6 ml-6 list-disc", className)}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn("my-6 ml-6 list-decimal", className)}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li
        className={cn("my-2", className)}
        {...props}
      />
    ),
    
    // Inline code
    code: ({ className, ...props }) => (
      <code
        className={cn(
          "text-sm font-mono bg-muted px-1.5 py-0.5 rounded",
          className
        )}
        {...props}
      />
    ),
    
    // Code blocks (pre)
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          "bg-muted border border-border rounded-lg p-4 overflow-x-auto my-6",
          className
        )}
        {...props}
      />
    ),
    
    // Blockquotes
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "border-l-4 border-primary pl-4 italic my-6",
          className
        )}
        {...props}
      />
    ),
    
    // Tables
    table: ({ className, ...props }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table
          className={cn("w-full border-collapse", className)}
          {...props}
        />
      </div>
    ),
    th: ({ className, ...props }) => (
      <th
        className={cn(
          "text-left font-semibold p-3 border border-border bg-muted",
          className
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn("p-3 border border-border", className)}
        {...props}
      />
    ),
    
    // Images
    img: ({ className, ...props }) => (
      <img
        className={cn("rounded-lg border border-border my-6", className)}
        {...props}
      />
    ),
    
    // Horizontal rule
    hr: ({ className, ...props }) => (
      <hr
        className={cn("my-8 border-border", className)}
        {...props}
      />
    ),
    
    // Strong
    strong: ({ className, ...props }) => (
      <strong
        className={cn("font-semibold", className)}
        {...props}
      />
    ),
    
    ...components,
  }
}
