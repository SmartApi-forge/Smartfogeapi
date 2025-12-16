"use client"

import React, { useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NavigationSection } from "@/lib/docs/types"
import { NavigationTree } from "./navigation-tree"
import { Sheet, SheetContent } from "@/components/ui/sheet"

interface LeftSidebarProps {
  sections: NavigationSection[]
  currentPath?: string
  isOpen?: boolean
  onToggle?: () => void
  className?: string
}

/**
 * LeftSidebar Component
 * 
 * Primary navigation sidebar for documentation with:
 * - Collapsible navigation tree
 * - Active state highlighting
 * - Expand/collapse functionality for nested sections
 * - Mobile hamburger menu toggle
 * 
 * Requirements: 1.2, 1.5, 1.4
 */
export function LeftSidebar({
  sections,
  currentPath,
  isOpen = false,
  onToggle,
  className,
}: LeftSidebarProps) {
  const pathname = usePathname()
  const activePath = currentPath || pathname || ''

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.filter((s) => s.expanded).map((s) => s.id))
  )

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const sidebarContent = (
    <nav
      className={cn("space-y-4", className)}
      aria-label="Documentation navigation"
    >
      {sections.map((section) => (
        <div key={section.id} className="space-y-1">
          {/* Section Header */}
          <button
            onClick={() => toggleSection(section.id)}
            className={cn(
              "flex w-full items-center justify-between",
              "px-2 py-1.5 rounded-md",
              "text-xs font-semibold uppercase tracking-wider",
              "text-muted-foreground",
              "hover:bg-accent hover:text-accent-foreground",
              "transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-expanded={expandedSections.has(section.id)}
          >
            <div className="flex items-center gap-2">
              {section.icon && <span className="text-xs">{section.icon}</span>}
              <span>{section.title}</span>
            </div>
            <svg
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                expandedSections.has(section.id) ? "rotate-90" : ""
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Navigation Items */}
          {expandedSections.has(section.id) && (
            <div className="pt-1">
              <NavigationTree
                items={section.items}
                currentPath={activePath}
                level={0}
              />
            </div>
          )}
        </div>
      ))}
    </nav>
  )

  return (
    <>
      {/* Desktop Sidebar - Always visible on large screens */}
      <div className="hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={onToggle}>
          <SheetContent side="left" className="w-[280px] p-6 overflow-y-auto">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
