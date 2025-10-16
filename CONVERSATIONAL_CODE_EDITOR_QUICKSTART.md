# Conversational Code Editor - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Generate Initial Code

1. Navigate to your dashboard
2. Create a new project or open an existing one
3. Ensure you have some generated API code

### Step 2: Start Conversing

On the project page (`/projects/[projectId]`), use the chat input to request code changes:

#### ✨ Example Requests

**Simple line edits:**
```
Change line 5 in index.js to use a for loop
```

**Add new features:**
```
Add error handling to all endpoints
```

**Refactoring:**
```
Refactor the authentication logic to use JWT tokens
```

**Update specific code:**
```
Update the health check endpoint to return database status
```

### Step 3: Review Changes

After sending a message, the AI will:

1. ✅ Analyze your request
2. ✅ Examine your current code
3. ✅ Generate precise modifications
4. ✅ Display them in a diff viewer

### Step 4: Apply or Reject

In the diff viewer, you'll see:

```
┌──────────────────────────────────────┐
│  📄 index.js                    [2 pending]  │
├──────────────────────────────────────┤
│  Lines 5-10                          │
│                                      │
│  ❌ Before          ✅ After         │
│  forEach(...)       for (let i...)   │
│                                      │
│  Reason: Changed to for loop as...   │
│                                      │
│         [✓ Apply]  [✗ Reject]        │
└──────────────────────────────────────┘
```

Click **Apply** to accept or **Reject** to dismiss.

### Step 5: See Results

✨ Applied changes immediately update:
- The file tree
- The code viewer
- The API fragments database

---

## 💡 Pro Tips

### Tip 1: Be Specific

❌ Bad:
```
Make it better
```

✅ Good:
```
Add input validation to the user registration endpoint
```

### Tip 2: Reference Files

❌ Vague:
```
Update the main file
```

✅ Clear:
```
Update index.js to include CORS middleware
```

### Tip 3: Use Line Numbers

❌ Unclear:
```
Fix the loop
```

✅ Precise:
```
Fix the loop on line 25 in server.js
```

### Tip 4: Build on Context

✅ First message:
```
Add a user authentication endpoint
```

✅ Follow-up:
```
Add password hashing to that endpoint
```

The AI remembers your conversation! 🧠

---

## 🎯 Common Use Cases

### Use Case 1: Quick Fixes

**Scenario:** You spot a typo or small error

**Request:**
```
Change 'usr' to 'user' on line 42 in routes.js
```

**Result:** Instant fix with visual confirmation

---

### Use Case 2: Adding Features

**Scenario:** You want to enhance functionality

**Request:**
```
Add rate limiting to all API endpoints
```

**Result:** Multiple file modifications, all reviewable

---

### Use Case 3: Code Improvements

**Scenario:** Optimize existing code

**Request:**
```
Optimize the database queries in user.service.ts
```

**Result:** Performance improvements with explanations

---

### Use Case 4: Security Enhancements

**Scenario:** Add security measures

**Request:**
```
Add input sanitization to prevent SQL injection
```

**Result:** Security patches across affected files

---

## ⚡ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | Enter |
| New line in message | Shift + Enter |
| Focus input | / |
| Expand file | Click filename |
| Apply all | Click "Apply All" button |

---

## 🎨 Understanding the UI

### Message Types

**User Messages** (Right side, card background):
```
┌────────────────────────────┐
│  Your request text         │
└────────────────────────────┘
```

**AI Responses** (Left side, no background):
```
✓ I'll modify index.js...
  [Diff viewer appears below]
```

### Diff Viewer Colors

- 🔴 **Red border**: Old code (being removed)
- 🟢 **Green border**: New code (being added)
- 🟡 **Yellow badge**: Pending modifications
- ✅ **Green checkmark**: Applied modifications

### Status Indicators

- ⏳ **Loading**: AI is processing
- ✓ **Complete**: Modifications ready
- ⚠️ **Needs clarification**: Request unclear
- ❌ **Error**: Something went wrong

---

## 🔧 Troubleshooting

### Problem: AI doesn't detect my request

**Solution:** Use explicit keywords
```
✅ "Change the authentication logic"
✅ "Modify index.js"
✅ "Update line 10"
```

### Problem: Modifications don't appear

**Check:**
1. Is this a project page? (needs project_id)
2. Does the project have generated code?
3. Check browser console for errors

### Problem: Apply button doesn't work

**Check:**
1. Are you the project owner?
2. Is the file in api_fragments?
3. Check network tab for failed requests

### Problem: Wrong code is modified

**Solution:** Be more specific
```
❌ "Fix the function"
✅ "Fix the getUserById function in user.service.ts"
```

---

## 📱 Mobile Usage

The interface is fully responsive:

- **Chat tab**: View conversation and diff viewer
- **Code tab**: See updated files
- Toggle between tabs using top navigation

---

## 🎓 Learning Examples

### Example 1: Step-by-Step Feature Addition

```
👤 User: Add a health check endpoint

🤖 AI: I'll add a health check endpoint to index.js
     [Shows modification]

👤 User: Apply

👤 User: Now add database connection check to it

🤖 AI: I'll update the health check endpoint...
     [Shows modification with DB check]

👤 User: Apply
```

### Example 2: Multi-File Refactoring

```
👤 User: Add error handling to all API endpoints

🤖 AI: I'll modify 3 files:
     - index.js: Add error middleware
     - routes.js: Add try-catch blocks
     - utils.js: Add error helper functions
     [Shows all modifications grouped by file]

👤 User: Apply All
```

### Example 3: Iterative Improvement

```
👤 User: Improve the user registration endpoint

🤖 AI: I'll add:
     - Email validation
     - Password strength check
     - Duplicate email prevention
     [Shows modifications]

👤 User: Apply

👤 User: Also add username validation

🤖 AI: I'll add username validation to the
      registration endpoint...
     [Shows modification]
```

---

## 📚 Next Steps

- Read the full [Documentation](./CONVERSATIONAL_CODE_EDITOR.md)
- Check [Implementation Details](./CONVERSATIONAL_CODE_EDITOR_IMPLEMENTATION.md)
- Explore the [PRD](./conversational-code-editor-prd.plan.md)

---

## 💬 Feedback

Found a bug or have a suggestion? 
- Check the troubleshooting section
- Review the logs in Inngest dashboard
- Verify database records

---

**Happy Coding! 🎉**

Remember: The AI is your pair programming buddy. Be conversational, be specific, and iterate!


