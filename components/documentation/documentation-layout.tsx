"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { SkipToContent } from "./skip-to-content"

interface DocumentationLayoutProps {
  children: React.ReactNode
  leftSidebar?: React.ReactNode
  rightSidebar?: React.ReactNode
  className?: string
}

/**
 * DocumentationLayout Component
 * 
 * Three-column responsive layout for documentation pages:
 * - Left sidebar: Navigation
 * - Center: Content area
 * - Right sidebar: Table of contents
 * 
 * Responsive breakpoints:
 * - Mobile (< 768px): Single column, sidebars hidden/toggled
 * - Tablet (768px - 1024px): Two columns (content + one sidebar)
 * - Desktop (>= 1024px): Three columns (full layout)
 * 
 * Requirements: 1.3, 1.4, 6.5
 */
export function DocumentationLayout({
  children,
  leftSidebar,
  rightSidebar,
  className,
}: DocumentationLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Skip to content link for keyboard navigation - Requirements: 6.5 */}
      <SkipToContent />
      
      {/* Three-column grid layout */}
      <div className="mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_240px] gap-0">
          {/* Left Sidebar - Navigation */}
          {leftSidebar && (
            <aside
              className={cn(
                "hidden lg:block",
                "sticky top-0 h-screen overflow-y-auto",
                "bg-sidebar",
                "scrollbar-hide"
              )}
              aria-label="Primary navigation"
            >
              <div className="py-6 px-8">
                {leftSidebar}
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <main id="main-content" className="min-w-0 w-full" tabIndex={-1}>
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>

          {/* Right Sidebar - Table of Contents */}
          {rightSidebar && (
            <aside
              className={cn(
                "hidden xl:block",
                "sticky top-0 h-screen overflow-y-auto",
                "bg-sidebar",
                "scrollbar-hide"
              )}
              aria-label="Table of contents"
            >
              <div className="py-6 px-8">
                {rightSidebar}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
