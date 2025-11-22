import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Handles Vercel OAuth callback
 * Exchanges authorization code for access token and stores in database
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const searchParams = req.nextUrl.searchParams;
    
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // CSRF token
    const teamId = searchParams.get('teamId'); // null for personal accounts
    const configurationId = searchParams.get('configurationId');
    
    console.log('Vercel Callback - Received params:', {
      hasCode: !!code,
      hasState: !!state,
      hasConfigId: !!configurationId,
      teamId,
    });
    
    if (!code || !state || !configurationId) {
      console.error('Vercel Callback - Missing parameters');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=missing_params`
      );
    }

    // Verify user session exists (we don't verify state === user.id anymore)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('Vercel Callback - Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
    });
    
    if (userError || !user) {
      console.error('Vercel Callback - No user session');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?error=unauthorized&message=${encodeURIComponent('Please sign in first')}`
      );
    }

    // Check if Vercel credentials are configured
    if (!process.env.VERCEL_CLIENT_ID || !process.env.VERCEL_CLIENT_SECRET || !process.env.VERCEL_REDIRECT_URI) {
      console.error('Vercel OAuth not configured');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=vercel_not_configured`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_CLIENT_ID,
        client_secret: process.env.VERCEL_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.VERCEL_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, team_id } = tokenData;

    // Store in database (upsert to handle reconnections)
    const { error: dbError } = await supabase
      .from('vercel_connections')
      .upsert({
        user_id: user.id, // Use the authenticated user's ID
        access_token: access_token,
        team_id: team_id || teamId,
        configuration_id: configurationId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Failed to store Vercel connection:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=db_error`
      );
    }

    // Success! Redirect back to projects with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?vercel_connected=true`
    );
    
  } catch (error) {
    console.error('Vercel OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/projects?error=auth_failed`
    );
  }
}

