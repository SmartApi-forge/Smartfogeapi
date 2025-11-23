/**
 * Vercel Deployment API Route
 * Handles deployment requests from the frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { vercelPlatformsService } from '@/src/services/vercel-platforms-service';

export async function POST(req: NextRequest) {
  try {
    // Check Vercel access token first
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      console.error('VERCEL_ACCESS_TOKEN is not set');
      return NextResponse.json(
        {
          error: 'Vercel configuration missing',
          details: 'VERCEL_ACCESS_TOKEN environment variable is not set. Please add it to your environment variables.',
        },
        { status: 500 }
      );
    }

    // Authenticate user using custom cookie names
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      console.error('User authentication failed: No access token cookie');
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Please sign in to deploy projects' },
        { status: 401 }
      );
    }

    // Create Supabase client and verify token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('User authentication failed:', userError?.message || 'Invalid token');
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Please sign in to deploy projects' },
        { status: 401 }
      );
    }

    // Get request body
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check for existing in-progress deployment
    const { data: existingDeployment } = await supabase
      .from('deployments')
      .select('vercel_deployment_id, deployment_url, status')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'building')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If there's an active deployment, return it instead of creating a new one
    if (existingDeployment) {
      return NextResponse.json({
        success: true,
        deploymentId: existingDeployment.vercel_deployment_id,
        url: existingDeployment.deployment_url,
        isExisting: true,
        message: 'Resuming existing deployment'
      });
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*, versions(files)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .order('version_number', { foreignTable: 'versions', ascending: false })
      .limit(1, { foreignTable: 'versions' })
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let files: Record<string, string> = {};

    // Check if this is a GitHub project
    if (project.github_mode && project.repo_url) {
      // For GitHub projects, fetch files from the GitHub repository
      try {
        const { getGitHubOAuthService } = await import('@/lib/github-oauth');
        const { Octokit } = await import('@octokit/rest');
        
        const githubOAuth = getGitHubOAuthService();
        const integration = await githubOAuth.getUserIntegration(user.id);
        
        if (!integration?.access_token) {
          return NextResponse.json({ 
            error: 'GitHub not connected',
            details: 'Please reconnect your GitHub account to deploy this project'
          }, { status: 401 });
        }

        const octokit = new Octokit({ auth: integration.access_token });
        
        // Parse repo owner and name from repo_url
        const repoMatch = project.repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!repoMatch) {
          return NextResponse.json({ 
            error: 'Invalid repository URL' 
          }, { status: 400 });
        }
        
        const [, owner, repoName] = repoMatch;
        const branch = project.active_branch || 'main';
        
        console.log(`Fetching files from GitHub: ${owner}/${repoName} (${branch})`);
        
        // Helper to detect if file is binary based on extension
        function isBinaryFile(filename: string): boolean {
          const binaryExtensions = [
            // Images
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
            // Fonts
            '.woff', '.woff2', '.ttf', '.otf', '.eot',
            // Other binary
            '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.wav',
            '.exe', '.dll', '.so', '.dylib'
          ];
          const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          return binaryExtensions.includes(ext);
        }
        
        // Recursively fetch all files from repository
        async function fetchFiles(path: string = ''): Promise<Record<string, string>> {
          const result: Record<string, string> = {};
          
          try {
            const { data } = await octokit.repos.getContent({
              owner,
              repo: repoName.replace('.git', ''),
              path,
              ref: branch,
            });
            
            if (Array.isArray(data)) {
              for (const item of data) {
                // Skip common directories that shouldn't be deployed
                if (item.name === 'node_modules' || item.name === '.git' || 
                    item.name === '.next' || item.name === 'dist' || item.name === 'build' ||
                    item.name === '.env' || item.name === '.env.local') {
                  continue;
                }
                
                if (item.type === 'file' && item.download_url) {
                  try {
                    // Fetch file content
                    const fileResponse = await fetch(item.download_url);
                    
                    // Handle binary files (images, fonts, etc.) differently
                    if (isBinaryFile(item.name)) {
                      const arrayBuffer = await fileResponse.arrayBuffer();
                      const buffer = Buffer.from(arrayBuffer);
                      const base64 = buffer.toString('base64');
                      result[item.path] = base64;
                      console.log(`Fetched binary file: ${item.path} (${buffer.length} bytes)`);
                    } else {
                      const content = await fileResponse.text();
                      result[item.path] = content;
                    }
                  } catch (fileError: any) {
                    console.error(`Failed to fetch file ${item.path}:`, fileError.message);
                  }
                } else if (item.type === 'dir') {
                  // Recursively fetch directory contents
                  const dirFiles = await fetchFiles(item.path);
                  Object.assign(result, dirFiles);
                }
              }
            }
          } catch (error: any) {
            console.error(`Failed to fetch ${path}:`, error.message);
          }
          
          return result;
        }
        
        files = await fetchFiles();
        
        // Count binary vs text files for logging
        const binaryCount = Object.keys(files).filter(path => isBinaryFile(path)).length;
        const textCount = Object.keys(files).length - binaryCount;
        
        console.log(`✅ Fetched ${Object.keys(files).length} files from GitHub:`);
        console.log(`   - ${textCount} text files`);
        console.log(`   - ${binaryCount} binary files (images, fonts, etc.)`);
        
        if (Object.keys(files).length === 0) {
          return NextResponse.json({ 
            error: 'No files found in repository' 
          }, { status: 400 });
        }
      } catch (error: any) {
        console.error('Failed to fetch GitHub files:', error);
        return NextResponse.json({ 
          error: 'Failed to fetch repository files',
          details: error.message
        }, { status: 500 });
      }
    } else {
      // For non-GitHub projects, use files from database
      files = project.versions?.[0]?.files || {};
      
      if (Object.keys(files).length === 0) {
        return NextResponse.json({ error: 'No files to deploy' }, { status: 400 });
      }
    }

    // Deploy to Vercel
    const result = await vercelPlatformsService.deployProject(
      user.id,
      projectId,
      files,
      project.framework || 'nextjs'
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deploymentId: result.deploymentId,
      url: result.url,
      claimUrl: result.claimUrl,
    });
  } catch (error: any) {
    console.error('Deployment API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deploy' },
      { status: 500 }
    );
  }
}

