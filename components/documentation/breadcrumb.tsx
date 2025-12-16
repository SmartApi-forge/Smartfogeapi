"use client"

import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumb Component
 * 
 * Displays hierarchical navigation path based on URL structure.
 * Helps users understand their current location in the documentation.
 * 
 * Requirements: 5.2
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1 text-sm text-gray-400", className)}
    >
      <ol className="flex items-center space-x-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 text-gray-600" aria-hidden="true" />
              )}
              {isLast ? (
                <span
                  className="font-medium text-white"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Generate breadcrumb items from URL path
 * 
 * Converts URL structure like /docs/getting-started/introduction
 * into breadcrumb items with proper labels and links
 */
export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with Docs home
  breadcrumbs.push({
    label: "Docs",
    href: "/docs/getting-started/introduction",
  })

  // Skip the first segment if it's "docs"
  const startIndex = segments[0] === "docs" ? 1 : 0

  // Build breadcrumbs from remaining segments
  for (let i = startIndex; i < segments.length; i++) {
    const segment = segments[i]
    const href = "/docs/" + segments.slice(startIndex, i + 1).join("/")
    
    // Format the label: convert kebab-case to Title Case
    const label = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")

    breadcrumbs.push({
      label,
      href,
    })
  }

  return breadcrumbs
}
