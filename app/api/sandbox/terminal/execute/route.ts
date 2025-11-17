import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sandboxId, command, workingDirectory, projectId } = await request.json();

    if (!sandboxId || !command || !projectId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = await createRouteHandlerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, metadata')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
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

    // Verify sandbox ID matches project metadata
    if (project.metadata?.sandboxId !== sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID mismatch' },
        { status: 403 }
      );
    }

    // Get sandbox instance using the helper
    const sandbox = await getWorkspace(sandboxId);

    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Execute command using Daytona process execution
    // Note: Daytona SDK doesn't have direct PTY support yet, so we use executeCommand
    const result = await sandbox.process.executeCommand(
      command,
      workingDirectory || 'workspace/project',
      undefined, // env vars
      300 // 5 minute timeout
    );

    return NextResponse.json({
      success: true,
      stdout: result.result || '',
      stderr: result.error || '',
      exitCode: result.exitCode || 0,
      sessionId,
    });
  } catch (error: any) {
    console.error('Command execution error:', error);
    
    // Handle specific errors
    if (error.message?.includes('Sandbox not found')) {
      return NextResponse.json(
        { error: 'Sandbox not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Command execution failed',
        stdout: '',
        stderr: error.message || 'Unknown error',
        exitCode: 1,
      },
      { status: 200 } // Return 200 but with error in response
    );
  }
}
