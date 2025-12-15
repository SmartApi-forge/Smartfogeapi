/**
 * useCodeGeneration Hook
 * 
 * React hook for consuming the /api/generate SSE streaming API.
 * Manages code generation state and SSE event parsing.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.3, 13.1, 13.2, 13.3, 13.4
 * 
 * **Feature: v0-lovable-architecture, Property 13: Hook State Consistency**
 * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createReconnectionManager, type ReconnectionManager } from './use-sse-reconnection';

/**
 * SSE Event types from /api/generate
 */
export interface GenerateSSEEvent {
  type: 
    | 'thinking'
    | 'status' 
    | 'chunk' 
    | 'file:start'
    | 'file:reading'
    | 'file:read:complete'
    | 'file:complete' 
    | 'complete' 
    | 'error'
    | 'heartbeat';
  message?: string;
  content?: string;
  filename?: string;
  filePath?: string;
  fileCount?: number;
  filesModified?: string[];
  turnIndex?: number;
  timestamp?: string;
}

/**
 * Generation status states
 */
export type GenerationStatus = 
  | 'idle'
  | 'thinking'
  | 'reading_files'
  | 'generating'
  | 'complete'
  | 'error';

/**
 * File reading event for tracking context building
 */
export interface FileReadingEvent {
  type: 'file:reading' | 'file:read:complete';
  filePath?: string;
  fileCount?: number;
  timestamp: number;
}

/**
 * Hook return type
 * Requirements: 10.1, 13.1, 13.2, 13.3, 13.4
 */
export interface UseCodeGenerationReturn {
  generate: (prompt: string, projectId: string, mode?: 'ask' | 'code') => Promise<void>;
  output: string;
  isGenerating: boolean;
  status: GenerationStatus;
  statusMessage: string;
  error: string | null;
  filesModified: string[];
  fileReadingEvents: FileReadingEvent[];
  turnIndex: number | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
  reset: () => void;
  abort: () => void;
  retry: () => void;
}


/**
 * Parse SSE event from raw data
 */
function parseSSEEvent(data: string): GenerateSSEEvent | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * useCodeGeneration Hook
 * 
 * Handles SSE streaming for code generation from /api/generate.
 * 
 * @returns UseCodeGenerationReturn
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.3
 */
export function useCodeGeneration(): UseCodeGenerationReturn {
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filesModified, setFilesModified] = useState<string[]>([]);
  const [fileReadingEvents, setFileReadingEvents] = useState<FileReadingEvent[]>([]);
  const [turnIndex, setTurnIndex] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const reconnectionManagerRef = useRef<ReconnectionManager | null>(null);
  const lastRequestRef = useRef<{ prompt: string; projectId: string; mode: 'ask' | 'code' } | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize reconnection manager
  if (!reconnectionManagerRef.current) {
    reconnectionManagerRef.current = createReconnectionManager({
      maxAttempts: 3,
      delayMs: 100, // Requirement 13.1: reconnect within 100ms
    });
  }

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setOutput('');
    setIsGenerating(false);
    setStatus('idle');
    setStatusMessage('');
    setError(null);
    setFilesModified([]);
    setFileReadingEvents([]);
    setTurnIndex(null);
    setReconnectAttempts(0);
    setIsReconnecting(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    reconnectionManagerRef.current?.reset();
    lastRequestRef.current = null;
  }, []);

  /**
   * Abort current generation
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsGenerating(false);
    setStatus('idle');
    setStatusMessage('Generation cancelled');
    setIsReconnecting(false);
    reconnectionManagerRef.current?.reset();
  }, []);

  /**
   * Process SSE event and update state
   * Requirements: 10.2, 10.3, 10.4, 10.5, 12.1, 12.3
   */
  const processEvent = useCallback((event: GenerateSSEEvent) => {
    lastEventTimeRef.current = Date.now();
    
    switch (event.type) {
      case 'thinking':
        // Requirements: 10.2 - Update status state
        setStatus('thinking');
        setStatusMessage(event.message || 'Thinking...');
        break;

      case 'status':
        // Requirements: 10.3 - Update status state
        setStatusMessage(event.message || '');
        break;

      case 'file:reading':
        // Requirements: 12.1 - Emit file:reading events with file paths
        setStatus('reading_files');
        setFileReadingEvents(prev => [
          ...prev,
          {
            type: 'file:reading',
            filePath: event.filePath,
            timestamp: Date.now(),
          },
        ]);
        break;

      case 'file:read:complete':
        // Requirements: 12.3 - Emit file:read:complete event with file count
        setStatus('generating');
        setFileReadingEvents(prev => [
          ...prev,
          {
            type: 'file:read:complete',
            fileCount: event.fileCount,
            timestamp: Date.now(),
          },
        ]);
        break;

      case 'chunk':
        // Requirements: 10.2 - Accumulate output for chunk events
        setStatus('generating');
        setOutput(prev => prev + (event.content || ''));
        break;

      case 'file:start':
        setStatusMessage(`Generating ${event.filename || 'file'}...`);
        break;

      case 'file:complete':
        if (event.filename) {
          setFilesModified(prev => 
            prev.includes(event.filename!) ? prev : [...prev, event.filename!]
          );
        }
        break;

      case 'complete':
        // Requirements: 10.5 - Update filesModified for completion events
        setStatus('complete');
        setStatusMessage(event.message || 'Generation complete');
        setIsGenerating(false);
        if (event.filesModified) {
          setFilesModified(event.filesModified);
        }
        if (event.turnIndex !== undefined) {
          setTurnIndex(event.turnIndex);
        }
        break;

      case 'error':
        // Requirements: 10.4 - Update error state for error events
        setStatus('error');
        setError(event.message || 'Unknown error');
        setStatusMessage('');
        setIsGenerating(false);
        break;

      case 'heartbeat':
        // Just update last event time, already done above
        break;
    }
  }, []);

  /**
   * Internal generate function with reconnection support
   * Requirements: 10.1, 13.1, 13.2, 13.3, 13.4
   */
  const executeGenerate = useCallback(async (
    prompt: string,
    projectId: string,
    mode: 'ask' | 'code' = 'code',
    isRetry: boolean = false
  ) => {
    // Store request for potential retry
    lastRequestRef.current = { prompt, projectId, mode };

    // Only reset state if not a retry
    if (!isRetry) {
      reset();
      setIsGenerating(true);
      setStatus('thinking');
      setStatusMessage('Thinking...');
    } else {
      setIsReconnecting(true);
      setStatusMessage('Reconnecting...');
    }

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();

    try {
      // Call the SSE streaming API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId, 
          userMessage: prompt,
          mode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Reconnection successful
      if (isRetry) {
        reconnectionManagerRef.current?.onReconnectSuccess();
        setIsReconnecting(false);
        setReconnectAttempts(0);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Update last event time for heartbeat detection
        reconnectionManagerRef.current?.onEventReceived();

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            const event = parseSSEEvent(data);
            
            if (event) {
              processEvent(event);
            }
          }
        }
      }

      // If we finished without a complete event, mark as complete
      setIsGenerating(false);
      if (status !== 'complete' && status !== 'error') {
        setStatus('complete');
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Generation was cancelled
        return;
      }
      
      // Attempt reconnection
      // Requirements: 13.1, 13.2, 13.3
      const { delay, willAttempt } = reconnectionManagerRef.current?.scheduleReconnect() || { delay: 0, willAttempt: false };
      
      if (willAttempt) {
        const attempts = reconnectionManagerRef.current?.getState().attempts || 0;
        setReconnectAttempts(attempts);
        setIsReconnecting(true);
        setStatusMessage(`Connection lost. Reconnecting (attempt ${attempts}/3)...`);
        
        // Schedule reconnection within 100ms (Requirement 13.1)
        reconnectTimeoutRef.current = setTimeout(() => {
          executeGenerate(prompt, projectId, mode, true);
        }, delay);
        return;
      }
      
      // Max attempts reached (Requirement 13.3)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setError(`${errorMessage}. Reconnection failed after 3 attempts.`);
      setStatusMessage('');
      setIsGenerating(false);
      setIsReconnecting(false);
    }
  }, [reset, processEvent, status]);

  /**
   * Start generation
   * Requirements: 10.1
   */
  const generate = useCallback(async (
    prompt: string,
    projectId: string,
    mode: 'ask' | 'code' = 'code'
  ) => {
    await executeGenerate(prompt, projectId, mode, false);
  }, [executeGenerate]);

  /**
   * Retry last generation request
   * Requirements: 13.3 - Display error with retry option
   */
  const retry = useCallback(() => {
    if (lastRequestRef.current) {
      const { prompt, projectId, mode } = lastRequestRef.current;
      reconnectionManagerRef.current?.reset();
      setReconnectAttempts(0);
      executeGenerate(prompt, projectId, mode, false);
    }
  }, [executeGenerate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    generate,
    output,
    isGenerating,
    status,
    statusMessage,
    error,
    filesModified,
    fileReadingEvents,
    turnIndex,
    reconnectAttempts,
    isReconnecting,
    reset,
    abort,
    retry,
  };
}

export default useCodeGeneration;
