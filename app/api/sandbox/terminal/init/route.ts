import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, projectId, workingDirectory } = await request.json();

    if (!sandboxId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = await createRouteHandlerClient();

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

    // Verify sandbox ID matches project metadata
    if (project.metadata?.sandboxId !== sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID mismatch' },
        { status: 403 }
      );
    }

    // Generate unique session ID for this PTY session
    // In a real implementation, you would create a session in Daytona here
    const sessionId = `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store session info in memory or database if needed
    // For now, we'll just return the session ID

    return NextResponse.json({
      success: true,
      sessionId,
      sandboxId,
      workingDirectory: workingDirectory || 'workspace/project',
    });
  } catch (error) {
    console.error('Terminal init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize terminal session' },
      { status: 500 }
    );
  }
}
