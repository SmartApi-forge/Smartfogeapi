'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded wrapper for AuthDialog component.
 * Uses next/dynamic with ssr: false to reduce initial bundle size.
 * 
 * Requirements: 4.1 - Lazy load heavy components (modals, dialogs)
 */
const AuthDialog = dynamic(() => import('@/components/auth-dialog'), {
  ssr: false,
  loading: () => null, // No loading state needed for dialog
});

export function AuthDialogClient() {
  return <AuthDialog />;
}
