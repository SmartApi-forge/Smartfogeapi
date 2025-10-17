"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { 
  FolderOpen, 
  Plus, 
  Search, 
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  description: string | null
  status: 'generating' | 'completed' | 'failed' | 'deployed'
  framework: 'fastapi' | 'express'
  created_at: string
  updated_at: string
  deploy_url: string | null
  swagger_url: string | null
}

interface ModernSidebarProps {
  isOpen: boolean
  onClose: () => void
  searchQuery?: string
  setSearchQuery?: (query: string) => void
  className?: string
}

export function ModernSidebar({ 
  isOpen, 
  onClose, 
  searchQuery: externalSearchQuery, 
  setSearchQuery: externalSetSearchQuery,
  className 
}: ModernSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const [isHovering, setIsHovering] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Use external search query if provided, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const setSearchQuery = externalSetSearchQuery || setInternalSearchQuery

  // Helper function to get project title
  const getProjectTitle = (project: Project) => {
    if (project.description) {
      let title = project.description
        .replace(/^API generated from user prompt:\s*/i, '')
        .replace(/^Create\s+/i, '')
        .replace(/^Build\s+/i, '')
        .replace(/^Generate\s+/i, '')
        .trim()
      
      title = title.charAt(0).toUpperCase() + title.slice(1)
      
      // Instead of truncating, return the full title for better display
      return title
    }
    
    if (project.name && project.name !== `API Project ${new Date(project.created_at).toLocaleDateString()}`) {
      return project.name
    }
    
    return `${project.framework.toUpperCase()} API`
  }

  // Get status color and icon
  const getStatusInfo = (status: Project['status']) => {
    switch (status) {
      case 'generating':
        return { color: 'bg-yellow-500', label: 'Generating', pulse: true }
      case 'completed':
        return { color: 'bg-green-500', label: 'Ready', pulse: false }
      case 'failed':
        return { color: 'bg-red-500', label: 'Failed', pulse: false }
      case 'deployed':
        return { color: 'bg-blue-500', label: 'Live', pulse: false }
      default:
        return { color: 'bg-gray-500', label: 'Unknown', pulse: false }
    }
  }

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Please log in to view your projects")
        return
      }

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching projects:', fetchError)
        setError("Failed to load projects")
        return
      }

      setProjects(data || [])
    } catch (err) {
      console.error('Error in fetchProjects:', err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Effects
  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === '/' && e.target !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Handlers
  const handleSidebarMouseEnter = () => {
    setIsHovering(true)
  }

  const handleSidebarMouseLeave = () => {
    setIsHovering(false)
    setTimeout(() => {
      if (!isHovering) {
        onClose()
      }
    }, 300)
  }

  const handleProjectClick = (project: Project) => {
    // Add a small delay for the click animation to complete
    setTimeout(() => {
      router.push(`/projects/${project.id}`)
      onClose()
    }, 150)
  }

  const handleNavigationClick = (href: string) => {
    router.push(href)
    onClose()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  // Filter projects based on search query
  const filteredProjects = projects.filter(project => {
    return getProjectTitle(project).toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          
          {/* Sidebar */}
          <motion.div
            ref={sidebarRef}
            initial={{ 
              x: -400, 
              opacity: 0,
              scale: 0.95 
            }}
            animate={{ 
              x: 0, 
              opacity: 1,
              scale: 1 
            }}
            exit={{ 
              x: -400, 
              opacity: 0,
              scale: 0.95 
            }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className={cn(
              "fixed left-0 top-0 bottom-0 w-80 z-50 flex flex-col overflow-hidden",
              "bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95",
              "backdrop-blur-xl border-r border-slate-700/50",
              "shadow-2xl shadow-black/20",
              className
            )}
            style={{
              background: `
                linear-gradient(135deg, 
                  rgba(15, 23, 42, 0.95) 0%, 
                  rgba(30, 41, 59, 0.95) 50%, 
                  rgba(15, 23, 42, 0.95) 100%
                )
              `,
              backdropFilter: 'blur(20px)',
              boxShadow: `
                0 0 0 1px rgba(148, 163, 184, 0.1),
                0 25px 50px -12px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(148, 163, 184, 0.1)
              `
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-700/30">
              <div className="flex items-center gap-3">
                <div>
                  <h2 
                    id="sidebar-title"
                    className="text-lg font-semibold text-white" 
                  >
                    Smart API Forge
                  </h2>
                  <p className="text-xs text-slate-400">AI-Powered API Builder</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 w-8 lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-400 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      onClose()
                    }
                  }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 flex-shrink-0">
                {/* Create New Project Button */}
                <motion.button
                  onClick={() => handleNavigationClick('/ask')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 text-slate-200 font-medium transition-all duration-200 hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="h-5 w-5" />
                  <span>Create New API</span>
                </motion.button>
              </div>

              <ScrollArea className="flex-1 px-4" style={{ height: 'calc(100vh - 200px)' }}>
                <div className="space-y-3 pb-8" style={{ minHeight: '400px' }}>
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-800/30">
                          <Skeleton className="h-4 w-full mb-2 bg-slate-700/50" />
                          <Skeleton className="h-3 w-3/4 bg-slate-700/50" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-slate-400 mb-3">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchProjects}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700/50"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FolderOpen className="h-12 w-12 text-slate-500 mb-3" />
                      <p className="text-sm text-slate-400 mb-1">
                        {searchQuery ? "No projects found" : "No projects yet"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {searchQuery ? "Try a different search term" : "Create your first API to get started"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredProjects.map((project) => {
                        const statusInfo = getStatusInfo(project.status)
                        
                        return (
                          <motion.button
                            key={project.id}
                            onClick={() => handleProjectClick(project)}
                            className="w-full p-3 rounded-lg bg-slate-800/30 hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-200 text-left group cursor-pointer"
                            whileHover={{ 
                              scale: 1.02,
                              backgroundColor: "rgba(51, 65, 85, 0.6)",
                              borderColor: "rgba(71, 85, 105, 0.6)"
                            }}
                            whileTap={{ 
                              scale: 0.98,
                              backgroundColor: "rgba(30, 41, 59, 0.8)"
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 25
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-medium text-slate-200 text-sm leading-relaxed group-hover:text-white transition-colors duration-200 break-words">
                                {getProjectTitle(project)}
                              </h3>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-300 transition-colors duration-200">
                                <span>{formatDate(project.created_at)}</span>
                              </div>
                              <Badge 
                                variant="secondary" 
                                className="h-5 px-2 text-xs bg-slate-700/50 text-slate-300 border-slate-600/50 group-hover:bg-slate-600/60 group-hover:text-slate-200 transition-all duration-200"
                              >
                                {project.framework.toUpperCase()}
                              </Badge>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>


          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}