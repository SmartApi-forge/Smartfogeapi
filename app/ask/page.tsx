"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardContent } from "@/components/dashboard-content"

export default function Dashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const authToken = localStorage.getItem("authToken")
      if (!authToken) {
        router.push("/?auth=login")
        return
      }
      setIsAuthenticated(true)
    }
    checkAuth()
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
      className="min-h-screen h-screen overflow-hidden bg-cover bg-center bg-no-repeat font-neue-500 flex flex-col"
      style={{
        backgroundImage: "url('/anime-1.jpeg')"
      }}
    >
      <DashboardHeader />
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
