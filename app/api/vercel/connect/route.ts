import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Initiates Vercel OAuth flow
 * Redirects user to Vercel authorization page
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?error=unauthorized`
      );
    }

    // Check if Vercel credentials are configured
    if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_REDIRECT_URI) {
      console.error('Vercel OAuth not configured. Missing VERCEL_CLIENT_ID or VERCEL_REDIRECT_URI');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=vercel_not_configured`
      );
    }

    // Build Vercel OAuth URL
    const authUrl = new URL('https://vercel.com/integrations/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.VERCEL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.VERCEL_REDIRECT_URI);
    authUrl.searchParams.set('state', user.id); // Pass user ID for verification in callback
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Vercel OAuth connect error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=vercel_auth_failed`
    );
  }
}

