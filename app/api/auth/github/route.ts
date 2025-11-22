/**
 * GitHub OAuth Initiation Endpoint
 * Redirects user to GitHub authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGitHubOAuthService } from '@/lib/github-oauth';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Check if user is authenticated by checking the cookie
  const cookieStore = await cookies();
  
  // Get Supabase auth cookies
  const accessToken = cookieStore.get('sb-access-token')?.value;
  const refreshToken = cookieStore.get('sb-refresh-token')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in first.' },
      { status: 401 }
    );
  }

  // Create a Supabase client with the user's session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );

  // Get user session
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in first.' },
      { status: 401 }
    );
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in cookie for verification in callback
  const githubOAuth = getGitHubOAuthService();
  const response = NextResponse.redirect(githubOAuth.getAuthorizationUrl(state));
  
  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Store user ID in cookie for callback
  response.cookies.set('github_oauth_user', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}

