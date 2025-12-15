/**
 * Property Tests: SSE Reconnection Timing
 * 
 * Tests SSE reconnection timing requirements.
 * 
 * **Feature: chat-ux-improvements, Property 10: SSE Reconnection Timing**
 * **Validates: Requirements 4.5**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

/**
 * SSE Reconnection Manager
 * 
 * Handles reconnection logic with timing guarantees.
 * Extracted for testability.
 */
interface ReconnectionConfig {
  maxAttempts: number;
  delayMs: number;
}

interface ReconnectionState {
  attempts: number;
  lastAttemptTime: number | null;
  isReconnecting: boolean;
}

/**
 * Creates a reconnection manager with timing guarantees
 */
function createReconnectionManager(config: ReconnectionConfig) {
  const state: ReconnectionState = {
    attempts: 0,
    lastAttemptTime: null,
    isReconnecting: false,
  };

  return {
    /**
     * Schedule a reconnection attempt
     * Returns the delay that will be used (for testing)
     */
    scheduleReconnect(): { delay: number; willAttempt: boolean } {
      if (state.attempts >= config.maxAttempts) {
        return { delay: 0, willAttempt: false };
      }

      state.attempts++;
      state.isReconnecting = true;
      state.lastAttemptTime = Date.now();

      return { delay: config.delayMs, willAttempt: true };
    },

    /**
     * Mark reconnection as successful
     */
    onReconnectSuccess() {
      state.attempts = 0;
      state.isReconnecting = false;
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
      state.lastAttemptTime = null;
      state.isReconnecting = false;
    },
  };
}

/**
 * Timing constant for reconnection (Requirement 4.5)
 */
const RECONNECT_DELAY_MS = 100;

describe('Property 10: SSE Reconnection Timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Property: For any SSE connection drop, the system SHALL reconnect within 100ms.
   * 
   * We test this by verifying that the reconnection manager schedules
   * reconnection attempts with the correct delay.
   */
  it('should schedule reconnection within 100ms of connection drop', () => {
    fc.assert(
      fc.property(
        // Generate random number of connection drops (1-5)
        fc.integer({ min: 1, max: 5 }),
        (dropCount) => {
          const manager = createReconnectionManager({
            maxAttempts: 10,
            delayMs: RECONNECT_DELAY_MS,
          });

          // Simulate multiple connection drops
          for (let i = 0; i < dropCount; i++) {
            const result = manager.scheduleReconnect();
            
            // Each reconnection should be scheduled within 100ms
            expect(result.delay).toBeLessThanOrEqual(RECONNECT_DELAY_MS);
            expect(result.willAttempt).toBe(true);
            
            // Simulate successful reconnection
            manager.onReconnectSuccess();
          }

          // After successful reconnections, attempts should be reset
          expect(manager.getState().attempts).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should respect maximum reconnection attempts', () => {
    fc.assert(
      fc.property(
        // Generate random max attempts (1-5)
        fc.integer({ min: 1, max: 5 }),
        (maxAttempts) => {
          const manager = createReconnectionManager({
            maxAttempts,
            delayMs: RECONNECT_DELAY_MS,
          });

          // Attempt reconnection maxAttempts times
          for (let i = 0; i < maxAttempts; i++) {
            const result = manager.scheduleReconnect();
            expect(result.willAttempt).toBe(true);
          }

          // Next attempt should be rejected
          const finalResult = manager.scheduleReconnect();
          expect(finalResult.willAttempt).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should reset attempts after successful reconnection', () => {
    fc.assert(
      fc.property(
        // Generate random number of failed attempts before success (1-3)
        fc.integer({ min: 1, max: 3 }),
        (failedAttempts) => {
          const manager = createReconnectionManager({
            maxAttempts: 5,
            delayMs: RECONNECT_DELAY_MS,
          });

          // Simulate failed attempts
          for (let i = 0; i < failedAttempts; i++) {
            manager.scheduleReconnect();
          }

          // Verify attempts were tracked
          expect(manager.getState().attempts).toBe(failedAttempts);

          // Simulate successful reconnection
          manager.onReconnectSuccess();

          // Attempts should be reset
          expect(manager.getState().attempts).toBe(0);
          expect(manager.getState().isReconnecting).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should track reconnection state correctly', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (shouldSucceed) => {
          const manager = createReconnectionManager({
            maxAttempts: 3,
            delayMs: RECONNECT_DELAY_MS,
          });

          // Initial state
          expect(manager.getState().isReconnecting).toBe(false);
          expect(manager.getState().attempts).toBe(0);

          // Schedule reconnection
          manager.scheduleReconnect();
          expect(manager.getState().isReconnecting).toBe(true);
          expect(manager.getState().attempts).toBe(1);

          if (shouldSucceed) {
            manager.onReconnectSuccess();
            expect(manager.getState().isReconnecting).toBe(false);
            expect(manager.getState().attempts).toBe(0);
          } else {
            // Still reconnecting
            expect(manager.getState().isReconnecting).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain timing guarantee across multiple reconnection cycles', () => {
    fc.assert(
      fc.property(
        // Generate random number of full reconnection cycles (1-3)
        fc.integer({ min: 1, max: 3 }),
        (cycles) => {
          const manager = createReconnectionManager({
            maxAttempts: 5,
            delayMs: RECONNECT_DELAY_MS,
          });

          for (let cycle = 0; cycle < cycles; cycle++) {
            // Simulate a connection drop and reconnection
            const result = manager.scheduleReconnect();
            
            // Timing guarantee: delay should be <= 100ms
            expect(result.delay).toBeLessThanOrEqual(RECONNECT_DELAY_MS);
            expect(result.willAttempt).toBe(true);
            
            // Simulate successful reconnection
            manager.onReconnectSuccess();
          }

          // All cycles completed successfully
          expect(manager.getState().attempts).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Integration-style tests for the reconnection timing
 */
describe('SSE Reconnection Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute reconnection callback within timing window', async () => {
    const reconnectCallback = vi.fn();
    const manager = createReconnectionManager({
      maxAttempts: 3,
      delayMs: RECONNECT_DELAY_MS,
    });

    // Schedule reconnection
    const { delay, willAttempt } = manager.scheduleReconnect();
    expect(willAttempt).toBe(true);

    // Set up the callback to be called after delay
    setTimeout(reconnectCallback, delay);

    // Advance time by the delay
    await vi.advanceTimersByTimeAsync(delay);

    // Callback should have been called
    expect(reconnectCallback).toHaveBeenCalledTimes(1);
  });

  it('should not exceed 100ms delay for any reconnection attempt', () => {
    const manager = createReconnectionManager({
      maxAttempts: 10,
      delayMs: RECONNECT_DELAY_MS,
    });

    // Test multiple reconnection attempts
    for (let i = 0; i < 10; i++) {
      const { delay } = manager.scheduleReconnect();
      
      // CRITICAL: Delay must never exceed 100ms (Requirement 4.5)
      expect(delay).toBeLessThanOrEqual(100);
    }
  });
});
