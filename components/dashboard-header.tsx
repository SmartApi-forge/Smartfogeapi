"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User, Menu, Plus, Search, BookOpen, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ProjectsSidebar } from "@/components/projects-sidebar"
import { CustomHamburgerButton } from "@/components/custom-hamburger-button"
import { supabase } from "@/lib/supabase"

interface DashboardHeaderProps {
  sidebarOpen?: boolean
  setSidebarOpen?: (open: boolean) => void
  mobileMenuOpen?: boolean
  setMobileMenuOpen?: (open: boolean) => void
}

export function DashboardHeader({ 
  sidebarOpen: externalSidebarOpen, 
  setSidebarOpen: externalSetSidebarOpen,
  mobileMenuOpen: externalMobileMenuOpen,
  setMobileMenuOpen: externalSetMobileMenuOpen
}: DashboardHeaderProps = {}) {
  const router = useRouter()
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false)
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isHovering, setIsHovering] = useState(false)

  // Use external state if provided, otherwise use internal state
  const sidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen
  const setSidebarOpen = externalSetSidebarOpen || setInternalSidebarOpen
  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen
  const setMobileMenuOpen = externalSetMobileMenuOpen || setInternalMobileMenuOpen

  useEffect(() => {
    // Get user data from Supabase
    const getUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
          return
        }
        
        if (session?.user) {
          setUser({
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || ''
          })
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }
    
    getUser()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem("authToken")
      localStorage.removeItem("user")
      router.push("/")
    } catch (error) {
      console.error('Error signing out:', error)
      // Fallback to just clearing localStorage and redirecting
      localStorage.removeItem("authToken")
      localStorage.removeItem("user")
      router.push("/")
    }
  }

  const getUserInitials = (name: string) => {
    if (!name || typeof name !== 'string') {
      return ''
    }
    
    const words = name
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
    
    if (words.length === 0) {
      return ''
    }
    
    return words
      .map(word => word[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleHamburgerHover = () => {
    setIsHovering(true)
    setSidebarOpen(true)
  }

  const handleHamburgerLeave = () => {
    setIsHovering(false)
    // Don't close immediately, let the sidebar handle its own hover state
  }

  // Close sidebar on Escape key
  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [sidebarOpen])

  return (
    <>
      <header className="w-full px-4 md:px-8 py-3">
        <div className="relative flex items-center justify-between">
          {/* Mobile: Hamburger + Brand */}
          <div className="flex items-center gap-3 md:hidden">
            <CustomHamburgerButton onClick={() => setMobileMenuOpen(true)} />
            <span className="text-white font-neue-500 text-base">Smart API Forge</span>
          </div>
          {/* Left side - Hamburger Menu button */}
          <div className="hidden md:block">
            <div 
              onMouseEnter={handleHamburgerHover}
              onMouseLeave={handleHamburgerLeave}
            >
              <CustomHamburgerButton onClick={toggleSidebar} />
            </div>
          </div>
          {/* Center Navigation (Desktop) */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-6">
            <Link href="/docs/getting-started/introduction" className="text-white hover:text-white/80 text-base transition-colors flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Documentation
            </Link>
            <Link href="/support" className="text-white hover:text-white/80 text-base transition-colors flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Support
            </Link>
          </nav>

        {/* Right side - Navigation */}
        <div className="flex items-center gap-4 md:gap-6">

          {/* User Avatar with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-white/10 rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-600 text-white text-sm">
                    {user ? getUserInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700 font-neue-500" align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-white font-neue-500">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-400 font-neue-500">{user?.email || ''}</p>
              </div>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="text-white hover:bg-gray-700 cursor-pointer font-neue-500">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white hover:bg-gray-700 cursor-pointer font-neue-500">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem 
                className="text-white hover:bg-gray-700 cursor-pointer font-neue-500"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    {/* Projects Sidebar */}
    <ProjectsSidebar 
      isOpen={sidebarOpen} 
      onClose={() => setSidebarOpen(false)}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    />

    {/* Mobile Menu Sheet */}
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="bg-gradient-to-b from-[#1A1D21] to-[#0F1114] border-[#2A2D31]/80 p-0 w-80">
        <SheetHeader className="sr-only">
          <SheetTitle>Mobile Navigation</SheetTitle>
          <SheetDescription>Mobile navigation and projects</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2A2D31]/60 bg-gradient-to-r from-[#1E2125] to-[#1A1D21]">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="7" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="12" cy="17" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="7" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="17" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
              </svg>
              <span className="text-gray-50 font-medium drop-shadow-sm" style={{ fontFamily: "'__flecha_df5a44', '__flecha_Fallback_df5a44'" }}>
                My Projects
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Handle new project creation
                setMobileMenuOpen(false);
              }}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border border-transparent hover:border-blue-400/30 transition-all duration-200"
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
                type="text"
                placeholder="Navigate your workspace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2A2D31]/50 border-[#3A3D41] text-white placeholder-gray-400 focus:border-[#3A3D41] focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-[#3A3D41] !ring-0 !outline-none"
                aria-label="Search projects"
              />
            </div>
          </div>

          {/* Projects List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {/* Projects would be loaded here */}
                <div className="space-y-1">
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No projects found
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Navigation Links */}
          <div className="border-t border-[#2A2D31]/60 bg-[#1A1D21]/50">
            <nav className="p-2">
              <Link 
                href="/docs/getting-started/introduction" 
                className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <BookOpen className="w-4 h-4" />
                Documentation
              </Link>
              <Link 
                href="/support" 
                className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <HelpCircle className="w-4 h-4" />
                Support
              </Link>
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}