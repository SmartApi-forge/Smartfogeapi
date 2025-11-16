# 📍 Terminal Location Guide

## Current Implementation

The terminal is **already implemented** in your application! It appears in the **Project Page** when viewing a sandbox preview.

### Where to Find It

1. **Navigate to Projects**
   - Go to your projects list
   - Click on any project to open it

2. **Switch to Preview Mode**
   - Click the "Preview" or eye icon in the project toolbar
   - This loads the `SandboxPreview` component

3. **Toggle Terminal**
   - Look for the Terminal icon (📟) in the preview header
   - Click it to show/hide the terminal panel
   - The terminal appears below the preview iframe in a resizable panel

### Current Architecture

```
Landing Page (/) 
  └─ NO TERMINAL HERE (this is what you see in your screenshot)

Project Page (/projects/[projectId])
  ├─ Code View (file explorer + code editor)
  └─ Preview Mode ✅ TERMINAL IS HERE
      ├─ Preview iframe (resizable, top panel)
      ├─ Resizable divider
      └─ Terminal (resizable, bottom panel)
```

## Files Involved

### 1. Main Components
- **`components/daytona-terminal.tsx`** - Terminal UI component
- **`hooks/use-daytona-terminal.ts`** - Terminal logic hook
- **`components/sandbox-preview.tsx`** - Integrates terminal with preview

### 2. API Routes
- **`app/api/sandbox/terminal/init/route.ts`** - Initialize PTY session
- **`app/api/sandbox/terminal/execute/route.ts`** - Execute commands
- **`app/api/sandbox/terminal/cleanup/route.ts`** - Clean up sessions

### 3. Project Page Integration
- **`app/projects/[projectId]/project-page-client.tsx`** (lines 1908-1919)

```tsx
<SandboxPreview 
  sandboxUrl={currentProject.sandbox_url}
  projectName={currentProject.name}
  projectId={projectId}
  sandboxId={currentProject.metadata?.sandboxId}  // ✅ Required for terminal
  hideHeader={true}
  path={previewPath}
/>
```

## Adding Terminal to Other Pages

If you want to add the terminal to **other pages** (like the landing page), here's how:

### Option 1: Standalone Terminal Component

```tsx
import { DaytonaTerminal } from '@/components/daytona-terminal';

function YourPage() {
  const sandboxId = "your-sandbox-id";  // Get from project or state
  const projectId = "your-project-id";
  
  return (
    <div className="h-screen p-4">
      <h1>My Custom Page with Terminal</h1>
      
      <div className="h-96 mt-4">
        <DaytonaTerminal
          sandboxId={sandboxId}
          projectId={projectId}
          workingDirectory="workspace/project"
          className="h-full"
        />
      </div>
    </div>
  );
}
```

### Option 2: Add to Landing Page

To add a demo terminal to your landing page:

**File:** `app/page.tsx` or your landing page component

```tsx
'use client';

import { DaytonaTerminal } from '@/components/daytona-terminal';
import { useState } from 'react';

export default function Home() {
  const [showTerminal, setShowTerminal] = useState(false);
  const demoSandboxId = process.env.NEXT_PUBLIC_DEMO_SANDBOX_ID;
  const demoProjectId = process.env.NEXT_PUBLIC_DEMO_PROJECT_ID;

  return (
    <div>
      {/* Your existing landing page content */}
      <section className="hero">
        <h1>TRANSFORM IDEAS INTO REALITY</h1>
        {/* ... */}
      </section>

      {/* Terminal Demo Section */}
      {demoSandboxId && demoProjectId && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-6">
              Try the Integrated Terminal
            </h2>
            
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="mb-4 px-4 py-2 bg-primary text-white rounded"
            >
              {showTerminal ? 'Hide' : 'Show'} Terminal Demo
            </button>

            {showTerminal && (
              <div className="h-96 border border-gray-300 rounded-lg overflow-hidden">
                <DaytonaTerminal
                  sandboxId={demoSandboxId}
                  projectId={demoProjectId}
                  workingDirectory="workspace/project"
                  className="h-full"
                />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
```

### Option 3: Global Terminal Drawer

Add a persistent terminal drawer accessible from anywhere:

**File:** `components/global-terminal-drawer.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Terminal, X } from 'lucide-react';
import { DaytonaTerminal } from './daytona-terminal';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalTerminalDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get current project context (you'll need to implement this)
  const currentSandboxId = useCurrentSandboxId();
  const currentProjectId = useCurrentProjectId();

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-4 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 z-50"
      >
        <Terminal className="h-6 w-6" />
      </button>

      {/* Terminal drawer */}
      <AnimatePresence>
        {isOpen && currentSandboxId && currentProjectId && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-0 left-0 right-0 h-96 bg-background border-t z-50"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Terminal</h3>
              <button onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="h-[calc(100%-3rem)]">
              <DaytonaTerminal
                sandboxId={currentSandboxId}
                projectId={currentProjectId}
                workingDirectory="workspace/project"
                className="h-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

Then add to your root layout:

```tsx
// app/layout.tsx
import { GlobalTerminalDrawer } from '@/components/global-terminal-drawer';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GlobalTerminalDrawer />
      </body>
    </html>
  );
}
```

## Requirements

For the terminal to work, you need:

1. **Daytona API Key** in `.env.local`:
   ```bash
   DAYTONA_API_KEY=your-api-key
   DAYTONA_API_URL=https://api.daytona.io
   ```

2. **Valid Sandbox ID**: The sandbox must be created and active in Daytona

3. **Project ID**: Associated with the sandbox

## Testing

To verify the terminal works:

1. Navigate to a project with an active sandbox
2. Switch to Preview mode
3. Click the Terminal icon
4. Run test commands:
   ```bash
   ls
   pwd
   npm --version
   ```

## Troubleshooting

### Terminal Not Showing
- Check if `sandboxId` exists in `project.metadata.sandboxId`
- Verify the project has an active sandbox
- Check browser console for errors

### Terminal Shows "Connecting..."
- Verify `DAYTONA_API_KEY` is set correctly
- Check API routes are accessible (`/api/sandbox/terminal/init`)
- Ensure Daytona API is reachable

### Commands Don't Execute
- Check sandbox is running and not expired
- Verify working directory exists in sandbox
- Check API route logs for errors

## Related Documentation

- **[TERMINAL_IMPLEMENTATION.md](./TERMINAL_IMPLEMENTATION.md)** - Technical implementation details
- **[TERMINAL_USAGE.md](./TERMINAL_USAGE.md)** - User guide for using the terminal
- **[Daytona PTY Docs](https://www.daytona.io/docs/en/pty.md)** - Official Daytona PTY documentation

---

**Summary**: The terminal is already working in your project preview pages. If you want it elsewhere, use the code examples above!
