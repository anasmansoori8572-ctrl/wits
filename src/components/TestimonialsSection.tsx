import React from 'react';
import { TestimonialData } from '../types';
import { Quote, Star, MapPin, Sparkles } from 'lucide-react';

interface TestimonialsSectionProps {
  testimonials: TestimonialData[];
  onOpenAdmission: () => void;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ testimonials }) => {
  return (
    <section id="testimonials" className="py-20 sm:py-24 bg-white border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-xs font-bold uppercase tracking-wider text-[#581C87] shadow-2xs">
            Student Stories
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            Real Experiences, Real Confidence
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Hear from students who overcame their fear of English and developed fluent communication through Wits Lingo Academy.
          </p>
        </div>

        {/* Testimonials List */}
        {testimonials && testimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50/70 hover:bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 hover:border-purple-200 shadow-xs hover:shadow-lg hover:shadow-purple-950/5 transition-all duration-200 flex flex-col justify-between relative group hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center shadow-2xs">
                      <Quote className="w-4 h-4" />
                    </div>
                    <div className="flex text-amber-400 gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed italic">
                    “{item.testimonial}”
                  </p>
                </div>

                <div className="pt-5 mt-6 border-t border-slate-200/60 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#4A1D96] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {item.studentName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-[#1E1B26] break-words leading-snug">
                      {item.studentName}
                    </h4>
                    <p className="text-[11px] text-purple-800 font-semibold break-words leading-snug">
                      {item.courseBatch}
                    </p>
                    {item.city && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{item.city}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 space-y-3">
            <Sparkles className="w-8 h-8 text-purple-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">New Testimonials Updating Soon</h3>
            <p className="text-xs text-slate-500">
              Verified reviews from our upcoming batch graduates will appear here shortly.
            </p>
          </div>
        )}



      </div>
    </section>
  );
};
