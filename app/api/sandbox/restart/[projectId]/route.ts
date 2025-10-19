import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Restart E2B sandbox for a project
 * Creates a new sandbox with the same configuration and updates project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get project with all necessary info
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const metadata = project.metadata as any;
    const framework = metadata?.framework || project.framework || 'nextjs';
    const repoUrl = project.repo_url;

    if (!repoUrl) {
      return NextResponse.json({ error: 'No repository URL found' }, { status: 400 });
    }

    // Determine port based on framework
    const frameworkPorts: Record<string, number> = {
      nextjs: 3000,
      react: 3000,
      vue: 5173,
      angular: 4200,
      express: 3000,
      fastapi: 8000,
      flask: 5000,
      unknown: 3000,
    };
    const port = frameworkPorts[framework] || 3000;

    // Create new sandbox
    const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
    const sandbox = await Sandbox.create(templateId, {
      timeoutMs: 3600000, // 1 hour timeout for user sessions
    });

    console.log(`✅ Created new sandbox ${sandbox.sandboxId} for project ${projectId}`);

    // Generate sandbox URL
    const sandboxUrl = `https://${sandbox.sandboxId}-${port}.e2b.dev`;

    // Update project with new sandbox info
    await supabase
      .from('projects')
      .update({
        sandbox_url: sandboxUrl,
        metadata: {
          ...metadata,
          sandboxId: sandbox.sandboxId,
          sandboxUrl,
          lastRestarted: new Date().toISOString(),
        },
      })
      .eq('id', projectId);

    console.log(`✅ Updated project ${projectId} with new sandbox URL: ${sandboxUrl}`);

    return NextResponse.json({
      success: true,
      sandboxId: sandbox.sandboxId,
      sandboxUrl,
      message: 'Sandbox restarted successfully',
    });
  } catch (error: any) {
    console.error('Sandbox restart error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to restart sandbox',
    }, { status: 500 });
  }
}

