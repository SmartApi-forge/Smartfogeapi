# Project Collaboration & Permissions System

## Overview
The SmartAPIForge collaboration system allows project owners to invite other users to collaborate on their projects with different access levels.

## Access Levels

### 1. **Owner** (Project Creator)
- Full access to all project features
- Can manage project settings
- Can invite collaborators
- Can view, create, edit, and delete all files
- Can access sandbox preview and terminal
- Can delete the project

### 2. **Edit Access** (Business Tier Invitations)
- Can view the project
- Can access sandbox preview and terminal
- Can create new files and folders
- Can delete files and folders
- Can edit existing files
- Cannot invite other collaborators
- Cannot delete the project

### 3. **View Access** (Public Tier Invitations)
- Can view the project
- Can access sandbox preview and terminal
- **Cannot** create new files or folders
- **Cannot** delete files or folders
- Can view existing files (read-only)
- Cannot invite other collaborators
- Cannot delete the project

## How Access Levels Are Assigned

When a user accepts an invitation:
```typescript
// From src/modules/invitations/service.ts line 406
const accessLevel = invitation.access_level === 'business' ? 'edit' : 'view';
```

- **Business tier invitations** → Grant `edit` access
- **Public invitations** → Grant `view` access only

## Permission Matrix

| Feature | Owner | Edit Access | View Access |
|---------|-------|-------------|-------------|
| View Project | ✅ | ✅ | ✅ |
| View Files | ✅ | ✅ | ✅ |
| Edit Files | ✅ | ✅ | ❌ |
| Create Files/Folders | ✅ | ✅ | ❌ |
| Delete Files/Folders | ✅ | ✅ | ❌ |
| Access Preview | ✅ | ✅ | ✅ |
| Access Terminal | ✅ | ✅ | ✅ |
| Invite Collaborators | ✅ | ❌ | ❌ |
| Delete Project | ✅ | ❌ | ❌ |
| View Collaborators List | ✅ | ✅ | ✅ |

## API Endpoints with Access Control

### Project Access
- **Route**: `projects.getOne`
- **File**: `src/modules/projects/service.ts` (lines 33-74)
- **Access**: Owner OR any collaborator (view or edit)

### File Creation
- **Route**: `/api/sandbox/file/create`
- **File**: `app/api/sandbox/file/create/route.ts`
- **Access**: Owner OR collaborators with `edit` permission

### File Deletion
- **Route**: `/api/sandbox/file/delete`
- **File**: `app/api/sandbox/file/delete/route.ts`
- **Access**: Owner OR collaborators with `edit` permission

### Sandbox Keepalive (Preview/Terminal)
- **Route**: `/api/sandbox/keepalive/[projectId]`
- **File**: `app/api/sandbox/keepalive/[projectId]/route.ts`
- **Access**: Owner OR any collaborator (view or edit)

### Collaborators Management
- **Route**: `invitations.getProjectCollaborators`
- **File**: `src/modules/invitations/service.ts` (lines 459-544)
- **Access**: Owner OR any collaborator (can view list)

## Invitation Flow

1. **Owner sends invitation**
   - Via Share Dialog
   - Email sent with invitation link
   - Token stored in `project_invitations` table

2. **Recipient receives email**
   - Clicks invitation link: `/invite/{token}`
   - If not logged in → redirected to login
   - Returns to invitation page after login

3. **Accept invitation**
   - User accepts or declines
   - If accepted:
     - User added to `project_collaborators` table
     - Access level assigned based on invitation type
     - Redirected to project

4. **Access project**
   - Collaborator can now access the project
   - Features available based on access level
   - Appears in collaborators list in Share Dialog

## Database Schema

### `project_invitations` Table
```sql
- id: uuid
- project_id: uuid (FK to projects)
- email: text
- token: text (unique)
- status: text ('pending', 'accepted', 'declined', 'expired')
- access_level: text ('public', 'business')
- created_by: uuid (FK to profiles)
- accepted_by: uuid (FK to profiles)
- expires_at: timestamp
- created_at: timestamp
```

### `project_collaborators` Table
```sql
- id: uuid
- project_id: uuid (FK to projects)
- user_id: uuid (FK to profiles)
- access_level: text ('view', 'edit')
- added_by: uuid (FK to profiles)
- created_at: timestamp
```

## Checking Permissions in Code

### For File Operations (Create/Delete)
```typescript
// 1. Check if user is owner
const isOwner = project.user_id === user.id;

if (!isOwner) {
  // 2. Check if user is collaborator with edit access
  const { data: collaborator } = await supabase
    .from('project_collaborators')
    .select('access_level')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!collaborator || collaborator.access_level !== 'edit') {
    throw new Error('You need edit permissions to perform this action');
  }
}
```

### For Read-Only Operations (View/Preview)
```typescript
// 1. Check if user is owner
const isOwner = project.user_id === user.id;

if (!isOwner) {
  // 2. Check if user is ANY collaborator
  const { data: collaborator } = await supabase
    .from('project_collaborators')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!collaborator) {
    throw new Error('You do not have access to this project');
  }
}
```

## Share Dialog Features

The Share Dialog displays:
- **Owner information**: Name, email, avatar
- **Collaborators list**: All users with access
- **Access level**: Displayed for each collaborator
- **Invitation form**: Send new invitations
- **Pending invitations**: List of invitations not yet accepted

## Testing Permissions

### To test as a collaborator:
1. Create a project as User A
2. Send invitation to User B's email
3. Log out and log in as User B
4. Accept the invitation
5. Try accessing different features:
   - View project ✅
   - View files ✅
   - Create/delete files (depends on access level)
   - Access preview/terminal ✅

### To test different access levels:
1. **For Edit Access**: Use business tier invitation
2. **For View Access**: Use public invitation

## Error Messages

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 401 | Authentication required | User not logged in |
| 403 | You do not have access to this project | User is not owner or collaborator |
| 403 | You need edit permissions to [action] | User has view-only access |
| 404 | Project not found | Project doesn't exist or was deleted |

## Future Enhancements

Potential improvements:
- [ ] Admin access level (can manage collaborators)
- [ ] Custom permissions (granular control)
- [ ] Collaborator removal by owner
- [ ] Access level modification
- [ ] Activity log for collaboration actions
- [ ] Notification system for collaboration events
