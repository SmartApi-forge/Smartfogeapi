import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/src/lib/daytona-client';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sandboxId, command, workingDirectory } = await request.json();

    if (!sandboxId || !command) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
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
