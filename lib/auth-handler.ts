import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Updates cookies when session changes
 * This ensures server-side authentication works properly
 */
function updateAuthCookies(session: Session | null) {
  if (session) {
    // Set cookies with proper expiration and security flags
    const accessTokenExpiry = new Date(session.expires_at! * 1000)
    const refreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    
    // Access token with Secure and SameSite=Lax for general API access
    document.cookie = `sb-access-token=${session.access_token}; path=/; expires=${accessTokenExpiry.toUTCString()}; SameSite=Lax; Secure`
    
    // Refresh token with Secure and SameSite=Strict for enhanced CSRF protection
    document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; expires=${refreshTokenExpiry.toUTCString()}; SameSite=Strict; Secure`
  } else {
    // Clear cookies on sign out with security flags
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure'
  }
}

/**
 * Initialize authentication handler
 * Call this once in your app to set up automatic cookie updates
 * Optimized to prevent blocking the main thread
 */
export function initAuthHandler() {
  // Defer cookie updates to avoid blocking initial render
  // Use requestIdleCallback for better INP scores
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          updateAuthCookies(session)
        }
      })
    }, { timeout: 2000 })
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          updateAuthCookies(session)
        }
      })
    }, 0)
  }

  // Listen for auth state changes and update cookies
  supabase.auth.onAuthStateChange((event, session) => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth state changed:', event)
    }
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      updateAuthCookies(session)
    } else if (event === 'SIGNED_OUT') {
      updateAuthCookies(null)
    }
  })
}

/**
 * Manual cookie update function
 * Use this after successful authentication
 */
export function setAuthCookies(session: Session) {
  updateAuthCookies(session)
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies() {
  updateAuthCookies(null)
}