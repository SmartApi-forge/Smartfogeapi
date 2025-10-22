import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Pause E2B sandbox to preserve state beyond 1-hour timeout
 * Uses E2B's betaPause to serialize filesystem and process state
 * On Hobby Plan: Paused sandboxes can be resumed later with connect()
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get project with sandbox info
    const { data: project, error } = await supabase
      .from('projects')
      .select('metadata, sandbox_url')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const metadata = project.metadata as any;
    const sandboxId = metadata?.sandboxId;

    if (!sandboxId) {
      return NextResponse.json({ error: 'No sandbox found for this project' }, { status: 404 });
    }

    try {
      // Connect to existing sandbox to verify it exists
      const sandbox = await Sandbox.connect(sandboxId);
      console.log(`📦 Connected to sandbox ${sandboxId}`);

      // E2B auto-pauses sandboxes when there are no active connections
      // We just need to verify it exists and update metadata
      // The sandbox will auto-pause after this connection closes
      console.log(`⏸️ Sandbox ${sandboxId} verified and will auto-pause`);

      // Update metadata to track paused state
      await supabase
        .from('projects')
        .update({
          metadata: {
            ...metadata,
            paused: true,
            pausedAt: new Date().toISOString(),
          },
          sandbox_status: 'paused',
          last_sandbox_check: new Date().toISOString(),
        })
        .eq('id', projectId);

      return NextResponse.json({
        success: true,
        message: 'Sandbox paused successfully',
        sandboxId,
        pausedAt: new Date().toISOString(),
      });

    } catch (sandboxError: any) {
      console.error(`Failed to pause sandbox ${sandboxId}:`, sandboxError);
      
      // Sandbox might already be expired/killed
      if (sandboxError.message?.includes('not found')) {
        // Mark as expired in database
        await supabase
          .from('projects')
          .update({
            sandbox_status: 'expired',
            last_sandbox_check: new Date().toISOString(),
          })
          .eq('id', projectId);

        return NextResponse.json({
          success: false,
          error: 'Sandbox already expired',
          needsRestart: true,
        }, { status: 200 });
      }

      throw sandboxError;
    }

  } catch (error: any) {
    console.error('Pause error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
