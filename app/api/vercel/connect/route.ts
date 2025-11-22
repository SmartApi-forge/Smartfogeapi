import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Initiates Vercel OAuth flow
 * Redirects user to Vercel authorization page
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  
  try {
    // Check Supabase environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase not configured. Missing environment variables.');
      return NextResponse.redirect(
        new URL(`/projects?error=config_error&message=${encodeURIComponent('Supabase environment variables not set in Vercel')}`, origin)
      );
    }

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
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      origin: origin,
    });
    
    if (userError || !user) {
      console.error('Vercel Connect - Auth failed:', userError);
      // Return JSON response for debugging instead of redirect
      return NextResponse.json({
        error: 'Authentication failed',
        details: {
          message: userError?.message || 'No user session found',
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          suggestion: 'Make sure you are logged in and Supabase environment variables are set in Vercel',
        }
      }, { status: 401 });
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

