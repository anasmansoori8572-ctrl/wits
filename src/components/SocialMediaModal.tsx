import React from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, ExternalLink, MessageCircle, Instagram, Facebook, 
  Youtube, Sparkles, CheckCircle2, ArrowRight, BookOpen, Users
} from 'lucide-react';
import { SiteSettings } from '../types';

interface SocialMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSettings?: SiteSettings;
  onOpenAdmission?: () => void;
}

export const SocialMediaModal: React.FC<SocialMediaModalProps> = ({
  isOpen,
  onClose,
  siteSettings,
  onOpenAdmission,
}) => {
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const whatsappUrl = siteSettings?.whatsappChannelUrl || 'https://whatsapp.com/channel/0029VbDjNY9InlqQJsC6G02Y';
  const instagramUrl = siteSettings?.instagramUrl || 'https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA==';
  const facebookUrl = siteSettings?.facebookUrl || 'https://www.facebook.com/share/1BP5jTfk9B/';
  const youtubeUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';

  const channels = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Channel',
      tagline: 'Instant audio snippets, daily expressions & course alerts',
      url: whatsappUrl,
      buttonText: 'Join WhatsApp Channel',
      icon: MessageCircle,
      badge: 'Most Popular',
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      accent: 'border-emerald-200 bg-emerald-50/40 text-emerald-800',
      iconBg: 'bg-emerald-100 text-emerald-700',
      stats: 'Daily 9:00 AM Tips'
    },
    {
      id: 'instagram',
      name: 'Instagram (@witslingo)',
      tagline: 'Vocabulary reels, pronunciation drills & live Q&A sessions',
      url: instagramUrl,
      buttonText: 'Follow on Instagram',
      icon: Instagram,
      badge: 'Active Community',
      color: 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white',
      accent: 'border-pink-200 bg-pink-50/30 text-purple-900',
      iconBg: 'bg-pink-100 text-pink-700',
      stats: 'Daily Interactive Stories'
    },
    {
      id: 'facebook',
      name: 'Facebook Page',
      tagline: 'Detailed lesson summaries, student accomplishments & academy notices',
      url: facebookUrl,
      buttonText: 'Follow on Facebook',
      icon: Facebook,
      badge: 'Official Page',
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      accent: 'border-blue-200 bg-blue-50/40 text-blue-900',
      iconBg: 'bg-blue-100 text-blue-700',
      stats: 'Community Discussions'
    },
    {
      id: 'youtube',
      name: 'YouTube Channel',
      tagline: 'Full structured masterclasses, grammar guides & speaking lessons',
      url: youtubeUrl,
      buttonText: 'Subscribe on YouTube',
      icon: Youtube,
      badge: 'Video Masterclasses',
      color: 'bg-red-600 hover:bg-red-700 text-white',
      accent: 'border-red-200 bg-red-50/40 text-red-900',
      iconBg: 'bg-red-100 text-red-700',
      stats: 'HD Spoken Lessons'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-purple-100 flex flex-col overscroll-contain smooth-scroll-viewport"
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-modal-title"
      >
        {/* Header */}
        <div className="p-6 sm:p-7 bg-gradient-to-br from-[#3B0764] via-[#4A1D96] to-[#2E1065] text-white relative rounded-t-3xl overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-purple-200 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3 text-purple-300" />
                <span>Connect with Wits Lingo</span>
              </div>
              <h2 id="social-modal-title" className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-white">
                Official Social Media Channels
              </h2>
              <p className="text-xs sm:text-sm text-purple-200 mt-1 max-w-md">
                Follow our official channels for daily English practice, vocabulary challenges, audio drills, and live course updates.
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ml-3"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Channel Cards Grid */}
        <div className="p-6 sm:p-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((ch) => {
              const Icon = ch.icon;
              return (
                <div
                  key={ch.id}
                  className={`p-4.5 rounded-2xl border ${ch.accent} flex flex-col justify-between space-y-3 transition-all hover:shadow-md`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ch.iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white border border-purple-100 text-slate-700 shadow-2xs">
                        {ch.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                        {ch.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {ch.tagline}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{ch.stats}</span>
                    </div>
                  </div>

                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-transform transform active:scale-95 cursor-pointer ${ch.color}`}
                  >
                    <span>{ch.buttonText}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>

          {/* Bottom notice & Admission CTA */}
          <div className="mt-5 p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-200 text-[#4A1D96] flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Want live speaking feedback from Zia Sir?</p>
                <p className="text-[11px] text-slate-600">Join our interactive live online courses with daily spoken drills.</p>
              </div>
            </div>

            {onOpenAdmission && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmission();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0 shadow-xs"
              >
                <span>Apply for Admission</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
