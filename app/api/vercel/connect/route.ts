import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';
import { randomBytes } from 'crypto';

/**
 * Initiates Vercel OAuth flow
 * Returns OAuth URL for client-side redirect
 */
export async function GET(req: NextRequest) {
  try {
    // Check if Vercel credentials are configured
    if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_REDIRECT_URI) {
      console.error('Vercel OAuth not configured');
      return NextResponse.json({
        error: 'Vercel integration not configured',
        details: 'VERCEL_CLIENT_ID or VERCEL_REDIRECT_URI missing'
      }, { status: 500 });
    }

    // Try to get user (but don't fail if session is missing)
    // We'll verify the user in the callback instead
    const supabase = await createRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Generate a random state for CSRF protection
    // We'll verify this matches in the callback
    const state = randomBytes(32).toString('hex');
    
    // Store the state temporarily (in production, use Redis or database)
    // For now, we'll just verify the user session exists on callback
    console.log('Vercel Connect - Generating OAuth URL:', {
      hasUser: !!user,
      userId: user?.id,
      state: state.substring(0, 10) + '...',
    });

    // Build Vercel OAuth URL
    const authUrl = new URL('https://vercel.com/integrations/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.VERCEL_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.VERCEL_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    
    // Return the URL for client-side redirect
    return NextResponse.json({
      authUrl: authUrl.toString(),
      success: true
    });
  } catch (error: any) {
    console.error('Vercel OAuth connect error:', error);
    return NextResponse.json({
      error: 'Failed to generate OAuth URL',
      details: error.message
    }, { status: 500 });
  }
}

