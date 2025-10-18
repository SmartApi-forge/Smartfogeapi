"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GenerationState,
  StreamEventWithTimestamp,
} from "../src/types/streaming";

export interface UseGenerationStreamResult extends GenerationState {
  isStreaming: boolean;
  isConnected: boolean;
  reconnect: () => void;
  currentVersionId?: string;
  currentVersionNumber?: number;
}

/**
 * React hook for consuming Server-Sent Events from API generation
 * Provides real-time updates on generation progress, files, and code chunks
 */
export function useGenerationStream(
  projectId: string | undefined,
): UseGenerationStreamResult {
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    generatedFiles: [],
    events: [] as StreamEventWithTimestamp[],
  });

  const [isConnected, setIsConnected] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | undefined>(
    undefined,
  );
  const [currentVersionNumber, setCurrentVersionNumber] = useState<
    number | undefined
  >(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    if (!projectId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log(
      `[useGenerationStream] Connecting to stream for project ${projectId}`,
    );

    const eventSource = new EventSource(`/api/stream/${projectId}`);
    eventSourceRef.current = eventSource;

    // Track active streaming session globally to prevent view transitions during streaming
    if (typeof window !== "undefined") {
      (window as any).__activeStreamingSessions =
        ((window as any).__activeStreamingSessions || 0) + 1;
    }

    eventSource.onopen = () => {
      console.log(`[useGenerationStream] Connected to stream`);
      setIsConnected(true);

      // Clear any pending reconnect attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    eventSource.addEventListener("message", (event) => {
      try {
        const streamEvent: StreamEventWithTimestamp = JSON.parse(event.data);
        console.log(`[useGenerationStream] Received event:`, streamEvent.type);

        setState((prevState: GenerationState): GenerationState => {
          const newState: GenerationState = { ...prevState };

          // Add event to history
          newState.events = [...prevState.events, streamEvent];

          // Track version ID from any event that includes it
          if ("versionId" in streamEvent && streamEvent.versionId) {
            setCurrentVersionId(streamEvent.versionId);
          }

          // Update state based on event type
          switch (streamEvent.type) {
            case "project:created":
              newState.status = "initializing";
              break;

            case "step:start":
              newState.currentStep = streamEvent.message;
              if (streamEvent.step.toLowerCase().includes("generat")) {
                newState.status = "generating";
              } else if (streamEvent.step.toLowerCase().includes("validat")) {
                newState.status = "validating";
              }
              break;

            case "step:complete":
              // Keep current status until next step starts
              break;

            case "file:generating":
              newState.currentFile = streamEvent.filename;
              newState.status = "generating";

              // Add file to generatedFiles if not already present
              const existingFileIndex = newState.generatedFiles.findIndex(
                (f: { filename: string }) =>
                  f.filename === streamEvent.filename,
              );

              if (existingFileIndex === -1) {
                newState.generatedFiles = [
                  ...newState.generatedFiles,
                  {
                    filename: streamEvent.filename,
                    path: streamEvent.path,
                    content: "",
                    isComplete: false,
                  },
                ];
              }
              break;

            case "code:chunk":
              // Update file content with new chunk
              newState.generatedFiles = newState.generatedFiles.map(
                (file: {
                  filename: string;
                  content: string;
                  path: string;
                  isComplete: boolean;
                }) => {
                  if (file.filename === streamEvent.filename) {
                    return {
                      ...file,
                      content: file.content + streamEvent.chunk,
                    };
                  }
                  return file;
                },
              );
              break;

            case "file:complete":
              // Mark file as complete
              newState.generatedFiles = newState.generatedFiles.map(
                (file: {
                  filename: string;
                  content: string;
                  path: string;
                  isComplete: boolean;
                }) => {
                  if (file.filename === streamEvent.filename) {
                    return {
                      ...file,
                      content: streamEvent.content,
                      isComplete: true,
                    };
                  }
                  return file;
                },
              );

              // Check if this is a new file that wasn't streamed
              const fileExists = newState.generatedFiles.some(
                (f: { filename: string }) =>
                  f.filename === streamEvent.filename,
              );

              if (!fileExists) {
                newState.generatedFiles = [
                  ...newState.generatedFiles,
                  {
                    filename: streamEvent.filename,
                    path: streamEvent.path,
                    content: streamEvent.content,
                    isComplete: true,
                  },
                ];
              }
              break;

            case "validation:start":
              newState.status = "validating";
              newState.currentStep = streamEvent.stage;
              break;

            case "validation:complete":
              // Keep validating status until complete event
              break;

            case "complete":
              newState.status = "complete";
              newState.currentStep = streamEvent.summary;
              newState.currentFile = undefined;

              // Decrement active streaming sessions counter when generation completes
              if (typeof window !== "undefined") {
                (window as any).__activeStreamingSessions = Math.max(
                  0,
                  ((window as any).__activeStreamingSessions || 1) - 1,
                );
              }
              break;

            case "error":
              newState.status = "error";
              newState.error = streamEvent.message;
              newState.currentStep = undefined;
              newState.currentFile = undefined;

              // Decrement active streaming sessions counter when error occurs
              if (typeof window !== "undefined") {
                (window as any).__activeStreamingSessions = Math.max(
                  0,
                  ((window as any).__activeStreamingSessions || 1) - 1,
                );
              }
              break;
          }

          return newState;
        });
      } catch (error) {
        console.error("[useGenerationStream] Error parsing event:", error);
      }
    });

    eventSource.addEventListener("close", () => {
      console.log(`[useGenerationStream] Stream closed by server`);
      setIsConnected(false);
      eventSource.close();

      // Decrement active streaming sessions counter
      if (typeof window !== "undefined") {
        (window as any).__activeStreamingSessions = Math.max(
          0,
          ((window as any).__activeStreamingSessions || 1) - 1,
        );
      }
    });

    eventSource.onerror = (error) => {
      console.error("[useGenerationStream] Stream error:", error);
      setIsConnected(false);
      eventSource.close();

      // Decrement active streaming sessions counter
      if (typeof window !== "undefined") {
        (window as any).__activeStreamingSessions = Math.max(
          0,
          ((window as any).__activeStreamingSessions || 1) - 1,
        );
      }

      // Attempt to reconnect after 5 seconds if not complete or error
      if (state.status !== "complete" && state.status !== "error") {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[useGenerationStream] Attempting to reconnect...");
          connect();
        }, 5000);
      }
    };
  }, [projectId, state.status]);

  useEffect(() => {
    if (projectId) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();

        // Decrement active streaming sessions counter on cleanup
        if (typeof window !== "undefined") {
          (window as any).__activeStreamingSessions = Math.max(
            0,
            ((window as any).__activeStreamingSessions || 1) - 1,
          );
        }
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [projectId, connect]);

  return {
    ...state,
    isStreaming:
      state.status !== "idle" &&
      state.status !== "complete" &&
      state.status !== "error",
    isConnected,
    reconnect: connect,
    currentVersionId,
    currentVersionNumber,
  };
}
