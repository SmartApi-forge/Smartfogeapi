"use client"
import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/logo"
import { Share, Globe, Monitor, HomeIcon, User, Settings, LogOut } from "lucide-react"
import { GitHubSetupDialog } from "@/components/github-setup-dialog"
import { GitHubBranchSelectorV0 } from "@/components/github-branch-selector-v0"
import { ShareDialog } from "@/components/share-dialog"
import { VercelDeployDialog } from "@/components/vercel-deploy-dialog"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  isSidebarOpen?: boolean
  onSidebarToggle?: () => void
  onLogoHover?: (hovered: boolean) => void
}

export function SimpleHeader({ viewMode = 'preview', onViewModeChange, project, projectFiles = {}, isSidebarOpen = false, onSidebarToggle, onLogoHover }: SimpleHeaderProps) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
    
    // Get current user
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
      setUserEmail(user?.email || null)
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
  
  // Handle sign out
  const handleSignOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }
  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#FAFAFA] dark:bg-[#0E100F] backdrop-blur supports-[backdrop-filter]:bg-[#FAFAFA]/60 dark:supports-[backdrop-filter]:bg-[#0E100F]/60 border-b border-border/50">
      <div className="flex h-[50px] items-center justify-between w-full pl-2 pr-4">
        {/* Left side - Logo and Breadcrumb navigation */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Modern S logo button for sidebar toggle */}
          <button 
            onClick={onSidebarToggle}
            onMouseEnter={() => onLogoHover?.(true)}
            onMouseLeave={() => onLogoHover?.(false)}
            aria-label="Toggle sidebar"
            className={`group relative transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${
              isSidebarOpen 
                ? 'scale-95 shadow-lg' 
                : 'hover:scale-105 hover:shadow-xl'
            }`}
            style={{
              background: isDark 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {/* Animated gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* S Letter with modern styling */}
            <span className="relative z-10 text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
              S
            </span>
            
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
          </button>

          {/* Breadcrumb navigation */}
          <div className="flex items-center min-w-0 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:inline">
                  <BreadcrumbLink href='/' className='flex items-center gap-1 sm:gap-2 hover:text-foreground transition-colors'>
                    <HomeIcon className='size-3.5 sm:size-4' />
                    <span className="text-sm">Home</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:inline">/</BreadcrumbSeparator>
                <BreadcrumbItem className="hidden sm:inline">
                  <BreadcrumbLink href='/ask' className='hover:text-foreground transition-colors text-sm'>
                    Ask
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:inline">/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[140px] sm:max-w-[180px] md:max-w-[220px] lg:max-w-xs truncate text-xs sm:text-sm font-medium">
                    {project?.name || 'Project'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        {/* Right side - Action buttons - Responsive with subtle hover */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0" style={{ opacity: mounted ? 1 : 0.99 }}>
          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                aria-label="User menu"
                className={`transition-all duration-300 h-8 w-8 p-0 rounded-md flex items-center justify-center ${isDark ? 'bg-[#1A1A1A] hover:bg-[#262626] border border-gray-600' : 'bg-[#fafafa] hover:bg-[#f2f2f2] border border-gray-300'}`}
              >
                <User className={`h-[18px] w-[18px] transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {userEmail && (
                <>
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {userEmail}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* GitHub button - Icon only - Conditionally rendered */}
          {shouldShowGitHubDialog && project?.id && (
            <GitHubSetupDialog 
              projectId={project.id}
              projectFiles={projectFiles}
            >
              <button 
                id="github-setup-button"
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
                id="github-branch-button"
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
          
          {/* Publish button - Theme-aware with Vercel icon */}
          {project?.id && (
            <VercelDeployDialog
              projectId={project.id}
              projectName={project.name}
            >
              <button 
                aria-label="Deploy to Vercel"
                className={`transition-all duration-300 h-8 px-3 rounded-md flex items-center justify-center gap-1.5 ${isDark ? 'bg-white hover:bg-gray-200 text-black' : 'bg-black hover:bg-gray-900 text-white'}`}
              >
                <svg
                  viewBox="0 0 76 65"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                <span className="text-xs font-medium transition-colors duration-300">Publish</span>
              </button>
            </VercelDeployDialog>
          )}
        </div>
      </div>
      </header>
    </>
  )
}