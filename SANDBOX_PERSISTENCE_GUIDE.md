# Sandbox Persistence & Auto-Restoration Guide

## Overview

This system solves the E2B sandbox timeout issue by **automatically restoring sandboxes** when users reload the page or return after the sandbox has expired (5-10 mins on hobby plan).

## 🎯 Problem Solved

**Before**: When users reloaded the page after ~5 minutes, they'd see "Sandbox not found" error.

**After**: System automatically detects expired sandboxes and restores them from GitHub with zero user intervention.

---

## 🏗️ Architecture

### Three-Layer Approach

```
┌─────────────────────────────────────────────────┐
│  Frontend (SandboxPreview + useSandboxManager)  │
│  - Detects sandbox expiration                    │
│  - Triggers auto-restoration                     │
│  - Updates iframe without page reload            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  API Routes                                      │
│  - /api/sandbox/keepalive/[projectId]           │
│  - /api/sandbox/restart/[projectId]             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  E2B Sandbox + GitHub Repository                │
│  1. Create new sandbox                           │
│  2. Clone GitHub repo                            │
│  3. Install dependencies                         │
│  4. Start dev server                             │
└─────────────────────────────────────────────────┘
```

---

## 🔄 How It Works

### 1. On Page Load / Reload

```typescript
// hooks/use-sandbox-manager.ts
useEffect(() => {
  // Check if sandbox is still alive
  const status = await keepAlive();
  
  if (status.needsRestart) {
    // Auto-restore sandbox
    await restartSandbox();
  }
}, []);
```

**Flow**:
1. User opens project page
2. Hook checks sandbox status via `/api/sandbox/keepalive/[projectId]`
3. If sandbox expired → automatically calls `/api/sandbox/restart/[projectId]`
4. Restoration happens in background (30-60 seconds)
5. New sandbox URL updates iframe **without page reload**

### 2. During Active Session

```typescript
// Heartbeat every 5 minutes
setInterval(async () => {
  const status = await keepAlive();
  
  if (status.needsRestart) {
    await restartSandbox();
  }
}, 5 * 60 * 1000);
```

**Flow**:
1. Every 5 minutes, check sandbox status
2. If sandbox expires mid-session → auto-restore
3. User sees brief loading indicator
4. Preview seamlessly resumes with new sandbox

### 3. Full Restoration Process

When `/api/sandbox/restart/[projectId]` is called:

```typescript
// 1. Create new E2B sandbox (1-2 seconds)
const sandbox = await Sandbox.create(templateId, {
  timeoutMs: 3600000, // 1 hour
});

// 2. Clone GitHub repository (5-10 seconds)
await githubRepositoryService.cloneToSandbox(
  repoUrl,
  accessToken,
  sandbox
);

// 3. Install dependencies (15-30 seconds)
await githubRepositoryService.installDependencies(
  sandbox,
  repoPath,
  packageManager
);

// 4. Start dev server (5-10 seconds)
const previewResult = await githubRepositoryService.startPreviewServer(
  sandbox,
  { framework, port, startCommand },
  repoPath
);

// 5. Update database with new sandbox URL
await supabase
  .from('projects')
  .update({
    sandbox_url: previewResult.url,
    metadata: {
      sandboxId: sandbox.sandboxId,
      framework,
      port,
      lastSuccessfulRestore: new Date().toISOString(),
    }
  });
```

---

## 📊 User Experience

### Scenario 1: User Returns After 10 Minutes

```
1. User opens project → "Restoring sandbox..." (30-60s)
2. Preview loads automatically
3. No "Sandbox not found" error
```

### Scenario 2: Sandbox Expires During Active Session

```
1. Heartbeat detects expiration
2. Shows "Restoring sandbox..." indicator
3. Preview updates with new URL
4. User can continue working
```

### Scenario 3: Manual Restart

```
1. User clicks restart button
2. Shows restoration progress
3. New sandbox URL loads
```

---

## 🗄️ Database Schema

### Projects Table

```sql
-- Core columns
id UUID PRIMARY KEY
user_id UUID
repo_url TEXT
sandbox_url TEXT
framework TEXT

-- Persistence tracking
last_sandbox_check TIMESTAMP
sandbox_status TEXT CHECK (
  sandbox_status IN ('active', 'expired', 'restoring', 'failed', 'unknown')
)

-- Metadata JSONB
metadata JSONB
-- {
--   "sandboxId": "abc123",
--   "framework": "nextjs",
--   "port": 3000,
--   "packageManager": "npm",
--   "startCommand": "npm run dev",
--   "lastRestarted": "2024-01-01T00:00:00Z",
--   "lastSuccessfulRestore": "2024-01-01T00:00:00Z"
-- }
```

---

## 🔧 Configuration

### Framework Detection

```typescript
const frameworkConfig = {
  nextjs: { 
    port: 3000, 
    packageManager: 'npm', 
    startCommand: 'npm run dev' 
  },
  react: { 
    port: 3000, 
    packageManager: 'npm', 
    startCommand: 'npm start' 
  },
  vue: { 
    port: 5173, 
    packageManager: 'npm', 
    startCommand: 'npm run dev' 
  },
  fastapi: { 
    port: 8000, 
    packageManager: 'pip', 
    startCommand: 'uvicorn main:app --reload' 
  },
  // ... more frameworks
};
```

### E2B Sandbox Settings

```typescript
// Create sandbox with 1 hour timeout
const sandbox = await Sandbox.create(templateId, {
  timeoutMs: 3600000, // 1 hour (max on hobby plan)
});
```

---

## 📝 Key Files

### Frontend
- `hooks/use-sandbox-manager.ts` - Main lifecycle manager
- `components/sandbox-preview.tsx` - Preview UI with auto-restoration

### Backend
- `app/api/sandbox/keepalive/[projectId]/route.ts` - Health check
- `app/api/sandbox/restart/[projectId]/route.ts` - Full restoration

### Services
- `src/services/github-repository-service.ts` - GitHub operations
- `src/inngest/functions.ts` - Initial sandbox creation

### Database
- `supabase/migrations/015_sandbox_persistence_metadata.sql` - Schema

---

## ⚡ Performance

### Restoration Times (Typical)

| Framework | Clone | Install | Start | Total |
|-----------|-------|---------|-------|-------|
| Next.js   | 5-8s  | 20-30s  | 5-10s | 30-48s |
| React     | 5-8s  | 15-25s  | 3-5s  | 23-38s |
| FastAPI   | 5-8s  | 10-15s  | 2-3s  | 17-26s |

### Optimization Tips

1. **Use E2B Docker Template**: Pre-install common dependencies
2. **Cache node_modules**: Store in template for faster installs
3. **Lazy Load**: Only restore when user views preview tab

---

## 🚨 Error Handling

### Restoration Failures

```typescript
try {
  await restartSandbox();
} catch (error) {
  // Show error message to user
  setState({ 
    error: 'Failed to restore sandbox. Please try again.',
    isRestarting: false 
  });
  
  // Allow manual retry after 5 seconds
  setTimeout(() => {
    hasAttemptedRestart.current = false;
  }, 5000);
}
```

### Common Failure Scenarios

1. **GitHub Auth Expired**: Prompt user to reconnect GitHub
2. **Invalid Repository**: Show error with repo URL
3. **Build Errors**: Display build logs, allow retry
4. **Network Issues**: Auto-retry with exponential backoff

---

## 🎛️ Manual Controls

### For Users

```tsx
<button onClick={sandbox.manualRestart}>
  Restart Sandbox
</button>
```

### For Debugging

```typescript
// Check current status
console.log(sandbox.isAlive); // true/false
console.log(sandbox.isRestarting); // true/false
console.log(sandbox.lastKeepAlive); // timestamp
console.log(sandbox.error); // error message or null
```

---

## 🔮 Future Enhancements

### Planned Features

1. **Progressive Restoration UI**: Show real-time steps (clone → install → start)
2. **Build Caching**: Store built artifacts for instant restores
3. **Multi-Sandbox Support**: Different sandboxes for different branches
4. **Sandbox Pooling**: Pre-warm sandboxes for instant availability
5. **Cost Optimization**: Auto-pause inactive sandboxes, resume on demand

### E2B Pro Plan Benefits

If upgraded to Pro plan:
- **24-hour sandbox lifetime** (vs 1 hour on hobby)
- **Faster restoration** with better infrastructure
- **More concurrent sandboxes**
- **Better caching** and persistence options

---

## 📋 Testing

### Test Scenarios

1. **Reload Test**: 
   - Open project
   - Wait 10 minutes
   - Reload page
   - ✅ Sandbox auto-restores

2. **Expiration Test**:
   - Keep project open
   - Wait 60+ minutes
   - ✅ Sandbox auto-restores mid-session

3. **Manual Restart**:
   - Click restart button
   - ✅ Shows progress, loads new sandbox

4. **Error Recovery**:
   - Disconnect GitHub
   - ✅ Shows appropriate error
   - Reconnect GitHub
   - ✅ Restart works

---

## 🎉 Benefits

### For Users
- ✅ No "Sandbox not found" errors
- ✅ Seamless experience on page reload
- ✅ Zero manual intervention needed
- ✅ Preview always available

### For Developers
- ✅ Clean architecture with hooks
- ✅ Easy to extend and maintain
- ✅ Comprehensive error handling
- ✅ Observable with detailed logging

### For Product
- ✅ Better user retention
- ✅ Reduced support tickets
- ✅ Professional UX
- ✅ Competitive advantage

---

## 📞 Support

If sandboxes fail to restore:
1. Check GitHub integration is active
2. Verify repository URL is accessible
3. Check E2B API key is valid
4. Review server logs for specific errors
5. Try manual restart button

For persistent issues, contact support with:
- Project ID
- Error messages
- Browser console logs
- Network tab screenshots
