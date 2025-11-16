# Gmail SMTP Setup Guide

Your application has been configured to use Gmail SMTP for sending emails. Follow these steps to complete the setup:

## 1. Generate a Gmail App Password

Since Gmail requires 2-factor authentication for SMTP access, you need to create an App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security** from the left menu
3. Under "Signing in to Google," select **2-Step Verification** (enable it if not already enabled)
4. At the bottom of the page, select **App passwords**
5. You might need to sign in again
6. Select **Mail** as the app and your device type
7. Click **Generate**
8. Copy the 16-character password (spaces will be automatically removed)

## 2. Update Your Environment Variables

Edit your `.env.local` file and update these values:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

**Important:** 
- Use your actual Gmail address for `GMAIL_USER`
- Use the App Password (not your regular Gmail password) for `GMAIL_APP_PASSWORD`
- Never commit these credentials to version control

## 3. Test the Email Functionality

After updating the environment variables:

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Try sending an invitation email through your application
3. Check the console for success messages

## Configuration Details

The email configuration is in `lib/email.ts`:
- Uses nodemailer with Gmail's SMTP service
- Sends from your Gmail account
- Automatically handles authentication

## Troubleshooting

### "Less secure app access" error
- Make sure you're using an App Password, not your regular password
- Ensure 2-Step Verification is enabled on your Google Account

### Emails not sending
- Verify your environment variables are set correctly
- Check that your Gmail account is active and not suspended
- Review the console logs for detailed error messages

### Rate Limits
Gmail has sending limits:
- Free Gmail: 500 emails per day
- Google Workspace: 2,000 emails per day

## Development Mode

If `GMAIL_USER` or `GMAIL_APP_PASSWORD` are not set, the application will run in development mode:
- Emails won't actually be sent
- Invitation details will be logged to the console
- No errors will be thrown

## Removing Resend Dependency (Optional)

If you want to completely remove Resend from your project:

```bash
npm uninstall resend --legacy-peer-deps
```

Then remove any remaining Resend references in your documentation files.
