"use client"
import Link from "next/link"
import { useState } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Share, Github, Settings, Eye, Code2 } from "lucide-react"
import { motion } from "framer-motion"
import { GitHubRepositoryDialog } from "@/components/github-repository-dialog"
import { GitHubBranchSelector } from "@/components/github-branch-selector"

interface Project {
  id: string
  name: string
  description?: string
  framework?: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
  github_mode?: boolean
  github_repo_id?: string | null
  repo_url?: string | null
  status: string
}

interface SimpleHeaderProps {
  viewMode?: 'preview' | 'code'
  onViewModeChange?: (mode: 'preview' | 'code') => void
  project?: Project
}

export function SimpleHeader({ viewMode = 'preview', onViewModeChange, project }: SimpleHeaderProps) {

  // Only show GitHub dialog for manual projects (not GitHub cloned projects)
  const shouldShowGitHubDialog = !project?.github_mode && !project?.github_repo_id && !project?.repo_url
  
  // Show GitHub branch selector for GitHub cloned projects
  const shouldShowGitHubBranchSelector = project?.github_mode || project?.github_repo_id || project?.repo_url



  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#0E100F] backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#0E100F]/60 border-b border-border/50">
      <div className="container flex h-12 sm:h-14 md:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>
        </div>

        {/* Center - View Mode Toggle (Always visible) */}
        <div className="flex items-center">
          <div className="relative flex items-center gap-0 bg-muted/50 dark:bg-[#0E100F] border border-border/50 dark:border-[#333433] rounded-lg p-0.5">
            {/* Animated background indicator */}
            <motion.div
              className="absolute inset-y-0.5 bg-background dark:bg-[#1D1D1D] rounded-md shadow-sm"
              initial={false}
              animate={{
                left: viewMode === 'preview' ? '2px' : 'calc(50%)',
                right: viewMode === 'preview' ? 'calc(50%)' : '2px',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
            <button
              onClick={() => onViewModeChange?.('preview')}
              className={`relative z-10 px-3 py-1.5 text-xs font-medium transition-colors rounded-md ${
                viewMode === 'preview'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange?.('code')}
              className={`relative z-10 px-3 py-1.5 text-xs font-medium transition-colors rounded-md ${
                viewMode === 'code'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Code view"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right side - Action buttons - Responsive with subtle hover */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Settings button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-white hover:text-white !bg-[#1A1A1A] hover:!bg-[#2A2A2A] transition-colors h-7 sm:h-8 px-1.5 border border-gray-300 dark:border-gray-600 rounded-md"
            style={{ backgroundColor: '#1A1A1A' }}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          
          {/* GitHub button - Icon only - Conditionally rendered */}
          {shouldShowGitHubDialog && (
            <GitHubRepositoryDialog>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-white hover:text-white !bg-[#1A1A1A] hover:!bg-[#2A2A2A] transition-colors h-7 sm:h-8 px-1.5 border border-gray-300 dark:border-gray-600 rounded-md"
                style={{ backgroundColor: '#1A1A1A' }}
              >
                <Github className="h-3.5 w-3.5" />
              </Button>
            </GitHubRepositoryDialog>
          )}
          
          {/* GitHub Branch Selector - For GitHub cloned projects */}
          {shouldShowGitHubBranchSelector && project && (
            <GitHubBranchSelector project={project}>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-white hover:text-white !bg-[#1A1A1A] hover:!bg-[#2A2A2A] transition-colors h-7 sm:h-8 px-1.5 border border-gray-300 dark:border-gray-600 rounded-md"
                style={{ backgroundColor: '#1A1A1A' }}
              >
                <Github className="h-3.5 w-3.5" />
              </Button>
            </GitHubBranchSelector>
          )}
          
          {/* Share button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-white hover:text-white !bg-[#1A1A1A] hover:!bg-[#2A2A2A] transition-colors h-7 sm:h-8 px-1.5 sm:px-2 border border-gray-300 dark:border-gray-600 rounded-md"
            style={{ backgroundColor: '#1A1A1A' }}
          >
            <Share className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline text-xs">Share</span>
          </Button>
          
          {/* Publish button - White background */}
          <Button 
            variant="secondary" 
            size="sm" 
            className="bg-white hover:bg-gray-50 text-black border border-gray-200 transition-colors h-7 sm:h-8 px-2 sm:px-3"
          >
            <span className="text-xs">Publish</span>
          </Button>
        </div>
      </div>
      </header>
    </>
  )
}