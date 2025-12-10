import { NextRequest, NextResponse } from 'next/server';
import { EnvManager } from '@/src/services/env-manager';
import type { EnvVariable } from '@/src/types/context-management';

/**
 * POST /api/env/save
 * 
 * Save environment variables for a project.
 * Also syncs to sandbox if sandboxId is provided.
 * 
 * Requirements: 16.1, 16.2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sandboxId, variables } = body as {
      projectId: string;
      sandboxId?: string;
      variables: EnvVariable[];
    };

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!variables || !Array.isArray(variables)) {
      return NextResponse.json(
        { error: 'Variables array is required' },
        { status: 400 }
      );
    }

    const envManager = new EnvManager();

    // Save to database
    await envManager.saveEnvVariables(projectId, variables);

    // If sandbox is provided, also save to .env.local in sandbox
    if (sandboxId) {
      try {
        const envContent = envManager.formatEnvContent(variables);
        
        // Call sandbox file create API to save .env.local
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sandbox/file/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sandboxId,
            projectId,
            filePath: '.env.local',
            content: envContent,
          }),
        });

        if (!response.ok) {
          console.warn('Failed to sync env file to sandbox:', await response.text());
        }
      } catch (sandboxError) {
        console.warn('Failed to sync env file to sandbox:', sandboxError);
        // Don't fail the request if sandbox sync fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Environment variables saved successfully',
      savedCount: variables.length,
    });
  } catch (error) {
    console.error('Error saving env variables:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save environment variables' },
      { status: 500 }
    );
  }
}
