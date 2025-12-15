'use client';

/**
 * useTokenBuffer Hook
 * 
 * React hook for using TokenBuffer service with streaming content.
 * Provides smooth 50ms batch display for streaming text.
 * 
 * Requirements: 7.5
 * WHILE streaming THEN the system SHALL buffer tokens for smooth display (50ms batches)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createTokenBuffer, DEFAULT_FLUSH_INTERVAL_MS } from '../src/services/token-buffer';
import type { TokenBufferState } from '../src/services/token-buffer';

export interface UseTokenBufferOptions {
  /** Flush interval in milliseconds (default: 50ms) */
  flushInterval?: number;
  /** Callback when content is flushed */
  onFlush?: (content: string) => void;
}

export interface UseTokenBufferResult {
  /** Current displayed content */
  displayedContent: string;
  /** Add a token to the buffer */
  addToken: (token: string) => void;
  /** Add multiple tokens at once */
  addTokens: (tokens: string) => void;
  /** Manually flush the buffer */
  flush: () => string;
  /** Clear the buffer and displayed content */
  clear: () => void;
  /** Interrupt streaming and get remaining content */
  interrupt: () => string;
  /** Resume after interruption */
  resume: () => void;
  /** Whether the buffer is interrupted */
  isInterrupted: boolean;
  /** Get buffer state for debugging */
  getState: () => TokenBufferState;
}

/**
 * Hook for managing token buffering in streaming scenarios
 */
export function useTokenBuffer(options: UseTokenBufferOptions = {}): UseTokenBufferResult {
  const { flushInterval = DEFAULT_FLUSH_INTERVAL_MS, onFlush } = options;
  
  const [displayedContent, setDisplayedContent] = useState('');
  const [isInterrupted, setIsInterrupted] = useState(false);
  const bufferRef = useRef<ReturnType<typeof createTokenBuffer> | null>(null);

  // Initialize buffer
  useEffect(() => {
    bufferRef.current = createTokenBuffer(
      (content) => {
        setDisplayedContent(prev => prev + content);
        onFlush?.(content);
      },
      flushInterval
    );

    return () => {
      bufferRef.current?.destroy();
    };
  }, [flushInterval, onFlush]);

  // Update flush interval if it changes
  useEffect(() => {
    bufferRef.current?.setFlushInterval(flushInterval);
  }, [flushInterval]);

  const addToken = useCallback((token: string) => {
    bufferRef.current?.addToken(token);
  }, []);

  const addTokens = useCallback((tokens: string) => {
    if (!bufferRef.current) return;
    for (const char of tokens) {
      bufferRef.current.addToken(char);
    }
  }, []);

  const flush = useCallback(() => {
    const content = bufferRef.current?.flush() || '';
    if (content) {
      setDisplayedContent(prev => prev + content);
    }
    return content;
  }, []);

  const clear = useCallback(() => {
    bufferRef.current?.clear();
    setDisplayedContent('');
    setIsInterrupted(false);
  }, []);

  const interrupt = useCallback(() => {
    const remaining = bufferRef.current?.interrupt() || '';
    if (remaining) {
      setDisplayedContent(prev => prev + remaining);
    }
    setIsInterrupted(true);
    return remaining;
  }, []);

  const resume = useCallback(() => {
    bufferRef.current?.resume();
    setIsInterrupted(false);
  }, []);

  const getState = useCallback(() => {
    return bufferRef.current?.getState() || {
      buffer: '',
      lastFlushTime: 0,
      flushInterval,
      isInterrupted: false,
      totalTokensReceived: 0,
      totalFlushes: 0,
    };
  }, [flushInterval]);

  return {
    displayedContent,
    addToken,
    addTokens,
    flush,
    clear,
    interrupt,
    resume,
    isInterrupted,
    getState,
  };
}

export default useTokenBuffer;
