import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Resume paused E2B sandbox
 * Restores both filesystem and running processes from paused state
 * Much faster than full restart (no npm install needed!)
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
      .select('metadata, sandbox_url, framework')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const metadata = project.metadata as any;
    const sandboxId = metadata?.sandboxId;

    if (!sandboxId) {
      return NextResponse.json({ 
        error: 'No sandbox found for this project',
        needsRestart: true 
      }, { status: 404 });
    }

    try {
      console.log(`🔄 Attempting to resume paused sandbox ${sandboxId}...`);

      // Try to connect to paused sandbox
      // E2B automatically resumes paused sandboxes on connect()
      const sandbox = await Sandbox.connect(sandboxId);
      console.log(`✅ Sandbox ${sandboxId} resumed successfully`);

      // Get the new URL (port might have changed)
      const port = metadata?.port || 3000;
      const newUrl = `https://${port}-${sandboxId}.e2b.app`;

      // Update metadata to mark as active again
      await supabase
        .from('projects')
        .update({
          metadata: {
            ...metadata,
            paused: false,
            resumedAt: new Date().toISOString(),
            lastSuccessfulResume: new Date().toISOString(),
          },
          sandbox_url: newUrl,
          sandbox_status: 'active',
          last_sandbox_check: new Date().toISOString(),
        })
        .eq('id', projectId);

      return NextResponse.json({
        success: true,
        message: 'Sandbox resumed successfully',
        sandboxId,
        sandboxUrl: newUrl,
        resumedAt: new Date().toISOString(),
        framework: project.framework,
      });

    } catch (resumeError: any) {
      console.error(`Failed to resume sandbox ${sandboxId}:`, resumeError);

      // Paused sandbox not found = it was killed after pause expired
      if (resumeError.message?.includes('not found')) {
        console.log(`❌ Paused sandbox ${sandboxId} expired, needs full restart`);
        
        await supabase
          .from('projects')
          .update({
            sandbox_status: 'expired',
            last_sandbox_check: new Date().toISOString(),
          })
          .eq('id', projectId);

        return NextResponse.json({
          success: false,
          error: 'Paused sandbox expired',
          needsRestart: true,
          message: 'Sandbox was paused for too long and expired. A full restart is needed.',
        }, { status: 200 });
      }

      throw resumeError;
    }

  } catch (error: any) {
    console.error('Resume error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
      needsRestart: true,
    }, { status: 500 });
  }
}
