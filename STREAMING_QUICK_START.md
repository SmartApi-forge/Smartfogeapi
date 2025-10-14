# Streaming API Generation - Quick Start Guide

## Getting Started in 5 Minutes

### 1. Install Dependencies (if needed)

The implementation uses existing dependencies. Verify they're installed:

```bash
npm install
```

### 2. Start the Development Servers

You need **two terminals**:

**Terminal 1 - Next.js App:**
```bash
npm run dev
```

**Terminal 2 - Inngest Dev Server:**
```bash
npx inngest-cli@latest dev
```

### 3. Test the Streaming Feature

1. **Open the app**: http://localhost:3000
2. **Navigate to dashboard**: Click "Get Started" or go to `/dashboard`
3. **Enter a prompt**: 
   ```
   Create a simple todo API with CRUD operations
   ```
4. **Watch the magic happen**:
   - You'll be redirected to the project page
   - **Chat area** (left): See real-time progress messages
     - "Planning API structure..." 🔄
     - "Generating index.js..." 🔄
     - "✓ Created index.js" ✅
     - "Generating package.json..." 🔄
     - "✓ Created package.json" ✅
     - "Validating generated code..." 🔄
     - "✓ API generated successfully!" ✅
   - **Code viewer** (right): Watch code type out in real-time
   - **Progress bar** (top): See which phase is active

### 4. Verify Streaming is Working

**Check Browser DevTools:**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Look for `EventSource` connection to `/api/stream/[projectId]`
4. You should see events streaming in

**Check Terminal Logs:**
```
[StreamingService] Added connection for project abc-123. Total connections: 1
[StreamingService] Emitting file:generating to 1 connection(s)
[useGenerationStream] Received event: file:generating
```

## How It Works

### Frontend (Browser)

```typescript
// Automatically set up in project page
const streamState = useGenerationStream(projectId);

// Access streaming state
streamState.status          // 'generating', 'validating', etc.
streamState.currentFile     // Currently generating file
streamState.generatedFiles  // Array of files with content
streamState.isStreaming     // true when actively streaming
streamState.events          // All events received
```

### Backend (Inngest)

```typescript
// Streaming events are automatically emitted during generation

// 1. When generation starts
await streamingService.emit(projectId, {
  type: 'project:created',
  projectId,
  prompt,
});

// 2. For each file
await streamingService.emit(projectId, {
  type: 'file:generating',
  filename: 'index.js',
  path: 'index.js',
});

// 3. Code chunks (for typing animation)
await streamingService.emit(projectId, {
  type: 'code:chunk',
  filename: 'index.js',
  chunk: 'const express = require...',
  progress: 50,
});

// 4. When complete
await streamingService.emit(projectId, {
  type: 'complete',
  summary: 'API generated successfully!',
  totalFiles: 3,
});
```

## Customization

### Change Typing Speed

Edit `components/streaming-code-viewer.tsx`:

```typescript
// Current: 50ms delay between chunks
await new Promise(resolve => setTimeout(resolve, 50));

// Faster (25ms):
await new Promise(resolve => setTimeout(resolve, 25));

// Slower (100ms):
await new Promise(resolve => setTimeout(resolve, 100));
```

### Change Chunk Size

Edit `src/inngest/functions.ts`:

```typescript
// Current: 100 characters per chunk
const chunkSize = 100;

// Smaller chunks (more frequent updates):
const chunkSize = 50;

// Larger chunks (fewer updates):
const chunkSize = 200;
```

### Modify Progress Messages

Edit `src/inngest/functions.ts`:

```typescript
// Example: Change planning message
await streamingService.emit(projectId, {
  type: 'step:start',
  step: 'Planning',
  message: 'Analyzing requirements and planning API structure...', // Your custom message
});
```

### Add New Event Types

1. **Add type definition** in `src/types/streaming.ts`:

```typescript
export type StreamEvent =
  | // ... existing types
  | {
      type: 'custom:event';
      customField: string;
    };
```

2. **Emit event** in `src/inngest/functions.ts`:

```typescript
await streamingService.emit(projectId, {
  type: 'custom:event',
  customField: 'value',
});
```

3. **Handle event** in `hooks/use-generation-stream.ts`:

```typescript
case 'custom:event':
  // Handle your custom event
  newState.customData = streamEvent.customField;
  break;
```

4. **Display in UI** in `app/projects/[projectId]/project-page-client.tsx`:

```typescript
if (event.type === 'custom:event') {
  msgs.push({
    id: `custom-${event.timestamp}`,
    content: `Custom: ${event.customField}`,
    // ... other fields
  });
}
```

## Troubleshooting

### Problem: No events appear

**Solution 1**: Check Inngest dev server is running
```bash
npx inngest-cli@latest dev
```

**Solution 2**: Check browser console for errors
```javascript
// Should see:
[useGenerationStream] Connecting to stream for project abc-123
[useGenerationStream] Connected to stream
[useGenerationStream] Received event: project:created
```

**Solution 3**: Verify SSE endpoint is accessible
```bash
curl http://localhost:3000/api/stream/test-project-id
# Should establish connection and send heartbeats
```

### Problem: Events delayed or arrive in batches

**Cause**: Proxy buffering

**Solution**: Headers are already set in `app/api/stream/[projectId]/route.ts`:
```typescript
headers: {
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
}
```

If still buffered, check reverse proxy settings.

### Problem: Connection keeps dropping

**Check 1**: Heartbeat is working (every 30 seconds)
**Check 2**: Browser console for reconnection attempts
**Check 3**: Network tab for repeated connections

### Problem: Memory usage growing

**Check**: Connection cleanup logs
```
[StreamingService] Cleaned up 5 stale connection(s)
```

**Verify**: Connections close on project completion
```
[StreamingService] Closing 1 connection(s) for project abc-123
```

## Advanced Usage

### Manual Connection Control

```typescript
// In your component
const streamState = useGenerationStream(projectId);

// Manually reconnect
streamState.reconnect();

// Check connection status
if (streamState.isConnected) {
  console.log('Streaming active');
}
```

### Access Raw Events

```typescript
const streamState = useGenerationStream(projectId);

// All events with timestamps
streamState.events.forEach(event => {
  console.log(event.type, event.timestamp);
});
```

### Build Custom UI

```typescript
import { useGenerationStream } from '@/hooks/use-generation-stream';

function MyCustomStreamingUI({ projectId }) {
  const stream = useGenerationStream(projectId);

  if (stream.status === 'generating') {
    return (
      <div>
        <h2>Generating: {stream.currentFile}</h2>
        <progress value={stream.generatedFiles.length} max={10} />
      </div>
    );
  }

  return <div>Generation complete!</div>;
}
```

## Best Practices

1. **Always cleanup connections**: The hook handles this automatically
2. **Use polling as fallback**: Already implemented (10s interval during streaming)
3. **Show loading states**: While waiting for first event
4. **Handle errors gracefully**: Display error messages from stream
5. **Throttle UI updates**: Don't update on every single chunk if animating
6. **Monitor connection count**: In production, limit concurrent connections

## Performance Tips

1. **Reduce chunk frequency**: Emit chunks every N iterations instead of every one
2. **Batch small events**: Combine multiple small events into one
3. **Close connections promptly**: Always call `closeProject()` when done
4. **Limit event history**: Only keep recent events in state
5. **Debounce UI updates**: Use React's `useMemo` and `useCallback`

## Next Steps

1. **Test with large APIs**: Generate complex APIs with many files
2. **Test reconnection**: Refresh page mid-generation
3. **Monitor performance**: Check memory usage and connection counts
4. **Customize UI**: Adjust colors, animations, messages
5. **Add analytics**: Track generation times and user engagement

## Support

For issues or questions:
1. Check `STREAMING_IMPLEMENTATION.md` for detailed architecture
2. Review terminal logs for errors
3. Check browser console for client-side errors
4. Verify both dev servers are running

Happy streaming! 🚀

