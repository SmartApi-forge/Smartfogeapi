"use client"

import React, { useState, useRef, KeyboardEvent } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { NavigationItem as NavigationItemType } from "@/lib/docs/types"
import { NavigationTree } from "./navigation-tree"
import { Badge } from "@/components/ui/badge"

interface NavigationItemProps {
  item: NavigationItemType
  currentPath: string
  level: number
}

/**
 * NavigationItem Component
 * 
 * Individual navigation item with:
 * - Active state highlighting
 * - Hover states
 * - Keyboard navigation support
 * - Recursive rendering for nested items
 * - Optional badges (New, Beta, etc.)
 * 
 * Requirements: 1.2, 1.5
 */
export function NavigationItem({
  item,
  currentPath,
  level,
}: NavigationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  
  const isActive = currentPath === item.href
  const hasChildren = item.children && item.children.length > 0

  // Check if any child is active
  const hasActiveChild = hasChildren
    ? item.children!.some((child) => currentPath === child.href)
    : false

  // Auto-expand if has active child
  React.useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true)
    }
  }, [hasActiveChild])

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    // Requirements: 6.5 - Keyboard navigation support
    // Handle keyboard navigation for accessibility
    switch (e.key) {
      case "Enter":
        // Allow default link behavior for Enter key
        // This ensures links can be activated with Enter
        break
      case " ":
        // Space key should also activate links
        e.preventDefault()
        linkRef.current?.click()
        break
      case "ArrowRight":
        if (hasChildren && !isExpanded) {
          e.preventDefault()
          setIsExpanded(true)
        }
        break
      case "ArrowLeft":
        if (hasChildren && isExpanded) {
          e.preventDefault()
          setIsExpanded(false)
        }
        break
      case "ArrowDown":
        // Focus next item
        e.preventDefault()
        const nextElement = linkRef.current?.parentElement?.nextElementSibling?.querySelector("a")
        if (nextElement instanceof HTMLElement) {
          nextElement.focus()
        }
        break
      case "ArrowUp":
        // Focus previous item
        e.preventDefault()
        const prevElement = linkRef.current?.parentElement?.previousElementSibling?.querySelector("a")
        if (prevElement instanceof HTMLElement) {
          prevElement.focus()
        }
        break
    }
  }

  const toggleExpanded = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  // Calculate indentation based on nesting level
  const indentClass = level > 0 ? `pl-${Math.min(level * 4, 12)}` : ""

  return (
    <li role="listitem" className="relative mb-0.5">
      <div className="flex items-center">
        {/* Expand/Collapse button for items with children */}
        {hasChildren && (
          <button
            onClick={toggleExpanded}
            className={cn(
              "absolute left-0 p-0.5 rounded",
              "hover:bg-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "transition-colors duration-200",
              "z-10"
            )}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            <svg
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isExpanded ? "rotate-90" : ""
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
        )}

        {/* Navigation Link */}
        <Link
          ref={linkRef}
          href={item.href}
          className={cn(
            "flex-1 flex items-center justify-between gap-2",
            "px-3 py-1.5 rounded-md",
            "text-sm leading-tight",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            hasChildren && "pl-6",
            level === 0 ? "" : `pl-${Math.min((level + 1) * 3, 9)}`,
            isActive
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          aria-current={isActive ? "page" : undefined}
          onKeyDown={handleKeyDown}
        >
          <span className="truncate">{item.title}</span>
          
          {/* Badge (New, Beta, etc.) */}
          {item.badge && (
            <Badge
              variant="secondary"
              className="ml-auto text-xs px-1.5 py-0.5 h-5"
            >
              {item.badge}
            </Badge>
          )}
        </Link>
      </div>

      {/* Nested Children */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5 ml-3 border-l border-border/50 pl-1.5">
          <NavigationTree
            items={item.children!}
            currentPath={currentPath}
            level={level + 1}
          />
        </div>
      )}
    </li>
  )
}
