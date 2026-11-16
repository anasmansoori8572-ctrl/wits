import React from 'react';
import { 
  CheckCircle2, Search, Calendar, Laptop, 
  Sparkles, Hash, MapPin
} from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  const batchesCount = siteSettings?.batchesCompletedCount || '15+';
  const studentsCount = siteSettings?.activeStudentsCount || '100+';

  return (
    <section className="relative py-16 sm:py-24 bg-[#F8F6F2] overflow-hidden border-b border-slate-200/80 font-['Plus_Jakarta_Sans']">
      
      {/* Subtle Warm Canvas Texture & Dot Accent */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.3]"
        style={{
          backgroundImage: `
            radial-gradient(rgba(109, 40, 217, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 2-Column Split Composition matching Reference Image */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* =========================================================================
              LEFT COLUMN: PERSON IN FULL NATURAL COLOR WITH GEOMETRIC BACKDROP SHAPES
              ========================================================================= */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[360px] sm:max-w-[420px] pt-10 pb-6">
              
              {/* 1. Large Bold Crimson/Purple Disc behind the subject */}
              <div 
                className="absolute top-2 left-1/2 -translate-x-1/2 w-64 h-64 sm:w-76 sm:h-76 rounded-full bg-gradient-to-tr from-[#6D28D9] via-[#7C3AED] to-[#E11D48] shadow-2xl shadow-purple-950/20 z-0" 
                aria-hidden="true"
              />

              {/* 2. Amber/Golden Decorative Arch behind right waist */}
              <div 
                className="absolute bottom-16 right-0 w-36 h-48 rounded-t-full bg-gradient-to-b from-[#F59E0B] to-[#D97706] opacity-90 z-0 -rotate-6"
                aria-hidden="true"
              />

              {/* 3. Deep Blue / Indigo Horizontal Anchor Bar */}
              <div 
                className="absolute -bottom-2 -left-4 sm:-left-6 w-56 h-12 rounded-xl bg-[#2563EB] z-0 shadow-md"
                aria-hidden="true"
              />

              {/* 4. Full Color Photographic Portrait of Confident Student / Professional */}
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/90 bg-white/40 backdrop-blur-xs">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=85"
                  alt="Confident Wits Lingo English Student"
                  className="w-full h-[400px] sm:h-[460px] object-cover object-top filter contrast-[1.05] brightness-[1.02]"
                  loading="eager"
                />

                {/* Subtle soft gradient fade at base */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                {/* Live Confidence Badge pinned to the photo */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 shadow-lg border border-white/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div>
                      <span className="text-[11px] font-extrabold uppercase text-slate-900 block leading-tight">
                        Verified Learner
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Fluent Spoken Confidence
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                    100% Practical
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* =========================================================================
              RIGHT COLUMN: EDITORIAL TYPOGRAPHY & FLOATING MILESTONE INTERFACE COLLAGE
              ========================================================================= */}
          <div className="lg:col-span-7 space-y-6 lg:pl-4">
            
            {/* Top Typography (Exact Editorial Serif Layout) */}
            <div className="space-y-3.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-purple-100/90 text-[#581C87] border border-purple-200/80 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>Our Journey & Accomplishments</span>
              </span>

              <h2 className="font-serif text-3.5xl sm:text-4xl lg:text-[46px] font-bold text-[#140528] tracking-tight leading-[1.12]">
                Real milestones,<br className="hidden sm:block" />
                fluent speech, and<br className="hidden sm:block" />
                confidence should be<br className="hidden sm:block" />
                easy to reach.
              </h2>

              {/* Accent Underline */}
              <div className="w-12 h-1 bg-[#2563EB] rounded-full" />

              <p className="text-slate-600 text-sm sm:text-base font-normal max-w-lg leading-relaxed">
                Break hesitation and unlock spoken clarity without memorizing endless grammar rules. Find your fluency with step-by-step mentored practice.
              </p>
            </div>

            {/* =====================================================================
                FLOATING MILESTONE INTERFACE & STICKER COLLAGE
                ===================================================================== */}
            <div className="relative pt-4 pb-2">
              
              {/* Background Golden / Amber Arch for Graphic Pop */}
              <div 
                className="absolute top-0 right-6 sm:right-16 w-44 h-44 rounded-t-full bg-[#FBBF24]/85 z-0" 
                aria-hidden="true"
              />

              {/* 1. Top Search Pill Input */}
              <div className="relative z-10 max-w-[280px] sm:max-w-[320px] ml-auto mb-3">
                <div className="bg-white rounded-2xl px-4 py-2 border border-slate-200/90 shadow-md flex items-center justify-between text-xs text-slate-700">
                  <span className="font-semibold text-slate-800">witslingo / spoken-english</span>
                  <Search className="w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Central Group: Main Floating Sheet + Surrounding Widgets */}
              <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                
                {/* 2. Floating Mini Calendar Widget */}
                <div className="hidden sm:block absolute -top-4 -left-6 z-20 bg-white rounded-2xl p-3 shadow-xl border border-slate-200/90 -rotate-6 w-32">
                  <div className="bg-[#1E1B26] text-white text-[9px] font-bold py-1 px-2 rounded-t-lg -mx-3 -mt-3 mb-2 flex items-center justify-between">
                    <span>LIVE COHORTS</span>
                    <Calendar className="w-3 h-3 text-purple-300" />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[8px] text-slate-400 text-center font-bold">
                    <span className="bg-purple-50 text-purple-700 p-0.5 rounded">M</span>
                    <span className="bg-purple-50 text-purple-700 p-0.5 rounded">T</span>
                    <span className="bg-purple-50 text-purple-700 p-0.5 rounded">W</span>
                    <span className="bg-purple-50 text-purple-700 p-0.5 rounded">T</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#4A1D96] block mt-1.5 text-center leading-tight">
                    40+ Sessions
                  </span>
                </div>

                {/* 3. The Main Milestone Document / Receipt Sheet Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-purple-950/10 border border-slate-200/90 w-full sm:max-w-md relative">
                  
                  {/* Document Header */}
                  <div className="border-b border-slate-100 pb-3 mb-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        OFFICIAL RECORD
                      </span>
                      <span className="text-xs font-bold text-slate-800 font-['Outfit']">
                        ACADEMY MILESTONES & IMPACT
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active
                    </span>
                  </div>

                  {/* 4 Milestones Laid Out Cleanly */}
                  <div className="space-y-3 text-xs">
                    
                    {/* Item 1: Batches */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-semibold">Completed Cohorts</span>
                        <span className="font-extrabold text-slate-800 text-sm">{batchesCount} Batches</span>
                      </div>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded-lg">
                        100% Practical
                      </span>
                    </div>

                    {/* Item 2: Students */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-semibold">Students Transformed</span>
                        <span className="font-extrabold text-slate-800 text-sm">{studentsCount} Learners</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        Small Towns & Cities
                      </span>
                    </div>

                    {/* Item 3: Progress & Learning Format */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[9px] text-slate-400 block uppercase font-semibold">Level Progress</span>
                        <span className="font-bold text-slate-800 text-[11px] block mt-0.5">Beginner → Adv.</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[9px] text-slate-400 block uppercase font-semibold">Learning Format</span>
                        <span className="font-bold text-slate-800 text-[11px] block mt-0.5">Online + Offline</span>
                      </div>
                    </div>

                  </div>

                  {/* Certified Trainer Signature line matching reference card */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] text-slate-400 block uppercase font-semibold">AUTHORIZED TRAINER</span>
                      <span className="font-serif italic font-bold text-slate-800 text-sm">
                        Ziyaur Rehman Zia
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verified
                    </span>
                  </div>
                </div>

                {/* 4. Floating Circular Hashtag Badge on Right */}
                <div className="hidden sm:flex flex-col items-center gap-3 self-center -ml-2">
                  <div className="w-12 h-12 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-black text-xl shadow-xl shadow-blue-950/20 border-2 border-white">
                    <Hash className="w-6 h-6 stroke-[3]" />
                  </div>

                  {/* Decorative Dot Matrix Grid */}
                  <div className="grid grid-cols-4 gap-1.5 opacity-40 p-1" aria-hidden="true">
                    {[...Array(16)].map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =========================================================================
            BOTTOM BAR: DEVICE COMPATIBILITY & DOMAIN BRANDING
            ========================================================================= */}
        <div className="mt-14 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          
          {/* Left: Device & Location metadata matching reference footer */}
          <div className="flex items-center gap-3 text-slate-600 font-medium">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#581C87] flex items-center justify-center shrink-0">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 block">
                Live Google Meet Interactive Classes + In-Person Batches
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-purple-600" />
                <span>{siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh'}</span>
              </span>
            </div>
          </div>

          {/* Right: Wits Lingo Custom Branding matching reference logo stamp */}
          <div className="flex items-center gap-2 font-['Outfit']">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6D28D9] to-[#4F46E5] text-white flex items-center justify-center font-black text-xs shadow-xs">
              W
            </div>
            <span className="font-bold text-sm text-slate-800 tracking-tight">
              {siteSettings?.academyName || 'witslingo.com'}
            </span>
          </div>

        </div>

      </div>
    </section>
  );
};
