/**
 * Direct Streaming API Route for Code Generation
 * 
 * Implements V0/Lovable-style direct SSE streaming for code generation.
 * Replaces Inngest queue-based processing with synchronous streaming.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.5, 4.1, 11.1, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3
 * 
 * Key Features:
 * - SSE streaming with proper headers (Content-Type: text/event-stream)
 * - Thinking indicator within 50ms of request
 * - First token within 500ms of submission
 * - Token forwarding within 10ms of receipt
 * - File reading events during context loading
 * - Complete conversation context persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { conversationContextService, buildConversationHistory, buildFileStateContext } from '../../../src/services/conversation-context-service';
import { parseCodeBlocks } from '../../../src/services/code-block-parser';
import { mergeSnapshots } from '../../../src/services/snapshot-merger';
import type { FileSnapshotData, FileChange } from '../../../src/types/database';
import {
  createWorkspace,
  getWorkspace,
  writeChangedFilesToDaytona,
  getPreviewUrl,
  runPnpmInstall,
  startPreviewServer,
  getPreviewServerLogs,
  createFolders,
  type Sandbox
} from '../../../src/lib/daytona-client';
import { supabaseServer } from '../../../lib/supabase-server';
import type { ConversationMessage } from '../../../src/types/database';
import {
  createReadTracker,
  parseToolCalls,
  executeToolCallsParallel,
  formatToolResultForLLM,
  createToolContext,
  getToolDefinitions,
  type ReadTracker,
  type ToolExecutionResult,
} from '../../../src/services/tool-integration';
import { PromptLoader } from '../../../src/services/prompt-loader';
import { cloneTemplate, isPackageInTemplate } from '../../../src/services/template-service';
import { detectFromPrompt, suggestLibraries } from '../../../src/services/dependency-detector';
import { detectGenerationMode, type GenerationModeResult } from '../../../src/services/generation-mode-detector';
import { generateFolderStructure, generatePackageJson, generateReadme, generateLightweightAPI } from '../../../src/services/lightweight-api-generator';

// Lazy-load OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Lazy-load Google Generative AI client
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
  }
  return geminiClient;
}

// Use nodejs runtime for OpenAI SDK compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow longer streaming sessions for code generation

/**
 * SSE Event Types for the generate API
 * 
 * Requirements: 5.1-5.8 (Generation Progress Tracking)
 */
export interface GenerateSSEEvent {
  type:
  | 'thinking'           // Initial thinking indicator
  | 'status'             // Status updates
  | 'file:reading'       // File being read for context
  | 'file:read:complete' // All files read
  | 'chunk'              // Token/content chunk
  | 'file:start'         // File generation started
  | 'file:complete'      // File generation complete
  | 'tool:start'         // Tool execution started
  | 'tool:complete'      // Tool execution complete
  | 'complete'           // Generation complete
  | 'error'              // Error occurred
  // Scaffolding events (Requirements: 5.1-5.8)
  | 'scaffold:start'     // Scaffolding process started
  | 'template:cloning'   // Template cloning in progress
  | 'template:complete'  // Template cloning complete
  | 'clone:error'        // Template clone failed (Requirement 1.4)
  | 'deps:analyzing'     // Analyzing prompt for dependencies
  | 'deps:detected'      // Packages detected from prompt
  | 'deps:suggested'     // Libraries suggested based on context
  | 'deps:installing'    // Installing packages
  | 'deps:progress'      // Installation progress
  | 'deps:complete'      // Installation complete
  | 'deps:error'         // Installation failed
  | 'generate:start'     // Code generation starting
  | 'preview:starting'   // Preview server starting
  | 'preview:ready'      // Preview ready
  // Lightweight API events (Requirements: 3.1, 3.2, 5.1-5.5)
  | 'api:started'        // Lightweight API generation started
  | 'api:analyzing'      // Analyzing API requirements
  | 'folder:created'     // Folder created in lightweight mode
  | 'api:complete';      // Lightweight API generation complete
  message?: string;
  content?: string;
  filename?: string;
  filePath?: string;
  fileCount?: number;
  filesModified?: string[];
  turnIndex?: number;
  tool?: string;
  taskNameActive?: string;
  taskNameComplete?: string;
  timestamp: number;
  // Scaffolding-specific fields
  sandboxId?: string;
  sandboxUrl?: string;
  packages?: string[];
  suggestions?: Array<{ name: string; reason: string; keywords: string[] }>;
  progress?: number;
  currentPackage?: string;
  installedCount?: number;
  totalCount?: number;
  installedPackages?: Array<{ name: string; version: string }>;
  error?: string;
  failedPackages?: string[];
  // Lightweight API-specific fields
  projectName?: string;
  path?: string;
  filesCreated?: number;
}

/**
 * Available AI models (Gemini models have free tier via Google AI Studio)
 */
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.0-flash';

/**
 * Request body for the generate API
 */
export interface GenerateRequest {
  projectId: string;
  userMessage: string;
  mode?: 'standalone' | 'github';
  model?: AIModel;
}

/**
 * Encodes an event as SSE data format
 */
function encodeSSE(event: GenerateSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Creates an SSE event with timestamp
 */
function createEvent(
  type: GenerateSSEEvent['type'],
  data: Partial<Omit<GenerateSSEEvent, 'type' | 'timestamp'>> = {}
): GenerateSSEEvent {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  };
}

/**
 * Write files to Daytona sandbox asynchronously
 * Does NOT block the response - fires and forgets with logging
 * NOTE: Preview server is started during scaffolding, not here
 * 
 * Requirements: 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * @param projectId Project ID to get/create sandbox for
 * @param changedFiles Array of file paths that changed
 * @param snapshotData Full snapshot data to get content from
 * @param emit SSE event emitter for status updates
 */
async function writeToDaytonaAsync(
  projectId: string,
  changedFiles: string[],
  snapshotData: FileSnapshotData,
  emit: (event: GenerateSSEEvent) => void
): Promise<void> {
  try {
    // Get or create sandbox for this project
    const sandbox = await getOrCreateSandbox(projectId);

    if (!sandbox) {
      console.warn('[Generate] No sandbox available, skipping Daytona write');
      return;
    }

    // Write changed files to Daytona
    console.log(`[Generate] Writing ${changedFiles.length} files to Daytona...`);

    const result = await writeChangedFilesToDaytona(sandbox, changedFiles, snapshotData);

    if (result.failureCount > 0) {
      console.warn(`[Generate] ${result.failureCount}/${result.totalFiles} files failed to write to Daytona`);
    } else {
      console.log(`[Generate] Successfully wrote ${result.successCount} files to Daytona`);
    }

    // Emit file:complete events for successfully written files
    for (const fileResult of result.results) {
      if (fileResult.success) {
        emit(createEvent('file:complete', {
          filename: fileResult.path,
          message: `Written to sandbox: ${fileResult.path}`,
        }));
      }
    }

    // Check if preview server is already running (started during scaffolding)
    const { isPreviewServerRunning } = await import('../../../src/lib/daytona-client');
    const isRunning = await isPreviewServerRunning(sandbox);

    if (isRunning) {
      console.log('[Generate] Preview server already running, skipping restart');
      // Just emit that files were updated
      emit(createEvent('status', {
        message: 'Files updated, preview refreshing...',
      }));
      return;
    }

    // REQUIREMENT 4.1: Start the Next.js dev server if not already running
    // REQUIREMENT 5.7: Emit preview:starting event
    emit(createEvent('preview:starting', {
      message: 'Starting development server...',
    }));

    try {
      const previewResult = await startPreviewServer(sandbox);

      if (previewResult.success) {
        // REQUIREMENT 4.2: Emit preview:ready event with sandbox URL
        emit(createEvent('preview:ready', {
          message: 'Preview ready! ✓',
          sandboxUrl: previewResult.previewUrl,
        }));
        console.log(`[Generate] Preview server started: ${previewResult.previewUrl}`);
      } else {
        // REQUIREMENT 4.4: Emit error event with server logs on failure
        const logs = await getPreviewServerLogs(sandbox);
        emit(createEvent('error', {
          message: `Failed to start preview server: ${previewResult.error}`,
          error: previewResult.error,
        }));
        console.error(`[Generate] Preview server failed: ${previewResult.error}`);
        console.error(`[Generate] Server logs: ${logs}`);
      }
    } catch (previewError) {
      // REQUIREMENT 4.4: Handle preview server errors
      const errorMessage = previewError instanceof Error ? previewError.message : 'Unknown error';
      const logs = await getPreviewServerLogs(sandbox).catch(() => 'Unable to retrieve logs');
      emit(createEvent('error', {
        message: `Preview server error: ${errorMessage}`,
        error: errorMessage,
      }));
      console.error(`[Generate] Preview server error: ${errorMessage}`);
      console.error(`[Generate] Server logs: ${logs}`);
    }

  } catch (error) {
    // REQUIREMENT 5.4: Log errors but don't crash generation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Generate] Daytona write error (non-blocking):', errorMessage);
    // Don't throw - this is async and shouldn't block the response
  }
}

/**
 * Extract sandbox ID from sandbox URL
 * URL format: https://{port}-{sandbox_id}.proxy.daytona.works
 * Example: https://3000-8dfe4f1b-41e7-451f-8997-679d5261dfcb.proxy.daytona.works
 */
function extractSandboxIdFromUrl(sandboxUrl: string): string | null {
  try {
    const url = new URL(sandboxUrl);
    const hostname = url.hostname;

    // Format: {port}-{sandbox_id}.proxy.daytona.works
    // Example: 3000-8dfe4f1b-41e7-451f-8997-679d5261dfcb.proxy.daytona.works
    const match = hostname.match(/^\d+-([a-f0-9-]+)\.proxy\.daytona\.works$/);
    if (match) {
      return match[1]; // Return the UUID part
    }

    // Alternative format: {sandbox_id}-{port}.daytona.works (old format)
    const altMatch = hostname.match(/^([a-f0-9-]+)-\d+\.daytona\.works$/);
    if (altMatch) {
      return altMatch[1];
    }

    // Fallback: try to extract UUID from hostname
    const uuidMatch = hostname.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get existing sandbox or create new one for a project
 * Updates project record with sandbox_url if new sandbox created
 * 
 * Requirements: 5.1, 5.5
 */
async function getOrCreateSandbox(projectId: string): Promise<Sandbox | null> {
  try {
    // First, try to get existing sandbox from project record
    const { data: project, error: fetchError } = await supabaseServer
      .from('projects')
      .select('sandbox_url')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error('[Generate] Error fetching project:', fetchError);
      return null;
    }

    // If project has existing sandbox_url, try to reconnect
    if (project?.sandbox_url) {
      const sandboxId = extractSandboxIdFromUrl(project.sandbox_url);
      if (sandboxId) {
        try {
          const sandbox = await getWorkspace(sandboxId);
          console.log(`[Generate] Reconnected to existing sandbox: ${sandboxId}`);
          return sandbox;
        } catch (reconnectError) {
          console.warn('[Generate] Could not reconnect to sandbox, creating new one:', reconnectError);
          // Fall through to create new sandbox
        }
      }
    }

    // Create new sandbox
    console.log('[Generate] Creating new Daytona sandbox...');
    const sandbox = await createWorkspace({
      public: true,
      autoStopInterval: 30, // 30 minutes
    });

    // REQUIREMENT 5.5: Update project with sandbox_url
    const { getPreviewUrlAsync } = await import('../../../src/lib/daytona-client');
    const sandboxUrl = await getPreviewUrlAsync(sandbox);
    const { error: updateError } = await supabaseServer
      .from('projects')
      .update({
        sandbox_url: sandboxUrl,
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[Generate] Error updating project with sandbox URL:', updateError);
      // Continue anyway - sandbox is created
    } else {
      console.log(`[Generate] Updated project with sandbox URL: ${sandboxUrl}`);
    }

    return sandbox;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Generate] Error getting/creating sandbox:', errorMessage);
    return null;
  }
}

/**
 * POST handler for code generation streaming
 * 
 * Requirements:
 * - 1.3: Set appropriate SSE headers
 * - 11.1: Emit thinking indicator within 50ms
 * - 1.1: Begin streaming within 200ms
 */
export async function POST(request: NextRequest) {
  const requestStartTime = performance.now();

  try {
    // Parse and validate request body
    const body = await request.json() as GenerateRequest;
    const { projectId, userMessage, mode, model = 'gpt-4o' } = body;

    // Validate required parameters
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!userMessage || userMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'userMessage is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Create the streaming response using ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Track if controller is still open to prevent "Controller is already closed" errors
        let isControllerOpen = true;

        // Store async operations that should complete before closing
        let pendingDaytonaWrite: Promise<void> | null = null;

        /**
         * Helper to emit SSE event
         * Only emits if controller is still open
         */
        const emit = (event: GenerateSSEEvent) => {
          if (!isControllerOpen) {
            // Controller is closed, log but don't throw
            console.log('[Generate] Skipping emit, controller already closed:', event.type);
            return;
          }
          try {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          } catch (error) {
            // This can happen if controller just closed - mark as closed
            isControllerOpen = false;
            console.log('[Generate] Controller closed during emit:', event.type);
          }
        };

        /**
         * Helper to emit error and close stream
         */
        const emitError = (message: string, stage?: string) => {
          emit(createEvent('error', { message }));
          console.error(`[Generate] Error at ${stage || 'unknown'}: ${message}`);
        };

        try {
          // REQUIREMENT 11.1: Emit thinking indicator within 50ms of request
          const thinkingTime = performance.now() - requestStartTime;
          emit(createEvent('thinking', { message: 'Processing your request...' }));
          console.log(`[Generate] Thinking indicator emitted at ${thinkingTime.toFixed(2)}ms`);

          // ============================================
          // REQUIREMENT 3.1: Generation Mode Detection
          // Detect if this is an API-only request or full scaffold
          // ============================================
          const modeResult = detectGenerationMode(userMessage);
          console.log(`[Generate] Mode detected: ${modeResult.mode} (confidence: ${modeResult.confidence})`);
          console.log(`[Generate] API keywords: ${modeResult.apiKeywords.join(', ') || 'none'}`);
          console.log(`[Generate] UI keywords: ${modeResult.uiKeywords.join(', ') || 'none'}`);
          console.log(`[Generate] Suggested project name: ${modeResult.suggestedProjectName}`);

          // ============================================
          // REQUIREMENT 3.1, 3.2, 3.3: Route based on mode
          // If LIGHTWEIGHT_API mode, skip template cloning
          // ============================================
          if (modeResult.mode === 'LIGHTWEIGHT_API') {
            console.log('[Generate] Using lightweight API generation mode');
            
            // Handle lightweight API generation
            await handleLightweightAPIGeneration(
              projectId,
              userMessage,
              modeResult,
              emit,
              emitError,
              controller,
              requestStartTime,
              model
            );
            return;
          }

          // Continue with full scaffold mode
          console.log('[Generate] Using full scaffold generation mode');

          // REQUIREMENT 2.2, 3.2: Load conversation context
          emit(createEvent('status', { message: 'Loading conversation context...' }));

          let messages: ConversationMessage[] = [];
          let latestSnapshot: Awaited<ReturnType<typeof conversationContextService.loadLatestSnapshot>> = null;

          try {
            // Load previous messages
            messages = await conversationContextService.loadMessages(projectId);

            // Load latest file snapshot
            latestSnapshot = await conversationContextService.loadLatestSnapshot(projectId);
          } catch (dbError) {
            console.error('[Generate] Database error loading context:', dbError);
            // Continue with empty context if database fails
            messages = [];
            latestSnapshot = null;
          }

          // ============================================
          // REQUIREMENT 1.1, 1.3: Template Cloning for New Projects
          // Check if project has existing file_snapshot
          // If no snapshot exists, trigger template cloning
          // ============================================
          let currentSandbox: Sandbox | null = null;

          if (!latestSnapshot) {
            console.log('[Generate] No existing snapshot found, initiating scaffolding...');

            // REQUIREMENT 5.1: Emit scaffold:start event
            emit(createEvent('scaffold:start', {
              message: 'Analyzing your request...',
            }));

            // REQUIREMENT 1.1: Emit template:cloning event
            emit(createEvent('template:cloning', {
              message: 'Cloning template environment...',
            }));

            try {
              // Clone the pre-built template
              const cloneResult = await cloneTemplate(projectId);

              if (!cloneResult.success) {
                // REQUIREMENT 1.4: Emit clone:error event
                emit(createEvent('clone:error', {
                  message: `Template clone failed: ${cloneResult.error}. Please try again.`,
                  error: cloneResult.error,
                }));
                emitError(`Template clone failed: ${cloneResult.error}`, 'template_clone');
                controller.close();
                return;
              }

              // Emit template:complete event (without sandboxUrl - server not started yet)
              emit(createEvent('template:complete', {
                message: 'Template cloned successfully ✓',
                sandboxId: cloneResult.sandboxId,
              }));

              console.log(`[Generate] Template cloned: ${cloneResult.sandboxId} in ${cloneResult.duration}ms`);

              // REQUIREMENT 1.3: Create initial file_snapshot (turn_index 0) with template files
              if (Object.keys(cloneResult.files).length > 0) {
                const fileCount = Object.keys(cloneResult.files).length;
                const totalSize = Object.values(cloneResult.files).reduce((sum, f) => sum + f.size, 0);

                try {
                  await conversationContextService.saveSnapshot({
                    project_id: projectId,
                    turn_index: 0,
                    files_jsonb: cloneResult.files,
                    file_count: fileCount,
                    total_size_bytes: totalSize,
                  });

                  // Update latestSnapshot with the new template files
                  latestSnapshot = {
                    id: '',
                    project_id: projectId,
                    turn_index: 0,
                    files_jsonb: cloneResult.files,
                    file_count: fileCount,
                    total_size_bytes: totalSize,
                    created_at: new Date().toISOString(),
                  };

                  console.log(`[Generate] Initial snapshot created with ${fileCount} template files`);

                  // IMPORTANT: Write template files to the sandbox
                  // This ensures the files exist in the sandbox even if SDK couldn't read them
                  try {
                    const sandbox = await getWorkspace(cloneResult.sandboxId);
                    currentSandbox = sandbox; // Store for later use
                    const { writeSnapshotToDaytona, startPreviewServer } = await import('../../../src/lib/daytona-client');

                    emit(createEvent('status', {
                      message: `Writing ${fileCount} template files to sandbox...`
                    }));

                    const writeResult = await writeSnapshotToDaytona(sandbox, cloneResult.files);
                    console.log(`[Generate] Wrote ${writeResult.successCount}/${writeResult.totalFiles} template files to sandbox`);

                    if (writeResult.failureCount > 0) {
                      console.warn(`[Generate] ${writeResult.failureCount} template files failed to write`);
                    }

                    // START PREVIEW SERVER NOW - after files are written
                    emit(createEvent('preview:starting', {
                      message: 'Starting development server...',
                    }));

                    const previewResult = await startPreviewServer(sandbox);

                    if (previewResult.success) {
                      // NOW emit preview:ready with the actual working URL
                      emit(createEvent('preview:ready', {
                        message: 'Preview ready! ✓',
                        sandboxUrl: previewResult.previewUrl,
                      }));
                      console.log(`[Generate] Preview server started: ${previewResult.previewUrl}`);

                      // Update project with the working sandbox URL
                      try {
                        await supabaseServer
                          .from('projects')
                          .update({ sandbox_url: previewResult.previewUrl })
                          .eq('id', projectId);
                      } catch (updateError) {
                        console.error('[Generate] Error updating project sandbox URL:', updateError);
                      }
                    } else {
                      console.warn(`[Generate] Preview server failed to start: ${previewResult.error}`);
                      // Still update with the URL format (might work later)
                      try {
                        await supabaseServer
                          .from('projects')
                          .update({ sandbox_url: cloneResult.sandboxUrl })
                          .eq('id', projectId);
                      } catch (updateError) {
                        console.error('[Generate] Error updating project sandbox URL:', updateError);
                      }
                    }
                  } catch (writeError) {
                    console.warn('[Generate] Could not write template files to sandbox:', writeError);
                    // Continue anyway - files are in the snapshot
                  }
                } catch (snapshotError) {
                  console.error('[Generate] Error saving initial snapshot:', snapshotError);
                  // Continue anyway - we have the files in memory
                }
              }

            } catch (cloneError) {
              // REQUIREMENT 1.4: Handle clone errors
              const errorMessage = cloneError instanceof Error ? cloneError.message : 'Unknown error';
              emit(createEvent('clone:error', {
                message: `Template clone failed: ${errorMessage}. Please try again.`,
                error: errorMessage,
              }));
              emitError(`Template clone failed: ${errorMessage}`, 'template_clone');
              controller.close();
              return;
            }
          }

          // ============================================
          // REQUIREMENT 3.1, 3.2: Dependency Detection
          // Detect required packages from user prompt BEFORE code generation
          // ============================================

          // REQUIREMENT 5.1: Emit deps:analyzing event
          emit(createEvent('deps:analyzing', {
            message: 'Analyzing dependencies...',
          }));

          // REQUIREMENT 3.1: Detect packages from prompt
          const detectedDeps = detectFromPrompt(userMessage);
          const suggestions = suggestLibraries(userMessage);

          // Combine explicit and suggested packages
          const allDetectedPackages = [...detectedDeps.explicit, ...detectedDeps.suggested];

          // REQUIREMENT 3.2: Emit deps:detected event
          if (allDetectedPackages.length > 0) {
            emit(createEvent('deps:detected', {
              message: `Detected packages: ${allDetectedPackages.join(', ')}`,
              packages: allDetectedPackages,
            }));
            console.log(`[Generate] Detected packages: ${allDetectedPackages.join(', ')}`);
          } else {
            emit(createEvent('deps:detected', {
              message: 'No additional packages detected',
              packages: [],
            }));
          }

          // REQUIREMENT 9.1-9.9: Emit deps:suggested event for library suggestions
          if (suggestions.length > 0) {
            emit(createEvent('deps:suggested', {
              message: `Suggested: ${suggestions.map(s => `${s.name} for ${s.reason}`).join(', ')}`,
              suggestions: suggestions,
            }));
            console.log(`[Generate] Suggested libraries: ${suggestions.map(s => s.name).join(', ')}`);
          }

          // ============================================
          // REQUIREMENT 3.3, 3.4, 3.5, 3.6, 3.7: Package Installation
          // Filter out packages already in template and install missing ones
          // ============================================

          // Filter out packages already in template
          const packagesToInstall = allDetectedPackages.filter(pkg => !isPackageInTemplate(pkg));

          if (packagesToInstall.length > 0) {
            // REQUIREMENT 3.3: Install packages BEFORE code generation
            emit(createEvent('deps:installing', {
              message: `Installing ${packagesToInstall.length} package${packagesToInstall.length === 1 ? '' : 's'}...`,
              packages: packagesToInstall,
            }));

            console.log(`[Generate] Installing packages: ${packagesToInstall.join(', ')}`);

            // Get or create sandbox for package installation
            const installSandbox = currentSandbox || await getOrCreateSandbox(projectId);

            if (installSandbox) {
              try {
                // REQUIREMENT 3.5: Emit progress events for each package
                for (let i = 0; i < packagesToInstall.length; i++) {
                  const pkg = packagesToInstall[i];
                  emit(createEvent('deps:progress', {
                    message: `Installing ${pkg}...`,
                    currentPackage: pkg,
                    installedCount: i,
                    totalCount: packagesToInstall.length,
                    progress: Math.round((i / packagesToInstall.length) * 100),
                  }));
                }

                // REQUIREMENT 3.4: Run pnpm add <packages> in sandbox
                const installResult = await runPnpmInstall(installSandbox, packagesToInstall);

                if (!installResult.success) {
                  // REQUIREMENT 3.8: Emit error and do NOT proceed with code generation
                  emit(createEvent('deps:error', {
                    message: `Package installation failed: ${installResult.error}`,
                    error: installResult.error || 'Unknown error',
                    failedPackages: installResult.failed.map(f => f.name),
                  }));
                  emitError(`Package installation failed: ${installResult.error}`, 'deps_install');
                  controller.close();
                  return;
                }

                // REQUIREMENT 3.6: Emit deps:complete with installed packages
                emit(createEvent('deps:complete', {
                  message: 'Dependencies installed ✓',
                  installedPackages: installResult.installed,
                }));

                console.log(`[Generate] Installed ${installResult.installed.length} packages in ${installResult.duration}ms`);

              } catch (installError) {
                // REQUIREMENT 3.8: Handle install errors
                const errorMessage = installError instanceof Error ? installError.message : 'Unknown error';
                emit(createEvent('deps:error', {
                  message: `Package installation failed: ${errorMessage}`,
                  error: errorMessage,
                  failedPackages: packagesToInstall,
                }));
                emitError(`Package installation failed: ${errorMessage}`, 'deps_install');
                controller.close();
                return;
              }
            } else {
              console.warn('[Generate] No sandbox available for package installation, skipping...');
              // Emit deps:complete anyway to continue with generation
              emit(createEvent('deps:complete', {
                message: 'No sandbox available, skipping package installation',
                installedPackages: [],
              }));
            }
          } else {
            // No packages to install - emit deps:complete
            emit(createEvent('deps:complete', {
              message: 'No additional dependencies needed ✓',
              installedPackages: [],
            }));
          }

          // REQUIREMENT 5.5: Emit generate:start event AFTER deps are installed
          emit(createEvent('generate:start', {
            message: 'Generating code...',
          }));

          // REQUIREMENT 12.1, 12.2: Emit file:reading events
          const snapshotData = latestSnapshot?.files_jsonb as FileSnapshotData | null;
          const filePaths = snapshotData ? Object.keys(snapshotData) : [];

          for (const filePath of filePaths) {
            emit(createEvent('file:reading', {
              filePath,
              message: `Reading ${filePath}...`
            }));
          }

          // REQUIREMENT 12.3: Emit file:read:complete with count
          emit(createEvent('file:read:complete', {
            fileCount: filePaths.length,
            message: `Read ${filePaths.length} file(s) for context`
          }));

          // REQUIREMENT 2.3: Build LLM prompt with conversation history
          const conversationHistory = buildConversationHistory(messages);

          // REQUIREMENT 3.5: Include current file state
          const fileStateContext = buildFileStateContext(latestSnapshot);

          // Build the full prompt for the LLM
          const systemPrompt = buildSystemPrompt(fileStateContext);
          const fullPrompt = buildFullPrompt(systemPrompt, conversationHistory, userMessage);

          emit(createEvent('status', { message: 'Generating code...' }));

          // Create read tracker for read-before-write enforcement
          const readTracker = createReadTracker();

          // Create tool context for tool-enabled generation
          const toolStreamContext: ToolStreamContext = {
            projectId,
            snapshotData: snapshotData || {},
            readTracker,
            model,
          };

          // REQUIREMENT 1.1, 1.2, 11.3, 11.4, 11.5, 15.1-15.6: Stream LLM response with tools
          const llmResponse = await streamLLMResponse(
            fullPrompt,
            emit,
            requestStartTime,
            toolStreamContext
          );

          // REQUIREMENT 7.1, 7.2, 7.3, 7.4: Parse code blocks from response
          const { files: parsedFiles, errors: parseErrors } = parseCodeBlocks(llmResponse);

          if (parseErrors.length > 0) {
            console.warn('[Generate] Code block parsing warnings:', parseErrors);
          }

          // REQUIREMENT 3.3: Merge with existing snapshot
          const existingSnapshotData = snapshotData || {};
          const mergeResult = mergeSnapshots(
            existingSnapshotData,
            parsedFiles,
            userMessage.substring(0, 100) // Use first 100 chars as reason
          );

          // Get next turn index
          const turnIndex = await conversationContextService.getNextTurnIndex(projectId);

          // REQUIREMENT 5.1, 5.2, 5.3, 5.4, 5.5: Daytona sandbox integration
          // Write files to Daytona - store promise to await before closing
          const changedFiles = mergeResult.changes.map((c: FileChange) => c.file);
          if (changedFiles.length > 0) {
            // Store the promise so we can await it before closing the controller
            pendingDaytonaWrite = writeToDaytonaAsync(
              projectId,
              changedFiles,
              mergeResult.snapshot,
              emit
            );
          }

          // REQUIREMENT 2.1: Save conversation message to conversation_messages table
          try {
            await conversationContextService.saveMessage({
              project_id: projectId,
              user_message: userMessage,
              assistant_response: llmResponse,
              model: 'claude-3-5-sonnet',
            });
          } catch (saveError) {
            console.error('[Generate] Error saving conversation message:', saveError);
            // Continue - don't fail the whole request
          }

          // Create a version with the generated files
          const filesModifiedList = mergeResult.changes.map((c: FileChange) => c.file);
          let versionId: string | null = null;

          try {
            // Get next version number
            const { data: latestVersion } = await supabaseServer
              .from('versions')
              .select('version_number')
              .eq('project_id', projectId)
              .order('version_number', { ascending: false })
              .limit(1)
              .single();

            const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

            // Convert snapshot to version files format (just content strings)
            const versionFiles: Record<string, string> = {};
            Object.entries(mergeResult.snapshot).forEach(([path, data]) => {
              versionFiles[path] = data.content;
            });

            // Create version
            const { data: versionData, error: versionError } = await supabaseServer
              .from('versions')
              .insert({
                project_id: projectId,
                version_number: nextVersionNumber,
                name: `Update ${nextVersionNumber}`,
                description: userMessage.substring(0, 100),
                files: versionFiles,
                command_type: 'MODIFY',
                prompt: userMessage,
                status: 'complete',
                metadata: {
                  filesModified: filesModifiedList,
                  source: 'code_generation',
                },
              })
              .select('id')
              .single();

            if (versionError) {
              console.error('[Generate] Error creating version:', versionError);
            } else {
              versionId = versionData?.id;
              console.log('[Generate] Version created:', versionId);
            }
          } catch (versionError) {
            console.error('[Generate] Error creating version:', versionError);
          }

          // Save ONLY assistant response to messages table for chat UI display
          // NOTE: User message is already saved by tRPC router when project is created
          // Saving it again here causes duplicate display in chat UI
          const summaryMessage = filesModifiedList.length > 0
            ? `I've made the changes you requested. Modified ${filesModifiedList.length} file${filesModifiedList.length > 1 ? 's' : ''}:\n${filesModifiedList.map(f => `- ${f}`).join('\n')}\n\nThe changes have been applied to your project.`
            : 'I\'ve processed your request. Let me know if you need anything else!';

          try {
            // Save assistant summary message (clean, no code blocks) linked to version
            // User message is NOT saved here - it's already in the messages table from tRPC
            await supabaseServer
              .from('messages')
              .insert({
                project_id: projectId,
                content: summaryMessage,
                role: 'assistant',
                type: 'text',
                version_id: versionId,
              });

            console.log('[Generate] Assistant message saved to messages table with version_id:', versionId);
          } catch (msgError) {
            console.error('[Generate] Error saving to messages table:', msgError);
            // Continue - don't fail the whole request
          }

          // REQUIREMENT 3.1: Save file snapshot
          try {
            await conversationContextService.saveSnapshot({
              project_id: projectId,
              turn_index: turnIndex,
              files_jsonb: mergeResult.snapshot,
              file_count: mergeResult.fileCount,
              total_size_bytes: mergeResult.totalSizeBytes,
            });
          } catch (saveError) {
            console.error('[Generate] Error saving snapshot:', saveError);
            // Continue - don't fail the whole request
          }

          // REQUIREMENT 4.1: Save file changes
          try {
            await conversationContextService.saveChanges({
              project_id: projectId,
              turn_index: turnIndex,
              changes: mergeResult.changes as unknown as import('../../../src/types/database').Json,
              execution_status: 'success',
            });
          } catch (saveError) {
            console.error('[Generate] Error saving changes:', saveError);
            // Continue - don't fail the whole request
          }

          // REQUIREMENT 1.5: Send completion event with filesModified
          const filesModified = mergeResult.changes.map((c: FileChange) => c.file);
          emit(createEvent('complete', {
            filesModified,
            turnIndex,
            message: `Generated ${filesModified.length} file(s)`,
          }));

          console.log(`[Generate] Completed in ${(performance.now() - requestStartTime).toFixed(2)}ms`);

        } catch (error) {
          // REQUIREMENT 1.4: Handle errors gracefully
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          emitError(errorMessage, 'generation');
        } finally {
          // Wait for any pending Daytona write to complete before closing
          // This prevents "Controller is already closed" errors
          if (pendingDaytonaWrite) {
            try {
              await pendingDaytonaWrite;
            } catch (writeError) {
              console.warn('[Generate] Pending Daytona write failed:', writeError);
            }
          }
          // Mark controller as closed before actually closing
          isControllerOpen = false;
          controller.close();
        }
      },
    });

    // REQUIREMENT 1.3: Return streaming response with SSE headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('[Generate] Request error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * Build the system prompt with file state context
 * Uses the unified system prompt from src/prompts/system-prompt.txt
 */
function buildSystemPrompt(fileStateContext: string): string {
  // Load the unified system prompt from file
  const basePrompt = PromptLoader.loadUnifiedPrompt();

  // If prompt file couldn't be loaded, use a minimal fallback
  const systemPrompt = basePrompt || `You are an expert code generation assistant. You help developers build applications by generating high-quality code.

## Code Block Format
When generating code, use this format:
\`\`\`language file="path/to/file"
// Your code here
\`\`\`

## Guidelines
- Generate complete, working code - ALWAYS output the COMPLETE file content
- DO NOT use partial edit markers like \`// ... existing code ...\`
- Include ALL existing imports and code when modifying files
- Use TypeScript for type safety when appropriate
- Follow best practices for the framework being used`;

  return `${systemPrompt}

## Current Project State
${fileStateContext}`;
}

/**
 * Build the full prompt with conversation history
 */
function buildFullPrompt(
  systemPrompt: string,
  conversationHistory: string,
  userMessage: string
): string {
  let prompt = systemPrompt;

  if (conversationHistory) {
    prompt += `\n\n## Previous Conversation\n${conversationHistory}`;
  }

  prompt += `\n\n## Current Request\n${userMessage}`;

  return prompt;
}

/**
 * Context for tool-enabled LLM streaming
 */
interface ToolStreamContext {
  projectId: string;
  snapshotData: FileSnapshotData;
  readTracker: ReadTracker;
  model: AIModel;
}

/**
 * Stream LLM response with token forwarding and tool support
 * 
 * REQUIREMENTS: 1.1, 1.2, 11.3, 11.4, 11.5, 15.1-15.6
 * - Begin streaming within 200ms
 * - First token within 500ms
 * - Forward tokens within 10ms of receipt
 * - Emit events at minimum 50ms intervals
 * - Support tool calls and multi-turn tool usage
 */
async function streamLLMResponse(
  prompt: string,
  emit: (event: GenerateSSEEvent) => void,
  requestStartTime: number,
  toolContext?: ToolStreamContext
): Promise<string> {
  let accumulatedResponse = '';
  let firstTokenEmitted = false;
  let lastEmitTime = performance.now();
  let tokenBuffer = '';

  // Build messages array for multi-turn tool usage
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: prompt.split('\n\n## Current Request')[0] },
    { role: 'user', content: prompt.split('\n\n## Current Request\n')[1] || prompt },
  ];

  // Maximum tool call iterations to prevent infinite loops
  const MAX_TOOL_ITERATIONS = 10;
  let toolIterations = 0;

  // Determine which model to use
  const selectedModel = toolContext?.model || 'gpt-4o';
  const isGeminiModel = selectedModel.startsWith('gemini');

  try {
    // For Gemini models, use Google's API
    if (isGeminiModel) {
      return await streamGeminiResponse(
        prompt,
        emit,
        requestStartTime,
        selectedModel,
        toolContext
      );
    }

    while (toolIterations < MAX_TOOL_ITERATIONS) {
      // Map model names to OpenAI model IDs
      const openaiModel = selectedModel === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';

      // Call OpenAI with streaming and tools enabled
      const streamOptions: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
        model: openaiModel,
        messages,
        stream: true,
        temperature: 0.7,
      };

      // Add tools if context is provided
      if (toolContext) {
        streamOptions.tools = getToolDefinitions();
        streamOptions.tool_choice = 'auto';
      }

      const stream = await getOpenAIClient().chat.completions.create(streamOptions);

      // Collect tool calls during streaming
      const pendingToolCalls: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }> = [];
      let currentToolCallIndex = -1;
      let hasToolCalls = false;
      let iterationContent = '';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        // Handle content tokens
        const content = choice?.delta?.content;
        if (content) {
          const receiveTime = performance.now();
          accumulatedResponse += content;
          iterationContent += content;
          tokenBuffer += content;

          // REQUIREMENT 11.5: Forward tokens within 10ms of receipt
          // REQUIREMENT 11.4: Emit events at minimum 50ms intervals
          const timeSinceLastEmit = receiveTime - lastEmitTime;

          if (timeSinceLastEmit >= 50 || !firstTokenEmitted) {
            emit(createEvent('chunk', { content: tokenBuffer }));
            tokenBuffer = '';
            lastEmitTime = receiveTime;

            if (!firstTokenEmitted) {
              firstTokenEmitted = true;
              const firstTokenTime = receiveTime - requestStartTime;
              console.log(`[Generate] First token at ${firstTokenTime.toFixed(2)}ms`);
            }
          }
        }

        // Handle tool calls
        const toolCallDeltas = choice?.delta?.tool_calls;
        if (toolCallDeltas) {
          hasToolCalls = true;
          for (const toolCallDelta of toolCallDeltas) {
            if (toolCallDelta.index !== undefined) {
              if (toolCallDelta.index !== currentToolCallIndex) {
                currentToolCallIndex = toolCallDelta.index;
                pendingToolCalls[currentToolCallIndex] = {
                  id: toolCallDelta.id || '',
                  type: toolCallDelta.type || 'function',
                  function: {
                    name: toolCallDelta.function?.name || '',
                    arguments: toolCallDelta.function?.arguments || '',
                  },
                };
              } else {
                // Append to existing tool call
                const existing = pendingToolCalls[currentToolCallIndex];
                if (toolCallDelta.function?.arguments) {
                  existing.function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }
        }
      }

      // Emit any remaining buffered content
      if (tokenBuffer) {
        emit(createEvent('chunk', { content: tokenBuffer }));
        tokenBuffer = '';
      }

      // If no tool calls, we're done
      if (!hasToolCalls || pendingToolCalls.length === 0 || !toolContext) {
        break;
      }

      // Process tool calls
      toolIterations++;
      console.log(`[Generate] Processing ${pendingToolCalls.length} tool call(s), iteration ${toolIterations}`);

      // Add assistant message with tool calls to conversation
      messages.push({
        role: 'assistant',
        content: iterationContent || null,
        tool_calls: pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: tc.function,
        })),
      });

      // Parse and execute tool calls
      const parsedToolCalls = parseToolCalls(pendingToolCalls);
      const executionContext = createToolContext(toolContext.projectId, toolContext.snapshotData);

      // Emit tool:start events with taskNameActive from tool arguments (v0-style)
      for (const tc of parsedToolCalls) {
        const taskNameActive = (tc.arguments.taskNameActive as string) || `Executing ${tc.name}...`;
        emit(createEvent('tool:start', {
          tool: tc.name,
          taskNameActive,
          message: taskNameActive,
        }));
      }

      // Execute tools in parallel (Requirement 17.4)
      const toolResults = await executeToolCallsParallel(
        parsedToolCalls,
        executionContext,
        toolContext.readTracker
      );

      // Emit tool:complete events and add results to messages
      for (const result of toolResults) {
        emit(createEvent('tool:complete', {
          tool: result.toolCall.name,
          taskNameComplete: result.taskNameComplete,
          message: result.taskNameComplete,
        }));

        // Add tool result to conversation
        const formattedResult = formatToolResultForLLM(result);
        messages.push({
          role: 'tool',
          tool_call_id: result.toolCall.id,
          content: formattedResult,
        });

        // Add tool result to accumulated response for context
        accumulatedResponse += `\n\n[Tool ${result.toolCall.name} result: ${result.taskNameComplete}]\n`;
      }
    }

    if (toolIterations >= MAX_TOOL_ITERATIONS) {
      console.warn('[Generate] Max tool iterations reached');
      emit(createEvent('status', { message: 'Tool execution limit reached' }));
    }

  } catch (error) {
    console.error('[Generate] LLM streaming error:', error);

    // Fallback to placeholder response for testing/development
    if (process.env.NODE_ENV === 'development' || !process.env.OPENAI_API_KEY) {
      console.log('[Generate] Using placeholder response (no API key or dev mode)');
      return await streamPlaceholderResponse(emit, requestStartTime);
    }

    throw error;
  }

  return accumulatedResponse;
}

/**
 * Placeholder response for testing without API key
 */
async function streamPlaceholderResponse(
  emit: (event: GenerateSSEEvent) => void,
  requestStartTime: number
): Promise<string> {
  const placeholderResponse = `I'll help you with that request.

\`\`\`typescript file="src/example.ts"
// Example generated code
export function hello(): string {
  return "Hello, World!";
}
\`\`\`

This code creates a simple hello function.`;

  const tokens = placeholderResponse.split(' ');
  let accumulatedResponse = '';
  let lastEmitTime = performance.now();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] + (i < tokens.length - 1 ? ' ' : '');
    accumulatedResponse += token;

    const now = performance.now();
    const timeSinceLastEmit = now - lastEmitTime;

    if (timeSinceLastEmit >= 50 || i === 0) {
      emit(createEvent('chunk', { content: token }));
      lastEmitTime = now;

      if (i === 0) {
        const firstTokenTime = now - requestStartTime;
        console.log(`[Generate] First token at ${firstTokenTime.toFixed(2)}ms`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return accumulatedResponse;
}

/**
 * Stream response from Google Gemini models
 * 
 * Supports gemini-2.0-flash and gemini-1.5-pro models
 */
async function streamGeminiResponse(
  prompt: string,
  emit: (event: GenerateSSEEvent) => void,
  requestStartTime: number,
  modelId: AIModel,
  toolContext?: ToolStreamContext
): Promise<string> {
  let accumulatedResponse = '';
  let firstTokenEmitted = false;
  let lastEmitTime = performance.now();
  let tokenBuffer = '';

  // Map our model IDs to Gemini model names (all available with free API key from AI Studio)
  const geminiModelMap: Record<string, string> = {
    'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash': 'gemini-2.0-flash',
  };

  const geminiModelName = geminiModelMap[modelId] || 'gemini-2.0-flash';

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: geminiModelName });

    // Build the prompt for Gemini
    const systemPart = prompt.split('\n\n## Current Request')[0];
    const userPart = prompt.split('\n\n## Current Request\n')[1] || prompt;

    // Use generateContentStream for streaming
    const result = await model.generateContentStream([
      { text: `${systemPart}\n\nUser Request: ${userPart}` }
    ]);

    for await (const chunk of result.stream) {
      const content = chunk.text();
      if (content) {
        const receiveTime = performance.now();
        accumulatedResponse += content;
        tokenBuffer += content;

        // Forward tokens with timing requirements
        const timeSinceLastEmit = receiveTime - lastEmitTime;

        if (timeSinceLastEmit >= 50 || !firstTokenEmitted) {
          emit(createEvent('chunk', { content: tokenBuffer }));
          tokenBuffer = '';
          lastEmitTime = receiveTime;

          if (!firstTokenEmitted) {
            firstTokenEmitted = true;
            const firstTokenTime = receiveTime - requestStartTime;
            console.log(`[Generate] Gemini first token at ${firstTokenTime.toFixed(2)}ms`);
          }
        }
      }
    }

    // Emit any remaining buffered content
    if (tokenBuffer) {
      emit(createEvent('chunk', { content: tokenBuffer }));
    }

  } catch (error) {
    console.error('[Generate] Gemini streaming error:', error);

    // Fallback to placeholder if Gemini fails
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.log('[Generate] No Gemini API key, using placeholder');
      return await streamPlaceholderResponse(emit, requestStartTime);
    }

    throw error;
  }

  return accumulatedResponse;
}

/**
 * Handle lightweight API-only generation
 * 
 * Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 5.4, 5.5
 * - Skip template cloning for API-only requests
 * - Create standalone folder structure
 * - Emit lightweight API events (not template events)
 * - Generate API files directly
 * 
 * @param projectId - The project ID
 * @param userMessage - The user's prompt
 * @param modeResult - The generation mode detection result
 * @param emit - SSE event emitter function
 * @param emitError - Error emitter function
 * @param controller - ReadableStream controller
 * @param requestStartTime - Request start time for timing
 * @param model - AI model to use
 */
async function handleLightweightAPIGeneration(
  projectId: string,
  userMessage: string,
  modeResult: GenerationModeResult,
  emit: (event: GenerateSSEEvent) => void,
  emitError: (message: string, stage?: string) => void,
  controller: ReadableStreamDefaultController,
  requestStartTime: number,
  model: AIModel
): Promise<void> {
  const projectName = modeResult.suggestedProjectName;
  
  try {
    // REQUIREMENT 5.1: Emit api:started event (NOT scaffold:start or template:cloning)
    emit(createEvent('api:started', {
      message: `Creating ${projectName} project...`,
      projectName,
    }));
    console.log(`[Generate] Lightweight API started: ${projectName}`);

    // REQUIREMENT 5.1: Emit api:analyzing event
    emit(createEvent('api:analyzing', {
      message: 'Analyzing API requirements...',
    }));

    // REQUIREMENT 2.2, 2.3: Generate folder structure
    // Create folders BEFORE files (parents before children)
    const folders = generateFolderStructure(projectName);
    
    // REQUIREMENT 7.1: Get or create sandbox for folder creation
    // We need the sandbox early to create folders before file writing
    const sandbox = await getOrCreateSandbox(projectId);
    
    if (sandbox) {
      // REQUIREMENT 7.1: Create folders in sandbox BEFORE file writing
      // This ensures the folder structure exists before we try to write files
      console.log(`[Generate] Creating ${folders.length} folders in sandbox...`);
      const folderResult = await createFolders(sandbox, folders);
      
      // REQUIREMENT 5.2: Emit folder:created events for each successfully created folder
      for (const result of folderResult.results) {
        if (result.success) {
          emit(createEvent('folder:created', {
            path: result.path,
            message: `Created ${result.path}/`,
          }));
          console.log(`[Generate] Folder created in sandbox: ${result.path}`);
        } else {
          console.warn(`[Generate] Failed to create folder: ${result.path} - ${result.error}`);
        }
      }
      
      if (folderResult.failureCount > 0) {
        console.warn(`[Generate] ${folderResult.failureCount}/${folderResult.totalFolders} folders failed to create`);
      }
    } else {
      // No sandbox available - just emit events without actual folder creation
      console.warn('[Generate] No sandbox available, emitting folder events only');
      for (const folder of folders) {
        emit(createEvent('folder:created', {
          path: folder,
          message: `Created ${folder}/`,
        }));
        console.log(`[Generate] Folder event emitted (no sandbox): ${folder}`);
      }
    }

    // Generate initial project files (package.json, README, etc.)
    const apiProject = generateLightweightAPI({
      projectName,
      endpoints: [], // Endpoints will be determined by LLM
      includeOpenAPI: true,
      includeReadme: true,
    });

    // REQUIREMENT 5.5: Emit generate:start event AFTER folder structure is created
    emit(createEvent('generate:start', {
      message: 'Generating API code...',
    }));

    // Build the lightweight API system prompt
    const systemPrompt = buildLightweightAPIPrompt(projectName, folders);
    const fullPrompt = `${systemPrompt}\n\n## Current Request\n${userMessage}`;

    // Create read tracker for tool support
    const readTracker = createReadTracker();

    // Create tool context for lightweight mode
    const toolStreamContext: ToolStreamContext = {
      projectId,
      snapshotData: {}, // Start with empty snapshot for lightweight mode
      readTracker,
      model,
    };

    // Stream LLM response to generate API code
    const llmResponse = await streamLLMResponse(
      fullPrompt,
      emit,
      requestStartTime,
      toolStreamContext
    );

    // Parse code blocks from response
    const { files: parsedFiles, errors: parseErrors } = parseCodeBlocks(llmResponse);

    if (parseErrors.length > 0) {
      console.warn('[Generate] Code block parsing warnings:', parseErrors);
    }

    // Merge generated files with initial project files
    const initialFiles: FileSnapshotData = {};
    
    // Add initial project files to snapshot
    for (const file of apiProject.files) {
      // Determine language from file extension
      const ext = file.path.split('.').pop() || '';
      const languageMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
      };
      const language = languageMap[ext] || 'plaintext';
      
      initialFiles[file.path] = {
        content: file.content,
        size: file.content.length,
        language,
      };
    }

    // Merge with LLM-generated files
    const mergeResult = mergeSnapshots(
      initialFiles,
      parsedFiles,
      userMessage.substring(0, 100)
    );

    // Get next turn index
    const turnIndex = await conversationContextService.getNextTurnIndex(projectId);

    // REQUIREMENT 7.2: Write files to Daytona sandbox with correct paths
    // Reuse the sandbox we obtained earlier for folder creation
    const changedFiles = mergeResult.changes.map((c: FileChange) => c.file);
    
    if (changedFiles.length > 0 && sandbox) {
      // Write files to sandbox - folders were already created above
      const { writeSnapshotToDaytona } = await import('../../../src/lib/daytona-client');
      
      emit(createEvent('status', {
        message: `Writing ${changedFiles.length} files to sandbox...`,
      }));

      const writeResult = await writeSnapshotToDaytona(sandbox, mergeResult.snapshot);
      console.log(`[Generate] Wrote ${writeResult.successCount}/${writeResult.totalFiles} files to sandbox`);

      // REQUIREMENT 5.3: Emit file:created events with paths for each written file
      for (const fileResult of writeResult.results) {
        if (fileResult.success) {
          // Extract filename from path for display
          const filename = fileResult.path.split('/').pop() || fileResult.path;
          emit(createEvent('file:complete', {
            filename: filename,
            filePath: fileResult.path,
            message: `Created ${fileResult.path}`,
          }));
          console.log(`[Generate] File created: ${fileResult.path}`);
        } else {
          console.warn(`[Generate] Failed to write file: ${fileResult.path} - ${fileResult.error}`);
        }
      }
      
      if (writeResult.failureCount > 0) {
        console.warn(`[Generate] ${writeResult.failureCount}/${writeResult.totalFiles} files failed to write`);
      }
    } else if (changedFiles.length > 0) {
      console.warn('[Generate] No sandbox available for file writing');
    }

    // Save conversation message
    try {
      await conversationContextService.saveMessage({
        project_id: projectId,
        user_message: userMessage,
        assistant_response: llmResponse,
        model: model,
      });
    } catch (saveError) {
      console.error('[Generate] Error saving conversation message:', saveError);
    }

    // Create version with generated files
    const filesModifiedList = mergeResult.changes.map((c: FileChange) => c.file);
    let versionId: string | null = null;

    try {
      const { data: latestVersion } = await supabaseServer
        .from('versions')
        .select('version_number')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

      const versionFiles: Record<string, string> = {};
      Object.entries(mergeResult.snapshot).forEach(([path, data]) => {
        versionFiles[path] = data.content;
      });

      const { data: versionData, error: versionError } = await supabaseServer
        .from('versions')
        .insert({
          project_id: projectId,
          version_number: nextVersionNumber,
          name: `API ${nextVersionNumber}`,
          description: userMessage.substring(0, 100),
          files: versionFiles,
          command_type: 'CREATE',
          prompt: userMessage,
          status: 'complete',
          metadata: {
            filesModified: filesModifiedList,
            source: 'lightweight_api_generation',
            generationMode: 'LIGHTWEIGHT_API',
            projectName,
          },
        })
        .select('id')
        .single();

      if (versionError) {
        console.error('[Generate] Error creating version:', versionError);
      } else {
        versionId = versionData?.id;
        console.log('[Generate] Version created:', versionId);
      }
    } catch (versionError) {
      console.error('[Generate] Error creating version:', versionError);
    }

    // Save assistant message
    const summaryMessage = filesModifiedList.length > 0
      ? `I've created your ${projectName} API project with ${filesModifiedList.length} file${filesModifiedList.length > 1 ? 's' : ''}:\n${filesModifiedList.map(f => `- ${f}`).join('\n')}\n\nThe API is ready for development.`
      : 'I\'ve processed your API request. Let me know if you need anything else!';

    try {
      await supabaseServer
        .from('messages')
        .insert({
          project_id: projectId,
          content: summaryMessage,
          role: 'assistant',
          type: 'text',
          version_id: versionId,
        });
    } catch (msgError) {
      console.error('[Generate] Error saving to messages table:', msgError);
    }

    // Save file snapshot
    try {
      await conversationContextService.saveSnapshot({
        project_id: projectId,
        turn_index: turnIndex,
        files_jsonb: mergeResult.snapshot,
        file_count: mergeResult.fileCount,
        total_size_bytes: mergeResult.totalSizeBytes,
      });
    } catch (saveError) {
      console.error('[Generate] Error saving snapshot:', saveError);
    }

    // Save file changes
    try {
      await conversationContextService.saveChanges({
        project_id: projectId,
        turn_index: turnIndex,
        changes: mergeResult.changes as unknown as import('../../../src/types/database').Json,
        execution_status: 'success',
      });
    } catch (saveError) {
      console.error('[Generate] Error saving changes:', saveError);
    }

    // REQUIREMENT 5.4: Emit api:complete event with file count
    emit(createEvent('api:complete', {
      message: 'API project created!',
      filesCreated: filesModifiedList.length,
      projectName,
    }));

    // Also emit standard complete event for compatibility
    emit(createEvent('complete', {
      filesModified: filesModifiedList,
      turnIndex,
      message: `Created ${filesModifiedList.length} file(s) for ${projectName}`,
    }));

    console.log(`[Generate] Lightweight API completed in ${(performance.now() - requestStartTime).toFixed(2)}ms`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    emitError(errorMessage, 'lightweight_api_generation');
  } finally {
    controller.close();
  }
}

/**
 * Build system prompt for lightweight API generation
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * - Generate route files, types, OpenAPI spec, and README
 * - Do NOT generate Next.js config, React components, CSS files
 * - Include validation, error handling, and TypeScript types
 * - Place OpenAPI spec in docs/openapi.yaml
 * 
 * @param projectName - The project name
 * @param folders - The folder structure
 * @returns System prompt for lightweight API generation
 */
function buildLightweightAPIPrompt(projectName: string, folders: string[]): string {
  return `You are an expert API code generation assistant. You are generating a LIGHTWEIGHT API-ONLY project.

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL: LIGHTWEIGHT API MODE - NO FRONTEND CODE ⚠️
═══════════════════════════════════════════════════════════════════════════════

You are generating a STANDALONE API project. DO NOT generate:
- ❌ Next.js configuration files (next.config.js, next.config.mjs)
- ❌ React components
- ❌ CSS/SCSS files
- ❌ Frontend pages
- ❌ app/ directory structure (this is NOT a Next.js project)

You MUST generate:
- ✅ API route handlers in src/routes/
- ✅ TypeScript types and Zod schemas in types/
- ✅ OpenAPI 3.1 specification in docs/openapi.yaml
- ✅ README.md with usage examples

═══════════════════════════════════════════════════════════════════════════════
PROJECT STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

The following folder structure has been created:
${folders.map(f => `- ${f}/`).join('\n')}

Place your files in the appropriate folders:
- Route handlers: ${projectName}/src/routes/
- TypeScript types: ${projectName}/types/
- OpenAPI spec: ${projectName}/docs/openapi.yaml
- Documentation: ${projectName}/docs/README.md or ${projectName}/README.md

═══════════════════════════════════════════════════════════════════════════════
CODE BLOCK FORMAT
═══════════════════════════════════════════════════════════════════════════════

When generating code, use this EXACT format:

\`\`\`typescript file="${projectName}/src/routes/example.ts"
// Your route code here
\`\`\`

\`\`\`typescript file="${projectName}/types/example.ts"
// Your types here
\`\`\`

\`\`\`yaml file="${projectName}/docs/openapi.yaml"
# Your OpenAPI spec here
\`\`\`

═══════════════════════════════════════════════════════════════════════════════
API ROUTE TEMPLATE
═══════════════════════════════════════════════════════════════════════════════

Use this pattern for route handlers:

\`\`\`typescript file="${projectName}/src/routes/[resource].ts"
import { z } from 'zod';

// Validation schemas
const createSchema = z.object({
  // Define your schema
});

// Types
export type CreateInput = z.infer<typeof createSchema>;

// Route handlers
export async function GET(request: Request) {
  // List resources
}

export async function POST(request: Request) {
  // Create resource
  const body = await request.json();
  const result = createSchema.safeParse(body);
  
  if (!result.success) {
    return new Response(JSON.stringify({
      error: 'ValidationError',
      details: result.error.errors,
    }), { status: 400 });
  }
  
  // Process request...
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════
OPENAPI 3.1 SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════

Always generate a complete OpenAPI 3.1 spec in docs/openapi.yaml:

\`\`\`yaml file="${projectName}/docs/openapi.yaml"
openapi: 3.1.0
info:
  title: ${projectName}
  version: 1.0.0
  description: API generated by SmartAPIForge

servers:
  - url: http://localhost:3000
    description: Development server

paths:
  # Define all endpoints here

components:
  schemas:
    # Define all schemas here
\`\`\`

═══════════════════════════════════════════════════════════════════════════════
REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

1. Generate COMPLETE, working code - no placeholders
2. Include Zod validation for all inputs
3. Include proper error handling with status codes
4. Export TypeScript types for all data structures
5. Document all endpoints in OpenAPI spec
6. Include example values in OpenAPI spec
7. Create a README with usage examples`;
}

/**
 * GET handler for SSE connection health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Generate API is ready. Use POST to generate code.',
  });
}
