/**
 * GitHub OAuth Integration
 * Handles OAuth flow for GitHub authentication
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Validate required Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  private encryptionKey: Buffer;

  constructor() {
    // Validate required GitHub OAuth credentials
    const clientId = process.env.GITHUB_ID;
    if (!clientId) {
      throw new Error('Missing GITHUB_ID environment variable - required for GitHub OAuth');
    }

    const clientSecret = process.env.GITHUB_SECRET;
    if (!clientSecret) {
      throw new Error('Missing GITHUB_SECRET environment variable - required for GitHub OAuth');
    }

    this.config = {
      clientId,
      clientSecret,
      redirectUri: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
      scopes: ['repo', 'user:email', 'write:repo_hook'],
    };

    // Validate and load encryption key
    const encryptionKeyHex = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKeyHex) {
      throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required for secure token storage');
    }
    
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex characters) AES-256 key');
    }
  }

  /**
   * Encrypt a token using AES-256-GCM
   */
  private encryptToken(token: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let ciphertext = cipher.update(token, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:ciphertext (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  /**
   * Decrypt a token using AES-256-GCM
   * Falls back to plaintext for legacy tokens (migration support)
   */
  private decryptToken(cipherString: string): string {
    const parts = cipherString.split(':');
    
    // If not in encrypted format (iv:authTag:ciphertext), treat as plaintext legacy token
    if (parts.length !== 3) {
      console.warn('Legacy plaintext token detected - consider re-authenticating for encrypted storage');
      return cipherString; // Return as-is (plaintext)
    }

    try {
      const [ivHex, authTagHex, ciphertext] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      
      return plaintext;
    } catch (error) {
      // If decryption fails, might be a corrupted token or wrong key
      console.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token - token may be corrupted or encryption key changed');
    }
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

      if (!emailResponse.ok) {
        throw new Error('Failed to fetch GitHub user emails');
      }

      const emails = await emailResponse.json();
      
      // Validate that we have at least one email
      if (!Array.isArray(emails) || emails.length === 0) {
        throw new Error('No email available for GitHub user');
      }

      // Select primary email if available, otherwise use first email
      const primaryEmail = emails.find((e: any) => e.primary);
      user.email = primaryEmail?.email || emails[0]?.email;
      
      // Final validation
      if (!user.email) {
        throw new Error('No email available for GitHub user');
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
    // Encrypt the access token before storing
    const encryptedToken = this.encryptToken(accessToken);
    
    const { data, error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'github',
        access_token: encryptedToken,
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

    // Decrypt the access token if integration exists
    if (data && data.access_token) {
      data.access_token = this.decryptToken(data.access_token);
    }

    return data;
  }

  /**
   * Revoke GitHub integration
   */
  async revokeIntegration(userId: string): Promise<void> {
    // Get the integration first to access the token
    const integration = await this.getUserIntegration(userId);
    
    if (integration?.access_token) {
      // Revoke token with GitHub
      try {
        await fetch(`https://api.github.com/applications/${this.config.clientId}/token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ access_token: integration.access_token }),
        });
      } catch (error) {
        // Log but don't fail - still deactivate locally
        console.error('Failed to revoke token with GitHub:', error);
      }
    }

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

// Lazy-load singleton to avoid build-time environment variable checks
let githubOAuthInstance: GitHubOAuthService | null = null;

export function getGitHubOAuthService(): GitHubOAuthService {
  if (!githubOAuthInstance) {
    githubOAuthInstance = new GitHubOAuthService();
  }
  return githubOAuthInstance;
}

// Export for backward compatibility (but will throw at build time if used)
// Use getGitHubOAuthService() instead
export const githubOAuth = getGitHubOAuthService;

