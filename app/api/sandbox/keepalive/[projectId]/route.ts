import { NextRequest, NextResponse } from 'next/server';
import { ensureSandboxRunning, startPreviewServer, isPreviewServerRunning, getPreviewUrlAsync } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Keep Daytona sandbox alive while user is viewing the project
 * Checks if sandbox is still active and RUNNING
 * If sandbox is stopped, automatically starts it
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Create Supabase client with user's session
    const supabase = await createRouteHandlerClient();

    // Get current user (optional - allow unauthenticated for public projects)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // If no user, silently succeed (don't block keepalive for public projects)
    if (userError || !user) {
      console.log('KeepAlive: No authenticated user, skipping auth check');
      // Continue without auth check - project access will be verified below
    }

    // Get project with sandbox info from metadata
    const { data: project, error } = await supabase
      .from('projects')
      .select('metadata, sandbox_url, user_id')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is owner OR collaborator (only if user is authenticated)
    if (user) {
      const isOwner = project.user_id === user.id;
      
      if (!isOwner) {
        // Check if user is a collaborator
        const { data: collaborator, error: collabError } = await supabase
          .from('project_collaborators')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (collabError || !collaborator) {
          return NextResponse.json(
            { error: 'You do not have access to this project' },
            { status: 403 }
          );
        }
      }
    }

    const metadata = project.metadata as any;
    const sandboxId = metadata?.sandboxId;

    if (!sandboxId) {
      return NextResponse.json({ error: 'No sandbox found for this project' }, { status: 404 });
    }

    // Try to connect to existing sandbox and ensure it's running
    try {
      // This will start the sandbox if it's stopped
      const sandbox = await ensureSandboxRunning(sandboxId);
      
      // Check if preview server is running, start it if not
      const isServerRunning = await isPreviewServerRunning(sandbox);
      
      if (!isServerRunning) {
        console.log(`🚀 Preview server not running, starting it for sandbox ${sandboxId}...`);
        const previewResult = await startPreviewServer(sandbox);
        
        if (previewResult.success) {
          console.log(`✅ Preview server started: ${previewResult.previewUrl}`);
          
          // Update project with new sandbox URL if it changed
          if (previewResult.previewUrl && previewResult.previewUrl !== project.sandbox_url) {
            await supabase
              .from('projects')
              .update({
                sandbox_url: previewResult.previewUrl,
                sandbox_status: 'active',
                last_sandbox_check: new Date().toISOString(),
              })
              .eq('id', projectId);
          }
          
          return NextResponse.json({ 
            success: true, 
            sandboxId,
            sandboxUrl: previewResult.previewUrl,
            message: 'Sandbox started and preview server running',
            wasRestarted: true
          });
        } else {
          console.error(`❌ Failed to start preview server: ${previewResult.error}`);
          // Sandbox is running but preview server failed - might need full restart
          return NextResponse.json({ 
            success: false,
            error: `Preview server failed to start: ${previewResult.error}`,
            needsRestart: true
          }, { status: 200 });
        }
      }
      
      // Sandbox and preview server are both running
      console.log(`✅ Sandbox ${sandboxId} is alive and preview server running for project ${projectId}`);
      
      return NextResponse.json({ 
        success: true, 
        sandboxId,
        sandboxUrl: project.sandbox_url,
        message: 'Sandbox is alive'
      });
    } catch (sandboxError: any) {
      console.error(`Failed to connect to sandbox ${sandboxId}:`, sandboxError);
      return NextResponse.json({ 
        success: false,
        error: 'Sandbox may have timed out',
        needsRestart: true
      }, { status: 200 });
    }
  } catch (error: any) {
    console.error('KeepAlive error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

