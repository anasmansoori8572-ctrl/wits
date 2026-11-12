import React, { useState } from 'react';
import { Youtube, Play, ArrowUpRight, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

interface YouTubeSectionProps {
  siteSettings?: import('../types').SiteSettings;
  materials?: import('../types').StudyMaterial[];
}

export const YouTubeSection: React.FC<YouTubeSectionProps> = ({ siteSettings, materials = [] }) => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  useScrollLock(Boolean(selectedVideo));
  const channelUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';

  const videoCards = materials
    .filter(m => (m.resourceType === 'youtube' || Boolean(m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  return (
    <section className="py-20 bg-[#FAF8FD] border-b border-purple-100/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider">
              <Youtube className="w-3.5 h-3.5 text-red-600" />
              <span>Official Video Channel</span>
            </div>
            <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1E1B26]">
              Learn English With Wits Lingo
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl">
              Watch bite-sized lessons, clear explanations, and interactive speaking dialogues designed to build your fluency anytime.
            </p>
          </div>

          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs self-start md:self-auto cursor-pointer"
          >
            <Youtube className="w-4 h-4" />
            <span>Watch on YouTube →</span>
          </a>
        </div>

        {/* Video Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {videoCards.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-2xl border border-purple-100 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col group"
            >
              {/* Thumbnail Simulation */}
              <div
                onClick={() => setSelectedVideo(video.title)}
                className={`relative aspect-video bg-gradient-to-br ${(video as any).thumbnailBg || 'from-purple-900 to-indigo-900'} p-3 flex flex-col justify-between cursor-pointer overflow-hidden`}
              >
                <div className="flex justify-between items-start z-10">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-purple-200 border border-white/10">
                    {video.category}
                  </span>
                  <span className="text-[10px] font-mono text-white/90 bg-black/70 px-1.5 py-0.5 rounded">
                    {video.duration}
                  </span>
                </div>

                <div className="z-10 flex items-center justify-center py-2">
                  <div className="w-10 h-10 rounded-full bg-red-600/90 group-hover:bg-red-600 group-hover:scale-110 text-white flex items-center justify-center shadow-lg transition-all">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>

                <div className="z-10 flex items-center justify-between text-[10px] text-white/80">
                  <span className="font-semibold">Wits Lingo</span>
                  <span>{video.views}</span>
                </div>

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </div>

              {/* Video Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">
                    {video.category}
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-1 line-clamp-2 group-hover:text-[#4A1D96] transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {video.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => setSelectedVideo(video.title)}
                    className="text-[#4A1D96] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Watch Lesson</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <span className="text-slate-400 font-medium">Free</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Video Preview Modal (When clicked) */}
        {selectedVideo && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 overscroll-contain max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {selectedVideo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2"
                >
                  ✕
                </button>
              </div>

              <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white p-6 text-center space-y-3 relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg animate-pulse">
                  <Play className="w-7 h-7 fill-white ml-1" />
                </div>
                <div>
                  <p className="font-bold text-base">{selectedVideo}</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Lesson by Ziyaur Rehman Zia • Wits Lingo Academy
                  </p>
                </div>
                <span className="text-[11px] text-purple-300 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800">
                  Subscribed to Wits Lingo YouTube Channel
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">
                  Full library accessible on YouTube. For live speaking courses, join Wits Lingo Academy.
                </span>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="px-4 py-2 bg-[#4A1D96] text-white rounded-lg font-bold"
                >
                  Close Player
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
