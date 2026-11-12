import nodemailer from 'nodemailer';
import { durableStorageService } from './durableStorageService';
import fs from 'fs';
import path from 'path';

export interface PurchaseNotificationPayload {
  orderId: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  courseId: string;
  courseName: string;
  amount: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  purchaseDate?: string;
}

export interface AdminNotificationRecord {
  id: string;
  type: 'course_purchase';
  title: string;
  message: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  courseName: string;
  amount: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  timestamp: string;
  emailSent: boolean;
  emailError?: string;
}

class AdminNotificationService {
  private notificationsFile = path.join(process.cwd(), 'uploads', 'data', 'admin-notifications.json');
  private notifications: AdminNotificationRecord[] = [];

  constructor() {
    this.loadNotifications();
  }

  private loadNotifications() {
    try {
      if (fs.existsSync(this.notificationsFile)) {
        const raw = fs.readFileSync(this.notificationsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.notifications = parsed;
        }
      }
    } catch (e) {
      console.warn('[AdminNotificationService] Could not load admin-notifications.json:', e);
    }
  }

  private saveNotifications() {
    try {
      const dir = path.dirname(this.notificationsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.notificationsFile, JSON.stringify(this.notifications, null, 2), 'utf-8');
      durableStorageService.saveCollectionBackground('adminNotifications', this.notifications);
    } catch (e) {
      console.warn('[AdminNotificationService] Could not save notifications:', e);
    }
  }

  public getAllNotifications(): AdminNotificationRecord[] {
    return this.notifications;
  }

  /**
   * Dispatches email to the Admin when a course is purchased
   */
  public async notifyAdminOnPurchase(payload: PurchaseNotificationPayload): Promise<{ success: boolean; emailSent: boolean; error?: string }> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'hello@witslingo.com';
    const amountFormatted = `₹${payload.amount.toLocaleString('en-IN')}`;
    const timestamp = payload.purchaseDate || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`[AdminNotificationService] Processing course purchase notification for: ${payload.studentName} (${payload.courseName})`);

    const notifRecord: AdminNotificationRecord = {
      id: `admin_notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'course_purchase',
      title: `New Course Purchase: ${payload.courseName}`,
      message: `${payload.studentName} purchased ${payload.courseName} for ${amountFormatted}`,
      studentName: payload.studentName,
      studentPhone: payload.studentPhone,
      studentEmail: payload.studentEmail,
      courseName: payload.courseName,
      amount: payload.amount,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpayOrderId: payload.razorpayOrderId,
      timestamp: new Date().toISOString(),
      emailSent: false
    };

    // 1. Prepare HTML Email Body
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { background-color: #ffffff; border-radius: 16px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #3B0764 0%, #4A1D96 50%, #6B21A8 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
        .header p { margin: 6px 0 0 0; font-size: 14px; color: #e9d5ff; }
        .content { padding: 24px; }
        .badge { display: inline-block; background-color: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-bottom: 16px; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .details-table tr { border-bottom: 1px solid #f1f5f9; }
        .details-table td { padding: 12px 6px; font-size: 14px; }
        .details-table td.label { color: #64748b; font-weight: 600; width: 38%; }
        .details-table td.value { color: #0f172a; font-weight: 700; }
        .footer { background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        .btn { display: inline-block; background-color: #4A1D96; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🎓 New Course Purchase Received!</h1>
          <p>Wits Lingo Academy Automated Admission Notification</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <span class="badge">Payment Confirmed & Verified</span>
          </div>
          <p style="font-size: 15px; line-height: 1.5;">Hello Admin,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">A student has successfully enrolled and paid for a course on <a href="https://witslingo.com" style="color: #4A1D96; font-weight: bold;">witslingo.com</a>. Here are the full enrolment details:</p>
          
          <table class="details-table">
            <tr>
              <td class="label">Course Enrolled:</td>
              <td class="value" style="color: #4A1D96;">${payload.courseName}</td>
            </tr>
            <tr>
              <td class="label">Amount Paid:</td>
              <td class="value" style="color: #059669; font-size: 16px;">${amountFormatted}</td>
            </tr>
            <tr>
              <td class="label">Student Name:</td>
              <td class="value">${payload.studentName}</td>
            </tr>
            <tr>
              <td class="label">WhatsApp Number:</td>
              <td class="value"><a href="https://wa.me/${payload.studentPhone.replace(/\D/g, '')}" style="color: #0284c7;">+${payload.studentPhone}</a></td>
            </tr>
            <tr>
              <td class="label">Student Email:</td>
              <td class="value"><a href="mailto:${payload.studentEmail}" style="color: #0284c7;">${payload.studentEmail}</a></td>
            </tr>
            <tr>
              <td class="label">Payment ID:</td>
              <td class="value" style="font-family: monospace; font-size: 13px;">${payload.razorpayPaymentId || 'Verified via Razorpay'}</td>
            </tr>
            <tr>
              <td class="label">Order ID:</td>
              <td class="value" style="font-family: monospace; font-size: 13px;">${payload.orderId}</td>
            </tr>
            <tr>
              <td class="label">Date & Time:</td>
              <td class="value">${timestamp}</td>
            </tr>
          </table>

          <div style="text-align: center;">
            <a href="https://witslingo.com/admin" class="btn" style="color: #ffffff;">Open Admin Dashboard</a>
          </div>
        </div>
        <div class="footer">
          This is an automated notification from Wits Lingo Academy Payment Gateway System.
        </div>
      </div>
    </body>
    </html>
    `;

    // 2. Outbound SMTP Send Attempt if credentials configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        await transporter.sendMail({
          from: `"Wits Lingo Academy" <${smtpUser}>`,
          to: adminEmail,
          cc: 'anasmansoori8572@gmail.com',
          subject: `🎓 New Course Enrolment: ${payload.courseName} by ${payload.studentName} (${amountFormatted})`,
          html: htmlContent
        });

        notifRecord.emailSent = true;
        console.log(`[AdminNotificationService] Live email successfully dispatched to ${adminEmail}`);
      } catch (mailErr: any) {
        notifRecord.emailError = mailErr?.message || 'SMTP send failure';
        console.warn(`[AdminNotificationService] SMTP email dispatch error:`, mailErr?.message || mailErr);
      }
    } else {
      console.log(`[AdminNotificationService] SMTP credentials not set in .env. Notification logged locally and stored for Admin dashboard.`);
    }

    // 3. Save notification record
    this.notifications.unshift(notifRecord);
    this.saveNotifications();

    return {
      success: true,
      emailSent: notifRecord.emailSent,
      error: notifRecord.emailError
    };
  }
}

export const adminNotificationService = new AdminNotificationService();
