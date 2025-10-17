/**
 * GitHub OAuth Integration
 * Handles OAuth flow for GitHub authentication
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
}

export class GitHubOAuthService {
  private config: GitHubOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      redirectUri: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
      scopes: ['repo', 'user:email', 'write:repo_hook'],
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      allow_signup: 'true',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return data;
  }

  /**
   * Get GitHub user information
   */
  async getGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
    }

    const user = await response.json();

    // Fetch email if not public
    if (!user.email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary);
        user.email = primaryEmail?.email || emails[0]?.email;
      }
    }

    return user;
  }

  /**
   * Store GitHub integration in database
   */
  async storeIntegration(
    userId: string,
    accessToken: string,
    githubUser: GitHubUser,
    scopes: string[]
  ): Promise<any> {
    const { data, error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'github',
        access_token: accessToken, // In production, encrypt this
        provider_user_id: githubUser.id.toString(),
        provider_username: githubUser.login,
        provider_email: githubUser.email,
        scopes,
        is_active: true,
        metadata: {
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
        },
      }, {
        onConflict: 'user_id,provider,provider_user_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store GitHub integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's GitHub integration
   */
  async getUserIntegration(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'github')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to fetch GitHub integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Revoke GitHub integration
   */
  async revokeIntegration(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_integrations')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', 'github');

    if (error) {
      throw new Error(`Failed to revoke GitHub integration: ${error.message}`);
    }
  }

  /**
   * Validate token by making a test API call
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const githubOAuth = new GitHubOAuthService();

