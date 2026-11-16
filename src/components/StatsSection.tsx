import React from 'react';
import { Award, Users, TrendingUp, Laptop, CheckCircle2, Sparkles, MapPin } from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  const stats = [
    {
      stepNumber: '01',
      mobileSymbol: '①',
      metric: siteSettings?.batchesCompletedCount || '15+',
      label: 'Completed Course Cohorts',
      subtext: 'Proven practical training track record',
      icon: Award,
      // Mobile styles
      mobileBg: 'bg-gradient-to-r from-[#6322BB] via-[#5B1FAF] to-[#4F17A0]',
      mobileShadow: 'shadow-purple-950/30',
      mobileAlignment: 'sm:-translate-x-6 mr-auto sm:rotate-[-0.8deg]',
      // Desktop & Tablet styles (Sticker Wave Design)
      desktopBg: 'bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6]',
      badgeBg: 'bg-[#4C1D95]',
      stampText: 'text-[#5B21B6]',
      desktopOffset: 'lg:-translate-y-6 md:-translate-y-3',
    },
    {
      stepNumber: '02',
      mobileSymbol: '②',
      metric: siteSettings?.activeStudentsCount || '100+',
      label: 'Students Improved Their English',
      subtext: 'From small towns, villages & cities',
      icon: Users,
      // Mobile styles
      mobileBg: 'bg-gradient-to-r from-[#200A40] via-[#1A0736] to-[#14052B]',
      mobileShadow: 'shadow-purple-950/40',
      mobileAlignment: 'sm:translate-x-6 ml-auto sm:rotate-[1deg]',
      // Desktop & Tablet styles (Sticker Wave Design)
      desktopBg: 'bg-gradient-to-br from-[#240A47] via-[#1C0637] to-[#140428]',
      badgeBg: 'bg-[#6B21A8]',
      stampText: 'text-[#240A47]',
      desktopOffset: 'lg:translate-y-8 md:translate-y-4',
    },
    {
      stepNumber: '03',
      mobileSymbol: '③',
      metric: 'Beginner → Advanced',
      label: 'Learner Progress',
      subtext: 'Structured step-by-step curriculum',
      icon: TrendingUp,
      // Mobile styles
      mobileBg: 'bg-gradient-to-r from-[#6322BB] via-[#5B1FAF] to-[#4F17A0]',
      mobileShadow: 'shadow-purple-950/30',
      mobileAlignment: 'sm:-translate-x-4 mr-auto sm:rotate-[-0.6deg]',
      // Desktop & Tablet styles (Sticker Wave Design)
      desktopBg: 'bg-gradient-to-br from-[#6D28D9] via-[#5B21B6] to-[#4C1D95]',
      badgeBg: 'bg-[#3B0764]',
      stampText: 'text-[#4C1D95]',
      desktopOffset: 'lg:-translate-y-6 md:-translate-y-3',
    },
    {
      stepNumber: '04',
      mobileSymbol: '④',
      metric: 'Offline + Online',
      label: 'Flexible Learning',
      subtext: 'Live digital sessions + class recordings',
      icon: Laptop,
      // Mobile styles
      mobileBg: 'bg-gradient-to-r from-[#200A40] via-[#1A0736] to-[#14052B]',
      mobileShadow: 'shadow-purple-950/40',
      mobileAlignment: 'sm:translate-x-5 ml-auto sm:rotate-[0.9deg]',
      // Desktop & Tablet styles (Sticker Wave Design)
      desktopBg: 'bg-gradient-to-br from-[#1C0533] via-[#150327] to-[#0D0119]',
      badgeBg: 'bg-[#7E22CE]',
      stampText: 'text-[#1C0533]',
      desktopOffset: 'lg:translate-y-8 md:translate-y-4',
    },
  ];

  return (
    <section className="relative py-18 sm:py-24 bg-[#FAF9FD] overflow-hidden border-b border-slate-200/80">
      {/* Background Decorative Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.4]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(109, 40, 217, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(109, 40, 217, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px'
        }}
        aria-hidden="true"
      />

      {/* Ambient Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-purple-600/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold uppercase tracking-widest bg-purple-100 text-[#581C87] border border-purple-200 shadow-2xs">
            <Sparkles className="w-3 h-3 text-[#6D28D9]" />
            <span>Our Journey & Accomplishments</span>
          </span>
          <h2 className="font-['Outfit'] text-3xl sm:text-4.5xl lg:text-5xl font-black text-[#140528] tracking-tight leading-tight">
            Real <span className="text-[#6D28D9] italic">Milestones</span>, Genuine <span className="text-[#6D28D9] italic">Impact</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
            Real progress from committed learners breaking hesitation into fluent spoken confidence.
          </p>
        </div>

        {/* =========================================================================
            1. MOBILE VIEW (< md): STAGGERED 4-CARD STACK WITH SINUOUS PURPLE RIBBON
            ========================================================================= */}
        <div className="block md:hidden relative max-w-lg mx-auto">
          {/* Continuous Weaving Purple Sinuous Ribbon Trail */}
          <svg
            className="absolute -top-10 -bottom-8 -left-4 -right-4 w-[calc(100%+32px)] h-[calc(100%+72px)] pointer-events-none z-0"
            viewBox="0 0 650 720"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mobileJourneyRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="50%" stopColor="#6D28D9" />
                <stop offset="100%" stopColor="#4C1D95" />
              </linearGradient>
              <filter id="mobileRibbonShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2E1065" floodOpacity="0.25" />
              </filter>
            </defs>

            <path
              d="
                M -30 40
                C 140 30, 220 100, 200 160
                C 180 230, 520 180, 560 270
                C 600 370, 100 340, 110 440
                C 120 540, 530 500, 540 600
                C 550 690, 200 680, 260 760
              "
              stroke="url(#mobileJourneyRibbonGrad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#mobileRibbonShadow)"
            />
          </svg>

          {/* Cards Stack */}
          <div className="relative z-10 space-y-4">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={`mobile-${stat.label}`}
                  className={`
                    w-full p-5 rounded-2xl
                    ${stat.mobileBg} text-white
                    shadow-xl ${stat.mobileShadow}
                    border border-white/15
                    transition-all duration-300
                    cursor-default
                    ${stat.mobileAlignment}
                  `}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Number circle badge */}
                      <div className="w-8 h-8 rounded-full border-2 border-white/80 bg-white/10 backdrop-blur-xs flex items-center justify-center font-['Outfit'] font-black text-xs text-white shrink-0 shadow-xs">
                        {idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-['Outfit'] font-black text-2xl tracking-tight text-white drop-shadow-xs">
                            {stat.metric}
                          </span>
                          <span className="font-bold text-xs text-purple-100 leading-snug">
                            {stat.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-200/90 mt-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{stat.subtext}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white backdrop-blur-xs shrink-0 shadow-inner">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            2. DESKTOP & TABLET VIEW (>= md): ALTERNATING STICKER CARDS WITH CURVED ARROWS
            ========================================================================= */}
        <div className="hidden md:block relative py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 items-center relative">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={`desktop-${stat.label}`}
                  className={`relative ${stat.desktopOffset} transition-transform duration-300`}
                >
                  {/* Outer White Card Frame with Sticker Aesthetic */}
                  <div className="bg-white rounded-[26px] p-2.5 shadow-xl shadow-purple-950/10 border border-purple-100/90 hover:shadow-2xl hover:border-purple-200 transition-all duration-300 relative group">
                    
                    {/* Top Notch Badge with Number (01, 02, 03, 04) */}
                    <div className={`absolute -top-3.5 left-5 px-3 py-0.5 rounded-full font-['Outfit'] font-black text-[11px] tracking-wider text-white border-2 border-white shadow-md z-20 ${stat.badgeBg}`}>
                      {stat.stepNumber}
                    </div>

                    {/* Inner Colored Card Body */}
                    <div className={`${stat.desktopBg} rounded-[20px] p-5 pt-6 text-white flex flex-col justify-between min-h-[200px] relative overflow-hidden group-hover:scale-[1.01] transition-transform`}>
                      {/* Subtle ambient light */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

                      <div className="space-y-1.5 relative z-10">
                        <span className="font-['Outfit'] font-black text-2.5xl lg:text-3xl text-white tracking-tight block drop-shadow-xs">
                          {stat.metric}
                        </span>
                        <h3 className="font-['Outfit'] font-bold text-sm lg:text-base text-purple-100/95 leading-tight">
                          {stat.label}
                        </h3>
                        <p className="text-xs text-purple-200/80 leading-relaxed pt-1 font-medium">
                          {stat.subtext}
                        </p>
                      </div>

                      {/* Bottom-Right Stamp Icon */}
                      <div className="self-end mt-4 w-9 h-9 rounded-xl bg-white/95 text-slate-800 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                        <Icon className={`w-4.5 h-4.5 stroke-[2.2] ${stat.stampText}`} />
                      </div>
                    </div>
                  </div>

                  {/* Curved Connector Arrows between cards on Desktop (lg:) */}
                  {idx === 0 && (
                    <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-none translate-x-1/2">
                      <svg width="44" height="42" viewBox="0 0 44 42" fill="none" className="drop-shadow-xs">
                        {/* Downward curve arrow from Card 1 to Card 2 */}
                        <path d="M4 10 C 18 10, 26 18, 36 32" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
                        <path d="M28 32 L 36 32 L 36 24" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}

                  {idx === 1 && (
                    <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-none translate-x-1/2">
                      <svg width="44" height="42" viewBox="0 0 44 42" fill="none" className="drop-shadow-xs">
                        {/* Upward curve arrow from Card 2 to Card 3 */}
                        <path d="M4 32 C 18 32, 26 24, 36 10" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
                        <path d="M28 10 L 36 10 L 36 18" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}

                  {idx === 2 && (
                    <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-none translate-x-1/2">
                      <svg width="44" height="42" viewBox="0 0 44 42" fill="none" className="drop-shadow-xs">
                        {/* Downward curve arrow from Card 3 to Card 4 */}
                        <path d="M4 10 C 18 10, 26 18, 36 32" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
                        <path d="M28 32 L 36 32 L 36 24" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Location & Trust Footer */}
        <div className="mt-14 max-w-xl mx-auto text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
          <span className="text-purple-900 font-bold">{siteSettings?.academyName || 'Wits Lingo Academy'}</span>
          <span>•</span>
          <span>{siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh'}</span>
        </div>

      </div>
    </section>
  );
};
