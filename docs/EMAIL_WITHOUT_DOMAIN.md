# Email Setup Without Custom Domain

If you're deploying on Vercel and don't have a custom domain, you have several options:

## Option 1: Verify Your Vercel Subdomain (Recommended) ✅

Vercel provides you with a free subdomain (e.g., `yourapp.vercel.app`). You can verify this with Resend!

### Steps:

1. **Get Your Vercel Domain**
   - Deploy your app to Vercel
   - Your URL will be something like: `smartapiforge.vercel.app`

2. **Add Domain to Resend**
   - Go to [Resend Dashboard → Domains](https://resend.com/domains)
   - Click **Add Domain**
   - Enter your Vercel domain: `smartapiforge.vercel.app`

3. **Add DNS Records to Vercel**
   - Resend will show you DNS records to add
   - Go to your [Vercel Dashboard → Project Settings → Domains](https://vercel.com/dashboard)
   - Click on your domain
   - Scroll to **DNS Records**
   - Add the TXT, MX, and CNAME records from Resend

4. **Update Your Email Address**
   
   In `lib/email.ts`, change:
   ```typescript
   from: 'SmartAPIForge <noreply@smartapiforge.vercel.app>',
   ```

5. **Wait for Verification** (usually 5-10 minutes)

---

## Option 2: Use Alternative Email Service (No Domain Required)

### A. **Brevo (formerly Sendinblue)** - Best Free Alternative

- ✅ **300 emails/day FREE** (no domain verification required)
- ✅ Works immediately
- ✅ Simple setup

#### Setup:

1. Sign up at [brevo.com](https://www.brevo.com)
2. Get API key from Settings → API Keys
3. Install package:
   ```bash
   npm install @getbrevo/brevo
   ```

4. Create `lib/email-brevo.ts`:
   ```typescript
   import * as brevo from '@getbrevo/brevo';
   
   const apiInstance = new brevo.TransactionalEmailsApi();
   apiInstance.setApiKey(
     brevo.TransactionalEmailsApiApiKeys.apiKey,
     process.env.BREVO_API_KEY || ''
   );
   
   export async function sendInvitationEmailBrevo({
     to,
     projectName,
     inviterName,
     inviteToken,
     accessLevel,
   }: {
     to: string;
     projectName: string;
     inviterName: string;
     inviteToken: string;
     accessLevel: string;
   }) {
     const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;
     
     const sendSmtpEmail = new brevo.SendSmtpEmail();
     sendSmtpEmail.sender = { 
       name: 'SmartAPIForge', 
       email: 'noreply@your-verified-sender.com' // Use your Brevo sender
     };
     sendSmtpEmail.to = [{ email: to }];
     sendSmtpEmail.subject = `You've been invited to collaborate on ${projectName}`;
     sendSmtpEmail.htmlContent = `
       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
         <h2>You've been invited!</h2>
         <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>${projectName}</strong>.</p>
         <p><a href="${inviteUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a></p>
         <p style="color: #666; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
       </div>
     `;
     
     await apiInstance.sendTransacEmail(sendSmtpEmail);
   }
   ```

5. Add to `.env.local`:
   ```bash
   BREVO_API_KEY=your_brevo_api_key_here
   ```

### B. **Gmail SMTP** - Free but Limited

- ✅ Completely free
- ❌ Limited to 500 emails/day
- ❌ Requires app password

#### Setup:

1. Enable 2FA on your Gmail account
2. Generate App Password: [Google Account → Security → 2-Step Verification → App passwords](https://myaccount.google.com/apppasswords)
3. Install nodemailer:
   ```bash
   npm install nodemailer
   ```

4. Create `lib/email-gmail.ts`:
   ```typescript
   import nodemailer from 'nodemailer';
   
   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: process.env.GMAIL_USER,
       pass: process.env.GMAIL_APP_PASSWORD,
     },
   });
   
   export async function sendInvitationEmailGmail({
     to,
     projectName,
     inviterName,
     inviteToken,
   }: {
     to: string;
     projectName: string;
     inviterName: string;
     inviteToken: string;
   }) {
     const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;
     
     await transporter.sendMail({
       from: `"SmartAPIForge" <${process.env.GMAIL_USER}>`,
       to,
       subject: `You've been invited to collaborate on ${projectName}`,
       html: `
         <div style="font-family: Arial, sans-serif;">
           <h2>You've been invited!</h2>
           <p><strong>${inviterName}</strong> invited you to <strong>${projectName}</strong>.</p>
           <a href="${inviteUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
         </div>
       `,
     });
   }
   ```

5. Add to `.env.local`:
   ```bash
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your_16_char_app_password
   ```

---

## Option 3: Keep Resend for Development (Current Setup)

For development/testing, you can continue using `onboarding@resend.dev`, but you can only send to your own email address (`kavidarshinisakthivel@gmail.com`).

### Good for:
- Testing the functionality
- Development environment
- Demos with your own email

### Update Service to Handle This:

In `src/modules/invitations/service.ts`, add a check:

```typescript
// In sendEmailInvite method, before sending:
const isDevelopment = !process.env.RESEND_DOMAIN_VERIFIED;
const testEmail = 'kavidarshinisakthivel@gmail.com';

if (isDevelopment && input.email !== testEmail) {
  console.log(`⚠️  Development mode: Would send to ${input.email}, but sending to ${testEmail} instead`);
  // Send to test email instead
  await sendInvitationEmail({
    to: testEmail,
    projectName: project.name + ` (intended for ${input.email})`,
    inviterName,
    inviteToken: token,
    accessLevel: input.accessLevel,
  });
} else {
  // Normal sending
  await sendInvitationEmail({
    to: input.email,
    projectName: project.name,
    inviterName,
    inviteToken: token,
    accessLevel: input.accessLevel,
  });
}
```

---

## Comparison Table

| Service | Free Tier | Domain Required | Setup Time | Best For |
|---------|-----------|-----------------|------------|----------|
| **Resend + Vercel Domain** | 3,000/month | Vercel subdomain | 10 min | Production (Recommended) |
| **Brevo** | 300/day | No | 5 min | Quick setup, no domain |
| **Gmail SMTP** | 500/day | No | 10 min | Small projects |
| **Resend (current)** | 3,000/month | Yes, or limited | 0 min | Development only |

---

## Quick Fix: Switch to Brevo Now

If you want to send emails to all users RIGHT NOW without waiting for domain verification:

1. **Sign up for Brevo** (2 minutes)
2. **Get API key** (1 minute)
3. **Install package** (1 minute):
   ```bash
   npm install @getbrevo/brevo --legacy-peer-deps
   ```

4. **Update email service** to use Brevo instead of Resend

Would you like me to implement the Brevo solution for you?
