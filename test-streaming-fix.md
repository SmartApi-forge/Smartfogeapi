# Testing the Dark Mode Streaming Fix

## Quick Test Steps

### 1. Test Dark Mode Streaming (Primary Issue)

**Steps:**
1. Open the application in your browser
2. Switch to **Dark Mode** using the theme toggle
3. Navigate to a project or create a new one
4. Start API generation
5. **Watch the chat interface carefully**

**Expected Results:**
- ✅ You should see "Generating index.js..." messages appear
- ✅ You should see "Generating main.py..." messages appear  
- ✅ You should see "Validating code..." message appear
- ✅ Code should stream in progressively (typing animation)
- ✅ Messages should appear one by one, not all at once

**Failure Signs:**
- ❌ Only see "Validating code..." but no file generation messages
- ❌ Code appears instantly as a complete block
- ❌ No progressive streaming

### 2. Test Light Mode Streaming (Regression Test)

**Steps:**
1. Switch to **Light Mode** using the theme toggle
2. Navigate to a project or create a new one  
3. Start API generation
4. **Watch the chat interface carefully**

**Expected Results:**
- ✅ Same behavior as dark mode (progressive streaming)
- ✅ All generation messages appear correctly

### 3. Test Theme Switching During Streaming

**Steps:**
1. Start in Light Mode
2. Begin API generation
3. **While generation is in progress**, click the theme toggle
4. Observe the transition

**Expected Results:**
- ✅ Theme switches instantly (no animation)
- ✅ Streaming continues uninterrupted
- ✅ No flickering or rendering issues

**Note:** The theme switch will be instant (no smooth animation) during streaming. This is intentional to prevent the rendering bug.

### 4. Test Theme Switching When NOT Streaming

**Steps:**
1. Navigate to any page WITHOUT active streaming
2. Click the theme toggle

**Expected Results:**
- ✅ Smooth animated transition between themes
- ✅ Circular blur animation visible

## Browser Console Checks

### Check Active Sessions Counter

Open browser console (F12) and type:

```javascript
window.__activeStreamingSessions
```

**Expected Values:**
- `undefined` or `0` - When no streaming is active
- `1` - When one project is streaming
- `2+` - When multiple tabs/projects are streaming

### Check Streaming Events

Look for these console logs during generation:

```
[useGenerationStream] Connecting to stream for project {id}
[useGenerationStream] Connected to stream
[useGenerationStream] Received event: file:generating
[useGenerationStream] Received event: code:chunk
[useGenerationStream] Received event: file:complete
[useGenerationStream] Received event: validation:start
[useGenerationStream] Received event: complete
```

## Common Issues & Solutions

### Issue: Counter Stuck at High Number

**Symptoms:** `window.__activeStreamingSessions` shows 5+ even with no active streaming

**Solution:** 
```javascript
// Reset counter in browser console
window.__activeStreamingSessions = 0
```

**Prevention:** This can happen if you force-close tabs during streaming. The cleanup should handle this, but manual reset is safe.

### Issue: Still No Streaming in Dark Mode

**Possible Causes:**
1. Cache issue - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Old build - Restart dev server
3. Browser doesn't support View Transition API - Check browser version

**Debug Steps:**
1. Check console for errors
2. Verify `document.startViewTransition` exists:
   ```javascript
   console.log(typeof document.startViewTransition)
   // Should log "function" or "undefined"
   ```

### Issue: Theme Toggle Not Working

**Symptoms:** Theme doesn't change when clicking toggle

**Debug:**
1. Check for JavaScript errors in console
2. Verify theme state:
   ```javascript
   document.documentElement.classList.contains('dark')
   ```

## Performance Testing

### Check for Memory Leaks

1. Open Chrome DevTools > Memory
2. Take heap snapshot
3. Generate multiple APIs
4. Take another snapshot  
5. Compare - should not see excessive EventSource or closures

### Check Event Source Connections

1. Open Chrome DevTools > Network
2. Filter by "EventStream"
3. During generation, should see 1 connection per project
4. After completion, connections should close (red dot)

## Automated Testing (Future)

Consider adding these tests:

```typescript
// Playwright/Cypress test example
test('dark mode streaming works', async ({ page }) => {
  // Switch to dark mode
  await page.click('[aria-label="Theme Toggle"]')
  
  // Start generation
  await page.click('[data-testid="generate-button"]')
  
  // Wait for first streaming message
  await page.waitForSelector('text=/Generating.*\\.js/')
  
  // Verify progressive updates
  const messages = await page.locator('.message').count()
  expect(messages).toBeGreaterThan(1)
})
```

## Reporting Issues

If the fix doesn't work, please provide:

1. **Browser & Version:** (e.g., Chrome 122, Firefox 123)
2. **Theme Mode:** (Light/Dark/System)
3. **Console Logs:** Copy all `[useGenerationStream]` logs
4. **Counter Value:** Value of `window.__activeStreamingSessions`
5. **Screenshots:** Before and after generation starts
6. **Network Tab:** Screenshot of EventStream connections

## Success Criteria

The fix is working correctly when:

- ✅ Streaming works identically in both light and dark modes
- ✅ Progressive messages appear in chat ("Generating [file]...")
- ✅ Code typing animation is visible
- ✅ Theme switching works (with or without animation)
- ✅ No console errors
- ✅ Counter increments/decrements correctly

