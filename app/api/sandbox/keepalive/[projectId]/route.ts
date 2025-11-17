import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Keep Daytona sandbox alive while user is viewing the project
 * Checks if sandbox is still active
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Create Supabase client with user's session
    const supabase = await createRouteHandlerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

    // Check if user is owner OR collaborator
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

    const metadata = project.metadata as any;
    const sandboxId = metadata?.sandboxId;

    if (!sandboxId) {
      return NextResponse.json({ error: 'No sandbox found for this project' }, { status: 404 });
    }

    // Try to connect to existing sandbox to check if it's still alive
    try {
      const sandbox = await getWorkspace(sandboxId);
      // Connection successful - sandbox is alive
      console.log(`✅ Sandbox ${sandboxId} is alive for project ${projectId}`);
      
      return NextResponse.json({ 
        success: true, 
        sandboxId,
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

