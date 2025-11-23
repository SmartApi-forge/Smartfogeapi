import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const VERCEL_API_URL = 'https://api.vercel.com';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { deploymentId } = await params;

    // Create TransformStream (same pattern as existing SSE)
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    let isClosed = false;

    const send = (data: string) => {
      if (!isClosed) {
        try {
          writer.write(encoder.encode(data));
        } catch (error) {
          console.error('Failed to write to stream:', error);
          isClosed = true;
        }
      }
    };

    const sendEvent = (data: any) => {
      if (!isClosed) {
        send(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Send initial connection message
    send(': connected\n\n');

    console.log(`[SSE] Client connected for deployment ${deploymentId}`);

    // Start polling for logs in background
    (async () => {
      try {
        const teamId = process.env.VERCEL_TEAM_ID;
        const teamQuery = teamId ? `&teamId=${teamId}` : '';
        const url = `${VERCEL_API_URL}/v3/deployments/${deploymentId}/events?builds=1&limit=-1${teamQuery}`;

        console.log(`Starting log stream for deployment ${deploymentId}`);

        let isComplete = false;
        const seenEventIds = new Set<string>();
        let pollCount = 0;

        // Poll for new events and stream them
        while (!isComplete) {
          pollCount++;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${process.env.VERCEL_ACCESS_TOKEN}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Vercel API error: ${response.status}`);
          }

          const events = await response.json();
          
          if (!Array.isArray(events)) {
            throw new Error('Expected array of events from Vercel API');
          }

          // Stream only new events
          const newEvents = events.filter((e: any) => {
            const eventId = e.id || e.serial || `${e.created}-${e.type}`;
            if (seenEventIds.has(eventId)) return false;
            seenEventIds.add(eventId);
            return true;
          });

          if (newEvents.length > 0) {
            console.log(`Streaming ${newEvents.length} new events (total: ${events.length})`);
          }

          // Stream each new event to the client
          for (const event of newEvents) {
            // Format timestamp
            const timestamp = event.created || event.date;
            let timeStr = '';
            
            if (timestamp) {
              const date = new Date(timestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              const seconds = date.getSeconds().toString().padStart(2, '0');
              const ms = date.getMilliseconds().toString().padStart(3, '0');
              timeStr = `${hours}:${minutes}:${seconds}.${ms}`;
            }

            // Extract log text based on event type
            let logText = '';
            
            if (event.type === 'stdout' || event.type === 'stderr') {
              logText = event.text || event.payload?.text || '';
            } else if (event.type === 'command') {
              logText = `Running "${event.text || event.payload?.text || ''}"`;
            } else if (event.type === 'delimiter') {
              logText = event.text || event.payload?.text || '';
            }

            if (logText.trim()) {
              // Split multi-line logs and send immediately
              const logLines = logText.split('\n').filter(l => l.trim());
              if (logLines.length > 0) {
                console.log(`[Stream ${deploymentId}] Sending ${logLines.length} log lines (type: ${event.type})`);
              }
              for (const logLine of logLines) {
                sendEvent({
                  log: timeStr ? `${timeStr} ${logLine}` : logLine,
                  timestamp: timestamp,
                  type: event.type,
                });
              }
            }
          }

          // Check if deployment is complete by looking at the last event
          const lastEvent = events[events.length - 1];
          if (lastEvent) {
            // Check for completion indicators
            if (lastEvent.type === 'deployment-state' || 
                (lastEvent.payload?.readyState === 'READY') ||
                (lastEvent.payload?.readyState === 'ERROR')) {
              console.log('Deployment completed, closing stream');
              isComplete = true;
            }
          }

          // If no new events and we have events, check completion via separate API (but not every poll)
          if (newEvents.length === 0 && events.length > 0 && pollCount % 5 === 0) {
            // Only check status API every 5 polls to reduce overhead
            const statusResponse = await fetch(`${VERCEL_API_URL}/v13/deployments/${deploymentId}`, {
              headers: {
                Authorization: `Bearer ${process.env.VERCEL_ACCESS_TOKEN}`,
              },
            });
            
            if (statusResponse.ok) {
              const deployment = await statusResponse.json();
              if (deployment.readyState === 'READY' || deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
                console.log(`Deployment status: ${deployment.readyState}, closing stream`);
                isComplete = true;
              }
            }
          }

          // Wait before next poll - ultra-fast polling for real-time feel
          if (!isComplete) {
            // Adaptive polling: very fast when active, moderate when idle
            const pollDelay = newEvents.length > 0 ? 100 : 500; // 100ms if active, 500ms if idle
            await new Promise(resolve => setTimeout(resolve, pollDelay));
          }
        }

        // Send completion event
        sendEvent({ done: true });
        isClosed = true;
        writer.close();

      } catch (error: any) {
        console.error('Stream error:', error);
        sendEvent({ error: error.message });
        isClosed = true;
        writer.close();
      }
    })();

    // Set up heartbeat to keep connection alive (more frequent for faster feedback)
    const heartbeatInterval = setInterval(() => {
      if (!isClosed) {
        send(': heartbeat\n\n');
      }
    }, 10000); // Every 10 seconds (faster than API generation)

    // Handle client disconnect
    req.signal.addEventListener('abort', () => {
      console.log(`[SSE] Client disconnected from deployment ${deploymentId}`);
      isClosed = true;
      clearInterval(heartbeatInterval);
      writer.close();
    });

    // Return SSE response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('Stream setup error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
