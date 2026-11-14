import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Brain, Compass, Smile, Sparkles, ChevronRight, ArrowUpRight } from 'lucide-react';

interface AboutSectionProps {
  onNavigateAbout?: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onNavigateAbout }) => {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const learningSteps = [
    {
      step: '01',
      title: 'Learn',
      desc: 'Acquire real-life words and useful expressions in meaningful contexts.',
      icon: BookOpen,
      badgeColor: 'text-[#4A1D96] bg-purple-50 border-purple-200/80',
      iconBg: 'bg-gradient-to-br from-purple-100 to-purple-50 text-[#4A1D96] border-purple-200/60',
      accentGlow: 'hover:border-purple-300 hover:shadow-purple-950/8',
      stepPillColor: 'text-[#4A1D96] hover:bg-purple-50',
    },
    {
      step: '02',
      title: 'Understand',
      desc: 'Grasp the underlying concept and natural structure without robotic memorisation.',
      icon: Brain,
      badgeColor: 'text-[#581C87] bg-indigo-50 border-indigo-200/80',
      iconBg: 'bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-800 border-indigo-200/60',
      accentGlow: 'hover:border-indigo-300 hover:shadow-indigo-950/8',
      stepPillColor: 'text-[#581C87] hover:bg-indigo-50',
    },
    {
      step: '03',
      title: 'Practise',
      desc: 'Participate in guided drills, audio roleplays, and interactive conversational scenarios.',
      icon: Compass,
      badgeColor: 'text-[#6D28D9] bg-violet-50 border-violet-200/80',
      iconBg: 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-800 border-violet-200/60',
      accentGlow: 'hover:border-violet-300 hover:shadow-violet-950/8',
      stepPillColor: 'text-[#6D28D9] hover:bg-violet-50',
    },
    {
      step: '04',
      title: 'Speak',
      desc: 'Shed hesitation and articulate thoughts out loud in interactive live sessions.',
      icon: Smile,
      badgeColor: 'text-emerald-800 bg-emerald-50 border-emerald-200/80',
      iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-200/60',
      accentGlow: 'hover:border-emerald-300 hover:shadow-emerald-950/8',
      stepPillColor: 'text-emerald-700 hover:bg-emerald-50',
    },
    {
      step: '05',
      title: 'Grow',
      desc: 'Transform into a spontaneous, self-assured, and confident English communicator.',
      icon: Sparkles,
      badgeColor: 'text-purple-900 bg-purple-50 border-purple-200/80',
      iconBg: 'bg-gradient-to-br from-fuchsia-100 to-purple-50 text-purple-900 border-purple-200/60',
      accentGlow: 'hover:border-purple-300 hover:shadow-purple-950/8',
      stepPillColor: 'text-[#3B0764] hover:bg-purple-50',
    },
  ];

  return (
    <section 
      id="about" 
      className="relative py-20 sm:py-24 lg:py-28 bg-[#FCFAFF] border-b border-slate-200/70 overflow-hidden"
    >
      {/* Subtle Background Visual Depth */}
      <div 
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-purple-200/20 blur-3xl pointer-events-none -translate-y-1/2" 
        aria-hidden="true" 
      />
      <div 
        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-indigo-200/20 blur-3xl pointer-events-none translate-y-1/2" 
        aria-hidden="true" 
      />
      <div 
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(147,51,234,0.05),transparent_70%)] pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Scroll Entrance Animations */}
        <motion.div 
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-3xl mx-auto text-center space-y-3.5"
        >
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/90 border border-purple-200/80 text-xs font-bold text-[#4A1D96] uppercase tracking-wider shadow-xs backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4A1D96] animate-pulse" />
            <span>About Wits Lingo</span>
          </div>

          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight leading-tight">
            Language Education Made{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4A1D96] via-[#6D28D9] to-[#7C3AED]">
              Practical, Accessible
            </span>{' '}
            and Engaging
          </h2>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            A practical language academy focused on natural concept understanding, active conversation, and real-world speaking confidence.
          </p>
        </motion.div>

        {/* 5-Step Connected Progression: Learn → Understand → Practise → Speak → Grow */}
        <div className="mt-16 sm:mt-20">
          
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
            className="text-center mb-10 sm:mb-12"
          >
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#581C87] bg-purple-100/50 px-3 py-1 rounded-full border border-purple-200/60 mb-3">
              Our Core Learning Framework
            </span>

            {/* Visual Interactive Flow Track */}
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2.5 flex-wrap p-2.5 sm:p-3 bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-full border border-purple-100/90 shadow-xs">
              {learningSteps.map((item, idx) => {
                const isHovered = activeStepIndex === idx;
                return (
                  <React.Fragment key={item.title}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveStepIndex(idx)}
                      onMouseLeave={() => setActiveStepIndex(null)}
                      onClick={() => setActiveStepIndex(idx === activeStepIndex ? null : idx)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold font-['Outfit'] transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-[#4A1D96] text-white shadow-xs scale-105'
                          : `${item.stepPillColor} hover:scale-102`
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-semibold opacity-75 ${isHovered ? 'text-purple-200' : ''}`}>
                        {item.step}
                      </span>
                      <span>{item.title}</span>
                    </button>
                    
                    {idx < learningSteps.length - 1 && (
                      <span className="text-purple-300 font-bold text-xs sm:text-sm select-none px-0.5">
                        →
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </motion.div>

          {/* 5 Dynamic Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4.5 sm:gap-5">
            {learningSteps.map((item, idx) => {
              const Icon = item.icon;
              const isHovered = activeStepIndex === idx;

              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ 
                    duration: 0.45, 
                    delay: idx * 0.08, 
                    ease: 'easeOut' 
                  }}
                  onMouseEnter={() => setActiveStepIndex(idx)}
                  onMouseLeave={() => setActiveStepIndex(null)}
                  className={`group relative bg-white/90 backdrop-blur-xs rounded-2xl p-5.5 sm:p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                    isHovered
                      ? 'border-purple-300 -translate-y-1.5 shadow-xl shadow-purple-950/8 ring-2 ring-purple-400/20'
                      : 'border-slate-200/80 hover:border-purple-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-950/5'
                  }`}
                >
                  {/* Subtle top card accent indicator */}
                  <div 
                    className={`absolute top-0 left-6 right-6 h-[2px] rounded-full transition-opacity duration-300 ${
                      isHovered ? 'opacity-100 bg-gradient-to-r from-transparent via-[#4A1D96] to-transparent' : 'opacity-0'
                    }`} 
                  />

                  <div className="space-y-4">
                    {/* Card Header: Step Number & Icon */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-black tracking-wider text-purple-600 bg-purple-50/80 border border-purple-100 group-hover:bg-[#4A1D96] group-hover:text-white group-hover:border-[#4A1D96] transition-colors duration-200">
                        {item.step}
                      </span>

                      <div className={`w-10 h-10 rounded-xl ${item.iconBg} border flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-2xs`}>
                        <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-105" />
                      </div>
                    </div>

                    {/* Step Title & Description */}
                    <div className="space-y-1.5">
                      <h3 className="font-['Outfit'] text-lg sm:text-xl font-bold text-[#1E1B26] group-hover:text-[#4A1D96] transition-colors duration-200 flex items-center justify-between">
                        <span>{item.title}</span>
                        <ChevronRight className="w-4 h-4 text-purple-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      </h3>
                      
                      <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Micro-Action */}
                  <div className="pt-4 mt-4 border-t border-slate-100/90 flex items-center justify-between text-[11px] font-semibold text-[#4A1D96]">
                    <span className="text-slate-400 group-hover:text-[#4A1D96] transition-colors">Framework Stage</span>
                    <span className="inline-flex items-center gap-0.5 text-purple-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Explore</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {onNavigateAbout && (
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={onNavigateAbout}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#281648] hover:bg-[#3C166D] text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-950/20 transition-all active:scale-95 cursor-pointer group"
              >
                <span>Read Full About Us Story &amp; Mission</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>

      </div>
    </section>
  );
};



