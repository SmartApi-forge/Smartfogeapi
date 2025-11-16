# 🔍 Where to Find the Terminal Toggle

## Current View vs Project View

### What You're Seeing Now (Screenshot):
```
Landing Page / Project Preview
├─ This is the SaaSify website preview
├─ Shows the deployed application
└─ ❌ Terminal toggle NOT here
```

### Where the Terminal Toggle Is:
```
Project Detail Page
├─ Navigate to: /projects/[projectId]
├─ Click any project from your projects list
├─ Switch to Preview mode
└─ ✅ Terminal toggle appears in the header
```

## How to Access the Terminal

### Step 1: Go to Projects Page
- Click on a project from your projects list
- Or navigate to: `http://localhost:3000/projects/[your-project-id]`

### Step 2: Look for the Header
The header will look like this:

```
┌─────────────────────────────────────────────────────────────┐
│  [<<<]  [👁 Preview] [💻 Code] [🖥️ Terminal]  [v1 ▼] [⋮]  │
└─────────────────────────────────────────────────────────────┘
```

The **Terminal button** (🖥️) is right next to the Preview and Code toggle buttons!

### Visual Location:
```
Header Bar:
├─ Left side: Collapse button [<<<]
├─ Middle-left: View toggles
│   ├─ [👁 Preview] ← Click to see preview
│   ├─ [💻 Code] ← Click to see code
│   └─ [🖥️ Terminal] ← **THIS IS THE TERMINAL TOGGLE!**
├─ Middle-right: Version dropdown [v1 ▼]
└─ Right side: More menu [⋮]
```

## What Changed (Your Request)

### ✅ Removed:
- Bottom status bar showing the URL
- Resizable panels (simplified layout)

### ✅ Added:
- Terminal now appears at bottom with fixed height (320px)
- Terminal toggle button next to Preview/Code icons
- Toggle shows/hides the terminal

### New Layout:
```
┌─────────────────────────────────┐
│         Header Bar              │
│  [Preview] [Code] [Terminal]    │
├─────────────────────────────────┤
│                                 │
│      Preview Iframe             │
│      (Your App)                 │
│                                 │
├─────────────────────────────────┤
│  $ Terminal                     │
│  > ls                           │
│  > npm run dev                  │
│  ↑↓ Command history             │
└─────────────────────────────────┘
```

## Testing It

1. **Start your dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Navigate to a project**:
   - Go to: `http://localhost:3000/projects`
   - Click on any project with a sandbox

3. **Switch to Preview mode**:
   - Click the "Preview" (👁) button in the header

4. **Look for the Terminal button**:
   - It's right next to the Code button
   - Looks like: `[🖥️]`
   - Green when active, gray when hidden

5. **Click to toggle**:
   - Terminal appears at the bottom (320px height)
   - No more URL status bar
   - Just preview + terminal

## Troubleshooting

### Terminal Toggle Not Showing?
Check if:
- ✓ You're on a **project detail page** (not landing page)
- ✓ You're in **Preview mode** (not Code mode)
- ✓ Project has a valid **sandboxId** in metadata
- ✓ Check browser console for errors

### Terminal Not Working?
Verify:
- `.env.local` has `DAYTONA_API_KEY` set
- Sandbox is running in Daytona
- Project metadata contains `sandboxId`

## Summary

**You were looking at**: Landing page preview (SaaSify website)  
**Terminal is located**: Project detail page → Preview mode → Header bar  
**Look for**: Terminal icon (🖥️) next to Preview/Code buttons  
**Layout**: Preview at top, Terminal at bottom (no more URL bar)

---

**Next**: Navigate to any project in `/projects/[projectId]` and switch to Preview mode to see it!
