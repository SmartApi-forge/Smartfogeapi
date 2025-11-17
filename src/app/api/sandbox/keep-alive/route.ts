/**
 * Sandbox Keep-Alive API
 * 
 * Keeps a sandbox alive by making API calls to reset the auto-stop timer.
 * This should be called periodically (e.g., every 5 minutes) when a user
 * is actively working with a project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { keepSandboxAlive } from '@/lib/daytona-client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }
    
    // Get sandbox ID from project metadata
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('metadata')
      .eq('id', projectId)
      .single();
    
    if (error || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    const sandboxId = project.metadata?.sandboxId;
    
    if (!sandboxId) {
      return NextResponse.json(
        { error: 'No sandbox associated with this project' },
        { status: 404 }
      );
    }
    
    // Send keep-alive ping to sandbox
    await keepSandboxAlive(sandboxId);
    
    return NextResponse.json({
      success: true,
      message: 'Keep-alive ping sent successfully',
      sandboxId,
    });
  } catch (error) {
    console.error('Keep-alive error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to keep sandbox alive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
