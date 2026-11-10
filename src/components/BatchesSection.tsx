import React, { useState } from 'react';
import { Batch, SiteSettings } from '../types';
import { Calendar, Clock, Users, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface BatchesSectionProps {
  batches: Batch[];
  onEnrollBatch: (courseId?: string, batchId?: string) => void;
  siteSettings?: SiteSettings;
}

export const BatchesSection: React.FC<BatchesSectionProps> = ({
  batches,
  onEnrollBatch,
  siteSettings,
}) => {
  const [filter, setFilter] = useState<'All' | 'Upcoming' | 'Active'>('All');

  // If the admin turned off the whole Batches & Capacity section, do not render it
  if (siteSettings?.showBatchesSection === false) {
    return null;
  }

  // Filter batches by status and admin visibility toggle
  const visibleBatches = batches.filter((batch) => {
    if (batch.isVisibleOnWebsite === false) return false;
    if (batch.status === 'Archived' || batch.status === 'Completed') return false;
    if (filter === 'All') return true;
    return batch.status === filter;
  });

  return (
    <section id="batches" className="py-20 sm:py-24 bg-white border-b border-slate-200/70 relative overflow-hidden">
      {/* Background Subtle Accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 text-[#4A1D96] border border-purple-200/80 text-xs font-bold uppercase tracking-wider shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span>Admissions & Seat Availability</span>
          </div>

          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            Batches & Seat Capacity
          </h2>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Small-batch intake for daily live speaking practice and personalized 1-on-1 feedback. Check real-time seat availability below.
          </p>
        </div>

        {/* Filter Pills & Live Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-8 sm:mb-10">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {(['All', 'Upcoming', 'Active'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filter === tab
                    ? 'bg-[#4A1D96] text-white shadow-sm shadow-purple-900/15'
                    : 'bg-slate-50 text-slate-700 hover:bg-purple-50 hover:text-[#4A1D96] border border-slate-200'
                }`}
              >
                {tab === 'All' ? `All Batches (${visibleBatches.length})` : `${tab} Batches`}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span>Live Sync with Academy Admission Desk</span>
          </div>
        </div>

        {/* Batches Grid */}
        {visibleBatches.length === 0 ? (
          <div className="text-center py-14 bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-8">
            <AlertCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No batches currently listed for this filter.</p>
            <p className="text-xs text-slate-500 mt-1">Please check back soon or register for upcoming announcements.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {visibleBatches.map((batch) => {
              const enrolled = batch.currentStudentsCount ?? batch.enrolledCount ?? 0;
              const maxCap = batch.maxStudents ?? batch.maxCapacity ?? 35;
              const percent = Math.min(100, Math.round((enrolled / maxCap) * 100));
              const seatsLeft = Math.max(0, maxCap - enrolled);
              const isNearlyFull = seatsLeft <= 8 || percent >= 75;
              const isFull = seatsLeft === 0;

              return (
                <div
                  key={batch.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-purple-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
                >
                  {/* Card Top */}
                  <div className="p-5 sm:p-7 space-y-4">
                    {/* Badge & Status Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-[#4A1D96] border border-purple-100">
                        {batch.batchCode}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                          batch.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-50 text-[#4A1D96] border border-purple-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            batch.status === 'Active' ? 'bg-emerald-600' : 'bg-purple-600'
                          }`}
                        />
                        {batch.status === 'Active' ? 'Active Batch' : 'Upcoming Batch'}
                      </span>
                    </div>

                    {/* Batch Name & Course */}
                    <div>
                      <h3 className="font-['Outfit'] text-xl font-extrabold text-[#1E1B26] group-hover:text-[#4A1D96] transition-colors leading-snug">
                        {batch.name}
                      </h3>
                      <p className="text-xs font-semibold text-purple-900/80 mt-1">
                        {batch.courseName || 'Practical Spoken English'}
                      </p>
                    </div>

                    {/* Schedule & Timing Details */}
                    <div className="space-y-2.5 pt-2 text-xs text-slate-600 border-t border-slate-100">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 break-words leading-relaxed">
                          <strong className="text-slate-800 font-semibold">Timing:</strong>{' '}
                          <span>{batch.scheduleTime || '07:30 PM - 08:30 PM IST (Mon-Fri)'}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 break-words leading-relaxed">
                          <strong className="text-slate-800 font-semibold">Start Date:</strong>{' '}
                          <span>{batch.startDate}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 break-words leading-relaxed">
                          <strong className="text-slate-800 font-semibold">Mentor:</strong>{' '}
                          <span>{batch.teacherName || siteSettings?.founderName || 'Ziyaur Rehman Zia'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Capacity Progress & Enrollment Meter */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>Capacity Enrollment</span>
                        </span>
                        <span className="font-extrabold text-[#3B0764]">
                          {enrolled} / {maxCap} Students ({percent}%)
                        </span>
                      </div>

                      {/* Visual Capacity Bar */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isNearlyFull
                              ? 'bg-gradient-to-r from-[#4A1D96] to-amber-500'
                              : 'bg-gradient-to-r from-[#3B0764] to-[#6D28D9]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Remaining Seats Urgency Notice */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        {isFull ? (
                          <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">
                            ⛔ Batch Full (Waiting List Open)
                          </span>
                        ) : isNearlyFull ? (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <span>⚡ Fast Filling:</span> Only {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left!
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                            ✓ Admissions Open ({seatsLeft} seats remaining)
                          </span>
                        )}

                        <span className="text-slate-400 text-[10px]">
                          Max: {maxCap}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="p-5 sm:p-7 pt-0">
                    <button
                      onClick={() => onEnrollBatch(batch.courseId, batch.id)}
                      className="w-full py-3 px-4 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 group-hover:gap-3 cursor-pointer"
                    >
                      <span>{isFull ? 'Join Batch Waitlist' : 'Enroll in this Batch'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Small-Batch Philosophy Guarantee Banner */}
        <div className="mt-14 bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#3B0764] rounded-3xl p-6 sm:p-10 text-white shadow-xl shadow-purple-950/10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-center">
            <div className="lg:col-span-2 space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 text-xs font-bold tracking-wide">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>The Wits Lingo Strict Small-Batch Policy</span>
              </div>
              <h3 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold leading-tight">
                Why Do We Limit Each Batch to 30–35 Students?
              </h3>
              <p className="text-xs sm:text-sm text-purple-100/90 leading-relaxed">
                Unlike mass broadcast webinars with hundreds of muted participants, every Wits Lingo live class is an interactive conversational room. You speak out loud every single day with direct correction from Sir Ziyaur Rehman Zia.
              </p>
            </div>

            <div className="space-y-3 bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Daily mic time & speaking drills for every learner</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Personal pronunciation & MTI reduction feedback</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>24/7 dedicated batch WhatsApp speaking group</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
