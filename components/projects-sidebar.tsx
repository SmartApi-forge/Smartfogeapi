"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Plus, Search, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "generating" | "completed" | "failed" | "deployed";
  framework: "fastapi" | "express";
  created_at: string;
  updated_at: string;
  deploy_url: string | null;
  swagger_url: string | null;
}

interface ProjectsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export function ProjectsSidebar({
  isOpen,
  onClose,
  searchQuery: externalSearchQuery,
  setSearchQuery: externalSetSearchQuery,
}: ProjectsSidebarProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [isHovering, setIsHovering] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Use external search query if provided, otherwise use internal state
  const searchQuery =
    externalSearchQuery !== undefined
      ? externalSearchQuery
      : internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery || setInternalSearchQuery;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Helper function to get project title
  const getProjectTitle = (project: Project) => {
    // Extract meaningful title from description or use name
    if (project.description) {
      // Clean up the description to create a proper title
      let title = project.description
        .replace(/^API generated from user prompt:\s*/i, "")
        .replace(/^Create\s+/i, "")
        .replace(/^Build\s+/i, "")
        .replace(/^Generate\s+/i, "")
        .trim();

      // Capitalize first letter
      title = title.charAt(0).toUpperCase() + title.slice(1);

      // Truncate if too long
      if (title.length > 60) {
        title = title.substring(0, 60) + "...";
      }

      return title;
    }

    if (
      project.name &&
      project.name !==
        `API Project ${new Date(project.created_at).toLocaleDateString()}`
    ) {
      return project.name;
    }

    return `${project.framework.toUpperCase()} API Project`;
  };

  // Fetch user projects
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      // Focus the search input when sidebar opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard navigation for search input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Close on Escape key
    if (e.key === "Escape") {
      onClose();
      return;
    }
  };

  // Handle keyboard navigation and accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape key
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus search input on '/' key
      if (e.key === "/" && e.target !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };

    // Trap focus within sidebar
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      const focusableElements = sidebar.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleFocusTrap);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleFocusTrap);
    };
  }, [isOpen, onClose]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setProjects(data || []);
    } catch (err: any) {
      console.error("Error fetching projects:", err);
      setError(err.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) => {
    return getProjectTitle(project)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
  });

  const handleSidebarMouseEnter = () => {
    setIsHovering(true);
  };

  const handleSidebarMouseLeave = () => {
    setIsHovering(false);
    // Close sidebar after a short delay if not clicked to stay open
    setTimeout(() => {
      if (!isHovering) {
        onClose();
      }
    }, 300);
  };

  const handleProjectClick = (project: Project) => {
    // Navigate to project page
    router.push(`/projects/${project.id}`);
    onClose();
  };

  const handleNewProject = () => {
    // Navigate to ask page to create new project
    router.push("/ask");
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-outside overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0.0, 0.2, 1],
            }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <motion.div
            ref={sidebarRef}
            initial={{
              x: -320,
              opacity: 0,
              scale: 0.95,
            }}
            animate={{
              x: 0,
              width: 320,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              x: -320,
              opacity: 0,
              scale: 0.95,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 35,
              mass: 0.8,
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            className="fixed left-0 top-0 bottom-0 bg-gradient-to-b from-[#1A1D21] to-[#0F1114] backdrop-blur-xl border-r border-[#2A2D31]/80 z-50 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2A2D31]/60 bg-gradient-to-r from-[#1E2125] to-[#1A1D21]">
              <div className="flex items-center">
                <h2
                  id="sidebar-title"
                  className="text-lg font-medium text-gray-50 whitespace-nowrap drop-shadow-sm"
                  style={{
                    fontFamily: "'__flecha_df5a44', '__flecha_Fallback_df5a44'",
                  }}
                >
                  My Projects
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewProject}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border border-transparent hover:border-blue-400/30 transition-all duration-200 whitespace-nowrap"
                aria-label="Create new project"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-[#2A2D31]/60 bg-[#1A1D21]/50">
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Navigate your workspace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#2A2D31]/50 border-[#3A3D41] text-white placeholder-gray-400 focus:border-[#3A3D41] focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-[#3A3D41] !ring-0 !outline-none"
                  onKeyDown={handleInputKeyDown}
                />
              </div>
            </div>

            {/* Projects List */}
            <ScrollArea className="flex-1 h-0">
              <div className="p-3">
                {loading ? (
                  // Loading skeletons - Fixed to show full skeletons
                  <div className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="p-3 rounded-lg">
                        <Skeleton className="h-4 w-full mb-2 bg-gray-600/40" />
                        <Skeleton className="h-3 w-3/4 bg-gray-600/40" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  // Error state
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-gray-300 mb-3">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchProjects}
                      className="text-blue-400 border-[#444444] hover:bg-blue-500/20 hover:border-blue-400"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  // Empty state
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FolderOpen className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-300 mb-3">
                      {searchQuery ? "No projects found" : "No projects yet"}
                    </p>
                    {!searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewProject}
                        className="text-blue-400 border-[#444444] hover:bg-blue-500/20 hover:border-blue-400"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create your first project
                      </Button>
                    )}
                  </div>
                ) : (
                  // Projects list with improved styling
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group cursor-pointer"
                        onClick={() => handleProjectClick(project)}
                      >
                        <div className="px-3 py-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-[#2A2D31]/60 hover:shadow-sm border border-transparent hover:border-[#444444]/50 group-hover:scale-[1.01]">
                          <div className="mb-2">
                            <h3 className="font-medium text-gray-100 text-sm leading-relaxed group-hover:text-blue-400 transition-colors duration-200 line-clamp-2">
                              {getProjectTitle(project)}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-400 group-hover:text-blue-400 transition-colors duration-200">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">
                              {formatDate(project.created_at)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer - Removed project count display */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
