"use client"
import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/logo"
import { Share, Globe, Monitor } from "lucide-react"
import { Settings5Line } from "./settings-5-line"
import { GitHubSetupDialog } from "@/components/github-setup-dialog"
import { GitHubBranchSelectorV0 } from "@/components/github-branch-selector-v0"
import { ShareDialog } from "@/components/share-dialog"
import { PublishDialog } from "@/components/publish-dialog"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

interface Project {
  id: string
  name: string
  description?: string
  framework?: 'fastapi' | 'express' | 'nextjs' | 'react' | 'vue' | 'angular' | 'unknown' | 'flask' | 'django' | 'python'
  github_mode?: boolean
  github_repo_id?: string | null
  repo_url?: string | null
  status: string
  user_id?: string
}

interface SimpleHeaderProps {
  viewMode?: 'preview' | 'code'
  onViewModeChange?: (mode: 'preview' | 'code') => void
  project?: Project
  projectFiles?: Record<string, any>
}

export function SimpleHeader({ viewMode = 'preview', onViewModeChange, project, projectFiles = {} }: SimpleHeaderProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
    
    // Get current user
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])
  
  // Default to dark during SSR to prevent white flash, then use actual theme
  const isDark = !mounted ? true : resolvedTheme === 'dark'
  
  // Only show GitHub dialog for manual projects (not GitHub cloned projects)
  const shouldShowGitHubDialog = !project?.github_mode && !project?.github_repo_id && !project?.repo_url
  
  // Show GitHub branch selector for GitHub cloned projects
  const shouldShowGitHubBranchSelector = project?.github_mode || project?.github_repo_id || project?.repo_url
  
  // Check if current user is the project owner
  const isProjectOwner = currentUserId && project?.user_id && currentUserId === project.user_id
  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#FAFAFA] dark:bg-[#0E100F] backdrop-blur supports-[backdrop-filter]:bg-[#FAFAFA]/60 dark:supports-[backdrop-filter]:bg-[#0E100F]/60 border-b border-border/50">
      <div className="container flex h-[50px] items-center justify-between px-4">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>
        </div>

        {/* Center - Empty (view toggle is in sandbox preview) */}
        <div className="flex items-center">
          {/* View toggle is positioned in the sandbox preview component */}
        </div>

        {/* Right side - Action buttons - Responsive with subtle hover */}
        <div className="flex items-center space-x-1 sm:space-x-2" style={{ opacity: mounted ? 1 : 0.99 }}>
          {/* Settings button */}
          <button 
            aria-label="Open settings"
            className={`transition-all duration-300 h-8 w-8 p-0 rounded-md flex items-center justify-center ${isDark ? 'bg-[#1A1A1A] hover:bg-[#262626] border border-gray-600' : 'bg-[#fafafa] hover:bg-[#f2f2f2] border border-gray-300'}`}
          >
            <Settings5Line className={`h-[18px] w-[18px] transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'} pointer-events-none`} />
          </button>
          
          {/* GitHub button - Icon only - Conditionally rendered */}
          {shouldShowGitHubDialog && project?.id && (
            <GitHubSetupDialog 
              projectId={project.id}
              projectFiles={projectFiles}
            >
              <button 
                aria-label="Connect to GitHub"
                className={`transition-all duration-300 h-8 w-8 p-0 rounded-md flex items-center justify-center ${isDark ? 'bg-[#1A1A1A] hover:bg-[#262626] border border-gray-600' : 'bg-[#fafafa] hover:bg-[#f2f2f2] border border-gray-300'}`}
              >
                <Image 
                  src={isDark ? "/github-dark.svg" : "/github-light.svg"}
                  alt="GitHub"
                  width={18}
                  height={18}
                  className="opacity-100 pointer-events-none transition-opacity duration-300"
                />
              </button>
            </GitHubSetupDialog>
          )}
          
          {/* GitHub Branch Selector - For GitHub cloned projects */}
          {shouldShowGitHubBranchSelector && project && (
            <GitHubBranchSelectorV0 project={project}>
              <button 
                aria-label="Manage GitHub branches"
                className={`transition-all duration-300 h-8 w-8 p-0 rounded-md flex items-center justify-center ${isDark ? 'bg-[#1A1A1A] hover:bg-[#262626] border border-gray-600' : 'bg-[#fafafa] hover:bg-[#f2f2f2] border border-gray-300'}`}
              >
                <Image 
                  src={isDark ? "/github-dark.svg" : "/github-light.svg"}
                  alt="GitHub"
                  width={18}
                  height={18}
                  className="opacity-100 pointer-events-none transition-opacity duration-300"
                />
              </button>
            </GitHubBranchSelectorV0>
          )}
          
          {/* Share button - Icon only on mobile */}
          {project?.id && (
            <ShareDialog
              projectId={project.id}
              projectName={project.name}
              isGitHubProject={project.github_mode || !!project.repo_url}
              repoUrl={project.repo_url || undefined}
              isProjectOwner={isProjectOwner || false}
            >
              <button 
                aria-label="Share project"
                className={`transition-all duration-300 h-8 px-2 rounded-md flex items-center justify-center ${isDark ? 'bg-[#1A1A1A] hover:bg-[#262626] border border-gray-600' : 'bg-[#fafafa] hover:bg-[#f2f2f2] border border-gray-300'}`}
              >
                <Share className={`h-[18px] w-[18px] sm:mr-1.5 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'} pointer-events-none`} />
                <span className={`hidden sm:inline text-xs transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>Share</span>
              </button>
            </ShareDialog>
          )}
          
          {/* Publish button - Theme-aware with icon */}
          {project?.id && (
            <PublishDialog
              projectId={project.id}
              projectName={project.name}
            >
              <button 
                aria-label="Publish project"
                className={`transition-all duration-300 h-8 px-3 rounded-md flex items-center justify-center gap-1.5 ${isDark ? 'bg-white hover:bg-gray-200 text-black' : 'bg-black hover:bg-gray-900 text-white'}`}
              >
                <Globe className="h-[16px] w-[16px]" />
                <span className="text-xs font-medium transition-colors duration-300">Publish</span>
              </button>
            </PublishDialog>
          )}
        </div>
      </div>
      </header>
    </>
  )
}