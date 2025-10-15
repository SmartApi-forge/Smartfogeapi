import { streamingService } from '../../../../src/services/streaming-service';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events endpoint for streaming API generation progress
 * Clients connect to this endpoint and receive real-time updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!projectId) {
    return new Response('Project ID required', { status: 400 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering for Nginx
  });

  // Create a TransformStream for streaming
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  const send = (data: string) => {
    writer.write(encoder.encode(data));
  };

  // Send initial heartbeat
  send(': connected\n\n');

  // Set up connection callback
  const cleanup = streamingService.addConnection(projectId, (data: string) => {
    send(data);
  });

  // Set up heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    send(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    console.log(`[SSE] Client disconnected from project ${projectId}`);
    clearInterval(heartbeatInterval);
    cleanup();
    writer.close();
  });

  console.log(`[SSE] Client connected to project ${projectId}`);

  return new Response(stream.readable, { headers });
}

