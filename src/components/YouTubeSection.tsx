import React from 'react';
import { Youtube } from 'lucide-react';

interface YouTubeSectionProps {
  siteSettings?: import('../types').SiteSettings;
  materials?: import('../types').StudyMaterial[];
}

export const YouTubeSection: React.FC<YouTubeSectionProps> = ({ siteSettings, materials = [] }) => {
  const channelUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';

  const videoCards = materials
    .filter(m => (m.resourceType === 'youtube' || Boolean(m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  const marqueeVideos = React.useMemo(() => {
    if (videoCards.length === 0) return [];
    let base = [...videoCards];
    while (base.length < 6) {
      base = [...base, ...videoCards];
    }
    return [...base, ...base];
  }, [videoCards]);

  return (
    <section className="py-16 sm:py-20 bg-[#FAF8FD] border-b border-purple-100/70 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Centered Heading */}
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1E1B26] text-center tracking-tight mb-8 sm:mb-12">
          Learn English With <span className="bg-gradient-to-r from-[#281648] via-[#4A1D96] to-[#7C3AED] bg-clip-text text-transparent">Wits Lingo</span>
        </h2>

        {/* Dynamic Video Cards (Automatic Slide Left Animation) */}
        {videoCards.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-purple-200 max-w-xl mx-auto">
            <Youtube className="w-12 h-12 text-red-500/60 mx-auto mb-3" />
            <h4 className="font-['Outfit'] font-bold text-slate-800 text-base mb-1">Video lessons coming soon</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Subscribe to the official Wits Lingo YouTube channel to get notified when new lessons are published.
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden py-3">
            {/* Continuous Slide-Left Track */}
            <div className="animate-slide-left flex gap-5 sm:gap-6">
              {marqueeVideos.map((video, idx) => {
                const finalYoutubeUrl = video.youtubeUrl || channelUrl;
                const thumb = video.thumbnailUrl;
                const fallbackBg = [
                  'from-[#281648] via-[#3C166D] to-[#12072B]',
                  'from-[#1E0E38] via-[#4A1D96] to-[#0F071D]',
                  'from-[#2E1065] via-[#3B0764] to-[#150626]',
                  'from-[#3C166D] via-[#281648] to-[#140824]'
                ][idx % 4];

                return (
                  <a
                    key={`${video.id}-${idx}`}
                    href={finalYoutubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(finalYoutubeUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="relative flex-shrink-0 w-[270px] sm:w-[310px] md:w-[330px] h-[390px] sm:h-[440px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group cursor-pointer block border border-purple-100/70"
                  >
                    {/* Full-bleed Thumbnail */}
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}

                    <div className={`absolute inset-0 bg-gradient-to-br ${fallbackBg} ${thumb ? '-z-10' : ''} flex items-center justify-center`}>
                      <span className="text-white/80 font-bold text-sm">Wits Lingo</span>
                    </div>

                    {/* Dark Vignette Overlay for Title Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                    {/* Video Title on Video */}
                    <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10 pointer-events-none">
                      <p className="font-['Outfit'] font-bold text-base sm:text-lg text-white leading-snug drop-shadow-md line-clamp-2">
                        “{video.title}”
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
