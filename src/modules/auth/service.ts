import { authService } from '../../services/auth'
import { profileService } from '../../services/database'
import { TRPCError } from '@trpc/server'
import type { 
  SignInInput, 
  VerifyOtpInput, 
  UpdateProfileInput, 
  AuthResponse, 
  UserProfile, 
  UsageStats,
  AuthUpdates 
} from './types'

export class AuthModuleService {
  /**
   * Send magic link for email authentication
   */
  async signInWithEmail(input: SignInInput): Promise<AuthResponse> {
    try {
      const result = await authService.signInWithEmail(input.email)
      return {
        success: true,
        message: 'Magic link sent successfully'
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send magic link',
        cause: error
      })
    }
  }

  /**
   * Verify OTP token and create/update user profile
   */
  async verifyOtp(input: VerifyOtpInput): Promise<AuthResponse> {
    try {
      const { user, session, error } = await authService.verifyOtp(input.email, input.token)
      
      if (error || !user || !session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error || 'Invalid OTP'
        })
      }

      // Create or update user profile
      const existingProfile = await profileService.getProfile(user.id)
      if (!existingProfile) {
        await profileService.createProfile({
          id: user.id,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null
        })
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: new Date(user.created_at),
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at || 0,
        },
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify OTP',
        cause: error
      })
    }
  }

  /**
   * Get current user profile with subscription and quota info
   */
  async getProfile(userId: string, userEmail: string, userCreatedAt: string): Promise<UserProfile> {
    try {
      const profile = await profileService.getProfile(userId)
      
      return {
        id: userId,
        email: userEmail,
        name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        created_at: new Date(userCreatedAt),
        subscription_tier: 'free', // TODO: Add subscription logic
        api_quota: {
          used: 12, // TODO: Calculate from projects/jobs
          limit: 50,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch profile',
        cause: error
      })
    }
  }

  /**
   * Update user profile information
   */
  async updateProfile(userId: string, userEmail: string, userCreatedAt: string, input: UpdateProfileInput): Promise<AuthResponse> {
    try {
      // Update Supabase auth metadata
      const authUpdates: AuthUpdates = {}
      if (input.name) authUpdates.name = input.name
      if (input.avatar_url) authUpdates.avatar_url = input.avatar_url
      
      if (Object.keys(authUpdates).length > 0) {
        await authService.updateProfile(authUpdates)
      }

      // Update profile table
      const profileUpdates: AuthUpdates = {}
      if (input.name) profileUpdates.name = input.name
      if (input.avatar_url) profileUpdates.avatar_url = input.avatar_url

      if (Object.keys(profileUpdates).length > 0) {
        await profileService.updateProfile(userId, profileUpdates)
      }

      return {
        success: true,
        user: {
          id: userId,
          email: userEmail,
          name: input.name || null,
          avatar_url: input.avatar_url || null,
          created_at: new Date(userCreatedAt),
        },
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update profile',
        cause: error
      })
    }
  }

  /**
   * Sign out user
   */
  async signOut(userId?: string): Promise<AuthResponse> {
    try {
      const result = await authService.signOut()
      return {
        success: result.success,
        message: result.success ? 'Signed out successfully' : 'Failed to sign out',
        error: result.error
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to sign out',
        cause: error
      })
    }
  }

  /**
   * Get user's API usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      // TODO: Implement proper analytics from database using userId
      // For now, return mock data that matches PRD requirements
      // In the future, query database for user-specific stats:
      // - Count projects by user_id
      // - Calculate deployment success rates
      // - Track API generation times
      // - Monitor monthly usage limits
      
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
            id: 'activity_1',
            type: 'api_generated',
            description: 'Generated E-commerce API',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            id: 'activity_2',
            type: 'api_deployed',
            description: 'Deployed Blog API to Vercel',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
        ],
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch usage statistics',
        cause: error
      })
    }
  }
}