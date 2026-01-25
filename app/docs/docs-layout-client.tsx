"use client"

import React, { useState, useEffect } from "react"
import { DocumentationLayout, LeftSidebar, RightSidebar } from "@/components/documentation"
import { navigationConfig } from "@/lib/docs/navigation-config"
import type { Heading } from "@/lib/docs/types"

interface DocsLayoutClientProps {
  children: React.ReactNode
  headings?: Heading[]
}

/**
 * DocsLayoutClient Component
 * 
 * Client-side layout wrapper for documentation pages that:
 * - Receives extracted headings from server-side MDX compilation
 * - Passes headings to RightSidebar for table of contents
 * - Manages mobile menu state
 * - Handles error cases when heading extraction fails
 * 
 * Requirements: 5.2, 5.3, 5.5
 */
export function DocsLayoutClient({ children, headings = [] }: DocsLayoutClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Log warning in development if headings extraction appears to have failed
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Check if headings array is empty or invalid
      if (!headings || headings.length === 0) {
        console.warn(
          '[DocsLayoutClient] No headings provided. ' +
          'Right sidebar will not be displayed. ' +
          'This may indicate heading extraction failed during MDX compilation.'
        )
      }
      
      // Validate heading structure
      const invalidHeadings = headings.filter(
        h => !h.id || !h.text || typeof h.level !== 'number'
      )
      
      if (invalidHeadings.length > 0) {
        console.warn(
          '[DocsLayoutClient] Invalid heading structure detected:',
          invalidHeadings
        )
      }
    }
  }, [headings])

  // Convert navigation config to array of sections
  const sections = Object.values(navigationConfig.sections)

  // Render page without right sidebar if headings extraction failed
  // This ensures the page remains functional even when TOC is unavailable
  const shouldShowRightSidebar = headings && headings.length > 0

  return (
    <DocumentationLayout
      leftSidebar={
        <LeftSidebar
          sections={sections}
          isOpen={isMobileMenuOpen}
          onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
      }
      rightSidebar={shouldShowRightSidebar ? <RightSidebar headings={headings} /> : null}
    >
      {children}
    </DocumentationLayout>
  )
}
