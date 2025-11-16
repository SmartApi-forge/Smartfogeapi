# Dynamic Access Level System - Setup Guide

## Overview

Your application now has a complete dynamic access level system with 4 visibility options:

1. **Public** - Anyone with the invite link can access
2. **Workspace** - Only users in the same workspace can access
3. **Personal** - Only the owner can access
4. **Business** - Only users in the same organization can access

## Changes Made

### 1. Email Sender Name Fixed ✅
- Inviter name now properly extracts from the user's email if full_name is not set
- Format: "john.doe@example.com" → "John Doe"
- No more "Test User" showing up

### 2. Database Schema Updates ✅
- Added `workspace_id` and `organization_id` to profiles table
- Added `visibility` field to projects table
- Created `can_access_project()` function for access validation
- Updated RLS policies to enforce access control

### 3. Visibility Notifications ✅
- Toast notifications appear when changing project visibility
- Different messages for each visibility level
- Matches the style shown in your screenshot

### 4. Backend API ✅
- New `updateVisibility` mutation in projects router
- Access control validation in database function
- Automatic enforcement via Row Level Security

## Setup Instructions

### Step 1: Run the Database Migration

```bash
cd C:\Users\S Kavidarshini\Downloads\Smartfogeapi
supabase migration up
```

Or if using Supabase CLI locally:

```bash
supabase db push
```

Or apply directly via Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open and run: `supabase/migrations/20250117000000_add_workspace_organization.sql`

### Step 2: Configure Gmail SMTP (if not already done)

Update your `.env.local`:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### Step 3: Restart Your Development Server

```bash
npm run dev
```

## How to Use

### Setting Project Visibility

1. Open any project
2. Click the **Share** button
3. Select visibility level from dropdown:
   - 🌐 **Public** - Anyone with link
   - 👥 **Workspace** - Same workspace only
   - 👤 **Personal** - Owner only
   - 💼 **Business** - Same organization only

4. You'll see a toast notification confirming the change

### Setting Up Workspaces & Organizations

Since users don't have workspace/organization IDs by default, you'll need to set them up:

#### Option 1: Manual Setup (For Testing)

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Assign users to workspace
UPDATE public.profiles 
SET workspace_id = 'your-workspace-uuid-here'
WHERE id IN ('user-id-1', 'user-id-2');

-- Assign users to organization
UPDATE public.profiles 
SET organization_id = 'your-org-uuid-here'
WHERE id IN ('user-id-1', 'user-id-2');
```

#### Option 2: Create Workspace/Organization Management (Future Enhancement)

You can add a settings page where users can:
- Create workspaces
- Invite users to workspaces
- Create organizations
- Manage organization members

### Testing Access Control

1. **Public Access**:
   - Set project to "Public"
   - Any logged-in user can view with the invite link

2. **Workspace Access**:
   - Set project to "Workspace"
   - Assign 2+ users to the same workspace_id
   - Only those users can access the project

3. **Personal Access**:
   - Set project to "Personal"
   - Only the owner can see it (even with invite link)

4. **Business Access**:
   - Set project to "Business"
   - Assign 2+ users to the same organization_id
   - Only those users can access

## Visibility Notification Messages

When you change visibility, you'll see these notifications:

- **Public**: "Your project is now public. Anyone with the invite link can access it."
- **Workspace**: "Your project is now workspace-only. Only users in the same workspace can access it."
- **Personal**: "Your project is now personal. Only you can access this project."
- **Business**: "Your project is now business-only. Only users in your organization can access it."

## Access Control Enforcement

The system enforces access at multiple levels:

1. **Database Level** (RLS Policies)
   - PostgreSQL Row Level Security
   - `can_access_project()` function validates access
   - Automatic enforcement on all queries

2. **API Level** (tRPC)
   - Service layer validates ownership
   - Mutation checks before updates

3. **UI Level** (React Components)
   - Toast notifications for user feedback
   - Dropdown selection for visibility

## File Changes Summary

### New Files:
- `supabase/migrations/20250117000000_add_workspace_organization.sql`
- `ACCESS_LEVEL_SETUP.md` (this file)

### Modified Files:
- `lib/email.ts` - Improved inviter name extraction
- `src/modules/invitations/service.ts` - Better name fallback logic
- `src/modules/projects/router.ts` - Added updateVisibility mutation
- `src/modules/projects/service.ts` - Added updateVisibility method
- `components/share-dialog.tsx` - Added visibility notifications & persistence

## Troubleshooting

### "Visibility updated" notification doesn't persist
- Check that the migration was run successfully
- Verify `visibility` column exists in projects table
- Check browser console for errors

### Users can't access workspace/business projects
- Verify users have matching workspace_id or organization_id
- Check RLS policies are enabled
- Query profiles table to confirm IDs are set

### Email still shows "Test User"
- Clear Next.js cache: `Remove-Item -Recurse -Force .next`
- Restart dev server
- Update user's full_name in profiles table

## Next Steps

1. ✅ Run the migration
2. ✅ Test visibility changes
3. ✅ Test email invitations
4. 🔄 Set up workspace/organization IDs for testing
5. 🔄 Test access control with multiple users
6. 🚀 Deploy to production

## Support

If you encounter any issues:
1. Check the console logs for errors
2. Verify database migration completed
3. Confirm environment variables are set
4. Test with multiple user accounts

Enjoy your new dynamic access level system! 🎉
