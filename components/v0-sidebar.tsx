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
  role: 'user' | 'assistant';
  created_at: string;
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
  const [manuallyToggled, setManuallyToggled] = useState(false);
  const [lastHoverTime, setLastHoverTime] = useState(0);

  // Filter messages based on search query
  const filteredMessages = messages.filter(msg => 
    msg.role === 'user' && 
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      console.log('[V0Sidebar] Mobile detected:', mobile, 'Width:', window.innerWidth);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      id: "recent-chats",
      label: "Recent Chats",
      icon: <MessageSquare className="size-5" />,
      onClick: () => {
        if (activeSection === "recent-chats" && isExpanded) {
          // Toggle chat list if already showing
          setShowChatList(!showChatList);
          setShowProjectList(false);
        } else {
          handleNavClick("recent-chats");
          setShowChatList(true);
          setShowProjectList(false);
        }
      },
    },
    {
      id: "projects",
      label: "Projects",
      icon: <FolderKanban className="size-5" />,
      onClick: () => {
        if (activeSection === "projects" && isExpanded) {
          // Toggle project list if already showing
          setShowProjectList(!showProjectList);
          setShowChatList(false);
        } else {
          handleNavClick("projects");
          setShowProjectList(true);
          setShowChatList(false);
        }
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
      {/* Mobile toggle button - floating */}
      {isMobile && showMobileToggle && !isExpanded && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setIsExpanded(true)}
          className="fixed top-4 left-4 z-40 size-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg flex items-center justify-center"
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
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isExpanded ? 240 : 0,
          opacity: isExpanded ? 1 : 0,
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
        className={`fixed h-[calc(100vh-58px)] bg-white dark:bg-[#0E100F] z-40 flex flex-col ${
          isMobile && !isExpanded ? 'hidden' : ''
        }`}
        style={{
          left: '4px',
          top: '54px',
          borderRadius: '12px',
          boxShadow: isExpanded 
            ? '0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08)' 
            : 'none',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >

        {/* Search Bar - only visible when expanded and showing chat list */}
        <AnimatePresence>
          {isExpanded && showChatList && (
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-lg outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                  >
                    <X className="size-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Items or Chat List */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <TooltipProvider delayDuration={300}>
            {/* Show chat list when expanded and chat is active */}
            {isExpanded && showChatList && activeSection === 'chat' ? (
              <div className="space-y-1">
                {/* Back button */}
                <button
                  onClick={() => setShowChatList(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#1D1D1D] rounded-lg transition-all mb-2"
                >
                  <ChevronLeft className="size-4" />
                  <span>Back</span>
                </button>

                {/* Conversations list */}
                <div className="space-y-1">
                  {filteredMessages.length > 0 ? (
                    filteredMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="px-3 py-2 rounded-lg hover:bg-muted/50 dark:hover:bg-[#1D1D1D] cursor-pointer transition-all group"
                      >
                        <p className="text-sm text-foreground line-clamp-2 mb-1">
                          {msg.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </p>
                      </motion.div>
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
