/**
 * Get Deployment Status API Route
 * Returns deployment status and logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { vercelPlatformsService } from '@/src/services/vercel-platforms-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    // Authenticate user using custom cookie names
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client and verify token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deploymentId } = await params;

    // Verify user owns this deployment
    const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
      .eq('vercel_deployment_id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Get status from Vercel
    const status = await vercelPlatformsService.getDeploymentStatus(deploymentId);

    // If Vercel returns ERROR status, deployment likely doesn't exist
    if (status.status === 'ERROR') {
      return NextResponse.json(
        { error: 'Deployment not found on Vercel' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}

