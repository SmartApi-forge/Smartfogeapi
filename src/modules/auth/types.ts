import { z } from "zod";

// Auth input schemas
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, "OTP must be 6 characters"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  avatar_url: z.string().url().optional(),
});

// Auth types
export type SignInInput = z.infer<typeof signInSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  session?: Session;
  message?: string;
  error?: string;
}

export interface AuthUpdates {
  name?: string;
  avatar_url?: string;
}

export interface UserProfile extends User {
  subscription_tier: string;
  api_quota: {
    used: number;
    limit: number;
    reset_date: Date;
  };
}

export interface UsageStats {
  apis_generated: number;
  apis_deployed: number;
  avg_generation_time: number;
  total_requests: number;
  success_rate: number;
  monthly_usage: {
    current_month: number;
    limit: number;
    percentage: number;
  };
  recent_activity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }>;
}
