/**
 * GitHub Clone SSE Streaming API Route
 * 
 * Direct SSE streaming endpoint for GitHub repository cloning.
 * Replaces Inngest-based cloning with real-time progress events.
 */

import { NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Sandbox } from '@daytonaio/sdk';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    // Use service role with auth options to bypass RLS
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

interface CloneSSEEvent {
  type: 'clone:start' | 'clone:progress' | 'install:progress' | 'preview:ready' | 'clone:complete' | 'clone:error';
  message?: string;
  repoUrl?: string;
  framework?: string;
  sandboxUrl?: string;
  fileCount?: number;
  projectId?: string;
  error?: string;
}

function sendSSEEvent(controller: ReadableStreamDefaultController, event: CloneSSEEvent): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

/**
 * GET /api/github/clone - Health check
 */
export async function GET() {
  return new Response(JSON.stringify({ status: 'ok', message: 'Clone API is available' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/github/clone - Clone a repository with SSE streaming
 */
export async function POST(request: NextRequest) {
  console.log('POST /api/github/clone hit');
  
  let sandbox: Sandbox | null = null;
  
  try {
    // Parse request body
    let body: { projectId?: string } = {};
    try {
      const text = await request.text();
      console.log('Request body:', text);
      if (text) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { projectId } = body;

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'projectId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch project info
    const supabase = getSupabase();
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get GitHub repository info separately to avoid ambiguous relationship
    const { data: githubRepo, error: repoError } = await supabase
      .from('github_repositories')
      .select('*')
      .eq('project_id', projectId)
      .single();
    
    console.log('GitHub repo lookup:', { githubRepo, repoError });

    if (!githubRepo) {
      return new Response(JSON.stringify({ error: 'GitHub repository not linked to project' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get GitHub access token from user_integrations table
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('id', githubRepo.integration_id)
      .single();
    
    console.log('Integration lookup:', { integration, integrationError });

    if (!integration?.access_token) {
      return new Response(JSON.stringify({ error: 'GitHub access token not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repoUrl = githubRepo.repo_url;
    const accessToken = integration.access_token;

    console.log('Starting clone for repo:', githubRepo.repo_full_name);

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Lazy load modules
          const daytona = await import('../../../../src/lib/daytona-client');
          const { githubRepositoryService } = await import('../../../../src/services/github-repository-service');
          const { conversationContextService } = await import('../../../../src/services/conversation-context-service');
          
          // Emit clone:start
          sendSSEEvent(controller, {
            type: 'clone:start',
            message: 'Starting repository clone...',
            repoUrl,
            projectId,
          });

          // Step 1: Create Daytona workspace
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Creating workspace...',
          });

          console.log('Creating Daytona workspace...');
          sandbox = await daytona.createWorkspace({
            autoStopInterval: 30,
          });
          console.log('Workspace created:', sandbox.id);

          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Workspace created successfully',
          });

          // Step 2: Clone repository
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: `Cloning repository: ${githubRepo.repo_full_name}...`,
          });

          console.log('Cloning repository...');
          const cloneResult = await githubRepositoryService.cloneToSandbox(
            repoUrl,
            accessToken,
            sandbox
          );

          if (!cloneResult.success) {
            throw new Error(`Clone failed: ${cloneResult.error}`);
          }
          console.log('Repository cloned to:', cloneResult.path);

          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Repository cloned successfully',
          });

          // Step 3: Detect framework
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Detecting framework...',
          });

          console.log('Detecting framework...');
          const frameworkInfo = await githubRepositoryService.detectFramework(
            sandbox,
            cloneResult.path
          );
          console.log('Detected framework:', frameworkInfo.framework);

          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: `Detected framework: ${frameworkInfo.framework}`,
            framework: frameworkInfo.framework,
          });

          // Step 4: Install dependencies
          sendSSEEvent(controller, {
            type: 'install:progress',
            message: `Installing dependencies with ${frameworkInfo.packageManager}...`,
          });

          console.log('Installing dependencies...');
          const installResult = await githubRepositoryService.installDependencies(
            sandbox,
            frameworkInfo.packageManager,
            cloneResult.path
          );

          if (installResult.success) {
            console.log('Dependencies installed');
            sendSSEEvent(controller, {
              type: 'install:progress',
              message: installResult.fallbackUsed 
                ? 'Dependencies installed (with --legacy-peer-deps)'
                : 'Dependencies installed successfully',
            });
          } else {
            console.warn('Dependency installation failed:', installResult.error);
            sendSSEEvent(controller, {
              type: 'install:progress',
              message: `Warning: ${installResult.error?.substring(0, 100)}...`,
            });
          }

          // Step 5: Start preview server
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Starting preview server...',
          });

          console.log('Starting preview server...');
          const previewResult = await githubRepositoryService.startPreviewServer(
            sandbox,
            frameworkInfo,
            cloneResult.path,
            true
          );

          let sandboxUrl: string | undefined;
          if (previewResult.success && previewResult.url) {
            sandboxUrl = previewResult.url;
            console.log('Preview URL:', sandboxUrl);
            sendSSEEvent(controller, {
              type: 'preview:ready',
              message: 'Preview server started',
              sandboxUrl,
            });
          } else {
            console.warn('Preview server failed:', previewResult.error);
            try {
              const previewLink = await sandbox!.getPreviewLink(frameworkInfo.port || 3000);
              sandboxUrl = previewLink.url;
              sendSSEEvent(controller, {
                type: 'preview:ready',
                message: 'Preview URL available',
                sandboxUrl,
              });
            } catch {
              sendSSEEvent(controller, {
                type: 'clone:progress',
                message: 'Preview server could not be started',
              });
            }
          }

          // Step 6: Update project status FIRST (faster UX - user sees completion sooner)
          const db = getSupabase();
          await db
            .from('projects')
            .update({
              sandbox_url: sandboxUrl,
              framework: frameworkInfo.framework,
              status: 'completed',
              metadata: {
                sandboxId: sandbox!.id,
                framework: frameworkInfo.framework,
                port: frameworkInfo.port || 3000,
                packageManager: frameworkInfo.packageManager,
                startCommand: frameworkInfo.startCommand,
                clonePath: cloneResult.path,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', projectId);

          await db
            .from('github_repositories')
            .update({
              sync_status: 'idle',
              last_sync_at: new Date().toISOString(),
            })
            .eq('project_id', projectId);

          // Step 7: Read files FIRST (needed for version creation)
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: 'Scanning project files...',
          });

          console.log('Reading files...');
          const filesSnapshot = await daytona.readAllFiles(sandbox!, cloneResult.path);
          
          sendSSEEvent(controller, {
            type: 'clone:progress',
            message: `Found ${Object.keys(filesSnapshot).length} files, creating version...`,
          });
          const fileCount = Object.keys(filesSnapshot).length;
          const totalSize = Object.values(filesSnapshot).reduce((sum, f) => sum + f.size, 0);
          console.log('Files read:', fileCount);

          // Step 8: Create initial version with cloned files
          let versionId: string | null = null;
          try {
            // Convert snapshot to version files format (just content strings)
            const versionFiles: Record<string, string> = {};
            Object.entries(filesSnapshot).forEach(([path, data]) => {
              versionFiles[path] = data.content;
            });

            const { data: versionData, error: versionError } = await db
              .from('versions')
              .insert({
                project_id: projectId,
                version_number: 1,
                name: 'Initial Clone',
                description: `Cloned from ${githubRepo.repo_full_name}`,
                files: versionFiles,
                command_type: 'CREATE',
                prompt: `Clone: ${githubRepo.repo_full_name}`,
                status: 'complete',
                metadata: {
                  framework: frameworkInfo.framework,
                  fileCount,
                  source: 'github_clone',
                  repoFullName: githubRepo.repo_full_name,
                },
              })
              .select('id')
              .single();

            if (versionError) {
              console.error('Error creating version:', versionError);
            } else {
              versionId = versionData?.id;
              console.log('Initial version created with', fileCount, 'files, id:', versionId);
            }
          } catch (versionError) {
            console.error('Error creating version:', versionError);
          }

          // Step 9: Save messages with version_id link
          try {
            // Save user message linked to version
            await db
              .from('messages')
              .insert({
                project_id: projectId,
                content: `Clone: ${githubRepo.repo_full_name}`,
                role: 'user',
                type: 'text',
                sender_id: project.user_id,
                version_id: versionId, // Link to version for proper card display
              });

            // Save assistant welcome message (plain text, no markdown)
            const welcomeMessage = `I've successfully cloned ${githubRepo.repo_full_name} and set up your development environment!

Here's what I found:
- Framework: ${frameworkInfo.framework}
- Package Manager: ${frameworkInfo.packageManager}
- Files: ${fileCount} files indexed

Your preview is ready${sandboxUrl ? ` at the preview panel` : ''}. Feel free to ask me to:
- Make changes to the code
- Add new features
- Fix bugs or improve performance
- Explain how something works

What would you like to do first?`;

            await db
              .from('messages')
              .insert({
                project_id: projectId,
                content: welcomeMessage,
                role: 'assistant',
                type: 'text',
                version_id: versionId, // Also link assistant message
              });

            console.log('Messages saved with version_id:', versionId);
          } catch (msgError) {
            console.error('Error saving messages:', msgError);
          }

          // NOW emit clone complete (after version is created)
          sendSSEEvent(controller, {
            type: 'clone:complete',
            message: 'Repository cloned successfully!',
            projectId,
            sandboxUrl,
            framework: frameworkInfo.framework,
            fileCount,
          });

          // Save snapshot (can be async, not critical for UX)
          try {
            await conversationContextService.saveSnapshot({
              project_id: projectId,
              turn_index: 0,
              files_jsonb: filesSnapshot as Record<string, unknown>,
              file_count: fileCount,
              total_size_bytes: totalSize,
            });
            console.log('Snapshot saved');
          } catch (snapshotError) {
            console.error('Error saving snapshot:', snapshotError);
          }

          console.log('Clone complete!');
          
          // Small delay to ensure all events are sent before closing
          await new Promise(resolve => setTimeout(resolve, 100));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Clone error:', error);

          sendSSEEvent(controller, {
            type: 'clone:error',
            message: 'Clone failed',
            error: errorMessage,
          });

          // Cleanup on failure
          if (sandbox) {
            try {
              const daytona = await import('../../../../src/lib/daytona-client');
              await daytona.deleteWorkspace(sandbox);
            } catch (cleanupError) {
              console.error('Cleanup failed:', cleanupError);
            }
          }

          // Update project status
          const db = getSupabase();
          await db
            .from('projects')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', projectId);

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Clone route error:', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
