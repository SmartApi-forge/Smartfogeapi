# Email Invitation Setup

This guide explains how to set up email invitations for project collaboration in SmartAPIForge.

## Overview

The email invitation system allows project owners to:
- Send email invitations to collaborators
- Share projects with specific access levels
- Track invitation status (pending, accepted, declined, expired)
- Prevent non-owners from creating invitations (security)

## Email Service: Resend

We use [Resend](https://resend.com) for sending emails because:
- ✅ Simple API and great developer experience
- ✅ Generous free tier (3,000 emails/month)
- ✅ Built for developers
- ✅ Works seamlessly with Next.js

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. Log in to your Resend dashboard
2. Navigate to **API Keys** section
3. Click **Create API Key**
4. Give it a name (e.g., "SmartAPIForge")
5. Copy the API key (starts with `re_...`)

### 3. Add API Key to Environment

Open your `.env.local` file and add:

```bash
RESEND_API_KEY=re_your_api_key_here
```

### 4. Verify Domain (For Production)

For production use, you'll need to verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the provided DNS records to your domain provider
5. Wait for verification (usually 5-10 minutes)

Once verified, update the `from` address in `src/lib/email.ts`:

```typescript
from: 'SmartAPIForge <noreply@yourdomain.com>',
```

### 5. Update App URL

Make sure `NEXT_PUBLIC_APP_URL` in `.env.local` is set correctly:

```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Development Mode

If `RESEND_API_KEY` is not set, the system will run in **development mode**:
- Emails won't actually be sent
- Invitation details will be logged to the console
- You can still test the invitation flow by manually visiting the invite URLs

Example console output:
```
=== EMAIL INVITATION (DEV MODE) ===
To: collaborator@example.com
From: John Doe
Project: My API Project
Invitation URL: http://localhost:3000/invite/abc123...
===================================
```

## Security Features

### Owner-Only Invitations

Only project owners can send invitations:
- ✅ Ownership verified in backend service
- ✅ UI shows warning for non-owners
- ✅ Database RLS policies enforce ownership
- ❌ Collaborators cannot invite others

### Access Levels

Invitations support different access levels:
- **Public**: Basic read access
- **Workspace**: Workspace-level collaboration
- **Personal**: Personal collaboration
- **Business**: Full edit permissions

When an invitation is accepted:
- `business` → `edit` access in project
- Others → `view` access in project

### Invitation Expiry

- Invitations expire after 7 days by default
- Expired invitations cannot be accepted
- Status automatically updated to "expired"

## Testing

### Test Email Sending

1. Make sure `RESEND_API_KEY` is set in `.env.local`
2. Start your development server: `npm run dev`
3. Open a project you own
4. Click the **Share** button
5. Enter an email address (use your own for testing)
6. Click **Invite**
7. Check your inbox for the invitation email

### Test Invitation Acceptance

1. Copy the invitation link from the email
2. Open it in a browser
3. You should see the acceptance dialog
4. Click **Accept Invitation**
5. You'll be redirected to the project

## Email Template

The invitation email includes:
- Professional branded header
- Clear call-to-action button
- Project name and inviter information
- Access level details
- Alternative text link
- Expiry notice

To customize the email template, edit `src/lib/email.ts`.

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Ensure `RESEND_API_KEY` is set correctly in `.env.local`
2. **Check Domain**: For production, verify your domain is verified in Resend
3. **Check Logs**: Look for error messages in the server console
4. **Check Limits**: Free tier has 3,000 emails/month limit

### Invitation Link Broken

1. **Check APP_URL**: Ensure `NEXT_PUBLIC_APP_URL` is correct
2. **Check Token**: Token should be in the URL: `/invite/{token}`
3. **Check Expiry**: Invitation might have expired

### Permission Errors

1. **Check Ownership**: Only project owners can send invitations
2. **Check RLS Policies**: Ensure Supabase RLS policies are correctly configured
3. **Check User Auth**: Ensure user is authenticated

## Support

For issues with:
- **Resend API**: Visit [resend.com/docs](https://resend.com/docs)
- **Project Issues**: Check the server logs and browser console
- **Database Issues**: Check Supabase dashboard for RLS policy errors

## Cost Information

### Resend Pricing

- **Free Tier**: 3,000 emails/month
- **Pro Tier**: $20/month for 50,000 emails
- **Business Tier**: Custom pricing

For most projects, the free tier is sufficient!
