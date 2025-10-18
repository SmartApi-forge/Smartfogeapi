import { z } from "zod";
import { baseProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { authService } from "../../services/auth";
import { profileService } from "../../services/database";
import { TRPCError } from "@trpc/server";

// Auth input schemas
const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, "OTP must be 6 characters"),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  avatar_url: z.string().url().optional(),
});

export const authRouter = createTRPCRouter({
  // Send magic link for email authentication
  signInWithEmail: baseProcedure
    .input(signInSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await authService.signInWithEmail(input.email);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send magic link",
          cause: error,
        });
      }
    }),

  // Verify OTP token
  verifyOtp: baseProcedure
    .input(verifyOtpSchema)
    .mutation(async ({ input }) => {
      try {
        const { user, session, error } = await authService.verifyOtp(
          input.email,
          input.token,
        );

        if (error || !user || !session) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: error || "Invalid OTP",
          });
        }

        // Create or update user profile
        const existingProfile = await profileService.getProfile(user.id);
        if (!existingProfile) {
          await profileService.createProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          });
        }

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            created_at: new Date(user.created_at),
          },
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify OTP",
          cause: error,
        });
      }
    }),

  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    try {
      const profile = await profileService.getProfile(ctx.user.id);

      return {
        id: ctx.user.id,
        email: ctx.user.email!,
        name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        created_at: new Date(ctx.user.created_at),
        subscription_tier: "free", // TODO: Add subscription logic
        api_quota: {
          used: 12, // TODO: Calculate from projects/jobs
          limit: 50,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch profile",
        cause: error,
      });
    }
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Update Supabase auth metadata
        const authUpdates: any = {};
        if (input.name) authUpdates.full_name = input.name;
        if (input.avatar_url) authUpdates.avatar_url = input.avatar_url;

        if (Object.keys(authUpdates).length > 0) {
          await authService.updateProfile(authUpdates);
        }

        // Update profile table
        const profileUpdates: any = {};
        if (input.name) profileUpdates.full_name = input.name;
        if (input.avatar_url) profileUpdates.avatar_url = input.avatar_url;

        if (Object.keys(profileUpdates).length > 0) {
          await profileService.updateProfile(ctx.user.id, profileUpdates);
        }

        return {
          success: true,
          user: {
            id: ctx.user.id,
            email: ctx.user.email!,
            name: input.name || null,
            avatar_url: input.avatar_url || null,
            created_at: new Date(ctx.user.created_at),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update profile",
          cause: error,
        });
      }
    }),

  // Sign out user
  signOut: protectedProcedure.mutation(async () => {
    try {
      const result = await authService.signOut();
      return {
        success: result.success,
        message: result.success
          ? "Signed out successfully"
          : "Failed to sign out",
        error: result.error,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to sign out",
        cause: error,
      });
    }
  }),

  // Get user's API usage statistics
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      // TODO: Implement proper analytics from database
      // For now, return mock data that matches PRD requirements

      return {
        apis_generated: 12,
        apis_deployed: 8,
        avg_generation_time: 38, // < 40s target from PRD
        total_requests: 1247,
        success_rate: 0.95, // > 95% target from PRD
        monthly_usage: {
          current_month: 12,
          limit: 50,
          percentage: 24,
        },
        recent_activity: [
          {
            id: "activity_1",
            type: "api_generated",
            description: "Generated E-commerce API",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            id: "activity_2",
            type: "api_deployed",
            description: "Deployed Blog API to Vercel",
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
        ],
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch usage statistics",
        cause: error,
      });
    }
  }),
});

export type AuthRouter = typeof authRouter;
