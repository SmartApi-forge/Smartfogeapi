# File Activity System - Integration Guide

## Overview

This guide explains how to integrate the file activity system into your project. The system provides:

✅ **Clickable file names** with shimmer animations  
✅ **Real-time file activity feed** showing which files are being read/written  
✅ **Navigation from chat to code editor** when clicking files  
✅ **Version cards with clickable file lists**

---

## Components Created

### 1. `ClickableFileLink` - Clickable File Name Component
**Location**: `components/clickable-file-link.tsx`

Shows a file name with:
- Shimmer animation when reading/writing
- File type icon
- Status indicator (reading/writing/complete)
- Click handler for navigation

### 2. `FileActivityFeed` - Real-Time Activity Feed
**Location**: `components/file-activity-feed.tsx`

Displays:
- Active files (being processed)
- Completed files
- Relevance scores
- Clickable file links

### 3. `VersionCard` - Updated with Clickable Files
**Location**: `components/version-card.tsx` (UPDATED)

Now includes:
- `onFileClick` callback prop
- Clickable file names using `ClickableFileLink`

---

## Integration Steps

### Step 1: Add File Activity State

In `app/projects/[projectId]/project-page-client.tsx`, add state to track file activities:

```typescript
// Add to component state (around line 400)
const [fileActivities, setFileActivities] = useState<FileActivity[]>([]);

// Add FileActivity import at top
import { FileActivity, FileActivityFeed } from '@/components/file-activity-feed';
import { ClickableFileLink } from '@/components/clickable-file-link';
```

### Step 2: Handle File Click Navigation

Add a function to navigate to files in the editor:

```typescript
// Add around line 600 (after other handler functions)
/**
 * Handle file click - navigate to file in editor
 */
const handleFileClick = useCallback((filename: string) => {
  // Find the file in the tree
  const findFileInTree = (nodes: TreeNode[], path: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.type === 'file' && node.name === path) {
        return node;
      }
      if (node.children) {
        const found = findFileInTree(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };
  
  const fileNode = findFileInTree(fileTree, filename);
  if (fileNode) {
    setSelectedFile(fileNode);
    
    // Scroll to file in tree (optional)
    const fileElement = document.getElementById(`file-${fileNode.id}`);
    fileElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, [fileTree]);
```

### Step 3: Listen to Streaming Events

Add file activity tracking in the streaming event handler:

```typescript
// Update the useEffect that listens to streaming events (around line 700)
useEffect(() => {
  if (!projectId) return;
  
  const unsubscribe = streamingService.subscribe(projectId, (event) => {
    // ... existing event handling ...
    
    // NEW: Track file activities
    if (event.type === 'file:analyzing') {
      setFileActivities(prev => [...prev, {
        id: `${event.filePath}-${Date.now()}`,
        filePath: event.filePath,
        status: 'analyzing',
        timestamp: Date.now(),
      }]);
    }
    
    if (event.type === 'file:reading') {
      setFileActivities(prev => 
        prev.map(a => 
          a.filePath === event.filePath && a.status === 'analyzing'
            ? { ...a, status: 'reading' as const }
            : a
        )
      );
    }
    
    if (event.type === 'file:editing') {
      setFileActivities(prev => 
        prev.map(a => 
          a.filePath === event.filePath
            ? { ...a, status: 'writing' as const }
            : a
        )
      );
    }
    
    if (event.type === 'file:complete') {
      setFileActivities(prev => 
        prev.map(a => 
          a.filePath === event.filePath
            ? { ...a, status: 'complete' as const }
            : a
        )
      );
    }
    
    if (event.type === 'file:selected') {
      setFileActivities(prev => [...prev, {
        id: `${event.filePath}-${Date.now()}`,
        filePath: event.filePath,
        status: 'complete',
        relevance: event.relevance,
        timestamp: Date.now(),
      }]);
    }
  });
  
  return unsubscribe;
}, [projectId]);
```

### Step 4: Add File Activity Feed to Chat Interface

In the chat messages section (around line 1800-2000), add the feed:

```typescript
{/* Chat Messages Container */}
<div className="flex-1 overflow-y-auto p-4 space-y-4">
  {allMessages.map((msg) => {
    // User message
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="flex justify-end gap-2">
          <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl px-4 py-2">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }
    
    // Assistant message
    if (msg.role === 'assistant') {
      return (
        <div key={msg.id} className="flex justify-start gap-2">
          <div className="max-w-[80%] bg-muted rounded-2xl px-4 py-2 space-y-2">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            
            {/* NEW: Show file activity feed if this message has associated activities */}
            <FileActivityFeed
              activities={fileActivities}
              onFileClick={handleFileClick}
              maxItems={10}
              className="mt-2"
            />
          </div>
        </div>
      );
    }
    
    // Version card
    if (msg.type === 'version-card') {
      return (
        <VersionCard
          key={msg.id}
          version={msg.versionData}
          isActive={selectedVersionId === msg.versionData.id}
          onClick={() => handleVersionSelect(msg.versionData.id)}
          previousVersion={/* find previous version */}
          onFileClick={handleFileClick} // NEW: Pass click handler
        />
      );
    }
    
    return null;
  })}
</div>
```

### Step 5: Add Inline File Links in Messages

For messages that mention files, make them clickable:

```typescript
// Helper function to detect and linkify file paths in message content
const renderMessageWithFileLinks = (content: string) => {
  // Pattern to match file paths: file.ext or path/to/file.ext
  const filePattern = /(\b[\w\/\-\.]+\.(ts|tsx|js|jsx|py|go|java|rs|cpp|c|json|yaml|yml|md|html|css|scss)\b)/g;
  
  const parts = content.split(filePattern);
  
  return parts.map((part, index) => {
    // Check if this part matches a file pattern
    if (filePattern.test(part)) {
      return (
        <ClickableFileLink
          key={index}
          filename={part}
          status="idle"
          onClick={() => handleFileClick(part)}
          showIcon={true}
          className="inline-flex"
        />
      );
    }
    return <span key={index}>{part}</span>;
  });
};

// Use in message rendering:
<p className="text-sm whitespace-pre-wrap">
  {renderMessageWithFileLinks(msg.content)}
</p>
```

---

## Usage Examples

### Example 1: Streaming File Activity

```typescript
// When AI starts analyzing files
streamingService.emit(projectId, {
  type: 'file:analyzing',
  filePath: 'src/auth.ts',
  reason: 'Authentication logic needed',
});

// When AI reads a file
streamingService.emit(projectId, {
  type: 'file:reading',
  filePath: 'src/auth.ts',
  size: 2500,
});

// When AI writes/edits a file
streamingService.emit(projectId, {
  type: 'file:editing',
  filePath: 'src/auth.ts',
  changes: ['Added login function', 'Updated types'],
});

// When file is complete
streamingService.emit(projectId, {
  type: 'file:complete',
  filePath: 'src/auth.ts',
  content: '/* full file content */',
});
```

### Example 2: Version Card with Clickable Files

```tsx
<VersionCard
  version={currentVersion}
  isActive={true}
  onClick={() => console.log('Version clicked')}
  onFileClick={(filename) => {
    console.log('File clicked:', filename);
    // Navigate to file in editor
    setSelectedFile(filename);
  }}
/>
```

### Example 3: Standalone File Activity Feed

```tsx
<FileActivityFeed
  activities={[
    {
      id: '1',
      filePath: 'src/components/Button.tsx',
      status: 'writing',
      relevance: 0.95,
      timestamp: Date.now(),
    },
    {
      id: '2',
      filePath: 'src/hooks/useAuth.ts',
      status: 'reading',
      relevance: 0.87,
      timestamp: Date.now(),
    },
  ]}
  onFileClick={(path) => console.log('Navigate to:', path)}
  maxItems={10}
/>
```

---

## Visual Behavior

### File Status Indicators

| Status | Icon | Animation | Color |
|--------|------|-----------|-------|
| `analyzing` | 🔄 Spinner | Rotating | Blue |
| `reading` | 👁️ Eye | None | Blue |
| `writing` | 🔄 Spinner | Rotating + Shimmer | Green |
| `complete` | ✓ Check | None | Green |

### Shimmer Animation

Files being read or written show a **shimmering text effect**:
- Gradient moves left to right
- Duration: 1.5 seconds
- Infinite loop
- Subtle and non-distracting

### Click Behavior

1. **Hover**: Background changes, scale increases slightly
2. **Click**: Scale decreases (feedback), then navigates
3. **Active**: Background color persists

---

## Backend Integration

### Update Inngest Functions

Add file activity events to your generation functions:

```typescript
// In src/inngest/functions.ts - iterateAPI function

// When building context
await streamingService.emit(projectId, {
  type: 'context:building',
  message: 'Analyzing codebase...',
});

// When searching for relevant files
const searchResults = await EmbeddingService.searchRelevantFiles(projectId, prompt);

for (const result of searchResults) {
  await streamingService.emit(projectId, {
    type: 'file:analyzing',
    filePath: result.filePath,
    reason: `Relevance: ${Math.round(result.similarity * 100)}%`,
  });
  
  await streamingService.emit(projectId, {
    type: 'file:selected',
    filePath: result.filePath,
    relevance: result.similarity,
  });
}

// When reading file contents
for (const filePath of selectedFiles) {
  await streamingService.emit(projectId, {
    type: 'file:reading',
    filePath,
    size: fileContent.length,
  });
}

// When AI is editing files
for (const [filePath, content] of Object.entries(generatedFiles)) {
  await streamingService.emit(projectId, {
    type: 'file:editing',
    filePath,
    changes: ['Generated by AI'],
  });
  
  // ... AI generation ...
  
  await streamingService.emit(projectId, {
    type: 'file:complete',
    filePath,
    content,
  });
}
```

---

## Styling Customization

### Tailwind Classes Used

```css
/* Active file (shimmer) */
.bg-primary/5 

/* Hover effects */
.hover:bg-muted/50
.hover:scale-105

/* Status colors */
.text-blue-500   /* Analyzing/Reading */
.text-green-500  /* Writing/Complete */
.text-red-500    /* Error */

/* Text shimmer gradient */
.bg-clip-text
.text-transparent
```

### Custom Animations

All animations use Framer Motion:
- `whileHover={{ scale: 1.02 }}`
- `whileTap={{ scale: 0.98 }}`
- `initial={{ opacity: 0, x: -20 }}`
- `animate={{ opacity: 1, x: 0 }}`

---

## Testing

### Manual Testing Checklist

- [ ] File names in version cards are clickable
- [ ] Clicking file navigates to that file in editor
- [ ] File activity feed shows during generation
- [ ] Shimmer animation appears on active files
- [ ] Status icons update correctly (analyzing → reading → writing → complete)
- [ ] Relevance scores display correctly
- [ ] Feed auto-scrolls with new activities
- [ ] Works in both light and dark mode
- [ ] Mobile responsive (file names truncate properly)

### Test with Sample Data

```typescript
// Test file activities
const testActivities: FileActivity[] = [
  {
    id: '1',
    filePath: 'src/components/Header.tsx',
    status: 'analyzing',
    timestamp: Date.now() - 5000,
  },
  {
    id: '2',
    filePath: 'src/hooks/useAuth.ts',
    status: 'reading',
    relevance: 0.92,
    timestamp: Date.now() - 3000,
  },
  {
    id: '3',
    filePath: 'src/pages/login.tsx',
    status: 'writing',
    relevance: 0.87,
    timestamp: Date.now() - 1000,
  },
  {
    id: '4',
    filePath: 'package.json',
    status: 'complete',
    timestamp: Date.now(),
  },
];
```

---

## Troubleshooting

### Issue: File click doesn't navigate

**Solution**: Ensure `handleFileClick` correctly finds the file in the tree:

```typescript
console.log('Clicked file:', filename);
console.log('Available files:', fileTree.map(n => n.name));
```

### Issue: Shimmer animation not working

**Solution**: Check that `TextShimmer` component is properly imported and file status is `'reading'` or `'writing'`.

### Issue: Activity feed not updating

**Solution**: Verify streaming service is emitting events:

```typescript
streamingService.on('*', (event) => {
  console.log('Event:', event);
});
```

---

## Performance Considerations

- **Activity List**: Automatically limits to last 10 items (configurable via `maxItems` prop)
- **Animation Performance**: Uses GPU-accelerated transforms
- **Memory**: Old activities are removed after completion
- **Debouncing**: File click handlers should debounce rapid clicks

---

## Next Steps

1. ✅ Integrate components into project page
2. ✅ Connect to streaming events
3. ✅ Test file navigation
4. ✅ Style to match your theme
5. ✅ Add analytics tracking for file clicks

---

## Complete Integration Checklist

- [ ] Import new components
- [ ] Add `fileActivities` state
- [ ] Add `handleFileClick` function
- [ ] Update streaming event listeners
- [ ] Add `FileActivityFeed` to chat interface
- [ ] Update `VersionCard` usage with `onFileClick`
- [ ] Add inline file link rendering
- [ ] Test all file click scenarios
- [ ] Verify shimmer animations work
- [ ] Test on mobile devices
- [ ] Deploy and monitor performance

---

**Your file activity system is now ready! Users will see which files are being processed and can click to navigate directly to them in the editor.** 🎉
