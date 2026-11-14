import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  RotateCw, 
  RotateCcw, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';

interface WhatWeTeachProps {
  onSelectSubject?: (subject: string) => void;
  onOpenAdmission?: () => void;
}

// 3D-styled Avatar illustrations matching the clay character aesthetic of the reference image
const CharacterAvatar: React.FC<{ type: number }> = ({ type }) => {
  switch (type) {
    case 1:
      // Spoken English: 3D character with violet hoodie & dynamic speech bubble (like Maya Bennett)
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FED7AA" />
              <stop offset="100%" stopColor="#FDBA74" />
            </linearGradient>
            <linearGradient id="hair1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id="hoodie1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
          </defs>
          {/* Hair back */}
          <path d="M70 90C60 60 75 30 110 20C145 10 175 35 170 80C170 100 160 120 155 130H85C80 120 70 110 70 90Z" fill="url(#hair1)" />
          {/* Torso / Hoodie */}
          <path d="M50 195C55 155 85 140 120 140C155 140 185 155 190 195H50Z" fill="url(#hoodie1)" />
          <path d="M100 140C100 155 110 168 120 168C130 168 140 155 140 140" stroke="#DDD6FE" strokeWidth="4" strokeLinecap="round" />
          {/* Neck */}
          <rect x="106" y="115" width="28" height="30" rx="8" fill="url(#skin1)" />
          {/* Head */}
          <rect x="90" y="55" width="60" height="70" rx="28" fill="url(#skin1)" />
          {/* Ears */}
          <circle cx="88" cy="90" r="8" fill="#FDBA74" />
          <circle cx="152" cy="90" r="8" fill="#FDBA74" />
          {/* Hair Front / Wild 3D Tuft */}
          <path d="M85 65C85 40 105 25 125 25C145 25 155 45 155 60C140 48 115 50 105 58C95 65 90 75 85 65Z" fill="url(#hair1)" />
          <path d="M100 35C108 15 125 12 135 22C140 15 152 18 148 30" fill="#EC4899" />
          {/* Eyes */}
          <circle cx="106" cy="85" r="4.5" fill="#1E1B26" />
          <circle cx="134" cy="85" r="4.5" fill="#1E1B26" />
          <circle cx="108" cy="83" r="1.5" fill="#FFFFFF" />
          <circle cx="136" cy="83" r="1.5" fill="#FFFFFF" />
          {/* Cheeks */}
          <ellipse cx="102" cy="95" rx="5" ry="3" fill="#FDA4AF" opacity="0.6" />
          <ellipse cx="138" cy="95" rx="5" ry="3" fill="#FDA4AF" opacity="0.6" />
          {/* Mouth speaking */}
          <path d="M114 100C114 106 126 106 126 100Z" fill="#BE123C" />
          {/* Speech Bubble Icon badge */}
          <g transform="translate(160, 45) scale(0.9)">
            <rect width="44" height="32" rx="12" fill="#FAF5FF" stroke="#C4B5FD" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))" />
            <polygon points="12,32 18,32 10,40" fill="#FAF5FF" />
            <path d="M12 16H32M12 22H24" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 2:
      // Vocabulary: 3D character with smart swept hair and floating book/lexicon (like Leo Carter)
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="hair2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#312E81" />
            </linearGradient>
            <linearGradient id="shirt2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4338CA" />
              <stop offset="100%" stopColor="#3730A3" />
            </linearGradient>
          </defs>
          {/* Hair back */}
          <path d="M80 60C75 35 105 18 135 22C160 25 168 50 165 75C165 90 155 105 150 115H85C80 100 80 80 80 60Z" fill="url(#hair2)" />
          {/* Torso */}
          <path d="M50 195C55 155 85 142 120 142C155 142 185 155 190 195H50Z" fill="url(#shirt2)" />
          {/* Neck */}
          <rect x="107" y="112" width="26" height="32" rx="8" fill="#FBBF24" />
          {/* Head */}
          <rect x="92" y="52" width="56" height="68" rx="26" fill="#FBBF24" />
          {/* Ears */}
          <circle cx="89" cy="85" r="7.5" fill="#F59E0B" />
          <circle cx="151" cy="85" r="7.5" fill="#F59E0B" />
          {/* Hair Front - sleek modern quiff */}
          <path d="M85 58C85 30 110 18 140 22C165 25 168 45 155 58C140 45 110 42 98 52Z" fill="url(#hair2)" />
          {/* Eyes */}
          <circle cx="106" cy="80" r="4" fill="#1E1B26" />
          <circle cx="134" cy="80" r="4" fill="#1E1B26" />
          <circle cx="107.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          <circle cx="135.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          {/* Warm smile */}
          <path d="M112 96C112 102 128 102 128 96" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
          {/* Floating Vocabulary Book */}
          <g transform="translate(155, 110) rotate(-10)">
            <rect width="40" height="28" rx="6" fill="#EDE9FE" stroke="#818CF8" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />
            <line x1="20" y1="2" x2="20" y2="26" stroke="#818CF8" strokeWidth="2" />
            <line x1="6" y1="8" x2="16" y2="8" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="14" x2="14" y2="14" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="8" x2="34" y2="8" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="14" x2="32" y2="14" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 3:
      // Conversation: 3D character with cheerful dialogue aura & partner bubble
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FED7AA" />
              <stop offset="100%" stopColor="#FDBA74" />
            </linearGradient>
            <linearGradient id="hoodie3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86198F" />
              <stop offset="100%" stopColor="#701A75" />
            </linearGradient>
            <linearGradient id="hair3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>
          <path d="M50 195C55 155 85 142 120 142C155 142 185 155 190 195H50Z" fill="url(#hoodie3)" />
          <rect x="106" y="112" width="28" height="32" rx="8" fill="url(#skin3)" />
          <rect x="88" y="50" width="64" height="70" rx="30" fill="url(#skin3)" />
          {/* Hair with side bun */}
          <circle cx="75" cy="55" r="18" fill="url(#hair3)" />
          <circle cx="165" cy="55" r="18" fill="url(#hair3)" />
          <path d="M85 58C90 35 110 30 120 30C130 30 150 35 155 58C140 48 100 48 85 58Z" fill="url(#hair3)" />
          {/* Ears with loop rings */}
          <circle cx="86" cy="85" r="7" fill="#FDBA74" />
          <circle cx="86" cy="90" r="3.5" fill="#F43F5E" />
          <circle cx="154" cy="85" r="7" fill="#FDBA74" />
          <circle cx="154" cy="90" r="3.5" fill="#F43F5E" />
          {/* Eyes smiling */}
          <path d="M100 80C104 76 110 76 114 80" stroke="#1E1B26" strokeWidth="3" strokeLinecap="round" />
          <path d="M126 80C130 76 136 76 140 80" stroke="#1E1B26" strokeWidth="3" strokeLinecap="round" />
          {/* Wide laugh */}
          <path d="M110 94C110 104 130 104 130 94Z" fill="#BE123C" />
          {/* Conversation speech badges */}
          <g transform="translate(150, 35)">
            <rect width="40" height="26" rx="10" fill="#FAF5FF" stroke="#F472B6" strokeWidth="2" />
            <circle cx="12" cy="13" r="2.5" fill="#DB2777" />
            <circle cx="20" cy="13" r="2.5" fill="#DB2777" />
            <circle cx="28" cy="13" r="2.5" fill="#DB2777" />
          </g>
        </svg>
      );
    case 4:
      // Grammar: 3D character with syntax blueprint & pen (like Amina Yusuf)
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FDBA74" />
              <stop offset="100%" stopColor="#FB923C" />
            </linearGradient>
            <linearGradient id="hair4" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#18181B" />
              <stop offset="100%" stopColor="#27272A" />
            </linearGradient>
            <linearGradient id="top4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#581C87" />
              <stop offset="100%" stopColor="#3B0764" />
            </linearGradient>
          </defs>
          {/* Long bob hair */}
          <path d="M72 70C70 40 90 20 120 20C150 20 170 40 168 70C168 110 162 135 162 135H78C78 135 72 110 72 70Z" fill="url(#hair4)" />
          {/* Torso */}
          <path d="M50 195C55 155 85 142 120 142C155 142 185 155 190 195H50Z" fill="url(#top4)" />
          <rect x="107" y="112" width="26" height="32" rx="8" fill="url(#skin4)" />
          {/* Face */}
          <rect x="91" y="52" width="58" height="68" rx="27" fill="url(#skin4)" />
          {/* Fringe */}
          <path d="M88 56C95 48 110 48 120 48C130 48 145 48 152 56C148 50 135 44 120 44C105 44 92 50 88 56Z" fill="#18181B" />
          {/* Eyes */}
          <circle cx="106" cy="80" r="4" fill="#18181B" />
          <circle cx="134" cy="80" r="4" fill="#18181B" />
          <circle cx="107.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          <circle cx="135.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          <path d="M114 96C114 100 126 100 126 96" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" />
          {/* Grammar Quill / Checkmark Token */}
          <g transform="translate(155, 105) rotate(15)">
            <circle cx="18" cy="18" r="18" fill="#FAF5FF" stroke="#A855F7" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />
            <path d="M11 18L16 23L26 13" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );
    case 5:
      // Pronunciation: 3D character with studio headphones & soundwave
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FED7AA" />
              <stop offset="100%" stopColor="#FDBA74" />
            </linearGradient>
            <linearGradient id="hair5" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#115E59" />
            </linearGradient>
            <linearGradient id="top5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="100%" stopColor="#065F46" />
            </linearGradient>
          </defs>
          {/* Torso */}
          <path d="M50 195C55 155 85 142 120 142C155 142 185 155 190 195H50Z" fill="url(#top5)" />
          <rect x="107" y="112" width="26" height="32" rx="8" fill="url(#skin5)" />
          {/* Head */}
          <rect x="91" y="52" width="58" height="68" rx="27" fill="url(#skin5)" />
          {/* Hair */}
          <path d="M85 55C85 30 110 20 125 20C145 20 155 35 155 55C140 45 105 45 85 55Z" fill="url(#hair5)" />
          {/* Studio Headphones Band */}
          <path d="M78 85C74 45 100 25 120 25C140 25 166 45 162 85" stroke="#1E1B26" strokeWidth="6" strokeLinecap="round" />
          {/* Headphone Ear Cushions */}
          <rect x="72" y="70" width="16" height="32" rx="8" fill="#14B8A6" stroke="#042F2E" strokeWidth="2" />
          <rect x="152" y="70" width="16" height="32" rx="8" fill="#14B8A6" stroke="#042F2E" strokeWidth="2" />
          {/* Eyes closed listening with joy */}
          <path d="M102 82C106 86 112 86 116 82" stroke="#1E1B26" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M124 82C128 86 134 86 138 82" stroke="#1E1B26" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M115 96C115 100 125 100 125 96" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" />
          {/* Floating Soundwaves badge */}
          <g transform="translate(155, 30)">
            <rect width="36" height="26" rx="8" fill="#FAF5FF" stroke="#14B8A6" strokeWidth="2" />
            <line x1="10" y1="13" x2="10" y2="13" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="8" x2="15" y2="18" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" />
            <line x1="21" y1="5" x2="21" y2="21" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" />
            <line x1="26" y1="9" x2="26" y2="17" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 6:
    default:
      // Communication: 3D character presenting with microphone & confidence glow
      return (
        <svg viewBox="0 0 240 200" className="w-full h-full object-contain filter drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="skin6" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FED7AA" />
              <stop offset="100%" stopColor="#FDBA74" />
            </linearGradient>
            <linearGradient id="hair6" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#BE123C" />
            </linearGradient>
            <linearGradient id="suit6" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7E22CE" />
              <stop offset="100%" stopColor="#581C87" />
            </linearGradient>
          </defs>
          <path d="M50 195C55 155 85 142 120 142C155 142 185 155 190 195H50Z" fill="url(#suit6)" />
          {/* Tie / V-neck */}
          <polygon points="120,150 126,170 120,185 114,170" fill="#F43F5E" />
          <rect x="107" y="112" width="26" height="32" rx="8" fill="url(#skin6)" />
          <rect x="91" y="52" width="58" height="68" rx="27" fill="url(#skin6)" />
          <path d="M85 58C85 28 112 18 135 22C155 25 158 45 152 58C138 45 105 45 85 58Z" fill="url(#hair6)" />
          {/* Eyes confident */}
          <circle cx="106" cy="80" r="4" fill="#18181B" />
          <circle cx="134" cy="80" r="4" fill="#18181B" />
          <circle cx="107.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          <circle cx="135.5" cy="78.5" r="1.5" fill="#FFFFFF" />
          <path d="M112 96C112 104 128 104 128 96Z" fill="#BE123C" />
          {/* Mic badge */}
          <g transform="translate(150, 95) rotate(-10)">
            <rect x="12" y="4" width="12" height="20" rx="6" fill="#18181B" stroke="#F43F5E" strokeWidth="2" />
            <path d="M8 14C8 22 28 22 28 14" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
            <line x1="18" y1="22" x2="18" y2="28" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      );
  }
};

export const WhatWeTeach: React.FC<WhatWeTeachProps> = ({ onSelectSubject }) => {
  // Interactive flip state for each card index (matching reference image click/tap to flip)
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  const toggleCardFlip = (index: number) => {
    setFlippedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const learningPillars = [
    {
      num: '01',
      title: 'Spoken English',
      subtitle: 'Daily Fluency Framework',
      quote: 'Develop practical speaking skills for spontaneous everyday communication without fear.',
      description: 'Master effortless spoken communication through immersive daily dialogue and confidence-building drills.',
      tag: 'Core Focus',
      stats: '150+ Enrolled',
      gradientBg: 'from-purple-100/90 via-violet-50 to-purple-200/60',
      tilt: '-rotate-[1.4deg]',
      examples: ['Overcoming Hesitation', 'Fluency Drills', 'Spontaneous Speaking'],
    },
    {
      num: '02',
      title: 'Vocabulary',
      subtitle: 'Thematic Word Mastery',
      quote: 'Learn useful high-frequency words, collocations, and idioms to express nuance naturally.',
      description: 'Expand your vocabulary bank with real-life idioms, professional collocations, and contextual expressions.',
      tag: 'Practical Usage',
      stats: '120+ Enrolled',
      gradientBg: 'from-indigo-100/90 via-violet-50 to-purple-200/60',
      tilt: 'rotate-[1.2deg]',
      examples: ['High-Frequency Words', 'Everyday Collocations', 'Idiomatic Expressions'],
    },
    {
      num: '03',
      title: 'Conversation',
      subtitle: 'Situational Dialogues',
      quote: 'Practise real-life conversations, simulated role-plays, and everyday situational peer speaking.',
      description: 'Engage in natural, spontaneous conversations for meetings, small talk, social events, and daily travel.',
      tag: 'Interactive',
      stats: '140+ Enrolled',
      gradientBg: 'from-fuchsia-100/90 via-purple-50 to-violet-200/60',
      tilt: '-rotate-[0.8deg]',
      examples: ['Small Talk', 'Situational Dialogues', 'Peer Practice'],
    },
    {
      num: '04',
      title: 'Grammar',
      subtitle: 'Tenses & Syntax Simplified',
      quote: 'Understand grammatical structure through intuitive, practical examples without dry rote rules.',
      description: 'Eliminate common speaking errors and construct fluent sentences through practical conversational logic.',
      tag: 'Rule-Free Context',
      stats: '135+ Enrolled',
      gradientBg: 'from-violet-100/90 via-purple-50 to-indigo-200/60',
      tilt: 'rotate-[1.4deg]',
      examples: ['Sentence Patterns', 'Tenses in Daily Life', 'Error Elimination'],
    },
    {
      num: '05',
      title: 'Pronunciation',
      subtitle: 'Audio Clarity & Accent',
      quote: 'Improve listening comprehension, mouth articulation, syllable stress, and speech rhythm.',
      description: 'Neutralize mother tongue influence (MTI), master phonetic clarity, and speak with crisp articulation.',
      tag: 'Audio Clarity',
      stats: '110+ Enrolled',
      gradientBg: 'from-teal-100/90 via-emerald-50 to-purple-200/60',
      tilt: '-rotate-[1.2deg]',
      examples: ['MTI Reduction', 'Phonetics & Intonation', 'Clear Articulation'],
    },
    {
      num: '06',
      title: 'Communication',
      subtitle: 'Confidence & Impact',
      quote: 'Build unshakable poise to articulate ideas persuasively in meetings, interviews, and public stages.',
      description: 'Develop executive presence, presentation mastery, active listening, and confident body language.',
      tag: 'Confidence',
      stats: '160+ Enrolled',
      gradientBg: 'from-rose-100/90 via-purple-50 to-violet-200/60',
      tilt: 'rotate-[0.8deg]',
      examples: ['Self-Expression', 'Public Speaking', 'Interview Preparedness'],
    },
  ];

  return (
    <section id="what-we-teach" className="py-20 sm:py-28 bg-[#FAF9FD] relative overflow-hidden border-b border-purple-100/80">
      
      {/* Background ambient royal purple glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-purple-200/30 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Centered Heading Only (All extra tags and side text removed as requested) */}
        <div className="text-center mb-14 sm:mb-18">
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B26] tracking-tight">
            What we teach <span className="text-[#4A1D96]">for real fluency.</span>
          </h2>
        </div>

        {/* 6 Cards hanging in a 3-column grid (with suspended wire, clips, and 3D flip) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-16 gap-x-8 sm:gap-x-10">
          {learningPillars.map((pillar, idx) => {
            const isFlipped = !!flippedCards[idx];

            return (
              <div 
                key={pillar.title} 
                className="relative flex flex-col items-center group"
                style={{ perspective: '1200px' }}
              >
                {/* Overhead Wire & Suspension Clip (Matching the hanging badge wire from Reference Image 1) */}
                <div className="w-full flex flex-col items-center pointer-events-none relative mb-[-8px] z-20">
                  {/* Subtle curved wire line segment */}
                  <div className="w-full h-4 border-b border-slate-300 relative">
                    <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-400 border border-slate-500 shadow-xs" />
                  </div>
                  {/* Vertical drop cable */}
                  <div className="w-0.5 h-6 bg-slate-300 group-hover:bg-purple-400 transition-colors" />
                  {/* Metallic Hanging Clip */}
                  <div className="w-3.5 h-4.5 border-2 border-slate-400 group-hover:border-purple-600 rounded-t-full relative -top-1 bg-white shadow-2xs transition-colors" />
                </div>

                {/* The 3D Flippable Hanging Badge Container */}
                <div
                  onClick={() => toggleCardFlip(idx)}
                  className={`w-full max-w-[340px] sm:max-w-[360px] cursor-pointer transition-transform duration-500 ease-out ${pillar.tilt} group-hover:rotate-0 group-hover:-translate-y-2`}
                  style={{
                    transformStyle: 'preserve-3d',
                  }}
                  title="Click to flip badge"
                >
                  <div
                    className="relative w-full transition-transform duration-700"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >

                    {/* ============================================================== */}
                    {/* FRONT FACE (Matching Cards 1, 2, 4 in Reference Image 1)      */}
                    {/* ============================================================== */}
                    <div
                      className="w-full bg-white rounded-[26px] p-5 sm:p-6 border border-purple-200/70 shadow-[0_12px_36px_-10px_rgba(32,11,59,0.09)] group-hover:shadow-[0_20px_45px_-10px_rgba(74,29,150,0.18)] transition-all relative overflow-hidden flex flex-col justify-between"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        minHeight: '480px',
                      }}
                    >
                      {/* Top Centered Eyelet / Hole (Lanyard punch hole from Reference Image 1) */}
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-slate-300 bg-slate-100/90 shadow-inner z-10 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400/80" />
                      </div>

                      {/* Top Metadata Row: MODULE / 01 on left, #01 on right */}
                      <div className="flex items-center justify-between text-xs pt-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-slate-400">
                          CURRICULUM / MODULE
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#4A1D96] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/70">
                          #{pillar.num}
                        </span>
                      </div>

                      {/* Large 3D Illustration Container (Matching 3D Avatar box in Reference Image 1) */}
                      <div className={`w-full aspect-[4/3.1] rounded-[20px] bg-gradient-to-b ${pillar.gradientBg} relative mt-3 mb-4 flex items-center justify-center overflow-hidden border border-purple-200/50 shadow-inner group-hover:scale-[1.02] transition-transform duration-300`}>
                        {/* Shimmer overlay effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                        
                        {/* 3D Clay Character Avatar */}
                        <CharacterAvatar type={idx + 1} />

                        {/* Top-Right Badge inside photo frame */}
                        <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wider bg-white/85 backdrop-blur-sm text-[#4A1D96] border border-purple-300/60 px-2 py-0.5 rounded-full shadow-2xs">
                          {pillar.tag}
                        </span>
                      </div>

                      {/* Card Identity & Subtitle (Matching Maya Bennett / Role in Reference Image 1) */}
                      <div className="space-y-1">
                        <h3 className="font-['Outfit'] font-extrabold text-xl sm:text-2xl text-[#1E1B26] tracking-tight group-hover:text-[#4A1D96] transition-colors flex items-center justify-between">
                          <span>{pillar.title}</span>
                          <span className="text-xs font-mono font-medium text-slate-400 font-normal">
                            {pillar.stats}
                          </span>
                        </h3>
                        <p className="text-xs sm:text-[13px] font-medium text-slate-500 leading-relaxed">
                          {pillar.subtitle}
                        </p>
                      </div>

                      {/* 3 Curriculum Highlight Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-3 mt-1">
                        {pillar.examples.map((ex) => (
                          <span
                            key={ex}
                            className="px-2.5 py-1 rounded-full bg-purple-50/80 border border-purple-200/60 text-[10.5px] font-semibold text-purple-900 whitespace-nowrap"
                          >
                            {ex}
                          </span>
                        ))}
                      </div>

                      {/* Card Footer Bar: VIEW DETAILS + Circular Action Button (Matching Reference Image 1) */}
                      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-slate-400 group-hover:text-[#4A1D96] transition-colors flex items-center gap-1">
                          <span>VIEW DETAILS</span>
                          <span className="text-[9px] text-purple-600 font-mono">(TAP TO FLIP)</span>
                        </span>

                        <div className="w-7 h-7 rounded-full bg-[#200B3B] text-white flex items-center justify-center group-hover:bg-[#4A1D96] group-hover:scale-110 transition-all shadow-sm">
                          <RotateCw className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    {/* ============================================================== */}
                    {/* BACK FACE (Matching Flipped Noah Williams Card in Image 1)     */}
                    {/* ============================================================== */}
                    <div
                      className="absolute inset-0 w-full h-full rounded-[26px] p-5 sm:p-6 bg-gradient-to-br from-[#FAF5FF] via-[#F3E8FF] to-[#EDE9FE] border border-purple-300/80 shadow-[0_16px_40px_-10px_rgba(74,29,150,0.2)] flex flex-col justify-between overflow-hidden"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      {/* Top Centered Eyelet */}
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-purple-300 bg-white/90 shadow-inner z-10 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400/80" />
                      </div>

                      {/* Top Header Row with Flip-Back Action */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-purple-900/60">
                          CURRICULUM / {pillar.num}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/80 border border-purple-300/70 flex items-center justify-center text-purple-700 shadow-2xs hover:scale-110 transition-transform">
                          <RotateCcw className="w-3 h-3" />
                        </div>
                      </div>

                      {/* Mini Avatar & Identity Header (Matching Noah Williams top row) */}
                      <div className="flex items-center gap-3 pt-2">
                        <div className="w-10 h-10 rounded-full bg-[#200B3B] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-purple-300/80">
                          #{pillar.num}
                        </div>
                        <div>
                          <h4 className="font-['Outfit'] font-bold text-base text-[#1E1B26] leading-tight">
                            {pillar.title}
                          </h4>
                          <span className="text-[11px] font-medium text-purple-700">
                            {pillar.subtitle}
                          </span>
                        </div>
                      </div>

                      {/* Quoted Philosophy (Matching quote text in Reference Image 1) */}
                      <div className="bg-white/70 backdrop-blur-sm p-3 rounded-xl border border-purple-200/80 my-2">
                        <p className="text-xs text-purple-950 font-medium leading-relaxed italic">
                          "{pillar.quote}"
                        </p>
                      </div>

                      {/* Selected Topics List (Matching "SELECTED PROJECTS" in Reference Image 1) */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-purple-900/70 uppercase">
                          SELECTED TOPICS
                        </span>
                        <div className="space-y-1 bg-white/40 p-2.5 rounded-lg border border-purple-200/50">
                          {pillar.examples.map((ex) => (
                            <div key={ex} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                              <span>{ex}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Row: Link / Connect + Mini QR Code (Matching Reference Image 1) */}
                      <div className="pt-2 border-t border-purple-300/50 flex items-center justify-between">
                        <div>
                          <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-purple-800/70">
                            START PRACTICE
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSubject?.(pillar.title);
                            }}
                            className="text-xs font-bold text-[#4A1D96] hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>Enroll in Module</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mini QR Code (Matching Noah Williams card bottom-right in Image 1) */}
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 p-1 bg-white rounded-lg border border-purple-300/80 shadow-2xs flex items-center justify-center">
                            {/* Geometric crisp SVG QR badge */}
                            <svg viewBox="0 0 24 24" className="w-full h-full text-[#200B3B]" fill="currentColor">
                              <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14-2h4v4h-4v-4zm-4 4h4v4h-4v-4zm4 4h4v4h-4v-4zm-4-8h4v4h-4v-4z" />
                            </svg>
                          </div>
                          <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-purple-700/80 mt-0.5">
                            SCAN ME
                          </span>
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Bottom Bar (Matching Reference Image 1 bottom footer) */}
        <div className="mt-16 pt-8 border-t border-purple-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-3">
          <span className="uppercase tracking-wider">
            THE RIGHT METHOD MAKES FLUENCY NATURAL
          </span>
          <span className="font-semibold text-purple-700 flex items-center gap-1.5 bg-purple-50 px-3 py-1 rounded-full border border-purple-200/80">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span>HOVER TO SHIMMER · CLICK / TAP TO FLIP</span>
          </span>
        </div>

      </div>
    </section>
  );
};
