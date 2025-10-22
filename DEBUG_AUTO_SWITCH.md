# Debug Auto-Switch Issue

## 🔧 **Critical Fixes Applied**

### **1. React Query staleTime Issue** ⚡
**Problem**: `staleTime: 5000` was preventing manual `refetch()` calls from fetching fresh data  
**Fix**: Set `staleTime: 0` during the 15-second refetch window

**Before:**
```tsx
staleTime: streamState.isStreaming ? 0 : 5000
```
- After streaming ends, staleTime = 5000ms
- Manual refetch() calls use cached data for 5 seconds
- Database updates not picked up

**After:**
```tsx
staleTime: (streamState.isStreaming || shouldRefetch) ? 0 : 5000
```
- During refetch window, staleTime = 0
- Every refetch() makes a real network request
- Gets fresh sandbox_url from database

### **2. Aggressive Refetch Strategy** 🔄
**Added multiple refetch attempts:**
- Immediate (0s)
- After 1 second
- After 3 seconds  
- After 5 seconds

**Why**: Database write might take 1-2 seconds to commit after workflow completes

### **3. Console Logging** 📊
**Added detailed logs to debug:**
- When auto-switch triggers
- Mobile screen detection
- Current sandbox_url value
- Each refetch attempt
- View switch execution

---

## 🧪 **Testing Instructions**

### **Step 1: Open Browser Console**
1. On mobile, open dev tools (use desktop browser with mobile emulation)
2. Go to Console tab
3. Keep it visible during test

### **Step 2: Clone a Repository**
```
Clone Shashank4507/v0-shader-animation-landing-page
```

### **Step 3: Watch Console Logs**
You should see:
```
[AUTO-SWITCH] Clone complete! Starting auto-switch sequence...
[AUTO-SWITCH] isMobileScreen: true
[AUTO-SWITCH] Current sandbox_url: undefined (or a URL)
[AUTO-SWITCH] Refetch #1 (immediate)
[AUTO-SWITCH] Switching views...
[AUTO-SWITCH] Mobile detected - switching to code section
[AUTO-SWITCH] View switch complete!
[AUTO-SWITCH] Refetch #2 (1s)
[AUTO-SWITCH] Refetch #3 (3s)
[AUTO-SWITCH] Refetch #4 (5s)
```

### **Step 4: Verify Behavior**
✅ **Should switch from Chat → Code tab automatically**  
✅ **Preview should load within 1-5 seconds**  
❌ **Should NOT show "Preview not available yet" for more than 5 seconds**

---

## 🐛 **If Still Not Working**

### **Scenario A: Console shows "isMobileScreen: false"**
**Issue**: Mobile detection not working  
**Check**: 
- Browser width < 640px?
- Try refreshing page on mobile

### **Scenario B: Console shows "sandbox_url: undefined" even after all refetches**
**Issue**: Database not being updated by workflow  
**Check**:
- Workflow logs in Inngest dashboard
- Check if project.sandbox_url is actually set in database
- Verify workflow reached "update-project" step

### **Scenario C: No console logs appear at all**
**Issue**: Effect not triggering  
**Check**:
- streamState.status value
- streamState.isStreaming value
- hasAutoSwitched.current value

### **Scenario D: Switches but shows "Preview not available yet"**
**Issue**: sandbox_url is still undefined/null after refetches  
**Solution**: Workflow needs to update database BEFORE closing stream

---

## 📋 **Key Changes Made**

### **File: `app/projects/[projectId]/project-page-client.tsx`**

**Lines 643-648**: Added completion time tracking
```tsx
const [completionTime, setCompletionTime] = useState<number | null>(null);
const hasAutoSwitched = useRef(false);
```

**Line 663**: CRITICAL FIX - staleTime during refetch window
```tsx
staleTime: (streamState.isStreaming || shouldRefetch) ? 0 : 5000
```

**Lines 1156-1207**: Auto-switch effect with aggressive refetching
```tsx
// Multiple refetch attempts
const refetchSequence = async () => {
  await refetchProject(); // immediate
  setTimeout(() => refetchProject(), 1000); // 1s
  setTimeout(() => refetchProject(), 3000); // 3s
  setTimeout(() => refetchProject(), 5000); // 5s
};
```

---

## 💡 **Why It Was Failing**

### **The Cache Problem**
React Query caches results to improve performance. When `staleTime > 0`, it considers data "fresh" for that duration and returns cached data instead of making new requests.

**Timeline:**
1. ✅ Clone completes at T+30s
2. ✅ Effect triggers, calls refetchProject()
3. ❌ React Query returns cached data (staleTime = 5000ms)
4. ❌ Switch happens but sandbox_url is still old/undefined
5. ❌ Shows "Preview not available yet"
6. ⏰ User reloads page
7. ✅ New page load makes fresh request
8. ✅ Gets updated sandbox_url from database
9. ✅ Preview works!

**Fix:**
Set `staleTime: 0` during the 15-second post-completion window, forcing fresh requests on every refetch.

---

## 🎯 **Expected Timeline**

```
T+0s:   Workflow updates database with sandbox_url
T+0s:   Workflow emits 'close' event
T+0s:   Frontend receives event, status = 'complete'
T+0s:   Effect triggers
T+0s:   Refetch #1 (might get old data if DB commit not done)
T+0.8s: Auto-switch to Code tab
T+1s:   Refetch #2 (likely gets new sandbox_url)
T+1.5s: Preview component receives sandbox_url
T+2s:   Preview iframe loads
T+3s:   Refetch #3 (backup)
T+5s:   Refetch #4 (final backup)
```

---

## ✅ **Success Criteria**

1. ✅ Automatically switches from Chat → Code on mobile
2. ✅ Preview loads within 5 seconds without reload
3. ✅ Console shows all expected log messages
4. ✅ Works on mobile, tablet, and desktop
5. ✅ No manual page reload needed

---

**Next Steps:**
1. Test on mobile viewport
2. Watch console logs
3. Report what you see in the console
4. If still failing, share console output

Console logs will tell us exactly where the process is failing! 🔍
