'use client';

/**
 * Chat Stream Hook
 * 
 * Connects to the direct streaming API for millisecond-level chat responses.
 * Handles SSE connection with fast reconnection support.
 * 
 * Requirements: 2.1, 4.1, 4.5
 * - Replace Inngest-based streaming with direct API
 * - Handle SSE connection with fast reconnection (within 100ms)
 * - Display thinking indicator immediately
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  ChatStreamEvent, 
  ChatMode, 
  Attachment, 
  ChatMessage,
  ContextSource,
  FileReadingEvent,
} from '@/src/types/chat-ux';

/**
 * Stream state for tracking connection and events
 */
export interface ChatStreamState {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Whether thinking indicator should be shown */
  isThinking: boolean;
  /** Whether files are being read for context */
  isReadingFiles: boolean;
  /** Current streaming content */
  content: string;
  /** File reading events */
  fileReadingEvents: FileReadingEvent[];
  /** Context sources from RAG retrieval */
  contextSources: ContextSource[];
  /** Token count used for context */
  contextTokenCount: number;
  /** Whether context was truncated */
  contextTruncated: boolean;
  /** Error message if any */
  error: string | null;
  /** Connection status */
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  /** Reconnection attempts */
  reconnectAttempts: number;
}

/**
 * Options for the chat stream hook
 */
export interface UseChatStreamOptions {
  /** Project ID for the chat */
  projectId: string;
  /** Callback when streaming completes */
  onComplete?: (content: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms (default: 100ms per requirement 4.5) */
  reconnectDelay?: number;
}

const initialState: ChatStreamState = {
  isStreaming: false,
  isThinking: false,
  isReadingFiles: false,
  content: '',
  fileReadingEvents: [],
  contextSources: [],
  contextTokenCount: 0,
  contextTruncated: false,
  error: null,
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
};

/**
 * Hook for connecting to the direct streaming chat API
 * 
 * Usage:
 * ```tsx
 * const { state, sendMessage, abort } = useChatStream({
 *   projectId: 'xxx',
 *   onComplete: (content) => console.log('Done:', content),
 * });
 * 
 * // Send a message
 * await sendMessage('Hello', 'ask', []);
 * ```
 */
export function useChatStream({
  projectId,
  onComplete,
  onError,
  maxReconnectAttempts = 3,
  reconnectDelay = 100, // Requirement 4.5: reconnect within 100ms
}: UseChatStreamOptions) {
  const [state, setState] = useState<ChatStreamState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Process a stream event and update state
   */
  const processEvent = useCallback((event: ChatStreamEvent) => {
    setState(prev => {
      switch (event.type) {
        case 'thinking':
          return {
            ...prev,
            isThinking: true,
          };

        case 'file:reading':
          return {
            ...prev,
            isReadingFiles: true,
            fileReadingEvents: [
              ...prev.fileReadingEvents,
              {
                type: 'file:reading' as const,
                filePath: event.filePath,
                timestamp: event.timestamp,
              },
            ],
          };

        case 'file:read:complete':
          return {
            ...prev,
            isReadingFiles: false,
            fileReadingEvents: [
              ...prev.fileReadingEvents,
              {
                type: 'file:read:complete' as const,
                fileCount: event.fileCount,
                timestamp: event.timestamp,
              },
            ],
          };

        case 'context:building':
          return {
            ...prev,
            isThinking: true,
          };

        case 'context:retrieved':
          return {
            ...prev,
            contextSources: event.sources,
            contextTokenCount: event.tokenCount,
            contextTruncated: event.truncated,
          };

        case 'text:chunk':
          return {
            ...prev,
            isThinking: false,
            content: prev.content + event.content,
          };

        case 'message:saved':
          return {
            ...prev,
            isStreaming: false,
          };

        default:
          return prev;
      }
    });
  }, []);

  /**
   * Send a message and start streaming response
   */
  const sendMessage = useCallback(async (
    prompt: string,
    mode: ChatMode,
    attachments: Attachment[],
    conversationHistory: ChatMessage[] = []
  ) => {
    // Abort any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Reset state and show thinking immediately (Requirement 2.1)
    setState({
      ...initialState,
      isStreaming: true,
      isThinking: true,
      connectionStatus: 'connecting',
    });

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          prompt,
          mode,
          attachments,
          conversationHistory,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      setState(prev => ({
        ...prev,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              processEvent(eventData);
            } catch (e) {
              // Ignore parse errors for malformed events
              console.warn('[ChatStream] Failed to parse event:', line);
            }
          }
        }
      }

      // Streaming complete
      setState(prev => {
        onComplete?.(prev.content);
        return {
          ...prev,
          isStreaming: false,
          isThinking: false,
          connectionStatus: 'disconnected',
        };
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User aborted, don't treat as error
        setState(prev => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          connectionStatus: 'disconnected',
        }));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Attempt reconnection (Requirement 4.5)
      setState(prev => {
        if (prev.reconnectAttempts < maxReconnectAttempts) {
          // Schedule reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            sendMessage(prompt, mode, attachments, conversationHistory);
          }, reconnectDelay);

          return {
            ...prev,
            connectionStatus: 'connecting',
            reconnectAttempts: prev.reconnectAttempts + 1,
          };
        }

        // Max attempts reached
        onError?.(errorMessage);
        return {
          ...prev,
          isStreaming: false,
          isThinking: false,
          error: errorMessage,
          connectionStatus: 'disconnected',
        };
      });
    }
  }, [projectId, processEvent, onComplete, onError, maxReconnectAttempts, reconnectDelay]);

  /**
   * Abort the current stream
   */
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
      connectionStatus: 'disconnected',
    }));
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setState(initialState);
  }, []);

  return {
    state,
    sendMessage,
    abort,
    reset,
  };
}

export default useChatStream;
