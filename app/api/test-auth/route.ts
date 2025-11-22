import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Test route to check authentication status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    return NextResponse.json({
      authenticated: !!user,
      userId: user?.id,
      email: user?.email,
      error: userError?.message,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  } catch (error: any) {
    return NextResponse.json({
      authenticated: false,
      error: error.message,
    }, { status: 500 });
  }
}

