import nodemailer from 'nodemailer';

// Initialize Gmail SMTP transporter
const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

interface SendInvitationEmailParams {
  to: string;
  projectName: string;
  inviterName: string;
  inviteToken: string;
  accessLevel: string;
}

export async function sendInvitationEmail({
  to,
  projectName,
  inviterName,
  inviteToken,
  accessLevel,
}: SendInvitationEmailParams) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteToken}`;

  if (!transporter) {
    throw new Error('Gmail SMTP is not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  try {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Invitation</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SmartAPIForge</h1>
            </div>
            
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">You've been invited!</h2>
              
              <p style="font-size: 16px; color: #555;">
                <strong>${inviterName}</strong> has invited you to collaborate on the project 
                <strong>${projectName}</strong> with <strong>${accessLevel}</strong> access.
              </p>
              
              <p style="font-size: 14px; color: #666; margin: 30px 0;">
                Click the button below to accept the invitation and start collaborating:
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${inviteUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          font-weight: bold; 
                          display: inline-block;
                          font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="font-size: 12px; color: #999; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
              </p>
              
              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SmartAPIForge. All rights reserved.</p>
            </div>
          </body>
        </html>
      `;

    const info = await transporter.sendMail({
      from: `"SmartAPIForge" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: `You've been invited to collaborate on ${projectName}`,
      html: htmlContent,
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
}

export async function sendInvitationEmailFallback({
  to,
  projectName,
  inviterName,
  inviteToken,
}: Omit<SendInvitationEmailParams, 'accessLevel'>) {
  // Fallback for development or when Resend is not configured
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteToken}`;
  
  console.log('\n=== EMAIL INVITATION (DEV MODE) ===');
  console.log(`To: ${to}`);
  console.log(`From: ${inviterName}`);
  console.log(`Project: ${projectName}`);
  console.log(`Invitation URL: ${inviteUrl}`);
  console.log('===================================\n');
  
  return { success: true, messageId: 'dev-mode' };
}
