import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  X, 
  Calendar, 
  Clock, 
  Search, 
  Pin, 
  AlertCircle, 
  Sparkles, 
  BookOpen, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { Announcement } from '../types';
import { WhatsAppIcon } from './FloatingWhatsApp';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface FloatingNoticeWidgetProps {
  announcements?: Announcement[];
  onOpenCheckout?: (courseId?: string) => void;
}

export const FloatingNoticeWidget: React.FC<FloatingNoticeWidgetProps> = ({
  announcements = [],
  onOpenCheckout
}) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for custom trigger event to open notices modal from anywhere (e.g. footer or top banner)
  useEffect(() => {
    const handleOpenTrigger = () => {
      setIsOpen(true);
    };
    window.addEventListener('wits_open_notices_modal', handleOpenTrigger);
    return () => {
      window.removeEventListener('wits_open_notices_modal', handleOpenTrigger);
    };
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const noticeCount = announcements.length;

  // Filter & Search logic
  const filteredNotices = announcements.filter(ann => {
    // Category match
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Holiday' && ann.category !== 'Holiday') return false;
      if (selectedCategory === 'Course' && ann.category !== 'Course Update' && ann.category !== 'Class Notice' && !ann.title.toLowerCase().includes('course')) return false;
      if (selectedCategory === 'Timing' && ann.category !== 'Schedule Change' && ann.category !== 'Batch Timing' && !ann.title.toLowerCase().includes('timing') && !ann.title.toLowerCase().includes('schedule')) return false;
      if (selectedCategory === 'Urgent' && ann.priority !== 'Urgent' && ann.category !== 'Urgent Alert') return false;
    }

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (ann.title || '').toLowerCase().includes(q);
      const matchMessage = (ann.message || '').toLowerCase().includes(q);
      const matchCategory = (ann.category || '').toLowerCase().includes(q);
      const matchEffective = (ann.effectiveDate || '').toLowerCase().includes(q);
      const matchAudience = (ann.batchName || '').toLowerCase().includes(q);
      return matchTitle || matchMessage || matchCategory || matchEffective || matchAudience;
    }

    return true;
  });

  // Sort: pinned notices first, then original order
  const sortedNotices = [...filteredNotices].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const categoryCounts = {
    all: announcements.length,
    holiday: announcements.filter(a => a.category === 'Holiday').length,
    course: announcements.filter(a => a.category === 'Course Update' || a.category === 'Class Notice' || a.title.toLowerCase().includes('course')).length,
    timing: announcements.filter(a => a.category === 'Schedule Change' || a.category === 'Batch Timing' || a.title.toLowerCase().includes('timing') || a.title.toLowerCase().includes('schedule')).length,
    urgent: announcements.filter(a => a.priority === 'Urgent' || a.category === 'Urgent Alert').length,
  };

  const handleAskOnWhatsApp = (ann: Announcement) => {
    const text = `Hello Wits Lingo, I have a question regarding the notice: "${ann.title}". Could you please provide more details?`;
    const cleanNumber = WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN.replace(/[^0-9]/g, '');
    const intlNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    window.open(`https://wa.me/${intlNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleExploreCourses = () => {
    setIsOpen(false);
    if (onOpenCheckout) {
      onOpenCheckout();
    } else {
      const el = document.getElementById('courses');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return createPortal(
    <>
      {/* ========================================================================= */}
      {/* FLOATING NOTICE ICON (Stacked directly ABOVE WhatsApp Floating Button)    */}
      {/* ========================================================================= */}
      <div
        id="wits-notice-widget"
        className="fixed bottom-[4.85rem] right-3.5 sm:bottom-[6.25rem] sm:right-6.5 z-[99998] flex items-center gap-2 select-none pointer-events-auto"
        style={{ isolation: 'isolate' }}
      >
        {/* Desktop Helper Pill when closed */}
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white text-slate-800 px-3.5 py-1.5 rounded-full shadow-lg border border-purple-200 cursor-pointer hover:bg-purple-50 transition-all group"
            title="Open Academy Notices (Holidays, Courses, Timings)"
          >
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-xs font-bold text-[#1E123B] group-hover:text-[#4A1D96]">
              Notices ({noticeCount})
            </span>
          </div>
        )}

        {/* Circular Floating Notice Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close academy notices" : "Open academy notice board"}
          title={isOpen ? "Close Notices" : "Academy Notices & Holidays"}
          className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-[#1E0F38] via-[#3B1A6E] to-[#6D28D9] hover:from-[#281648] hover:to-[#5B21B6] active:scale-95 text-white shadow-xl shadow-purple-950/35 flex items-center justify-center transition-all duration-300 transform hover:scale-105 cursor-pointer border-2 border-white/60 focus:outline-none group"
        >
          {/* Subtle pulsating beacon ring when closed */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-purple-500 opacity-30 group-hover:opacity-50 animate-ping pointer-events-none" />
          )}

          {/* Unread / Total Notice Badge Counter */}
          {!isOpen && noticeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
              {noticeCount}
            </span>
          )}

          {/* Icon: X when open, Bell with gentle swing when closed */}
          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.5]" />
          ) : (
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.3] group-hover:rotate-12 transition-transform duration-200" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE NOTICE BOARD POPUP MODAL                                      */}
      {/* ========================================================================= */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overscroll-contain animate-in fade-in duration-200 select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Wits Lingo Academy Notices & Circulars"
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-purple-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200 text-left"
          >
            {/* Header: Royal Purple Gradient */}
            <div className="bg-gradient-to-r from-[#1E0F38] via-[#331463] to-[#281648] text-white p-5 sm:p-6 relative shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3] text-purple-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-white tracking-wide">
                        WITS LINGO NOTICE BOARD
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                        Official
                      </span>
                    </div>
                    <p className="text-xs text-purple-200/90 mt-0.5">
                      Holidays, course updates, class timings & academy circulars
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  aria-label="Close notice board"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Summary Pill Bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-purple-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{noticeCount} Published Notices</span>
                </span>
                <span className="text-[11px] text-purple-300/80">
                  Managed live by Administration
                </span>
              </div>
            </div>

            {/* Filter Chips & Search Bar */}
            <div className="p-3 sm:p-4 bg-purple-50/50 border-b border-purple-100 space-y-2.5 shrink-0">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {[
                  { id: 'all', label: `All (${categoryCounts.all})` },
                  { id: 'Holiday', label: `🏖️ Holidays (${categoryCounts.holiday})` },
                  { id: 'Course', label: `📚 Courses (${categoryCounts.course})` },
                  { id: 'Timing', label: `🕒 Timings (${categoryCounts.timing})` },
                  { id: 'Urgent', label: `🚨 Alerts (${categoryCounts.urgent})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                      selectedCategory === tab.id
                        ? 'bg-[#281648] text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-purple-100/70 border border-purple-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices by keyword, date, holiday, or timing..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-purple-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4A1D96]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Notice Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y-0">
              {sortedNotices.length > 0 ? (
                sortedNotices.map((ann) => {
                  const isHoliday = ann.category === 'Holiday';
                  const isCourse = ann.category === 'Course Update' || ann.category === 'Class Notice' || ann.title.toLowerCase().includes('course');
                  const isSchedule = ann.category === 'Schedule Change' || ann.category === 'Batch Timing' || ann.title.toLowerCase().includes('timing');
                  const isUrgent = ann.priority === 'Urgent';

                  return (
                    <article
                      key={ann.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 space-y-3 ${
                        ann.isPinned
                          ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-purple-200 hover:shadow-xs'
                      }`}
                    >
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ann.isPinned && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] flex items-center gap-1 uppercase tracking-wider">
                              <Pin className="w-3 h-3 fill-amber-700 text-amber-700" />
                              <span>Pinned Notice</span>
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            isHoliday
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : isCourse
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                              : isSchedule
                              ? 'bg-blue-100 text-blue-900 border-blue-200'
                              : 'bg-purple-100 text-purple-900 border-purple-200'
                          }`}>
                            {isHoliday ? '🏖️ Holiday' : isCourse ? '📚 Course Update' : isSchedule ? '🕒 Class Timing' : '📌 Academy Notice'}
                          </span>

                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                            isUrgent
                              ? 'bg-rose-100 text-rose-800'
                              : ann.priority === 'Important'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ann.priority}
                          </span>
                        </div>

                        {/* Date Published */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Posted: {ann.date}</span>
                        </div>
                      </div>

                      {/* Notice Title */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 font-['Outfit'] leading-snug">
                        {ann.title}
                      </h3>

                      {/* Effective Date / Timing Badge if provided */}
                      {ann.effectiveDate && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                          <span>Effective: {ann.effectiveDate}</span>
                        </div>
                      )}

                      {/* Notice Message Content */}
                      <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
                        {ann.message}
                      </p>

                      {/* Footer Actions: Course Button, WhatsApp Query, Audience */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
                        <div className="text-[11px] text-slate-500 font-medium">
                          Audience: <span className="font-bold text-slate-700">{ann.batchName ? ann.batchName.replace(/batch/gi, 'Course') : 'All Students'}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Course Explore Button if course-related */}
                          {isCourse && (
                            <button
                              type="button"
                              onClick={handleExploreCourses}
                              className="px-2.5 py-1 rounded-lg bg-[#281648] hover:bg-[#1E0F38] text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>View Courses</span>
                            </button>
                          )}

                          {/* WhatsApp Inquiry Button */}
                          <button
                            type="button"
                            onClick={() => handleAskOnWhatsApp(ann)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ask question on official WhatsApp"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ask on WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                /* Empty state when no notices match */
                <div className="py-12 px-4 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-9 h-9 text-purple-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">No notices in this category</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All classes, batches, and schedules are proceeding as usual. Any new announcements will appear here immediately.
                  </p>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="mt-2 px-3 py-1 bg-purple-100 text-[#4A1D96] rounded-lg text-xs font-bold hover:bg-purple-200 cursor-pointer"
                    >
                      View All Notices
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Institutional Bar */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
              <span className="text-[11px] text-slate-500">
                Helpline: <strong className="text-slate-700">{WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}</strong> (Call & WhatsApp)
              </span>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full sm:w-auto px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors cursor-pointer text-xs"
              >
                Close Notice Board
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default FloatingNoticeWidget;
