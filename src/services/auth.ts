import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: string | null;
}

interface SignInWithEmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

export const authService = {
  // Sign in with magic link (email OTP)
  async signInWithEmail(email: string): Promise<SignInWithEmailResponse> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return {
          success: false,
          message: "Failed to send magic link",
          error: error.message,
        };
      }

      return {
        success: true,
        message: "Magic link sent! Check your email.",
      };
    } catch (error) {
      return {
        success: false,
        message: "An unexpected error occurred",
      };
    }
  },

  // Get current user session
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      return {
        user,
        session,
        error: error?.message || null,
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // Sign out
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void,
  ) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  // Verify OTP (for magic link confirmation)
  async verifyOtp(email: string, token: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });

      return {
        user: data.user,
        session: data.session,
        error: error?.message || null,
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // Update user profile
  async updateProfile(updates: { name?: string; avatar_url?: string }) {
    try {
      // Map name to full_name for Supabase auth metadata
      const authUpdates: { full_name?: string; avatar_url?: string } = {};
      if (updates.name) authUpdates.full_name = updates.name;
      if (updates.avatar_url) authUpdates.avatar_url = updates.avatar_url;

      const { data, error } = await supabase.auth.updateUser({
        data: authUpdates,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.user;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      return false;
    }
  },
};
