import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Updates cookies when session changes
 * This ensures server-side authentication works properly
 */
function updateAuthCookies(session: Session | null) {
  if (session) {
    // Set cookies with proper expiration
    const accessTokenExpiry = new Date(session.expires_at! * 1000)
    const refreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    
    document.cookie = `sb-access-token=${session.access_token}; path=/; expires=${accessTokenExpiry.toUTCString()}; SameSite=Lax`
    document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; expires=${refreshTokenExpiry.toUTCString()}; SameSite=Lax`
  } else {
    // Clear cookies on sign out
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  }
}

/**
 * Initialize authentication handler
 * Call this once in your app to set up automatic cookie updates
 */
export function initAuthHandler() {
  // Update cookies on initial load if session exists
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      updateAuthCookies(session)
    }
  })

  // Listen for auth state changes and update cookies
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event)
    
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