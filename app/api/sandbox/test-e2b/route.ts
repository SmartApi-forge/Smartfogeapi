import { NextResponse } from 'next/server';
import { Sandbox } from 'e2b';

/**
 * Diagnostic endpoint to test E2B connection
 * Visit: /api/sandbox/test-e2b
 */
export async function GET() {
  try {
    console.log('🧪 Testing E2B connection...');
    
    // Check if E2B_API_KEY is set
    if (!process.env.E2B_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'E2B_API_KEY environment variable not set',
        hint: 'Add E2B_API_KEY to your .env.local file'
      }, { status: 500 });
    }

    console.log('✅ E2B_API_KEY found');

    // Try to create a simple sandbox
    const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
    console.log(`📦 Attempting to create sandbox with template: ${templateId}`);

    const sandbox = await Sandbox.create(templateId, {
      timeoutMs: 60000, // 1 minute for test
    });

    console.log(`✅ Sandbox created successfully: ${sandbox.sandboxId}`);

    // Test if we can run a command
    const result = await sandbox.commands.run('echo "Hello from E2B"');
    console.log(`✅ Command executed: ${result.stdout}`);

    // Clean up
    await sandbox.kill();
    console.log('✅ Sandbox killed successfully');

    return NextResponse.json({
      success: true,
      message: 'E2B is working correctly!',
      details: {
        templateId,
        sandboxId: sandbox.sandboxId,
        commandOutput: result.stdout,
      }
    });

  } catch (error: any) {
    console.error('❌ E2B test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack,
      hint: 'Check your E2B_API_KEY and template ID'
    }, { status: 500 });
  }
}
