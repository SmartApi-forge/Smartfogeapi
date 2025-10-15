// Event types for streaming API generation progress

export type StreamEvent =
  | {
      type: 'project:created';
      projectId: string;
      prompt: string;
    }
  | {
      type: 'step:start';
      step: string;
      message: string;
    }
  | {
      type: 'step:complete';
      step: string;
      message: string;
    }
  | {
      type: 'file:generating';
      filename: string;
      path: string;
    }
  | {
      type: 'code:chunk';
      filename: string;
      chunk: string;
      progress: number; // 0-100
    }
  | {
      type: 'file:complete';
      filename: string;
      content: string;
      path: string;
    }
  | {
      type: 'validation:start';
      stage: string;
    }
  | {
      type: 'validation:complete';
      stage: string;
      result?: boolean;
      message?: string;
      summary?: string;
    }
  | {
      type: 'complete';
      summary: string;
      totalFiles: number;
    }
  | {
      type: 'error';
      message: string;
      stage?: string;
    };

export type StreamEventWithTimestamp = StreamEvent & {
  timestamp: number;
};

export interface GenerationState {
  status: 'idle' | 'initializing' | 'generating' | 'validating' | 'complete' | 'error';
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

