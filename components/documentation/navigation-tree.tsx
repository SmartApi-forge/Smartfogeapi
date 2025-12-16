"use client"

import React from "react"
import { NavigationItem as NavigationItemType } from "@/lib/docs/types"
import { NavigationItem } from "./navigation-item"

interface NavigationTreeProps {
  items: NavigationItemType[]
  currentPath: string
  level?: number
  className?: string
}

/**
 * NavigationTree Component
 * 
 * Recursive navigation tree renderer that displays navigation items
 * with proper nesting and hierarchy.
 * 
 * Requirements: 1.2, 1.5
 */
export function NavigationTree({
  items,
  currentPath,
  level = 0,
  className,
}: NavigationTreeProps) {
  return (
    <ul role="list" className={className}>
      {items.map((item) => (
        <NavigationItem
          key={item.id}
          item={item}
          currentPath={currentPath}
          level={level}
        />
      ))}
    </ul>
  )
}
