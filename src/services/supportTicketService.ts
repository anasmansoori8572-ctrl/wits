import fs from 'fs';
import path from 'path';
import { whatsappCloudApiService } from './whatsappCloudApiService';
import { durableStorageService } from './durableStorageService';

export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'waiting_student' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'human_handover' | 'payment_dispute' | 'refund_request' | 'technical_issue' | 'course_inquiry';

export interface TicketReply {
  id: string;
  sender: 'agent' | 'student' | 'system';
  senderName: string;
  messageText: string;
  sentAt: string;
  whatsappMessageId?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface DBSupportTicket {
  id: string; // TKT-XXXX
  studentId?: string;
  studentName: string;
  studentPhone: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  assignedTo?: string;
  notes?: string;
  replyHistory: TicketReply[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  courseName?: string;
  batchName?: string;
}

export class SupportTicketService {
  private static instance: SupportTicketService;
  private tickets: DBSupportTicket[] = [];

  private constructor() {
    this.loadTickets();
  }

  public static getInstance(): SupportTicketService {
    if (!SupportTicketService.instance) {
      SupportTicketService.instance = new SupportTicketService();
    }
    return SupportTicketService.instance;
  }

  private loadTickets(): void {
    // 1. Read from DurableStorage memory cache or seed
    this.tickets = durableStorageService.getCollectionSync<DBSupportTicket>('support-tickets', []);

    // 2. Fallback read from local file if memory cache empty
    if (this.tickets.length === 0) {
      try {
        const filePath = path.join(process.cwd(), 'uploads', 'data', 'support-tickets.json');
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          this.tickets = JSON.parse(raw);
        }
      } catch (e) {
        this.tickets = [];
      }
    }
  }

  /**
   * Save tickets safely using DurableStorageService without local EROFS failures
   */
  private saveTickets(): void {
    durableStorageService.saveCollectionBackground('support-tickets', this.tickets);
  }

  /**
   * Explicit awaitable durable persistence
   */
  public async saveTicketsDurable(): Promise<{ success: boolean; error?: string }> {
    const res = await durableStorageService.saveCollection('support-tickets', this.tickets);
    return {
      success: res.success,
      error: res.error
    };
  }

  public getAllTickets(filter?: { status?: TicketStatus; phone?: string }): DBSupportTicket[] {
    this.loadTickets();
    let result = [...this.tickets];
    if (filter?.status) {
      result = result.filter(t => t.status.toLowerCase() === filter.status?.toLowerCase());
    }
    if (filter?.phone) {
      const cleanPhone = filter.phone.replace(/\D/g, '');
      result = result.filter(t => t.studentPhone.includes(cleanPhone));
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getTicketById(id: string): DBSupportTicket | undefined {
    this.loadTickets();
    return this.tickets.find(t => t.id === id);
  }

  public getActiveTicketForStudent(phone: string): DBSupportTicket | undefined {
    this.loadTickets();
    const cleanPhone = phone.replace(/\D/g, '');
    return this.tickets.find(t => 
      t.studentPhone.includes(cleanPhone) && 
      (t.status === 'open' || t.status === 'assigned' || t.status === 'in_progress' || t.status === 'waiting_student')
    );
  }

  public createTicket(data: {
    studentId?: string;
    studentName: string;
    studentPhone: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    subject?: string;
    description: string;
    courseName?: string;
    batchName?: string;
  }): DBSupportTicket {
    this.loadTickets();

    const cleanPhone = whatsappCloudApiService.normalizePhone(data.studentPhone);
    const id = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const newTicket: DBSupportTicket = {
      id,
      studentId: data.studentId,
      studentName: data.studentName || 'Student',
      studentPhone: cleanPhone,
      category: data.category || 'human_handover',
      priority: data.priority || 'medium',
      subject: data.subject || (data.description.length > 50 ? data.description.substring(0, 50) + '...' : data.description),
      description: data.description,
      status: 'open',
      courseName: data.courseName,
      batchName: data.batchName,
      replyHistory: [
        {
          id: `rep_${Date.now()}`,
          sender: 'student',
          senderName: data.studentName || 'Student',
          messageText: data.description,
          sentAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.tickets.unshift(newTicket);
    this.saveTickets();
    console.log(`[SupportTicketService] Created ticket ${newTicket.id} for ${newTicket.studentPhone} (${newTicket.category})`);
    return newTicket;
  }

  public updateTicketStatus(
    id: string,
    updates: {
      status?: TicketStatus;
      assignedTo?: string;
      notes?: string;
      priority?: TicketPriority;
    }
  ): DBSupportTicket | null {
    this.loadTickets();
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) return null;

    if (updates.status) {
      ticket.status = updates.status;
      if (updates.status === 'resolved' || updates.status === 'closed') {
        ticket.resolvedAt = new Date().toISOString();
      }
    }
    if (updates.assignedTo !== undefined) ticket.assignedTo = updates.assignedTo;
    if (updates.notes !== undefined) ticket.notes = updates.notes;
    if (updates.priority) ticket.priority = updates.priority;

    ticket.updatedAt = new Date().toISOString();
    this.saveTickets();
    return ticket;
  }

  /**
   * Human Agent sends a direct WhatsApp reply to the student via official Meta Cloud API
   */
  public async sendAgentReply(
    ticketId: string,
    agentName: string,
    replyText: string
  ): Promise<{ success: boolean; error?: string; ticket?: DBSupportTicket }> {
    this.loadTickets();
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return { success: false, error: 'Ticket not found' };

    const cleanRecipient = ticket.studentPhone;
    if (!cleanRecipient) return { success: false, error: 'Student phone number missing' };

    // Send via official WhatsApp Cloud API
    const sendRes = await whatsappCloudApiService.sendTextMessage(
      cleanRecipient,
      `[Wits Lingo Support - ${agentName || 'Mentor'}]\n\n${replyText}`
    );

    const now = new Date().toISOString();
    const replyRecord: TicketReply = {
      id: `rep_${Date.now()}`,
      sender: 'agent',
      senderName: agentName || 'Support Agent',
      messageText: replyText,
      sentAt: now,
      whatsappMessageId: sendRes.messageId,
      deliveryStatus: sendRes.success ? 'sent' : 'failed'
    };

    ticket.replyHistory.push(replyRecord);
    ticket.status = 'waiting_student';
    ticket.updatedAt = now;
    this.saveTickets();

    if (!sendRes.success) {
      const errorDetail = sendRes.isCustomerServiceWindowExpired
        ? 'Customer 24h service window expired. Meta requires an approved template message to re-engage.'
        : (sendRes.sanitizedError || sendRes.error || 'Failed to dispatch WhatsApp message via Meta Cloud API');
      return {
        success: false,
        error: errorDetail,
        ticket
      };
    }

    return { success: true, ticket };
  }
}

export const supportTicketService = SupportTicketService.getInstance();
