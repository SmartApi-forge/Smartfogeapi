import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, projectId, filePath } = await request.json();

    if (!sandboxId || !projectId || !filePath) {
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

    // Verify sandbox ID matches
    if (project.metadata?.sandboxId !== sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID mismatch' },
        { status: 403 }
      );
    }

    // Get sandbox
    const sandbox = await getWorkspace(sandboxId);

    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Delete the file from the sandbox using shell command
    const fullPath = `workspace/project/${filePath}`;

    await sandbox.process.executeCommand(
      `rm -f "${fullPath}"`,
      'workspace',
      undefined,
      30
    );

    console.log(`🗑️ Deleted file: ${fullPath}`);

    return NextResponse.json({
      success: true,
      filePath,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('File deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete file',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
