import React, { useState } from 'react';
import { CourseData } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  Clock, CheckCircle, ArrowRight, X, Sparkles, 
  BookOpen, ShieldCheck, Video, HelpCircle, MessageSquare, ChevronRight
} from 'lucide-react';

interface CoursesSectionProps {
  courses: CourseData[];
  onEnroll: (courseId: string) => void;
  onBuyNow?: (courseId: string) => void;
}

const DEFAULT_COURSE_IMAGES: Record<string, string> = {
  'course-foundation': 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80',
  'course-spoken-english': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
  'course-vocabulary': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
  'course-conversation': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
  'course-communication': 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
  'course-advanced': 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
};

const FALLBACK_COURSE_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80';

export const CoursesSection: React.FC<CoursesSectionProps> = ({ courses, onEnroll, onBuyNow }) => {
  const [selectedTagFilter, setSelectedTagFilter] = useState<'All' | 'Live' | 'Upcoming'>('All');
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<CourseData | null>(null);

  // Lock background scroll when Course Details modal is open
  useScrollLock(selectedCourseForDetails !== null);

  const publishedCourses = courses.filter(c => c.isPublished !== false);

  const filteredCourses = publishedCourses.filter(c => {
    if (selectedTagFilter === 'All') return true;
    const badge = (c.badge || '').toLowerCase();
    if (selectedTagFilter === 'Live') return badge === 'live';
    if (selectedTagFilter === 'Upcoming') return badge === 'upcoming';
    return true;
  });

  const handleCardClick = (course: CourseData) => {
    setSelectedCourseForDetails(course);
  };

  const handleDirectBuy = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (onBuyNow) {
      onBuyNow(courseId);
    } else {
      onEnroll(courseId);
    }
  };

  return (
    <section id="courses" className="py-20 sm:py-24 bg-[#FAF9FC] border-b border-purple-100/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* =========================================================================
            SECTION HEADER (Matches Reference Image "Our Courses")
            ========================================================================= */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 sm:mb-14">
          {/* Top Pill / Kicker with arrow accent */}
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#6D28D9]">
            <span className="flex items-center text-[10px] tracking-normal font-black text-[#6D28D9]">&#9658;&#9658;</span>
            <span>Courses</span>
          </div>

          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B26] tracking-tight">
            Our Courses
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Our team of experienced and certified instructors is committed to helping you achieve fluency and confidence in English.
          </p>

          {/* Filter Pills (All / Live / Upcoming - strictly aligning with the 2 allowed tags) */}
          <div className="pt-4 flex items-center justify-center gap-2">
            {(['All', 'Live', 'Upcoming'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedTagFilter(filter)}
                className={`px-4 sm:px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedTagFilter === filter
                    ? 'bg-[#281648] text-white shadow-md shadow-purple-950/20'
                    : 'bg-white text-slate-600 hover:text-[#281648] border border-slate-200 hover:border-purple-200'
                }`}
              >
                {filter === 'All' ? 'All Courses' : `${filter} Courses`}
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================================
            COURSES GRID (Matches First Reference Image: Text Top, Image Bottom, Clean Metadata)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 sm:gap-8">
          {filteredCourses.map((course) => {
            const isLive = (course.badge || '').toLowerCase() === 'live';
            const courseImage = course.imageUrl || DEFAULT_COURSE_IMAGES[course.id] || FALLBACK_COURSE_IMAGE;

            return (
              <div
                key={course.id}
                onClick={() => handleCardClick(course)}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-purple-200/90 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1 cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(course); }}
              >
                {/* 1. TOP CONTENT AREA (Name, Duration, Price, Tag, Action Button) */}
                <div className="p-6 sm:p-7 space-y-4">
                  {/* Top Row: ONLY Tag (Live or Upcoming) */}
                  <div className="flex items-center justify-between gap-2">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Upcoming</span>
                      </span>
                    )}

                    {/* Quick Metadata Indicator */}
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                      Google Meet Live
                    </span>
                  </div>

                  {/* Course Name */}
                  <h3 className="font-['Outfit'] text-xl sm:text-2xl font-extrabold text-[#1E1B26] group-hover:text-[#4A1D96] transition-colors leading-snug">
                    {course.name}
                  </h3>

                  {/* Clean Metadata: Duration & Price Only */}
                  <div className="pt-1 flex items-center justify-between gap-3 text-xs border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="font-semibold text-slate-700">{course.duration}</span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className="font-['Outfit'] text-xl sm:text-2xl font-black text-[#281648]">
                          ₹{course.fee.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">/ full course</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Pill Button (Matches Green Pill in Reference Image, in Theme Royal Purple) */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full bg-[#281648] group-hover:bg-[#4A1D96] text-white text-[11px] sm:text-xs font-bold tracking-wider uppercase transition-all shadow-md shadow-purple-950/15">
                      <span>Learn More</span>
                      <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </span>

                    {isLive && (
                      <button
                        type="button"
                        onClick={(e) => handleDirectBuy(e, course.id)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Direct instant purchase"
                      >
                        <span>Buy Now</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. BOTTOM IMAGE (Matches Reference Image with Decorative Corner Squares) */}
                <div className="relative w-full h-48 sm:h-52 overflow-hidden bg-purple-100 mt-2">
                  <img
                    src={courseImage}
                    alt={course.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Subtle Gradient Shade at top of image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

                  {/* Decorative Geometric Overlay Tiles (Signature Touch from Reference Image) */}
                  <div className="absolute bottom-3 right-3 flex gap-1 pointer-events-none opacity-85 z-10" aria-hidden="true">
                    <div className="w-3 h-3 bg-white/95 backdrop-blur-xs rounded-xs shadow-xs" />
                    <div className="w-3 h-3 bg-white/80 backdrop-blur-xs rounded-xs shadow-xs translate-y-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* =========================================================================
            PAYMENT CONFIRMATION BANNER
            ========================================================================= */}
        <div className="mt-14 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#4A1D96] flex items-center justify-center font-bold flex-shrink-0 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm sm:text-base">
                Instant Seat Allocation &amp; Payment Verification
              </p>
              <p className="text-slate-500 mt-0.5 leading-relaxed">
                Seats are confirmed immediately upon successful fee payment via Razorpay, UPI, or Direct Bank Transfer.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const firstLive = courses.find(c => (c.badge || '').toLowerCase() === 'live') || courses[0];
                if (firstLive) {
                  if (onBuyNow) onBuyNow(firstLive.id);
                  else onEnroll(firstLive.id);
                }
              }}
              className="px-6 py-2.5 bg-[#281648] hover:bg-[#3C166D] text-white font-bold rounded-full transition-colors whitespace-nowrap cursor-pointer shadow-md shadow-purple-950/20 flex items-center gap-2"
            >
              <span>Buy Course Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          COURSE DETAILS MODAL (Opens upon clicking any Course Card)
          ========================================================================= */}
      {selectedCourseForDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedCourseForDetails(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden relative animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Cover Image */}
            <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-purple-950 shrink-0">
              <img
                src={selectedCourseForDetails.imageUrl || DEFAULT_COURSE_IMAGES[selectedCourseForDetails.id] || FALLBACK_COURSE_IMAGE}
                alt={selectedCourseForDetails.name}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1F0933]/90 via-[#1F0933]/40 to-transparent" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedCourseForDetails(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-sm z-20"
                aria-label="Close Course Details"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Tag & Title in Banner */}
              <div className="absolute bottom-4 left-5 right-5 text-white z-10">
                <div className="flex items-center gap-2 mb-1.5">
                  {(selectedCourseForDetails.badge || '').toLowerCase() === 'live' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Live Course
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                      <Clock className="w-3 h-3" />
                      Upcoming Course
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-200 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                    Wits Lingo Academy
                  </span>
                </div>

                <h3 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {selectedCourseForDetails.name}
                </h3>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-slate-700">
              
              {/* Short Description */}
              <div className="bg-purple-50/70 rounded-2xl p-4 border border-purple-100">
                <p className="text-xs sm:text-sm text-purple-950 font-medium leading-relaxed">
                  {selectedCourseForDetails.shortDescription}
                </p>
              </div>

              {/* Metadata Highlights Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Duration</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{selectedCourseForDetails.duration}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Learning Format</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{selectedCourseForDetails.learningFormat}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Course Fee</span>
                  <span className="font-black text-[#281648] text-base sm:text-lg">₹{selectedCourseForDetails.fee.toLocaleString()}</span>
                </div>
              </div>

              {/* What You Will Learn (Syllabus Checklist) */}
              <div className="space-y-3">
                <h4 className="font-['Outfit'] text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#6D28D9]" />
                  <span>What You Will Learn in This Course:</span>
                </h4>

                <ul className="grid grid-cols-1 gap-2.5">
                  {selectedCourseForDetails.whatYouWillLearn.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Academy Key Guarantees */}
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Daily interactive live sessions held on Google Meet with lead mentors.</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Official fee payment confirmation sent via WhatsApp and Email upon enrolment.</span>
                </div>
              </div>

            </div>

            {/* Modal Sticky Footer Action Bar */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tuition</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Outfit'] text-2xl font-black text-[#281648]">
                    ₹{selectedCourseForDetails.fee.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ full course</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* WhatsApp Help Button */}
                <a
                  href={`https://wa.me/919027729917?text=${encodeURIComponent(`Hello Wits Lingo, I would like to inquire about the ${selectedCourseForDetails.name} course.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Inquire</span>
                </a>

                {/* Primary Action Button */}
                {(selectedCourseForDetails.badge || '').toLowerCase() === 'live' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const cId = selectedCourseForDetails.id;
                      setSelectedCourseForDetails(null);
                      if (onBuyNow) {
                        onBuyNow(cId);
                      } else {
                        onEnroll(cId);
                      }
                    }}
                    className="px-6 py-2.5 rounded-full bg-[#281648] hover:bg-[#3C166D] text-white font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-purple-950/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Buy Course Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2.5 rounded-full bg-slate-200 text-slate-500 font-bold text-xs cursor-not-allowed border border-slate-300 flex items-center gap-1.5"
                    title="Admissions opening soon for upcoming courses"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Upcoming Soon</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
};
