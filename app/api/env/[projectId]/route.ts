import { NextRequest, NextResponse } from 'next/server';
import { EnvManager } from '@/src/services/env-manager';

/**
 * GET /api/env/[projectId]
 * 
 * Get environment variables for a project.
 * 
 * Requirements: 16.5
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const envManager = new EnvManager();
    const variables = await envManager.getEnvVariables(projectId);

    // Mask secret values for display (Requirements: 16.5)
    const maskedVariables = variables.map(v => ({
      ...v,
      value: v.isSecret ? '••••••••' : v.value,
      hasValue: !!v.value,
    }));

    return NextResponse.json({
      variables: maskedVariables,
      count: variables.length,
    });
  } catch (error) {
    console.error('Error fetching env variables:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch environment variables' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/env/[projectId]
 * 
 * Delete an environment variable for a project.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Variable key is required' },
        { status: 400 }
      );
    }

    const envManager = new EnvManager();
    await envManager.deleteEnvVariable(projectId, key);

    return NextResponse.json({
      success: true,
      message: `Environment variable ${key} deleted`,
    });
  } catch (error) {
    console.error('Error deleting env variable:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete environment variable' },
      { status: 500 }
    );
  }
}
