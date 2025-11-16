# 🖥️ Terminal Feature - Quick Usage Guide

## Overview

The integrated terminal feature allows you to execute commands directly in your Daytona sandbox from the SmartAPIForge UI.

## Using the Terminal

### 1. Access the Terminal

When viewing a project with a running sandbox:
1. You'll see a **Terminal icon** (📟) in the preview header
2. Click it to toggle the terminal panel
3. The terminal appears below the preview with a resizable divider

### 2. Execute Commands

```bash
# Basic commands
ls
pwd
whoami

# Install dependencies
npm install
pnpm install

# Run development server
npm run dev

# Git operations
git status
git branch
```

### 3. Keyboard Shortcuts

- **↑** (Up Arrow) - Navigate to previous command
- **↓** (Down Arrow) - Navigate to next command
- **Ctrl+L** - Clear terminal
- **Enter** - Execute command

### 4. Terminal Features

✅ **Command History** - Access previously run commands  
✅ **Auto-scroll** - Terminal automatically scrolls to latest output  
✅ **Error Highlighting** - Errors shown in red  
✅ **Status Indicator** - Shows connection status  
✅ **Resizable** - Drag the divider to resize preview/terminal  

## For Developers

### Adding Terminal to Your Component

```tsx
import { DaytonaTerminal } from '@/components/daytona-terminal';

// In your component
<DaytonaTerminal
  sandboxId="your-sandbox-id"
  projectId="your-project-id"
  workingDirectory="workspace/project"
  className="h-96"
/>
```

### Using in SandboxPreview

```tsx
<SandboxPreview
  sandboxUrl="https://3000-abc123.proxy.daytona.works"
  projectId="project-123"
  sandboxId="abc-123-def-456"  // Add this!
  projectName="My Project"
/>
```

The `sandboxId` comes from your project metadata:

```typescript
const { data: project } = await supabase
  .from('projects')
  .select('metadata')
  .eq('id', projectId)
  .single();

const sandboxId = project.metadata?.sandboxId;
```

## Common Commands

### Node.js Projects
```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build project
npm test             # Run tests
```

### Python Projects
```bash
pip install -r requirements.txt  # Install dependencies
python app.py                    # Run application
python -m pytest                 # Run tests
```

### Git Commands
```bash
git status           # Check status
git log --oneline    # View commit history
git diff             # Show changes
git branch -a        # List all branches
```

### File Operations
```bash
ls -la               # List files with details
cat package.json     # View file contents
mkdir new-folder     # Create directory
touch file.txt       # Create file
```

## Troubleshooting

### Terminal Not Showing

**Solution**: Ensure you pass `sandboxId` prop to `SandboxPreview`:
```tsx
<SandboxPreview sandboxId={project.metadata?.sandboxId} ... />
```

### Commands Not Executing

**Check**:
1. Terminal shows "● Connected" status
2. Sandbox is alive (not expired)
3. `DAYTONA_API_KEY` is configured in `.env.local`

### "Connecting..." Status Persists

**Solutions**:
1. Refresh the page
2. Check browser console for errors
3. Verify project has valid `sandboxId` in metadata
4. Check Daytona API key is valid

## Tips & Best Practices

### 1. Long-Running Commands

For commands that take a long time (like `npm install`), you'll see a loading indicator. The terminal waits for completion before accepting new commands.

### 2. Working Directory

By default, commands execute in `workspace/project`. This is where your cloned repository lives in the sandbox.

### 3. Command History

Navigate through command history with ↑↓ arrows. History is preserved for the current session.

### 4. Clear Terminal

Click the "Clear" button or press Ctrl+L to clear the terminal output. This doesn't affect your sandbox state.

### 5. Multiple Commands

Run commands in sequence. Each command waits for the previous one to complete.

```bash
# Run these one at a time
npm install
npm run dev
```

## Security Notes

🔒 **Secure Execution**: All commands run in isolated Daytona sandboxes  
🔒 **No Host Access**: Commands cannot access your local machine  
🔒 **Project-Specific**: Each terminal is tied to a specific project  
🔒 **Authenticated**: API routes verify user ownership  

## Need Help?

- 📖 Read [TERMINAL_IMPLEMENTATION.md](TERMINAL_IMPLEMENTATION.md) for technical details
- 📖 Read [SETUP.md](SETUP.md) for environment configuration
- 🐛 Report issues on [GitHub](https://github.com/Shashank4507/smart-forge-api/issues)

---

**Happy coding! 🚀**
