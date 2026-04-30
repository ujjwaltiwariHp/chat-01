import nodemailer from 'nodemailer';
import { config } from '../config/base-config.js';
import { logger } from '../logging/logger.js';

const mailLogger = logger.child({ ns: 'mail:service' });

/**
 * Configure SMTP Transporter
 */
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST || 'localhost',
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER && config.SMTP_PASS ? {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  } : undefined,
});

/**
 * Send branded Magic Link Email
 */
export async function sendMagicLinkEmail(email: string, magicLink: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f9; color: #1a202c; padding: 40px; }
        .card { max-width: 480px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #2d3748; letter-spacing: -0.5px; margin-bottom: 24px; }
        .logo span { color: #319795; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
        p { line-height: 1.6; color: #4a5568; margin-bottom: 24px; }
        .btn { display: inline-block; background-color: #319795; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background 0.2s; }
        .btn:hover { background-color: #2c7a7b; }
        .footer { margin-top: 32px; font-size: 12px; color: #a0aec0; text-align: center; }
        .divider { border-top: 1px solid #edf2f7; margin: 32px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Hanging<span>Panda</span></div>
        <h1>Your Secure Login Link</h1>
        <p>Hello,</p>
        <p>You requested a secure login to the HangingPanda Intelligence Dashboard. Click the button below to sign in. This link will expire in 15 minutes.</p>
        <a href="${magicLink}" class="btn">Sign In to Dashboard</a>
        <p style="margin-top: 24px; font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="font-size: 13px; color: #319795; word-break: break-all;">${magicLink}</p>
        <div class="divider"></div>
        <p style="font-size: 13px;">If you did not request this email, you can safely ignore it.</p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} HangingPanda Intelligence. All rights reserved.
      </div>
    </body>
    </html>
  `;

  try {
    if (config.SMTP_HOST === 'mock' || !config.SMTP_HOST) {
      mailLogger.info({ email, magicLink }, 'DEVELOPMENT: Magic Link email logged (SMTP Mocked)');
      return { messageId: 'mock-id' };
    }

    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject: 'Your Secure Login Link - HangingPanda',
      html,
    });
    mailLogger.info({ msgId: info.messageId, email }, 'Magic Link email sent');
    return info;
  } catch (err: any) {
    if (config.NODE_ENV === 'development') {
      mailLogger.info({ email, magicLink, originalError: err.message }, 'DEVELOPMENT FALLBACK: Magic Link email logged after SMTP failure');
      return { messageId: 'fallback-id' };
    }

    mailLogger.error({ error: err.message, email }, 'Failed to send Magic Link email');
    throw err;
  }
}
