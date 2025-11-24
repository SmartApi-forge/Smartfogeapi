# SSE Connection Fix - Stream Not Connected Issue

## Problem
Backend emits: `[StreamingService] No connections for project 8b4aaa39-aa0f-431e-8d36-84407bf862de`
This means events are being emitted but no frontend is connected.

## Root Causes
1. **Timing issue**: Inngest starts before SSE connects
2. **Connection drops**: SSE disconnects before events arrive
3. **Silent failures**: No errors shown when connection fails

## Solution

### Fix 1: Add Connection Status Indicator in StreamingService

**File:** `src/services/streaming-service.ts`

Add logging to track when connections are added/removed:

```typescript
addConnection(projectId: string, send: (data: string) => void): () => void {
  const connection: Connection = { send };
  const connections = this.connections.get(projectId) || [];
  connections.push(connection);
  this.connections.set(projectId, connections);

  // ADD THIS LOGGING
  console.log(`[StreamingService] ✅ Connection added for project ${projectId}. Total connections: ${connections.length}`);

  return () => {
    const conns = this.connections.get(projectId) || [];
    const index = conns.indexOf(connection);
    if (index > -1) {
      conns.splice(index, 1);
      if (conns.length === 0) {
        this.connections.delete(projectId);
        console.log(`[StreamingService] ❌ Last connection removed for project ${projectId}`);
      } else {
        this.connections.set(projectId, conns);
        console.log(`[StreamingService] ⚠️  Connection removed for project ${projectId}. Remaining: ${conns.length}`);
      }
    }
  };
}
```

### Fix 2: Wait for SSE Connection Before Triggering Inngest

**File:** `app/projects/[projectId]/project-page-client.tsx`

Modify the `handleSend` function to wait for connection:

```typescript
const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();
  const messageContent = message.trim();
  if (!messageContent || isSending || !project) return;

  setIsSending(true);

  try {
    // 1. Ensure SSE is connected FIRST
    if (!streamState.isConnected) {
      console.warn('[ProjectPage] SSE not connected, waiting...');
      // Wait up to 3 seconds for connection
      const maxWait = 3000;
      const startTime = Date.now();
      while (!streamState.isConnected && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!streamState.isConnected) {
        throw new Error('Failed to establish real-time connection. Please refresh and try again.');
      }
    }
    
    console.log('[ProjectPage] ✅ SSE connected, proceeding with API call');

    // 2. Create message
    const message = await createMessage.mutateAsync({
      project_id: projectId,
      content: messageContent,
      role: 'user',
      type: 'text',
    });

    // ... rest of existing code
  } catch (error) {
    // ... error handling
  }
};
```

### Fix 3: Add Retry Logic in use-generation-stream.ts

**File:** `hooks/use-generation-stream.ts`

Modify the connection logic to retry faster:

```typescript
eventSource.onerror = (error) => {
  console.error('[useGenerationStream] Stream error:', error);
  setIsConnected(false);
  eventSource.close();
  
  // Decrement active streaming sessions counter
  if (typeof window !== 'undefined') {
    (window as any).__activeStreamingSessions = Math.max(0, ((window as any).__activeStreamingSessions || 1) - 1);
  }

  // IMPROVED: Faster reconnect, more attempts
  if (state.status !== 'complete' && state.status !== 'error') {
    console.log('[useGenerationStream] ⚠️  Connection lost, reconnecting in 1s...');
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[useGenerationStream] 🔄 Attempting to reconnect...');
      connect();
    }, 1000); // Changed from 2000ms to 1000ms for faster recovery
  }
};
```

### Fix 4: Add Visual Connection Status

**File:** `app/projects/[projectId]/project-page-client.tsx`

Add a connection status indicator in the UI:

```typescript
// Add after line 783
const streamState = useGenerationStream(projectId);

// Add connection status toast
useEffect(() => {
  if (streamState.isConnected) {
    console.log('✅ Real-time connection established');
  } else {
    console.warn('⚠️  Real-time connection not active');
  }
}, [streamState.isConnected]);
```

## Testing

After applying fixes:

1. Open browser console
2. Navigate to a project
3. Check for: `[StreamingService] ✅ Connection added`
4. Send a message
5. Verify: `[ProjectPage] ✅ SSE connected, proceeding with API call`
6. Check events arrive in real-time

## Quick Fix (Temporary)

If you need an immediate workaround, add a small delay before triggering inngest:

```typescript
// In src/modules/api-generation/router.ts
triggerIteration: baseProcedure
  .mutation(async ({ input }) => {
    // Give SSE 500ms to connect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await inngest.send({
      name: 'api/iterate',
      data: { ...input }
    });
    
    return { success: true };
  }),
```

This is not ideal but will help while implementing proper fixes.
