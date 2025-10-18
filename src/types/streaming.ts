// Event types for streaming API generation progress

export type StreamEvent =
  | {
      type: "project:created";
      projectId: string;
      prompt: string;
    }
  | {
      type: "version:start";
      versionId: string;
      versionNumber: number;
      versionName: string;
      projectId: string;
    }
  | {
      type: "version:complete";
      versionId: string;
      versionNumber: number;
      versionName: string;
      totalFiles: number;
      projectId: string;
    }
  | {
      type: "step:start";
      step: string;
      message: string;
      versionId?: string;
    }
  | {
      type: "step:complete";
      step: string;
      message: string;
      versionId?: string;
    }
  | {
      type: "file:generating";
      filename: string;
      path: string;
      versionId?: string;
    }
  | {
      type: "code:chunk";
      filename: string;
      chunk: string;
      progress: number; // 0-100
      versionId?: string;
    }
  | {
      type: "file:complete";
      filename: string;
      content: string;
      path: string;
      versionId?: string;
    }
  | {
      type: "validation:start";
      stage: string;
      versionId?: string;
    }
  | {
      type: "validation:complete";
      stage: string;
      result?: boolean;
      message?: string;
      summary?: string;
      versionId?: string;
    }
  | {
      type: "complete";
      summary: string;
      totalFiles: number;
      versionId?: string;
    }
  | {
      type: "error";
      message: string;
      stage?: string;
      versionId?: string;
    };

export type StreamEventWithTimestamp = StreamEvent & {
  timestamp: number;
};

export interface GenerationState {
  status:
    | "idle"
    | "initializing"
    | "generating"
    | "validating"
    | "complete"
    | "error";
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
