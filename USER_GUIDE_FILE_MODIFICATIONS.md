# User Guide: How File Modifications Work

## Overview

SmartAPIForge now intelligently modifies existing files instead of creating duplicates when you give follow-up prompts. This guide explains how it works and best practices.

## How It Works

### For New Projects
When you create a new project from scratch, the AI will:
- ✅ Create new files as needed
- ✅ Organize them in a logical structure
- ✅ Generate complete, working code

### For GitHub Cloned Projects
When you clone a GitHub repository, the AI will:
- ✅ **ONLY modify existing files** (unless you explicitly ask for new ones)
- ✅ Preserve your file structure and naming conventions
- ✅ Maintain compatibility with your existing code

### For Follow-up Prompts
When you send follow-up prompts on any project, the AI will:
- ✅ Find the most relevant files to modify
- ✅ Update them with your requested changes
- ✅ Keep the same file paths and names
- ✅ Show changes in the sandbox preview immediately

## Best Practices

### ✅ DO: Be Specific About What to Change

**Good Examples:**
```
"change the hero section text to 'Welcome'"
"make the navigation menu sticky"
"update the footer copyright year to 2025"
"add a loading spinner to the submit button"
```

### ✅ DO: Mention Component Names

**Good Examples:**
```
"update the HeroSection component"
"modify the ContactForm validation"
"change the Navbar background color"
```

### ❌ DON'T: Be Too Vague

**Bad Examples:**
```
"make it better"
"fix the design"
"improve the UI"
```

### ✅ DO: Request New Files Explicitly

**Good Examples:**
```
"create a new file called ContactForm.tsx"
"add a new component for the pricing table"
"generate a new API endpoint for user authentication"
```


## Understanding the Process

### Step 1: You Send a Prompt
```
"change the hero section background to blue"
```

### Step 2: AI Analyzes Your Request
- Identifies this is a modification request
- Searches for relevant files (HeroSection.tsx, Hero.tsx, etc.)
- Finds the exact file that needs to be changed

### Step 3: AI Generates Changes
- Modifies the existing file with your requested changes
- Keeps the same file path and structure
- Maintains your coding style

### Step 4: Changes Appear in Preview
- Updated file is sent to the sandbox
- Preview refreshes automatically
- You see your changes immediately

## Troubleshooting

### Issue: Changes Not Showing in Preview

**Possible Causes:**
1. Sandbox needs to restart
2. File wasn't properly identified
3. Syntax error in generated code

**Solutions:**
1. Click the "Restart Sandbox" button
2. Be more specific about which file to modify
3. Check the generation logs for errors

### Issue: Wrong File Was Modified

**Possible Causes:**
1. Multiple files with similar names
2. Ambiguous prompt

**Solutions:**
1. Specify the exact file path: "modify components/landing/HeroSection.tsx"
2. Mention the directory: "update the hero section in the landing page"

### Issue: New File Created Instead of Modifying

**This should be fixed now!** But if it still happens:
1. Check if you're working on a GitHub cloned project
2. Verify the file you want to modify actually exists
3. Report the issue with your prompt and project details

## Examples

### Example 1: Text Change
```
Prompt: "change the main heading to 'Welcome to SmartAPI'"
Result: Modifies the existing component with the heading
Files Changed: 1 (HeroSection.tsx)
```

### Example 2: Styling Update
```
Prompt: "make the navigation bar background dark blue"
Result: Updates the Navbar component styles
Files Changed: 1 (Navbar.tsx or Navigation.tsx)
```

### Example 3: Multiple Changes
```
Prompt: "update the hero section text and add a gradient background"
Result: Modifies the hero component with both changes
Files Changed: 1 (HeroSection.tsx)
```

### Example 4: Adding New Feature
```
Prompt: "add a contact form with name, email, and message fields"
Result: Creates new ContactForm.tsx component
Files Changed: 1 new file created
```

## Tips for Success

1. **Start Simple**: Make one change at a time to see how it works
2. **Be Descriptive**: Mention colors, sizes, positions explicitly
3. **Use Component Names**: If you know the component name, use it
4. **Check Preview**: Always verify changes in the sandbox preview
5. **Iterate**: Make small changes and build up to larger modifications

## Advanced Usage

### Modifying Multiple Files
```
"update the navigation menu and footer to use the new brand colors"
```
Result: Modifies both Nav.tsx and Footer.tsx

### Refactoring Code
```
"refactor the authentication logic to use React hooks"
```
Result: Updates auth-related files with modern patterns

### Deleting Features
```
"remove the newsletter signup section"
```
Result: Deletes or comments out the relevant code

## Getting Help

If you encounter issues:
1. Check the generation logs in the UI
2. Try rephrasing your prompt
3. Restart the sandbox
4. Report bugs with specific examples

---

**Remember**: The AI is designed to help you iterate quickly. Don't be afraid to experiment!
