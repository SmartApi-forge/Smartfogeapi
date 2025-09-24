import { baseProcedure, protectedProcedure, createTRPCRouter } from '../../trpc/init'
import { TRPCError } from '@trpc/server'
import { AuthModuleService } from './service'
import { signInSchema, verifyOtpSchema, updateProfileSchema } from './types'

const authModuleService = new AuthModuleService()

export const authRouter = createTRPCRouter({
  // Send magic link for email authentication
  signInWithEmail: baseProcedure
    .input(signInSchema)
    .mutation(async ({ input }) => {
      return await authModuleService.signInWithEmail(input)
    }),

  // Verify OTP token
  verifyOtp: baseProcedure
    .input(verifyOtpSchema)
    .mutation(async ({ input }) => {
      return await authModuleService.verifyOtp(input)
    }),

  // Get current user profile
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User email is required but not available'
        })
      }
      
      return await authModuleService.getProfile(
        ctx.user.id,
        ctx.user.email,
        ctx.user.created_at
      )
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User email is required but not available'
        })
      }
      
      return await authModuleService.updateProfile(
        ctx.user.id,
        ctx.user.email,
        ctx.user.created_at,
        input
      )
    }),

  // Sign out user
  signOut: protectedProcedure
    .mutation(async ({ ctx }) => {
      return await authModuleService.signOut(ctx.user.id)
    }),

  // Get user's API usage statistics
  getUsageStats: protectedProcedure
    .query(async ({ ctx }) => {
      return await authModuleService.getUsageStats(ctx.user.id)
    }),
})

export type AuthRouter = typeof authRouter