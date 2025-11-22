import { NextResponse } from 'next/server';
import { createWorkspace, deleteWorkspace } from '@/src/lib/daytona-client';

/**
 * Diagnostic endpoint to test Daytona connection
 * Visit: /api/sandbox/test-e2b
 */
export async function GET() {
  try {
    console.log('🧪 Testing Daytona connection...');
    
    // Check if DAYTONA_API_KEY is set
    if (!process.env.DAYTONA_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'DAYTONA_API_KEY environment variable not set',
        hint: 'Add DAYTONA_API_KEY to your .env.local file'
      }, { status: 500 });
    }

    console.log('✅ DAYTONA_API_KEY found');

    // Try to create a simple sandbox
    console.log(`📦 Attempting to create Daytona workspace...`);

    const sandbox = await createWorkspace({
      resources: { cpu: 4, memory: 8, disk: 10 },
      image: 'node:22-bookworm',
    });

    console.log(`✅ Workspace created successfully: ${sandbox.id}`);

    // Test if we can run a command
    const result = await sandbox.process.executeCommand('echo "Hello from Daytona"');
    console.log(`✅ Command executed: ${result.result}`);

    // Clean up
    await deleteWorkspace(sandbox);
    console.log('✅ Workspace deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Daytona is working correctly!',
      details: {
        sandboxId: sandbox.id,
        commandOutput: result.result,
      }
    });

  } catch (error: any) {
    console.error('❌ Daytona test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack,
      hint: 'Check your DAYTONA_API_KEY configuration'
    }, { status: 500 });
  }
}
