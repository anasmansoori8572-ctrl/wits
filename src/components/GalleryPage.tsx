import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GalleryItem, SiteSettings, TestimonialData } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  ArrowLeft, X, ChevronLeft, ChevronRight,
  Sparkles, Calendar, Image as ImageIcon,
  Share2, Check, ZoomIn, Play, Star
} from 'lucide-react';

interface GalleryPageProps {
  onBackToHome: () => void;
  onOpenAdmission: (courseId?: string) => void;
  siteSettings?: SiteSettings;
  testimonials?: TestimonialData[];
}

// Fallback curated moments if live gallery is empty or loading
const CURATED_DEFAULT_ITEMS: GalleryItem[] = [
  {
    id: 'moment-1',
    title: '',
    caption: 'Students engaging in active group debates, practicing quick response thinking and speech clarity without hesitation.',
    imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=600&q=80',
    category: 'Classrooms',
    isPublished: true,
    displayOrder: 1,
    uploadedAt: '2026-03-10'
  },
  {
    id: 'moment-2',
    title: '',
    caption: 'Small-cohort breakout sessions where learners practice natural everyday dialogues and conversational grammar.',
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80',
    category: 'Live Sessions',
    isPublished: true,
    displayOrder: 2,
    uploadedAt: '2026-03-05'
  },
  {
    id: 'moment-3',
    title: '',
    caption: 'One-on-one guided interview drills focusing on professional vocabulary, body language, and voice modulation.',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80',
    category: 'Events & Workshops',
    isPublished: true,
    displayOrder: 3,
    uploadedAt: '2026-02-28'
  },
  {
    id: 'moment-4',
    title: '',
    caption: 'Learners taking the podium to deliver extempore speeches, overcoming stage fright in a supportive environment.',
    imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=600&q=80',
    category: 'Student Activities',
    isPublished: true,
    displayOrder: 4,
    uploadedAt: '2026-02-20'
  },
  {
    id: 'moment-5',
    title: '',
    caption: 'State-of-the-art interactive display boards and multimedia speech correction tools during evening batches.',
    imageUrl: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=600&q=80',
    category: 'Classrooms',
    isPublished: true,
    displayOrder: 5,
    uploadedAt: '2026-02-15'
  },
  {
    id: 'moment-6',
    title: '',
    caption: 'Celebrating fluent graduates who completed their intensive spoken transformation.',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    category: 'Community',
    isPublished: true,
    displayOrder: 6,
    uploadedAt: '2026-02-10'
  }
];

const AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80'
];

// Helper to sanitize card text: NEVER show raw image filenames like image(18) or numeric ids
const getCleanDescription = (item: GalleryItem): string => {
  if (item.caption && item.caption.trim()) {
    return item.caption.trim();
  }
  if (item.title && item.title.trim()) {
    const raw = item.title.trim();
    if (
      /^(image|img)[\s_(-]*\d+/i.test(raw) ||
      /^\d+$/.test(raw) ||
      /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(raw)
    ) {
      return 'Classroom Moment';
    }
    return raw;
  }
  return 'Classroom Moment';
};

export const GalleryPage: React.FC<GalleryPageProps> = ({
  onBackToHome,
  onOpenAdmission,
  siteSettings,
  testimonials = []
}) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [liveTestimonials, setLiveTestimonials] = useState<TestimonialData[]>(testimonials);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  // Carousel state for the featured spotlight strip
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterDone, setNewsletterDone] = useState(false);

  // Lock scroll when lightbox is active
  useScrollLock(activeLightboxIndex !== null);

  // Fetch live published gallery items from server
  const fetchGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        } else {
          setItems(CURATED_DEFAULT_ITEMS);
        }
      } else {
        setItems(CURATED_DEFAULT_ITEMS);
      }
    } catch (err) {
      console.warn('Could not load gallery from server, using curated defaults:', err);
      setItems(CURATED_DEFAULT_ITEMS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch live testimonials if not provided via props
  useEffect(() => {
    if (testimonials && testimonials.length > 0) {
      setLiveTestimonials(testimonials);
      return;
    }
    fetch('/api/testimonials')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
          setLiveTestimonials(data.testimonials);
        }
      })
      .catch(err => {
        console.warn('Could not load testimonials for gallery:', err);
      });
  }, [testimonials]);

  useEffect(() => {
    try {
      localStorage.removeItem('wits_lingo_gallery_items');
    } catch (e) {}
    fetchGallery();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchGallery]);

  // Combined active items (no category filtering - show all moments directly)
  const displayItems = items.length > 0 ? items : CURATED_DEFAULT_ITEMS;

  // Infinite marquee duplicate list for testimonials
  const marqueedTestimonials = useMemo(() => {
    if (!liveTestimonials || liveTestimonials.length === 0) return [];
    let list = [...liveTestimonials];
    while (list.length < 6) {
      list = [...list, ...liveTestimonials];
    }
    return [...list, ...list];
  }, [liveTestimonials]);

  // Lightbox Navigation handlers
  const handleNextImage = useCallback(() => {
    if (activeLightboxIndex === null || displayItems.length === 0) return;
    setActiveLightboxIndex((prev) => ((prev! + 1) % displayItems.length));
  }, [activeLightboxIndex, displayItems.length]);

  const handlePrevImage = useCallback(() => {
    if (activeLightboxIndex === null || displayItems.length === 0) return;
    setActiveLightboxIndex((prev) => ((prev! - 1 + displayItems.length) % displayItems.length));
  }, [activeLightboxIndex, displayItems.length]);

  const handleCloseLightbox = useCallback(() => {
    setActiveLightboxIndex(null);
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseLightbox();
      else if (e.key === 'ArrowRight') handleNextImage();
      else if (e.key === 'ArrowLeft') handlePrevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, handleCloseLightbox, handleNextImage, handlePrevImage]);

  const currentLightboxItem = activeLightboxIndex !== null ? displayItems[activeLightboxIndex] : null;

  // Carousel handlers for Spotlight Section
  const nextSpotlight = () => {
    setSpotlightIndex((prev) => (prev + 1) % Math.max(1, displayItems.length - 2));
  };
  const prevSpotlight = () => {
    setSpotlightIndex((prev) => (prev - 1 + Math.max(1, displayItems.length - 2)) % Math.max(1, displayItems.length - 2));
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterDone(true);
      setTimeout(() => setNewsletterDone(false), 4000);
      setNewsletterEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-slate-900 flex flex-col justify-between selection:bg-purple-100 selection:text-purple-900 font-['Plus_Jakarta_Sans']">
      <div>
        
        {/* =========================================================================
            SECTION 1: HERO SECTION
            - Background image completely visible
            - Reduced compact height
            - Text center-aligned
            - Category filter bar removed
            ========================================================================= */}
        <section className="relative overflow-hidden py-10 sm:py-14 md:py-16">
          
          {/* Panoramic Background Image - Completely Visible with subtle natural scrim */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=85"
              alt="Wits Lingo Classroom Life"
              className="w-full h-full object-cover object-center"
            />
            {/* Soft Translucent Scrim for crisp text readability while background is fully visible */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55 pointer-events-none" />
          </div>

          {/* Top Bar: Navigation & Brand Pill */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8 flex items-center justify-between">
            <button
              onClick={onBackToHome}
              id="gallery-back-home-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 hover:bg-black/50 text-white text-xs font-bold backdrop-blur-md border border-white/25 transition-all cursor-pointer transform hover:-translate-x-0.5 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-200" />
              <span>Back to Home</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 text-purple-200 border border-white/20 text-xs font-semibold backdrop-blur-md shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Wits Lingo Visual Archive</span>
            </div>
          </div>

          {/* Hero Content Area - Centered Aligned & Compact */}
          <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 text-purple-200 border border-white/20 text-xs font-bold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span className="uppercase tracking-[0.2em] font-['Outfit'] text-[11px]">CAMPUS LIFE &amp; REAL BREAKTHROUGHS</span>
            </div>
            
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.14] drop-shadow-lg max-w-3xl">
              Life, Energy, and Fluency in Action.
            </h1>

            <p className="text-sm sm:text-base text-white/95 max-w-2xl leading-relaxed font-normal drop-shadow-md mx-auto">
              Step inside our interactive spoken sessions, live debates, mock interviews, and student celebrations across India. Witness real hesitation turning into fluent speech.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAdmission()}
                id="gallery-hero-register-btn"
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#6D28D9] to-[#E11D48] hover:from-[#5B21B6] hover:to-[#BE123C] text-white text-xs font-extrabold tracking-wide shadow-lg shadow-purple-950/30 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
              >
                <span>Join Next Batch</span>
                <span>→</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveLightboxIndex(0)}
                className="px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md border border-white/25 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Watch Highlights</span>
              </button>
            </div>
          </div>

        </section>

        {/* =========================================================================
            SECTION 2: SPOTLIGHT SHOWCASE
            Left: Editorial story + Explore CTA
            Right: Visual cards carousel showing short descriptions only
            ========================================================================= */}
        <section className="pt-12 sm:pt-16 pb-12 sm:pb-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* Left Column: Story & View Action */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6D28D9] block font-['Outfit']">
                MOMENTS OF GROWTH
              </span>
              
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#140528] tracking-tight leading-snug">
                Every classroom is a stage for confidence.
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Twenty sessions from now, you will speak without hesitation. From one-on-one pronunciation corrections to joyful group discussions, see how confidence takes shape daily.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('gallery-moments-grid');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-6 py-3 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold tracking-wide shadow-lg shadow-rose-950/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Explore All Moments ↓
                </button>
              </div>
            </div>

            {/* Right Column: Visual Portrait Carousel - ONLY short descriptions, NO raw image names */}
            <div className="lg:col-span-8 relative">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {displayItems.slice(spotlightIndex, spotlightIndex + 3).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      const realIdx = displayItems.findIndex(fi => fi.id === item.id);
                      setActiveLightboxIndex(realIdx !== -1 ? realIdx : idx);
                    }}
                    className="group relative bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer flex flex-col border border-slate-200/80 aspect-[3/4]"
                  >
                    <img
                      src={item.imageUrl}
                      alt={getCleanDescription(item)}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                    />
                    
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/95 via-[#1E0B3B]/40 to-transparent flex flex-col justify-between p-4" />

                    {/* Bottom Metadata - ONLY short description */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1.5 text-white">
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <p className="font-['Outfit'] font-semibold text-xs sm:text-sm text-white leading-snug line-clamp-2 drop-shadow-sm">
                        {getCleanDescription(item)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slider Controls */}
              {displayItems.length > 3 && (
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={prevSpotlight}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                    aria-label="Previous Slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSpotlight}
                    className="w-9 h-9 rounded-xl bg-[#281648] hover:bg-[#1E0B3B] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    aria-label="Next Slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>

          </div>
        </section>

        {/* =========================================================================
            SECTION 3: CURATED ARCHITECTURAL GRID
            Displays all gallery moments with only clean descriptions
            ========================================================================= */}
        <section id="gallery-moments-grid" className="py-14 sm:py-18 bg-[#FAF9FC] border-y border-slate-200/80 scroll-mt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            
            {/* Section Heading */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#6D28D9] block font-['Outfit']">
                GALLERY ARCHIVE
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#140528] tracking-tight">
                Classroom Moments &amp; Milestones
              </h2>
              <p className="text-sm text-slate-500 max-w-xl">
                A visual journey across our speaking cohorts, faculty mentoring, and student confidence drills.
              </p>
            </div>

            {/* Asymmetrical Curated Layout */}
            {displayItems.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                
                {/* 1. Large Feature Card on Left (spans 5 cols) */}
                {displayItems[0] && (
                  <div
                    onClick={() => setActiveLightboxIndex(0)}
                    className="lg:col-span-5 group relative bg-slate-900 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer min-h-[380px] sm:min-h-[460px] flex flex-col justify-end p-6 border border-slate-200/60"
                  >
                    <img
                      src={displayItems[0].imageUrl}
                      alt={getCleanDescription(displayItems[0])}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-106 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/95 via-[#1E0B3B]/40 to-transparent" />

                    <div className="relative z-10 space-y-2 text-white">
                      <p className="font-serif text-lg sm:text-2xl font-bold leading-snug drop-shadow-md">
                        {getCleanDescription(displayItems[0])}
                      </p>
                      <div className="pt-2 flex items-center gap-2 text-xs text-white/80 font-semibold">
                        <ZoomIn className="w-4 h-4 text-purple-300" />
                        <span>Click to View Full Screen</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 2x2 Grid on Right (spans 7 cols) */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {displayItems.slice(1, 5).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      onClick={() => setActiveLightboxIndex(idx + 1)}
                      className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer aspect-4/3 sm:aspect-auto sm:min-h-[220px] flex flex-col justify-end p-4 border border-slate-200/60"
                    >
                      <img
                        src={item.imageUrl}
                        alt={getCleanDescription(item)}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/90 via-black/30 to-transparent" />

                      <div className="relative z-10 space-y-1 text-white">
                        <p className="font-serif text-sm sm:text-base font-bold leading-snug line-clamp-2 drop-shadow-sm">
                          {getCleanDescription(item)}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-purple-200/80 pt-1">
                          <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Cohort Moment'}</span>
                          <span className="text-white font-bold group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="text-center py-12 px-4 max-w-md mx-auto space-y-3">
                <ImageIcon className="w-10 h-10 text-purple-400 mx-auto" />
                <h3 className="font-bold text-slate-800">No moments published yet</h3>
              </div>
            )}

            {/* If more than 5 items, show remaining cards neatly below */}
            {displayItems.length > 5 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-4">
                {displayItems.slice(5).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setActiveLightboxIndex(idx + 5)}
                    className="group relative bg-white rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-slate-200/80 aspect-4/3 flex flex-col justify-end p-4"
                  >
                    <img
                      src={item.imageUrl}
                      alt={getCleanDescription(item)}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    
                    <div className="relative z-10 text-white space-y-0.5">
                      <p className="font-['Outfit'] font-semibold text-xs sm:text-sm text-white line-clamp-2 drop-shadow-xs">
                        {getCleanDescription(item)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>

        {/* =========================================================================
            SECTION 4: REAL WEBSITE TESTIMONIALS (Continuous Slide-Left Animation)
            Authentic reflections from real website testimonials
            ========================================================================= */}
        <section className="py-14 sm:py-18 bg-white border-b border-slate-200/80 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-12 text-center space-y-2">
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
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Real reflections from students who found their spoken voice at Wits Lingo.
            </p>
          </div>

          {/* Continuous Slide-Left Animation Marquee */}
          {marqueedTestimonials.length === 0 ? (
            <div className="max-w-md mx-auto text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-purple-200 space-y-3">
              <Star className="w-8 h-8 text-purple-400 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">Authentic Student Reviews</p>
              <p className="text-xs text-slate-500">
                Reviews from our English learners will glide here smoothly.
              </p>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden py-3">
              <div className="animate-slide-left flex gap-6 sm:gap-8">
                {marqueedTestimonials.map((item, idx) => {
                  const avatar = item.avatar || AVATAR_IMAGES[idx % AVATAR_IMAGES.length];
                  return (
                    <div
                      key={`${item.id || idx}-${idx}`}
                      className="w-[320px] sm:w-[400px] md:w-[460px] flex-shrink-0 bg-white rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-xl transition-all duration-300 border border-slate-200/80 flex flex-col justify-between space-y-5 group"
                    >
                      {/* Quote Text */}
                      <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic line-clamp-4">
                        &ldquo;{item.testimonial}&rdquo;
                      </p>

                      {/* Bottom Row: User Avatar + Name + 5 Stars */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-100 border-2 border-purple-200 shrink-0">
                            <img
                              src={avatar}
                              alt={item.studentName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-['Outfit'] font-bold text-sm text-[#1E1B26] truncate group-hover:text-[#6D28D9] transition-colors">
                              {item.studentName}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium truncate">
                              {item.courseBatch || 'English Learner'} &bull; {item.city || 'India'}
                            </p>
                          </div>
                        </div>

                        {/* 5 Stars Rating */}
                        <div className="flex items-center gap-1 text-amber-400 shrink-0 ml-2">
                          {[...Array(Math.min(5, Math.max(1, Number(item.rating) || 5)))].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            SECTION 5: NEWSLETTER / JOIN NEXT COHORT BANNER
            ========================================================================= */}
        <section className="relative py-16 sm:py-20 overflow-hidden text-center text-white">
          
          {/* Panoramic Backdrop with brand tint */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
              alt="Majestic Landscape"
              className="w-full h-full object-cover object-center filter brightness-[0.35]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#140528] via-[#2E1065]/60 to-[#140528]/90 pointer-events-none" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto px-4 space-y-4">
            <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-white/15 text-purple-200 border border-white/20 tracking-widest inline-block">
              GET IN TOUCH
            </span>

            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Ready to Be Part of Our Next Story?
            </h2>

            <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed max-w-lg mx-auto">
              Join interactive live sessions with personal attention, zero hesitation drills, and practical speaking practice.
            </p>

            {/* Email subscription / Demo register input pill */}
            <form onSubmit={handleNewsletterSubmit} className="pt-4 max-w-md mx-auto">
              <div className="bg-white rounded-full p-1.5 shadow-2xl flex items-center border border-white/80">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-4 text-xs text-slate-800 bg-transparent focus:outline-none font-medium placeholder:text-slate-400"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold tracking-wide transition-all shadow-md shrink-0 cursor-pointer"
                >
                  {newsletterDone ? 'Subscribed!' : 'Get Free Demo'}
                </button>
              </div>
            </form>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenAdmission()}
                className="text-xs font-bold text-purple-200 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
              >
                Or apply directly for regular batches →
              </button>
            </div>
          </div>

        </section>

      </div>

      {/* =========================================================================
          LIGHTBOX MODAL (Immersive full-screen preview with keyboard navigation)
          Only displays short description, no raw image filenames
          ========================================================================= */}
      {currentLightboxItem && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0B0417]/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={handleCloseLightbox}
        >
          {/* Top Floating Controls Bar */}
          <div 
            className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between text-white pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Counter Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold">
              <span className="text-purple-300 font-bold">{activeLightboxIndex! + 1}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/70">{displayItems.length}</span>
              <span className="text-white/40">•</span>
              <span className="text-purple-200">Wits Lingo Visual Archive</span>
            </div>

            {/* Actions: Copy Link & Close */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(currentLightboxItem.imageUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copy direct image link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
              </button>

              <button
                onClick={handleCloseLightbox}
                id="lightbox-close-btn"
                className="p-2 sm:p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white hover:text-white transition-colors border border-white/20 cursor-pointer shadow-md"
                aria-label="Close Lightbox"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Left Arrow Navigation Button */}
          {displayItems.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              id="lightbox-prev-btn"
              className="absolute left-2 sm:left-6 z-40 p-2.5 sm:p-3.5 rounded-full bg-white/10 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer transform hover:scale-105 active:scale-95 shadow-lg"
              title="Previous image (Left Arrow)"
              aria-label="Previous Image"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {/* Main Lightbox Content */}
          <div 
            className="relative max-w-5xl w-full max-h-[88vh] flex flex-col items-center justify-center z-30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Frame */}
            <div className="relative max-h-[68vh] sm:max-h-[72vh] flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl">
              <img
                src={currentLightboxItem.imageUrl}
                alt={getCleanDescription(currentLightboxItem)}
                className="max-h-[68vh] sm:max-h-[72vh] max-w-full object-contain select-none"
              />
            </div>

            {/* Bottom Caption Container - ONLY short description, no image name */}
            <div className="w-full max-w-3xl mt-3 sm:mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white space-y-1 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 max-w-xl">
                <p className="font-['Outfit'] font-medium text-sm sm:text-base text-white/95 leading-relaxed">
                  {getCleanDescription(currentLightboxItem)}
                </p>
              </div>

              {currentLightboxItem.uploadedAt && (
                <div className="text-[11px] text-white/60 flex items-center gap-1.5 flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-purple-300" />
                  <span>{new Date(currentLightboxItem.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Arrow Navigation Button */}
          {displayItems.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              id="lightbox-next-btn"
              className="absolute right-2 sm:right-6 z-40 p-2.5 sm:p-3.5 rounded-full bg-white/10 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer transform hover:scale-105 active:scale-95 shadow-lg"
              title="Next image (Right Arrow)"
              aria-label="Next Image"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
