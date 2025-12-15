  /**
 * useGitHubClone Hook
 * 
 * React hook for consuming GitHub clone SSE streaming API.
 * Manages clone state and progress events.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 13.1, 13.2, 13.3, 13.4
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createReconnectionManager, type ReconnectionManager } from './use-sse-reconnection';

/**
 * Clone SSE Event Types
 */
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

/**
 * Clone status states
 */
type CloneStatus = 
  | 'idle'
  | 'creating_workspace'
  | 'cloning'
  | 'detecting_framework'
  | 'installing'
  | 'starting_preview'
  | 'creating_snapshot'
  | 'complete'
  | 'error';

/**
 * Hook return type
 * Requirements: 14.7, 13.1, 13.2, 13.3, 13.4
 */
export interface UseGitHubCloneReturn {
  clone: (projectId: string) => Promise<void>;
  isCloning: boolean;
  progress: string;
  status: CloneStatus;
  error: string | null;
  sandboxUrl: string | null;
  fileCount: number;
  framework: string | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
  reset: () => void;
  retry: () => void;
}

/**
 * Parse SSE event from raw data
 */
function parseSSEEvent(data: string): CloneSSEEvent | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Map progress message to status
 */
function getStatusFromMessage(message: string): CloneStatus {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('creating workspace')) {
    return 'creating_workspace';
  }
  if (lowerMessage.includes('cloning')) {
    return 'cloning';
  }
  if (lowerMessage.includes('detecting framework')) {
    return 'detecting_framework';
  }
  if (lowerMessage.includes('installing')) {
    return 'installing';
  }
  if (lowerMessage.includes('starting preview') || lowerMessage.includes('preview server')) {
    return 'starting_preview';
  }
  if (lowerMessage.includes('snapshot')) {
    return 'creating_snapshot';
  }
  
  return 'cloning';
}


/**
 * useGitHubClone Hook
 * 
 * Handles SSE streaming for GitHub repository cloning.
 * 
 * @returns UseGitHubCloneReturn
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 13.1, 13.2, 13.3, 13.4
 */
export function useGitHubClone(): UseGitHubCloneReturn {
  const [isCloning, setIsCloning] = useState(false);
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState<CloneStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [framework, setFramework] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectionManagerRef = useRef<ReconnectionManager | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);
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
    setIsCloning(false);
    setProgress('');
    setStatus('idle');
    setError(null);
    setSandboxUrl(null);
    setFileCount(0);
    setFramework(null);
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
    lastProjectIdRef.current = null;
  }, []);

  /**
   * Internal clone function with reconnection support
   * Requirements: 14.1, 13.1, 13.2, 13.3, 13.4
   */
  const executeClone = useCallback(async (projectId: string, isRetry: boolean = false) => {
    lastProjectIdRef.current = projectId;

    if (!isRetry) {
      reset();
      setIsCloning(true);
      setStatus('creating_workspace');
      setProgress('Starting clone...');
    } else {
      setIsReconnecting(true);
      setProgress('Reconnecting...');
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      if (isRetry) {
        reconnectionManagerRef.current?.onReconnectSuccess();
        setIsReconnecting(false);
        setReconnectAttempts(0);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        reconnectionManagerRef.current?.onEventReceived();
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            const event = parseSSEEvent(data);
            
            if (event) {
              switch (event.type) {
                case 'clone:start':
                  setStatus('cloning');
                  setProgress(event.message || 'Starting clone...');
                  break;

                case 'clone:progress':
                  setProgress(event.message || '');
                  setStatus(getStatusFromMessage(event.message || ''));
                  if (event.framework) setFramework(event.framework);
                  break;

                case 'install:progress':
                  setStatus('installing');
                  setProgress(event.message || 'Installing dependencies...');
                  break;

                case 'preview:ready':
                  setStatus('starting_preview');
                  setProgress(event.message || 'Preview ready');
                  if (event.sandboxUrl) setSandboxUrl(event.sandboxUrl);
                  break;

                case 'clone:complete':
                  setStatus('complete');
                  setProgress(event.message || 'Clone complete!');
                  setIsCloning(false);
                  if (event.fileCount !== undefined) setFileCount(event.fileCount);
                  if (event.sandboxUrl) setSandboxUrl(event.sandboxUrl);
                  if (event.framework) setFramework(event.framework);
                  break;

                case 'clone:error':
                  setStatus('error');
                  setError(event.error || event.message || 'Clone failed');
                  setProgress('');
                  setIsCloning(false);
                  break;
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      
      const { delay, willAttempt } = reconnectionManagerRef.current?.scheduleReconnect() || { delay: 0, willAttempt: false };
      
      if (willAttempt) {
        const attempts = reconnectionManagerRef.current?.getState().attempts || 0;
        setReconnectAttempts(attempts);
        setIsReconnecting(true);
        setProgress(`Connection lost. Reconnecting (attempt ${attempts}/3)...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          executeClone(projectId, true);
        }, delay);
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setError(`${errorMessage}. Reconnection failed after 3 attempts.`);
      setProgress('');
      setIsCloning(false);
      setIsReconnecting(false);
    }
  }, [reset]);

  const clone = useCallback(async (projectId: string) => {
    await executeClone(projectId, false);
  }, [executeClone]);

  const retry = useCallback(() => {
    if (lastProjectIdRef.current) {
      reconnectionManagerRef.current?.reset();
      setReconnectAttempts(0);
      executeClone(lastProjectIdRef.current, false);
    }
  }, [executeClone]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return {
    clone,
    isCloning,
    progress,
    status,
    error,
    sandboxUrl,
    fileCount,
    framework,
    reconnectAttempts,
    isReconnecting,
    reset,
    retry,
  };
}

export default useGitHubClone;
