"use client"

import React from "react"
import { cn } from "@/lib/utils"

/**
 * SkipToContent Component
 * 
 * Provides a skip link for keyboard users to bypass navigation
 * and jump directly to main content.
 * 
 * This link is visually hidden until focused, improving accessibility
 * for screen reader and keyboard-only users.
 * 
 * Requirements: 6.5 - Keyboard navigation support
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className={cn(
        // Visually hidden by default
        "sr-only",
        // Visible when focused
        "focus:not-sr-only",
        "focus:absolute focus:top-4 focus:left-4",
        "focus:z-50",
        // Styling
        "focus:inline-block",
        "focus:px-4 focus:py-2",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Typography
        "font-medium text-sm",
        // Transition
        "transition-all duration-200"
      )}
    >
      Skip to main content
    </a>
  )
}
