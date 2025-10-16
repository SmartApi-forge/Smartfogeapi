# Conversational Code Editor

## Overview

The Conversational Code Editor is an AI-powered feature that allows users to request code modifications through natural language on project pages. The system intelligently detects code edit requests, generates precise modifications using OpenAI, and presents them in a diff viewer for review before applying.

## Features

### 1. **Natural Language Code Editing**
- Users can request code changes conversationally (e.g., "Change line 5 to use a for loop")
- AI understands context from conversation history and existing codebase
- Supports both simple line edits and complex multi-file refactoring

### 2. **Intelligent Request Detection**
- Automatically detects code edit requests using keyword analysis
- Looks for:
  - Code edit keywords: change, modify, update, edit, refactor, add, remove, etc.
  - File references: .js, .ts, .py, etc.
  - Line number references: "line 5", "lines 10-15"

### 3. **Code Change Visualization**
- Side-by-side diff viewer showing before/after code
- Clear indication of which files and line numbers are affected
- Syntax highlighting for better readability
- Individual Apply/Reject buttons for each modification

### 4. **Safe Application**
- Changes are saved to database but not applied immediately
- Users review all modifications before applying
- Can apply changes individually or all at once
- Can reject unwanted modifications

## Architecture

### Data Flow

```
User Message → messageCreated (Inngest)
    ↓
  Detect Code Edit Request
    ↓
  Trigger code/edit event
    ↓
  editCode (Inngest)
    ↓
  1. Fetch project context (files + history)
  2. Call OpenAI with context
  3. Parse AI response
  4. Save modifications to DB
  5. Create code_change message
    ↓
  Frontend displays diff viewer
    ↓
  User reviews and applies changes
    ↓
  api_fragments table updated
```

### Key Components

#### Backend

**Database Tables:**
- `code_modifications` - Stores proposed code changes with:
  - `file_path` - Which file to modify
  - `old_content` / `new_content` - The change
  - `line_start` / `line_end` - Line numbers affected
  - `modification_type` - 'edit', 'create', or 'delete'
  - `applied` - Whether the change has been applied
  - `reason` - AI explanation of the change

**Inngest Functions:**
- `messageCreated` - Detects code edit requests and triggers `code/edit` event
- `editCode` - Main AI-powered code editing workflow:
  1. Fetches project context (current files and conversation history)
  2. Calls OpenAI with structured prompt for code modifications
  3. Saves modifications to `code_modifications` table
  4. Creates assistant message with `code_change` type

**tRPC Routers:**
- `codeModifications` router with procedures:
  - `create` - Create new modification
  - `getByMessage` - Get all modifications for a message
  - `getByProject` - Get all modifications for a project
  - `apply` - Apply a modification and update api_fragments
  - `applyMultiple` - Apply multiple modifications at once
  - `reject` - Delete/reject a modification

**Services:**
- `CodeModificationService` - Business logic for managing modifications:
  - CRUD operations for modifications
  - Apply logic that updates `api_fragments` table
  - Batch operations for multi-file changes

#### Frontend

**Components:**
- `CodeModificationViewer` - Main UI component that:
  - Fetches modifications by message ID
  - Groups modifications by file
  - Displays side-by-side diff view
  - Handles apply/reject actions
  - Shows applied status

**Integration:**
- Project page client automatically renders `CodeModificationViewer` for messages with type `code_change`
- Messages refresh after modifications are applied
- File tree updates to reflect applied changes

## Usage

### For Users

1. **Start a conversation** on any project page (`/projects/[projectId]`)

2. **Request code changes** naturally:
   ```
   "Change line 5 in index.js to use a for loop instead of forEach"
   "Add error handling to all API endpoints"
   "Update the health check endpoint to return more details"
   "Refactor the user authentication logic"
   ```

3. **Review proposed changes** in the diff viewer that appears

4. **Apply or reject** each change individually, or use "Apply All"

5. **See changes reflected** immediately in the file tree and code viewer

### For Developers

#### Adding New Modification Types

To add custom modification logic:

```typescript
// In CodeModificationService
static async applyCustom(id: string, customLogic: () => void) {
  const modification = await this.getById(id);
  // Custom application logic here
  customLogic();
  return await this.update({ id, applied: true });
}
```

#### Customizing AI Prompts

Edit the system prompt in `src/inngest/functions.ts` → `editCode` function:

```typescript
const systemPrompt = `You are a code editor assistant...
[Add your custom instructions here]
`;
```

#### Extending Detection Logic

Modify keyword detection in `src/inngest/functions.ts` → `messageCreated`:

```typescript
const codeEditKeywords = [
  // Add new keywords
  'your-keyword',
];
```

## API Reference

### tRPC Procedures

#### `codeModifications.getByMessage`
```typescript
Input: { messageId: string }
Output: CodeModification[]
```
Fetches all code modifications associated with a message.

#### `codeModifications.apply`
```typescript
Input: { id: string }
Output: { modification: CodeModification; updated: boolean }
```
Applies a single code modification to the project's api_fragments.

#### `codeModifications.applyMultiple`
```typescript
Input: { modification_ids: string[] }
Output: CodeModification[]
```
Applies multiple modifications in bulk.

#### `codeModifications.reject`
```typescript
Input: { id: string }
Output: { success: boolean }
```
Deletes/rejects a code modification.

### Database Schema

```sql
CREATE TABLE code_modifications (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  message_id UUID NOT NULL REFERENCES messages(id),
  file_path TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  modification_type TEXT NOT NULL, -- 'edit' | 'create' | 'delete'
  reason TEXT,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

### Environment Variables

The feature uses existing environment variables:
- `OPENAI_API_KEY` - For AI-powered code analysis
- `NEXT_PUBLIC_SUPABASE_URL` - Database connection
- `SUPABASE_SERVICE_ROLE_KEY` - Database admin access

### AI Model Settings

Current settings (in `editCode` function):
- Model: `gpt-4o`
- Temperature: `0.2` (lower for more precise code edits)
- Response format: `json_object`

## Security

### Row Level Security (RLS)

All database operations respect RLS policies:
- Users can only view/modify their own projects' code modifications
- Policies enforce `auth.uid()` checks for all operations

### Code Validation

- AI responses are validated and sanitized
- File paths are checked against existing project files
- SQL injection prevention through parameterized queries

## Performance Considerations

### Optimization Strategies

1. **Conversation History Limit**: Only last 10 messages sent to AI
2. **File Context**: Large files are truncated in AI prompts
3. **Batch Operations**: Apply multiple changes in single transaction
4. **Caching**: tRPC queries cache modifications client-side

### Scaling

- Inngest handles background processing with automatic retries
- Database indexes on `project_id`, `message_id`, and `applied` columns
- RLS policies use indexed columns for fast queries

## Troubleshooting

### Common Issues

**Issue**: AI doesn't detect code edit request
- **Solution**: Use explicit keywords like "change", "modify", or "update"
- **Solution**: Reference file names with extensions (e.g., "index.js")

**Issue**: Modifications not appearing
- **Check**: Message type should be `code_change`
- **Check**: Inngest function logs for errors
- **Check**: Database for saved modifications

**Issue**: Apply fails silently
- **Check**: User permissions on project
- **Check**: api_fragments table has valid data
- **Check**: Browser console for tRPC errors

### Debug Mode

Enable detailed logging:

```typescript
// In src/inngest/functions.ts
console.log('[editCode] Current files:', projectContext.currentFiles);
console.log('[editCode] AI Response:', aiResponse);
```

## Future Enhancements

### Planned Features

1. **Undo/Redo**: Rollback applied modifications
2. **Change History**: Timeline of all modifications per project
3. **Conflict Resolution**: Handle concurrent edits
4. **Custom Rules**: User-defined code style preferences
5. **Testing Integration**: Auto-generate tests for modifications
6. **Git Integration**: Commit applied changes to repository

### Experimental Ideas

- Voice-to-code editing
- Visual diff editor with inline comments
- AI-suggested improvements beyond user request
- Collaborative code review for modifications

## Contributing

When contributing to this feature:

1. **Update types** in `src/modules/code-modifications/types.ts`
2. **Add tests** for new modification types
3. **Update this documentation** with new features
4. **Follow existing patterns** for consistency

## License

Part of SmartAPIForge project. See main LICENSE file.


