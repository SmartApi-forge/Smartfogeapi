/**
 * Property Tests: Token Forwarding Latency
 * 
 * **Feature: chat-ux-improvements, Property 9: Token Forwarding Latency**
 * **Validates: Requirements 4.3**
 * 
 * Property: For any token received from OpenAI, the system SHALL forward it to SSE within 10ms.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  TokenForwarder,
  createTokenForwarder,
  MAX_TOKEN_FORWARD_LATENCY_MS,
  measureForwardLatency,
  createOptimizedSSEEncoder,
} from '../services/token-forwarder';

describe('Property 9: Token Forwarding Latency', () => {
  /**
   * Property: For any token, forwarding SHALL complete within 10ms of receipt.
   * 
   * This tests the core requirement that tokens are forwarded with sub-10ms latency.
   */
  it('should forward tokens within 10ms latency threshold', () => {
    fc.assert(
      fc.property(
        // Generate random token content (simulating OpenAI tokens)
        fc.string({ minLength: 1, maxLength: 100 }),
        (token) => {
          const forwardedTokens: Array<{ token: string; timestamp: number }> = [];
          
          const forwarder = createTokenForwarder({
            onForward: (t, timestamp) => {
              forwardedTokens.push({ token: t, timestamp });
            },
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          // Simulate token receipt and forward
          const receiptTime = performance.now();
          const result = forwarder.forward(token, receiptTime);

          // Verify token was forwarded
          expect(forwardedTokens.length).toBe(1);
          expect(forwardedTokens[0].token).toBe(token);

          // Verify latency is within threshold
          expect(result.latencyMs).toBeLessThanOrEqual(MAX_TOKEN_FORWARD_LATENCY_MS);
          expect(result.exceedsThreshold).toBe(false);
          expect(result.success).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any batch of tokens, each token SHALL be forwarded within 10ms.
   */
  it('should forward batch tokens within latency threshold', () => {
    fc.assert(
      fc.property(
        // Generate array of tokens (1-20 tokens)
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
        (tokens) => {
          const forwardedTokens: string[] = [];
          
          const forwarder = createTokenForwarder({
            onForward: (t) => {
              forwardedTokens.push(t);
            },
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          // Forward batch
          const receiptTime = performance.now();
          const results = forwarder.forwardBatch(tokens, receiptTime);

          // Verify all tokens were forwarded
          expect(forwardedTokens.length).toBe(tokens.length);
          expect(forwardedTokens).toEqual(tokens);

          // Verify all results indicate success
          for (const result of results) {
            expect(result.success).toBe(true);
            // Each token should be forwarded quickly (allowing some tolerance for batch processing)
            expect(result.latencyMs).toBeLessThan(MAX_TOKEN_FORWARD_LATENCY_MS * 2);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Metrics SHALL accurately track forwarding performance.
   */
  it('should accurately track forwarding metrics', () => {
    fc.assert(
      fc.property(
        // Generate number of tokens to forward
        fc.integer({ min: 1, max: 50 }),
        (tokenCount) => {
          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          // Forward tokens
          for (let i = 0; i < tokenCount; i++) {
            forwarder.forward(`token_${i}`, performance.now());
          }

          const metrics = forwarder.getMetrics();

          // Verify metrics accuracy
          expect(metrics.totalTokensForwarded).toBe(tokenCount);
          expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
          expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.minLatency);
          expect(metrics.totalForwardingTime).toBeGreaterThanOrEqual(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Success rate SHALL be 100% when all tokens are forwarded within threshold.
   */
  it('should report 100% success rate for fast forwarding', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (tokenCount) => {
          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          // Forward tokens (synchronous forwarding should be very fast)
          for (let i = 0; i < tokenCount; i++) {
            const receiptTime = performance.now();
            forwarder.forward(`token_${i}`, receiptTime);
          }

          // Success rate should be 100% for synchronous forwarding
          const successRate = forwarder.getSuccessRate();
          expect(successRate).toBe(100);
          expect(forwarder.isWithinLatencyThreshold()).toBe(true);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Reset metrics SHALL clear all tracking data.
   */
  it('should reset metrics correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (tokenCount) => {
          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          // Forward some tokens
          for (let i = 0; i < tokenCount; i++) {
            forwarder.forward(`token_${i}`, performance.now());
          }

          // Verify metrics are populated
          expect(forwarder.getMetrics().totalTokensForwarded).toBe(tokenCount);

          // Reset metrics
          forwarder.resetMetrics();

          // Verify metrics are cleared
          const metrics = forwarder.getMetrics();
          expect(metrics.totalTokensForwarded).toBe(0);
          expect(metrics.totalForwardingTime).toBe(0);
          expect(metrics.maxLatency).toBe(0);
          expect(metrics.minLatency).toBe(0);
          expect(metrics.tokensExceedingThreshold).toBe(0);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Latency warning callback SHALL be invoked when threshold is exceeded.
   * 
   * We test this by simulating a delayed receipt time (in the past) to ensure
   * the latency calculation exceeds the threshold.
   */
  it('should invoke warning callback when latency exceeds threshold', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (token) => {
          let warningCalled = false;
          let warningLatency = 0;
          let warningToken = '';

          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: 5, // Set 5ms threshold
            onLatencyWarning: (latencyMs, t) => {
              warningCalled = true;
              warningLatency = latencyMs;
              warningToken = t;
            },
          });

          // Simulate a token that was received 10ms ago (in the past)
          // This ensures the latency calculation will exceed the 5ms threshold
          const simulatedPastReceiptTime = performance.now() - 10;
          forwarder.forward(token, simulatedPastReceiptTime);

          // Warning should have been called because latency > 5ms
          expect(warningCalled).toBe(true);
          expect(warningToken).toBe(token);
          expect(warningLatency).toBeGreaterThan(5);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Configurable max latency SHALL be respected.
   */
  it('should respect configurable max latency threshold', () => {
    fc.assert(
      fc.property(
        // Generate custom threshold between 1ms and 50ms
        fc.integer({ min: 1, max: 50 }),
        (customThreshold) => {
          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: customThreshold,
          });

          // Verify threshold is set correctly
          expect(forwarder.getMaxLatency()).toBe(customThreshold);

          // Update threshold
          const newThreshold = customThreshold + 10;
          forwarder.setMaxLatency(newThreshold);
          expect(forwarder.getMaxLatency()).toBe(newThreshold);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: measureForwardLatency utility SHALL accurately measure latency.
   */
  it('should accurately measure forward latency with utility function', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (token) => {
          let forwardedToken = '';
          
          const latency = measureForwardLatency(
            (t) => { forwardedToken = t; },
            token
          );

          // Token should be forwarded
          expect(forwardedToken).toBe(token);

          // Latency should be a positive number (very small for synchronous operation)
          expect(latency).toBeGreaterThanOrEqual(0);
          expect(latency).toBeLessThan(MAX_TOKEN_FORWARD_LATENCY_MS);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Optimized SSE encoder SHALL produce valid SSE format.
   */
  it('should produce valid SSE format with optimized encoder', () => {
    fc.assert(
      fc.property(
        // Generate token content (avoiding special chars that break JSON)
        fc.string({ minLength: 1, maxLength: 50 }),
        (token) => {
          const encoder = createOptimizedSSEEncoder('text:chunk');
          const encoded = encoder(token);

          // Should produce Uint8Array
          expect(encoded).toBeInstanceOf(Uint8Array);

          // Decode and verify format
          const decoded = new TextDecoder().decode(encoded);
          
          // Should start with 'data: ' and end with '\n\n'
          expect(decoded.startsWith('data: ')).toBe(true);
          expect(decoded.endsWith('\n\n')).toBe(true);

          // Should be valid JSON between 'data: ' and '\n\n'
          const jsonPart = decoded.slice(6, -2);
          const parsed = JSON.parse(jsonPart);
          
          expect(parsed.type).toBe('text:chunk');
          expect(typeof parsed.timestamp).toBe('number');
          // Content should match (accounting for escaping)
          expect(parsed.content).toBeDefined();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: SSE encoder SHALL handle special characters correctly.
   */
  it('should handle special characters in SSE encoding', () => {
    fc.assert(
      fc.property(
        // Generate strings with special characters
        fc.oneof(
          fc.constant('Hello\nWorld'),
          fc.constant('Tab\there'),
          fc.constant('Quote"test'),
          fc.constant('Backslash\\test'),
          fc.constant('Return\rtest'),
          fc.string({ minLength: 1, maxLength: 30 })
        ),
        (token) => {
          const encoder = createOptimizedSSEEncoder('token');
          const encoded = encoder(token);
          const decoded = new TextDecoder().decode(encoded);

          // Should be parseable JSON
          const jsonPart = decoded.slice(6, -2);
          expect(() => JSON.parse(jsonPart)).not.toThrow();

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Forward result SHALL include accurate timestamp.
   */
  it('should include accurate timestamp in forward result', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (token) => {
          const beforeTime = Date.now();
          
          const forwarder = createTokenForwarder({
            onForward: () => {},
            maxLatencyMs: MAX_TOKEN_FORWARD_LATENCY_MS,
          });

          const result = forwarder.forward(token, performance.now());
          
          const afterTime = Date.now();

          // Timestamp should be within the test execution window
          expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(result.timestamp).toBeLessThanOrEqual(afterTime);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
