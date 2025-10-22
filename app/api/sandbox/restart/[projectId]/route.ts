import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Enhanced sandbox restart with full repository restoration
 * - Creates new E2B sandbox when old one expires
 * - Clones GitHub repository
 * - Installs dependencies
 * - Starts dev server
 * - Returns new sandbox URL without requiring page reload
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
    const userId = project.user_id;

    if (!repoUrl) {
      return NextResponse.json({ error: 'No repository URL found' }, { status: 400 });
    }

    // Get GitHub integration for access token
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'github')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'GitHub integration not found' }, { status: 401 });
    }

    // Determine port and package manager based on framework
    type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'unknown';
    
    const frameworkConfig: Record<string, { port: number; packageManager: PackageManager; startCommand: string }> = {
      nextjs: { port: 3000, packageManager: 'npm' as PackageManager, startCommand: 'npm run dev' },
      react: { port: 3000, packageManager: 'npm' as PackageManager, startCommand: 'npm start' },
      vue: { port: 5173, packageManager: 'npm' as PackageManager, startCommand: 'npm run dev' },
      angular: { port: 4200, packageManager: 'npm' as PackageManager, startCommand: 'npm start' },
      express: { port: 3000, packageManager: 'npm' as PackageManager, startCommand: 'npm start' },
      fastapi: { port: 8000, packageManager: 'pip' as PackageManager, startCommand: 'uvicorn main:app --reload --host 0.0.0.0 --port 8000' },
      flask: { port: 5000, packageManager: 'pip' as PackageManager, startCommand: 'python app.py' },
      unknown: { port: 3000, packageManager: 'npm' as PackageManager, startCommand: 'npm start' },
    };
    
    const config = frameworkConfig[framework] || frameworkConfig.unknown;

    // Create new sandbox with extended timeout
    const templateId = process.env.E2B_FULLSTACK_TEMPLATE_ID || 'ckskh5feot2y94v5z07d';
    const sandbox = await Sandbox.create(templateId, {
      timeoutMs: 3600000, // 1 hour timeout
    });

    console.log(`✅ Created new sandbox ${sandbox.sandboxId} for project ${projectId}`);

    try {
      // Import GitHub service
      const { githubRepositoryService } = await import('@/src/services/github-repository-service');

      // Clone repository
      console.log(`📥 Cloning repository: ${repoUrl}`);
      const cloneResult = await githubRepositoryService.cloneToSandbox(
        repoUrl,
        integration.access_token,
        sandbox
      );

      if (!cloneResult.success) {
        throw new Error(`Failed to clone repository: ${cloneResult.error}`);
      }

      const repoPath = cloneResult.path;
      console.log(`✅ Repository cloned to: ${repoPath}`);

      // Install dependencies
      console.log(`📦 Installing dependencies with ${config.packageManager}...`);
      const installResult = await githubRepositoryService.installDependencies(
        sandbox,
        config.packageManager,  // Fixed: packageManager should be 2nd param
        repoPath                // Fixed: repoPath should be 3rd param
      );

      if (!installResult.success) {
        console.error('❌ Dependency installation failed:', installResult.error);
        if (installResult.output) {
          console.error('📄 npm output:', installResult.output);
        }
        throw new Error(`Failed to install dependencies: ${installResult.error}`);
      } else {
        console.log(`✅ Dependencies installed successfully`);
        if (installResult.fallbackUsed) {
          console.log('⚠️ Used --legacy-peer-deps fallback');
        }
      }

      // Start preview server
      console.log(`🚀 Starting preview server with: ${config.startCommand}`);
      const previewResult = await githubRepositoryService.startPreviewServer(
        sandbox,
        {
          framework,
          packageManager: config.packageManager,
          startCommand: config.startCommand,
          port: config.port,
        },
        repoPath
      );

      if (!previewResult.success) {
        throw new Error(`Failed to start preview server: ${previewResult.error}`);
      }

      const sandboxUrl = previewResult.url;
      console.log(`✅ Preview server started: ${sandboxUrl}`);

      // Update project with new sandbox info
      await supabase
        .from('projects')
        .update({
          sandbox_url: sandboxUrl,
          metadata: {
            ...metadata,
            sandboxId: sandbox.sandboxId,
            sandboxUrl,
            framework,
            port: config.port,
            packageManager: config.packageManager,
            startCommand: config.startCommand,
            lastRestarted: new Date().toISOString(),
            lastSuccessfulRestore: new Date().toISOString(),
          },
        })
        .eq('id', projectId);

      console.log(`✅ Project ${projectId} updated with new sandbox URL`);

      return NextResponse.json({
        success: true,
        sandboxId: sandbox.sandboxId,
        sandboxUrl,
        framework,
        port: config.port,
        message: 'Sandbox restored successfully',
      });

    } catch (restoreError: any) {
      // If restoration fails, kill the sandbox and return error
      console.error('❌ Sandbox restoration failed:', restoreError);
      
      try {
        await sandbox.kill();
      } catch (killError) {
        console.error('Failed to cleanup sandbox:', killError);
      }

      throw restoreError;
    }

  } catch (error: any) {
    console.error('Sandbox restart error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to restart sandbox',
    }, { status: 500 });
  }
}

