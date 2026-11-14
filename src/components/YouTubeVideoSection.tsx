import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Globe, Youtube, Play, Users, ExternalLink, 
  Sparkles, ChevronLeft, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { StudyMaterial, SiteSettings } from '../types';

export function extractYouTubeThumb(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return undefined;
}

export function normalizeAndValidateYouTubeUrl(rawUrl?: string, fallbackUrl = 'https://youtube.com/@witslingoeng'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallbackUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallbackUrl;

  if (
    trimmed === 'https://www.youtube.com/@witslingoeng' ||
    trimmed === 'https://youtube.com/@witslingoeng' ||
    trimmed === 'https://www.youtube.com/@witslingoeng/' ||
    trimmed === 'https://youtube.com/@witslingoeng/' ||
    (trimmed.includes('@witslingo') && !trimmed.includes('@witslingoeng'))
  ) {
    return 'https://youtube.com/@witslingoeng';
  }

  const match = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (match && match[1]) {
    if (trimmed.includes('/shorts/')) {
      return `https://www.youtube.com/shorts/${match[1]}`;
    }
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }

  if (trimmed.includes('youtube.com/@') || trimmed.includes('youtube.com/channel/') || trimmed.includes('youtube.com/c/')) {
    if (trimmed.toLowerCase().includes('@witslingo') && !trimmed.toLowerCase().includes('@witslingoeng')) {
      return 'https://youtube.com/@witslingoeng';
    }
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }

  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

interface YouTubeVideoSectionProps {
  materials?: StudyMaterial[];
  siteSettings?: SiteSettings;
}

// Fallback high-quality lesson videos if none loaded from database
const DEFAULT_VIDEOS = [
  {
    id: 'yt-def-1',
    title: 'Sound of C as “K” and “S”',
    shortTitle: 'PHONICS & SOUNDS',
    category: 'Pronunciation & Phonics',
    description: "Master the pronunciation rules of the letter 'C' producing /k/ and /s/ sounds in spoken English conversation.",
    views: '2.4K',
    duration: '00:58',
    badge: 'HD LESSON',
    youtubeUrl: 'https://www.youtube.com/watch?v=ZFuoc6aEn3w',
    thumbnailUrl: 'https://img.youtube.com/vi/ZFuoc6aEn3w/hqdefault.jpg'
  },
  {
    id: 'yt-def-2',
    title: 'English & Society 🫣😅 | Fluency Importance',
    shortTitle: 'DAILY FLUENCY',
    category: 'Spoken English & Fluency',
    description: 'Why spoken English fluency is crucial in modern professional, social, and academic settings.',
    views: '3.8K',
    duration: '00:55',
    badge: 'MUST WATCH',
    youtubeUrl: 'https://www.youtube.com/watch?v=Xk1gQdbSYic',
    thumbnailUrl: 'https://img.youtube.com/vi/Xk1gQdbSYic/hqdefault.jpg'
  },
  {
    id: 'yt-def-3',
    title: "Why You Can't Improve Your English",
    shortTitle: 'LEARNING MINDSET',
    category: 'Fluency Psychology',
    description: 'Core psychological and habit mistakes that hold back English learners from achieving natural spontaneous speech.',
    views: '4.1K',
    duration: '00:59',
    badge: 'MINDSET',
    youtubeUrl: 'https://www.youtube.com/watch?v=mImWmss_7Gw',
    thumbnailUrl: 'https://img.youtube.com/vi/mImWmss_7Gw/hqdefault.jpg'
  },
  {
    id: 'yt-def-4',
    title: "Choose The Right Way to Learn English",
    shortTitle: 'CORE BLUEPRINT',
    category: 'Structured Learning',
    description: 'Step-by-step guidance on choosing the right structured approach to learn English speaking effectively.',
    views: '2.9K',
    duration: '00:52',
    badge: 'GUIDE',
    youtubeUrl: 'https://www.youtube.com/watch?v=K8PYUbGdazY',
    thumbnailUrl: 'https://img.youtube.com/vi/K8PYUbGdazY/hqdefault.jpg'
  },
  {
    id: 'yt-def-5',
    title: 'Bhai, English Seekho, Chahen Jaha Se Seekho',
    shortTitle: 'HABIT BUILDING',
    category: 'Speaking Practice',
    description: 'Practical encouragement and actionable habits to build everyday English speaking routines without hesitation.',
    views: '5.2K',
    duration: '00:48',
    badge: 'PRACTICE',
    youtubeUrl: 'https://www.youtube.com/watch?v=8yfe0F74q6M',
    thumbnailUrl: 'https://img.youtube.com/vi/8yfe0F74q6M/hqdefault.jpg'
  }
];

export const YouTubeVideoSection: React.FC<YouTubeVideoSectionProps> = ({
  materials: propMaterials = [],
  siteSettings,
}) => {
  const [backendMaterials, setBackendMaterials] = useState<StudyMaterial[]>(() => {
    if (propMaterials && propMaterials.length > 0) return propMaterials;
    try {
      const saved = localStorage.getItem('wits_lingo_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (propMaterials && propMaterials.length > 0) {
      setBackendMaterials(propMaterials);
    }
  }, [propMaterials]);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.materials)) {
            setBackendMaterials(data.materials);
            try {
              localStorage.setItem('wits_lingo_materials', JSON.stringify(data.materials));
            } catch (e) {}
          }
        }
      } catch (e) {}
    };

    fetchMaterials();

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setBackendMaterials(e.detail);
      } else {
        try {
          const saved = localStorage.getItem('wits_lingo_materials');
          if (saved) setBackendMaterials(JSON.parse(saved));
        } catch (e) {}
      }
    };

    window.addEventListener('wits_lingo_material_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('wits_lingo_material_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Map published videos
  const displayVideos = useMemo(() => {
    const publishedYt = backendMaterials
      .filter(m => (m.resourceType === 'youtube' || Boolean(m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

    if (publishedYt.length === 0) {
      return DEFAULT_VIDEOS;
    }

    const mapped = publishedYt.map((v, index) => {
      const finalVideoUrl = v.youtubeUrl ? normalizeAndValidateYouTubeUrl(v.youtubeUrl, v.youtubeUrl) : '';
      const thumb = v.thumbnailUrl || (finalVideoUrl ? extractYouTubeThumb(finalVideoUrl) : undefined) || DEFAULT_VIDEOS[index % DEFAULT_VIDEOS.length].thumbnailUrl;
      
      // Clean short title for center bold text (e.g. "SOUND OF C", "SOCIETY & FLUENCY")
      let shortTitle = v.title || 'ENGLISH LESSON';
      if (shortTitle.includes('|')) shortTitle = shortTitle.split('|')[0].trim();
      if (shortTitle.length > 22) shortTitle = shortTitle.slice(0, 20).trim() + '...';

      return {
        id: v.id || `yt-${index}`,
        title: v.title || 'Spoken English Video Lesson',
        shortTitle: shortTitle.toUpperCase(),
        category: v.category || 'English Lesson',
        description: v.description || 'Watch interactive spoken English lesson on our official YouTube channel.',
        views: v.views && v.views !== 'Wits Lingo' ? v.views : `${(index + 2) * 1.2}K`,
        duration: v.duration || '00:59',
        badge: 'FREE LESSON',
        youtubeUrl: finalVideoUrl || 'https://youtube.com/@witslingoeng',
        thumbnailUrl: thumb
      };
    });

    // Ensure at least 5 cards for the 3D cylindrical carousel
    if (mapped.length < 5) {
      const needed = DEFAULT_VIDEOS.slice(mapped.length);
      return [...mapped, ...needed];
    }

    return mapped;
  }, [backendMaterials]);

  // Automatic animation: rotate every 3.5s
  useEffect(() => {
    if (displayVideos.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % displayVideos.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [displayVideos.length, isPaused]);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % displayVideos.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + displayVideos.length) % displayVideos.length);
  };

  // Touch gesture handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  // Helper to calculate circular offset (-2, -1, 0, 1, 2)
  const getOffset = (index: number) => {
    const total = displayVideos.length;
    let diff = index - activeIndex;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  const youtubeChannelUrl = siteSettings?.youtubeUrl || 'https://youtube.com/@witslingoeng';

  return (
    <section 
      id="youtube-videos" 
      className="py-20 sm:py-28 bg-gradient-to-b from-[#180A2D] via-[#240E45] to-[#120524] text-white relative overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Royal Purple Ambient Backlight Effects */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-600/20 blur-[140px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute -bottom-10 inset-x-0 h-44 bg-gradient-to-t from-[#0E031A] to-transparent pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12 relative z-10">
        
        {/* =====================================================================
            HEADING IN CENTER (Matches "Great ideas live here" layout)
            ===================================================================== */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-purple-400/20 text-purple-200 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-inner">
            <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>Official Video Lessons</span>
          </div>

          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Learn English With{' '}
            <span className="bg-gradient-to-r from-purple-200 via-white to-purple-300 bg-clip-text text-transparent">
              Wits Lingo
            </span>
          </h2>
        </div>

        {/* =====================================================================
            3D CYLINDRICAL CURVED CAROUSEL (Exact Match to Reference Image)
            ===================================================================== */}
        <div className="relative w-full h-[440px] sm:h-[490px] flex items-center justify-center overflow-visible">
          
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous video"
            className="absolute left-2 sm:left-6 z-40 w-11 h-11 rounded-full bg-black/40 hover:bg-[#3B1569] text-white/80 hover:text-white border border-white/15 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next video"
            className="absolute right-2 sm:right-6 z-40 w-11 h-11 rounded-full bg-black/40 hover:bg-[#3B1569] text-white/80 hover:text-white border border-white/15 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* 3D Perspective Stage */}
          <div 
            className="relative w-full h-full flex items-center justify-center"
            style={{ 
              perspective: '1200px',
              perspectiveOrigin: '50% 50%',
              transformStyle: 'preserve-3d'
            }}
          >
            {displayVideos.map((video, idx) => {
              const diff = getOffset(idx);
              const isCenter = diff === 0;

              // Compute 3D cylinder transform
              let transform = '';
              let zIndex = 10;
              let opacity = 0;
              let filter = 'none';
              let pointerEvents: 'auto' | 'none' = 'none';

              if (diff === 0) {
                // Center active card (flat facing front, prominent)
                transform = 'translateX(0px) scale(1) rotateY(0deg)';
                zIndex = 35;
                opacity = 1;
                filter = 'brightness(1)';
                pointerEvents = 'auto';
              } else if (diff === 1) {
                // Immediate Right Card (angled inward towards center)
                const x = isMobile ? 150 : 270;
                transform = `translateX(${x}px) scale(0.88) rotateY(-22deg)`;
                zIndex = 25;
                opacity = isMobile ? 0.85 : 0.9;
                filter = 'brightness(0.85)';
                pointerEvents = 'auto';
              } else if (diff === -1) {
                // Immediate Left Card (angled inward towards center)
                const x = isMobile ? -150 : -270;
                transform = `translateX(${x}px) scale(0.88) rotateY(22deg)`;
                zIndex = 25;
                opacity = isMobile ? 0.85 : 0.9;
                filter = 'brightness(0.85)';
                pointerEvents = 'auto';
              } else if (diff === 2) {
                // Far Right Card
                const x = isMobile ? 260 : 500;
                transform = `translateX(${x}px) scale(0.76) rotateY(-36deg)`;
                zIndex = 15;
                opacity = isMobile ? 0 : 0.55;
                filter = 'brightness(0.7)';
                pointerEvents = isMobile ? 'none' : 'auto';
              } else if (diff === -2) {
                // Far Left Card
                const x = isMobile ? -260 : -500;
                transform = `translateX(${x}px) scale(0.76) rotateY(36deg)`;
                zIndex = 15;
                opacity = isMobile ? 0 : 0.55;
                filter = 'brightness(0.7)';
                pointerEvents = isMobile ? 'none' : 'auto';
              } else {
                // Hidden background cards
                transform = diff > 0 
                  ? 'translateX(650px) scale(0.6) rotateY(-45deg)' 
                  : 'translateX(-650px) scale(0.6) rotateY(45deg)';
                zIndex = 5;
                opacity = 0;
                pointerEvents = 'none';
              }

              return (
                <div
                  key={video.id}
                  onClick={() => {
                    // Clicking opens YouTube directly as requested
                    window.open(video.youtubeUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="absolute w-[290px] sm:w-[330px] md:w-[350px] h-[390px] sm:h-[430px] rounded-[30px] p-6 sm:p-7 flex flex-col justify-between cursor-pointer group transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    transform,
                    zIndex,
                    opacity,
                    filter,
                    pointerEvents,
                    background: 'linear-gradient(150deg, rgba(42, 21, 74, 0.95) 0%, rgba(26, 12, 48, 0.96) 55%, rgba(16, 7, 30, 0.98) 100%)',
                    border: isCenter ? '1.5px solid rgba(192, 132, 252, 0.45)' : '1px solid rgba(168, 85, 247, 0.22)',
                    boxShadow: isCenter 
                      ? '0 25px 60px -12px rgba(15, 3, 30, 0.8), 0 0 30px rgba(147, 51, 234, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15)' 
                      : '0 20px 45px -10px rgba(10, 2, 20, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.08)'
                  }}
                >
                  
                  {/* =========================================================
                      CARD TOP ROW: Icons (Left) + Stats/Badge (Right)
                      ========================================================= */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Globe className="w-4 h-4 text-purple-300/80" />
                      <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-purple-200/90 font-semibold bg-white/5 px-2.5 py-1 rounded-full border border-purple-400/15">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <span>{video.views}</span>
                      </span>
                      <span className="text-purple-400/60">•</span>
                      <span className="text-amber-300 font-bold">{video.duration}</span>
                    </div>
                  </div>

                  {/* =========================================================
                      CARD CENTER: Circular Avatar Media + Title + Subtitle
                      ========================================================= */}
                  <div className="text-center my-auto space-y-2">
                    
                    {/* Glowing Circular Thumbnail Artwork */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-purple-400/40 shadow-xl shadow-purple-950/60 mx-auto relative group-hover:scale-105 group-hover:border-purple-300 transition-all duration-300 shrink-0">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to default thumbnail
                          (e.target as HTMLImageElement).src = 'https://img.youtube.com/vi/ZFuoc6aEn3w/hqdefault.jpg';
                        }}
                      />
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/25 group-hover:bg-purple-950/40 flex items-center justify-center transition-colors">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Bold Punchy Title (Matching "MAGIK" in reference image) */}
                    <h3 className="font-['Outfit'] font-black text-lg sm:text-xl text-white tracking-wide text-center mt-3 group-hover:text-purple-200 transition-colors uppercase line-clamp-1">
                      {video.shortTitle}
                    </h3>

                    {/* Subtitle (Matching "Magikarp ❐" in reference image) */}
                    <div className="text-xs text-purple-300/80 font-medium text-center flex items-center justify-center gap-1">
                      <span>{video.category}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </div>

                    {/* Description Text (Matching "Rip digital Pokémon packs..." in reference image) */}
                    <p className="text-xs sm:text-[12.5px] text-purple-100/75 text-center mt-2 px-1 line-clamp-2 leading-relaxed">
                      {video.description}
                    </p>
                  </div>

                  {/* =========================================================
                      CARD BOTTOM ROW: Tag (Matching "MC $10.38m" in image)
                      ========================================================= */}
                  <div className="pt-3 border-t border-purple-400/15 flex items-center justify-between text-xs">
                    <span className="text-purple-300/70 text-[11px] font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Free Lesson</span>
                    </span>
                    <span className="font-bold text-white group-hover:text-purple-200 transition-colors flex items-center gap-1 text-[11px]">
                      <span>Watch Video</span>
                      <ExternalLink className="w-3 h-3 text-purple-400" />
                    </span>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* =====================================================================
            BOTTOM PILL BUTTONS (Matching "+ Create" & "See all ideas" in image)
            ===================================================================== */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
          
          {/* Button 1: Watch Channel */}
          <a
            href={youtubeChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 sm:px-7 py-3 rounded-full bg-[#3B1569] hover:bg-[#4E1C8B] text-white font-bold text-xs sm:text-sm border border-purple-400/30 shadow-lg shadow-purple-950/40 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
            <span>Watch on YouTube</span>
          </a>

          {/* Button 2: Subscribe */}
          <a
            href={`${youtubeChannelUrl}?sub_confirmation=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 sm:px-7 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 shadow-lg backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Subscribe Channel</span>
          </a>

        </div>

      </div>
    </section>
  );
};
