"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Zap,
  ChevronRight,
  Search,
  X,
  ChevronLeft,
  Plus,
  FolderKanban,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  project_id?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  framework?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface V0SidebarProps {
  projectId: string;
  projectName?: string;
  messages?: Message[];
  onNavigate?: (section: string) => void;
  showMobileToggle?: boolean;
  activeSection?: string;
  project?: {
    id: string;
    framework?: string;
    status?: string;
    deploy_url?: string;
    swagger_url?: string;
    sandbox_url?: string;
  };
  onTerminalToggle?: () => void;
  onPreviewToggle?: () => void;
  showTerminal?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

export function V0Sidebar({ projectId, projectName, messages = [], onNavigate, showMobileToggle = true, activeSection, project, onTerminalToggle, onPreviewToggle, showTerminal, isOpen, onOpenChange, isHovered, onHoverChange }: V0SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [manuallyToggled, setManuallyToggled] = useState(false);
  const [lastHoverTime, setLastHoverTime] = useState(0);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [recentChats, setRecentChats] = useState<Message[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Fetch user's projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!showProjectList) {
        console.log('[V0Sidebar] Not fetching projects - showProjectList is false');
        return;
      }
      
      console.log('[V0Sidebar] Fetching projects...');
      setIsLoadingProjects(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[V0Sidebar] No user found');
          return;
        }

        console.log('[V0Sidebar] User ID:', user.id);
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[V0Sidebar] Error fetching projects:', error);
          throw error;
        }
        
        console.log('[V0Sidebar] Fetched projects:', data?.length || 0, 'projects');
        setUserProjects(data || []);
      } catch (error) {
        console.error('[V0Sidebar] Error fetching projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [showProjectList]);

  // Fetch recent chats for the current project only
  useEffect(() => {
    const fetchRecentChats = async () => {
      if (!showChatList || !projectId) return;
      
      setIsLoadingChats(true);
      try {
        // Get recent messages from the current project only
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('project_id', projectId)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setRecentChats(data || []);
      } catch (error) {
        console.error('Error fetching recent chats:', error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    fetchRecentChats();
  }, [showChatList, projectId]);

  // Filter messages based on search query
  const filteredMessages = recentChats.filter(msg => 
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter projects based on search query
  const filteredProjects = userProjects.filter(proj =>
    proj.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
    (proj.description && proj.description.toLowerCase().includes(projectSearchQuery.toLowerCase()))
  );

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      console.log('[V0Sidebar] Mobile detected:', mobile, 'Width:', window.innerWidth);
      // On mobile, if sidebar is open, ensure it stays visible
      if (mobile && isExpanded) {
        console.log('[V0Sidebar] Mobile sidebar is expanded');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isExpanded]);

  // Sync with parent isOpen prop
  useEffect(() => {
    if (isOpen !== undefined) {
      setIsExpanded(isOpen);
      // If parent controls the state, consider it manually toggled
      setManuallyToggled(true);
    }
  }, [isOpen]);

  // Sync with parent isHovered prop
  useEffect(() => {
    if (isHovered !== undefined) {
      setIsExpanded(isHovered);
    }
  }, [isHovered]);

  // Global mouse move event listener for left edge hover detection
  useEffect(() => {
    // Don't add hover detection on mobile
    if (isMobile) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      
      // Debounce: only process events every 50ms
      if (now - lastHoverTime < 50) {
        return;
      }
      setLastHoverTime(now);

      const mouseX = event.clientX;
      const sidebarWidth = 240;
      const leftEdgeThreshold = 20;

      // Check if mouse is in left edge hover zone (X < 20px)
      const isInLeftEdge = mouseX < leftEdgeThreshold;
      
      // Check if mouse is over the sidebar area
      const isOverSidebar = mouseX < sidebarWidth;

      // Expand sidebar when mouse enters hover zones
      if (isInLeftEdge && !isExpanded && !manuallyToggled) {
        setIsExpanded(true);
        onHoverChange?.(true);
      }
      
      // Collapse sidebar when mouse leaves hover zones
      // Only collapse if not manually toggled and mouse is far from sidebar
      if (!isInLeftEdge && !isOverSidebar && isExpanded && !manuallyToggled) {
        setIsExpanded(false);
        onHoverChange?.(false);
      }

      // Reset manual toggle state when mouse moves away from sidebar
      // This allows hover behavior to resume after manual toggle
      if (manuallyToggled && !isOverSidebar && mouseX > sidebarWidth + 50) {
        setManuallyToggled(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isMobile, isExpanded, manuallyToggled, lastHoverTime, onHoverChange]);

  // Debug log
  useEffect(() => {
    console.log('[V0Sidebar] Rendered - isExpanded:', isExpanded, 'isMobile:', isMobile, 'activeSection:', activeSection);
  }, [isExpanded, isMobile, activeSection]);

  const navItems: NavItem[] = [
    {
      id: "new-chat",
      label: "New Chat",
      icon: <Plus className="size-5" />,
      onClick: () => {
        window.location.href = '/ask';
      },
    },
    {
      id: "projects",
      label: "Projects",
      icon: <FolderKanban className="size-5" />,
      onClick: () => {
        console.log('[V0Sidebar] Projects button clicked');
        console.log('[V0Sidebar] isMobile:', isMobile, 'isExpanded:', isExpanded);
        // Always show project list when clicking Projects
        handleNavClick("projects");
        setShowProjectList(true);
        setShowChatList(false);
        // Ensure sidebar is expanded to show the list
        setIsExpanded(true);
        setManuallyToggled(true);
        console.log('[V0Sidebar] Set showProjectList to true, isExpanded to true');
      },
    },
    {
      id: "recent-chats",
      label: "Recent Chats",
      icon: <MessageSquare className="size-5" />,
      onClick: () => {
        // Always show chat list when clicking Recent Chats
        handleNavClick("recent-chats");
        setShowChatList(true);
        setShowProjectList(false);
        // Ensure sidebar is expanded to show the list
        setIsExpanded(true);
        setManuallyToggled(true);
      },
    },
  ];

  const handleNavClick = (section: string) => {
    if (!isMobile) {
      // On desktop, keep sidebar expanded when navigating
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
    onNavigate?.(section);
  };



  return (
    <>
      {/* Mobile toggle button - hidden since we use the header S button instead */}
      {/* Keeping code for reference but not rendering */}
      {false && isMobile && showMobileToggle && !isExpanded && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setIsExpanded(true)}
          className="fixed top-[60px] left-4 z-40 size-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg flex items-center justify-center"
        >
          <Zap className="size-6" />
        </motion.button>
      )}

      {/* Backdrop overlay when expanded - only on mobile */}
      <AnimatePresence>
        {isExpanded && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
            style={{ top: '50px' }}
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isExpanded ? (isMobile ? '80vw' : 240) : 0,
          opacity: isExpanded ? 1 : 0,
          display: isExpanded ? 'flex' : 'none',
        }}
        transition={{
          duration: 0.25,
          ease: [0.4, 0, 0.2, 1],
        }}
        onMouseEnter={() => {
          if (!isMobile && !manuallyToggled) {
            setIsExpanded(true);
            onHoverChange?.(true);
          }
        }}
        onMouseLeave={() => {
          if (!isMobile && !manuallyToggled) {
            setIsExpanded(false);
            onHoverChange?.(false);
          }
        }}
        className="fixed h-[calc(100vh-50px)] bg-white dark:bg-[#0E100F] z-40 flex-col"
        style={{
          left: isMobile ? '0' : '4px',
          top: '50px',
          borderRadius: isMobile ? '0' : '12px',
          boxShadow: isExpanded 
            ? '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08)' 
            : 'none',
          border: isMobile ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          maxWidth: isMobile ? '80vw' : '240px',
        }}
      >

        {/* Search Bar - visible when showing chat list or project list */}
        <AnimatePresence>
          {isExpanded && (showChatList || showProjectList) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-2 py-2 border-b border-border dark:border-[#333433]"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={showChatList ? searchQuery : projectSearchQuery}
                  onChange={(e) => showChatList ? setSearchQuery(e.target.value) : setProjectSearchQuery(e.target.value)}
                  placeholder={showChatList ? "Search conversations..." : "Search projects..."}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-lg outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                {(searchQuery || projectSearchQuery) && (
                  <button
                    onClick={() => showChatList ? setSearchQuery('') : setProjectSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                  >
                    <X className="size-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Items, Chat List, or Project List */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <TooltipProvider delayDuration={300}>
            {/* Show project list when expanded and projects is active */}
            {isExpanded && showProjectList ? (
              <div className="space-y-1 w-full">
                {/* Back button */}
                <button
                  onClick={() => {
                    console.log('[V0Sidebar] Back button clicked');
                    setShowProjectList(false);
                    setProjectSearchQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#1D1D1D] rounded-lg transition-all mb-2"
                >
                  <ChevronLeft className="size-4" />
                  <span>Back</span>
                </button>

                {/* Debug info - remove after testing */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border mb-2">
                    <p>Mobile: {isMobile ? 'Yes' : 'No'}</p>
                    <p>Expanded: {isExpanded ? 'Yes' : 'No'}</p>
                    <p>Loading: {isLoadingProjects ? 'Yes' : 'No'}</p>
                    <p>Projects: {userProjects.length}</p>
                    <p>Filtered: {filteredProjects.length}</p>
                  </div>
                )}

                {/* Projects list */}
                <div className="space-y-1 w-full">
                  {isLoadingProjects ? (
                    <div className="px-3 py-8 text-center w-full">
                      <div className="size-8 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">Loading projects...</p>
                    </div>
                  ) : filteredProjects.length > 0 ? (
                    filteredProjects.map((proj) => (
                      <motion.a
                        key={proj.id}
                        href={`/projects/${proj.id}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="block px-3 py-2.5 rounded-lg hover:bg-muted/50 dark:hover:bg-[#1D1D1D] cursor-pointer transition-all group w-full"
                      >
                        <div className="flex items-start gap-2 w-full">
                          <FolderKanban className="size-4 flex-shrink-0 mt-0.5 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium line-clamp-1 break-words">
                              {proj.name}
                            </p>
                            {proj.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words">
                                {proj.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {proj.framework && <span className="capitalize">{proj.framework}</span>}
                              {proj.status && <span className="ml-2">• {proj.status}</span>}
                            </p>
                          </div>
                        </div>
                      </motion.a>
                    ))
                  ) : (
                    <div className="px-3 py-8 text-center w-full">
                      <FolderKanban className="size-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        {projectSearchQuery ? 'No projects found' : 'No projects yet'}
                      </p>
                      {!projectSearchQuery && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Create your first project to get started
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : isExpanded && showChatList ? (
              <div className="space-y-1">
                {/* Back button */}
                <button
                  onClick={() => {
                    setShowChatList(false);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#1D1D1D] rounded-lg transition-all mb-2"
                >
                  <ChevronLeft className="size-4" />
                  <span>Back</span>
                </button>

                {/* Conversations list */}
                <div className="space-y-1">
                  {isLoadingChats ? (
                    <div className="px-3 py-8 text-center">
                      <div className="size-8 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">Loading chats...</p>
                    </div>
                  ) : filteredMessages.length > 0 ? (
                    filteredMessages.map((msg) => (
                      <motion.a
                        key={msg.id}
                        href={msg.project_id ? `/projects/${msg.project_id}` : '#'}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="block px-3 py-2 rounded-lg hover:bg-muted/50 dark:hover:bg-[#1D1D1D] cursor-pointer transition-all group"
                      >
                        <p className="text-sm text-foreground line-clamp-2">
                          {msg.content}
                        </p>
                      </motion.a>
                    ))
                  ) : (
                    <div className="px-3 py-8 text-center">
                      <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No conversations found' : 'No conversations yet'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                const button = (
                  <motion.button
                  key={item.id}
                  onClick={item.onClick}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative overflow-hidden ${
                    isActive
                      ? 'text-foreground bg-muted/70 dark:bg-[#1D1D1D]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#1D1D1D]'
                  }`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  {/* Hover effect background */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={false}
                  />
                {/* Icon */}
                <div className="flex-shrink-0 relative z-10">
                  {item.icon}
                </div>

                {/* Label - only visible when expanded */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm font-medium whitespace-nowrap relative z-10"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Badge - only visible when expanded */}
                {item.badge && isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                  >
                    {item.badge}
                  </motion.span>
                )}

                {/* Chevron indicator */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="size-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
                );
                
                // Wrap with tooltip only when collapsed
                if (!isExpanded) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        {button}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                
                return button;
              })}
            </div>
            )}
          </TooltipProvider>
        </nav>

      </motion.aside>
    </>
  );
}
