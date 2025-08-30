import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../../lib/trpc';
import { TRPCError } from '@trpc/server';

// Input schemas
const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, 'Token must be at least 6 characters'),
});

export const authRouter = createTRPCRouter({
  // Send magic link
  signIn: publicProcedure
    .input(signInSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase } = ctx;

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: input.email,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
          },
        });

        if (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        return { success: true, message: 'Magic link sent to your email' };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send magic link',
          cause: error,
        });
      }
    }),

  // Verify OTP token
  verifyOtp: publicProcedure
    .input(verifyOtpSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase } = ctx;

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: input.email,
          token: input.token,
          type: 'email',
        });

        if (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        return {
          success: true,
          user: data.user,
          session: data.session,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify OTP',
          cause: error,
        });
      }
    }),

  // Get current user
  getUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // Sign out
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabase } = ctx;

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to sign out',
        cause: error,
      });
    }
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        full_name: z.string().optional(),
        avatar_url: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, supabase } = ctx;

      try {
        const { data, error } = await supabase.auth.updateUser({
          data: input,
        });

        if (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        return data.user;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
          cause: error,
        });
      }
    }),
});
