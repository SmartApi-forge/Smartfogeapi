"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { SimpleHeader } from "@/components/simple-header"
import { User, Mail, Calendar, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [createdAt, setCreatedAt] = useState<string>("")

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push("/?auth=login")
        return
      }
      
      setUser(session.user)
      setUserEmail(session.user.email || "")
      setCreatedAt(new Date(session.user.created_at).toLocaleDateString())
      setIsLoading(false)
    }
    
    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SimpleHeader 
        viewMode="preview"
        onViewModeChange={() => {}}
        isSidebarOpen={false}
        onSidebarToggle={() => {}}
      />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 sm:p-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Profile</h1>
            <p className="text-muted-foreground">Manage your account information</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            {/* User Icon */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {userEmail.split('@')[0]}
                </h2>
                <p className="text-sm text-muted-foreground">User Account</p>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </label>
              <div className="px-4 py-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground">{userEmail}</p>
              </div>
            </div>

            {/* User ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                User ID
              </label>
              <div className="px-4 py-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {user?.id}
                </p>
              </div>
            </div>

            {/* Account Created */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Account Created
              </label>
              <div className="px-4 py-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground">{createdAt}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
