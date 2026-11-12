import React, { useState } from 'react';
import { Announcement, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { X, Calendar, Clock, AlertTriangle, ShieldCheck, Check, Share2, MessageCircle, Pin, Tag } from 'lucide-react';

interface AnnouncementModalProps {
  isOpen: boolean;
  announcement: Announcement | null;
  onClose: () => void;
  siteSettings?: SiteSettings;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  announcement,
  onClose,
  siteSettings
}) => {
  const [copied, setCopied] = useState(false);

  useScrollLock(Boolean(isOpen && announcement));

  if (!isOpen || !announcement) return null;

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'Holiday':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-200',
          label: '🏖️ Academy Holiday Notice',
          borderAccent: 'border-amber-400'
        };
      case 'Class Notice':
        return {
          bg: 'bg-indigo-100 text-indigo-900 border-indigo-200',
          label: '📢 Course Class Notice',
          borderAccent: 'border-indigo-400'
        };
      case 'Schedule Change':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-200',
          label: '🕒 Schedule & Timing Update',
          borderAccent: 'border-blue-400'
        };
      case 'Urgent Alert':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-200',
          label: '🚨 Urgent Announcement',
          borderAccent: 'border-rose-500'
        };
      case 'Exam / Test':
        return {
          bg: 'bg-purple-100 text-purple-900 border-purple-200',
          label: '📝 Speaking Evaluation / Test',
          borderAccent: 'border-purple-500'
        };
      default:
        return {
          bg: 'bg-purple-50 text-[#4A1D96] border-purple-200',
          label: '📌 Academy Official Notice',
          borderAccent: 'border-purple-500'
        };
    }
  };

  const badgeStyle = getCategoryBadge(announcement.category);

  const handleCopyNotice = () => {
    const textToCopy = `*${announcement.title}*\n\nApplicable To: ${announcement.batchName}\nDate: ${announcement.date}${announcement.effectiveDate ? `\nEffective: ${announcement.effectiveDate}` : ''}\n\n${announcement.message}\n\n— ${announcement.author}, ${siteSettings?.academyName || 'Wits Lingo Academy'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const cleanPhone = (siteSettings?.phone1 || '7310952271').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(`Hi Sir, I am inquiring regarding the notice: "${announcement.title}"`)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto overscroll-contain smooth-scroll-viewport">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-purple-100 animate-in zoom-in-95 duration-150 relative overflow-hidden my-6 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner with Academy Watermark styling */}
        <div className="bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#6B21A8] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Notice"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full bg-white/15 text-purple-200 border border-white/10 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Official Circular • Ref: WL/NOT/{announcement.id.slice(-4).toUpperCase()}
            </span>
            {announcement.isPinned && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 flex items-center gap-1">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
          </div>

          <h2 className="font-['Outfit'] text-xl sm:text-2xl font-bold leading-snug">
            {announcement.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-purple-200 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-300" />
              Posted: {announcement.date}
            </span>
            {announcement.effectiveDate && (
              <span className="flex items-center gap-1 text-amber-200 bg-black/20 px-2 py-0.5 rounded-md">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                Schedule: {announcement.effectiveDate}
              </span>
            )}
          </div>
        </div>

        {/* Notice Meta Information Bar */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeStyle.bg}`}>
              {badgeStyle.label}
            </span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              Audience: <span className="text-[#4A1D96] font-bold">{announcement.batchName}</span>
            </span>
          </div>

          {announcement.priority === 'Urgent' && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              High Priority Notice
            </span>
          )}
        </div>

        {/* Notice Content Body */}
        <div className="p-6 sm:p-7 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line font-['Plus_Jakarta_Sans']">
            {announcement.message}
          </div>

          {/* Special Holiday / Attendance Alert Banner */}
          {announcement.category === 'Holiday' && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span>📌 Important Holiday Instructions:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1">
                <li>No live sessions will be hosted on declared holiday dates.</li>
                <li>Your student dashboard recording vault & notes library remain active.</li>
                <li>Live sessions automatically resume the following scheduled day.</li>
              </ul>
            </div>
          )}

          {/* Official Signatory Box */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Issued & Authorized By:
              </div>
              <div className="text-sm font-bold text-[#4A1D96] font-['Outfit']">
                {announcement.author || siteSettings?.founderName || 'Ziyaur Rehman Zia'}
              </div>
              <div className="text-xs text-slate-500">
                {siteSettings?.founderTitle || 'Founder & English Communication Mentor'}, {siteSettings?.academyName || 'Wits Lingo Academy'}
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-50 border border-purple-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div className="text-[11px] leading-tight text-slate-700">
                <span className="font-bold text-slate-900 block">Verified Academy Notice</span>
                <span className="text-[10px] text-slate-500">{siteSettings?.address || 'Dhakka, Amroha'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyNotice}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Notice Copied!' : 'Copy Notice Text'}</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ask on WhatsApp</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
};
