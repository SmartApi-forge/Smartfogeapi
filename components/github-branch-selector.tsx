"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Github, GitBranch, Plus, Search, ChevronDown, Check } from "lucide-react"
import { trpc } from "@/src/trpc/client"

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

interface GitHubBranchSelectorProps {
  children: React.ReactNode
  project: Project
}

interface Branch {
  name: string
  sha: string
  protected: boolean
}

export function GitHubBranchSelector({ children, project }: GitHubBranchSelectorProps) {
  const [open, setOpen] = useState(false)
  const [createBranchOpen, setCreateBranchOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<string>("main")
  const [loading, setLoading] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const mainTriggerRef = useRef<HTMLButtonElement>(null)

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
      console.error('Error parsing repo URL:', error)
    }
    return null
  }

  const getRepositoryName = () => {
    if (!project.repo_url) return "No repository connected"
    
    const repoInfo = extractRepoInfo(project.repo_url)
    if (repoInfo) {
      return `${repoInfo.owner}/${repoInfo.repo}`
    }
    
    // Fallback: try to extract from URL
    try {
      const url = new URL(project.repo_url)
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        return `${pathParts[0]}/${pathParts[1].replace(/\.git$/, '')}`
      }
    } catch (error) {
      console.error('Error parsing repository URL:', error)
    }
    
    return project.repo_url
  }

  const repoInfo = project.repo_url ? extractRepoInfo(project.repo_url) : null

  // Use tRPC hook to fetch real branches
  const { data: fetchedBranches, isLoading: isFetchingBranches, error: branchError } = trpc.github.getBranches.useQuery(
    {
      owner: repoInfo?.owner || '',
      repo: repoInfo?.repo || ''
    },
    {
      enabled: open && !!repoInfo?.owner && !!repoInfo?.repo,
      retry: 1,
      onError: (error) => {
        console.error('Failed to fetch branches:', error)
      }
    }
  )

  // Update branches when data is fetched
  useEffect(() => {
    if (fetchedBranches) {
      setBranches(fetchedBranches)
      setLoading(false)
    } else if (branchError) {
      // Fallback to default branch if API fails
      setBranches([
        { name: "main", sha: "unknown", protected: true }
      ])
      setLoading(false)
    } else if (isFetchingBranches) {
      setLoading(true)
    } else if (open && !repoInfo) {
      // Fallback if repo URL parsing fails
      setBranches([
        { name: "main", sha: "unknown", protected: true }
      ])
      setLoading(false)
    }
  }, [fetchedBranches, branchError, isFetchingBranches, open, repoInfo])

  // Filter branches based on search query
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSetActiveBranch = () => {
    // Here you would implement the logic to switch branches
    console.log(`Switching to branch: ${activeBranch}`)
    setOpen(false)
    // You could show a toast notification here
  }

  const handleCreateBranch = () => {
    // Here you would implement the logic to create a new branch
    console.log(`Creating new branch: ${newBranchName}`)
    setCreateBranchOpen(false)
    setNewBranchName("")
    // You could show a toast notification here
  }

  const handleAddBranchClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false) // Close the branch selector
    // Small delay to ensure the first popover closes before opening the second
    setTimeout(() => {
      setCreateBranchOpen(true)
    }, 50)
  }

  const handleBranchSelect = (branchName: string) => {
    setActiveBranch(branchName)
    setBranchDropdownOpen(false)
  }

  const handleCreateBranchFromDropdown = () => {
    setBranchDropdownOpen(false)
    setOpen(false)
    setTimeout(() => {
      setCreateBranchOpen(true)
    }, 50)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild ref={mainTriggerRef}>
          {children}
        </PopoverTrigger>
        <PopoverContent 
          className="w-[300px] p-0 bg-[#1e1e1e] border-[#333333] shadow-lg" 
          align="end"
          side="bottom"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={16}
        >
          <div className="p-3 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-white">
                Select a Branch
              </h3>
              <p className="text-xs text-[#8b8b8b]">
                Select which branch you want to sync changes to.
              </p>
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-[#8b8b8b] mb-1.5 block">
                  Project Repository
                </label>
                <div className="flex items-center gap-2 p-2 bg-[#2a2a2a] rounded-md border border-[#404040]">
                  <Github className="h-4 w-4 text-[#8b8b8b]" />
                  <span className="text-sm text-white font-mono">
                    {getRepositoryName()}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-[#8b8b8b] mb-1.5 block">
                  Active Branch
                </label>
                <div className="relative flex gap-2">
                  <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-between bg-[#2a2a2a] border-[#404040] text-white hover:bg-[#404040] h-8 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3 w-3" />
                          <span>{activeBranch}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[280px] p-0 bg-[#1e1e1e] border-[#333333] shadow-lg"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                      avoidCollisions={true}
                      collisionPadding={16}
                    >
                      <div className="p-2 space-y-1">
                        {/* Search input */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-[#8b8b8b]" />
                          <Input
                            placeholder="Create or search branches"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-[#2a2a2a] border-[#404040] text-white placeholder:text-[#8b8b8b] h-7 text-sm"
                          />
                        </div>
                        
                        {/* Branch list */}
                        <div className="max-h-40 overflow-y-auto">
                          {loading ? (
                            <div className="p-2 text-sm text-[#8b8b8b]">
                              Loading branches...
                            </div>
                          ) : filteredBranches.length > 0 ? (
                            filteredBranches.map((branch) => (
                              <div
                                key={branch.name}
                                onClick={() => handleBranchSelect(branch.name)}
                                className="flex items-center justify-between p-1.5 hover:bg-[#404040] cursor-pointer rounded text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <GitBranch className="h-3 w-3 text-[#8b8b8b]" />
                                  <span className="text-white text-sm">{branch.name}</span>
                                  {branch.protected && (
                                    <span className="text-xs text-yellow-400">(protected)</span>
                                  )}
                                </div>
                                {activeBranch === branch.name && (
                                  <Check className="h-3.5 w-3.5 text-white" />
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-[#8b8b8b]">
                              No branches found
                            </div>
                          )}
                        </div>
                        
                        {/* Create Branch option */}
                        <div className="border-t border-[#404040] pt-1">
                          <div
                            onClick={handleCreateBranchFromDropdown}
                            className="flex items-center gap-2 p-1.5 hover:bg-[#404040] cursor-pointer rounded text-sm text-white"
                          >
                            <Plus className="h-3.5 w-3.5 text-[#8b8b8b]" />
                            <span>Create Branch</span>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Plus button for creating new branch */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateBranchFromDropdown}
                    className="flex-shrink-0 bg-[#2a2a2a] border-[#404040] text-white hover:bg-[#404040] h-8 w-8 p-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleSetActiveBranch}
              className="w-full bg-white text-black hover:bg-gray-100 font-medium h-8 text-sm"
              disabled={loading}
            >
              Set Active Branch
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={createBranchOpen} onOpenChange={setCreateBranchOpen}>
        <PopoverTrigger asChild>
          <div style={{ display: 'none' }} />
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-[#1e1e1e] border-[#333333] shadow-lg" 
          align="end"
          side="bottom"
          sideOffset={8}
          style={{
            position: 'fixed',
            left: mainTriggerRef.current ? 
              mainTriggerRef.current.getBoundingClientRect().right - 320 + 'px' : 
              'auto',
            top: mainTriggerRef.current ? 
              mainTriggerRef.current.getBoundingClientRect().bottom + 8 + 'px' : 
              'auto'
          }}
          onInteractOutside={(e) => {
            // Allow normal closing behavior
            setCreateBranchOpen(false)
          }}
        >
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-medium text-white">
                Create a new branch
              </h3>
              <p className="text-sm text-[#8b8b8b]">
                Effortlessly create or clone a new branch in Smart API Forge and keep every change in sync with GitHub.
              </p>
            </div>
            
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="new-api-branch"
              className="bg-[#2a2a2a] border-[#404040] text-white placeholder:text-[#8b8b8b] h-9"
              autoFocus
            />
            
            <div className="flex gap-2">
              <Button
                onClick={() => setCreateBranchOpen(false)}
                variant="outline"
                className="flex-1 bg-transparent border-[#404040] text-white hover:bg-[#404040] h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                className="flex-1 bg-white text-black hover:bg-gray-100 font-medium h-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Branch
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}