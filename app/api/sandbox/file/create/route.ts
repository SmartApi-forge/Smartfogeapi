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

    // Check if user is owner OR collaborator with edit access
    const isOwner = project.user_id === user.id;
    
    if (!isOwner) {
      // Check if user is a collaborator with edit permissions
      const { data: collaborator, error: collabError } = await supabase
        .from('project_collaborators')
        .select('access_level')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (collabError || !collaborator) {
        return NextResponse.json(
          { error: 'You do not have access to this project' },
          { status: 403 }
        );
      }

      // Only users with 'edit' access can create files
      if (collaborator.access_level !== 'edit') {
        return NextResponse.json(
          { error: 'You need edit permissions to create files' },
          { status: 403 }
        );
      }
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
