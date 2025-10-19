import { StreamEvent, StreamEventWithTimestamp } from '../types/streaming';
import { supabaseServer } from '../../lib/supabase-server';

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

    // Save relevant events to database for persistence
    await this.saveEventToDatabase(projectId, eventWithTimestamp);
  }

  /**
   * Save generation event to database for persistence across reloads
   */
  private async saveEventToDatabase(projectId: string, event: StreamEventWithTimestamp): Promise<void> {
    try {
      // Save progress events for persistence
      const relevantEvents: Record<string, { icon: string; messageFormatter: (event: any) => string }> = {
        'project:created': {
          icon: 'in-progress',
          messageFormatter: (e) => 'Project created'
        },
        'step:start': {
          icon: 'in-progress',
          messageFormatter: (e) => e.message || e.step
        },
        'step:complete': {
          icon: 'complete',
          messageFormatter: (e) => `✓ ${e.message || e.step}`
        },
        'file:complete': {
          icon: 'complete',
          messageFormatter: (e) => `✓ Created ${e.filename}`
        },
        'validation:start': {
          icon: 'in-progress',
          messageFormatter: (e) => e.stage || 'Validating...'
        },
        'validation:complete': { 
          icon: 'complete', 
          messageFormatter: (e) => `✓ ${e.summary || e.stage || 'Code validated successfully'}` 
        },
        'complete': { 
          icon: 'complete', 
          messageFormatter: (e) => `✓ ${e.summary}` 
        },
        'error': {
          icon: 'error',
          messageFormatter: (e) => `✗ ${e.message}`
        }
      };

      const eventConfig = relevantEvents[event.type];
      if (!eventConfig) {
        return; // Skip events that shouldn't be persisted
      }

      const message = eventConfig.messageFormatter(event);
      
      // For step:complete events, check if we already have this step saved to avoid duplicates
      if (event.type === 'step:complete' || event.type === 'file:complete') {
        const { data: existing } = await supabaseServer
          .from('generation_events')
          .select('id')
          .eq('project_id', projectId)
          .eq('event_type', event.type)
          .eq('message', message)
          .maybeSingle();

        if (existing) {
          console.log(`[StreamingService] Event already exists, skipping: ${event.type} for project ${projectId}`);
          return;
        }
      }
      
      const { error } = await supabaseServer
        .from('generation_events')
        .insert({
          project_id: projectId,
          event_type: event.type,
          filename: 'filename' in event ? event.filename : null,
          message,
          icon: eventConfig.icon,
          timestamp: new Date(event.timestamp).toISOString(),
          metadata: event,
          version_id: 'versionId' in event ? event.versionId : null,
        });

      if (error) {
        console.error('[StreamingService] Error saving event to database:', error);
      } else {
        console.log(`[StreamingService] Saved ${event.type} event to database for project ${projectId}`);
      }
    } catch (error) {
      console.error('[StreamingService] Error in saveEventToDatabase:', error);
    }
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
    return `data: ${JSON.stringify(event)}\n\n`;
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

