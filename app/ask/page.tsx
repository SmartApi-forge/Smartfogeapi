"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardContent } from "@/components/dashboard-content"
import { supabase } from "@/lib/supabase"

export default function Dashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Clear any old localStorage auth data
    localStorage.removeItem('authToken')
    
    // Check Supabase authentication status
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          router.push("/?auth=login")
          return
        }
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push("/?auth=login")
      }
    }
    checkAuth()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push("/?auth=login")
      } else if (event === 'SIGNED_IN' && session) {
        setIsAuthenticated(true)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [router])

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/anime-1.jpeg')"
        }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen h-screen overflow-hidden bg-cover bg-center bg-no-repeat font-neue-500 flex flex-col transition-all duration-300 ease-in-out"
      style={{
        backgroundImage: "url('/anime-1.jpeg')",
        marginLeft: sidebarOpen ? '320px' : '0px'
      }}
    >
      <DashboardHeader 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="flex-1 min-h-0">
        <DashboardContent />
      </div>
      {/* Centered footer inside the viewport */}
      <footer className="w-full py-6">
        <div className="w-full flex items-center justify-center">
          <a
            href="/terms"
            className="text-sm text-white/80 hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            Terms & Conditions
          </a>
        </div>
      </footer>
    </div>
  )
}
