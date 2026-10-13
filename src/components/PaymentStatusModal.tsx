import React, { useState, useEffect } from 'react';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Copy,
  Check,
  Video,
  Calendar,
  Clock,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  X
} from 'lucide-react';

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  initialData?: {
    order: any;
    payment: any;
    meetLink?: string;
    startDate?: string;
  };
  onGoToCourse: () => void;
  onRetryPayment?: (courseId: string) => void;
}

export const PaymentStatusModal: React.FC<PaymentStatusModalProps> = ({
  isOpen,
  onClose,
  orderId,
  initialData,
  onGoToCourse,
  onRetryPayment
}) => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [order, setOrder] = useState<any>(initialData?.order || null);
  const [payment, setPayment] = useState<any>(initialData?.payment || null);
  const [meetLink, setMeetLink] = useState<string>(initialData?.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK);
  const [startDate, setStartDate] = useState<string>(initialData?.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (initialData?.order && initialData.order.orderStatus === 'paid') {
      setOrder(initialData.order);
      setPayment(initialData.payment);
      setStatus('success');
      return;
    }

    if (!orderId) {
      if (initialData?.order?.orderStatus === 'failed') {
        setStatus('failed');
        setErrorMessage('Payment could not be verified.');
      }
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 15;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        if (!res.ok) throw new Error('Could not fetch order status');
        const data = await res.json();

        if (!isMounted) return;

        if (data.success && data.order) {
          setOrder(data.order);
          if (data.order.orderStatus === 'paid') {
            setPayment(data.payment);
            if (data.joiningDetails?.meetLink) setMeetLink(data.joiningDetails.meetLink);
            if (data.joiningDetails?.startDate) setStartDate(data.joiningDetails.startDate);
            setStatus('success');
            return true;
          } else if (data.order.orderStatus === 'failed') {
            setStatus('failed');
            setErrorMessage('Payment failed or was cancelled by the bank.');
            return true;
          }
        }
      } catch (err: any) {
        console.warn('[Payment Status Polling] Error:', err);
      }
      return false;
    };

    setStatus('verifying');

    const interval = setInterval(async () => {
      pollCount++;
      const finished = await checkStatus();
      if (finished || pollCount >= maxPolls) {
        clearInterval(interval);
        if (!finished && isMounted && status === 'verifying') {
          // If polling reached timeout, check if we have order or fail
          setStatus('failed');
          setErrorMessage('Payment verification timed out. If money was debited from your account, Razorpay will auto-confirm your order within a few minutes.');
        }
      }
    }, 2000);

    // Initial check
    checkStatus();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId, initialData]);

  if (!isOpen) return null;

  const handleCopyMeetLink = () => {
    navigator.clipboard?.writeText(meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const studentName = order?.studentName || payment?.studentName || 'Student';
  const courseName = order?.courseName || payment?.courseName || 'Wits Lingo English Course';
  const amountPaid = payment?.amount || order?.expectedAmount || 1499;
  const transactionId = payment?.razorpayPaymentId || payment?.paymentId || order?.razorpayPaymentId || 'Verified';

  // WhatsApp Pre-filled message URL as required by Section 5:
  // "Hi Wits Lingo! I have enrolled in {{course_name}} and would like help with my course."
  const prefilledMessage = encodeURIComponent(
    `Hi Wits Lingo! I have enrolled in ${courseName} and would like help with my course.`
  );
  const whatsappUrl = `https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${prefilledMessage}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-100 overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. VERIFYING STATE */}
        {status === 'verifying' && (
          <div className="p-8 sm:p-12 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-50 text-[#4A1D96] flex items-center justify-center relative">
              <div className="w-12 h-12 rounded-full border-3 border-purple-200 border-t-[#4A1D96] animate-spin" />
            </div>
            <div>
              <h3 className="font-['Outfit'] text-2xl font-bold text-slate-900">
                Verifying your payment...
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                Communicating with Razorpay to confirm your transaction signature and activate your course seat.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Please do not close this window</span>
            </div>
          </div>
        )}

        {/* 2. SUCCESS STATE (Polished, Celebratory, Lucide Animated) */}
        {status === 'success' && (
          <div className="animate-fade-in">
            {/* Header with celebratory gradient */}
            <div className="bg-gradient-to-r from-emerald-600 via-[#059669] to-teal-700 text-white p-7 sm:p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                <Sparkles className="w-36 h-36" />
              </div>

              {/* Animated Celebration Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-3.5 animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-extrabold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Admission Confirmed
              </div>

              <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black tracking-tight">
                Payment Successful!
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-sm mx-auto">
                Welcome to Wits Lingo, <strong>{studentName}</strong>! Your seat has been reserved.
              </p>
            </div>

            {/* Payment & Course Details Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Course Enrolled</span>
                  <strong className="text-slate-900 font-bold">{courseName}</strong>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Verified Amount Paid</span>
                  <span className="font-['Outfit'] text-base font-extrabold text-[#3B0764]">
                    ₹{amountPaid.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Transaction ID</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono text-slate-700">
                    {transactionId}
                  </code>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Course Start Date</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-700" />
                    {startDate}
                  </span>
                </div>
              </div>

              {/* Live Classroom Joining Details (Google Meet) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/80 border border-purple-200/80 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A1D96]">
                  <Video className="w-4 h-4 text-purple-700" />
                  <span>Live Classroom Joining Instructions</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Classes are conducted live on Google Meet with Zia Sir ({WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}).
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={meetLink}
                    className="flex-1 bg-white px-3 py-2 rounded-xl border border-purple-200 text-xs font-mono text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyMeetLink}
                    className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4A1D96] text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <span>Join</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {/* 1. Go to My Course */}
                <button
                  type="button"
                  onClick={onGoToCourse}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#4A1D96] to-[#6B21A8] hover:from-[#3B0764] hover:to-[#581C87] text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-900/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Go to My Course (Student Portal)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* 2. Official WhatsApp Support Button (Section 5 Requirement) */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-900/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Chat on WhatsApp — Ask Your Questions</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* WhatsApp confirmation dispatch note */}
              <p className="text-[11px] text-slate-400 text-center">
                A confirmation message has been automatically sent to your WhatsApp number with complete syllabus and joining details.
              </p>
            </div>
          </div>
        )}

        {/* 3. FAILED STATE */}
        {status === 'failed' && (
          <div className="p-8 sm:p-10 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="font-['Outfit'] text-2xl font-bold text-slate-900">
                Payment Verification Failed
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-sm mx-auto leading-relaxed">
                {errorMessage || 'Your payment was declined or could not be completed at this time.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-left space-y-1">
              <p>• If funds were debited, Razorpay will automatically reconcile your account or refund within 24-48 hours.</p>
              <p>• You can safely retry or reach out to our admission desk directly.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onRetryPayment && order?.courseId) {
                    onRetryPayment(order.courseId);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Try Again
              </button>

              <a
                href={`https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodeURIComponent('Hi Wits Lingo! My payment failed while enrolling. Please help me.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Contact Support</span>
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
