import React, { useState, useEffect, useMemo } from 'react';
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

  const displayVideos = useMemo(() => {
    const publishedYt = backendMaterials
      .filter(m => (m.resourceType === 'youtube' || Boolean(m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

    return publishedYt.map((v, index) => {
      const finalVideoUrl = v.youtubeUrl ? normalizeAndValidateYouTubeUrl(v.youtubeUrl, v.youtubeUrl) : '';
      const thumb = v.thumbnailUrl || (finalVideoUrl ? extractYouTubeThumb(finalVideoUrl) : undefined);

      return {
        id: v.id,
        title: v.title || 'Video Lesson',
        youtubeUrl: finalVideoUrl,
        thumbnailUrl: thumb,
        thumbnailBg: [
          'from-purple-900 via-indigo-900 to-purple-950',
          'from-indigo-950 via-purple-900 to-slate-900',
          'from-purple-950 via-violet-900 to-purple-900',
          'from-slate-900 via-purple-900 to-indigo-950',
          'from-purple-900 via-purple-950 to-slate-900'
        ][index % 5]
      };
    });
  }, [backendMaterials]);

  const marqueeVideos = useMemo(() => {
    if (displayVideos.length === 0) return [];
    let base = [...displayVideos];
    while (base.length < 6) {
      base = [...base, ...displayVideos];
    }
    return [...base, ...base];
  }, [displayVideos]);

  if (displayVideos.length === 0) return null;

  return (
    <section id="youtube-videos" className="py-16 sm:py-20 bg-white border-b border-purple-100/70 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Heading in between */}
        <h3 className="font-['Outfit'] text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1E1B26] text-center tracking-tight">
          Learn English With <span className="bg-gradient-to-r from-[#281648] via-[#4A1D96] to-[#7C3AED] bg-clip-text text-transparent">Wits Lingo</span>
        </h3>

        {/* Video Cards with Automatic Slide-Left Marquee Animation */}
        <div className="relative w-full overflow-hidden py-3">
          <div className="animate-slide-left flex gap-5 sm:gap-6">
            {marqueeVideos.map((video, idx) => (
              <a
                key={`${video.id}-${idx}`}
                href={video.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(video.youtubeUrl, '_blank', 'noopener,noreferrer');
                }}
                className="relative flex-shrink-0 w-[270px] sm:w-[310px] md:w-[330px] h-[390px] sm:h-[440px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group cursor-pointer block border border-purple-100/70"
              >
                {/* Full-bleed Thumbnail */}
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}

                <div className={`absolute inset-0 bg-gradient-to-br ${video.thumbnailBg || 'from-[#281648] via-[#3C166D] to-[#12072B]'} ${video.thumbnailUrl ? '-z-10' : ''} flex items-center justify-center`}>
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
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
