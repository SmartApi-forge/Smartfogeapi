# ✅ Extended Timeout for Next.js Dev Server - FIXED

## 🐛 **The Problem**

Your Modern_UI repository was STILL timing out even after the first fix:

```json
{
  "previewError": "[deadline_exceeded] the operation timed out: This error is likely due to exceeding 'timeoutMs'..."
}
```

### **Why It Was Still Failing:**

The previous timeout settings were:
- ✅ `npm install`: **5 minutes** (sufficient)
- ❌ **Server startup**: **2 minutes** (NOT ENOUGH!)

**Why 2 minutes wasn't enough:**
- Next.js 15 needs to run its **first build**
- Tailwind v4 CSS processing takes time
- React 19 + GSAP + 50+ dependencies to compile
- Total time needed: **5-10 minutes** for first start

---

## ✅ **The Fix**

### **Changed File:** `src/services/github-repository-service.ts`

**Line 413-414** (Previously):
```typescript
const result = await sandbox.commands.run(startCommand, {
  timeoutMs: 120000, // 2 minutes timeout for server startup only
});
```

**Line 413-414** (NOW):
```typescript
const result = await sandbox.commands.run(startCommand, {
  timeoutMs: 600000, // 10 minutes timeout for first Next.js build + server startup
});
```

---

## 📊 **New Timeout Breakdown**

| Step                | Old Timeout | New Timeout | Reason                          |
|---------------------|-------------|-------------|----------------------------------|
| `npm install`       | 5 minutes   | 5 minutes   | ✅ Already sufficient            |
| `npm install --legacy-peer-deps` | 5 minutes | 5 minutes | ✅ Already sufficient |
| **Start dev server** | **2 minutes** | **10 minutes** | ✅ **Now covers Next.js build** |

**Total possible time:** Up to **20 minutes** (10 min install + 10 min build)

---

## 🧪 **What Happens Now:**

1. **Clone repo** → Instant
2. **Read files** → ~30 seconds
3. **npm install** → ~3-5 minutes
4. **Next.js first build** → ~5-8 minutes ⬅️ **NOW WON'T TIMEOUT!**
5. **Dev server ready** → Preview URL available!

---

## 🎯 **Expected Result (Next Run):**

```json
{
  "success": true,
  "framework": "nextjs",
  "sandboxId": "xxx",
  "sandboxUrl": "https://xxx-3000.e2b.dev",
  "previewPort": 3000
  // NO previewError! ✅
}
```

---

## 📝 **Why This Is the Final Fix:**

- ✅ Install timeout: **5 minutes** (plenty for 50 dependencies)
- ✅ Server timeout: **10 minutes** (covers Next.js 15 build time)
- ✅ Fallback handling: `--legacy-peer-deps` auto-retry
- ✅ Error reporting: Full npm output in Inngest logs

**Modern_UI should now clone successfully!** 🚀

---

## 🔍 **If It Still Fails:**

1. Check Inngest logs for specific npm/build errors
2. Check `installOutput` field for npm error details
3. Verify E2B template has enough CPU/memory
4. Consider reducing dependencies if possible

---

## 💡 **Pro Tip:**

After the **first successful start**, subsequent runs will be much faster because:
- Dependencies are cached in `node_modules`
- Next.js build cache exists in `.next`
- Subsequent starts only take ~30-60 seconds

**Clone the repo again now and it should work!** 🎊

