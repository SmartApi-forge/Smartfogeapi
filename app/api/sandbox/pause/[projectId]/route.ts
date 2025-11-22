import { NextRequest, NextResponse } from 'next/server';
import { stopWorkspace, getWorkspace } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Pause Daytona sandbox to preserve state
 * Stops the workspace to free resources while preserving filesystem
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Create Supabase client with user's session
    const supabase = await createRouteHandlerClient();

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
      // Verify sandbox exists and stop it
      await getWorkspace(sandboxId);
      await stopWorkspace(sandboxId);
      console.log(`⏸️ Sandbox ${sandboxId} stopped successfully`);

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
