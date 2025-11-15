import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sandboxId } = await request.json();

    if (!sessionId || !sandboxId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // In a full implementation, you would:
    // 1. Delete the session from Daytona if it was created
    // 2. Clean up any stored session data
    // 3. Terminate any running processes

    console.log(`Cleaning up terminal session: ${sessionId} for sandbox: ${sandboxId}`);

    return NextResponse.json({
      success: true,
      message: 'Session cleaned up successfully',
    });
  } catch (error) {
    console.error('Terminal cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup terminal session' },
      { status: 500 }
    );
  }
}
