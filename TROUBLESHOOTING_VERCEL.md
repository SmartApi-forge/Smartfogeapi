# Vercel Deployment Troubleshooting

## 🔴 **Error: "Unauthorized"**

This error means one of the following:

### **1. Vercel Access Token Not Set**

**Symptom:** Error message says "VERCEL_ACCESS_TOKEN is not set"

**Solution:**
1. Go to: https://vercel.com/account/tokens
2. Create a new token
3. Copy the token
4. Add to `.env.local`:
   ```bash
   VERCEL_ACCESS_TOKEN=your_token_here
   ```
5. **For Production:** Add to Vercel Dashboard → Settings → Environment Variables
6. Restart your dev server

---

### **2. Invalid or Expired Token**

**Symptom:** Error message says "Vercel authentication failed"

**Solution:**
1. Check if token is correct (no extra spaces)
2. Verify token hasn't expired
3. Create a new token if needed
4. Update environment variables
5. Restart server

---

### **3. Token Doesn't Have Permissions**

**Symptom:** Error message says "Vercel access denied"

**Solution:**
1. Make sure token has **Full Account** scope
2. If using team account, verify token has team access
3. Create new token with correct permissions
4. Update environment variables

---

### **4. User Not Authenticated**

**Symptom:** Error message says "Please sign in to deploy projects"

**Solution:**
1. Make sure you're logged in
2. Refresh the page
3. Try logging out and back in
4. Check browser console for auth errors

---

## ✅ **Quick Checklist**

- [ ] `VERCEL_ACCESS_TOKEN` is set in `.env.local`
- [ ] `VERCEL_ACCESS_TOKEN` is set in Vercel Dashboard (for production)
- [ ] Token is valid and not expired
- [ ] Token has Full Account permissions
- [ ] You're logged in to the app
- [ ] Dev server was restarted after adding token

---

## 🔍 **How to Verify Token**

### **Test Token Locally:**

```bash
# In your terminal
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v2/user
```

If you get user info back, token is valid ✅  
If you get 401, token is invalid ❌

---

## 📝 **Common Issues**

### **Issue: Token works locally but not in production**

**Cause:** Environment variable not set in Vercel Dashboard

**Fix:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `VERCEL_ACCESS_TOKEN` for **all environments**
3. Redeploy

---

### **Issue: "Project not found" error**

**Cause:** Project doesn't exist or user doesn't own it

**Fix:**
1. Verify project ID is correct
2. Check you're logged in as the project owner
3. Try refreshing the page

---

### **Issue: "No files to deploy"**

**Cause:** Project has no files in latest version

**Fix:**
1. Make sure project has been generated
2. Check that files exist in the project
3. Try regenerating the project

---

## 🆘 **Still Having Issues?**

1. **Check Server Logs:**
   - Look for error messages in terminal
   - Check for "VERCEL_ACCESS_TOKEN" in logs

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for network errors
   - Check error messages

3. **Verify Environment Variables:**
   ```bash
   # In your terminal (local)
   echo $VERCEL_ACCESS_TOKEN
   # Should show your token (not empty)
   ```

4. **Test Vercel API Directly:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.vercel.com/v2/user
   ```

---

## 📚 **Resources**

- [Vercel Tokens Documentation](https://vercel.com/docs/security/api-tokens)
- [Vercel API Reference](https://vercel.com/docs/rest-api)
- [Setup Guide](./VERCEL_PLATFORMS_SETUP.md)

---

**Last Updated:** November 22, 2025

