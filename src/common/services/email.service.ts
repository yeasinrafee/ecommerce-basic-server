import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.mailHost,
      port: 465, // Use 465 for true SSL/TLS. Use 587 for STARTTLS.
      secure: true,
      auth: {
        user: env.mailUser,
        pass: env.mailPass,
      },
    });
  }

  /**
   * Send an email with robust configurations.
   * Supports HTML, Plain Text, and Attachments (PDFs, Images, etc.)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${env.mailFrom.split('@')[0]}" <${env.mailFrom}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html ? this.applyBaseStyling(options.html) : undefined,
        text: options.text,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${mailOptions.to}. MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      // Depending on your error handling logic, you can throw or return false
      throw error;
    }
  }

  /**
   * Applies base styling/wrapper to any HTML code so it looks good on all email clients.
   * You can inject your dynamic HTML into the body of this template.
   */
  private applyBaseStyling(contentHtml: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta http-equiv="x-ua-compatible" content="ie=edge">
        <title>Email Notification</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          /* Basic reset and styling for email clients */
          body, table, td, a {
            -ms-text-size-adjust: 100%; /* 1 */
            -webkit-text-size-adjust: 100%; /* 2 */
          }
          table, td {
            mso-table-rspace: 0pt;
            mso-table-lspace: 0pt;
          }
          img {
            -ms-interpolation-mode: bicubic;
          }
          a[x-apple-data-detectors] {
            font-family: inherit !important;
            font-size: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
            color: inherit !important;
            text-decoration: none !important;
          }
          body {
            width: 100% !important;
            height: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background-color: #f4f4f4;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .email-header {
            background-color: #007bff;
            color: #ffffff;
            padding: 20px;
            text-align: center;
          }
          .email-body {
            padding: 30px;
            color: #333333;
            line-height: 1.6;
            font-size: 16px;
          }
          .email-footer {
            background-color: #f4f4f4;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #777777;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            margin-top: 20px;
          }
          /* Ensure text block respects margins */
          p { margin: 0 0 15px 0; }
        </style>
      </head>
      <body>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 40px 10px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container">
                <tr>
                  <td class="email-body">
                    <!-- Dynamic Content Goes Here -->
                    ${contentHtml}
                  </td>
                </tr>
                <tr>
                  <td class="email-footer">
                    <p>&copy; ${new Date().getFullYear()} ${env.mailFrom.split('@')[0]}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // Pre-built template for OTPs as an example
  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const html = `
      <h2 style="margin-bottom: 20px;">Your One-Time Password (OTP)</h2>
      <p>Hello,</p>
      <p>Your OTP code for verification is:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; display: inline-block; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #007bff;">
        \${otp}
      </div>
      <p>Please use this code within the next 10 minutes. If you did not request this, please ignore this email.</p>
    `;

    return this.sendEmail({
      to,
      subject: 'Your OTP Code',
      html,
    });
  }

  // Pre-built template for general alerts or invoices with attachments
  async sendInvoiceEmail(to: string, userName: string, pdfBuffer: Buffer): Promise<boolean> {
    const html = `
      <h3>Invoice Ready</h3>
      <p>Hello \${userName},</p>
      <p>Please find your recent invoice attached to this email.</p>
      <p>Thank you for your business!</p>
    `;

    return this.sendEmail({
      to,
      subject: 'Your Invoice',
      html,
      attachments: [
        {
          filename: 'invoice.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}

// Export as a singleton
export const emailService = new EmailService();
