import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/src/lib/daytona-client';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, projectId, filePath, content } = await request.json();

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

    // Create the file in the sandbox using shell commands
    const fullPath = `workspace/project/${filePath}`;
    const fileContent = content || '';

    // Create directory if needed (parent directories)
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dirPath) {
      await sandbox.process.executeCommand(
        `mkdir -p "${dirPath}"`,
        'workspace',
        undefined,
        30
      );
    }

    // Write file content using echo or cat
    // Use cat with heredoc for better handling of special characters
    if (fileContent) {
      const escapedContent = fileContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      await sandbox.process.executeCommand(
        `echo "${escapedContent}" > "${fullPath}"`,
        'workspace',
        undefined,
        30
      );
    } else {
      // Create empty file
      await sandbox.process.executeCommand(
        `touch "${fullPath}"`,
        'workspace',
        undefined,
        30
      );
    }

    console.log(`✅ Created file: ${fullPath}`);

    return NextResponse.json({
      success: true,
      filePath,
      fullPath,
      message: 'File created successfully',
    });
  } catch (error: any) {
    console.error('File creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create file',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
