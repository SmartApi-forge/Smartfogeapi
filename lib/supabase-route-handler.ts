/**
 * Supabase client for Next.js Route Handlers
 * Uses @supabase/ssr for proper session management with cookies
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase server client for App Router Route Handlers
 * This handles session management and token refresh automatically
 * 
 * IMPORTANT: Always create a new client per-request to avoid sharing
 * sessions across requests and to respect Row Level Security policies.
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Cookie setting can fail in middleware
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Cookie removal can fail in middleware
          }
        },
      },
    }
  );
}
