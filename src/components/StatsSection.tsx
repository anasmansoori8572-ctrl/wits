import React from 'react';
import { Award, Users, TrendingUp, Laptop, CheckCircle2, Sparkles, MapPin } from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  const stats = [
    {
      number: '①',
      metric: siteSettings?.batchesCompletedCount || '15+',
      label: 'Completed Course Cohorts',
      subtext: 'Proven practical training track record',
      icon: Award,
      bgClass: 'bg-gradient-to-r from-[#6322BB] via-[#5B1FAF] to-[#4F17A0]',
      shadowColor: 'shadow-purple-950/30',
      alignment: 'sm:-translate-x-6 lg:-translate-x-12 mr-auto sm:rotate-[-0.8deg]',
    },
    {
      number: '②',
      metric: siteSettings?.activeStudentsCount || '100+',
      label: 'Students Improved Their English',
      subtext: 'From small towns, villages & cities',
      icon: Users,
      bgClass: 'bg-gradient-to-r from-[#200A40] via-[#1A0736] to-[#14052B]',
      shadowColor: 'shadow-purple-950/40',
      alignment: 'sm:translate-x-6 lg:translate-x-12 ml-auto sm:rotate-[1deg]',
    },
    {
      number: '③',
      metric: 'Beginner → Advanced',
      label: 'Learner Progress',
      subtext: 'Structured step-by-step curriculum',
      icon: TrendingUp,
      bgClass: 'bg-gradient-to-r from-[#6322BB] via-[#5B1FAF] to-[#4F17A0]',
      shadowColor: 'shadow-purple-950/30',
      alignment: 'sm:-translate-x-4 lg:-translate-x-8 mr-auto sm:rotate-[-0.6deg]',
    },
    {
      number: '④',
      metric: 'Offline + Online',
      label: 'Flexible Learning',
      subtext: 'Live digital sessions + class recordings',
      icon: Laptop,
      bgClass: 'bg-gradient-to-r from-[#200A40] via-[#1A0736] to-[#14052B]',
      shadowColor: 'shadow-purple-950/40',
      alignment: 'sm:translate-x-5 lg:translate-x-10 ml-auto sm:rotate-[0.9deg]',
    },
  ];

  return (
    <section className="relative py-20 sm:py-26 bg-[#FAF9FD] overflow-hidden border-b border-slate-200/80">
      {/* Background Decorative Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.45]"
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading matching Reference Style */}
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
            THE 4 STAGGERED CARDS WITH WINDING PURPLE JOURNEY RIBBON
            ========================================================================= */}
        <div className="relative max-w-2xl mx-auto">
          
          {/* Sinuous Winding Purple Path (SVG Ribbon Trail) */}
          <svg
            className="absolute -top-12 -bottom-10 -left-6 -right-6 w-[calc(100%+48px)] h-[calc(100%+88px)] pointer-events-none z-0"
            viewBox="0 0 650 720"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="journeyRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="50%" stopColor="#6D28D9" />
                <stop offset="100%" stopColor="#4C1D95" />
              </linearGradient>
              <filter id="ribbonShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2E1065" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Continuous Weaving Ribbon Path */}
            <path
              d="
                M -30 40
                C 140 30, 220 100, 200 160
                C 180 230, 520 180, 560 270
                C 600 370, 100 340, 110 440
                C 120 540, 530 500, 540 600
                C 550 690, 200 680, 260 760
              "
              stroke="url(#journeyRibbonGrad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ribbonShadow)"
            />
          </svg>

          {/* Cards Stack */}
          <div className="relative z-10 space-y-4 sm:space-y-5">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`
                    w-full sm:w-[92%] p-5 sm:p-6 sm:px-7 rounded-2xl sm:rounded-3xl
                    ${stat.bgClass} text-white
                    shadow-xl ${stat.shadowColor}
                    border border-white/15
                    transition-all duration-300
                    hover:scale-[1.02] hover:shadow-2xl
                    cursor-default
                    ${stat.alignment}
                  `}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Number circle & Content */}
                    <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
                      {/* Numbered Indicator matching ① ② ③ ④ style */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/80 bg-white/10 backdrop-blur-xs flex items-center justify-center font-['Outfit'] font-black text-sm sm:text-base text-white shrink-0 shadow-xs">
                        {idx + 1}
                      </div>

                      {/* Main Metric & Details */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-['Outfit'] font-black text-2xl sm:text-3.5xl tracking-tight text-white drop-shadow-xs">
                            {stat.metric}
                          </span>
                          <span className="font-bold text-xs sm:text-base text-purple-100 leading-snug">
                            {stat.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-purple-200/90 mt-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{stat.subtext}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Icon Badge */}
                    <div className="hidden xs:flex w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white/10 border border-white/15 items-center justify-center text-white backdrop-blur-xs shrink-0 shadow-inner">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                    </div>
                  </div>
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
