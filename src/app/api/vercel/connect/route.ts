import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // Get user from session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sb-access-token');
    
    if (!sessionCookie) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=unauthorized`);
    }

    // Verify session and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(sessionCookie.value);
    
    if (userError || !user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=unauthorized`);
    }

    // Build Vercel OAuth URL
    const authUrl = new URL('https://vercel.com/integrations/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.VERCEL_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', process.env.VERCEL_REDIRECT_URI!);
    authUrl.searchParams.set('state', user.id); // Pass user ID for verification
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Vercel connect error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=connection_failed`);
  }
}
