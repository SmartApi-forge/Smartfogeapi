// Event types for streaming API generation progress

export type StreamEvent =
  | {
      type: 'project:created';
      projectId: string;
      prompt: string;
    }
  | {
      type: 'version:created';
      versionId: string;
      versionNumber: number;
      versionName: string;
    }
  | {
      type: 'version:start';
      versionId: string;
      versionNumber: number;
      versionName: string;
      projectId: string;
    }
  | {
      type: 'version:complete';
      versionId: string;
      versionNumber: number;
      versionName: string;
      totalFiles: number;
      projectId: string;
    }
  | {
      type: 'step:start';
      step: string;
      message: string;
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

