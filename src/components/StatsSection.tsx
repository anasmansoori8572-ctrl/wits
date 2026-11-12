import React from 'react';
import { Award, Users, TrendingUp, Laptop, CheckCircle2 } from 'lucide-react';
import { SiteSettings } from '../types';

interface StatsSectionProps {
  siteSettings?: SiteSettings;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ siteSettings }) => {
  const stats = [
    {
      metric: siteSettings?.batchesCompletedCount || '15+',
      label: 'Completed Course Cohorts',
      subtext: 'Proven practical training track record',
      icon: Award,
    },
    {
      metric: siteSettings?.activeStudentsCount || '100+',
      label: 'Students Improved Their English',
      subtext: 'From small towns, villages & cities',
      icon: Users,
    },
    {
      metric: 'Beginner → Advanced',
      label: 'Learner Progress',
      subtext: 'Structured step-by-step curriculum',
      icon: TrendingUp,
    },
    {
      metric: 'Offline + Online',
      label: 'Flexible Learning',
      subtext: 'Live digital sessions + class recordings',
      icon: Laptop,
    },
  ];

  return (
    <section className="py-18 sm:py-22 bg-[#FAF9FD] border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14 space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-widest text-[#581C87]">
            Our Journey & Accomplishments
          </span>
          <h2 className="font-['Outfit'] text-2xl sm:text-3.5xl font-extrabold text-[#1E1B26] tracking-tight">
            Real Milestones, Genuine Impact
          </h2>
        </div>

        {/* 4 Clean Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-200 transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
              >
                <div className="space-y-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A1D96] flex items-center justify-center border border-purple-100 shadow-2xs group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-['Outfit'] font-extrabold text-3xl sm:text-3.5xl text-[#3B0764] tracking-tight block">
                      {stat.metric}
                    </span>
                    <h3 className="font-bold text-sm text-slate-800 mt-1 leading-snug">
                      {stat.label}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>{stat.subtext}</span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Location & Trust Footer */}
        <div className="mt-10 max-w-xl mx-auto text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <span className="text-purple-800 font-bold">{siteSettings?.academyName || 'Wits Lingo Academy'}</span>
          <span>•</span>
          <span>{siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh'}</span>
        </div>

      </div>
    </section>
  );
};
