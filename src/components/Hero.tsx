import React, { useState } from 'react';
import { ArrowRight, BookOpen, MessageSquare, User, Mic, Star, Layers, X } from 'lucide-react';
import { SiteSettings, Announcement } from '../types';

interface HeroProps {
  onOpenAdmission: (courseId?: string, batchId?: string) => void;
  onExploreCourses: () => void;
  onTakeLevelTest?: () => void;
  onWatchVideo?: () => void;
  siteSettings?: SiteSettings;
  announcements?: Announcement[];
  onOpenAnnouncementModal?: (announcement: Announcement) => void;
}

export const Hero: React.FC<HeroProps> = ({ 
  onOpenAdmission, 
  onExploreCourses, 
  onTakeLevelTest,
  siteSettings,
}) => {
  const [isLevelTestModalOpen, setIsLevelTestModalOpen] = useState(false);

  const handleTakeLevelTest = () => {
    if (onTakeLevelTest) {
      onTakeLevelTest();
      return;
    }
    const el = document.getElementById('learning-resources');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsLevelTestModalOpen(true);
    }
  };

  return (
    <section 
      id="home" 
      className="relative w-full overflow-hidden bg-[#FAF9FD] text-[#1E123B] flex items-center justify-center min-h-[calc(100vh-5rem)] lg:min-h-[820px] py-6 sm:py-8 lg:py-14"
    >
      {/* Subtle organic decorative background corner shapes */}
      <div 
        className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-bl-[140px] sm:rounded-bl-[160px] bg-[#EFEAF9] pointer-events-none select-none -z-0"
        aria-hidden="true"
      />

      <div 
        className="absolute bottom-0 left-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-tr-[140px] sm:rounded-tr-[160px] bg-[#EFEAF9] pointer-events-none select-none -z-0"
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 1. DESKTOP HERO LAYOUT (ONLY on lg: 1024px and above)                     */}
      {/* 100% PRESERVED, UNCHANGED, AND PROTECTED FROM MOBILE CHANGES              */}
      {/* ========================================================================= */}
      <div className="hidden lg:block relative z-10 max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
          
          {/* LEFT COLUMN: Label, Heading, Description, Buttons, Features */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center text-left">
            
            {/* Small uppercase label: WITS LINGO */}
            <div className="mb-4 sm:mb-5">
              <span className="text-[12px] sm:text-[13px] font-bold tracking-[0.25em] text-[#7C7396] uppercase font-['Outfit'] select-none">
                WITS LINGO
              </span>
            </div>

            {/* Main Headline: 64px - 68px at 1600px desktop, bold modern typography */}
            <h1 className="font-['Outfit'] font-extrabold text-[40px] sm:text-[50px] md:text-[56px] lg:text-[60px] xl:text-[66px] 2xl:text-[68px] tracking-[-0.03em] leading-[1.08] text-[#1E123B] text-left">
              <span className="block text-[#1E123B]">
                Learn English.
              </span>
              <span 
                className="block text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #6B21A8 0%, #8B5CF6 50%, #9333EA 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Build Confidence.
              </span>
              <span className="block text-[#1E123B]">
                Speak Naturally.
              </span>
            </h1>

            {/* Description: 22px at desktop, max-width 540px, comfortable line spacing */}
            <p className="text-[#5A526E] text-[18px] sm:text-[20px] lg:text-[22px] leading-[1.55] max-w-[540px] mt-6 sm:mt-7 mb-8 sm:mb-9 font-normal text-left">
              Practical language learning designed to take you from understanding words to expressing yourself confidently in real conversations.
            </p>

            {/* The Two CTA Buttons: Explore Courses & Take a Level Test */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {/* BUTTON 1: Explore Courses (Dark purple, white visible text, pill shape) */}
              <button
                type="button"
                onClick={onExploreCourses}
                id="hero-explore-courses-btn"
                style={{ backgroundColor: '#281648', color: '#ffffff' }}
                className="px-8 py-4 sm:px-9 sm:py-4.5 rounded-full font-semibold text-[16px] lg:text-[17px] inline-flex items-center justify-center gap-3 shadow-md hover:bg-[#1E0F38] hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer text-white"
              >
                <span className="text-white font-semibold">Explore Courses</span>
                <ArrowRight className="w-5 h-5 text-white stroke-[2.2] transition-transform group-hover:translate-x-1 shrink-0" />
              </button>

              {/* BUTTON 2: Take a Level Test (White background, purple border, purple text, pill shape) */}
              <button
                type="button"
                onClick={handleTakeLevelTest}
                id="hero-level-test-btn"
                style={{ backgroundColor: '#ffffff', color: '#281648', borderColor: '#281648' }}
                className="px-8 py-4 sm:px-9 sm:py-4.5 rounded-full font-semibold text-[16px] lg:text-[17px] inline-flex items-center justify-center border-2 border-[#281648] hover:bg-purple-50/70 transition-all active:scale-[0.98] cursor-pointer text-[#281648]"
              >
                <span className="text-[#281648] font-semibold">Take a Level Test</span>
              </button>
            </div>

            {/* Bottom Hero Features: Structured Learning, Speaking Practice, Expert Guidance */}
            <div className="mt-12 sm:mt-14 lg:mt-16 pt-2 flex items-center flex-wrap sm:flex-nowrap gap-5 sm:gap-0">
              
              {/* Feature 1: Structured Learning */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-[#281648] stroke-[2.2]" />
                </div>
                <div className="text-[13px] font-bold text-[#1E123B] leading-tight select-none">
                  <div>Structured</div>
                  <div>Learning</div>
                </div>
              </div>

              {/* Separator 1 */}
              <div className="hidden sm:block w-px h-9 bg-slate-200 mx-6 lg:mx-7 xl:mx-8" />

              {/* Feature 2: Speaking Practice */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-[#281648] stroke-[2.2]" />
                </div>
                <div className="text-[13px] font-bold text-[#1E123B] leading-tight select-none">
                  <div>Speaking</div>
                  <div>Practice</div>
                </div>
              </div>

              {/* Separator 2 */}
              <div className="hidden sm:block w-px h-9 bg-slate-200 mx-6 lg:mx-7 xl:mx-8" />

              {/* Feature 3: Expert Guidance */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-[#281648] stroke-[2.2]" />
                </div>
                <div className="text-[13px] font-bold text-[#1E123B] leading-tight select-none">
                  <div>Expert</div>
                  <div>Guidance</div>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Mascot, 4 Floating Badges, Slogan (No Overlap) */}
          <div className="lg:col-span-5 xl:col-span-5 flex items-center justify-center relative select-none w-full">
            
            {/* Mascot Artwork Composition Container */}
            <div className="relative w-full max-w-[500px] xl:max-w-[540px] 2xl:max-w-[560px] pb-14 sm:pb-16 flex items-center justify-center mx-auto">
              
              {/* 1. Large Circular Dark-Purple Wits Mascot Artwork */}
              <div className="w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] lg:w-[410px] lg:h-[410px] xl:w-[450px] xl:h-[450px] rounded-full overflow-hidden flex items-center justify-center shadow-2xl shadow-purple-950/20 shrink-0">
                <img
                  src="/logo.svg"
                  alt="Wits Mascot Emblem"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              </div>

              {/* 2. Floating Pastel Badge 1: Vocabulary (Top-Left of Mascot) */}
              <div 
                className="absolute -top-1 left-0 sm:left-4 lg:-top-2 lg:left-0 xl:-left-2 z-20 bg-[#EDE9FE] text-[#281648] px-4 sm:px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-purple-200/60 hover:scale-105 transition-transform"
              >
                <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#6D28D9] stroke-[2.2]" />
                <span className="text-xs sm:text-sm font-bold text-[#281648]">Vocabulary</span>
              </div>

              {/* 3. Floating Pastel Badge 2: Speaking (Top-Right of Mascot) */}
              <div 
                className="absolute top-2 -right-1 sm:right-4 lg:top-2 lg:-right-2 xl:-right-4 z-20 bg-[#DCFCE7] text-[#065F46] px-4 sm:px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-emerald-200/60 hover:scale-105 transition-transform"
              >
                <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#059669] stroke-[2.2]" />
                <span className="text-xs sm:text-sm font-bold text-[#065F46]">Speaking</span>
              </div>

              {/* 4. Floating Pastel Badge 3: Grammar (Middle-Right of Mascot) */}
              <div 
                className="absolute top-[38%] -right-4 sm:-right-2 lg:top-[38%] lg:-right-6 xl:-right-8 z-20 bg-[#FEF3C7] text-[#92400E] px-4 sm:px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-amber-200/60 hover:scale-105 transition-transform"
              >
                <Layers className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#D97706] stroke-[2.2]" />
                <span className="text-xs sm:text-sm font-bold text-[#92400E]">Grammar</span>
              </div>

              {/* 5. Floating Pastel Badge 4: Confidence (Bottom-Right of Mascot) */}
              <div 
                className="absolute top-[58%] -right-3 sm:-right-1 lg:top-[58%] lg:-right-5 xl:-right-6 z-20 bg-[#FCE7F3] text-[#9F1239] px-4 sm:px-5 py-2.5 rounded-full flex items-center gap-2.5 shadow-sm border border-pink-200/60 hover:scale-105 transition-transform"
              >
                <Star className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#E11D48] stroke-[2.2]" />
                <span className="text-xs sm:text-sm font-bold text-[#9F1239]">Confidence</span>
              </div>

              {/* 6. Subtle Sketched Decorative Strokes */}
              <svg 
                className="absolute -left-6 sm:-left-8 top-[38%] w-7 h-7 text-[#281648] pointer-events-none" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="12" x2="6" y2="5" />
                <line x1="20" y1="20" x2="8" y2="13" />
              </svg>

              <svg 
                className="absolute right-[22%] top-[31%] w-6 h-6 text-[#281648] pointer-events-none" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="8" y1="18" x2="5" y2="6" />
                <line x1="16" y1="20" x2="19" y2="8" />
              </svg>

              <svg 
                className="absolute right-[20%] bottom-[24%] w-6 h-6 text-[#281648] pointer-events-none" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="7" y1="6" x2="3" y2="18" />
                <line x1="15" y1="6" x2="18" y2="18" />
              </svg>

              {/* 7. Slogan: "Better English \n Brighter Future" */}
              <div className="absolute -bottom-2 right-0 sm:right-2 lg:-bottom-4 lg:right-0 select-none pointer-events-none transform -rotate-[5deg]">
                <div className="relative inline-block text-right">
                  <svg 
                    className="absolute -top-3.5 right-1 w-5 h-5 text-[#281648]" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="6" y1="18" x2="16" y2="6" />
                    <line x1="13" y1="20" x2="21" y2="12" />
                  </svg>

                  <div className="font-['Caveat',cursive] text-2xl sm:text-[1.95rem] font-bold text-[#281648] leading-[1.05] tracking-tight">
                    <div>Better English</div>
                    <div>Brighter Future</div>
                  </div>

                  <svg 
                    className="w-[135px] h-3.5 text-[#281648] ml-auto mt-1" 
                    viewBox="0 0 135 12" 
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M 6 6 C 45 12, 95 11, 131 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>


      {/* ========================================================================= */}
      {/* 2. MOBILE HERO LAYOUT (ONLY on < lg: 1024px)                               */}
      {/* MATCHES THE MOBILE REFERENCE SCREENSHOT 1:1                               */}
      {/* Order: Wits Lingo -> Heading -> Desc -> 2 Stacked Buttons -> Mascot -> 3 Features */}
      {/* ========================================================================= */}
      <div className="lg:hidden relative z-10 w-full px-5 sm:px-8 py-2 max-w-[640px] mx-auto flex flex-col">
        
        {/* Label: WITS LINGO */}
        <div className="mb-3 text-left">
          <span className="text-[12px] sm:text-[13px] font-bold tracking-[0.25em] text-[#7C7396] uppercase font-['Outfit'] select-none">
            WITS LINGO
          </span>
        </div>

        {/* Main Headline: 3 separate lines, bold modern typography */}
        <h1 className="font-['Outfit'] font-extrabold text-[36px] min-[375px]:text-[40px] sm:text-[46px] tracking-[-0.03em] leading-[1.1] text-[#1E123B] text-left">
          <span className="block text-[#1E123B]">
            Learn English.
          </span>
          <span 
            className="block text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(90deg, #6B21A8 0%, #8B5CF6 50%, #9333EA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Build Confidence.
          </span>
          <span className="block text-[#1E123B]">
            Speak Naturally.
          </span>
        </h1>

        {/* Description */}
        <p className="text-[#5A526E] text-[16px] min-[375px]:text-[17px] sm:text-[19px] leading-[1.5] mt-4 mb-6 font-normal text-left">
          Practical language learning designed to take you from understanding words to expressing yourself confidently in real conversations.
        </p>

        {/* CTA Buttons: Vertically stacked full-width pill buttons */}
        <div className="flex flex-col gap-3.5 w-full">
          {/* Button 1: Explore Courses */}
          <button
            type="button"
            onClick={onExploreCourses}
            style={{ backgroundColor: '#281648', color: '#ffffff' }}
            className="w-full py-4 sm:py-4.5 rounded-full font-semibold text-[16px] sm:text-[17px] inline-flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] cursor-pointer text-white"
          >
            <span>Explore Courses</span>
            <ArrowRight className="w-5 h-5 text-white stroke-[2.2] shrink-0" />
          </button>

          {/* Button 2: Take a Level Test */}
          <button
            type="button"
            onClick={handleTakeLevelTest}
            style={{ backgroundColor: '#ffffff', color: '#281648', borderColor: '#281648' }}
            className="w-full py-4 sm:py-4.5 rounded-full font-semibold text-[16px] sm:text-[17px] inline-flex items-center justify-center border-2 border-[#281648] bg-white text-[#281648] active:scale-[0.98] cursor-pointer"
          >
            <span>Take a Level Test</span>
          </button>
        </div>

        {/* Mascot Artwork with Floating Badges & Slogan (BELOW the buttons) */}
        <div className="mt-8 sm:mt-11 relative w-full max-w-[280px] min-[375px]:max-w-[320px] sm:max-w-[400px] mx-auto flex items-center justify-center pb-12 select-none overflow-visible">
          
          {/* Circular Mascot Emblem */}
          <div className="w-[185px] h-[185px] min-[375px]:w-[220px] min-[375px]:h-[220px] sm:w-[280px] sm:h-[280px] rounded-full overflow-hidden flex items-center justify-center shadow-xl shadow-purple-950/20 shrink-0">
            <img
              src="/logo.svg"
              alt="Wits Mascot Emblem"
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          </div>

          {/* Badge 1: Vocabulary (Top-Left) */}
          <div 
            className="absolute -top-3 left-0 min-[375px]:left-1 z-20 bg-[#EDE9FE] text-[#281648] px-3.5 py-1.5 min-[375px]:px-4 min-[375px]:py-2 rounded-full flex items-center gap-2 shadow-xs border border-purple-200/60"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6D28D9] stroke-[2.2]" />
            <span className="text-[11px] min-[375px]:text-xs font-bold text-[#281648]">Vocabulary</span>
          </div>

          {/* Badge 2: Speaking (Top-Right) */}
          <div 
            className="absolute top-0 right-0 min-[375px]:right-1 z-20 bg-[#DCFCE7] text-[#065F46] px-3.5 py-1.5 min-[375px]:px-4 min-[375px]:py-2 rounded-full flex items-center gap-2 shadow-xs border border-emerald-200/60"
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#059669] stroke-[2.2]" />
            <span className="text-[11px] min-[375px]:text-xs font-bold text-[#065F46]">Speaking</span>
          </div>

          {/* Badge 3: Grammar (Middle-Right) */}
          <div 
            className="absolute top-[37%] right-0 z-20 bg-[#FEF3C7] text-[#92400E] px-3.5 py-1.5 min-[375px]:px-4 min-[375px]:py-2 rounded-full flex items-center gap-2 shadow-xs border border-amber-200/60"
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D97706] stroke-[2.2]" />
            <span className="text-[11px] min-[375px]:text-xs font-bold text-[#92400E]">Grammar</span>
          </div>

          {/* Badge 4: Confidence (Bottom-Right) */}
          <div 
            className="absolute top-[57%] right-0 z-20 bg-[#FCE7F3] text-[#9F1239] px-3.5 py-1.5 min-[375px]:px-4 min-[375px]:py-2 rounded-full flex items-center gap-2 shadow-xs border border-pink-200/60"
          >
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E11D48] stroke-[2.2]" />
            <span className="text-[11px] min-[375px]:text-xs font-bold text-[#9F1239]">Confidence</span>
          </div>

          {/* Decorative Strokes around mascot */}
          <svg 
            className="absolute -left-4 sm:-left-5 top-[38%] w-5 h-5 text-[#281648] pointer-events-none" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="12" x2="6" y2="5" />
            <line x1="20" y1="20" x2="8" y2="13" />
          </svg>

          <svg 
            className="absolute right-[21%] top-[30%] w-5 h-5 text-[#281648] pointer-events-none" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="8" y1="18" x2="5" y2="6" />
            <line x1="16" y1="20" x2="19" y2="8" />
          </svg>

          <svg 
            className="absolute right-[19%] bottom-[23%] w-5 h-5 text-[#281648] pointer-events-none" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="7" y1="6" x2="3" y2="18" />
            <line x1="15" y1="6" x2="18" y2="18" />
          </svg>

          {/* Slogan: "Better English \n Brighter Future" */}
          <div className="absolute -bottom-1 right-1 sm:right-3 select-none pointer-events-none transform -rotate-[5deg]">
            <div className="relative inline-block text-right">
              <svg 
                className="absolute -top-3 right-1 w-4 h-4 text-[#281648]" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="6" y1="18" x2="16" y2="6" />
                <line x1="13" y1="20" x2="21" y2="12" />
              </svg>

              <div className="font-['Caveat',cursive] text-[22px] sm:text-[25px] font-bold text-[#281648] leading-[1.05] tracking-tight">
                <div>Better English</div>
                <div>Brighter Future</div>
              </div>

              <svg 
                className="w-[115px] sm:w-[130px] h-3 text-[#281648] ml-auto mt-0.5" 
                viewBox="0 0 130 12" 
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M 6 6 C 45 12, 95 11, 126 4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

        </div>

        {/* 3-Column Bottom Feature Section (BELOW the mascot) */}
        <div className="mt-4 sm:mt-6 pt-4 w-full grid grid-cols-3 divide-x divide-slate-200/80">
          
          {/* Column 1: Structured Learning */}
          <div className="flex flex-col items-center text-center px-1">
            <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center text-[#281648] mb-2 shrink-0">
              <BookOpen className="w-5 h-5 text-[#281648] stroke-[2.2]" />
            </div>
            <div className="text-[12px] sm:text-[13px] font-bold text-[#1E123B] leading-tight select-none">
              <div>Structured</div>
              <div>Learning</div>
            </div>
          </div>

          {/* Column 2: Speaking Practice */}
          <div className="flex flex-col items-center text-center px-1">
            <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center text-[#281648] mb-2 shrink-0">
              <MessageSquare className="w-5 h-5 text-[#281648] stroke-[2.2]" />
            </div>
            <div className="text-[12px] sm:text-[13px] font-bold text-[#1E123B] leading-tight select-none">
              <div>Speaking</div>
              <div>Practice</div>
            </div>
          </div>

          {/* Column 3: Expert Guidance */}
          <div className="flex flex-col items-center text-center px-1">
            <div className="w-12 h-12 rounded-full bg-[#EDE8FA] flex items-center justify-center text-[#281648] mb-2 shrink-0">
              <User className="w-5 h-5 text-[#281648] stroke-[2.2]" />
            </div>
            <div className="text-[12px] sm:text-[13px] font-bold text-[#1E123B] leading-tight select-none">
              <div>Expert</div>
              <div>Guidance</div>
            </div>
          </div>

        </div>

      </div>

      {/* Modal for Level Test info if diagnostic resource isn't found */}
      {isLevelTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E123B]">English Level Diagnostic Test</h3>
              <button 
                onClick={() => setIsLevelTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Our 50-Question Spoken English Diagnostic Assessment evaluates your current proficiency (Beginner, Intermediate, or Advanced) and provides personalized batch recommendations.
            </p>
            <div className="bg-purple-50 rounded-xl p-3.5 mb-5 text-xs text-purple-900 border border-purple-100">
              <span className="font-bold block mb-1">Status:</span>
              Interactive automated level quiz engine is under active implementation. In the meantime, you can explore courses or download the diagnostic worksheet from the learning hub.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsLevelTestModalOpen(false);
                  onOpenAdmission();
                }}
                className="flex-1 py-2.5 rounded-full bg-[#281648] text-white text-xs font-bold hover:bg-[#1E0F38] transition-colors cursor-pointer"
              >
                Register with Academy
              </button>
              <button
                onClick={() => setIsLevelTestModalOpen(false)}
                className="px-4 py-2.5 rounded-full border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Hero;
