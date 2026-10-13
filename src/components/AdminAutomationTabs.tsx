import React, { useState, useEffect } from 'react';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';
import {
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  Edit3,
  Bot,
  UserCheck,
  ShieldAlert,
  ExternalLink,
  BookOpen,
  Tag,
  Save,
  X,
  Phone,
  Check,
  Sparkles,
  HelpCircle,
  Copy
} from 'lucide-react';

interface AdminAutomationTabsProps {
  activeTab: 'orders-payments' | 'whatsapp-notifications' | 'support-tickets' | 'knowledge-base';
  token?: string | null;
}

export const AdminAutomationTabs: React.FC<AdminAutomationTabsProps> = ({ activeTab, token }) => {
  // Common states
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Orders & Payments State
  const [orders, setOrders] = useState<any[]>([]);
  const [orderStats, setOrderStats] = useState({ total: 0, paid: 0, pending: 0, failed: 0 });
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | 'paid' | 'pending' | 'failed'>('All');

  // 2. WhatsApp Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifStats, setNotifStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [notifFilter, setNotifFilter] = useState<'All' | 'sent' | 'failed' | 'pending'>('All');
  const [retryingNotifId, setRetryingNotifId] = useState<string | null>(null);

  // 3. Support Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, assigned: 0, inProgress: 0, waitingForStudent: 0, resolved: 0 });
  const [ticketFilter, setTicketFilter] = useState<'All' | 'Open' | 'Assigned' | 'In Progress' | 'Waiting for Student' | 'Resolved' | 'Closed'>('All');
  const [ticketSearch, setTicketSearch] = useState('');
  const [replyTicket, setReplyTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // 4. Knowledge Base State
  const [kbItems, setKbItems] = useState<any[]>([]);
  const [kbSearch, setKbSearch] = useState('');
  const [editingKbItem, setEditingKbItem] = useState<any | null>(null);
  const [isCreatingKb, setIsCreatingKb] = useState(false);

  // 5. Live AI Assistant Tester
  const [testQuestion, setTestQuestion] = useState('How much is the Spoken English course fee?');
  const [testPhone, setTestPhone] = useState('918791287575');
  const [testAiResponse, setTestAiResponse] = useState<any | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  // Fetch data on tab change
  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'orders-payments') {
        const res = await fetch('/api/admin/orders', { headers: getHeaders() });
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders || []);
          if (data.stats) setOrderStats(data.stats);
        }
      } else if (activeTab === 'whatsapp-notifications') {
        const res = await fetch('/api/admin/notifications', { headers: getHeaders() });
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          if (data.stats) setNotifStats(data.stats);
        }
      } else if (activeTab === 'support-tickets') {
        const res = await fetch('/api/admin/tickets', { headers: getHeaders() });
        const data = await res.json();
        if (data.success) {
          setTickets(data.tickets || []);
          if (data.stats) setTicketStats(data.stats);
        }
      } else if (activeTab === 'knowledge-base') {
        const res = await fetch('/api/admin/knowledge-base', { headers: getHeaders() });
        const data = await res.json();
        if (data.success) {
          setKbItems(data.items || []);
        }
      }
    } catch (err: any) {
      console.warn('[AdminAutomationTabs] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // -------------------------------------------------------------
  // TAB 1: ORDERS & PAYMENTS ACTIONS
  // -------------------------------------------------------------
  const filteredOrders = orders.filter(o => {
    const matchesFilter = orderFilter === 'All' || o.orderStatus === orderFilter;
    const q = orderSearch.toLowerCase();
    const matchesSearch = !q ||
      o.id?.toLowerCase().includes(q) ||
      o.studentName?.toLowerCase().includes(q) ||
      o.studentPhone?.includes(q) ||
      o.courseName?.toLowerCase().includes(q) ||
      o.razorpayOrderId?.toLowerCase().includes(q) ||
      o.razorpayPaymentId?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // -------------------------------------------------------------
  // TAB 2: WHATSAPP NOTIFICATIONS ACTIONS
  // -------------------------------------------------------------
  const filteredNotifications = notifications.filter(n => {
    const matchesFilter = notifFilter === 'All' || n.messageStatus === notifFilter;
    return matchesFilter;
  });

  const handleRetryNotification = async (notifId: string) => {
    setRetryingNotifId(notifId);
    try {
      const res = await fetch(`/api/admin/notifications/${notifId}/retry`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('WhatsApp confirmation resent successfully!');
      } else {
        showFeedback(data.sendRes?.error || 'Dispatch error occurred. Check credentials.', 'error');
      }
      fetchData();
    } catch (err: any) {
      showFeedback(err.message || 'Network error retrying notification', 'error');
    } finally {
      setRetryingNotifId(null);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: SUPPORT TICKETS ACTIONS
  // -------------------------------------------------------------
  const filteredTickets = tickets.filter(t => {
    const matchesFilter = ticketFilter === 'All' || t.status === ticketFilter;
    const q = ticketSearch.toLowerCase();
    const matchesSearch = !q ||
      t.ticketNumber?.toLowerCase().includes(q) ||
      t.studentName?.toLowerCase().includes(q) ||
      t.studentPhone?.includes(q) ||
      t.originalQuestion?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Ticket updated to ${newStatus}`);
        setTickets(prev => prev.map(t => (t.id === ticketId || t.ticketNumber === ticketId) ? data.ticket : t));
      }
    } catch (err: any) {
      showFeedback('Could not update ticket', 'error');
    }
  };

  const handleSaveTicketNotes = async (ticketId: string, notes: string, assignedAgent: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ resolutionNotes: notes, assignedAgentName: assignedAgent })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Resolution notes saved successfully!');
        setTickets(prev => prev.map(t => (t.id === ticketId || t.ticketNumber === ticketId) ? data.ticket : t));
      }
    } catch (err) {
      showFeedback('Could not save notes', 'error');
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTicket || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const convId = replyTicket.conversationId || `conv_${replyTicket.studentPhone}`;
      const res = await fetch(`/api/admin/conversations/${convId}/reply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ messageText: replyText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Reply dispatched to +${replyTicket.studentPhone}!`);
        // If ticket was Open or Waiting, update status to Waiting for Student
        if (replyTicket.status === 'Open' || replyTicket.status === 'In Progress') {
          handleUpdateTicketStatus(replyTicket.id, 'Waiting for Student');
        }
        setReplyTicket(null);
        setReplyText('');
      } else {
        showFeedback(data.error || 'Failed to dispatch WhatsApp reply', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error sending reply', 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 4: KNOWLEDGE BASE ACTIONS
  // -------------------------------------------------------------
  const filteredKb = kbItems.filter(item => {
    const q = kbSearch.toLowerCase();
    return !q ||
      item.title?.toLowerCase().includes(q) ||
      item.content?.toLowerCase().includes(q) ||
      (Array.isArray(item.keywords) && item.keywords.some((k: string) => k.toLowerCase().includes(q)));
  });

  const handleSaveKbItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKbItem?.title || !editingKbItem?.content) return;

    try {
      const res = await fetch('/api/admin/knowledge-base', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingKbItem)
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Knowledge base updated!');
        setKbItems(data.items);
        setEditingKbItem(null);
        setIsCreatingKb(false);
      }
    } catch (err) {
      showFeedback('Failed to save knowledge item', 'error');
    }
  };

  const handleDeleteKbItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge article?')) return;
    try {
      const res = await fetch(`/api/admin/knowledge-base/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Article deleted.');
        setKbItems(data.items);
      }
    } catch (err) {
      showFeedback('Could not delete article', 'error');
    }
  };

  // -------------------------------------------------------------
  // TAB 4B: LIVE AI TESTER ACTION
  // -------------------------------------------------------------
  const handleTestAiAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuestion.trim()) return;

    setIsTestingAi(true);
    setTestAiResponse(null);

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testQuestion.trim(),
          phone: testPhone.trim() || '918791287575'
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestAiResponse(data);
      } else {
        setTestAiResponse({ reply: `Error: ${data.error || 'Failed to query assistant.'}` });
      }
    } catch (err: any) {
      setTestAiResponse({ reply: `Exception: ${err.message}` });
    } finally {
      setIsTestingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all shadow-md ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ORDERS & PAYMENTS VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'orders-payments' && (
        <div className="space-y-6">
          
          {/* Header Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                Total Orders
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-slate-900">{orderStats.total}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 block mb-1">
                Paid & Verified
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-emerald-700">{orderStats.paid}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-600 block mb-1">
                Pending Payment
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-amber-700">{orderStats.pending}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-600 block mb-1">
                Failed / Cancelled
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-rose-700">{orderStats.failed}</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders by student name, phone, orderId..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['All', 'paid', 'pending', 'failed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setOrderFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                    orderFilter === st
                      ? 'bg-[#4A1D96] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
              <button
                onClick={fetchData}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Refresh Orders"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Order ID & Date</th>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-5 py-3.5">Course</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Razorpay Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-xs">
                        No orders match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <code className="font-mono font-bold text-slate-800 block">{ord.id}</code>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ord.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <strong className="text-slate-900 block font-semibold">{ord.studentName}</strong>
                          <span className="text-[11px] text-slate-500 font-mono">+{ord.studentPhone}</span>
                          {ord.studentEmail && (
                            <span className="text-[10px] text-slate-400 block">{ord.studentEmail}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-slate-800 block">{ord.courseName}</span>
                          {ord.discountCode && (
                            <span className="text-[10px] text-emerald-600 font-bold block">{ord.discountCode}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <strong className="font-['Outfit'] text-sm font-extrabold text-[#3B0764]">
                            ₹{Number(ord.expectedAmount).toLocaleString()}
                          </strong>
                          {ord.discountAmount > 0 && (
                            <span className="text-[10px] text-slate-400 block line-through">
                              ₹{Number(ord.coursePrice).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            ord.orderStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ord.orderStatus === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {ord.orderStatus === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {ord.orderStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {ord.razorpayPaymentId ? (
                            <code className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 block">
                              {ord.razorpayPaymentId}
                            </code>
                          ) : ord.razorpayOrderId ? (
                            <span className="font-mono text-[10px] text-slate-400 block">
                              {ord.razorpayOrderId}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Awaiting gateway</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WHATSAPP NOTIFICATIONS LOGS VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'whatsapp-notifications' && (
        <div className="space-y-6">
          
          {/* Header Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                Total Logs
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-slate-900">{notifStats.total}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 block mb-1">
                Sent Successfully
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-emerald-700">{notifStats.sent}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-600 block mb-1">
                Pending Credentials
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-amber-700">{notifStats.pending}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-600 block mb-1">
                Failed Dispatches
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-rose-700">{notifStats.failed}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5">
              {(['All', 'sent', 'failed', 'pending'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setNotifFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                    notifFilter === st
                      ? 'bg-[#4A1D96] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {/* Notification Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Recipient & Date</th>
                    <th className="px-5 py-3.5">Template / Message</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Provider</th>
                    <th className="px-5 py-3.5">Error Details / Message ID</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-xs">
                        No notification logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map(n => (
                      <tr key={n.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <strong className="text-slate-900 font-mono block">+{n.recipientPhone}</strong>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-slate-800 block capitalize">
                            {n.templateName?.replace(/_/g, ' ') || 'Payment Confirmation'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Order: {n.orderId}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            n.messageStatus === 'read'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : n.messageStatus === 'delivered'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : n.messageStatus === 'sent' || n.messageStatus === 'accepted'
                                  ? 'bg-emerald-50/70 text-emerald-700 border border-emerald-200'
                                  : n.messageStatus === 'pending'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {(n.messageStatus === 'delivered' || n.messageStatus === 'read' || n.messageStatus === 'sent') ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {n.messageStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="capitalize font-medium text-slate-600 block">
                            {n.provider?.replace(/_/g, ' ') || 'None'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          {n.errorDetails ? (
                            <span className="text-rose-600 text-[11px] block font-medium truncate" title={n.errorDetails}>
                              {n.errorDetails}
                            </span>
                          ) : n.providerMessageId ? (
                            <code className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {n.providerMessageId}
                            </code>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleRetryNotification(n.id)}
                            disabled={retryingNotifId === n.id}
                            className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#4A1D96] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {retryingNotifId === n.id ? 'Resending...' : 'Resend'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUPPORT TICKETS & AI ESCALATION VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'support-tickets' && (
        <div className="space-y-6">
          
          {/* Header Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                Total Tickets
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-slate-900">{ticketStats.total}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-rose-600 block mb-1">
                Open (Action Needed)
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-rose-700">{ticketStats.open}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-600 block mb-1">
                In Progress
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-amber-700">{ticketStats.inProgress}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600 block mb-1">
                Waiting for Student
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-blue-700">{ticketStats.waitingForStudent}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 block mb-1">
                Resolved / Closed
              </span>
              <span className="font-['Outfit'] text-2xl font-black text-emerald-700">{ticketStats.resolved}</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets by ticket #, question, phone, student..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['All', 'Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setTicketFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    ticketFilter === st
                      ? 'bg-[#4A1D96] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Tickets Cards List */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                No support tickets found matching the filter.
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-200 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#4A1D96] bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-100">
                        #{ticket.ticketNumber || ticket.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        ticket.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-800'
                          : ticket.priority === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ticket.priority || 'Medium'} Priority
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">
                        {ticket.category?.replace(/_/g, ' ') || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </span>
                      {/* Status Selector Dropdown */}
                      <select
                        value={ticket.status}
                        onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                          ticket.status === 'Open'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : ticket.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : ticket.status === 'Waiting for Student'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <option value="Open">Open</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting for Student">Waiting for Student</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  {/* Student Question */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Student Inquiry / Issue
                    </span>
                    <p className="text-sm font-medium text-slate-900 leading-relaxed">
                      "{ticket.originalQuestion}"
                    </p>
                  </div>

                  {/* Student Info & Direct Reply Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div>
                        <strong className="text-slate-900 font-bold block">{ticket.studentName || 'Student'}</strong>
                        <span className="text-slate-500 font-mono text-[11px]">+{ticket.studentPhone}</span>
                      </div>
                      <a
                        href={`https://wa.me/${ticket.studentPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center gap-1 text-[11px] font-bold"
                        title="Open WhatsApp chat directly"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open WhatsApp</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setReplyTicket(ticket);
                          setReplyText(`Hi ${ticket.studentName || 'there'}! This is regarding your support ticket #${ticket.ticketNumber || ticket.id}: `);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#4A1D96] to-[#6B21A8] hover:from-[#3B0764] hover:to-[#581C87] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Reply on WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Resolution Notes */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add internal resolution notes or assigned staff member..."
                      defaultValue={ticket.resolutionNotes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== ticket.resolutionNotes) {
                          handleSaveTicketNotes(ticket.id, e.target.value, ticket.assignedAgentName || 'Admin');
                        }
                      }}
                      className="flex-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4A1D96]"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Modal: Admin Reply to Student */}
          {replyTicket && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in border border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Reply to Student via WhatsApp
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ticket #{replyTicket.ticketNumber} • To: +{replyTicket.studentPhone}
                    </p>
                  </div>
                  <button
                    onClick={() => setReplyTicket(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSendAdminReply} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-700">
                    <span className="font-bold block text-slate-500 mb-1">Student's Question:</span>
                    "{replyTicket.originalQuestion}"
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Your Official WhatsApp Reply:
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply message here..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReplyTicket(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingReply}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingReply ? 'Sending...' : 'Send WhatsApp Message'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. AI KNOWLEDGE BASE & LIVE BOT TESTER VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'knowledge-base' && (
        <div className="space-y-8">
          
          {/* SECTION A: INTERACTIVE LIVE AI ASSISTANT TESTER */}
          <div className="bg-gradient-to-r from-purple-900 via-[#4A1D96] to-indigo-900 text-white p-6 sm:p-7 rounded-3xl shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-['Outfit'] font-extrabold text-lg text-white">
                    Live AI Student Assistant Simulator
                  </h3>
                  <p className="text-xs text-purple-200">
                    Test how the AI assistant queries your Knowledge Base and answers student WhatsApp inquiries.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Active Knowledge Engine
              </span>
            </div>

            <form onSubmit={handleTestAiAssistant} className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ask any question (e.g. fees, meet link, schedule, refund)..."
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder-slate-400 font-medium"
                />
                <button
                  type="submit"
                  disabled={isTestingAi}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-purple-950 font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingAi ? 'Analyzing...' : 'Test AI Query'}</span>
                </button>
              </div>
            </form>

            {testAiResponse && (
              <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm space-y-2 text-xs animate-fade-in">
                <div className="flex items-center justify-between text-purple-200 text-[11px]">
                  <span className="font-bold flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-amber-300" />
                    AI Assistant Output:
                  </span>
                  {testAiResponse.ticketCreated && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold">
                      Escalated to Human Ticket (#{testAiResponse.ticketNumber})
                    </span>
                  )}
                </div>
                <div className="bg-black/30 p-3 rounded-xl font-mono text-emerald-300 whitespace-pre-line text-xs">
                  {testAiResponse.reply}
                </div>
              </div>
            )}
          </div>

          {/* SECTION B: KNOWLEDGE BASE ARTICLES LIST */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                  Approved Knowledge Base & FAQs ({kbItems.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Source of truth used by the AI assistant. Updates are saved directly to knowledge-base.json without redeployment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    setEditingKbItem({
                      id: `kb_${Date.now()}`,
                      category: 'faq',
                      title: '',
                      keywords: [''],
                      content: ''
                    });
                    setIsCreatingKb(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Article / FAQ</span>
                </button>
              </div>
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKb.map(item => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-200 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-[#4A1D96] text-[10px] font-extrabold uppercase tracking-wider">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingKbItem(item);
                            setIsCreatingKb(false);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                          title="Edit Article"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteKbItem(item.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          title="Delete Article"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-['Outfit'] font-bold text-base text-slate-900">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                      {item.content}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {(item.keywords || []).map((kw: string, i: number) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal: Add or Edit Knowledge Item */}
          {editingKbItem && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-fade-in border border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                    {isCreatingKb ? 'Add New Knowledge Article / Policy' : 'Edit Knowledge Article'}
                  </h3>
                  <button
                    onClick={() => setEditingKbItem(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveKbItem} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={editingKbItem.category || 'faq'}
                      onChange={(e) => setEditingKbItem({ ...editingKbItem, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    >
                      <option value="course">Course Description</option>
                      <option value="fee">Course Fees & Pricing</option>
                      <option value="schedule">Batch Schedules & Timings</option>
                      <option value="joining_link">Google Meet & Joining Link</option>
                      <option value="refund">Refund & Cancellation Rules</option>
                      <option value="certificate">Certificates & Attendance</option>
                      <option value="faq">General FAQ</option>
                      <option value="general">About Academy & Mentors</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Title / Question *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Spoken English Course Fee"
                      value={editingKbItem.title || ''}
                      onChange={(e) => setEditingKbItem({ ...editingKbItem, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Search Keywords (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. fees, price, spoken english, cost"
                      value={Array.isArray(editingKbItem.keywords) ? editingKbItem.keywords.join(', ') : editingKbItem.keywords || ''}
                      onChange={(e) => setEditingKbItem({ ...editingKbItem, keywords: e.target.value.split(',').map(k => k.trim()) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Approved Content / Answer *</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="State the exact facts clearly..."
                      value={editingKbItem.content || ''}
                      onChange={(e) => setEditingKbItem({ ...editingKbItem, content: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingKbItem(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Knowledge Article</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
