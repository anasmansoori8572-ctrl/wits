import fs from 'fs';
import path from 'path';
import { whatsappCloudApiService, MetaSendResult } from './whatsappCloudApiService';
import { durableStorageService } from './durableStorageService';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface DBNotification {
  id: string;
  orderId?: string;
  studentId?: string;
  recipientPhone: string;
  channel: 'whatsapp';
  templateName: string;
  messageStatus: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
  provider: 'meta_cloud_api';
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  lastAttemptAt: string;
  retryCount: number;
  errorDetails?: string;
  messageBody?: string;
}

export interface PaymentConfirmationPayload {
  orderId: string;
  studentId?: string;
  studentName: string;
  studentPhone: string;
  courseName: string;
  batchName?: string;
  amount: number;
  razorpayPaymentId: string;
  startDate?: string;
  scheduleTime?: string;
  meetLink?: string;
}

export class WhatsAppNotificationService {
  private static instance: WhatsAppNotificationService;
  private notifications: DBNotification[] = [];

  private constructor() {
    this.loadNotifications();
  }

  public static getInstance(): WhatsAppNotificationService {
    if (!WhatsAppNotificationService.instance) {
      WhatsAppNotificationService.instance = new WhatsAppNotificationService();
    }
    return WhatsAppNotificationService.instance;
  }

  private loadNotifications(): void {
    // 1. Read from DurableStorage memory cache or seed
    this.notifications = durableStorageService.getCollectionSync<DBNotification>('notifications', []);

    // 2. Fallback read from local file if memory cache empty
    if (this.notifications.length === 0) {
      try {
        const filePath = path.join(process.cwd(), 'uploads', 'data', 'notifications.json');
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          this.notifications = JSON.parse(raw);
        }
      } catch (e) {
        this.notifications = [];
      }
    }
  }

  /**
   * Save notifications safely using DurableStorageService without local disk writes
   */
  private saveNotifications(): void {
    durableStorageService.saveCollectionBackground('notifications', this.notifications);
  }

  /**
   * Explicit awaitable durable persistence
   */
  public async saveNotificationsDurable(): Promise<{ success: boolean; error?: string }> {
    const res = await durableStorageService.saveCollection('notifications', this.notifications);
    return {
      success: res.success,
      error: res.error
    };
  }

  public getAllNotifications(): DBNotification[] {
    this.loadNotifications();
    return [...this.notifications].sort(
      (a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime()
    );
  }

  public getNotificationByMessageId(messageId: string): DBNotification | undefined {
    this.loadNotifications();
    return this.notifications.find(n => n.providerMessageId === messageId);
  }

  /**
   * Handle Webhook Delivery Status updates from Meta (sent, delivered, read, failed)
   */
  public updateDeliveryStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    timestamp?: string,
    errorDetails?: string
  ): boolean {
    this.loadNotifications();
    const notif = this.notifications.find(n => n.providerMessageId === messageId);
    if (!notif) return false;

    notif.messageStatus = status;
    const timeIso = timestamp || new Date().toISOString();
    if (status === 'delivered') notif.deliveredAt = timeIso;
    if (status === 'read') notif.readAt = timeIso;
    if (status === 'failed' && errorDetails) {
      notif.errorDetails = errorDetails;
    }
    this.saveNotifications();
    console.log(`[WhatsAppNotificationService] Updated message ${messageId} status to '${status}'`);
    return true;
  }

  /**
   * Send the official Payment & Enrollment Confirmation WhatsApp message
   */
  public async sendPaymentConfirmation(
    payload: PaymentConfirmationPayload,
    forceResend: boolean = false
  ): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
    this.loadNotifications();

    // 1. Strict Idempotency Check
    const existing = this.notifications.find(
      n => n.orderId === payload.orderId && 
      (n.messageStatus === 'accepted' || n.messageStatus === 'sent' || n.messageStatus === 'delivered' || n.messageStatus === 'read') &&
      n.templateName === 'payment_confirmation'
    );

    if (existing && !forceResend) {
      console.log(`[WhatsAppNotificationService] Idempotency: Order ${payload.orderId} confirmation already sent (${existing.providerMessageId}). Skipping.`);
      return { success: true, skipped: true, messageId: existing.providerMessageId };
    }

    const cleanRecipient = whatsappCloudApiService.normalizePhone(payload.studentPhone);
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const studentName = payload.studentName || 'Student';
    const courseName = payload.courseName || 'Wits Lingo Course';
    const amountStr = `₹${payload.amount.toLocaleString('en-IN')}`;
    const txnId = payload.razorpayPaymentId || 'Verified';
    const startDate = payload.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE;
    const scheduleTime = payload.scheduleTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME;
    const meetLink = payload.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
    const supportPhone = WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN || '919027729917';

    // Comprehensive receipt text
    const fullMessageText = 
`Hi ${studentName},

Congratulations! Your payment for Wits Lingo has been confirmed successfully.

Here are your verified enrollment details:
• Course: ${courseName}
• Amount Paid: ${amountStr}
• Transaction ID: ${txnId}
• Batch Starts: ${startDate}
• Schedule: ${scheduleTime}

Live Classroom Joining Details:
• Platform: Google Meet
• Link: ${meetLink}

Student Portal & Study Materials:
• Dashboard: https://witslingo.com/login
(Sign in with your email or phone to view live schedule & recordings)

Need any help or batch change? Reply directly to this WhatsApp message or call our support desk at +${supportPhone}.

Welcome aboard!
Team Wits Lingo`;

    let sendResult: MetaSendResult;
    const templateName = whatsappCloudApiService.confirmationTemplateName;

    // 2. Meta Cloud API Send Attempt
    if (whatsappCloudApiService.phoneNumberId && whatsappCloudApiService.accessToken) {
      // Outbound business messages MUST use an approved Meta template unless customer messaged within 24h
      try {
        console.log(`[WhatsAppNotificationService] Attempting official template '${templateName}' to ${cleanRecipient}...`);
        sendResult = await whatsappCloudApiService.sendTemplateMessage(
          cleanRecipient,
          templateName,
          whatsappCloudApiService.templateLanguage,
          [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: studentName },
                { type: 'text', text: courseName },
                { type: 'text', text: amountStr },
                { type: 'text', text: txnId },
                { type: 'text', text: startDate },
                { type: 'text', text: meetLink }
              ]
            }
          ]
        );

        // If template doesn't exist on Meta yet (132001) or is pending approval, attempt text message fallback
        if (!sendResult.success && (sendResult.errorCode === 132001 || sendResult.errorCode === 100 || sendResult.error?.includes('template'))) {
          console.warn(`[WhatsAppNotificationService] Meta template '${templateName}' not found or unapproved (Code ${sendResult.errorCode}). Attempting transactional text fallback.`);
          const textResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
          if (textResult.success) {
            sendResult = textResult;
          } else {
            // Free-form text was rejected (e.g. #131047: customer window not open)
            const combinedError = textResult.isCustomerServiceWindowExpired
              ? `Template '${templateName}' unapproved (#${sendResult.errorCode || 'N/A'}). Direct text fallback failed: 24h customer window is closed (#131047). An approved Meta template is required.`
              : (textResult.sanitizedError || sendResult.sanitizedError || 'WhatsApp dispatch rejected by Meta');
            sendResult.error = combinedError;
            sendResult.sanitizedError = combinedError;
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppNotificationService] Template attempt failed, falling back to text:', err);
        sendResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
      }
    } else {
      sendResult = {
        success: false,
        status: 'failed',
        error: 'WhatsApp Cloud API credentials not configured in environment variables (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).'
      };
    }

    // 3. Record notification record
    const notifRecord: DBNotification = {
      id: notifId,
      orderId: payload.orderId,
      studentId: payload.studentId,
      recipientPhone: cleanRecipient,
      channel: 'whatsapp',
      templateName: 'payment_confirmation',
      messageStatus: sendResult.success ? 'accepted' : 'failed',
      provider: 'meta_cloud_api',
      providerMessageId: sendResult.messageId,
      sentAt: sendResult.success ? now : undefined,
      lastAttemptAt: now,
      retryCount: 1,
      errorDetails: sendResult.sanitizedError || sendResult.error,
      messageBody: fullMessageText
    };

    this.notifications.unshift(notifRecord);
    this.saveNotifications();

    return {
      success: sendResult.success,
      messageId: sendResult.messageId,
      error: sendResult.sanitizedError || sendResult.error
    };
  }

  /**
   * Safe Admin retry for a failed notification
   */
  public async retryNotification(id: string): Promise<{ success: boolean; error?: string }> {
    this.loadNotifications();
    const notif = this.notifications.find(n => n.id === id);
    if (!notif) return { success: false, error: 'Notification record not found' };

    const cleanRecipient = notif.recipientPhone;
    const body = notif.messageBody || 'Hello from Wits Lingo! Your admission is confirmed.';

    const sendRes = await whatsappCloudApiService.sendTextMessage(cleanRecipient, body);
    notif.lastAttemptAt = new Date().toISOString();
    notif.retryCount = (notif.retryCount || 1) + 1;

    if (sendRes.success) {
      notif.messageStatus = 'accepted';
      notif.providerMessageId = sendRes.messageId;
      notif.sentAt = new Date().toISOString();
      notif.errorDetails = undefined;
    } else {
      notif.errorDetails = sendRes.sanitizedError || sendRes.error || 'Retry failed via Meta Cloud API';
    }

    this.saveNotifications();
    return { success: sendRes.success, error: notif.errorDetails };
  }
}

export const whatsappNotificationService = WhatsAppNotificationService.getInstance();
