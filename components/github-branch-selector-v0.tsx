"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Github, GitBranch, Plus, Search, Check, X } from "lucide-react"
import { trpc } from "@/src/trpc/client"
import { toast } from "sonner"
import { useTheme } from "next-themes"

interface Project {
  id: string
  name: string
  github_mode?: boolean
  github_repo_id?: string | null
  repo_url?: string | null
  active_branch?: string | null
  status: string
}

interface GitHubBranchSelectorV0Props {
  children: React.ReactNode
  project: Project
  isInitialSetup?: boolean // true for text projects after repo creation
}

interface Branch {
  name: string
  sha: string
  protected: boolean
}

export function GitHubBranchSelectorV0({ 
  children, 
  project,
  isInitialSetup = false 
}: GitHubBranchSelectorV0Props) {
  const { theme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [open, setOpen] = useState(false)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<string>(project.active_branch || "main")
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [hasLocalChanges, setHasLocalChanges] = useState(false)
  // For cloned projects (github_mode=true or repo_url exists), always show Connected state
  const [isConnected, setIsConnected] = useState(
    project.github_mode || !!project.repo_url || !isInitialSetup
  )

  // Fetch project repository info
  const { data: repoInfo } = trpc.github.getProjectRepository.useQuery(
    { projectId: project.id },
    { enabled: open && !!project.id }
  )

  // Mutations
  const updateActiveBranchMutation = trpc.github.updateActiveBranch.useMutation()
  const createBranchMutation = trpc.github.createBranch.useMutation()
  const pushChangesMutation = trpc.github.pushChanges.useMutation()
  const pullChangesMutation = trpc.github.pullChanges.useMutation()
  
  // tRPC utils for manual queries
  const trpcUtils = trpc.useUtils()

  // Extract repository info from URL
  const extractRepoInfo = (url: string) => {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        }
      }
    } catch (error) {
      console.error("Failed to extract repo info:", error)
    }
    return null
  }

  const getRepositoryName = () => {
    // First try to get from repoInfo (database)
    if (repoInfo?.repo_full_name) {
      return repoInfo.repo_full_name
    }
    // Then try to extract from repo_url
    if (project.repo_url) {
      const info = extractRepoInfo(project.repo_url)
      return info ? `${info.owner}/${info.repo}` : project.repo_url
    }
    return "Unknown repository"
  }

  // Fetch branches when dialog opens
  useEffect(() => {
    if (open && project.repo_url) {
      fetchBranches()
    }
  }, [open, project.repo_url])

  // Update active branch from project data
  useEffect(() => {
    if (repoInfo?.active_branch) {
      setActiveBranch(repoInfo.active_branch)
    }
  }, [repoInfo])

  const fetchBranches = async () => {
    if (!project.repo_url) return
    
    setLoading(true)
    try {
      const repoInfoData = extractRepoInfo(project.repo_url)
      if (!repoInfoData) {
        toast.error("Invalid repository URL")
        return
      }

      // Use tRPC to fetch branches with authentication
      const data = await trpcUtils.github.getBranches.fetch({
        owner: repoInfoData.owner,
        repo: repoInfoData.repo,
      })
      
      if (data && data.length > 0) {
        // Safely map branches with sha check
        setBranches(
          data
            .filter((b: any) => b.commit && b.commit.sha) // Filter out branches without sha
            .map((b: any) => ({
              name: b.name,
              sha: b.commit.sha,
              protected: b.protected || false,
            }))
        )
      } else {
        // Repository has no branches yet
        toast.warning("Repository has no branches yet")
      }
    } catch (error: any) {
      console.error("Failed to fetch branches:", error)
      // More specific error messages
      if (error.message && error.message.includes('404')) {
        toast.error("Repository not found or not yet initialized")
      } else if (error.message && error.message.includes('401')) {
        toast.error("GitHub authentication failed. Please reconnect.")
      } else {
        toast.error("Failed to fetch branches: " + (error.message || "Unknown error"))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSetActiveBranch = async () => {
    try {
      // 1. Update active branch in database
      await updateActiveBranchMutation.mutateAsync({
        projectId: project.id,
        branchName: activeBranch,
      })

      // 2. Push all project files to the selected branch
      if (repoInfo) {
        toast.loading("Pushing code to GitHub...", { id: "push" })
        
        // Get current project files
        const response = await fetch(`/api/projects/${project.id}/files`)
        const files = await response.json()

        await pushChangesMutation.mutateAsync({
          repositoryId: repoInfo.id,
          projectId: project.id,
          branchName: activeBranch,
          files: files,
          commitMessage: `Initial commit from SmartAPIForge`,
          createPR: false,
        })

        toast.success(`Code pushed to ${activeBranch}!`, { id: "push" })
      }

      setIsConnected(true)
      
      // Reload to update project data
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error: any) {
      toast.error(error.message || "Failed to set active branch", { id: "push" })
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    
    try {
      const repoInfoData = extractRepoInfo(project.repo_url!)
      if (!repoInfoData) {
        toast.error("Invalid repository URL")
        return
      }

      // Check if branch already exists
      const existingBranch = branches.find(b => b.name === newBranchName.trim())
      if (existingBranch) {
        toast.error("Branch already exists")
        setActiveBranch(newBranchName.trim())
        setNewBranchName("")
        setIsCreatingBranch(false)
        setBranchDropdownOpen(false)
        return
      }

      // Create branch via tRPC
      await createBranchMutation.mutateAsync({
        repoFullName: `${repoInfoData.owner}/${repoInfoData.repo}`,
        branchName: newBranchName.trim(),
        baseBranch: activeBranch,
      })

      toast.success(`Branch ${newBranchName} created!`)
      
      // Refresh branches list
      await fetchBranches()
      
      setActiveBranch(newBranchName.trim())
      setNewBranchName("")
      setIsCreatingBranch(false)
      setBranchDropdownOpen(false)
    } catch (error: any) {
      // Handle specific error for existing branch
      if (error.message && error.message.includes("Reference already exists")) {
        toast.error("Branch already exists")
        await fetchBranches() // Refresh to show existing branch
      } else {
        toast.error(error.message || "Failed to create branch")
      }
    }
  }

  const handlePushChanges = async () => {
    try {
      if (!repoInfo) {
        toast.error("Repository info not found")
        return
      }

      toast.loading("Pushing changes to GitHub...", { id: "push" })

      // Get current project files
      const response = await fetch(`/api/projects/${project.id}/files`)
      const files = await response.json()

      await pushChangesMutation.mutateAsync({
        repositoryId: repoInfo.id,
        projectId: project.id,
        branchName: activeBranch,
        files: files,
        commitMessage: `Update from SmartAPIForge - ${new Date().toLocaleString()}`,
        createPR: false,
      })

      toast.success("Changes pushed successfully!", { id: "push" })
      setHasLocalChanges(false)
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      toast.error(error.message || "Failed to push changes", { id: "push" })
    }
  }

  const handlePullChanges = async () => {
    try {
      if (!repoInfo) {
        toast.error("Repository info not found")
        return
      }

      toast.loading("Pulling changes from GitHub...", { id: "pull" })

      const result = await pullChangesMutation.mutateAsync({
        repositoryId: repoInfo.id,
        branchName: activeBranch,
      })

      if (result.files) {
        toast.success(`Pulled ${Object.keys(result.files).length} files`, { id: "pull" })
        
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to pull changes", { id: "pull" })
    }
  }

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className={`w-[calc(100vw-2rem)] sm:w-[320px] max-w-[360px] p-0 shadow-2xl ${isDark ? 'bg-[#1e1e1e] border-[#333333]' : 'bg-white border-[#e5e5e5]'}`}
        align="center"
        side="bottom"
        sideOffset={12}
        collisionPadding={16}
      >
        {!isConnected ? (
          // STATE 1: Select a Branch (Initial Setup)
          <div className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
            {/* Header */}
            <div className="space-y-1">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>
                Select a Branch
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Select which branch you want to sync changes to.
              </p>
            </div>

            {/* Project Repository */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                Project Repository
              </label>
              <div className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-md border ${isDark ? 'bg-[#2a2a2a] border-[#404040]' : 'bg-[#fafafa] border-[#e5e5e5]'}`}>
                <Github className={`h-4 w-4 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                <span className={`text-xs sm:text-sm font-mono truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {getRepositoryName()}
                </span>
              </div>
            </div>

            {/* Active Branch */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                Active Branch
              </label>
              
              <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-between h-9 text-sm font-normal ${isDark ? 'bg-[#2a2a2a] border-[#404040] text-white hover:bg-[#353535]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>{activeBranch}</span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[calc(100vw-3rem)] sm:w-[288px] max-w-[320px] p-0 bg-[#1e1e1e] border-[#333333]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <div className="p-2 space-y-1">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        placeholder="Create or search branches"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 bg-[#2a2a2a] border-[#404040] text-white placeholder:text-gray-500 h-8 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
                      />
                    </div>
                    
                    {/* Branch list */}
                    <div className="max-h-48 overflow-y-auto">
                      {loading ? (
                        <div className="p-3 text-sm text-gray-400 text-center">
                          Loading branches...
                        </div>
                      ) : filteredBranches.length > 0 ? (
                        filteredBranches.map((branch) => (
                          <button
                            key={branch.name}
                            onClick={() => {
                              setActiveBranch(branch.name)
                              setBranchDropdownOpen(false)
                              setSearchQuery("")
                            }}
                            className="w-full flex items-center justify-between p-2 hover:bg-[#2a2a2a] rounded text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-white">{branch.name}</span>
                            </div>
                            {activeBranch === branch.name && (
                              <Check className="h-3.5 w-3.5 text-white" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-gray-400 text-center">
                          No branches found
                        </div>
                      )}
                    </div>

                    {/* Create Branch option */}
                    <button
                      onClick={() => setIsCreatingBranch(true)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-[#2a2a2a] rounded text-sm transition-colors border-t border-[#333333] mt-1 pt-2"
                    >
                      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600">
                        <Plus className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-blue-400 font-medium">Create Branch</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Set Active Branch Button */}
            <Button
              onClick={handleSetActiveBranch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 font-medium text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Set Active Branch & Push Code</span>
              <span className="sm:hidden">Set Branch & Push</span>
            </Button>
          </div>
        ) : (
          // STATE 2: Connected to GitHub (Active State)
          <div className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-[#171717]'}`}>Connected to GitHub</span>
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Just now</span>
            </div>

            {/* Repository */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                Repository
              </label>
              <div className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-md border ${isDark ? 'bg-[#2a2a2a] border-[#404040]' : 'bg-[#fafafa] border-[#e5e5e5]'}`}>
                <Github className={`h-4 w-4 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                <span className={`text-xs sm:text-sm font-mono truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {getRepositoryName()}
                </span>
              </div>
            </div>

            {/* Active Branch */}
            <div className="space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                Active Branch
              </label>
              
              <div className="flex items-center gap-2">
                <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`flex-1 justify-between h-9 text-sm font-normal ${isDark ? 'bg-[#2a2a2a] border-[#404040] text-white hover:bg-[#353535]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>{activeBranch}</span>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className={`w-[calc(100vw-3rem)] sm:w-[270px] max-w-[300px] p-0 ${isDark ? 'bg-[#1e1e1e] border-[#333333]' : 'bg-white border-[#e5e5e5]'}`}
                    align="start"
                    side="bottom"
                    sideOffset={4}
                  >
                    <div className="p-2 space-y-1">
                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Create or search branches"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={`pl-8 h-8 text-sm ${isDark ? 'bg-[#2a2a2a] border-[#404040] text-white placeholder:text-gray-500' : 'bg-white border-[#e5e5e5] text-gray-900 placeholder:text-gray-400'}`}
                        />
                      </div>
                      
                      {/* Branch list */}
                      <div className="max-h-48 overflow-y-auto">
                        {filteredBranches.map((branch) => (
                          <button
                            key={branch.name}
                            onClick={() => {
                              setActiveBranch(branch.name)
                              setBranchDropdownOpen(false)
                              setSearchQuery("")
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded text-sm ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f2f2f2]'}`}
                          >
                            <div className="flex items-center gap-2">
                              <GitBranch className={`h-3.5 w-3.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                              <span className={isDark ? 'text-white' : 'text-gray-900'}>{branch.name}</span>
                            </div>
                            {activeBranch === branch.name && (
                              <Check className={`h-3.5 w-3.5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Create Branch */}
                      <button
                        onClick={() => setIsCreatingBranch(true)}
                        className={`w-full flex items-center gap-2 p-2 rounded text-sm border-t mt-1 pt-2 ${isDark ? 'hover:bg-[#2a2a2a] border-[#333333]' : 'hover:bg-[#f2f2f2] border-[#e5e5e5]'}`}
                      >
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600">
                          <Plus className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-blue-400 font-medium">Create Branch</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Quick Create Branch Button */}
                <Button
                  onClick={() => setIsCreatingBranch(true)}
                  variant="outline"
                  size="icon"
                  className={`h-9 w-9 ${isDark ? 'bg-[#2a2a2a] border-[#404040] hover:bg-[#353535]' : 'bg-white border-[#e5e5e5] hover:bg-[#fafafa]'}`}
                >
                  <Plus className={`h-4 w-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                </Button>
              </div>
            </div>

            {/* Push/Pull Changes Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handlePullChanges}
                variant="outline"
                className={`flex-1 h-9 font-normal ${isDark ? 'bg-[#2a2a2a] border-[#404040] text-white hover:bg-[#353535]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
              >
                Pull Changes
              </Button>
              <Button
                onClick={handlePushChanges}
                className={`flex-1 h-9 font-normal ${
                  hasLocalChanges 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : isDark ? 'bg-[#2a2a2a] border border-[#404040] text-gray-400 hover:bg-[#353535]' : 'bg-white border border-[#e5e5e5] text-gray-400 hover:bg-[#fafafa]'
                }`}
                disabled={!hasLocalChanges}
              >
                Push Changes
              </Button>
            </div>
          </div>
        )}

        {/* Create Branch Modal */}
        {isCreatingBranch && (
          <div className={`absolute inset-0 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>Create Branch</h3>
              <button
                onClick={() => {
                  setIsCreatingBranch(false)
                  setNewBranchName("")
                }}
                className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                Branch Name
              </label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/new-feature"
                className={`h-9 ${isDark ? 'bg-[#2a2a2a] border-[#404040] text-white' : 'bg-white border-[#e5e5e5] text-gray-900'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBranch()
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setIsCreatingBranch(false)
                  setNewBranchName("")
                }}
                variant="outline"
                className={`flex-1 h-9 ${isDark ? 'bg-transparent border-[#404040] text-white hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9"
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
