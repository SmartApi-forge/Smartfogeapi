'use client'

import { useEffect } from 'react'
import { initAuthHandler } from '@/lib/auth-handler'

/**
 * Component that initializes authentication handling
 * This ensures cookies are updated when tokens refresh
 */
export function AuthInitializer() {
  useEffect(() => {
    initAuthHandler()
  }, [])

  return null
}