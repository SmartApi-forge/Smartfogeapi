import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Initiates Vercel OAuth flow
 * Redirects user to Vercel authorization page
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  
  try {
    const supabase = await createRouteHandlerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Debug logging
    console.log('Vercel Connect - Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      hasClientId: !!process.env.VERCEL_CLIENT_ID,
      hasRedirectUri: !!process.env.VERCEL_REDIRECT_URI,
      origin: origin,
    });
    
    if (userError || !user) {
      console.error('Vercel Connect - Auth failed:', userError);
      // Return to projects with error message
      return NextResponse.redirect(
        new URL(`/projects?error=auth_required&message=${encodeURIComponent('Please sign in to connect Vercel')}`, origin)
      );
    }

    // Check if Vercel credentials are configured
    if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_REDIRECT_URI) {
      console.error('Vercel OAuth not configured. Missing VERCEL_CLIENT_ID or VERCEL_REDIRECT_URI');
      return NextResponse.redirect(
        new URL('/projects?error=vercel_not_configured&message=' + encodeURIComponent('Vercel integration is not configured'), origin)
      );
    }

    console.log('Vercel Connect - Redirecting to Vercel OAuth with:', {
      clientId: process.env.VERCEL_CLIENT_ID.substring(0, 10) + '...',
      redirectUri: process.env.VERCEL_REDIRECT_URI,
      userId: user.id,
    });

    // Build Vercel OAuth URL
    const authUrl = new URL('https://vercel.com/integrations/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.VERCEL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.VERCEL_REDIRECT_URI);
    authUrl.searchParams.set('state', user.id); // Pass user ID for verification in callback
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Vercel OAuth connect error:', error);
    return NextResponse.redirect(
      new URL(`/projects?error=vercel_auth_failed&message=${encodeURIComponent(error.message || 'Failed to connect')}`, origin)
    );
  }
}

