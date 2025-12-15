/**
 * Simple SSE Helper for V0/Lovable Architecture
 * 
 * Provides a clean, minimal API for Server-Sent Events streaming.
 * This is the simplified approach for the new direct streaming architecture.
 * 
 * Requirements: 1.2, 1.3
 */

/**
 * Core SSE event types for the V0/Lovable architecture
 */
export type SSEEventType = 
  | 'thinking'      // Initial thinking indicator
  | 'chunk'         // Token/content chunk
  | 'status'        // Status update message
  | 'file:reading'  // File being read for context
  | 'file:read:complete' // All files read
  | 'file:start'    // File generation started
  | 'file:complete' // File generation complete
  | 'tool:start'    // Tool invocation started
  | 'tool:complete' // Tool invocation complete
  | 'complete'      // Generation complete
  | 'error';        // Error occurred

/**
 * SSE Event structure
 */
export interface SSEEvent {
  type: SSEEventType;
  message?: string;
  content?: string;
  filename?: string;
  filesModified?: string[];
  fileCount?: number;
  turnIndex?: number;
  timestamp?: number;
  tool?: string;
  taskNameActive?: string;
  taskNameComplete?: string;
  result?: unknown;
}

/**
 * Format an event as SSE data
 */
export function formatSSE(event: SSEEvent): string {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || Date.now(),
  };
  return `data: ${JSON.stringify(eventWithTimestamp)}\n\n`;
}

/**
 * Create SSE headers for a streaming response
 */
export function createSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

/**
 * SSE Writer class for streaming responses
 * Provides a clean API for emitting events to a stream
 */
export class SSEWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder: TextEncoder;
  private closed: boolean = false;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
    this.encoder = new TextEncoder();
  }

  /**
   * Write an event to the stream
   */
  async write(event: SSEEvent): Promise<void> {
    if (this.closed) return;
    
    try {
      const data = formatSSE(event);
      await this.writer.write(this.encoder.encode(data));
    } catch (error) {
      console.error('[SSEWriter] Error writing event:', error);
    }
  }

  /**
   * Write a thinking indicator event
   */
  async writeThinking(message: string = 'Thinking...'): Promise<void> {
    await this.write({ type: 'thinking', message });
  }

  /**
   * Write a content chunk
   */
  async writeChunk(content: string): Promise<void> {
    await this.write({ type: 'chunk', content });
  }

  /**
   * Write a status update
   */
  async writeStatus(message: string): Promise<void> {
    await this.write({ type: 'status', message });
  }

  /**
   * Write a file reading event
   */
  async writeFileReading(filename: string): Promise<void> {
    await this.write({ type: 'file:reading', filename });
  }

  /**
   * Write a file read complete event
   */
  async writeFileReadComplete(fileCount: number): Promise<void> {
    await this.write({ type: 'file:read:complete', fileCount });
  }

  /**
   * Write a file start event
   */
  async writeFileStart(filename: string): Promise<void> {
    await this.write({ type: 'file:start', filename });
  }

  /**
   * Write a file complete event
   */
  async writeFileComplete(filename: string, content?: string): Promise<void> {
    await this.write({ type: 'file:complete', filename, content });
  }

  /**
   * Write a tool start event
   */
  async writeToolStart(tool: string, taskNameActive: string): Promise<void> {
    await this.write({ type: 'tool:start', tool, taskNameActive });
  }

  /**
   * Write a tool complete event
   */
  async writeToolComplete(tool: string, taskNameComplete: string, result?: unknown): Promise<void> {
    await this.write({ type: 'tool:complete', tool, taskNameComplete, result });
  }

  /**
   * Write a completion event
   */
  async writeComplete(filesModified: string[], turnIndex?: number): Promise<void> {
    await this.write({ 
      type: 'complete', 
      filesModified, 
      turnIndex,
      message: `Modified ${filesModified.length} file(s)`,
    });
  }

  /**
   * Write an error event
   */
  async writeError(message: string): Promise<void> {
    await this.write({ type: 'error', message });
  }

  /**
   * Close the stream
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    
    try {
      await this.writer.close();
    } catch (error) {
      console.error('[SSEWriter] Error closing stream:', error);
    }
  }

  /**
   * Check if the stream is closed
   */
  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * Create an SSE response with a writer
 * Returns both the Response and the SSEWriter for emitting events
 */
export function createSSEResponse(): { response: Response; writer: SSEWriter } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const streamWriter = writable.getWriter();
  const sseWriter = new SSEWriter(streamWriter);
  
  const response = new Response(readable, {
    headers: createSSEHeaders(),
  });
  
  return { response, writer: sseWriter };
}

/**
 * Parse SSE data from a string
 */
export function parseSSE(data: string): SSEEvent | null {
  try {
    // Remove "data: " prefix if present
    const jsonStr = data.startsWith('data: ') ? data.slice(6) : data;
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}
