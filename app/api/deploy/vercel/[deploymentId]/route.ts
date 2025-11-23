/**
 * Delete Deployment API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { vercelPlatformsService } from '@/src/services/vercel-platforms-service';

export async function DELETE(
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

    // Delete deployment
    const result = await vercelPlatformsService.deleteDeployment(deploymentId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete deployment' },
      { status: 500 }
    );
  }
}

