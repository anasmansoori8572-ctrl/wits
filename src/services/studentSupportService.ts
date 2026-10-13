import fs from 'fs';
import path from 'path';
import { whatsappCloudApiService, InboundMessageEvent } from './whatsappCloudApiService';
import { aiSupportService, StudentContext } from './aiSupportService';
import { supportTicketService } from './supportTicketService';
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
}

export class StudentSupportService {
  private static instance: StudentSupportService;
  private conversationsPath: string;
  private messagesPath: string;
  private conversations: DBConversation[] = [];
  private messages: DBMessageItem[] = [];
  private processedMessageIds: Set<string> = new Set();

  private constructor() {
    this.conversationsPath = path.join(process.cwd(), 'uploads', 'data', 'conversations.json');
    this.messagesPath = path.join(process.cwd(), 'uploads', 'data', 'messages.json');
    this.loadData();
  }

  public static getInstance(): StudentSupportService {
    if (!StudentSupportService.instance) {
      StudentSupportService.instance = new StudentSupportService();
    }
    return StudentSupportService.instance;
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.conversationsPath)) {
        this.conversations = JSON.parse(fs.readFileSync(this.conversationsPath, 'utf-8'));
      }
    } catch (e) {
      this.conversations = [];
    }

    try {
      if (fs.existsSync(this.messagesPath)) {
        this.messages = JSON.parse(fs.readFileSync(this.messagesPath, 'utf-8'));
        // Populate deduplication set with recent message IDs
        for (const m of this.messages.slice(0, 1000)) {
          this.processedMessageIds.add(m.id);
        }
      }
    } catch (e) {
      this.messages = [];
    }
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.conversationsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.conversationsPath, JSON.stringify(this.conversations, null, 2), 'utf-8');
      fs.writeFileSync(this.messagesPath, JSON.stringify(this.messages, null, 2), 'utf-8');
    } catch (e) {
      console.error('[StudentSupportService] Error saving conversations/messages:', e);
    }
  }

  public getConversations(): DBConversation[] {
    this.loadData();
    return [...this.conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
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

    // 1. Search in orders.json
    try {
      const ordersPath = path.join(process.cwd(), 'uploads', 'data', 'orders.json');
      if (fs.existsSync(ordersPath)) {
        const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
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
      }
    } catch (e) {}

    // 2. Search in registrations.json / users.json if name not found yet
    if (!matchedName) {
      try {
        const regPath = path.join(process.cwd(), 'uploads', 'data', 'registrations.json');
        if (fs.existsSync(regPath)) {
          const registrations = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
          const match = registrations.find((r: any) => {
            const rPhone = whatsappCloudApiService.normalizePhone(r.phone || r.whatsappPhone || '');
            return rPhone && (rPhone === cleanPhone || rPhone.endsWith(cleanPhone) || cleanPhone.endsWith(rPhone));
          });
          if (match) {
            matchedName = match.name || match.fullName;
          }
        }
      } catch (e) {}
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

    // 1. Webhook Deduplication
    if (this.processedMessageIds.has(messageId)) {
      console.log(`[StudentSupportService] Duplicate message ID ${messageId} ignored.`);
      return { handled: true, reason: 'duplicate_message_id' };
    }
    this.processedMessageIds.add(messageId);

    const text = (textBody || '').trim();
    if (!text) {
      return { handled: true, reason: 'empty_body' };
    }

    const cleanSender = whatsappCloudApiService.normalizePhone(senderPhone);
    const convId = `conv_${cleanSender}`;
    const now = timestamp || new Date().toISOString();

    // 2. Identify Student & Authorized Context
    const { studentName, studentContext } = this.findStudentContext(cleanSender);
    const finalStudentName = studentName || 'Student';

    // 3. Update Conversation & Record Incoming Message
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
    this.saveData();

    // 4. Check if Human Agent has active ownership of this ticket / conversation
    const activeTicket = supportTicketService.getActiveTicketForStudent(cleanSender);
    if (activeTicket && activeTicket.status === 'in_progress' && activeTicket.assignedTo) {
      console.log(`[StudentSupportService] Student ${cleanSender} has active assigned ticket (${activeTicket.id}). Silencing AI auto-reply to prevent agent conflict.`);
      // Append message to ticket reply history
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

    // 5. Query AI Support Engine
    const aiResult = await aiSupportService.answerInquiry(text, studentContext);

    // 6. Handle Escalation to Human Support
    let ticketCreated = false;
    if (aiResult.shouldEscalate) {
      conv.isEscalated = true;
      conv.status = 'escalated';

      const ticket = supportTicketService.createTicket({
        studentName: finalStudentName,
        studentPhone: cleanSender,
        category: aiResult.escalationCategory as any || 'human_handover',
        priority: (aiResult.escalationPriority as any) || 'medium',
        description: text,
        courseName: studentContext?.enrolledCourses?.[0]?.courseName
      });
      ticketCreated = true;
    }

    // 7. Dispatch Response Back to Student via Official Meta Cloud API
    const replyText = aiResult.replyText;
    const sendRes = await whatsappCloudApiService.sendTextMessage(cleanSender, replyText);

    // 8. Record Outbound AI Message
    const outboundMsgRecord: DBMessageItem = {
      id: sendRes.messageId || `msg_ai_${Date.now()}`,
      conversationId: convId,
      senderPhone: 'system',
      senderName: 'Wits Lingo AI Assistant',
      senderType: 'ai',
      text: replyText,
      timestamp: new Date().toISOString(),
      provider: 'meta_cloud_api',
      status: sendRes.success ? 'sent' : 'failed'
    };
    this.messages.unshift(outboundMsgRecord);
    this.saveData();

    console.log(`[StudentSupportService] Replied to ${cleanSender} via Meta Cloud API (${sendRes.success ? 'Success' : 'Failed: ' + sendRes.error})`);

    return {
      handled: true,
      replySent: sendRes.success,
      ticketCreated
    };
  }
}

export const studentSupportService = StudentSupportService.getInstance();
