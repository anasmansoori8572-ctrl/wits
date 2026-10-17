import fs from 'fs';
import path from 'path';
import { whatsappCloudApiService, InboundMessageEvent } from './whatsappCloudApiService';
import { aiSupportService, StudentContext } from './aiSupportService';
import { supportTicketService } from './supportTicketService';
import { durableStorageService } from './durableStorageService';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface DBConversation {
  id: string; // conv_phone
  studentPhone: string;
  studentName?: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedAgent?: string;
  isEscalated: boolean;
  status: 'active' | 'escalated' | 'resolved';
}

export interface DBMessageItem {
  id: string; // msgId
  conversationId: string;
  senderPhone: string;
  senderName: string;
  senderType: 'student' | 'ai' | 'admin';
  text: string;
  timestamp: string;
  provider: 'meta_cloud_api';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorDetails?: string;
}

export class StudentSupportService {
  private static instance: StudentSupportService;
  private conversations: DBConversation[] = [];
  private messages: DBMessageItem[] = [];

  private constructor() {
    this.loadData();
  }

  public static getInstance(): StudentSupportService {
    if (!StudentSupportService.instance) {
      StudentSupportService.instance = new StudentSupportService();
    }
    return StudentSupportService.instance;
  }

  private loadData(): void {
    // 1. Load from DurableStorage memory cache or seed files
    this.conversations = durableStorageService.getCollectionSync<DBConversation>('conversations', []);
    this.messages = durableStorageService.getCollectionSync<DBMessageItem>('messages', []);

    // 2. If memory cache was empty, attempt safe read from local file without throwing on Vercel
    if (this.conversations.length === 0) {
      try {
        const convPath = path.join(process.cwd(), 'uploads', 'data', 'conversations.json');
        if (fs.existsSync(convPath)) {
          this.conversations = JSON.parse(fs.readFileSync(convPath, 'utf-8'));
        }
      } catch {
        this.conversations = [];
      }
    }

    if (this.messages.length === 0) {
      try {
        const msgPath = path.join(process.cwd(), 'uploads', 'data', 'messages.json');
        if (fs.existsSync(msgPath)) {
          this.messages = JSON.parse(fs.readFileSync(msgPath, 'utf-8'));
        }
      } catch {
        this.messages = [];
      }
    }
  }

  /**
   * Save conversations and messages using Durable Storage (B2 / Firestore / Local FS when writable).
   * NEVER throws EROFS on Vercel.
   */
  private async saveData(): Promise<void> {
    await this.saveDataDurable();
  }

  /**
   * Explicit awaitable save that reports true persistence status
   */
  public async saveDataDurable(): Promise<{ success: boolean; error?: string }> {
    const res1 = await durableStorageService.saveCollection('conversations', this.conversations);
    const res2 = await durableStorageService.saveCollection('messages', this.messages);
    if (!res1.success || !res2.success) {
      return {
        success: false,
        error: res1.error || res2.error || 'Durable persistence write failed'
      };
    }
    return { success: true };
  }

  public getConversations(): DBConversation[] {
    this.loadData();
    return [...this.conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  public getMessagesForConversation(convId: string): DBMessageItem[] {
    this.loadData();
    return this.messages.filter(m => m.conversationId === convId);
  }

  /**
   * Look up student enrollment context strictly by verified phone number from server records
   */
  public findStudentContext(phone: string): { studentName?: string; studentContext?: StudentContext } {
    const cleanPhone = whatsappCloudApiService.normalizePhone(phone);
    let matchedName: string | undefined;
    let enrolledCourses: any[] = [];

    // 1. Search in orders (from durable storage or local file fallback)
    try {
      let orders = durableStorageService.getCollectionSync<any>('orders', []);
      if (orders.length === 0) {
        const ordersPath = path.join(process.cwd(), 'uploads', 'data', 'orders.json');
        if (fs.existsSync(ordersPath)) {
          orders = JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
        }
      }

      const studentOrders = orders.filter((o: any) => {
        const oPhone = whatsappCloudApiService.normalizePhone(o.studentPhone || '');
        return oPhone && (oPhone === cleanPhone || oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone));
      });

      if (studentOrders.length > 0) {
        const latest = studentOrders[0];
        matchedName = latest.studentName;
        enrolledCourses = studentOrders
          .filter((o: any) => o.orderStatus === 'paid')
          .map((o: any) => ({
            courseName: o.courseName,
            courseId: o.courseId,
            paymentStatus: o.orderStatus,
            amountPaid: o.expectedAmount,
            transactionId: o.razorpayPaymentId || o.id,
            startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE
          }));
      }
    } catch (e) {
      // Ignore lookup error
    }

    // 2. Search in registrations / users if name not found yet
    if (!matchedName) {
      try {
        let registrations = durableStorageService.getCollectionSync<any>('registrations', []);
        if (registrations.length === 0) {
          const regPath = path.join(process.cwd(), 'uploads', 'data', 'registrations.json');
          if (fs.existsSync(regPath)) {
            registrations = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
          }
        }

        const match = registrations.find((r: any) => {
          const rPhone = whatsappCloudApiService.normalizePhone(r.phone || r.whatsappPhone || '');
          return rPhone && (rPhone === cleanPhone || rPhone.endsWith(cleanPhone) || cleanPhone.endsWith(rPhone));
        });
        if (match) {
          matchedName = match.name || match.fullName;
        }
      } catch (e) {
        // Ignore lookup error
      }
    }

    const studentCtx: StudentContext | undefined = matchedName ? {
      name: matchedName,
      phone: cleanPhone,
      enrolledCourses
    } : undefined;

    return { studentName: matchedName, studentContext: studentCtx };
  }

  /**
   * Main inbound student message handler from Meta WhatsApp Cloud API Webhook
   */
  public async handleInboundMessage(event: InboundMessageEvent): Promise<{
    handled: boolean;
    replySent?: boolean;
    ticketCreated?: boolean;
    reason?: string;
  }> {
    const { messageId, senderPhone, timestamp, textBody } = event;

    // 1. Durable Webhook Deduplication across serverless invocations
    const isDup = await durableStorageService.isDeduplicated('whatsapp_inbound', messageId);
    if (isDup) {
      console.log(`[StudentSupportService] Duplicate message ID ${messageId} ignored across invocations.`);
      return { handled: true, reason: 'duplicate_message_id' };
    }
    // Record into durable dedup store
    durableStorageService.recordDedupBackground('whatsapp_inbound', messageId);

    const text = (textBody || '').trim();
    if (!text) {
      return { handled: true, reason: 'empty_body' };
    }

    const cleanSender = whatsappCloudApiService.normalizePhone(senderPhone);
    const convId = `conv_${cleanSender}`;
    const now = timestamp || new Date().toISOString();

    // 2. Open / extend the 24-hour Customer Service Window
    whatsappCloudApiService.recordCustomerInbound(cleanSender, now);

    // 3. Identify Student & Authorized Context
    const { studentName, studentContext } = this.findStudentContext(cleanSender);
    const finalStudentName = studentName || 'Student';

    // 4. Update Conversation & Record Incoming Message
    let conv = this.conversations.find(c => c.id === convId);
    if (!conv) {
      conv = {
        id: convId,
        studentPhone: cleanSender,
        studentName: finalStudentName,
        lastMessageAt: now,
        unreadCount: 1,
        isEscalated: false,
        status: 'active'
      };
      this.conversations.unshift(conv);
    } else {
      conv.lastMessageAt = now;
      conv.unreadCount += 1;
      if (studentName) conv.studentName = studentName;
    }

    const incomingMsgRecord: DBMessageItem = {
      id: messageId,
      conversationId: convId,
      senderPhone: cleanSender,
      senderName: finalStudentName,
      senderType: 'student',
      text,
      timestamp: now,
      provider: 'meta_cloud_api',
      status: 'delivered'
    };
    this.messages.unshift(incomingMsgRecord);
    await this.saveData();

    // 5. Check if Human Agent has active ownership of this ticket / conversation
    const activeTicket = supportTicketService.getActiveTicketForStudent(cleanSender);
    if (activeTicket && activeTicket.status === 'in_progress' && activeTicket.assignedTo) {
      console.log(`[StudentSupportService] Student ${cleanSender} has active assigned ticket (${activeTicket.id}). Silencing AI auto-reply to prevent agent conflict.`);
      activeTicket.replyHistory.push({
        id: `rep_${Date.now()}`,
        sender: 'student',
        senderName: finalStudentName,
        messageText: text,
        sentAt: now
      });
      activeTicket.status = 'open'; // Re-open or alert agent
      activeTicket.updatedAt = now;
      supportTicketService.updateTicketStatus(activeTicket.id, { status: 'open' });
      return { handled: true, replySent: false, reason: 'human_agent_active' };
    }

    // 6. Query AI Support Engine
    const aiResult = await aiSupportService.answerInquiry(text, studentContext);

    // 7. Handle Escalation to Human Support
    let ticketCreated = false;
    if (aiResult.shouldEscalate) {
      conv.isEscalated = true;
      conv.status = 'escalated';

      const ticket = supportTicketService.createTicket({
        studentName: finalStudentName,
        studentPhone: cleanSender,
        category: (aiResult.escalationCategory as any) || 'human_handover',
        priority: (aiResult.escalationPriority as any) || 'medium',
        description: text,
        courseName: studentContext?.enrolledCourses?.[0]?.courseName
      });
      ticketCreated = true;
    }

    // 8. Dispatch Response Back to Student via Official Meta Cloud API
    const replyText = aiResult.replyText;
    const sendRes = await whatsappCloudApiService.sendTextMessage(cleanSender, replyText);

    // If Meta rejected reply because 24h Customer Service Window expired (#131047), escalate to ticket
    if (sendRes.isCustomerServiceWindowExpired && !ticketCreated) {
      console.warn(`[StudentSupportService] Outbound reply to ${cleanSender} failed due to expired 24h customer window. Escalating to support ticket.`);
      conv.isEscalated = true;
      conv.status = 'escalated';
      supportTicketService.createTicket({
        studentName: finalStudentName,
        studentPhone: cleanSender,
        category: 'human_handover',
        priority: 'high',
        description: `Customer service window (24h) expired. Direct message failed (#131047). Student inquired: "${text.substring(0, 100)}..."`,
        courseName: studentContext?.enrolledCourses?.[0]?.courseName
      });
      ticketCreated = true;
    }

    // 9. Record Outbound AI Message
    const outboundMsgRecord: DBMessageItem = {
      id: sendRes.messageId || `msg_ai_${Date.now()}`,
      conversationId: convId,
      senderPhone: 'system',
      senderName: 'Wits Lingo AI Assistant',
      senderType: 'ai',
      text: replyText,
      timestamp: new Date().toISOString(),
      provider: 'meta_cloud_api',
      status: sendRes.success ? 'sent' : 'failed',
      errorDetails: sendRes.sanitizedError || sendRes.error
    };
    this.messages.unshift(outboundMsgRecord);
    await this.saveData();

    console.log(
      `[StudentSupportService] Outbound dispatch to ${cleanSender}: ${sendRes.success ? 'Accepted by Meta' : 'Failed: ' + (sendRes.sanitizedError || sendRes.error)}`
    );

    return {
      handled: true,
      replySent: sendRes.success,
      ticketCreated,
      reason: sendRes.success ? undefined : sendRes.sanitizedError
    };
  }
}

export const studentSupportService = StudentSupportService.getInstance();
