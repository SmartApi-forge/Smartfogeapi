# Sandbox URL Debugging Guide

## ✅ **What I Fixed**

Your Modern_UI project was returning:
```json
{
  "framework": "nextjs",
  "sandboxId": "i365ue9ia9ut6ta4dyc1z",
  "success": true,
  "repoFiles": { ... 143 files ... }
}
```

BUT - **NO `previewUrl`** was included! This means the preview server failed to start.

### **Changes Made:**

1. ✅ **Added detailed logging** to show WHY preview failed
2. ✅ **Generate all potential URLs** even if server didn't start  
3. ✅ **Return `potentialUrls`** in Inngest output for easy testing
4. ✅ **Include `previewError`** to see what went wrong

## 🔍 **Next Inngest Run Will Show:**

```json
{
  "success": true,
  "framework": "nextjs",
  "packageManager": "npm",
  "previewUrl": null,  // If server failed
  "previewError": "Server failed to start: ...",  // WHY it failed
  "sandboxId": "i365ue9ia9ut6ta4dyc1z",
  "potentialUrls": {
    "port3000": "https://i365ue9ia9ut6ta4dyc1z-3000.e2b.dev",
    "port8000": "https://i365ue9ia9ut6ta4dyc1z-8000.e2b.dev",
    "port5000": "https://i365ue9ia9ut6ta4dyc1z-5000.e2b.dev"
  },
  "repoFiles": { ... }
}
```

## 📋 **How to Use the URLs**

### **For Your Current Sandbox** (`i365ue9ia9ut6ta4dyc1z`):

Try these URLs in your browser:

1. **Port 3000 (Next.js default):**
   ```
   https://i365ue9ia9ut6ta4dyc1z-3000.e2b.dev
   ```

2. **Port 8000 (Python/FastAPI):**
   ```
   https://i365ue9ia9ut6ta4dyc1z-8000.e2b.dev
   ```

3. **Port 5000 (Flask):**
   ```
   https://i365ue9ia9ut6ta4dyc1z-5000.e2b.dev
   ```

### **Expected Behavior:**

- ✅ **Server Running**: You'll see your app or a loading screen
- ❌ **Server Not Running**: E2B will show "Bad Gateway" or "Connection refused"
- 🔄 **Server Starting**: May take 30-60 seconds to respond

## 🎯 **Next Steps**

### **1. Clone Modern_UI Again**
- Go to your app
- Select Modern_UI from GitHub selector
- Start a new clone

### **2. Check Inngest Logs**
Look for these new console messages:

```
✅ Preview server started: https://...
OR
❌ Preview server failed to start: <error details>
```

Also look for:
```
📡 Sandbox URLs available:
   - Port 3000 (Next.js): https://xxxxx-3000.e2b.dev
   - Port 8000 (Python): https://xxxxx-8000.e2b.dev
   - Port 5000 (Flask): https://xxxxx-5000.e2b.dev
```

### **3. Copy the URLs from Inngest Output**
In the final step output, you'll now see:
```json
"potentialUrls": {
  "port3000": "https://...",
  "port8000": "https://...",
  "port5000": "https://..."
}
```

Copy these and test in your browser!

### **4. Manual Server Start (If Needed)**
If the auto-start fails, you can manually start the server via E2B:

```bash
# For Next.js
cd /home/user/repo && npm run dev

# For other frameworks, check the compile_fullstack.sh script
```

## 🐛 **Why Preview Might Fail**

Common reasons:
1. **Dependencies not installed** - Check logs for npm errors
2. **Wrong start command** - Framework detection might be off
3. **Port already in use** - Unlikely but possible
4. **Build errors** - TypeScript errors, missing files, etc.
5. **Timeout** - Server takes >90 seconds to start

## 📊 **Check Logs in Inngest**

After cloning again, look for:

### **Step 2: clone-and-setup-preview**
```
✅ Cloned repository to: /home/user/repo
✅ Detected framework: nextjs
✅ Installing dependencies with npm...
✅ Dependencies installed successfully!
✅ Preview server started: https://xxxxx-3000.e2b.dev
```

OR if it fails:
```
❌ Preview server failed to start: Server failed to start: <error>
📡 Sandbox URLs available:
   - Port 3000 (Next.js): https://xxxxx-3000.e2b.dev
```

## 💡 **Quick Test for Current Sandbox**

Try opening this URL now (your actual sandbox):
```
https://i365ue9ia9ut6ta4dyc1z-3000.e2b.dev
```

If it works: ✅ Server is running!  
If it fails: ❌ Server didn't start - check why in the new logs

## 🔧 **Advanced: Check E2B Sandbox Directly**

You can also SSH into the sandbox to debug:
```bash
# Get sandbox ID from Inngest output
# Use E2B CLI or API to connect and check:
ps aux | grep node  # Check if server is running
cd /home/user/repo && npm run dev  # Try manual start
```

---

## ✨ **Summary**

Now when you clone a repo:
1. **Inngest logs** will show all potential URLs
2. **Output JSON** includes `potentialUrls` for easy copying
3. **Detailed errors** explain why preview failed
4. **You can test manually** even if auto-start fails

**Try cloning Modern_UI again and check the new output!** 🚀

