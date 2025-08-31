import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createClient } from '@supabase/supabase-js';
import superjson from 'superjson';

import { type AppRouter } from '../src/trpc/routers/_app';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

// Create Supabase client for auth token
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const api = createTRPCReact<AppRouter>();

export const trpcClient = api.createClient({
  transformer: superjson,
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      async headers() {
        const headers: Record<string, string> = {};
        
        // Get the current session and add auth header
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          headers.authorization = `Bearer ${session.access_token}`;
        }
        
        return headers;
      },
    }),
  ],
});
