import React from 'react';
import { Quote, MapPin, CheckCircle } from 'lucide-react';

export const FounderSection: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-gradient-to-b from-white to-[#FAF9FC] border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-12 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          
          {/* Subtle background glow */}
          <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-purple-100/40 rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 items-center">
            
            {/* Founder Avatar / Portrait Card */}
            <div className="md:col-span-4 flex flex-col items-center text-center space-y-3">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-[#3B0764] via-[#4A1D96] to-[#1E1B26] p-1.5 shadow-xl shadow-purple-950/10 relative">
                <div className="w-full h-full rounded-2xl bg-purple-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white border border-purple-300/30">
                  <span className="font-['Outfit'] font-black text-4xl sm:text-5xl tracking-tight text-white">
                    ZRZ
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-purple-200 mt-1">
                    Founder
                  </span>
                </div>
                <div className="absolute -bottom-3 bg-purple-900 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md border border-purple-700">
                  Wits Lingo Academy
                </div>
              </div>

              <div className="pt-2">
                <h3 className="font-['Outfit'] font-extrabold text-xl sm:text-2xl text-[#1E1B26]">
                  Ziyaur Rehman Zia
                </h3>
                <p className="text-xs font-semibold text-[#581C87] mt-0.5">
                  Founder & Director, Wits Lingo Academy
                </p>
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-600" />
                  <span>Amroha, Uttar Pradesh, India</span>
                </p>
              </div>
            </div>

            {/* Vision Statement */}
            <div className="md:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#4A1D96] text-xs font-bold uppercase tracking-wider border border-purple-200/80 shadow-2xs">
                Founder's Vision
              </div>

              <div className="relative">
                <Quote className="w-8 h-8 text-purple-200 absolute -top-4 -left-2 -z-10" />
                <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-medium italic pt-2">
                  “Wits Lingo was built with the vision of making practical language learning accessible to learners who want to improve not only their English knowledge, but also their ability to communicate confidently.”
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Practical speaking focus, zero rote rules</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Accessible to small-town & village learners</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Interactive live classes with personal attention</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Continuous guidance via live & digital sessions</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
