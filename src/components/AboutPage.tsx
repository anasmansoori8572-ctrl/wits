import React, { useState } from 'react';
import { 
  ArrowLeft, ChevronRight, CheckCircle2, 
  Award, Users, GraduationCap, Sparkles, 
  Star, Quote, Phone, MessageSquare, BookOpen, Compass
} from 'lucide-react';
import { SiteSettings, TestimonialData } from '../types';

interface AboutPageProps {
  onBackToHome: () => void;
  onNavigateCourses: () => void;
  onOpenAdmission?: (courseId?: string) => void;
  siteSettings?: SiteSettings;
  testimonials?: TestimonialData[];
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onBackToHome,
  onNavigateCourses,
  onOpenAdmission,
  siteSettings,
  testimonials = []
}) => {
  // Active Tab for Mission / Vision / Goal
  const [activeTab, setActiveTab] = useState<'mission' | 'vision' | 'goal'>('mission');

  // Featured Testimonials
  const displayTestimonials = testimonials.length >= 2 ? testimonials.slice(0, 2) : [
    {
      id: 'test-1',
      studentName: 'Mohd Farhan',
      courseBatch: 'Spoken English & Daily Fluency',
      testimonial: 'Before joining Wits Lingo, I was terrified of speaking English in public or during presentations. Zia Sir\'s practical method of speaking from day one completely removed my hesitation. Now I express my ideas freely without mentally translating!',
      city: 'Amroha, UP',
      verified: true
    },
    {
      id: 'test-2',
      studentName: 'Sneha Patel',
      courseBatch: 'Communication Skills & Speaking',
      testimonial: 'The step-by-step pathway from simple sentences to natural dialogues gave me the exact confidence I needed. The mentors never judge you for making mistakes; they guide you with immense patience and care.',
      city: 'Moradabad, UP',
      verified: true
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#1E1B26]">
      {/* =========================================================================
          HERO BANNER (Matches Reference Layout with Wits Lingo Purple Theme)
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#200B3B] text-white">
        {/* Background Image with Deep Royal Purple Gradient Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity scale-105 transition-transform duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80')`
          }}
          aria-hidden="true"
        />
        <div 
          className="absolute inset-0 bg-gradient-to-r from-[#1A0730]/95 via-[#2C0E54]/90 to-[#1A0730]/95 pointer-events-none"
          aria-hidden="true"
        />
        {/* Ambient Radial Accent */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28 text-center">
          {/* Breadcrumb Navigation */}
          <div className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-purple-200/90 mb-4 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-purple-400/20">
            <button 
              type="button" 
              onClick={onBackToHome}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
            <span className="text-purple-300/60 font-bold select-none">&gt;</span>
            <span className="text-white font-semibold">About Us</span>
          </div>

          <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            About Us
          </h1>
          <p className="mt-3 text-sm sm:text-base text-purple-200/80 max-w-xl mx-auto font-normal">
            Empowering students, job aspirants, and working professionals with spontaneous English fluency and unshakeable confidence.
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1: COMPANY ABOUT (Dual-Image Composition + 5+ Years Badge + Details)
          ========================================================================= */}
      <section className="py-20 sm:py-24 lg:py-28 bg-[#FAF9FC] border-b border-purple-100/60 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Overlapping Images + Experience Badge */}
            <div className="lg:col-span-6 relative pb-10 sm:pb-12">
              <div className="relative max-w-md mx-auto lg:max-w-none">
                
                {/* Main Top Image (Mentors & Students Collaborating) */}
                <div className="w-[82%] sm:w-[84%] aspect-[4/3] rounded-3xl overflow-hidden shadow-xl border-4 border-white relative z-10 bg-purple-100">
                  <img
                    src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=900&q=80"
                    alt="Wits Lingo Mentorship Session"
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                </div>

                {/* Floating Experience Badge (Matches Reference Badge Top Right) */}
                <div className="absolute top-2 right-0 sm:right-4 z-30 bg-[#281648] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl shadow-purple-950/30 border border-purple-400/20 max-w-[140px] sm:max-w-[170px] text-left transform translate-y-2">
                  <div className="font-['Outfit'] font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
                    5+
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-purple-200 mt-1 leading-snug">
                    Years of Experience
                  </div>
                </div>

                {/* Overlapping Bottom Image (Professional Mentor Smiling) */}
                <div className="w-[62%] sm:w-[60%] aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 sm:border-[6px] border-white absolute -bottom-6 right-2 sm:right-6 z-20 bg-purple-100 ring-1 ring-purple-100/50">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                    alt="Confident English Mentor"
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>

                {/* Subtle Decorative Ambient Blob */}
                <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-purple-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
              </div>
            </div>

            {/* Right Column: Company Story & Features */}
            <div className="lg:col-span-6 space-y-6">
              {/* Category Kicker */}
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#6D28D9]">
                <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
                <span>Company About</span>
              </div>

              {/* Main Heading (Plain First Line + Italicized Second Line) */}
              <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B26] tracking-tight leading-[1.18]">
                One of the fastest ways to gain{' '}
                <span className="font-['Playfair_Display'] italic font-bold text-[#4A1D96] block sm:inline">
                  fluent English communication
                </span>
              </h2>

              {/* Mission Paragraph */}
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
                Wits Lingo empowers learners of all backgrounds and age groups—from beginners and college students to working professionals—to break through language barriers, shed hesitation, and articulate their thoughts in English with spontaneous confidence.
              </p>

              {/* Special Services / Core Highlights */}
              <div className="pt-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#1E1B26] uppercase tracking-wider mb-4">
                  Development Special Services:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-[13px] text-slate-700 font-medium">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                    <span>Live Interactive Speaking Anytime</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                    <span>Practical Real-World Conversations</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                    <span>Affordable Pricing with Zero Hidden Fees</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                    <span>Reliable & Certified Language Mentors</span>
                  </div>
                </div>
              </div>

              {/* Call to Action Button */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onNavigateCourses}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#281648] hover:bg-[#3C166D] text-white text-xs sm:text-sm font-bold tracking-wider uppercase transition-all shadow-lg shadow-purple-950/20 active:scale-95 cursor-pointer group"
                >
                  <span>Explore Courses</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: FULL-WIDTH COUNTER / STATS BAR (Matches Solid Green Bar from Image)
          ========================================================================= */}
      <section className="bg-[#240B3E] text-white py-12 sm:py-14 border-y border-purple-900/50 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
            
            {/* Stat 1: Years Of Experience */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-purple-400/40 bg-purple-950/40 flex items-center justify-center shrink-0 shadow-xs">
                <Award className="w-7 h-7 text-purple-300 stroke-[1.75]" />
              </div>
              <div>
                <div className="font-['Outfit'] font-black text-2xl sm:text-3xl text-white tracking-tight">
                  5+
                </div>
                <div className="text-[11px] sm:text-xs text-purple-200/90 font-medium tracking-wide uppercase mt-0.5">
                  Years Of Experience
                </div>
              </div>
            </div>

            {/* Stat 2: Students Trained / Completed Batches */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-purple-400/40 bg-purple-950/40 flex items-center justify-center shrink-0 shadow-xs">
                <GraduationCap className="w-7 h-7 text-purple-300 stroke-[1.75]" />
              </div>
              <div>
                <div className="font-['Outfit'] font-black text-2xl sm:text-3xl text-white tracking-tight">
                  200+
                </div>
                <div className="text-[11px] sm:text-xs text-purple-200/90 font-medium tracking-wide uppercase mt-0.5">
                  Complete Batches
                </div>
              </div>
            </div>

            {/* Stat 3: Team Members / Mentors */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-purple-400/40 bg-purple-950/40 flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-7 h-7 text-purple-300 stroke-[1.75]" />
              </div>
              <div>
                <div className="font-['Outfit'] font-black text-2xl sm:text-3xl text-white tracking-tight">
                  15+
                </div>
                <div className="text-[11px] sm:text-xs text-purple-200/90 font-medium tracking-wide uppercase mt-0.5">
                  Expert Mentors
                </div>
              </div>
            </div>

            {/* Stat 4: Total Awards / Satisfaction */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-purple-400/40 bg-purple-950/40 flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-7 h-7 text-purple-300 stroke-[1.75]" />
              </div>
              <div>
                <div className="font-['Outfit'] font-black text-2xl sm:text-3xl text-white tracking-tight">
                  99%+
                </div>
                <div className="text-[11px] sm:text-xs text-purple-200/90 font-medium tracking-wide uppercase mt-0.5">
                  Positive Feedback
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: MISSION / VISION / GOAL WITH INTERACTIVE TABS (Matches Image)
          ========================================================================= */}
      <section className="py-20 sm:py-24 lg:py-28 bg-white border-b border-purple-100/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Mission Headings + Tabs + Content */}
            <div className="lg:col-span-6 space-y-6">
              {/* Category Kicker */}
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#6D28D9]">
                <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
                <span>About Mission</span>
              </div>

              {/* Main Heading */}
              <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B26] tracking-tight leading-[1.18]">
                Our Main Goal to Empower{' '}
                <span className="font-['Playfair_Display'] italic font-bold text-[#4A1D96] block sm:inline">
                  Local & Global English Learners
                </span>
              </h2>

              {/* Pill Tab Switcher Buttons (Matches Image Layout) */}
              <div className="flex items-center gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('mission')}
                  className={`px-4 sm:px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'mission'
                      ? 'bg-[#281648] text-white shadow-md shadow-purple-950/20'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-300 hover:text-[#4A1D96]'
                  }`}
                >
                  Our Mission
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('vision')}
                  className={`px-4 sm:px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'vision'
                      ? 'bg-[#281648] text-white shadow-md shadow-purple-950/20'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-300 hover:text-[#4A1D96]'
                  }`}
                >
                  Our Vision
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('goal')}
                  className={`px-4 sm:px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'goal'
                      ? 'bg-[#281648] text-white shadow-md shadow-purple-950/20'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-300 hover:text-[#4A1D96]'
                  }`}
                >
                  Our Goal
                </button>
              </div>

              {/* Dynamic Tab Body Content */}
              <div className="pt-2 space-y-4">
                {activeTab === 'mission' && (
                  <div className="space-y-3.5 transition-opacity duration-300">
                    <h3 className="font-['Outfit'] text-lg sm:text-xl font-bold text-[#1E1B26]">
                      Our Academy Mission
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      At Wits Lingo, our mission is to eliminate the fear of speaking English by providing interactive, practical, and conversational sessions where students speak out loud from the very first minute.
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      We dismantle outdated rote grammar memorization and replace it with real-life roleplays, speech modulation, and career-focused dialogue practice designed for immediate fluency.
                    </p>
                  </div>
                )}

                {activeTab === 'vision' && (
                  <div className="space-y-3.5 transition-opacity duration-300">
                    <h3 className="font-['Outfit'] text-lg sm:text-xl font-bold text-[#1E1B26]">
                      Our Long-Term Vision
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      To become the most dependable and inspiring global language learning academy, bridging personal aspirations with international career and academic opportunities.
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      We envision a world where language is never a barrier to anyone's dreams, career growth, or self-expression, regardless of their native background.
                    </p>
                  </div>
                )}

                {activeTab === 'goal' && (
                  <div className="space-y-3.5 transition-opacity duration-300">
                    <h3 className="font-['Outfit'] text-lg sm:text-xl font-bold text-[#1E1B26]">
                      Our Strategic Educational Goal
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      To help every student achieve spontaneous, unhesitating English fluency, expand vocabulary naturally, and master interview and corporate presentation etiquette.
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Ensuring 100% personalized attention, active daily speaking opportunities, and measurable progress tracking throughout their entire learning journey.
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Mission Image (Matches Rounded Photo from Image) */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-purple-100 aspect-[4/3] group">
                <img
                  src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1000&q=80"
                  alt="Wits Lingo Students and Mentors Discussing Strategy"
                  className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1F0933]/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: TESTIMONIALS / EXPERIENCES ("Trusted By Global Client's")
          ========================================================================= */}
      <section className="py-20 sm:py-24 lg:py-28 bg-[#FAF9FC] border-b border-purple-100/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2.5">
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

          {/* 2-Column Testimonial Cards (Matches Image Layout Exactly) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {displayTestimonials.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="bg-white rounded-3xl p-7 sm:p-9 shadow-sm hover:shadow-md transition-shadow border border-slate-200/80 flex flex-col justify-between space-y-6 relative"
              >
                {/* Quote Text */}
                <p className="text-slate-600 text-sm sm:text-[14.5px] leading-relaxed italic">
                  &ldquo;{item.testimonial}&rdquo;
                </p>

                {/* Bottom Row: User Avatar + Name + 5 Stars */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-100 border-2 border-purple-200 shrink-0">
                      <img 
                        src={idx === 0 
                          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' 
                          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                        }
                        alt={item.studentName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-['Outfit'] font-bold text-sm text-[#1E1B26]">
                        {item.studentName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {item.courseBatch || 'English Learner'} &bull; {item.city || 'India'}
                      </p>
                    </div>
                  </div>

                  {/* 5 Stars Rating */}
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 5: BOTTOM CALLOUT BANNER (Join Academy / Talk on WhatsApp)
          ========================================================================= */}
      <section className="py-14 sm:py-16 bg-white border-b border-purple-100/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-[#21093A] via-[#2F1159] to-[#21093A] rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            {/* Ambient Lighting */}
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 text-center md:text-left relative z-10">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-300 bg-white/10 px-3 py-1 rounded-full border border-purple-300/20 inline-block mb-2">
                Start Speaking Today
              </span>
              <h3 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Ready to transform your English fluency?
              </h3>
              <p className="text-purple-200 text-xs sm:text-sm max-w-lg">
                Join our live batches and start speaking confidently without hesitation.
              </p>
            </div>

            <div className="flex items-center gap-3.5 relative z-10 shrink-0">
              <button
                type="button"
                onClick={onNavigateCourses}
                className="px-6 py-3 rounded-full bg-white text-[#281648] hover:bg-purple-100 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Browse Live Courses
              </button>
              
              <a
                href={siteSettings?.whatsappChannelUrl || "https://whatsapp.com/channel/0029VbDjNY9InlqQJsC6G02Y"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 fill-white text-white" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
