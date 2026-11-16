import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GalleryItem, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  ArrowLeft, X, ChevronLeft, ChevronRight,
  Sparkles, Calendar, Tag, Image as ImageIcon,
  Share2, Check, ZoomIn, Play, Star, MapPin, 
  Send, Users, Award, BookOpen
} from 'lucide-react';

interface GalleryPageProps {
  onBackToHome: () => void;
  onOpenAdmission: (courseId?: string) => void;
  siteSettings?: SiteSettings;
}

// Fallback curated moments if live gallery is empty or loading
const CURATED_DEFAULT_ITEMS: GalleryItem[] = [
  {
    id: 'moment-1',
    title: 'Spoken English Masterclass & Debate',
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
    title: 'Collaborative Speaking Circles',
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
    title: 'Mock Interview & Presentation Day',
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
    title: 'Public Speaking Confidence Stage',
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
    title: 'Interactive Digital Classroom',
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
    title: 'Cohort Graduation & Certificate Ceremony',
    caption: 'Celebrating fluent graduates who completed their 90-day intensive spoken transformation.',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    category: 'Community',
    isPublished: true,
    displayOrder: 6,
    uploadedAt: '2026-02-10'
  }
];

const STUDENT_EXPERIENCES = [
  {
    id: 1,
    name: 'Aarav Sharma',
    role: 'Cohort #12 Graduate',
    city: 'Amroha, UP',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    quote: 'Before joining Wits Lingo, I could understand English but always froze when trying to speak. The daily live drills and encouraging mentors completely removed my hesitation.'
  },
  {
    id: 2,
    name: 'Priya Verma',
    role: 'Software Engineer',
    city: 'Noida',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    quote: 'The mock interviews and speaking circles helped me crack my MNC job interview. The confidence I gained here changed how I present myself in every meeting.'
  },
  {
    id: 3,
    name: 'Mohd Zaid',
    role: 'College Student',
    city: 'Moradabad',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    quote: 'The classroom atmosphere is electric. Sir gives personal attention to every single mistake gently. Within two months, I gave my first English presentation on stage!'
  }
];

export const GalleryPage: React.FC<GalleryPageProps> = ({
  onBackToHome,
  onOpenAdmission,
  siteSettings
}) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([
    'All Moments',
    'Classrooms',
    'Live Sessions',
    'Events & Workshops',
    'Student Activities',
    'Community'
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Moments');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  // Carousel states for the featured spotlight strip
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);
  const [testimonialIndex, setTestimonialIndex] = useState<number>(0);

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
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(['All Moments', ...data.categories.filter((c: string) => c.toLowerCase() !== 'all moments')]);
          }
        } else {
          // Use curated default moments so page is rich and beautiful
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

  useEffect(() => {
    try {
      localStorage.removeItem('wits_lingo_gallery_items');
    } catch (e) {}
    fetchGallery();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchGallery]);

  // Combined active items
  const displayItems = items.length > 0 ? items : CURATED_DEFAULT_ITEMS;

  // Filtered items based on active category
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All Moments' || selectedCategory === 'All') return displayItems;
    return displayItems.filter(item => (item.category || '').toLowerCase() === selectedCategory.toLowerCase());
  }, [displayItems, selectedCategory]);

  // Lightbox Navigation handlers
  const handleNextImage = useCallback(() => {
    if (activeLightboxIndex === null || filteredItems.length === 0) return;
    setActiveLightboxIndex((prev) => ((prev! + 1) % filteredItems.length));
  }, [activeLightboxIndex, filteredItems.length]);

  const handlePrevImage = useCallback(() => {
    if (activeLightboxIndex === null || filteredItems.length === 0) return;
    setActiveLightboxIndex((prev) => ((prev! - 1 + filteredItems.length) % filteredItems.length));
  }, [activeLightboxIndex, filteredItems.length]);

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

  const currentLightboxItem = activeLightboxIndex !== null ? filteredItems[activeLightboxIndex] : null;

  // Carousel handlers for Spotlight Section
  const nextSpotlight = () => {
    setSpotlightIndex((prev) => (prev + 1) % Math.max(1, displayItems.length - 2));
  };
  const prevSpotlight = () => {
    setSpotlightIndex((prev) => (prev - 1 + Math.max(1, displayItems.length - 2)) % Math.max(1, displayItems.length - 2));
  };

  // Carousel handlers for Testimonials
  const nextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % STUDENT_EXPERIENCES.length);
  };
  const prevTestimonial = () => {
    setTestimonialIndex((prev) => (prev - 1 + STUDENT_EXPERIENCES.length) % STUDENT_EXPERIENCES.length);
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
            SECTION 1: HERO SECTION (Cinematic Header matching Strip 1)
            Full-bleed background with atmospheric dark overlay & floating filter bar
            ========================================================================= */}
        <section className="relative min-h-[520px] sm:min-h-[580px] lg:min-h-[620px] flex flex-col justify-between overflow-hidden">
          
          {/* Panoramic Background Image */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=85"
              alt="Wits Lingo Classroom Life"
              className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.08]"
            />
            {/* Brand Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#140528]/90 via-[#1E0B3B]/75 to-[#140528]/95 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Top Bar: Navigation & Brand */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 flex items-center justify-between">
            <button
              onClick={onBackToHome}
              id="gallery-back-home-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-all cursor-pointer transform hover:-translate-x-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-300" />
              <span>Back to Home</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/70 text-purple-200 border border-purple-400/30 text-xs font-semibold backdrop-blur-md shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Wits Lingo Visual Archive</span>
            </div>
          </div>

          {/* Hero Content Area */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 my-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Bold Editorial Typography */}
              <div className="lg:col-span-8 space-y-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-purple-300 block font-['Outfit']">
                  CAMPUS LIFE & REAL BREAKTHROUGHS
                </span>
                
                <h1 className="font-serif text-3.5xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.12]">
                  Life, Energy, and Fluency in Action.
                </h1>

                <p className="text-sm sm:text-base text-purple-100/80 max-w-2xl leading-relaxed font-normal">
                  Step inside our interactive spoken sessions, live debates, mock interviews, and student celebrations across India. Witness real hesitation turning into fluent speech.
                </p>
              </div>

              {/* Right Column: Floating Intro Video Action (matching reference play card) */}
              <div className="lg:col-span-4 flex justify-start lg:justify-end">
                <div 
                  onClick={() => setActiveLightboxIndex(0)}
                  className="group bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-white/20 shadow-2xl flex items-center gap-4 cursor-pointer transition-all hover:scale-103 max-w-[280px]"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#6D28D9] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                      CAMPUS TOUR
                    </span>
                    <span className="text-sm font-bold text-white font-['Outfit'] block">
                      Watch Highlights
                    </span>
                    <span className="text-[11px] text-purple-200/70 block mt-0.5">
                      {displayItems.length} Moments Recorded
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Floating Filter Bar anchored at base of Hero (matching Strip 1's Booking/Filter Bar) */}
          <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 -mb-7 sm:-mb-8">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/90 p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Category Pills Bar inside Floating Strip */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                {categories.map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                  const count = cat === 'All Moments' || cat === 'All'
                    ? displayItems.length
                    : displayItems.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#281648] text-white shadow-md shadow-purple-950/20'
                          : 'bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-[#281648] border border-slate-200/80'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Button: Admission / Free Demo */}
              <button
                type="button"
                onClick={() => onOpenAdmission()}
                id="gallery-hero-register-btn"
                className="w-full md:w-auto px-6 py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#6D28D9] to-[#E11D48] hover:from-[#5B21B6] hover:to-[#BE123C] text-white text-xs font-extrabold tracking-wide shadow-md transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shrink-0 transform hover:-translate-y-0.5"
              >
                <span>Join Next Batch</span>
                <span>→</span>
              </button>

            </div>
          </div>

        </section>

        {/* =========================================================================
            SECTION 2: SPOTLIGHT SHOWCASE ("Trip Planner" layout from Strip 2)
            Left: Editorial story + Explore CTA
            Right: Horizontal visual card carousel with tall portrait photography
            ========================================================================= */}
        <section className="pt-20 sm:pt-24 pb-14 sm:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
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
                  onClick={() => setSelectedCategory('All Moments')}
                  className="px-6 py-3 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold tracking-wide shadow-lg shadow-rose-950/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Explore All Memories →
                </button>
              </div>
            </div>

            {/* Right Column: Visual Portrait Carousel */}
            <div className="lg:col-span-8 relative">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {displayItems.slice(spotlightIndex, spotlightIndex + 3).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      const realIdx = filteredItems.findIndex(fi => fi.id === item.id);
                      setActiveLightboxIndex(realIdx !== -1 ? realIdx : idx);
                    }}
                    className="group relative bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer flex flex-col border border-slate-200/80 aspect-[3/4]"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                    />
                    
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/95 via-[#1E0B3B]/40 to-transparent flex flex-col justify-between p-4" />

                    {/* Top Tag */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                        {item.category || 'Classrooms'}
                      </span>
                    </div>

                    {/* Bottom Metadata */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1 text-white">
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <h4 className="font-['Outfit'] font-bold text-sm leading-snug line-clamp-1 drop-shadow-sm">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-purple-200/80 line-clamp-1">
                        {item.caption || 'Active classroom practice'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slider Controls */}
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

            </div>

          </div>
        </section>

        {/* =========================================================================
            SECTION 3: CURATED ARCHITECTURAL GRID ("Room & Suites" layout from Strip 3)
            Left: Tall prominent feature card
            Right: 2x2 complementary visual cards grid
            ========================================================================= */}
        <section className="py-14 sm:py-18 bg-[#FAF9FC] border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            
            {/* Section Heading */}
            <div className="space-y-2">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#140528] tracking-tight">
                Classroom Moments & Milestones
              </h2>
              <p className="text-sm text-slate-500 max-w-xl">
                A visual journey across our speaking cohorts, faculty mentoring, and student confidence drills.
              </p>
            </div>

            {/* Asymmetrical 5-Item Curated Layout */}
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                
                {/* 1. Large Tall Feature Card on Left (spans 5 cols) */}
                {filteredItems[0] && (
                  <div
                    onClick={() => setActiveLightboxIndex(0)}
                    className="lg:col-span-5 group relative bg-slate-900 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer min-h-[380px] sm:min-h-[460px] flex flex-col justify-end p-6 border border-slate-200/60"
                  >
                    <img
                      src={filteredItems[0].imageUrl}
                      alt={filteredItems[0].title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-106 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/95 via-[#1E0B3B]/40 to-transparent" />

                    <div className="relative z-10 space-y-2 text-white">
                      <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-rose-600 text-white tracking-widest inline-block">
                        FEATURED MOMENT
                      </span>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight drop-shadow-md">
                        {filteredItems[0].title}
                      </h3>
                      {filteredItems[0].caption && (
                        <p className="text-xs sm:text-sm text-purple-200/90 line-clamp-2 leading-relaxed">
                          {filteredItems[0].caption}
                        </p>
                      )}
                      <div className="pt-2 flex items-center gap-2 text-xs text-white/80 font-semibold">
                        <ZoomIn className="w-4 h-4 text-purple-300" />
                        <span>Click to View Full Screen</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 2x2 Grid on Right (spans 7 cols) */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {filteredItems.slice(1, 5).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      onClick={() => setActiveLightboxIndex(idx + 1)}
                      className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer aspect-4/3 sm:aspect-auto sm:min-h-[220px] flex flex-col justify-end p-4 border border-slate-200/60"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#140528]/90 via-black/30 to-transparent" />

                      <div className="relative z-10 space-y-1 text-white">
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white tracking-wide inline-block">
                          {item.category || 'Classrooms'}
                        </span>
                        <h4 className="font-serif text-base sm:text-lg font-bold leading-snug line-clamp-1 drop-shadow-sm">
                          {item.title}
                        </h4>
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
                <h3 className="font-bold text-slate-800">No moments in this category yet</h3>
                <button
                  onClick={() => setSelectedCategory('All Moments')}
                  className="px-4 py-2 rounded-xl bg-[#281648] text-white text-xs font-bold"
                >
                  View All Moments
                </button>
              </div>
            )}

            {/* If more than 5 items, show remaining cards neatly below */}
            {filteredItems.length > 5 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-4">
                {filteredItems.slice(5).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setActiveLightboxIndex(idx + 5)}
                    className="group relative bg-white rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-slate-200/80 aspect-4/3 flex flex-col justify-end p-4"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    
                    <div className="relative z-10 text-white space-y-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-300 block">
                        {item.category}
                      </span>
                      <h4 className="font-['Outfit'] font-bold text-sm line-clamp-1">
                        {item.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>

        {/* =========================================================================
            SECTION 4: LEARNER EXPERIENCES ("Traveller's Experiences" from Strip 4)
            Minimalist testimonial cards with overlapping circular avatar and quote
            ========================================================================= */}
        <section className="py-14 sm:py-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div className="space-y-2">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#140528] tracking-tight">
                Stories Behind The Smiles
              </h2>
              <p className="text-sm text-slate-500">
                Real reflections from students who found their spoken voice at Wits Lingo.
              </p>
            </div>

            {/* Slider Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevTestimonial}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Previous Testimonial"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextTestimonial}
                className="w-9 h-9 rounded-xl bg-[#281648] hover:bg-[#1E0B3B] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                aria-label="Next Testimonial"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STUDENT_EXPERIENCES.map((exp) => (
              <div 
                key={exp.id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative pt-8"
              >
                {/* Overlapping Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md absolute -top-6 left-6 bg-slate-100">
                  <img src={exp.avatar} alt={exp.name} className="w-full h-full object-cover" />
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                  "{exp.quote}"
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-['Outfit'] font-bold text-sm text-slate-900">
                      {exp.name}
                    </h4>
                    <span className="text-[11px] text-purple-700 font-semibold block">
                      {exp.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{exp.city}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: NEWSLETTER / JOIN NEXT COHORT BANNER (Strip 4 Style)
            Scenic atmospheric background with Wits Lingo purple palette & input pill
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
              <span className="text-white/70">{filteredItems.length}</span>
              <span className="text-white/40">•</span>
              <span className="text-purple-200">{currentLightboxItem.category || 'Gallery'}</span>
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
          {filteredItems.length > 1 && (
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
                alt={currentLightboxItem.title || 'Wits Lingo Preview'}
                className="max-h-[68vh] sm:max-h-[72vh] max-w-full object-contain select-none"
              />
            </div>

            {/* Bottom Caption Container */}
            <div className="w-full max-w-3xl mt-3 sm:mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white space-y-1 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 max-w-xl">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#4A1D96] text-[10px] font-bold uppercase text-purple-200">
                    {currentLightboxItem.category || 'Classrooms'}
                  </span>
                  <h3 className="font-['Outfit'] font-bold text-sm sm:text-base text-white">
                    {currentLightboxItem.title || 'Wits Lingo Moment'}
                  </h3>
                </div>
                {currentLightboxItem.caption && (
                  <p className="text-xs text-purple-200/90 leading-relaxed">
                    {currentLightboxItem.caption}
                  </p>
                )}
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
          {filteredItems.length > 1 && (
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
