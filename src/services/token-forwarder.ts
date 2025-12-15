/**
 * Token Forwarder Service
 * 
 * Optimizes token forwarding to SSE with sub-10ms latency.
 * Designed for high-performance streaming with minimal overhead.
 * 
 * Requirements: 4.3
 * WHEN the AI generates tokens THEN the system SHALL forward them to SSE within 10ms of receipt
 */

// Maximum acceptable latency for token forwarding (in milliseconds)
export const MAX_TOKEN_FORWARD_LATENCY_MS = 10;

// High-resolution timing threshold for performance warnings
export const LATENCY_WARNING_THRESHOLD_MS = 8;

/**
 * Token forwarding metrics for monitoring and testing
 */
export interface TokenForwardingMetrics {
  totalTokensForwarded: number;
  totalForwardingTime: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  tokensExceedingThreshold: number;
  lastForwardTime: number;
}

/**
 * Token forward result with timing information
 */
export interface TokenForwardResult {
  success: boolean;
  latencyMs: number;
  exceedsThreshold: boolean;
  timestamp: number;
}

/**
 * Callback type for forwarding tokens to SSE
 */
export type TokenForwardCallback = (token: string, timestamp: number) => void;

/**
 * Options for token forwarder configuration
 */
export interface TokenForwarderOptions {
  /** Callback to forward tokens to SSE */
  onForward: TokenForwardCallback;
  /** Maximum acceptable latency in ms (default: 10) */
  maxLatencyMs?: number;
  /** Enable performance logging (default: false) */
  enableLogging?: boolean;
  /** Callback for latency warnings */
  onLatencyWarning?: (latencyMs: number, token: string) => void;
}

/**
 * TokenForwarder class
 * 
 * Provides optimized token forwarding with:
 * - High-resolution timing using performance.now()
 * - Immediate synchronous forwarding (no async overhead)
 * - Latency tracking and metrics
 * - Warning callbacks for threshold violations
 */
export class TokenForwarder {
  private onForward: TokenForwardCallback;
  private maxLatencyMs: number;
  private enableLogging: boolean;
  private onLatencyWarning?: (latencyMs: number, token: string) => void;
  
  // Metrics tracking
  private totalTokensForwarded: number = 0;
  private totalForwardingTime: number = 0;
  private maxLatency: number = 0;
  private minLatency: number = Infinity;
  private tokensExceedingThreshold: number = 0;
  private lastForwardTime: number = 0;

  constructor(options: TokenForwarderOptions) {
    this.onForward = options.onForward;
    this.maxLatencyMs = options.maxLatencyMs ?? MAX_TOKEN_FORWARD_LATENCY_MS;
    this.enableLogging = options.enableLogging ?? false;
    this.onLatencyWarning = options.onLatencyWarning;
  }

  /**
   * Forward a token immediately with timing measurement
   * 
   * This method is designed for minimal latency:
   * - Uses synchronous execution (no await/async overhead)
   * - Uses high-resolution performance.now() for timing
   * - Directly invokes callback without intermediate processing
   * 
   * @param token - The token to forward
   * @param receiptTime - The time the token was received (performance.now())
   * @returns TokenForwardResult with timing information
   */
  forward(token: string, receiptTime: number = performance.now()): TokenForwardResult {
    const forwardStartTime = performance.now();
    const timestamp = Date.now();
    
    // Forward immediately - synchronous call for minimum latency
    this.onForward(token, timestamp);
    
    const forwardEndTime = performance.now();
    const latencyMs = forwardEndTime - receiptTime;
    const exceedsThreshold = latencyMs > this.maxLatencyMs;
    
    // Update metrics
    this.updateMetrics(latencyMs, exceedsThreshold);
    
    // Log if enabled
    if (this.enableLogging) {
      console.log(`[TokenForwarder] Token forwarded in ${latencyMs.toFixed(3)}ms`);
    }
    
    // Trigger warning callback if threshold exceeded
    if (exceedsThreshold && this.onLatencyWarning) {
      this.onLatencyWarning(latencyMs, token);
    }
    
    this.lastForwardTime = forwardEndTime;
    
    return {
      success: true,
      latencyMs,
      exceedsThreshold,
      timestamp,
    };
  }

  /**
   * Forward multiple tokens in batch with individual timing
   * 
   * @param tokens - Array of tokens to forward
   * @param receiptTime - The time the tokens were received
   * @returns Array of TokenForwardResult
   */
  forwardBatch(tokens: string[], receiptTime: number = performance.now()): TokenForwardResult[] {
    return tokens.map((token, index) => {
      // Adjust receipt time slightly for each token in batch
      // to maintain accurate per-token timing
      const adjustedReceiptTime = receiptTime + (index * 0.01);
      return this.forward(token, adjustedReceiptTime);
    });
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(latencyMs: number, exceedsThreshold: boolean): void {
    this.totalTokensForwarded++;
    this.totalForwardingTime += latencyMs;
    
    if (latencyMs > this.maxLatency) {
      this.maxLatency = latencyMs;
    }
    if (latencyMs < this.minLatency) {
      this.minLatency = latencyMs;
    }
    if (exceedsThreshold) {
      this.tokensExceedingThreshold++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): TokenForwardingMetrics {
    return {
      totalTokensForwarded: this.totalTokensForwarded,
      totalForwardingTime: this.totalForwardingTime,
      averageLatency: this.totalTokensForwarded > 0 
        ? this.totalForwardingTime / this.totalTokensForwarded 
        : 0,
      maxLatency: this.maxLatency === 0 ? 0 : this.maxLatency,
      minLatency: this.minLatency === Infinity ? 0 : this.minLatency,
      tokensExceedingThreshold: this.tokensExceedingThreshold,
      lastForwardTime: this.lastForwardTime,
    };
  }

  /**
   * Check if all tokens have been forwarded within threshold
   */
  isWithinLatencyThreshold(): boolean {
    return this.tokensExceedingThreshold === 0;
  }

  /**
   * Get the percentage of tokens forwarded within threshold
   */
  getSuccessRate(): number {
    if (this.totalTokensForwarded === 0) return 100;
    const successfulTokens = this.totalTokensForwarded - this.tokensExceedingThreshold;
    return (successfulTokens / this.totalTokensForwarded) * 100;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalTokensForwarded = 0;
    this.totalForwardingTime = 0;
    this.maxLatency = 0;
    this.minLatency = Infinity;
    this.tokensExceedingThreshold = 0;
    this.lastForwardTime = 0;
  }

  /**
   * Set the maximum latency threshold
   */
  setMaxLatency(ms: number): void {
    this.maxLatencyMs = ms;
  }

  /**
   * Get the current maximum latency threshold
   */
  getMaxLatency(): number {
    return this.maxLatencyMs;
  }
}

/**
 * Factory function to create a TokenForwarder
 */
export function createTokenForwarder(options: TokenForwarderOptions): TokenForwarder {
  return new TokenForwarder(options);
}

/**
 * Utility function to measure token forwarding latency
 * Useful for testing and benchmarking
 * 
 * @param forwardFn - The forwarding function to measure
 * @param token - The token to forward
 * @returns Latency in milliseconds
 */
export function measureForwardLatency(
  forwardFn: (token: string) => void,
  token: string
): number {
  const start = performance.now();
  forwardFn(token);
  return performance.now() - start;
}

/**
 * Creates an optimized SSE encoder for token forwarding
 * Pre-computes the SSE format to minimize string operations during forwarding
 * 
 * @param eventType - The SSE event type (default: 'token')
 * @returns Encoder function that returns Uint8Array
 */
export function createOptimizedSSEEncoder(eventType: string = 'token'): (token: string) => Uint8Array {
  const encoder = new TextEncoder();
  const prefix = `data: {"type":"${eventType}","content":"`;
  const suffix = `","timestamp":`;
  const end = '}\n\n';
  
  return (token: string): Uint8Array => {
    // Escape special characters in token for JSON
    const escapedToken = token
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    
    const message = prefix + escapedToken + suffix + Date.now() + end;
    return encoder.encode(message);
  };
}

/**
 * High-performance token stream processor
 * Processes tokens from an async iterator with optimized forwarding
 * 
 * @param tokenStream - Async iterator of tokens
 * @param forwarder - TokenForwarder instance
 * @returns Promise that resolves when stream is complete
 */
export async function processTokenStream(
  tokenStream: AsyncIterable<string>,
  forwarder: TokenForwarder
): Promise<TokenForwardingMetrics> {
  for await (const token of tokenStream) {
    const receiptTime = performance.now();
    forwarder.forward(token, receiptTime);
  }
  return forwarder.getMetrics();
}
