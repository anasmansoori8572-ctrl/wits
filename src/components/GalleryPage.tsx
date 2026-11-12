import React, { useState, useEffect, useCallback } from 'react';
import { GalleryItem, SiteSettings } from '../types';
import { INITIAL_GALLERY_ITEMS } from '../data/initialData';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  ArrowLeft, X, ChevronLeft, ChevronRight, Eye, 
  Sparkles, Calendar, Tag, Image as ImageIcon, Filter,
  Share2, Check, Download, ZoomIn
} from 'lucide-react';

interface GalleryPageProps {
  onBackToHome: () => void;
  onOpenAdmission: (courseId?: string) => void;
  siteSettings?: SiteSettings;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  onBackToHome,
  onOpenAdmission,
  siteSettings
}) => {
  const [items, setItems] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_gallery_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_GALLERY_ITEMS;
  });

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

  // Lock scroll when lightbox is active
  useScrollLock(activeLightboxIndex !== null);

  // Fetch live published gallery items from server
  const fetchGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
          localStorage.setItem('wits_lingo_gallery_items', JSON.stringify(data.items));
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load gallery from server, using local fallback:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
    // Scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchGallery]);

  // Filtered items based on active category
  const filteredItems = items.filter(item => {
    if (selectedCategory === 'All Moments' || selectedCategory === 'All') return true;
    return (item.category || '').toLowerCase() === selectedCategory.toLowerCase();
  });

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
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, handleCloseLightbox, handleNextImage, handlePrevImage]);

  const currentLightboxItem = activeLightboxIndex !== null ? filteredItems[activeLightboxIndex] : null;

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-slate-900 flex flex-col justify-between selection:bg-purple-100 selection:text-purple-900">
      <div>
        {/* Top Header Banner */}
        <section className="relative bg-gradient-to-b from-[#1E0B3B] via-[#2A104E] to-[#140727] text-white pt-12 pb-16 sm:pt-16 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-purple-950/60">
          {/* Subtle decorative background blur blobs */}
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-[#4A1D96]/20 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto relative z-10 space-y-6">
            
            {/* Navigation Breadcrumb / Back */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <button
                onClick={onBackToHome}
                id="gallery-back-home-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/15 transition-all cursor-pointer transform hover:-translate-x-0.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </button>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B0764]/80 text-purple-200 border border-purple-400/30 text-xs font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>WITS LINGO Visual Archive</span>
              </div>
            </div>

            {/* Hero Copy */}
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[11px] font-bold uppercase tracking-wider font-['Outfit']">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Gallery & Classroom Life</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white font-['Outfit'] tracking-tight leading-tight">
                Moments That Define <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-300">WITS LINGO</span>
              </h1>

              <p className="text-sm sm:text-base text-purple-100/80 leading-relaxed max-w-2xl font-normal">
                Explore authentic moments from our live interactive classrooms, spoken English workshops, mock interviews, student achievements, and our vibrant learning community across India.
              </p>
            </div>

            {/* Quick Stats Pill */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-purple-200/90 font-medium">
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-purple-300" />
                <strong className="text-white font-bold">{items.length}</strong> Moments Documented
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-300" />
                <strong className="text-white font-bold">{categories.length}</strong> Activity Categories
              </span>
            </div>

          </div>
        </section>

        {/* Gallery Content Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
          
          {/* Category Filter Pills Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200/80 pb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none w-full sm:w-auto">
              {categories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                const count = cat === 'All Moments' || cat === 'All' 
                  ? items.length 
                  : items.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#4A1D96] text-white shadow-md shadow-purple-900/20 scale-102'
                        : 'bg-white text-slate-600 hover:bg-purple-50 hover:text-[#4A1D96] border border-slate-200'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500 font-semibold hidden md:inline-block">
              Showing <strong className="text-slate-800">{filteredItems.length}</strong> moments
            </span>
          </div>

          {/* Grid Layout */}
          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="rounded-3xl bg-slate-100 animate-pulse aspect-4/3 border border-slate-200" />
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {filteredItems.map((item, index) => {
                const isImgError = imageErrorMap[item.id];
                const fallbackSrc = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80';
                const displayImg = isImgError ? fallbackSrc : (item.thumbnailUrl || item.imageUrl);

                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveLightboxIndex(index)}
                    className="group relative bg-white rounded-3xl overflow-hidden border border-purple-100/90 shadow-xs hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer flex flex-col"
                  >
                    {/* Image Box */}
                    <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-900">
                      <img
                        src={displayImg}
                        alt={item.title || 'WITS LINGO moment'}
                        loading="lazy"
                        onError={() => setImageErrorMap(prev => ({ ...prev, [item.id]: true }))}
                        className="w-full h-full object-cover object-center transform group-hover:scale-106 transition-transform duration-500 ease-out"
                      />

                      {/* Top Category Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className="px-2.5 py-1 rounded-xl bg-[#140727]/75 backdrop-blur-md text-white text-[10px] font-bold tracking-wide border border-white/20 uppercase font-['Outfit'] shadow-xs">
                          {item.category || 'Classrooms'}
                        </span>
                      </div>

                      {/* Hover Overlay with View action */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A34]/90 via-[#2E1065]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-10 pointer-events-none">
                        <div className="flex justify-end">
                          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-md">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-white font-['Outfit'] font-bold text-sm leading-snug line-clamp-2 drop-shadow-sm">
                            {item.title || 'WITS LINGO Classroom Moment'}
                          </h4>
                          {item.caption && (
                            <p className="text-purple-200/90 text-xs line-clamp-2 leading-tight">
                              {item.caption}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Meta (Always visible for clarity) */}
                    <div className="p-4 space-y-1.5 bg-white flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-['Outfit'] font-bold text-sm text-slate-900 group-hover:text-[#4A1D96] transition-colors line-clamp-1">
                          {item.title || 'Academy Activity'}
                        </h3>
                        {item.caption ? (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                            {item.caption}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-0.5">
                            Interactive spoken session at WITS LINGO
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Academy Moment'}</span>
                        </span>
                        <span className="text-[#4A1D96] font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          <span>View</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Professional Empty State */
            <div className="text-center py-16 px-4 max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-50 text-[#4A1D96] border border-purple-200 flex items-center justify-center mx-auto shadow-2xs">
                <ImageIcon className="w-8 h-8 text-purple-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  {selectedCategory === 'All Moments' ? 'Gallery Moments Coming Soon' : `No moments in "${selectedCategory}"`}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {selectedCategory === 'All Moments'
                    ? 'More authentic moments, student presentations, and event highlights from WITS LINGO will appear here shortly.'
                    : 'Check back soon or explore other active categories.'}
                </p>
              </div>
              {selectedCategory !== 'All Moments' && (
                <button
                  onClick={() => setSelectedCategory('All Moments')}
                  className="px-4 py-2 rounded-xl bg-[#4A1D96] text-white text-xs font-bold hover:bg-[#3B0764] transition-colors cursor-pointer"
                >
                  View All Moments
                </button>
              )}
            </div>
          )}

          {/* Bottom Call to Action */}
          <div className="mt-12 rounded-3xl bg-gradient-to-tr from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white p-8 sm:p-10 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left max-w-xl">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-white/15 text-purple-200 border border-white/20">
                Be Part of Our Next Class
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-white">
                Start Speaking Fluent English with Confidence
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed">
                Join live courses with dedicated mentor attention, zero hesitation drills, and personalized speaking practice.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => onOpenAdmission()}
                id="gallery-bottom-register-btn"
                className="px-6 py-3 rounded-full bg-white text-[#4A1D96] hover:bg-purple-50 text-xs font-extrabold tracking-wide shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Register for Admission
              </button>
            </div>
          </div>

        </section>
      </div>

      {/* ==================================================================== */}
      {/* LIGHTBOX MODAL */}
      {/* ==================================================================== */}
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
                alt={currentLightboxItem.title || 'WITS LINGO Preview'}
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
                    {currentLightboxItem.title || 'WITS LINGO Moment'}
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
