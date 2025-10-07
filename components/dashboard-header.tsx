"use client"

import { useState, useEffect } from "react"
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
import { LogOut, Settings, User, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function DashboardHeader() {
  const router = useRouter()
  const [user, setUser] = useState({ name: 'Shashank', email: 'shashank@example.com' })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projectsHover, setProjectsHover] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem("user")
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (error) {
        console.error("Error parsing user data:", error)
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
    router.push("/")
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
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-white font-neue-500 text-base">Smart API Forge</span>
          </div>
          {/* Left side - My Projects with hover effect */}
          <div
            className="group relative hidden md:inline-flex items-center gap-1.5 bg-transparent hover:bg-black/80 transition-colors px-2.5 py-1.5 rounded-full border-none"
            onMouseEnter={() => setProjectsHover(true)}
            onMouseLeave={() => setProjectsHover(false)}
            role="button"
            aria-haspopup="true"
            aria-expanded={projectsHover}
          >
            <div className="relative inline-flex items-center gap-1.5">
              {/* Flower icon (no plus) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="7" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="12" cy="17" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="7" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="17" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
              </svg>
              {/* Text wrapper used as anchor for tooltip centering */}
              <span className="inline-block text-white font-medium text-base text-center">
                my projects
                {/* Tooltip anchored to text center */}
                <AnimatePresence>
                  {projectsHover && (
                    <motion.button
                      key="projects-tooltip"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 450, damping: 30, mass: 0.25 }}
                      onClick={toggleSidebar}
                      className="absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 z-50 bg-black rounded-lg px-3 h-8 text-[12px] leading-none font-medium whitespace-nowrap text-white cursor-pointer select-none inline-flex items-center justify-center"
                    >
                      <span className="inline-block">See all projects</span>
                      <span className="pointer-events-none absolute -top-[4px] left-1/2 -translate-x-1/2 block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-l-transparent border-r-transparent border-b-black" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </span>
              {/* Arrow shows only on hover */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
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
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700 font-neue-500" align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-white font-neue-500">{user.name}</p>
                <p className="text-xs text-gray-400 font-neue-500">{user.email}</p>
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
    <AnimatePresence>
      {/* Desktop-only sidebar */}
      {sidebarOpen && (
        <>
          {/* Click-outside overlay to close sidebar */}
          <div
            className="fixed inset-0 z-40 bg-transparent hidden md:block"
            onClick={toggleSidebar}
            aria-hidden="true"
          />
          {/* Sidebar */}
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-72 border-r border-gray-800 z-50 overflow-y-auto hidden md:block"
            style={{ backgroundColor: '#1D1D1D' }}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#F8ACFF" fillOpacity="0.8"/>
                </svg>
                <span className="text-white font-medium">my projects</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar}
                className="text-gray-400 hover:text-white hover:bg-transparent rounded-full h-8 w-8 p-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </div>
            
            <div className="px-4 py-2 border-t border-gray-800/50">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start gap-2 text-white hover:text-white flex items-center py-3"
                style={{ 
                  backgroundColor: 'transparent',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#333333'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span className="text-purple-400 mr-2">◆</span>
                New project
              </Button>
            </div>
            
            <div className="px-4 py-2 mt-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider" style={{ fontFamily: "'__flecha_df5a44', '__flecha_Fallback_df5a44'" }}>Recents</h3>
              <div className="mt-2 space-y-1">
                <p className="text-gray-400 text-sm py-2">No projects found</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Mobile Menu Sheet */}
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="bg-[#1E1E1E]/95 border-gray-800 p-0 w-72">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Mobile navigation</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="7" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="12" cy="17" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="7" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
                <circle cx="17" cy="12" r="4" fill="#F8ACFF" fillOpacity="0.95"/>
              </svg>
              <span className="text-white font-neue-500">my projects</span>
            </div>
          </div>
          <nav className="p-2">
            <Link href="/careers" className="block px-4 py-3 text-white/90 hover:bg-gray-800/60 rounded-md">Careers</Link>
            <Link href="/enterprise" className="block px-4 py-3 text-white/90 hover:bg-gray-800/60 rounded-md">Enterprise</Link>
            <Link href="/pricing" className="block px-4 py-3 text-white/90 hover:bg-gray-800/60 rounded-md">Pricing</Link>
            <Link href="/credits" className="block px-4 py-3 text-white/90 hover:bg-gray-800/60 rounded-md">Free Credits</Link>
          </nav>
          <div className="mt-auto p-4 border-t border-gray-800">
            <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start gap-2 text-white hover:text-white flex items-center py-3"
                  style={{ 
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#333333'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
              <span className="text-purple-400 mr-2">◆</span>
              New project
            </Button>
            <div className="mt-2">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider" style={{ fontFamily: "'__flecha_df5a44', '__flecha_Fallback_df5a44'" }}>Recents</h3>
              <p className="text-gray-400 text-sm py-2">No projects found</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}