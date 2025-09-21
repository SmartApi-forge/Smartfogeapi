import { initTRPC, TRPCError } from '@trpc/server';
import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { createClient } from '@supabase/supabase-js';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { User } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Context = {
  user: User | null;
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 */
export const createTRPCContext = async (opts: FetchCreateContextFnOptions): Promise<Context> => {
  const { req } = opts;

  try {
    // Get cookies from the request headers
    const cookieHeader = req.headers.get('cookie');
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    if (cookieHeader) {
      // Parse cookies manually since we're in a fetch context
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {} as Record<string, string>);

      accessToken = cookies['sb-access-token'];
      refreshToken = cookies['sb-refresh-token'];
    }

    if (accessToken && refreshToken) {
      // Set the session in Supabase
      const { data: { user }, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('Error setting Supabase session:', error);
        return { user: null };
      }

      return { user };
    }
    return { user: null };
  } catch (error) {
    console.error('Error creating tRPC context:', error);
    return { user: null };
  }
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE HELPERS
 *
 * These are helper functions to create tRPC routers and procedures
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      // infers the `user` as non-nullable
      user: ctx.user,
    },
  });
});
