import React from 'react';
import { 
  CheckCircle2, Search, Calendar, Laptop, 
  Sparkles, Hash, MapPin, Target, Flame, Mic
} from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  const batchesCount = siteSettings?.batchesCompletedCount || '15+';
  const studentsCount = siteSettings?.activeStudentsCount || '100+';

  return (
    <section className="relative py-8 sm:py-16 lg:py-24 bg-[#F8F6F2] overflow-hidden border-b border-slate-200/80 font-['Plus_Jakarta_Sans']">
      
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
        
        {/* =========================================================================
            DESKTOP & TABLET VIEW (lg:grid): 2-COLUMN SPLIT COMPOSITION
            Left: Background-less student cutout with geometric shapes
            Right: Editorial serif typography + floating milestone interface card
            ========================================================================= */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: EXACT REFERENCE STUDENT CUTOUT WITH GEOMETRIC BACKDROP */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[340px] sm:max-w-[400px] flex items-end justify-center pt-8 pb-4">
              
              {/* Large Bold Crimson/Purple Disc directly behind the student's head */}
              <div 
                className="absolute top-2 left-6 sm:left-10 w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#E11D48] shadow-2xl shadow-purple-950/25 z-0" 
                aria-hidden="true"
              />

              {/* Deep Blue / Indigo Horizontal Anchor Bar behind student's waist */}
              <div 
                className="absolute bottom-6 sm:bottom-8 -left-4 sm:-left-8 w-44 sm:w-56 h-10 sm:h-12 rounded-xl bg-[#2563EB] z-0 shadow-md"
                aria-hidden="true"
              />

              {/* Golden Graphic Pop Accent on lower-right side */}
              <div 
                className="absolute bottom-16 right-0 w-24 h-36 rounded-t-full bg-gradient-to-b from-[#F59E0B] to-[#D97706] opacity-80 z-0 -rotate-6"
                aria-hidden="true"
              />

              {/* The Exact Student from Reference Image: Background-less Cutout in Natural Warm Tone */}
              <img
                src="/student-cutout.png"
                alt="Wits Lingo Learner"
                className="relative z-10 w-full max-h-[460px] sm:max-h-[520px] object-contain drop-shadow-2xl select-none pointer-events-none"
                loading="eager"
              />

              {/* Floating Verified Learner Confidence Badge */}
              <div className="absolute -bottom-2 right-0 sm:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-3.5 py-2.5 shadow-xl border border-slate-200/90 flex items-center gap-3">
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
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                  100% Practical
                </span>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: EDITORIAL TYPOGRAPHY & FLOATING MILESTONE INTERFACE COLLAGE */}
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

            {/* FLOATING MILESTONE INTERFACE & STICKER COLLAGE */}
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
            MOBILE VIEW (lg:hidden): COMPACT, OPTIMIZED STUDENT & FLOATING CARDS COLLAGE
            Hides the heavy text and milestone receipt card from second image.
            Shows student with floating micro-cards as in the reference mobile design.
            Uses tight framing with no extra wasted space.
            ========================================================================= */}
        <div className="block lg:hidden">
          
          {/* Section Pill Title */}
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-purple-100/90 text-[#581C87] border border-purple-200/80 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span>Our Journey & Accomplishments</span>
            </span>
          </div>

          {/* Optimized Floating Card Stage */}
          <div className="relative max-w-[340px] xs:max-w-[360px] mx-auto min-h-[430px] flex items-end justify-center pt-3 pb-2 select-none">
            
            {/* 1. Purple/Crimson Disc backdrop behind head */}
            <div 
              className="absolute top-2 left-1/2 -translate-x-1/2 w-52 h-52 xs:w-56 xs:h-56 rounded-full bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#E11D48] shadow-xl shadow-purple-950/20 z-0" 
              aria-hidden="true"
            />

            {/* 2. Golden Arch on bottom right */}
            <div 
              className="absolute bottom-12 right-1 w-24 h-36 rounded-t-full bg-gradient-to-b from-[#F59E0B] to-[#D97706] opacity-85 z-0 -rotate-6"
              aria-hidden="true"
            />

            {/* 3. Royal Blue Anchor Bar on bottom left */}
            <div 
              className="absolute bottom-5 left-1 w-36 h-9 rounded-xl bg-[#2563EB] z-0 shadow-md"
              aria-hidden="true"
            />

            {/* 4. Student Cutout */}
            <img
              src="/student-cutout.png"
              alt="Wits Lingo Student"
              className="relative z-10 w-full max-h-[390px] xs:max-h-[410px] object-contain drop-shadow-xl pointer-events-none"
              loading="eager"
            />

            {/* =====================================================================
                FLOATING MICRO-CARDS MATCHING USER REFERENCE DESIGN
                ===================================================================== */}

            {/* Card 1: Top-Left "Goal: Fluent in 90 Days" */}
            <div className="absolute top-0 -left-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-lg border border-white/80 w-[122px] xs:w-[130px]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                  <Target className="w-3 h-3 text-rose-500" />
                </div>
                <div className="leading-tight">
                  <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Goal</span>
                  <span className="text-[9.5px] font-extrabold text-slate-800 block">Fluent in 90 Days</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[8px] text-purple-700 font-semibold">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                  <span className="w-12 h-1 bg-purple-200 rounded-full" />
                </div>
                <div className="flex items-center gap-1 text-[8px] text-purple-700 font-semibold">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                  <span className="w-14 h-1 bg-purple-200 rounded-full" />
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-400">
                  <span className="w-2.5 h-2.5 rounded border border-slate-300 shrink-0" />
                  <span className="w-9 h-1 bg-slate-200 rounded-full" />
                </div>
              </div>
            </div>

            {/* Card 2: Top-Right "14-Day Streak!" */}
            <div className="absolute top-0 -right-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-2.5 py-1.5 shadow-lg border border-white/80">
              <div className="flex items-center gap-1 mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 shrink-0" />
                <span className="text-[10px] font-extrabold text-slate-800">14-Day Streak!</span>
              </div>
              <div className="w-20 h-1.5 bg-orange-100 rounded-full overflow-hidden flex items-center">
                <div className="w-3/4 h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
              </div>
            </div>

            {/* Card 3: Middle-Right "Word of the Day" */}
            <div className="absolute top-16 -right-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-2 shadow-lg border border-white/80 w-[126px]">
              <span className="text-[7.5px] font-bold uppercase text-slate-400 block tracking-wider">Word of the Day</span>
              <span className="text-[10px] font-extrabold text-[#581C87] block leading-tight">Serendipity</span>
              <span className="text-[7.5px] text-slate-500 leading-tight block mt-0.5">
                Spontaneous confidence in conversation.
              </span>
            </div>

            {/* Card 4: Middle-Left "Daily Quiz / Identify Error" */}
            <div className="absolute top-24 -left-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-2 py-1.5 shadow-lg border border-white/80 flex items-center gap-1.5">
              <div>
                <span className="text-[7px] font-bold text-slate-400 uppercase block">Daily Quiz</span>
                <span className="text-[9.5px] font-extrabold text-slate-800 block">She has gone</span>
              </div>
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            </div>

            {/* Card 5: Lower-Left "Hello! 👋" Bubble */}
            <div className="absolute bottom-24 -left-1 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-2.5 py-1 shadow-md border border-white/80 flex items-center gap-1 text-[11px] font-extrabold text-slate-800">
              <span>Hello!</span>
              <span className="text-xs">👋</span>
            </div>

            {/* Card 6: Lower-Right "Live Practice Room" */}
            <div className="absolute bottom-20 -right-1 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-2 shadow-lg border border-white/80">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                  <span className="text-[9px] font-extrabold text-slate-800">Live Practice</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              </div>
              <div className="flex items-center -space-x-1">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=60&q=80" 
                  alt="Student 1" 
                  className="w-4 h-4 rounded-full border border-white object-cover" 
                />
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=60&q=80" 
                  alt="Student 2" 
                  className="w-4 h-4 rounded-full border border-white object-cover" 
                />
                <img 
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=60&q=80" 
                  alt="Student 3" 
                  className="w-4 h-4 rounded-full border border-white object-cover" 
                />
              </div>
            </div>

            {/* Card 7: Bottom Center "Verified Learner" */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-xl border border-slate-200/90 flex items-center justify-between gap-2 w-[92%] max-w-[280px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-900 block leading-tight">
                    Verified Learner
                  </span>
                  <span className="text-[8px] text-slate-500 block">
                    Fluent Spoken Confidence
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 shrink-0">
                100% Practical
              </span>
            </div>

          </div>

        </div>

        {/* =========================================================================
            BOTTOM BAR: DEVICE COMPATIBILITY & DOMAIN BRANDING (DESKTOP ONLY)
            ========================================================================= */}
        <div className="hidden lg:flex mt-14 pt-6 border-t border-slate-200/80 items-center justify-between gap-4 text-xs">
          
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
