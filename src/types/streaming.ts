// Event types for streaming API generation progress
// Simplified for V0/Lovable architecture - removed unused version events

/**
 * Suggested library information for smart library suggestions
 * Requirements: 9.1-9.9
 */
export interface SuggestedLibrary {
  name: string;
  reason: string;
  keywords: string[];
}

export type StreamEvent =
  | {
      // Legacy event types - kept for backward compatibility
      type: 'project:created';
      projectId: string;
      prompt: string;
    }
  | {
      type: 'step:start';
      step: string;
      message: string;
      versionId?: string;
    }
  // ============================================
  // Scaffolding SSE Events
  // Requirements: 5.1-5.8 (Generation Progress Tracking)
  // ============================================
  | {
      // Emitted when scaffolding process begins
      // Requirements: 5.1
      type: 'scaffold:start';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when template cloning begins
      // Requirements: 1.1
      type: 'template:cloning';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when template cloning completes
      // Requirements: 1.2
      type: 'template:complete';
      message: string;
      sandboxId?: string;
      sandboxUrl?: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when analyzing prompt for dependencies
      // Requirements: 5.1
      type: 'deps:analyzing';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when packages are detected from prompt
      // Requirements: 5.2, 3.2
      type: 'deps:detected';
      message: string;
      packages: string[];
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when libraries are suggested based on context
      // Requirements: 9.1-9.9
      type: 'deps:suggested';
      message: string;
      suggestions: SuggestedLibrary[];
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when package installation begins
      // Requirements: 5.3
      type: 'deps:installing';
      message: string;
      packages: string[];
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted during package installation progress
      // Requirements: 5.3, 3.5
      type: 'deps:progress';
      message: string;
      currentPackage: string;
      installedCount: number;
      totalCount: number;
      progress: number; // 0-100
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when all dependencies are installed
      // Requirements: 5.4, 3.6
      type: 'deps:complete';
      message: string;
      packages: Array<{ name: string; version: string }>;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when dependency installation fails
      // Requirements: 3.8
      type: 'deps:error';
      message: string;
      error: string;
      failedPackages?: string[];
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when code generation starts (after deps installed)
      // Requirements: 5.5
      type: 'generate:start';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when preview server is starting
      // Requirements: 5.7
      type: 'preview:starting';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      type: 'step:complete';
      step: string;
      message: string;
      versionId?: string;
    }
  | {
      type: 'file:generating';
      filename: string;
      path: string;
      versionId?: string;
    }
  | {
      type: 'code:chunk';
      filename: string;
      chunk: string;
      progress: number; // 0-100
      versionId?: string;
    }
  | {
      type: 'file:complete';
      filename: string;
      content: string;
      path: string;
      versionId?: string;
    }
  | {
      type: 'validation:start';
      stage: string;
      versionId?: string;
    }
  | {
      type: 'validation:complete';
      stage: string;
      result?: boolean;
      message?: string;
      summary?: string;
      versionId?: string;
    }
  | {
      type: 'complete';
      summary: string;
      totalFiles: number;
      versionId?: string;
      sandboxUrl?: string; // For GitHub integration sandbox URL
      previewUrl?: string; // For GitHub integration preview (deprecated - use sandboxUrl)
    }
  | {
      type: 'error';
      message: string;
      stage?: string;
      versionId?: string;
    }
  | {
      type: 'warning';
      message: string;
      versionId?: string;
    }
  | {
      type: 'info';
      message: string;
      versionId?: string;
    }
  | {
      type: 'step:progress';
      step: string;
      progress: number;
      message?: string;
      versionId?: string;
    }
  | {
      type: 'server:restarting';
      message: string;
      versionId?: string;
    }
  | {
      type: 'server:ready';
      message: string;
      previewUrl?: string;
      versionId?: string;
    }
  | {
      type: 'sandbox:sync:start';
      fileCount: number;
      message: string;
      versionId?: string;
    }
  | {
      type: 'sandbox:sync:progress';
      syncedCount: number;
      totalCount: number;
      currentFile: string;
      progress: number; // 0-100
      versionId?: string;
    }
  | {
      type: 'sandbox:sync:complete';
      syncedFiles: string[];
      failedFiles: string[];
      duration: number;
      message: string;
      versionId?: string;
    }
  | {
      type: 'sandbox:sync:error';
      message: string;
      failedFiles: string[];
      recoverySuggestions: string[];
      versionId?: string;
    }
  | {
      type: 'preview:updating';
      message: string;
      versionId?: string;
    }
  | {
      type: 'preview:ready';
      previewUrl: string;
      message: string;
      versionId?: string;
    }
  // Tool SSE events for AI tool system (v0-style)
  // Requirements: 15.5, 15.6
  | {
      type: 'tool:start';
      tool: string;
      taskNameActive: string;
      parameters?: Record<string, unknown>;
      versionId?: string;
    }
  | {
      type: 'tool:complete';
      tool: string;
      taskNameComplete: string;
      result?: unknown;
      versionId?: string;
    }
  | {
      type: 'tool:error';
      tool: string;
      error: string;
      versionId?: string;
    }
  // ============================================
  // Lightweight API Generation SSE Events
  // Requirements: 5.1-5.5 (Lightweight API Generation)
  // ============================================
  | {
      // Emitted when lightweight API generation starts
      // Requirements: 5.1
      type: 'api:started';
      message: string;
      projectName: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when analyzing API requirements
      // Requirements: 5.1
      type: 'api:analyzing';
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when a folder is created in lightweight mode
      // Requirements: 5.2
      type: 'folder:created';
      path: string;
      message: string;
      timestamp: number;
      versionId?: string;
    }
  | {
      // Emitted when lightweight API generation completes
      // Requirements: 5.4
      type: 'api:complete';
      message: string;
      filesCreated: number;
      projectName: string;
      timestamp: number;
      versionId?: string;
    };

export type StreamEventWithTimestamp = StreamEvent & {
  timestamp: number;
};

export interface GenerationState {
  status: 'idle' | 'initializing' | 'generating' | 'validating' | 'syncing' | 'complete' | 'error';
  currentStep?: string;
  currentFile?: string;
  generatedFiles: GeneratedFile[];
  events: StreamEventWithTimestamp[];
  error?: string;
}

export interface GeneratedFile {
  filename: string;
  path: string;
  content: string;
  isComplete: boolean;
}

