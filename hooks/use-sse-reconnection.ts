/**
 * SSE Reconnection Utility
 * 
 * Provides reconnection logic for SSE streams with timing guarantees.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 * - Detect connection drops via heartbeat
 * - Attempt reconnection within 100ms
 * - Resume streaming from last received event
 * - Display error with retry option after 3 failed attempts
 */

'use client';

import { useRef, useCallback } from 'react';

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  /** Maximum number of reconnection attempts (default: 3) */
  maxAttempts?: number;
  /** Delay between reconnection attempts in ms (default: 100ms per requirement 13.1) */
  delayMs?: number;
  /** Heartbeat timeout in ms - if no event received within this time, consider connection dropped */
  heartbeatTimeoutMs?: number;
}

/**
 * Reconnection state
 */
export interface ReconnectionState {
  attempts: number;
  lastEventTime: number;
  isReconnecting: boolean;
  lastEventId: string | null;
}

/**
 * Reconnection manager return type
 */
export interface ReconnectionManager {
  /** Schedule a reconnection attempt. Returns delay and whether attempt will be made */
  scheduleReconnect: () => { delay: number; willAttempt: boolean };
  /** Mark reconnection as successful, reset attempts */
  onReconnectSuccess: () => void;
  /** Update last event time (call on each received event) */
  onEventReceived: (eventId?: string) => void;
  /** Check if connection is considered dropped based on heartbeat */
  isConnectionDropped: () => boolean;
  /** Get current state */
  getState: () => ReconnectionState;
  /** Reset all state */
  reset: () => void;
  /** Get last event ID for resumption */
  getLastEventId: () => string | null;
}

const DEFAULT_CONFIG: Required<ReconnectionConfig> = {
  maxAttempts: 3,
  delayMs: 100, // Requirement 13.1: reconnect within 100ms
  heartbeatTimeoutMs: 30000, // 30 seconds
};

/**
 * Create a reconnection manager
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export function createReconnectionManager(
  config: ReconnectionConfig = {}
): ReconnectionManager {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const state: ReconnectionState = {
    attempts: 0,
    lastEventTime: Date.now(),
    isReconnecting: false,
    lastEventId: null,
  };

  return {
    /**
     * Schedule a reconnection attempt
     * Requirements: 13.1 - Attempt reconnection within 100ms
     */
    scheduleReconnect(): { delay: number; willAttempt: boolean } {
      // Requirements: 13.3 - Display error after max attempts
      if (state.attempts >= mergedConfig.maxAttempts) {
        return { delay: 0, willAttempt: false };
      }

      state.attempts++;
      state.isReconnecting = true;

      return { delay: mergedConfig.delayMs, willAttempt: true };
    },

    /**
     * Mark reconnection as successful
     */
    onReconnectSuccess() {
      state.attempts = 0;
      state.isReconnecting = false;
      state.lastEventTime = Date.now();
    },

    /**
     * Update last event time
     * Requirements: 13.2 - Track events for resumption
     */
    onEventReceived(eventId?: string) {
      state.lastEventTime = Date.now();
      if (eventId) {
        state.lastEventId = eventId;
      }
    },

    /**
     * Check if connection is dropped based on heartbeat
     * Requirements: 13.4 - Maintain heartbeat to detect connection issues
     */
    isConnectionDropped(): boolean {
      return Date.now() - state.lastEventTime > mergedConfig.heartbeatTimeoutMs;
    },

    /**
     * Get current state
     */
    getState(): ReconnectionState {
      return { ...state };
    },

    /**
     * Reset state
     */
    reset() {
      state.attempts = 0;
      state.lastEventTime = Date.now();
      state.isReconnecting = false;
      state.lastEventId = null;
    },

    /**
     * Get last event ID for resumption
     * Requirements: 13.2 - Resume from last received event
     */
    getLastEventId(): string | null {
      return state.lastEventId;
    },
  };
}

/**
 * React hook for SSE reconnection management
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export function useSSEReconnection(config: ReconnectionConfig = {}) {
  const managerRef = useRef<ReconnectionManager | null>(null);

  // Lazy initialization
  if (!managerRef.current) {
    managerRef.current = createReconnectionManager(config);
  }

  const scheduleReconnect = useCallback(() => {
    return managerRef.current!.scheduleReconnect();
  }, []);

  const onReconnectSuccess = useCallback(() => {
    managerRef.current!.onReconnectSuccess();
  }, []);

  const onEventReceived = useCallback((eventId?: string) => {
    managerRef.current!.onEventReceived(eventId);
  }, []);

  const isConnectionDropped = useCallback(() => {
    return managerRef.current!.isConnectionDropped();
  }, []);

  const getState = useCallback(() => {
    return managerRef.current!.getState();
  }, []);

  const reset = useCallback(() => {
    managerRef.current!.reset();
  }, []);

  const getLastEventId = useCallback(() => {
    return managerRef.current!.getLastEventId();
  }, []);

  return {
    scheduleReconnect,
    onReconnectSuccess,
    onEventReceived,
    isConnectionDropped,
    getState,
    reset,
    getLastEventId,
  };
}

export default useSSEReconnection;
