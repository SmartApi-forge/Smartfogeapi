"use client"

import React, { useCallback } from "react"
import { cn } from "@/lib/utils"
import { Heading } from "@/lib/docs/types"
import { useScrollSpy } from "@/hooks/use-scroll-spy"

interface RightSidebarProps {
  headings: Heading[]
  className?: string
}

/**
 * RightSidebar Component
 * 
 * Table of contents sidebar that displays page headings (h2-h4) with:
 * - Nested structure based on heading levels
 * - Active section highlighting based on scroll position
 * - Smooth scroll navigation on link click
 * - Scroll spy integration using Intersection Observer
 * 
 * Requirements: 2.1, 2.4
 */
export function RightSidebar({ headings, className }: RightSidebarProps) {
  // Get the currently active heading ID based on scroll position
  const activeId = useScrollSpy(
    headings.map((h) => h.id),
    { offset: 100 }
  )

  /**
   * Handle smooth scroll to heading when TOC link is clicked
   * Requirements: 2.4
   */
  const handleHeadingClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault()
      
      const element = document.getElementById(id)
      if (!element) {
        console.warn(`Heading with id "${id}" not found`)
        return
      }

      // Smooth scroll to the element with offset for fixed header
      const offset = 80 // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })

      // Update URL hash without jumping
      if (window.history.pushState) {
        window.history.pushState(null, "", `#${id}`)
      }
    },
    []
  )

  // Don't render if no headings
  if (headings.length === 0) {
    return null
  }

  return (
    <aside
      className={cn(
        "hidden xl:block",
        "sticky top-20 h-[calc(100vh-5rem)]",
        "w-64 shrink-0",
        "overflow-y-auto overflow-x-hidden",
        "py-8 pr-4",
        "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700",
        className
      )}
      aria-label="Table of contents"
    >
      <div className="space-y-2">
        <h2 className="text-sm font-semibold mb-4 text-foreground">
          On This Page
        </h2>
        
        <nav aria-label="Table of contents navigation">
          <ul className="space-y-2 text-sm">
            {headings.map((heading) => {
              const isActive = activeId === heading.id
              
              // Calculate indentation based on heading level
              // h2 = 0, h3 = 1, h4 = 2
              const indent = heading.level - 2
              
              return (
                <li
                  key={heading.id}
                  style={{ paddingLeft: `${indent * 0.75}rem` }}
                >
                  <a
                    href={`#${heading.id}`}
                    onClick={(e) => handleHeadingClick(e, heading.id)}
                    className={cn(
                      "block py-1.5 px-2 rounded-md",
                      "transition-all duration-200",
                      "hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "text-sm leading-relaxed",
                      "break-words",
                      isActive
                        ? "text-foreground font-medium bg-accent border-l-2 border-primary pl-3"
                        : "text-muted-foreground hover:bg-accent/50"
                    )}
                    aria-current={isActive ? "location" : undefined}
                    title={heading.text}
                  >
                    {heading.text}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}

/**
 * TableOfContents Component
 * 
 * Alternative component name for semantic clarity
 * Same functionality as RightSidebar
 */
export const TableOfContents = RightSidebar
