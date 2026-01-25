"use client"

import React from 'react'
import { cn } from '@/lib/utils'

interface ContentAreaProps {
  children: React.ReactNode
  className?: string
}

/**
 * ContentArea Component
 * 
 * The main content area for documentation pages.
 * Provides proper typography, responsive width, and MDX rendering support.
 * 
 * Requirements: 6.1, 6.2
 */
export function ContentArea({ children, className }: ContentAreaProps) {
  return (
    <div
      className={cn(
        // Layout
        "flex-1 w-full",
        "px-4 sm:px-6 lg:px-8",
        "py-8 lg:py-12",
        
        // Max width for readability
        "max-w-4xl mx-auto",
        
        // Scrolling
        "overflow-y-auto",
        
        className
      )}
    >
      <article
        role="article"
        aria-label="Documentation content"
        className={cn(
          // Typography base styles - using direct child selectors for maximum specificity
          "prose prose-slate dark:prose-invert",
          "max-w-none",
          
          // Headings - v0 inspired sizing and spacing
          "[&>h1]:text-[2.5rem] [&>h1]:font-bold [&>h1]:text-white [&>h1]:mb-6 [&>h1]:mt-0 [&>h1]:leading-[1.1] [&>h1]:tracking-tight [&>h1]:scroll-mt-20",
          "[&>h2]:text-[2rem] [&>h2]:font-semibold [&>h2]:text-white [&>h2]:mt-16 [&>h2]:mb-5 [&>h2]:leading-[1.2] [&>h2]:tracking-tight [&>h2]:scroll-mt-20",
          "[&>h3]:text-[1.5rem] [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mt-12 [&>h3]:mb-4 [&>h3]:leading-[1.3] [&>h3]:tracking-tight [&>h3]:scroll-mt-20",
          "[&>h4]:text-[1.25rem] [&>h4]:font-semibold [&>h4]:text-white [&>h4]:mt-8 [&>h4]:mb-3 [&>h4]:leading-[1.4] [&>h4]:tracking-tight [&>h4]:scroll-mt-20",
          
          // Paragraphs - v0 style with proper spacing
          "[&>p]:text-[15px] [&>p]:leading-[1.7] [&>p]:text-gray-400 [&>p]:mb-5 [&>p]:mt-0",
          
          // Links - clean blue with hover
          "[&_a]:text-blue-400 [&_a]:no-underline [&_a]:font-normal hover:[&_a]:underline hover:[&_a]:text-blue-300",
          
          // Strong text
          "[&_strong]:text-white [&_strong]:font-semibold",
          
          // Inline code
          "[&_code]:text-pink-400 [&_code]:text-sm [&_code]:bg-gray-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:before:content-none [&_code]:after:content-none",
          
          // Code blocks
          "[&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-800 [&_pre]:rounded-lg [&_pre]:my-6 [&_pre]:p-4 [&_pre]:overflow-x-auto",
          
          // Lists - v0 style with proper bullets and spacing
          "[&>ul]:text-[15px] [&>ul]:leading-[1.7] [&>ul]:text-gray-400 [&>ul]:my-5 [&>ul]:pl-6 [&>ul]:list-disc [&>ul]:space-y-2",
          "[&>ol]:text-[15px] [&>ol]:leading-[1.7] [&>ol]:text-gray-400 [&>ol]:my-5 [&>ol]:pl-6 [&>ol]:space-y-2",
          "[&_li]:text-[15px] [&_li]:leading-[1.7] [&_li]:text-gray-400",
          
          // Blockquotes
          "[&>blockquote]:border-l-4 [&>blockquote]:border-l-blue-500 [&>blockquote]:text-gray-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-6",
          
          // Tables
          "[&_table]:my-6 [&_table]:text-sm [&_table]:border-collapse [&_table]:border [&_table]:border-gray-800",
          "[&_thead]:bg-gray-900",
          "[&_th]:text-left [&_th]:font-semibold [&_th]:p-2 [&_th]:border [&_th]:border-gray-800",
          "[&_td]:p-2 [&_td]:border [&_td]:border-gray-800",
          
          // Images
          "[&_img]:rounded-lg [&_img]:border [&_img]:border-gray-800 [&_img]:my-6",
          
          // Horizontal rules
          "[&>hr]:my-8 [&>hr]:border-gray-800"
        )}
      >
        {children}
      </article>
    </div>
  )
}
