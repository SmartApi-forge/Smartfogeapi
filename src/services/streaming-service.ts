import { StreamEvent, StreamEventWithTimestamp } from '@/types/streaming';

type ConnectionCallback = (data: string) => void;

interface Connection {
  projectId: string;
  callback: ConnectionCallback;
  timestamp: number;
}

/**
 * Streaming service for managing Server-Sent Events connections
 * Enables real-time progress updates during API generation
 */
class StreamingService {
  private connections: Map<string, Connection[]> = new Map();
  private static instance: StreamingService;

  private constructor() {
    // Cleanup old connections every 5 minutes
    setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000);
  }

  static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  /**
   * Add a new SSE connection for a project
   */
  addConnection(projectId: string, callback: ConnectionCallback): () => void {
    const connections = this.connections.get(projectId) || [];
    const connection: Connection = {
      projectId,
      callback,
      timestamp: Date.now(),
    };

    connections.push(connection);
    this.connections.set(projectId, connections);

    console.log(`[StreamingService] Added connection for project ${projectId}. Total connections: ${connections.length}`);

    // Return cleanup function
    return () => {
      this.removeConnection(projectId, callback);
    };
  }

  /**
   * Remove a specific SSE connection
   */
  removeConnection(projectId: string, callback: ConnectionCallback): void {
    const connections = this.connections.get(projectId) || [];
    const filtered = connections.filter((conn) => conn.callback !== callback);

    if (filtered.length === 0) {
      this.connections.delete(projectId);
    } else {
      this.connections.set(projectId, filtered);
    }

    console.log(`[StreamingService] Removed connection for project ${projectId}. Remaining: ${filtered.length}`);
  }

  /**
   * Emit an event to all connections for a specific project
   */
  async emit(projectId: string, event: StreamEvent): Promise<void> {
    const connections = this.connections.get(projectId);

    if (!connections || connections.length === 0) {
      console.log(`[StreamingService] No connections for project ${projectId}. Event: ${event.type}`);
      return;
    }

    const eventWithTimestamp: StreamEventWithTimestamp = {
      ...event,
      timestamp: Date.now(),
    };

    const formattedData = this.formatSSE(eventWithTimestamp);

    console.log(`[StreamingService] Emitting ${event.type} to ${connections.length} connection(s) for project ${projectId}`);

    // Send to all connections
    connections.forEach((connection) => {
      try {
        connection.callback(formattedData);
      } catch (error) {
        console.error(`[StreamingService] Error sending to connection:`, error);
      }
    });
  }

  /**
   * Close all connections for a project
   */
  closeProject(projectId: string): void {
    const connections = this.connections.get(projectId);

    if (connections) {
      console.log(`[StreamingService] Closing ${connections.length} connection(s) for project ${projectId}`);

      // Send close event
      connections.forEach((connection) => {
        try {
          connection.callback('event: close\ndata: {}\n\n');
        } catch (error) {
          console.error(`[StreamingService] Error closing connection:`, error);
        }
      });

      this.connections.delete(projectId);
    }
  }

  /**
   * Format event data as SSE
   */
  private formatSSE(event: StreamEventWithTimestamp): string {
    return `event: message\ndata: ${JSON.stringify(event)}\n\n`;
  }

  /**
   * Remove connections that haven't been used in over 1 hour
   */
  private cleanupStaleConnections(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleaned = 0;

    this.connections.forEach((connections, projectId) => {
      const active = connections.filter((conn) => conn.timestamp > oneHourAgo);

      if (active.length === 0) {
        this.connections.delete(projectId);
        cleaned += connections.length;
      } else if (active.length < connections.length) {
        this.connections.set(projectId, active);
        cleaned += connections.length - active.length;
      }
    });

    if (cleaned > 0) {
      console.log(`[StreamingService] Cleaned up ${cleaned} stale connection(s)`);
    }
  }

  /**
   * Get connection count for a project
   */
  getConnectionCount(projectId: string): number {
    return this.connections.get(projectId)?.length || 0;
  }

  /**
   * Get total connection count across all projects
   */
  getTotalConnections(): number {
    let total = 0;
    this.connections.forEach((connections) => {
      total += connections.length;
    });
    return total;
  }
}

// Export singleton instance
export const streamingService = StreamingService.getInstance();

