import React, { useMemo } from 'react';
import { Quote, Star } from 'lucide-react';
import { TestimonialData } from '../types';

interface ReviewsSectionProps {
  testimonials?: TestimonialData[];
}

const AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80'
];

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ testimonials = [] }) => {
  const marqueedTestimonials = useMemo(() => {
    if (!testimonials || testimonials.length === 0) return [];
    let list = [...testimonials];
    while (list.length < 6) {
      list = [...list, ...testimonials];
    }
    return [...list, ...list];
  }, [testimonials]);

  return (
    <section id="about-reviews" className="py-14 sm:py-16 lg:py-20 bg-[#FAF9FC] border-b border-purple-100/60 relative overflow-hidden scroll-mt-16">
      <div id="reviews" className="absolute -top-20" />
      <div id="testimonials" className="absolute -top-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14 space-y-2.5">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#6D28D9]">
            <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
            <span>Our Experiences</span>
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B26] tracking-tight">
            Trusted By Global{' '}
            <span className="font-['Playfair_Display'] italic font-bold text-[#4A1D96]">
              Learners &amp; Students
            </span>
          </h2>
        </div>
      </div>

      {/* Empty State or Continuous Slide-Left Animation Marquee */}
      {marqueedTestimonials.length === 0 ? (
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-3xl border border-dashed border-purple-200 space-y-3 shadow-xs">
          <Quote className="w-8 h-8 text-purple-400 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">No student reviews published yet</p>
          <p className="text-xs text-slate-500">
            Authentic reviews from our English learners will appear here soon.
          </p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden py-3">
          <div className="animate-slide-left flex gap-6 sm:gap-8">
            {marqueedTestimonials.map((item, idx) => {
              const avatar = item.avatar || AVATAR_IMAGES[idx % AVATAR_IMAGES.length];
              return (
                <div 
                  key={`${item.id || idx}-${idx}`}
                  className="w-[330px] sm:w-[420px] md:w-[480px] flex-shrink-0 bg-white rounded-3xl p-7 sm:p-9 shadow-xs hover:shadow-xl transition-all duration-300 border border-slate-200/80 flex flex-col justify-between space-y-6 group"
                >
                  {/* Quote Text */}
                  <p className="text-slate-600 text-sm sm:text-[14.5px] leading-relaxed italic line-clamp-4">
                    &ldquo;{item.testimonial}&rdquo;
                  </p>

                  {/* Bottom Row: User Avatar + Name + 5 Stars */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-100 border-2 border-purple-200 shrink-0">
                        <img 
                          src={avatar}
                          alt={item.studentName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-['Outfit'] font-bold text-sm text-[#1E1B26] truncate group-hover:text-[#4A1D96] transition-colors">
                          {item.studentName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {item.courseBatch || 'English Learner'} &bull; {item.city || 'India'}
                        </p>
                      </div>
                    </div>

                    {/* 5 Stars Rating */}
                    <div className="flex items-center gap-1 text-amber-400 shrink-0 ml-3">
                      {[...Array(Math.min(5, Math.max(1, Number(item.rating) || 5)))].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
