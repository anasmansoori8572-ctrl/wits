import React, { useState } from 'react';
import { CourseData } from '../types';
import { Clock, BookOpen, CheckCircle, ArrowRight, ShieldCheck, Sparkles, Filter } from 'lucide-react';

interface CoursesSectionProps {
  courses: CourseData[];
  onEnroll: (courseId: string) => void;
  onBuyNow?: (courseId: string) => void;
}

export const CoursesSection: React.FC<CoursesSectionProps> = ({ courses, onEnroll, onBuyNow }) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('All');

  const levels = ['All', 'Beginner', 'Beginner to Intermediate', 'Intermediate', 'Advanced'];

  const publishedCourses = courses.filter(c => c.isPublished !== false);

  const filteredCourses = selectedLevel === 'All'
    ? publishedCourses
    : publishedCourses.filter(c => c.level.toLowerCase().includes(selectedLevel.toLowerCase()));

  return (
    <section id="courses" className="py-20 sm:py-24 bg-[#FAF9FC] border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-[#4A1D96] text-xs font-bold uppercase tracking-wider shadow-2xs">
            Curated Programs
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            Practical English Courses
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Designed for learners from schools, colleges, competitive exam preparation, and working professionals looking for real fluency.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A1D96] bg-purple-50 px-4 py-2 rounded-full border border-purple-200 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Direct Online Enrolment • Live Sessions on Google Meet • Study Notes Included</span>
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-start sm:justify-center overflow-x-auto max-w-full pb-2 sm:pb-0 gap-2 mb-10 sm:mb-12">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                selectedLevel === lvl
                  ? 'bg-[#4A1D96] text-white shadow-sm shadow-purple-900/20'
                  : 'bg-white text-slate-600 hover:text-purple-950 border border-slate-200 hover:border-purple-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-purple-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
            >
              {/* Card Header with Level & Badge */}
              <div className="p-5 sm:p-7 pb-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-[#4A1D96] border border-purple-100">
                    {course.level}
                  </span>
                  {course.badge?.toLowerCase() === 'live' ? (
                    <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  ) : course.badge?.toLowerCase() === 'upcoming' ? (
                    <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Upcoming
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="font-['Outfit'] text-xl font-bold text-[#1E1B26] group-hover:text-[#4A1D96] transition-colors leading-snug break-words">
                    {course.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed break-words">
                    {course.shortDescription}
                  </p>
                </div>

                {/* Course Metadata (Duration & Learning Format) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3.5 border-y border-slate-100 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Duration</span>
                      <span className="font-bold text-slate-800 text-xs leading-snug block break-words whitespace-normal">{course.duration}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Format</span>
                      <span className="font-bold text-slate-800 text-xs leading-snug block break-words whitespace-normal">{course.learningFormat}</span>
                    </div>
                  </div>
                </div>

                {/* What you will learn checklist */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    What You Will Learn
                  </span>
                  <ul className="space-y-2">
                    {course.whatYouWillLearn.map((item, i) => (
                      <li key={i} className="flex items-start text-xs text-slate-600 leading-relaxed">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Footer: Fee & Action */}
              <div className="p-5 sm:p-7 pt-4 bg-slate-50/70 border-t border-slate-100 mt-auto flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Course Fee
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-['Outfit'] text-2xl font-black text-[#3B0764]">
                      ₹{course.fee.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">/ full course</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {course.badge?.toLowerCase() === 'live' ? (
                    <button
                      onClick={() => (onBuyNow ? onBuyNow(course.id) : onEnroll(course.id))}
                      id={`course-buy-${course.id}`}
                      className="px-5 py-2.5 rounded-full bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold tracking-wide shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Buy Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled
                      id={`course-upcoming-${course.id}`}
                      className="px-5 py-2.5 rounded-full bg-slate-100 text-slate-400 text-xs font-bold tracking-wide cursor-not-allowed border border-slate-200 flex items-center gap-1.5"
                      title="Admissions opening soon for upcoming courses"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Upcoming Soon</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Confirmation Banner */}
        <div className="mt-14 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A1D96] flex items-center justify-center font-bold flex-shrink-0 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm sm:text-base">
                Instant Seat Allocation & Payment Verification
              </p>
              <p className="text-slate-500 mt-0.5 leading-relaxed">
                Seats are confirmed immediately upon successful fee payment via Razorpay, UPI, or Direct Bank Transfer.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const firstLive = courses.find(c => c.badge?.toLowerCase() === 'live') || courses[0];
                if (firstLive) {
                  if (onBuyNow) onBuyNow(firstLive.id);
                  else onEnroll(firstLive.id);
                }
              }}
              className="px-6 py-2.5 bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-2"
            >
              <span>Buy Course Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
