import { supabase } from '../../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

export interface AuthResponse {
  user: User | null
  session: Session | null
  error: string | null
}

export interface SignInWithEmailResponse {
  success: boolean
  message: string
  error?: string
}

export const authService = {
  // Sign in with magic link (email OTP)
  async signInWithEmail(email: string): Promise<SignInWithEmailResponse> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        return {
          success: false,
          message: 'Failed to send magic link',
          error: error.message
        }
      }

      return {
        success: true,
        message: 'Magic link sent! Check your email to continue.'
      }
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  // Get current user session
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()

      return {
        user,
        session,
        error: error?.message || null
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Failed to get user'
      }
    }
  },

  // Sign out
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign out'
      }
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  },

  // Verify OTP (for magic link confirmation)
  async verifyOtp(email: string, token: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })

      return {
        user: data.user,
        session: data.session,
        error: error?.message || null
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Failed to verify OTP'
      }
    }
  },

  // Update user profile
  async updateProfile(updates: { full_name?: string; avatar_url?: string }) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      })

      if (error) {
        throw new Error(error.message)
      }

      return data.user
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update profile')
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return !!session
    } catch {
      return false
    }
  }
}

// Auth hooks for React components
export const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    authService.getCurrentUser().then(({ user }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
