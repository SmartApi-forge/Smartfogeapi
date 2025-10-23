/**
 * GitHub OAuth Callback Endpoint
 * Handles the redirect from GitHub after user authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubOAuth } from '@/lib/github-oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Check for OAuth errors - sanitize to prevent leaking sensitive OAuth configuration
  if (error) {
    // Map OAuth errors to generic user-friendly messages
    const errorDescription = 'GitHub authorization failed. Please try again.';
    console.error('GitHub OAuth error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(
      new URL(`/ask?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/ask?error=Invalid OAuth callback parameters', request.url)
    );
  }

  // Verify state parameter for CSRF protection
  const storedState = request.cookies.get('github_oauth_state')?.value;
  const userId = request.cookies.get('github_oauth_user')?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/ask?error=Invalid state parameter', request.url)
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL('/ask?error=User session expired', request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await githubOAuth.exchangeCodeForToken(code);

    // Get GitHub user information
    const githubUser = await githubOAuth.getGitHubUser(tokenResponse.access_token);

    // Store integration in database
    await githubOAuth.storeIntegration(
      userId,
      tokenResponse.access_token,
      githubUser,
      tokenResponse.scope.split(' ')
    );

    // Redirect back to /ask with success
    const response = NextResponse.redirect(
      new URL('/ask?github_connected=true', request.url)
    );

    // Clear OAuth cookies
    response.cookies.delete('github_oauth_state');
    response.cookies.delete('github_oauth_user');

    return response;
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    // Sanitize error message to prevent leaking sensitive details
    const sanitizedError = 'Failed to connect GitHub account. Please try again.';
    return NextResponse.redirect(
      new URL(`/ask?error=${encodeURIComponent(sanitizedError)}`, request.url)
    );
  }
}

