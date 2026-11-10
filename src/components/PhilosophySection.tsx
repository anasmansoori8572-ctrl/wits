import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export const PhilosophySection: React.FC<{ onOpenAdmission: () => void }> = ({ onOpenAdmission }) => {
  const [activeStep, setActiveStep] = useState(2);

  const steps = [
    {
      number: 'Step 1',
      title: 'Words & Phrases',
      desc: 'Build a useful vocabulary.',
      detailedGoal: 'Acquiring active, high-frequency words and expressions used in daily spoken English instead of rare textbook terms.',
      milestone: 'Word Bank & Common Expressions',
      example: '“Look forward to”, “Catch up”, “Make sense”',
      stage: 'Level: Foundation'
    },
    {
      number: 'Step 2',
      title: 'Small Sentences',
      desc: 'Start forming simple sentences.',
      detailedGoal: 'Assembling natural subject-verb combinations without translating word-by-word from your native tongue.',
      milestone: 'Effortless Sentence Construction',
      example: '“I usually review my notes after work.”',
      stage: 'Level: Basic'
    },
    {
      number: 'Step 3',
      title: 'Short Introduction',
      desc: 'Talk about yourself and familiar topics.',
      detailedGoal: 'Overcoming hesitation and speaking with poise about your background, hobbies, profession, and daily life.',
      milestone: 'Confidence & Stage Hesitation Removal',
      example: '“I grew up in Amroha and completed my degree...”',
      stage: 'Level: Intermediate'
    },
    {
      number: 'Step 4',
      title: 'Normal Conversation',
      desc: 'Participate in everyday conversations.',
      detailedGoal: 'Spontaneous dialogues with classmates and native rhythms during telephone calls, meetings, or casual catch-ups.',
      milestone: 'Interactive Dialogue Fluency',
      example: '“That sounds great! When are we scheduling the call?”',
      stage: 'Level: Upper-Intermediate'
    },
    {
      number: 'Step 5',
      title: 'Fluent Communication',
      desc: 'Express thoughts naturally and confidently.',
      detailedGoal: 'Thinking directly in English and expressing complex perspectives, emotions, and professional ideas with precision.',
      milestone: 'Independent, Confident Communicator',
      example: 'Articulating viewpoints in debates, interviews, & presentations',
      stage: 'Level: Confident Speaker'
    }
  ];

  return (
    <section id="philosophy" className="py-20 sm:py-24 bg-gradient-to-b from-white via-purple-50/30 to-white border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-xs font-bold text-[#4A1D96] uppercase tracking-wider shadow-2xs">
            Learning Philosophy
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight leading-tight">
            We Don't Just Teach English. We Help You Use It.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            At Wits Lingo, learning English is not an academic chore of memorising rigid rules. We guide you step-by-step through a natural spoken progression from day one.
          </p>
        </div>

        {/* Visual Progress Pathway: Beginner → Confident Speaker */}
        <div className="mt-14 sm:mt-16 max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-purple-950/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Visual Learning Pathway</span>
              <h3 className="font-['Outfit'] text-xl sm:text-2xl font-bold text-[#1E1B26] mt-0.5">
                Beginner <span className="text-[#4A1D96]">→</span> Confident Speaker
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                5 Practical Stages
              </span>
            </div>
          </div>

          {/* Stepper Buttons Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 mt-6">
            {steps.map((step, idx) => (
              <button
                key={step.number}
                onClick={() => setActiveStep(idx)}
                className={`p-3 rounded-2xl text-left transition-all cursor-pointer border ${
                  idx === 4 ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  activeStep === idx
                    ? 'bg-[#4A1D96] text-white border-[#4A1D96] shadow-md shadow-purple-950/20'
                    : 'bg-slate-50/80 hover:bg-purple-50/60 text-slate-700 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono font-bold uppercase ${activeStep === idx ? 'text-purple-200' : 'text-slate-400'}`}>
                    {step.number}
                  </span>
                  {activeStep === idx && <Sparkles className="w-3 h-3 text-purple-200" />}
                </div>
                <p className="text-xs font-bold leading-snug break-words">{step.title}</p>
              </button>
            ))}
          </div>

          {/* Active Step Showcase Card */}
          <div className="mt-6 p-5 sm:p-7 rounded-2xl bg-purple-50/40 border border-purple-100/90 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-white bg-[#581C87] px-2.5 py-0.5 rounded-md">
                  {steps[activeStep].number}
                </span>
                <span className="text-xs font-semibold text-purple-700">
                  {steps[activeStep].stage}
                </span>
              </div>
              <h4 className="font-['Outfit'] text-2xl font-bold text-[#1E1B26]">
                {steps[activeStep].title} — {steps[activeStep].desc}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {steps[activeStep].detailedGoal}
              </p>
              <div className="p-3.5 bg-white rounded-xl border border-purple-100 text-xs space-y-1 shadow-2xs">
                <span className="font-bold text-slate-700 block">Typical Practice In Class:</span>
                <span className="text-purple-900 font-medium italic">{steps[activeStep].example}</span>
              </div>
            </div>

            <div className="md:col-span-4 bg-white p-5 rounded-2xl border border-purple-100 text-center space-y-3.5 shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center font-bold text-lg shadow-2xs">
                0{activeStep + 1}
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Key Outcome</span>
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  {steps[activeStep].milestone}
                </p>
              </div>
              <button
                onClick={onOpenAdmission}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Join Next Batch
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
