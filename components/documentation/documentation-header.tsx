"use client"

import React from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ThemeToggleButton } from "@/components/ui/theme-toggle-button"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SearchBarLazy } from "./search-bar-lazy"
import { SerializableSearchData } from "@/lib/docs/search-index"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface DocumentationHeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  searchData?: SerializableSearchData
  onMenuClick?: () => void
  showMobileMenu?: boolean
  className?: string
}

/**
 * DocumentationHeader Component
 * 
 * Header for documentation pages with:
 * - Logo
 * - Breadcrumb navigation
 * - Integrated search bar with keyboard shortcuts
 * - Theme toggle
 * - Mobile menu toggle
 * 
 * Requirements: 5.1, 6.1, 6.2
 */
export function DocumentationHeader({
  breadcrumbs = [],
  searchData,
  onMenuClick,
  showMobileMenu = true,
  className,
}: DocumentationHeaderProps) {
  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-50 w-full",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border-b border-border",
        className
      )}
    >
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side - Logo and Breadcrumbs */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Mobile menu toggle - Requirements: 6.1, 6.2 */}
          {showMobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMenuClick}
              aria-label="Toggle navigation menu"
              aria-expanded="false"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}

          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 flex-shrink-0"
            aria-label="SmartAPIForge home"
          >
            <Logo />
          </Link>

          {/* Breadcrumbs - Hidden on mobile */}
          {breadcrumbs.length > 0 && (
            <nav className="hidden md:block min-w-0" aria-label="Breadcrumb">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
                  </BreadcrumbItem>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbSeparator aria-hidden="true">/</BreadcrumbSeparator>
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="max-w-[200px] truncate">
                            {crumb.label}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </nav>
          )}
        </div>

        {/* Right side - Search and Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Integrated search bar - lazy loaded for performance */}
          <SearchBarLazy
            searchData={searchData}
            placeholder="Search documentation..."
            className="w-full sm:w-64"
          />

          {/* Theme toggle */}
          <ThemeToggleButton variant="circle-blur" start="bottom-right" />
        </div>
      </div>
    </header>
  )
}
