/**
 * Email Service for LifeVault
 * Supports MailHog for development and production email services (SendGrid, AWS SES, etc.)
 */

import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@lifevault.app';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'LifeVault';

// Determine email service based on environment
const USE_MAILHOG = process.env.USE_MAILHOG === 'true' || process.env.NODE_ENV !== 'production';
const MAILHOG_HOST = process.env.MAILHOG_HOST || 'localhost';
const MAILHOG_PORT = parseInt(process.env.MAILHOG_PORT || '1025', 10);

// Production email service configuration
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

// Create transporter based on environment
let transporter: nodemailer.Transporter | null = null;

if (USE_MAILHOG) {
  // Development: Use MailHog
  transporter = nodemailer.createTransport({
    host: MAILHOG_HOST,
    port: MAILHOG_PORT,
    secure: false, // MailHog doesn't use TLS
  });
} else if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
  // Production: Use configured SMTP service
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
} else {
  console.warn('No email service configured. Emails will not be sent.');
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  fullName?: string | null
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
  const displayName = fullName || email;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Verify your LifeVault email address',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Verify your email address</h2>
            <p style="color: #4b5563;">Hi ${displayName},</p>
            <p style="color: #4b5563;">Thank you for signing up for LifeVault! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email Address</a>
            </div>
            <p style="color: #4b5563; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #667eea; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This verification link will expire in 30 minutes. If you didn't create a LifeVault account, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${displayName},
      
      Thank you for signing up for LifeVault! Please verify your email address by visiting this link:
      
      ${verificationUrl}
      
      This verification link will expire in 30 minutes. If you didn't create a LifeVault account, you can safely ignore this email.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send password reset email (for future use)
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  fullName?: string | null
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
  const displayName = fullName || email;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Reset your LifeVault password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset password - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Reset your password</h2>
            <p style="color: #4b5563;">Hi ${displayName},</p>
            <p style="color: #4b5563;">We received a request to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
            </div>
            <p style="color: #4b5563; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #667eea; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${displayName},
      
      We received a request to reset your password. Visit this link to reset it:
      
      ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send nominee notification email
 */
export async function sendNomineeNotificationEmail(
  nomineeEmail: string,
  nomineeName: string,
  vaultOwnerName: string,
  vaultType: 'my_vault' | 'family_vault',
  vaultName?: string, // For family vaults
  encryptedPartC?: string // Encrypted Part C (JSON string) - password shared separately by user
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const nomineeAccessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/nominee/access`;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: nomineeEmail,
    subject: 'You have been designated as a Nominee for LifeVault',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nominee Designation - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">You've been designated as a Nominee</h2>
            <p style="color: #4b5563;">Hi ${nomineeName},</p>
            <p style="color: #4b5563;">
              <strong>${vaultOwnerName}</strong> has designated you as a nominee for their ${vaultType === 'family_vault' ? `Family Vault${vaultName ? `: "${vaultName}"` : ''}` : 'Personal Vault'} on LifeVault. 
              This means you may be granted read-only access to their encrypted vault under specific circumstances.
            </p>
            ${vaultType === 'family_vault' && vaultName ? `
            <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
              <p style="color: #374151; margin: 0; font-size: 14px;">
                <strong>Vault Type:</strong> Family Vault<br>
                <strong>Vault Name:</strong> ${vaultName}
              </p>
            </div>
            ` : ''}
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>What this means:</strong><br>
                • You have been given a secure key part (Part C) that, when combined with the service provider's key, can unlock the vault<br>
                • Access is read-only and only available under specific trigger conditions<br>
                • You will be notified if and when access is needed
              </p>
            </div>
            ${encryptedPartC ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important: Your Encrypted Key Part</strong><br>
                Below is your encrypted key part (Part C). You will need the decryption password that ${vaultOwnerName} will share with you separately (via phone, in person, etc.) to decrypt this key.
              </p>
              <div style="background: #fff; border: 1px solid #d1d5db; border-radius: 4px; padding: 12px; margin-top: 10px; font-family: monospace; font-size: 11px; word-break: break-all; color: #1f2937;">
                ${encryptedPartC}
              </div>
              <p style="color: #92400e; margin: 10px 0 0 0; font-size: 12px;">
                <strong>Instructions:</strong><br>
                1. Save this encrypted key part securely<br>
                2. Wait for ${vaultOwnerName} to share the decryption password with you through a secure channel<br>
                3. When access is needed, decrypt this key part using the password<br>
                4. Combine it with the service provider's key to unlock the vault
              </p>
            </div>
            ` : ''}
            <p style="color: #4b5563;">
              ${encryptedPartC ? 'Please save the encrypted key part above securely. ' : ''}You will be contacted if and when access to the vault is needed.
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have questions or believe this designation was made in error, please contact ${vaultOwnerName} directly.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${nomineeName},
      
      ${vaultOwnerName} has designated you as a nominee for their LifeVault account. 
      This means you may be granted read-only access to their encrypted vault under specific circumstances.
      
      What this means:
      - You have been given a secure key part (Part C) that, when combined with the service provider's key, can unlock the vault
      - Access is read-only and only available under specific trigger conditions
      - You will be notified if and when access is needed
      ${encryptedPartC ? `
      
      IMPORTANT: Your Encrypted Key Part
      Below is your encrypted key part. You will need the decryption password that ${vaultOwnerName} will share with you separately to decrypt this key.
      
      Encrypted Key Part:
      ${encryptedPartC}
      
      Instructions:
      1. Save this encrypted key part securely
      2. Wait for ${vaultOwnerName} to share the decryption password with you through a secure channel
      3. When access is needed, decrypt this key part using the password
      4. Combine it with the service provider's key to unlock the vault
      ` : ''}
      
      ${encryptedPartC ? 'Please save the encrypted key part above securely. ' : ''}You will be contacted if and when access to the vault is needed.
      
      If you have questions or believe this designation was made in error, please contact ${vaultOwnerName} directly.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Nominee notification email sent to ${nomineeEmail}`);
  } catch (error) {
    console.error('Error sending nominee notification email:', error);
    throw new Error('Failed to send nominee notification email');
  }
}

/**
 * Send access request notification to user (Use Case 1)
 */
export async function sendAccessRequestEmail(
  userEmail: string,
  userName: string | null,
  nomineeName: string,
  relationship: string,
  reasonForAccess: string,
  approvalToken: string
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nominee/access/approve?token=${approvalToken}`;
  const rejectionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nominee/access/reject?token=${approvalToken}`;
  const displayName = userName || userEmail;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: userEmail,
    subject: 'Nominee Access Request - Action Required',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Request - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Nominee Access Request</h2>
            <p style="color: #4b5563;">Hi ${displayName},</p>
            <p style="color: #4b5563;">
              <strong>${nomineeName}</strong> has requested read-only access to your LifeVault.
            </p>
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>Request Details:</strong><br>
                • Nominee: ${nomineeName}<br>
                • Relationship: ${relationship}<br>
                • Reason: ${reasonForAccess}
              </p>
            </div>
            <p style="color: #4b5563;">
              Please review this request and decide whether to approve or reject it. The request will expire in 7 days.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">Approve Request</a>
              <a href="${rejectionUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reject Request</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you did not expect this request, please reject it and contact ${nomineeName} directly.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${displayName},
      
      ${nomineeName} has requested read-only access to your LifeVault.
      
      Request Details:
      - Nominee: ${nomineeName}
      - Relationship: ${relationship}
      - Reason: ${reasonForAccess}
      
      Please review this request:
      Approve: ${approvalUrl}
      Reject: ${rejectionUrl}
      
      The request will expire in 7 days.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Access request email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending access request email:', error);
    throw new Error('Failed to send access request email');
  }
}

/**
 * Send access approval/rejection notification to nominee (Use Case 1)
 */
export async function sendAccessDecisionEmail(
  nomineeEmail: string,
  nomineeName: string,
  userName: string,
  approved: boolean,
  accessRequestId?: string, // New: Access request ID for unlock
  rejectionReason?: string
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/nominee-access`;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: nomineeEmail,
    subject: approved ? 'Access Request Approved - LifeVault' : 'Access Request Rejected - LifeVault',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Decision - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Access Request ${approved ? 'Approved' : 'Rejected'}</h2>
            <p style="color: #4b5563;">Hi ${nomineeName},</p>
            ${approved ? `
            <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <p style="color: #065f46; margin: 0; font-size: 14px;">
                <strong>✓ Approved</strong><br>
                ${userName} has approved your request for read-only access to their LifeVault.
              </p>
            </div>
            <p style="color: #4b5563;">
              You can now access the vault using your encrypted key part (Part C) and the decryption password that ${userName} shared with you.
            </p>
            ${accessRequestId ? `
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>Your Access Request ID:</strong><br>
                <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all;">${accessRequestId}</code>
              </p>
              <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 12px;">
                You will need this Access Request ID along with your encrypted key part (Part C) and decryption password to unlock the vault.
              </p>
            </div>
            ` : ''}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${accessUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Access Vault</a>
            </div>
            ` : `
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                <strong>✗ Rejected</strong><br>
                ${userName} has rejected your request for access to their LifeVault.
                ${rejectionReason ? `<br><br>Reason: ${rejectionReason}` : ''}
              </p>
            </div>
            <p style="color: #4b5563;">
              If you believe this was a mistake, please contact ${userName} directly.
            </p>
            `}
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${nomineeName},
      
      Your access request has been ${approved ? 'approved' : 'rejected'} by ${userName}.
      ${approved ? `
      You can now access the vault at: ${accessUrl}
      ${accessRequestId ? `\n\nYour Access Request ID: ${accessRequestId}\nYou will need this Access Request ID along with your encrypted key part (Part C) and decryption password to unlock the vault.` : ''}
      ` : rejectionReason ? `Reason: ${rejectionReason}` : ''}
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Access decision email sent to ${nomineeEmail}`);
  } catch (error) {
    console.error('Error sending access decision email:', error);
    throw new Error('Failed to send access decision email');
  }
}

/**
 * Send recovery key email to user
 */
export async function sendRecoveryKeyEmail(
  userEmail: string,
  userName: string | null,
  recoveryKey: string
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/my-vault`;
  const displayName = userName || userEmail;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: userEmail,
    subject: 'Your LifeVault Recovery Key - Save This Securely',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recovery Key - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Your Recovery Key</h2>
            <p style="color: #4b5563;">Hi ${displayName},</p>
            <p style="color: #4b5563;">
              Your LifeVault has been set up successfully! Below is your <strong>Recovery Key</strong> that you can use to unlock your vault if you forget your master password.
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important: Save This Recovery Key Securely</strong><br>
                • Store it in a password manager or secure location<br>
                • Print it and keep it in a safe place<br>
                • Do not share it with anyone<br>
                • You will need this if you forget your master password
              </p>
            </div>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0 0 10px 0; font-size: 14px;">
                <strong>Your Recovery Key:</strong>
              </p>
              <div style="background: #fff; border: 1px solid #d1d5db; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 11px; word-break: break-all; color: #1f2937; text-align: center;">
                ${recoveryKey}
              </div>
              <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 12px;">
                This key can be used to unlock your vault if you forget your master password. Keep it safe!
              </p>
            </div>

            <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <p style="color: #065f46; margin: 0; font-size: 14px;">
                <strong>✓ Vault Setup Complete</strong><br>
                Your encrypted vault is ready. You can now start adding files and documents.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${accessUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Access Your Vault</a>
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <strong>Security Note:</strong> This recovery key was generated during vault setup. If you did not set up a LifeVault account, please contact support immediately.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${displayName},
      
      Your LifeVault has been set up successfully! Below is your Recovery Key that you can use to unlock your vault if you forget your master password.
      
      ⚠️ Important: Save This Recovery Key Securely
      - Store it in a password manager or secure location
      - Print it and keep it in a safe place
      - Do not share it with anyone
      - You will need this if you forget your master password
      
      Your Recovery Key:
      ${recoveryKey}
      
      This key can be used to unlock your vault if you forget your master password. Keep it safe!
      
      Your encrypted vault is ready. Access it at: ${accessUrl}
      
      Security Note: This recovery key was generated during vault setup. If you did not set up a LifeVault account, please contact support immediately.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Recovery key email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending recovery key email:', error);
    throw new Error('Failed to send recovery key email');
  }
}

/**
 * Send inactivity reminder to user (Use Case 2)
 */
export async function sendInactivityReminderEmail(
  userEmail: string,
  userName: string | null,
  daysInactive: number,
  reminderNumber: number
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/login`;
  const displayName = userName || userEmail;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: userEmail,
    subject: `Reminder: You haven't logged in to LifeVault in ${daysInactive} days`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Inactivity Reminder - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Inactivity Reminder</h2>
            <p style="color: #4b5563;">Hi ${displayName},</p>
            <p style="color: #4b5563;">
              We noticed you haven't logged in to your LifeVault account in <strong>${daysInactive} days</strong>.
            </p>
            ${reminderNumber === 3 ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Final Reminder</strong><br>
                This is your third and final reminder. If you don't log in within the next few days, your designated nominees will be notified and may be granted access to your vault.
              </p>
            </div>
            ` : `
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                This is reminder #${reminderNumber} of 3. Please log in to confirm you're still active.
              </p>
            </div>
            `}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Log In Now</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you're unable to log in, please contact support or your designated nominees may be notified.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${displayName},
      
      We noticed you haven't logged in to your LifeVault account in ${daysInactive} days.
      ${reminderNumber === 3 ? 'This is your final reminder. If you don\'t log in soon, your nominees may be notified.' : `This is reminder #${reminderNumber} of 3.`}
      
      Log in now: ${loginUrl}
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Inactivity reminder email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending inactivity reminder email:', error);
    throw new Error('Failed to send inactivity reminder email');
  }
}

/**
 * Send nominee notification for inactivity (Use Case 2)
 */
export async function sendNomineeInactivityNotification(
  nomineeEmail: string,
  nomineeName: string,
  userName: string,
  daysInactive: number
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/nominee-access`;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: nomineeEmail,
    subject: `Action Required: ${userName} has been inactive for ${daysInactive} days`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nominee Notification - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Nominee Access Notification</h2>
            <p style="color: #4b5563;">Hi ${nomineeName},</p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important Notice</strong><br>
                ${userName} has been inactive for <strong>${daysInactive} days</strong>. As a designated nominee, you may now be granted read-only access to their LifeVault.
              </p>
            </div>
            <p style="color: #4b5563;">
              You can access the vault using your encrypted key part (Part C) and the decryption password that ${userName} shared with you.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${accessUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Access Vault</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have questions or believe this notification was sent in error, please contact ${userName} directly if possible.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${nomineeName},
      
      ${userName} has been inactive for ${daysInactive} days. As a designated nominee, you may now be granted read-only access to their LifeVault.
      
      Access the vault: ${accessUrl}
      
      You will need your encrypted key part (Part C) and the decryption password that ${userName} shared with you.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Nominee inactivity notification sent to ${nomineeEmail}`);
  } catch (error) {
    console.error('Error sending nominee inactivity notification:', error);
    throw new Error('Failed to send nominee inactivity notification');
  }
}

/**
 * Send family vault invite email
 */
export async function sendFamilyVaultInviteEmail(
  toEmail: string,
  vaultName: string,
  inviterName: string,
  inviteToken: string,
  vaultId?: string
): Promise<void> {
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return;
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/family-vault/setup?token=${inviteToken}&vaultId=${vaultId || ''}`;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: `You've been invited to join ${vaultName} on LifeVault`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Family Vault Invitation - LifeVault</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LifeVault</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">You've been invited to a Family Vault</h2>
            <p style="color: #4b5563;">Hi there,</p>
            <p style="color: #4b5563;">
              <strong>${inviterName}</strong> has invited you to join the <strong>${vaultName}</strong> Family Vault on LifeVault.
            </p>
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>What is a Family Vault?</strong><br>
                A Family Vault is a shared encrypted vault where family members can securely store and access important documents together. All data is encrypted client-side, ensuring complete privacy.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
            </div>
            <p style="color: #4b5563; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #667eea; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi there,
      
      ${inviterName} has invited you to join the ${vaultName} Family Vault on LifeVault.
      
      A Family Vault is a shared encrypted vault where family members can securely store and access important documents together.
      
      Accept your invitation: ${inviteUrl}
      
      If you didn't expect this invitation, you can safely ignore this email.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Family vault invite email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending family vault invite email:', error);
    throw new Error('Failed to send family vault invite email');
  }
}

