/**
 * Property Tests: SSE Reconnection Timing (v0-lovable-architecture)
 * 
 * **Feature: v0-lovable-architecture, Property 21: SSE Reconnection Timing**
 * **Validates: Requirements 13.1**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createReconnectionManager } from '../../hooks/use-sse-reconnection';

const RECONNECT_DELAY_MS = 100;

describe('Property 21: SSE Reconnection Timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should schedule reconnection within 100ms of connection drop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (dropCount) => {
          const manager = createReconnectionManager({
            maxAttempts: 10,
            delayMs: RECONNECT_DELAY_MS,
          });

          for (let i = 0; i < dropCount; i++) {
            const result = manager.scheduleReconnect();
            expect(result.delay).toBeLessThanOrEqual(RECONNECT_DELAY_MS);
            expect(result.willAttempt).toBe(true);
            manager.onReconnectSuccess();
          }

          expect(manager.getState().attempts).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect maximum reconnection attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (maxAttempts) => {
          const manager = createReconnectionManager({
            maxAttempts,
            delayMs: RECONNECT_DELAY_MS,
          });

          for (let i = 0; i < maxAttempts; i++) {
            const result = manager.scheduleReconnect();
            expect(result.willAttempt).toBe(true);
          }

          const finalResult = manager.scheduleReconnect();
          expect(finalResult.willAttempt).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset attempts after successful reconnection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (failedAttempts) => {
          const manager = createReconnectionManager({
            maxAttempts: 5,
            delayMs: RECONNECT_DELAY_MS,
          });

          for (let i = 0; i < failedAttempts; i++) {
            manager.scheduleReconnect();
          }

          expect(manager.getState().attempts).toBe(failedAttempts);
          manager.onReconnectSuccess();
          expect(manager.getState().attempts).toBe(0);
          expect(manager.getState().isReconnecting).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track last event ID for resumption', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (eventIds) => {
          const manager = createReconnectionManager({
            maxAttempts: 3,
            delayMs: RECONNECT_DELAY_MS,
          });

          for (const eventId of eventIds) {
            manager.onEventReceived(eventId);
          }

          expect(manager.getLastEventId()).toBe(eventIds[eventIds.length - 1]);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect connection drops via heartbeat timeout', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5000 }),
        fc.integer({ min: 0, max: 10000 }),
        (heartbeatTimeoutMs, timeSinceLastEvent) => {
          const manager = createReconnectionManager({
            maxAttempts: 3,
            delayMs: RECONNECT_DELAY_MS,
            heartbeatTimeoutMs,
          });

          manager.onEventReceived();
          vi.advanceTimersByTime(timeSinceLastEvent);
          
          const isDropped = manager.isConnectionDropped();
          
          if (timeSinceLastEvent > heartbeatTimeoutMs) {
            expect(isDropped).toBe(true);
          } else {
            expect(isDropped).toBe(false);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
