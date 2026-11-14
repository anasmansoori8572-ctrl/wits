import React, { useRef } from 'react';
import { Youtube, Play, ArrowUpRight, Clock, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface YouTubeSectionProps {
  siteSettings?: import('../types').SiteSettings;
  materials?: import('../types').StudyMaterial[];
}

export const YouTubeSection: React.FC<YouTubeSectionProps> = ({ siteSettings, materials = [] }) => {
  const channelUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollVideos = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const videoCards = materials
    .filter(m => (m.resourceType === 'youtube' || Boolean(m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  return (
    <section className="py-20 bg-[#FAF8FD] border-b border-purple-100/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#4A1D96] text-xs font-bold uppercase tracking-wider border border-purple-200/80">
              <Youtube className="w-3.5 h-3.5 fill-red-600 text-red-600" />
              <span>Official Video Channel</span>
            </div>
            <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1E1B26]">
              Learn English With Wits Lingo
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl">
              Watch bite-sized lessons, clear explanations, and interactive speaking dialogues designed to build your fluency anytime.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            {/* Carousel Left / Right Navigation Arrows */}
            {videoCards.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollVideos('left')}
                  aria-label="Previous videos"
                  className="w-10 h-10 rounded-full border border-purple-200 bg-white hover:bg-[#4A1D96] hover:text-white text-[#281648] shadow-xs flex items-center justify-center transition-all cursor-pointer hover:shadow-md hover:border-[#4A1D96]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollVideos('right')}
                  aria-label="Next videos"
                  className="w-10 h-10 rounded-full border border-purple-200 bg-white hover:bg-[#4A1D96] hover:text-white text-[#281648] shadow-xs flex items-center justify-center transition-all cursor-pointer hover:shadow-md hover:border-[#4A1D96]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(channelUrl, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-red-600/25 cursor-pointer"
            >
              <Youtube className="w-4 h-4 fill-white" />
              <span>Visit YouTube Channel</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Dynamic Video Cards Carousel (Synthesia Portrait Story Card Design in Purple Brand Theme) */}
        {videoCards.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-purple-200">
            <Youtube className="w-12 h-12 text-red-500/60 mx-auto mb-3" />
            <h4 className="font-['Outfit'] font-bold text-slate-800 text-base mb-1">Video lessons coming soon</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
              Subscribe to the official Wits Lingo YouTube channel to get notified when new spoken English lessons and dialogues are published.
            </p>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(channelUrl, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition-all cursor-pointer"
            >
              <Youtube className="w-4 h-4 fill-white" />
              <span>Visit Official YouTube Channel</span>
            </a>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-5 sm:gap-6 overflow-x-auto pb-6 pt-2 px-1 scroll-smooth scrollbar-none snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {videoCards.map((video, index) => {
              const finalYoutubeUrl = video.youtubeUrl || channelUrl;
              const thumb = video.thumbnailUrl;
              const fallbackBg = [
                'from-[#281648] via-[#3C166D] to-[#12072B]',
                'from-[#1E0E38] via-[#4A1D96] to-[#0F071D]',
                'from-[#2E1065] via-[#3B0764] to-[#150626]',
                'from-[#3C166D] via-[#281648] to-[#140824]'
              ][index % 4];

              return (
                <a
                  key={video.id}
                  href={finalYoutubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(finalYoutubeUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="group relative flex-shrink-0 w-[285px] sm:w-[320px] h-[460px] sm:h-[490px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl hover:shadow-purple-950/30 border border-purple-200/50 hover:border-purple-400 transition-all duration-300 flex flex-col justify-between cursor-pointer block no-underline text-inherit snap-start transform hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                >
                  {/* 1. Full-bleed Thumbnail Image */}
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}

                  {/* Fallback gradient if no image */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${fallbackBg} ${thumb ? '-z-10' : ''} flex items-center justify-center`}>
                    <Youtube className="w-16 h-16 text-purple-300/30" />
                  </div>

                  {/* 2. Sleek Theme Shading Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/35 group-hover:via-black/35 transition-colors" />
                  <div className="absolute inset-0 bg-purple-950/15 group-hover:bg-purple-950/25 transition-colors" />

                  {/* 3. Top Badges */}
                  <div className="relative z-10 p-5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-black/60 text-purple-200 backdrop-blur-md border border-purple-400/30 shadow-xs flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-300" />
                      <span>{video.category || 'Spoken English'}</span>
                    </span>

                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-xs flex items-center gap-1.5">
                      <Youtube className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      <span>Wits Lingo</span>
                    </span>
                  </div>

                  {/* 4. Center Glowing Play Button */}
                  <div className="relative z-10 flex items-center justify-center my-auto py-2">
                    <div className="w-14 h-14 rounded-full bg-white text-[#281648] flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-purple-50 transition-all duration-300 ring-4 ring-white/30 group-hover:ring-purple-400/50 backdrop-blur-xs">
                      <Play className="w-6 h-6 fill-[#281648] text-[#281648] ml-0.5" />
                    </div>
                  </div>

                  {/* 5. Bottom Dark Vignette Content */}
                  <div className="relative z-10 p-5 sm:p-6 space-y-3 mt-auto bg-gradient-to-t from-black/95 via-black/80 to-transparent rounded-b-3xl">
                    <h4 className="font-['Outfit'] font-bold text-base sm:text-lg text-white leading-snug line-clamp-2 drop-shadow-sm group-hover:text-purple-200 transition-colors">
                      “{video.title}”
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-purple-200/90 font-medium flex-wrap">
                      <span>Ziyaur Rehman Zia</span>
                      <span>•</span>
                      <span>Lead Mentor</span>
                      {video.duration && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-white/95">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                          </span>
                        </>
                      )}
                    </div>

                    {/* 6. White Pill Button (Synthesia "Play story" style in Wits Lingo theme) */}
                    <div className="w-full py-2.5 px-4 rounded-full bg-white group-hover:bg-purple-50 text-[#281648] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg group-hover:shadow-white/20 transition-all active:scale-98">
                      <Youtube className="w-4 h-4 fill-red-600 text-red-600" />
                      <span>Watch on YouTube</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#281648] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
