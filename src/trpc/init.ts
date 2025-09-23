import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from "superjson";
import { supabase } from '../../lib/supabase';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

export type Context = {
  user: User | null;
};

export const createTRPCContext = cache(async (): Promise<Context> => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  try {
    // Get the session from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;

    if (accessToken) {
      // Verify the access token by getting user info
      // Don't use setSession as it consumes the refresh token
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);

      if (error) {
        console.error('Error verifying access token:', error);
        return { user: null };
      }

      return { user };
    }
    return { user: null };
  } catch (error) {
    console.error('Error creating tRPC context:', error);
    return { user: null };
  }
});

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is now guaranteed to be non-null
    },
  });
});