import React, { useState } from 'react';
import { 
  Youtube, Share2, MessageCircle, Laptop, FileText, Sparkles, 
  ArrowRight, ExternalLink, ArrowUpRight 
} from 'lucide-react';
import { SiteSettings } from '../types';
import { SocialMediaModal } from './SocialMediaModal';

interface DigitalLearningProps {
  onFollow?: () => void;
  siteSettings?: SiteSettings;
  onOpenAdmission?: (courseId?: string) => void;
  onOpenAuth?: () => void;
}

export const DigitalLearning: React.FC<DigitalLearningProps> = ({ 
  onFollow, 
  siteSettings,
  onOpenAdmission,
  onOpenAuth 
}) => {
  const [socialModalOpen, setSocialModalOpen] = useState(false);

  const whatsappUrl = siteSettings?.whatsappChannelUrl || 'https://whatsapp.com/channel/0029VbDjNY9InlqQJsC6G02Y';
  const youtubeUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';

  const channels = [
    {
      id: 'youtube',
      title: 'YouTube',
      desc: 'Free video lessons, pronunciation guides, and daily spoken tips.',
      icon: Youtube,
      color: 'text-red-600 bg-red-50 border-red-100 group-hover:bg-red-600 group-hover:text-white',
      badge: 'Video Channel',
      actionType: 'link',
      url: youtubeUrl,
      actionLabel: 'Watch Channel',
    },
    {
      id: 'social-media',
      title: 'Social Media',
      desc: 'Daily vocabulary cards, idioms, interactive quizzes on Instagram & Facebook.',
      icon: Share2,
      color: 'text-pink-600 bg-pink-50 border-pink-100 group-hover:bg-pink-600 group-hover:text-white',
      badge: 'Instagram & FB',
      actionType: 'modal',
      actionLabel: 'View Channels',
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Channel',
      desc: 'Daily sentences, audio snippets, and course alerts directly to your phone.',
      icon: MessageCircle,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
      badge: 'Instant Alerts',
      actionType: 'link',
      url: whatsappUrl,
      actionLabel: 'Join Channel',
    },
    {
      id: 'online-classes',
      title: 'Online Classes',
      desc: 'Live interactive video sessions with real-time feedback from Zia Sir.',
      icon: Laptop,
      color: 'text-purple-600 bg-purple-50 border-purple-100 group-hover:bg-purple-600 group-hover:text-white',
      badge: 'Live Interactive',
      actionType: 'admission',
      actionLabel: 'Explore Courses',
    },
    {
      id: 'materials',
      title: 'Digital Learning Materials',
      desc: 'Downloadable PDF cheat sheets, conversation scripts, and worksheets.',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50 border-blue-100 group-hover:bg-blue-600 group-hover:text-white',
      badge: 'Free PDFs',
      actionType: 'scroll-resources',
      actionLabel: 'Open Library',
    },
    {
      id: 'future-courses',
      title: 'Future Online Courses',
      desc: 'Self-paced modules, certified masterclasses, and corporate modules.',
      icon: Sparkles,
      color: 'text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-600 group-hover:text-white',
      badge: 'Coming Soon',
      actionType: 'admission',
      actionLabel: 'Pre-register',
    },
  ];

  const handleCardClick = (ch: typeof channels[0]) => {
    if (ch.actionType === 'modal') {
      setSocialModalOpen(true);
    } else if (ch.actionType === 'link' && ch.url) {
      window.open(ch.url, '_blank', 'noopener,noreferrer');
    } else if (ch.actionType === 'scroll-resources') {
      const el = document.getElementById('resources');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else if (onFollow) {
        onFollow();
      }
    } else if (ch.actionType === 'admission') {
      if (onOpenAdmission) {
        onOpenAdmission();
      } else {
        const el = document.getElementById('courses');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="py-20 bg-white border-b border-purple-50" id="digital-learning">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-[#581C87]">
            Flexible Digital Reach
          </span>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1E1B26]">
            Learn Wherever You Are.
          </h2>
          <p className="text-base text-slate-600">
            Wits Lingo is expanding learning beyond physical classrooms to make quality spoken English accessible to every eager learner in India and beyond.
          </p>
        </div>

        {/* 6 Channels Interactive Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((ch) => {
            const Icon = ch.icon;
            return (
              <div
                key={ch.id}
                onClick={() => handleCardClick(ch)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(ch);
                  }
                }}
                className="p-6 rounded-2xl bg-[#FAF9FC] hover:bg-white border border-slate-100 hover:border-purple-300 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group cursor-pointer text-left relative overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors duration-200 ${ch.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-['Outfit'] text-lg font-bold text-[#1E1B26] group-hover:text-[#4A1D96] transition-colors">
                        {ch.title}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-[#4A1D96] border border-purple-100 flex-shrink-0">
                        {ch.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {ch.desc}
                    </p>
                  </div>
                </div>

                {/* Card Action Link / Indicator */}
                <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs font-bold text-[#4A1D96] group-hover:text-[#3B0764]">
                  <span className="flex items-center gap-1">
                    {ch.actionLabel}
                  </span>
                  <span className="w-7 h-7 rounded-full bg-purple-50 group-hover:bg-[#4A1D96] group-hover:text-white flex items-center justify-center transition-all duration-200">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setSocialModalOpen(true)}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold tracking-wide shadow-md shadow-purple-900/15 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Follow Wits Lingo Channels</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#community"
            onClick={onFollow}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-purple-50 hover:bg-purple-100 text-[#4A1D96] border border-purple-200 text-xs font-bold tracking-wide transition-colors cursor-pointer"
          >
            <span>View Community Hub</span>
          </a>
        </div>

      </div>

      {/* Interactive Social Media Hub Modal */}
      <SocialMediaModal
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        siteSettings={siteSettings}
        onOpenAdmission={onOpenAdmission ? () => onOpenAdmission() : undefined}
      />
    </section>
  );
};
