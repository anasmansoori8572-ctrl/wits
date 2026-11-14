import React from 'react';
import { 
  MessageSquare, BookOpen, MessagesSquare, PenTool, 
  Headphones, Target, Globe, Users, Sparkles, ExternalLink 
} from 'lucide-react';

interface WhatWeTeachProps {
  onSelectSubject?: (subject: string) => void;
  onOpenAdmission?: () => void;
}

export const WhatWeTeach: React.FC<WhatWeTeachProps> = () => {
  const learningPillars = [
    {
      id: 'spoken-english',
      title: 'Spoken English',
      subtitle: 'Daily Fluency Framework',
      description: 'Develop practical speaking skills for everyday communication and spontaneous expression.',
      icon: MessageSquare,
      gradient: 'from-violet-500 via-purple-600 to-indigo-700',
      tag: 'Core Focus',
      stats: '150+ Enrolled',
      badgeMetric: 'Live Practice',
      examples: ['Overcoming Hesitation', 'Fluency Drills', 'Spontaneous Speaking']
    },
    {
      id: 'vocabulary',
      title: 'Vocabulary',
      subtitle: 'Thematic Word Mastery',
      description: 'Learn useful words, collocations, and idioms to understand how to use them naturally.',
      icon: BookOpen,
      gradient: 'from-indigo-500 via-purple-600 to-pink-600',
      tag: 'Practical Usage',
      stats: '120+ Enrolled',
      badgeMetric: 'Active Memory',
      examples: ['High-Frequency Words', 'Everyday Collocations', 'Idiomatic Expressions']
    },
    {
      id: 'conversation',
      title: 'Conversation',
      subtitle: 'Situational Dialogues',
      description: 'Practise real-life conversations, role-plays, and simulated everyday situations.',
      icon: MessagesSquare,
      gradient: 'from-purple-500 via-fuchsia-600 to-violet-700',
      tag: 'Interactive',
      stats: '140+ Enrolled',
      badgeMetric: '1-on-1 & Group',
      examples: ['Small Talk', 'Situational Dialogues', 'Peer Practice']
    },
    {
      id: 'grammar',
      title: 'Grammar',
      subtitle: 'Tenses & Syntax Simplified',
      description: 'Understand sentence patterns through simple, practical examples without rote rules.',
      icon: PenTool,
      gradient: 'from-amber-500 via-purple-600 to-indigo-600',
      tag: 'Rule-Free Context',
      stats: '135+ Enrolled',
      badgeMetric: 'Practical Logic',
      examples: ['Sentence Patterns', 'Tenses in Daily Life', 'Error Elimination']
    },
    {
      id: 'listening-pronunciation',
      title: 'Pronunciation',
      subtitle: 'Audio Clarity & Accent',
      description: 'Improve comprehension, pronunciation, mouth positioning, and natural speech rhythm.',
      icon: Headphones,
      gradient: 'from-emerald-500 via-teal-600 to-purple-700',
      tag: 'Audio Clarity',
      stats: '110+ Enrolled',
      badgeMetric: 'Ear & Voice Training',
      examples: ['MTI Reduction', 'Phonetics & Intonation', 'Clear Articulation']
    },
    {
      id: 'communication-skills',
      title: 'Communication',
      subtitle: 'Confidence & Leadership',
      description: 'Build confidence and express thoughts clearly in interviews, presentations, and public forums.',
      icon: Target,
      gradient: 'from-rose-500 via-purple-600 to-violet-700',
      tag: 'Confidence',
      stats: '160+ Enrolled',
      badgeMetric: 'Career & Interviews',
      examples: ['Self-Expression', 'Public Speaking', 'Interview Preparedness']
    },
  ];

  return (
    <section id="what-we-teach" className="py-20 sm:py-24 bg-[#FAF9FC] border-b border-purple-100/70 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-xs font-bold text-[#4A1D96] uppercase tracking-wider shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Comprehensive Curriculum</span>
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            What We Teach
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            A practical, multi-dimensional curriculum focused on real-world English communication rather than passive classroom theory.
          </p>
        </div>

        {/* 6 Cards Grid (Matches Reference Layout with Wits Lingo Theme) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {learningPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className="relative bg-gradient-to-b from-[#261042] via-[#1D0C33] to-[#140624] rounded-[28px] p-6 sm:p-7 border border-purple-500/25 hover:border-purple-400/50 shadow-xl shadow-purple-950/20 hover:shadow-2xl hover:shadow-purple-900/30 transition-all duration-300 group hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden"
              >
                {/* Subtle top ambient sheen */}
                <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none rounded-t-[28px]" />

                <div className="relative z-10 space-y-3.5">
                  
                  {/* Top Bar (Matching globe/icons on left and stats on right in reference image) */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white/10 border border-purple-400/20 flex items-center justify-center text-purple-200">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-300/80 bg-white/5 border border-purple-400/20 px-2.5 py-0.5 rounded-full">
                        {pillar.tag}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple-200/80">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>{pillar.stats}</span>
                    </div>
                  </div>

                  {/* Centered Circular Emblem (Matching the reference image avatar) */}
                  <div className="pt-2 text-center">
                    <div className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full mx-auto p-1 bg-gradient-to-br ${pillar.gradient} border border-purple-400/30 shadow-lg shadow-purple-950/40 flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                      <div className="w-full h-full rounded-full bg-[#18082D] flex items-center justify-center text-white">
                        <Icon className="w-8 h-8 text-purple-200 group-hover:text-white transition-colors" />
                      </div>
                    </div>

                    {/* Punchy Bold Title (Matching "MAGIK" in reference image) */}
                    <h3 className="font-['Outfit'] font-black text-xl sm:text-2xl text-white tracking-wide text-center mt-3.5 group-hover:text-purple-200 transition-colors uppercase">
                      {pillar.title}
                    </h3>

                    {/* Subtitle (Matching "Magikarp ❐" in reference image) */}
                    <div className="text-xs text-purple-300/80 font-medium text-center flex items-center justify-center gap-1 mt-1">
                      <span>{pillar.subtitle}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </div>

                    {/* Description Text (Matching description in reference image) */}
                    <p className="text-xs sm:text-[13px] text-purple-100/80 text-center mt-2.5 px-2 line-clamp-2 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>

                  {/* 3 Curriculum Highlight Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 pt-3 border-t border-purple-400/15">
                    {pillar.examples.map((ex) => (
                      <span
                        key={ex}
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-purple-400/20 text-[10.5px] font-medium text-purple-200/90 whitespace-nowrap"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>

                </div>

                {/* Bottom Row: Tag & Metric (Matching "MC $10.38m" in reference image) */}
                <div className="relative z-10 mt-4 pt-3 border-t border-purple-400/15 flex items-center justify-between text-xs">
                  <span className="text-purple-300/70 text-[11px] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{pillar.tag}</span>
                  </span>
                  <span className="font-bold text-white group-hover:text-purple-200 transition-colors flex items-center gap-1 text-[11px] font-mono">
                    <span>{pillar.badgeMetric}</span>
                  </span>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
