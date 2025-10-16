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
import { LogOut, Settings, User, Menu, Plus, Search } from "lucide-react"
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
            <CustomHamburgerButton onClick={toggleSidebar} />
          </div>
          {/* Center Navigation (Desktop) */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-6">
            <Link href="/careers" className="text-white hover:text-white/80 text-base transition-colors">
              Careers
            </Link>
            <Link href="/enterprise" className="text-white hover:text-white/80 text-base transition-colors">
              Enterprise
            </Link>
            <Link href="/pricing" className="text-white hover:text-white/80 text-base transition-colors">
              Pricing
            </Link>
            <Link href="/credits" className="text-white hover:text-white/80 text-base transition-colors">
              Free Credits
            </Link>
          </nav>

        {/* Right side - Navigation */}
        <div className="flex items-center gap-4 md:gap-6">

          {/* Social Icons */}
          <div className="hidden sm:flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </Button>
          </div>

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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0F1114]/80 border-[#2A2D31]/60 focus:bg-[#0F1114] focus:border-blue-400/50 pl-9 text-gray-100 placeholder-gray-400 transition-all duration-200"
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
                href="/careers" 
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Careers
              </Link>
              <Link 
                href="/enterprise" 
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Enterprise
              </Link>
              <Link 
                href="/pricing" 
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/credits" 
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Free Credits
              </Link>
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}