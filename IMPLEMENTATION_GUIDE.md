# 🚀 Quick Implementation Guide - Cost-Effective Sandbox Management

## 📊 The Problem & Solution

**Problem:** Running sandboxes 24/7 = 💰 Very expensive  
**Solution:** Only run when user is actively viewing = 💰 ~90% cost savings

---

## ✅ Step 1: Add Keep-Alive Hook to Your Project Page

Find your main project page component and add:

```typescript
import { useSandboxKeepAlive } from '@/hooks/use-sandbox-keep-alive';

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  // Add this line - that's it!
  useSandboxKeepAlive(params.projectId);
  
  return (
    <div>
      {/* Your existing project UI */}
    </div>
  );
}
```

**That's literally it for basic functionality!** ✨

---

## 🎨 Step 2 (Optional): Add Status Indicator

Show users when sandbox is active:

```typescript
import { SandboxStatusIndicator } from '@/components/sandbox-status-indicator';

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  useSandboxKeepAlive(params.projectId);
  
  return (
    <div>
      {/* Add status indicator in your header/toolbar */}
      <SandboxStatusIndicator projectId={params.projectId} />
      
      {/* Your existing project UI */}
    </div>
  );
}
```

**Or minimal version:**

```typescript
import { SandboxStatusDot } from '@/components/sandbox-status-indicator';

<SandboxStatusDot projectId={params.projectId} />
```

---

## 🧪 Step 3: Test It

### Test 1: Verify Keep-Alive Works

1. Open your project page
2. Open browser DevTools → Console
3. You should see: `💓 Sandbox keep-alive (page visible): { success: true }`
4. This repeats every 5 minutes

### Test 2: Verify Page Visibility Detection

1. Keep Console open on your project page
2. Switch to another tab
3. You should see: `👁️ Page hidden - sandbox will auto-stop after 30min to save costs`
4. Switch back to your project tab
5. You should see: `👁️ Page visible - keeping sandbox alive`

### Test 3: Verify Auto-Stop & Restart

1. Open your project (preview should load)
2. Switch to another tab for 30+ minutes
3. Sandbox stops automatically (saving costs!)
4. Return to your project tab
5. Sandbox restarts automatically (preview loads again)

---

## 📋 What's Already Configured

✅ **Default auto-stop:** 30 minutes (in `src/lib/daytona-client.ts`)  
✅ **Keep-alive interval:** 5 minutes (in hook)  
✅ **Page visibility detection:** Built-in  
✅ **Auto-restart on return:** Built-in (`ensureSandboxRunning`)  
✅ **Keep-alive API:** `/api/sandbox/keep-alive`

---

## 🎯 Expected Behavior

### When User is Active (Tab Visible):
- ✅ Keep-alive pings every 5 minutes
- ✅ Sandbox stays running
- ✅ Preview always available
- ✅ Small cost (only while active)

### When User Switches Tabs:
- 🛑 Keep-alive stops immediately
- ⏰ Sandbox continues for 30 minutes
- 🛑 Sandbox auto-stops after 30 min
- 💰 No more costs!

### When User Returns:
- 🔄 Auto-restart triggered
- ⏱️ ~10-30 second wait
- ✅ Preview loads
- ✅ Keep-alive resumes

---

## 💰 Cost Savings Calculator

**Example: User works 2 hours/day**

### Without This Feature (Always Running):
```
Sandbox runs: 24 hours/day
User works: 2 hours/day
Wasted: 22 hours/day
Waste %: 92%
Monthly cost: $720 (example)
```

### With This Feature (Visibility-Based):
```
Sandbox runs: ~2.5 hours/day
User works: 2 hours/day
Wasted: 0.5 hours/day
Waste %: 20%
Monthly cost: $75 (example)
Savings: $645/month (90%)
```

**ROI: Pays for itself immediately!** 🎉

---

## 🔧 Customization Options

### Adjust Auto-Stop Interval:

**Longer sessions (60 min):**
```typescript
const sandbox = await createWorkspace({
  autoStopInterval: 60, // 60 minutes
});
```

**Shorter sessions (15 min):**
```typescript
const sandbox = await createWorkspace({
  autoStopInterval: 15, // 15 minutes
});
```

### Adjust Keep-Alive Interval:

```typescript
useSandboxKeepAlive(projectId, {
  intervalMs: 10 * 60 * 1000, // 10 minutes instead of 5
});
```

### Disable for Specific Projects:

```typescript
useSandboxKeepAlive(projectId, {
  enabled: false, // Disable keep-alive
});
```

---

## 🐛 Troubleshooting

### Issue: "Keep-alive not working"

**Check:**
1. Console shows keep-alive logs?
2. Project has `metadata.sandboxId`?
3. Hook is in a client component? (`'use client'`)

### Issue: "Sandbox never stops"

**Check:**
1. User keeps tab open?
2. `autoStopInterval` set too high?
3. Preview URL being accessed by bots?

### Issue: "Sandbox takes long to restart"

**Expected:** First restart can take 30-60 seconds  
**Solution:** This is normal, loading indicator helps

---

## 📚 Files Modified

✅ `src/lib/daytona-client.ts` - Auto-stop config + helper functions  
✅ `src/hooks/use-sandbox-keep-alive.ts` - React hook  
✅ `src/app/api/sandbox/keep-alive/route.ts` - API endpoint  
✅ `src/components/sandbox-status-indicator.tsx` - Status UI  
✅ `src/inngest/functions.ts` - Auto-restart logic

---

## 🎓 How It Works (Technical)

1. **Page Visibility API** detects when user switches tabs
2. **Keep-alive pings** only sent when page is visible
3. **Auto-stop timer** (30 min) runs on Daytona's side
4. **No pings** = timer expires = sandbox stops
5. **User returns** = `ensureSandboxRunning()` restarts it
6. **Seamless UX** with slight delay on first load after stop

---

## 🚀 Ready to Deploy

1. ✅ Add `useSandboxKeepAlive(projectId)` to your project page
2. ✅ Test by switching tabs (check console logs)
3. ✅ Deploy to production
4. ✅ Monitor cost savings in Daytona dashboard

**You're done!** 🎉

---

## 📞 Support

- **Documentation:** See `SANDBOX_KEEP_ALIVE.md` for details
- **Debugging:** Check browser console for logs
- **Daytona Docs:** https://www.daytona.io/docs/en/sandbox-management/

---

## 💡 Pro Tips

1. **Show loading state:** Add a loading indicator during restart
2. **Add status indicator:** Users appreciate knowing when sandbox is active
3. **Monitor costs:** Check Daytona usage dashboard weekly
4. **Adjust intervals:** Based on your user behavior patterns
5. **Consider user feedback:** Some users might prefer longer sessions

---

**Cost-effective sandboxes are now live!** 🎉💰
