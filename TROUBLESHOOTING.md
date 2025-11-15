# Troubleshooting Guide

## Fixed Issues

### Issue 1: `sandbox.fs.writeFile is not a function` Error

**Problem:** The validation process was failing with:
```
TypeError: sandbox.fs.writeFile is not a function
```

**Root Cause:** The code was using an incorrect method name from the Daytona SDK. The actual Daytona SDK v0.115.0 uses `uploadFile()` instead of `writeFile()`.

**What Was Fixed:** Changed all file system write operations from:
```typescript
await sandbox.fs.writeFile(Buffer.from(content), 'path/to/file');
```

To the correct method:
```typescript
await sandbox.fs.uploadFile(Buffer.from(content), 'path/to/file');
```

### Issue 2: `Cannot read properties of undefined (reading 'run')` Error

**Problem:** Validation was failing with:
```
TypeError: Cannot read properties of undefined (reading 'run')
```

**Root Cause:** The code was using `sandbox.commands.run()` which doesn't exist in the Daytona SDK. The correct API is `sandbox.process.executeCommand()`.

**What Was Fixed:**

1. **Changed method calls** from `sandbox.commands.run()` to `sandbox.process.executeCommand()`

2. **Updated return value handling:**
   - Old: `response.stdout` and `response.stderr`
   - New: `response.result` (combined output)

3. **Fixed parameter syntax:**
   - Old: `sandbox.commands.run(cmd, { timeoutMs: 15000 })`
   - New: `sandbox.process.executeCommand(cmd, workDir, envVars, timeoutInSeconds)`

**Files Updated:**
1. `src/inngest/functions.ts` - Fixed all validation-related command executions:
   - TypeScript validation
   - JavaScript validation  
   - Syntax validation
   - Test validation
2. `daytona-official-docs-guide.md` - Updated documentation 
3. `daytona-complete-guide.md` - Updated documentation

## Streaming Service "No connections" Warnings

### What It Means
The logs show:
```
[StreamingService] No connections for project <id>. Event: code:chunk
```

### Why This Happens
This is **not an error** - it's just a warning that occurs when:
- The backend Inngest function starts emitting events immediately
- The frontend hasn't established its SSE connection yet
- The connection timing between backend job start and frontend connection has a small gap

### Why It's Not a Problem
- All events are still being saved to the database (via `saveEventToDatabase()`)
- The frontend fetches historical events from the database when it connects
- No data or progress information is lost
- This is a normal race condition in event-driven architectures

### If You Want to Reduce These Warnings
You could:
1. Have the frontend establish the SSE connection before triggering the job
2. Add a small delay before emitting events in the backend
3. Ignore these warnings - they're harmless

## Testing the Fix

Try running your API generation again:
```
POST /api/generate
{
  "prompt": "create a user auth api with jwt"
}
```

The validation should now complete successfully without the `sandbox.fs.writeFile` error.
