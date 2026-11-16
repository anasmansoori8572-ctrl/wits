import React from 'react';
import { Sparkles, MapPin } from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  return (
    <section className="relative py-16 sm:py-24 bg-[#F8F7F4] overflow-hidden border-b border-slate-200/80 font-['Plus_Jakarta_Sans']">
      {/* Background Subtle Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(109, 40, 217, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(109, 40, 217, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
        aria-hidden="true"
      />

      {/* Ambient Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold uppercase tracking-widest bg-purple-100 text-[#581C87] border border-purple-200 shadow-2xs">
            <Sparkles className="w-3 h-3 text-[#6D28D9]" />
            <span>Our Journey & Accomplishments</span>
          </span>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-black text-[#140528] tracking-tight leading-tight">
            Real <span className="text-[#6D28D9] italic">Milestones</span>, Genuine <span className="text-[#6D28D9] italic">Impact</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
            Practical language learning that breaks hesitation into fluent spoken confidence.
          </p>
        </div>

        {/* =========================================================================
            FEATURE SHOWCASE: EXACT DESIGN VISUAL (TRANSFORMING LIVES THROUGH ENGLISH)
            ========================================================================= */}
        <div className="relative max-w-4xl mx-auto">
          {/* Framed Display Card matching Image Aesthetic */}
          <div className="relative rounded-3xl sm:rounded-[36px] overflow-hidden bg-[#F6F5F2] border border-slate-300/80 shadow-2xl shadow-purple-950/15 group">
            <img
              src="/our-journey-accomplishments.jpg"
              alt="Transforming Lives Through English - Real Milestones, Genuine Impact"
              className="w-full h-auto object-contain block select-none transform transition-transform duration-700 group-hover:scale-[1.01]"
              loading="eager"
            />

            {/* Seamless Wits Lingo Custom Branding Badge covering bottom-right domain */}
            <div 
              className="absolute bottom-[2%] right-[2%] sm:bottom-[2.5%] sm:right-[2.5%] flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[#EAE8E2] text-[#240A47] font-['Outfit'] font-extrabold text-[11px] sm:text-xs shadow-xs border border-[#DFDDD6]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>witslingo.com</span>
            </div>
          </div>
        </div>

        {/* Location & Trust Footer */}
        <div className="mt-12 max-w-xl mx-auto text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
          <span className="text-purple-900 font-bold">{siteSettings?.academyName || 'Wits Lingo Academy'}</span>
          <span>•</span>
          <span>{siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh'}</span>
        </div>

      </div>
    </section>
  );
};
