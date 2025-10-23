import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

/**
 * Keep E2B sandbox alive while user is viewing the project
 * Extends sandbox lifetime by sending keepAlive signal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Create Supabase client with user's session
    const supabase = await createRouteHandlerClient();

    // Get project with sandbox info from metadata
    const { data: project, error } = await supabase
      .from('projects')
      .select('metadata, sandbox_url')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const metadata = project.metadata as any;
    const sandboxId = metadata?.sandboxId;

    if (!sandboxId) {
      return NextResponse.json({ error: 'No sandbox found for this project' }, { status: 404 });
    }

    // Try to connect to existing sandbox to check if it's still alive
    // E2B sandboxes stay alive while they have active connections
    try {
      const sandbox = await Sandbox.connect(sandboxId);
      // Connection successful - sandbox is alive
      console.log(`✅ Sandbox ${sandboxId} is alive for project ${projectId}`);
      
      return NextResponse.json({ 
        success: true, 
        sandboxId,
        message: 'Sandbox is alive'
      });
    } catch (sandboxError: any) {
      console.error(`Failed to connect to sandbox ${sandboxId}:`, sandboxError);
      return NextResponse.json({ 
        success: false,
        error: 'Sandbox may have timed out',
        needsRestart: true
      }, { status: 200 });
    }
  } catch (error: any) {
    console.error('KeepAlive error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

