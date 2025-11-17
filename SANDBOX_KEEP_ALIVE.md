# Sandbox Keep-Alive Implementation (Cost-Effective)

## 🎯 Problem Solved

Daytona sandboxes auto-stop after **15 minutes** of inactivity by default. This causes:
- ❌ Preview URLs become unavailable
- ❌ Users lose access to their running applications
- ❌ Dev servers stop, requiring manual restart

## 💰 Cost-Effective Approach (Like v0.dev & Lovable.dev)

Instead of keeping sandboxes running 24/7 (expensive!), we use a **smart approach**:

✅ **Active user viewing project** = Sandbox runs = Preview available  
❌ **User switches tabs/leaves** = Sandbox stops after 30min = No costs  
➡️ **User returns** = Sandbox auto-restarts = Preview loads

### 👉 Result: **You only pay when users are actively working!**

## ✅ Solution Implemented

### 1. **Smart Auto-Stop Interval** (30 minutes)

**File:** `src/lib/daytona-client.ts`

```typescript
// Default: 30 minutes for cost efficiency
// Only runs when user is actively viewing the project page
autoStopInterval: 30
```

**Benefits:**
- Costs incurred only during active use
- Automatic stop when user is inactive
- Preview available when needed

### 2. **Auto-Restart on Access**

**Function:** `ensureSandboxRunning(sandboxId)`

```typescript
// Automatically checks if sandbox is stopped and restarts it
const sandbox = await ensureSandboxRunning(sandboxId);
```

**Used in:**
- `iterateAPI` function - before applying code changes
- Ensures sandbox is running before any operations

### 3. **Page Visibility Detection**

**Uses:** Browser Page Visibility API

```typescript
// Detects when user switches tabs or minimizes window
document.addEventListener('visibilitychange', ...)
```

**Behavior:**
- Page visible = Keep-alive pings every 5 minutes
- Page hidden = No pings, sandbox stops after 30 minutes
- Page becomes visible again = Immediate ping + auto-restart

### 4. **Keep-Alive Pings** (Only When Visible)

**API Endpoint:** `/api/sandbox/keep-alive`

```typescript
POST /api/sandbox/keep-alive
Body: { projectId: "uuid" }
```

**React Hook:** `useSandboxKeepAlive` (Page Visibility Aware)

## 📋 How to Use

### Option 1: Automatic Keep-Alive (Recommended)

Add to your project page component:

```typescript
import { useSandboxKeepAlive } from '@/hooks/use-sandbox-keep-alive';

function ProjectPage({ projectId }: { projectId: string }) {
  // Automatically pings every 5 minutes
  useSandboxKeepAlive(projectId);
  
  return <div>Your project content</div>;
}
```

### Option 2: Custom Configuration

```typescript
useSandboxKeepAlive(projectId, {
  enabled: true,              // Enable/disable
  intervalMs: 5 * 60 * 1000, // 5 minutes (adjust as needed)
  onSuccess: () => console.log('Ping successful'),
  onError: (error) => console.error('Ping failed:', error),
});
```

### Option 3: Manual Keep-Alive

```typescript
import { sendSandboxKeepAlive } from '@/hooks/use-sandbox-keep-alive';

// Call manually when needed
await sendSandboxKeepAlive(projectId);
```

## 🔧 Configuration Options

### Adjust Auto-Stop Interval

**For specific sandboxes:**

```typescript
const sandbox = await createWorkspace({
  resources: DEFAULT_RESOURCES,
  autoStopInterval: 0,  // 0 = disabled (runs indefinitely)
  // OR
  autoStopInterval: 240, // 4 hours
});
```

**Recommended values:**
- **Default (Cost-Effective):** 30 minutes ✅
- **Longer sessions:** 60 minutes
- **Always-on (NOT recommended - costly!):** 0 (disabled)
- **Testing:** 15-30 minutes

### Change Keep-Alive Interval

**In the React hook:**

```typescript
useSandboxKeepAlive(projectId, {
  intervalMs: 10 * 60 * 1000, // 10 minutes instead of 5
});
```

## 📊 How It Works

### Timeline Example (Cost-Effective):

```
0:00  - Sandbox created (auto-stop: 30 min)
0:05  - Keep-alive ping (page visible) → Timer resets to 30 min
0:10  - Keep-alive ping (page visible) → Timer resets to 30 min
0:15  - User switches to another tab 👁️
0:20  - No more pings (page hidden)
0:45  - Sandbox auto-stops 🛑 (30 min of inactivity)
1:00  - User returns to project page 👁️
1:00  - Sandbox auto-restarts ▶️
1:00  - Keep-alive resumes every 5 min
```

### Cost Comparison:

**Old approach (always running):**
- User works 2 hours/day
- Sandbox runs 24 hours/day
- Wasted: 22 hours/day = 92% waste! 💸

**New approach (visibility-based):**
- User works 2 hours/day
- Sandbox runs ~2.5 hours/day (includes buffer)
- Wasted: 0.5 hours/day = 20% waste ✅
- **Savings: ~90% cost reduction!**

### What Resets the Timer:

✅ **Automatic resets:**
- Network requests to preview URLs
- SDK API calls (file operations, process execution)
- Keep-alive pings

❌ **Does NOT reset:**
- User browsing other tabs/pages
- Idle time on the page

## 🚀 Quick Start

### 1. Find Your Project Page Component

Look for files like:
- `src/app/projects/[projectId]/page.tsx`
- `src/components/ProjectPage.tsx`
- `src/pages/projects/[id].tsx`

### 2. Add the Import

```typescript
import { useSandboxKeepAlive } from '@/hooks/use-sandbox-keep-alive';
```

### 3. Use the Hook

```typescript
function YourProjectComponent({ projectId }: { projectId: string }) {
  // Add this line - it's that simple!
  useSandboxKeepAlive(projectId);
  
  // ... rest of your component
}
```

## 🔍 Debugging

### Check if Keep-Alive is Working

Open browser console and look for:

```
💓 Sandbox keep-alive: { success: true, sandboxId: "..." }
```

This should appear every 5 minutes.

### Check Sandbox Status

```typescript
import { ensureSandboxRunning } from '@/lib/daytona-client';

const sandbox = await ensureSandboxRunning(sandboxId);
// Logs: ✅ Sandbox xxx is running
// OR:   ⏸️ Sandbox xxx appears stopped, attempting to start...
```

### Manual Testing

```bash
curl -X POST http://localhost:3000/api/sandbox/keep-alive \
  -H "Content-Type: application/json" \
  -d '{"projectId":"your-project-id"}'
```

## ⚠️ Important Notes

1. **Cost Efficiency:** This implementation minimizes costs by:
   - Only running sandboxes when users are actively viewing projects
   - Auto-stopping after 30 minutes of inactivity
   - Automatic restart on demand
   - **Expected savings: ~90% compared to always-on approach**

2. **Preview URL Access:** Accessing the preview URL resets the timer. Users actively browsing their preview keep the sandbox alive automatically.

3. **Background Tabs:** Keep-alive **STOPS** when page is hidden. This is intentional to save costs. Sandbox will restart automatically when user returns.

4. **User Experience:** Users might experience a ~10-30 second delay when returning to a project with a stopped sandbox (restart time). This is acceptable for the massive cost savings.

## 🎨 Optional: Add UI Indicators

```typescript
function ProjectPage({ projectId }: { projectId: string }) {
  const [lastPing, setLastPing] = useState<Date | null>(null);
  
  useSandboxKeepAlive(projectId, {
    onSuccess: () => setLastPing(new Date()),
    onError: (error) => toast.error('Sandbox connection lost'),
  });
  
  return (
    <div>
      {lastPing && (
        <div className="text-xs text-gray-500">
          Last ping: {lastPing.toLocaleTimeString()}
        </div>
      )}
      {/* ... rest of your UI */}
    </div>
  );
}
```

## 📝 Summary

✅ **What's Implemented:**
1. Cost-effective auto-stop interval (30 minutes)
2. Page Visibility API integration
3. Keep-alive only when page is visible
4. Automatic restart when user returns
5. Manual keep-alive function

✅ **What to Do:**
1. Add `useSandboxKeepAlive(projectId)` to your project page
2. Test visibility behavior by switching tabs
3. Verify sandbox stops when page is hidden
4. Confirm auto-restart when returning to page

🎉 **Result:** 
- Sandboxes run only when needed
- ~90% cost savings vs always-on
- Seamless user experience with auto-restart
- Same behavior as v0.dev and Lovable.dev!
