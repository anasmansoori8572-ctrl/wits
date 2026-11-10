import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Sparkles } from 'lucide-react';
import { Logo } from './Logo';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface FloatingWhatsAppProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

// Authentic WhatsApp Brand Icon SVG
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({
  phoneNumber = WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN,
  defaultMessage = "Hello Wits Lingo, I would like to know more about your English courses."
}) => {
  // Normalize phone digits
  const cleanNumber = (phoneNumber || WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN).replace(/[^0-9]/g, '');
  const internationalNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  // 1. Mount detection for safe React Portal injection directly into document.body
  // This bypasses any parent component transforms, filters, or overflow-hidden rules.
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. AUTOMATIC POPUP BEHAVIOUR ON FIRST VISIT IN CURRENT BROWSING SESSION
  useEffect(() => {
    // Check sessionStorage: if already dismissed in this session, don't auto-open
    try {
      const isDismissed = sessionStorage.getItem('wits_whatsapp_popup_dismissed');
      if (isDismissed === 'true') {
        return;
      }
    } catch {
      // ignore
    }

    // Automatically display the popup approximately 1.5 seconds after page load
    const timer = setTimeout(() => {
      try {
        const isDismissed = sessionStorage.getItem('wits_whatsapp_popup_dismissed');
        if (isDismissed === 'true') {
          return;
        }
      } catch {}

      setIsOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // 3. LISTEN FOR GLOBAL EVENTS (e.g. clicking Footer WhatsApp icon or other in-page triggers)
  useEffect(() => {
    const handleOpenTrigger = () => {
      setIsOpen(true);
    };

    window.addEventListener('wits_open_whatsapp_popup', handleOpenTrigger);
    return () => {
      window.removeEventListener('wits_open_whatsapp_popup', handleOpenTrigger);
    };
  }, []);

  // Option A: Close Popup (×)
  // Immediately closes popup and remembers dismissal for the remainder of this browsing session.
  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    try {
      sessionStorage.setItem('wits_whatsapp_popup_dismissed', 'true');
    } catch {}
  };

  // Option B: Chat on WhatsApp
  // Opens official WhatsApp conversation with configured business number and prefilled message.
  const handleChatOnWhatsApp = (textToSend?: string) => {
    try {
      sessionStorage.setItem('wits_whatsapp_popup_dismissed', 'true');
    } catch {}

    const text = textToSend || customMsg.trim() || defaultMessage;
    const url = `https://wa.me/${internationalNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Floating button click: toggles the popup (always allowed manually, even if previously closed)
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  const quickOptions = [
    { label: '📅 When does the next batch start?', msg: "Hello Wits Lingo, when does the next English batch start?" },
    { label: '💰 What are the course fees?', msg: "Hello Wits Lingo, could you share the course fees and syllabus details?" },
    { label: '🗣️ How do I join a trial session?', msg: "Hello Wits Lingo, I would like to join a trial session for spoken English." },
  ];

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  // Render via createPortal directly into document.body
  // Stacking context: z-[99999] guarantees it sits above all headers, heroes, sections, and footers.
  return createPortal(
    <div
      id="wits-whatsapp-widget"
      className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-[99999] flex flex-col items-end pointer-events-none select-none"
      style={{ isolation: 'isolate', maxWidth: 'calc(100vw - 1.5rem)' }}
    >
      {/* ========================================================================= */}
      {/* POPUP WINDOW (Appears directly above the floating button)                 */}
      {/* ========================================================================= */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Wits Lingo WhatsApp Chat Support"
          className="pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[335px] sm:max-w-[360px] bg-white rounded-3xl shadow-2xl border border-purple-200/90 overflow-hidden mb-2.5 flex flex-col origin-bottom-right max-h-[80vh] transition-all duration-300 ease-out text-left box-border"
          style={{
            boxShadow: '0 20px 45px -10px rgba(40, 22, 72, 0.35), 0 4px 15px rgba(37, 211, 102, 0.15)',
          }}
        >
          {/* Header: WhatsApp Green + Wits Lingo Branding */}
          <div className="bg-gradient-to-r from-[#075E54] via-[#128C7E] to-[#281648] px-3.5 py-2.5 text-white flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <div className="w-8.5 h-8.5 rounded-full overflow-hidden bg-white/20 border-2 border-white/50 flex items-center justify-center p-0.5 shadow-xs">
                  <Logo iconOnly={true} size="sm" />
                </div>
                {/* Active pulsating online status beacon */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] border-2 border-white rounded-full">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75" />
                </span>
              </div>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[13px] sm:text-sm leading-tight font-['Outfit'] tracking-wide truncate">
                    Wits Lingo Support
                  </h3>
                  <span className="bg-[#25D366]/30 text-[9px] font-bold px-1 py-0.2 rounded text-white tracking-wider uppercase border border-[#25D366]/50 shrink-0">
                    Official
                  </span>
                </div>
                <p className="text-[10px] text-emerald-100 flex items-center gap-1 font-medium mt-0.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block shrink-0" />
                  <span className="truncate">Online • Replies instantly</span>
                </p>
              </div>
            </div>

            {/* Accessible, High-Contrast Close (×) Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/45 active:scale-95 text-white flex items-center justify-center transition-all focus:outline-none cursor-pointer shrink-0 ml-1.5"
              aria-label="Close WhatsApp popup"
              title="Close"
            >
              <X className="w-4.5 h-4.5 stroke-[2.5]" />
            </button>
          </div>

          {/* WhatsApp Chat Body */}
          <div className="p-3.5 bg-[#EFEAE2] bg-opacity-75 space-y-3 overflow-y-auto max-h-[48vh]">
            {/* Business Verification Badge Pill */}
            <div className="text-center">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[10px] font-bold text-slate-500 shadow-2xs border border-slate-200/60 truncate max-w-full">
                Official WhatsApp Business • {WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}
              </span>
            </div>

            {/* Incoming Welcome Message Bubble */}
            <div className="flex items-start gap-2 max-w-[98%]">
              <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-xs border border-slate-100 text-slate-800 space-y-2 text-xs sm:text-[13px] leading-relaxed relative">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <p className="font-bold text-[#075E54] text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Wits Lingo Team</span>
                  </p>
                  <span className="text-[10px] font-semibold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded">
                    Online Mentor
                  </span>
                </div>

                {/* EXACT REQUIRED WELCOME HEADLINE */}
                <p className="font-bold text-slate-900 text-[13px] sm:text-sm leading-snug">
                  Hi! 👋 Welcome to Wits Lingo. Need help choosing the right English course? Chat with us on WhatsApp!
                </p>

                <p className="text-slate-600 text-[11px] sm:text-xs">
                  We'll guide you through batch timings, fees, spoken English modules, and demo sessions.
                </p>

                <span className="block text-[9.5px] text-slate-400 text-right pt-0.5 font-medium">
                  Just now • ✓✓
                </span>
              </div>
            </div>

            {/* Quick Inquiries Chips */}
            <div className="space-y-1.5 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
                Frequently Asked:
              </p>
              <div className="flex flex-col gap-1.5">
                {quickOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChatOnWhatsApp(opt.msg)}
                    className="text-left text-xs bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-[#075E54] px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                  >
                    <span className="font-medium pr-1">{opt.label}</span>
                    <Send className="w-3 h-3 text-slate-400 group-hover:text-[#25D366] transition-colors shrink-0 ml-1.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="p-3 bg-white border-t border-slate-100 space-y-2 shrink-0">
            {/* Custom Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your question..."
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleChatOnWhatsApp();
                }}
                className="flex-1 bg-slate-100 text-xs text-slate-800 placeholder-slate-400 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#25D366] focus:bg-white transition-all min-w-0"
              />
              <button
                type="button"
                onClick={() => handleChatOnWhatsApp()}
                className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white p-2 rounded-xl shadow-xs transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Send message"
                aria-label="Send message via WhatsApp"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PROMINENT "CHAT ON WHATSAPP" CTA BUTTON */}
            <button
              type="button"
              onClick={() => handleChatOnWhatsApp()}
              className="w-full bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <WhatsAppIcon className="w-4.5 h-4.5 shrink-0" />
              <span>Chat on WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING CIRCULAR WHATSAPP BUTTON                                          */}
      {/* ========================================================================= */}
      <div className="pointer-events-auto flex items-center gap-2.5">
        {/* Desktop Helper Pill when popup is closed */}
        {!isOpen && (
          <div
            onClick={handleToggle}
            className="hidden sm:flex items-center gap-2 bg-white text-slate-800 px-3.5 py-2 rounded-full shadow-lg border border-purple-100 cursor-pointer hover:bg-slate-50 transition-colors group"
          >
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-xs font-bold text-[#1E123B] group-hover:text-[#075E54]">
              Chat on WhatsApp
            </span>
          </div>
        )}

        {/* Circular WhatsApp Floating Button */}
        <button
          type="button"
          onClick={handleToggle}
          className="relative w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white shadow-xl shadow-emerald-600/35 flex items-center justify-center transition-all duration-300 transform hover:scale-105 focus:outline-none cursor-pointer group"
          aria-label={isOpen ? "Close WhatsApp popup" : "Open WhatsApp chat support"}
          title={isOpen ? "Close" : "Chat on WhatsApp"}
        >
          {/* Subtle pulsating beacon ring */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-35 group-hover:opacity-60 animate-ping pointer-events-none" />
          )}

          {/* Icon: X when open, WhatsApp Logo when closed */}
          {isOpen ? (
            <X className="w-6 h-6 text-white transition-transform duration-200 stroke-[2.5]" />
          ) : (
            <WhatsAppIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white transition-transform duration-200 group-hover:scale-110" />
          )}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default FloatingWhatsApp;
