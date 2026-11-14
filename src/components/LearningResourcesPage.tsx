import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Search, BookOpen, Eye, Download, 
  FileText, Lock, ShieldCheck, Sparkles, X, 
  ChevronRight, CheckCircle2, MessageSquare, Phone,
  Layers, ExternalLink
} from 'lucide-react';
import { StudyMaterial, ResourceItem, SiteSettings } from '../types';
import { ProtectedPdfViewer } from './ProtectedPdfViewer';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

interface LearningResourcesPageProps {
  onBackToHome: () => void;
  onOpenAdmission?: (courseId?: string) => void;
  materials?: StudyMaterial[];
  siteSettings?: SiteSettings;
}

const DEFAULT_FALLBACK_RESOURCES: ResourceItem[] = [
  {
    id: 'res-default-1',
    title: '50 Daily Routine Sentences Used in Real Life',
    category: 'Daily Sentences',
    description: 'High-frequency English sentence structures for morning routines, workplace interactions, and casual social conversations.',
    level: 'Beginner & Intermediate',
    downloadCount: 2450,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/50-daily-routine-sentences.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '12 Nov 2026',
    isUploaded: true
  },
  {
    id: 'res-default-2',
    title: 'Essential Spoken English Pronunciation & Sound Drills',
    category: 'Speaking Practice',
    description: 'Practical phonetic breakdowns, mouth positioning guides, and stress patterns to neutralize hesitation and speak clearly.',
    level: 'All Levels',
    downloadCount: 1980,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/pronunciation-drills.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '10 Nov 2026',
    isUploaded: true
  },
  {
    id: 'res-default-3',
    title: '500 Most Essential Spoken Vocabulary Handbook',
    category: 'English Vocabulary',
    description: 'Comprehensive thematic vocabulary with real-life context examples, collocations, and natural conversation usage.',
    level: 'Intermediate',
    downloadCount: 3120,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/500-essential-vocabulary.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '08 Nov 2026',
    isUploaded: true
  },
  {
    id: 'res-default-4',
    title: 'Natural Grammar Framework: English Tenses Simplified',
    category: 'Grammar Guides',
    description: 'Learn when to use Past, Present, and Future tenses naturally in conversation without getting stuck in mechanical rules.',
    level: 'Beginner to Advanced',
    downloadCount: 2890,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/natural-grammar-framework.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '05 Nov 2026',
    isUploaded: true
  },
  {
    id: 'res-default-5',
    title: 'Interactive Conversation Dialogue Worksheets',
    category: 'Worksheets',
    description: 'Guided 2-person speaking prompts, role-play scenarios, and sentence completion exercises for real-world confidence.',
    level: 'All Levels',
    downloadCount: 1640,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/conversation-dialogue-worksheets.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '03 Nov 2026',
    isUploaded: true
  },
  {
    id: 'res-default-6',
    title: 'Confidence Blueprint: Overcoming Speaking Hesitation',
    category: 'Study Notes',
    description: 'Psychological strategies, breathing exercises, and speaking habits to stop translating in your head and speak fluidly.',
    level: 'All Levels',
    downloadCount: 2210,
    fileType: 'PDF',
    pdfUrl: 'https://cdn.witslingo.com/resources/confidence-blueprint.pdf',
    downloadUrl: '#',
    isViewOnly: true,
    allowDownload: false,
    uploadedDate: '01 Nov 2026',
    isUploaded: true
  }
];

const CATEGORIES = [
  'All',
  'Worksheets',
  'Daily Sentences',
  'Speaking Practice',
  'English Vocabulary',
  'Grammar Guides',
  'Study Notes'
];

export const LearningResourcesPage: React.FC<LearningResourcesPageProps> = ({
  onBackToHome,
  onOpenAdmission,
  materials: propMaterials = [],
  siteSettings
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

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [readingResource, setReadingResource] = useState<ResourceItem | null>(null);

  // Sync propMaterials when changed
  useEffect(() => {
    if (propMaterials && propMaterials.length > 0) {
      setBackendMaterials(propMaterials);
    }
  }, [propMaterials]);

  // Fetch latest public materials from server
  useEffect(() => {
    const fetchPublicMaterials = async () => {
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
      } catch (err) {
        console.warn('Could not load public study materials:', err);
      }
    };

    fetchPublicMaterials();

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

  // Map backend study materials to displayable resource items (filter out youtube resources)
  const allResources: ResourceItem[] = useMemo(() => {
    const pdfMaterials = backendMaterials.filter(m => 
      (m.resourceType === 'pdf' || (!m.resourceType && !m.youtubeUrl && m.fileType !== 'youtube')) && 
      m.isVisibleOnWebsite !== false && 
      m.isPublished !== false
    );

    if (pdfMaterials.length === 0) {
      return DEFAULT_FALLBACK_RESOURCES;
    }

    const mapped = pdfMaterials.map((m): ResourceItem => {
      let cat = m.category || 'Worksheets';
      if (!m.category) {
        const t = m.title.toLowerCase();
        if (t.includes('vocab') || t.includes('word')) cat = 'English Vocabulary';
        else if (t.includes('sentence') || t.includes('routine') || t.includes('phrase')) cat = 'Daily Sentences';
        else if (t.includes('grammar') || t.includes('tense') || t.includes('verb')) cat = 'Grammar Guides';
        else if (t.includes('speak') || t.includes('intro') || t.includes('pronun') || t.includes('conversation')) cat = 'Speaking Practice';
        else if (t.includes('sheet') || t.includes('drill') || t.includes('worksheet') || t.includes('guide')) cat = 'Worksheets';
        else if (t.includes('test') || t.includes('quiz') || t.includes('eval')) cat = 'Practice Tests';
        else cat = 'Study Notes';
      }

      return {
        id: m.id,
        resourceType: 'pdf',
        title: m.title,
        category: cat,
        description: m.description || 'Verified study resource and practice materials uploaded by academy instructors.',
        level: m.level || 'All Levels',
        downloadCount: 1540,
        fileType: (m.fileType || 'PDF').toUpperCase(),
        pdfUrl: m.pdfUrl,
        downloadUrl: m.downloadUrl,
        isViewOnly: m.isViewOnly !== false,
        allowDownload: Boolean(m.allowDownload),
        batchId: m.batchId,
        uploadedDate: m.uploadedAt || 'Official Academy Guide',
        isUploaded: true
      };
    });

    return mapped;
  }, [backendMaterials]);

  // Filtered resources by category and search
  const filteredResources = useMemo(() => {
    return allResources.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const matchSearch = 
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allResources, selectedCategory, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allResources.length };
    CATEGORIES.forEach(cat => {
      if (cat !== 'All') {
        counts[cat] = allResources.filter(r => r.category === cat).length;
      }
    });
    return counts;
  }, [allResources]);

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#1E1B26]">
      {/* =========================================================================
          HERO BANNER (Royal Purple Theme)
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#200B3B] text-white">
        {/* Subtle decorative background texture */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity scale-105 pointer-events-none"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1920&q=80')`
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#18082D]/95 via-[#250D45]/90 to-[#18082D] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 sm:pb-20">
          
          {/* Top Breadcrumb & Return to Home Button */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/15 backdrop-blur-md transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-purple-200/80 font-medium">
              <span className="hover:text-white cursor-pointer" onClick={onBackToHome}>Home</span>
              <ChevronRight className="w-3.5 h-3.5 text-purple-400/60" />
              <span className="text-white font-semibold">Learning Resources</span>
            </div>
          </div>

          {/* Hero Content */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-inner">
              <BookOpen className="w-3.5 h-3.5 text-purple-300" />
              <span>Official Student Knowledge Bank</span>
            </div>

            <h1 className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15]">
              Learning Resources & <span className="bg-gradient-to-r from-purple-200 via-white to-purple-300 bg-clip-text text-transparent">Study Guides</span>
            </h1>

            <p className="text-base sm:text-lg text-purple-100/90 leading-relaxed font-normal">
              Read verified spoken English handbooks, grammar notes, practice worksheets, and daily vocabulary guides directly online on any device.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-purple-200/80">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>In-App Protected Reader</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-300" />
                <span>Zero Installation Required</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Mobile, Tablet & PC Friendly</span>
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          CONTROLS: SEARCH & CATEGORY FILTERING
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-20">
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xl shadow-purple-950/5 border border-purple-100/80 space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search PDF study guides, daily sentences, grammar topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-hidden focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-500/20 text-slate-900 text-sm font-medium transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Total Results Counter */}
            <div className="text-xs sm:text-sm font-semibold text-slate-500 whitespace-nowrap px-2">
              Showing <span className="font-extrabold text-[#4A1D96]">{filteredResources.length}</span> of {allResources.length} PDF Guides
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {CATEGORIES.map((category) => {
              const isActive = selectedCategory === category;
              const count = categoryCounts[category] || 0;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-[#4A1D96] text-white shadow-md shadow-purple-900/20'
                      : 'bg-slate-100/80 hover:bg-purple-50 text-slate-600 hover:text-[#4A1D96] border border-transparent hover:border-purple-200'
                  }`}
                >
                  <span>{category}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          STUDY MATERIALS GRID
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        
        {filteredResources.length === 0 ? (
          <div className="py-16 px-4 text-center bg-white rounded-3xl border border-dashed border-purple-200 max-w-xl mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#4A1D96] flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="font-['Outfit'] font-bold text-slate-800 text-lg">No PDF guides found</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              We couldn't find any documents matching "{searchQuery}" in category "{selectedCategory}".
            </p>
            <button
              type="button"
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="px-5 py-2.5 rounded-full bg-[#4A1D96] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResources.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-purple-300 shadow-xs hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300 flex flex-col justify-between group relative transform hover:-translate-y-1"
              >
                <div className="space-y-3.5">
                  
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-[#4A1D96] border border-purple-200/80">
                      {item.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>View-Only</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        PDF
                      </span>
                    </div>
                  </div>

                  {/* Document Icon & Title */}
                  <div className="space-y-2">
                    <div className="w-11 h-11 rounded-2xl bg-purple-50 text-[#4A1D96] flex items-center justify-center group-hover:scale-105 group-hover:bg-[#4A1D96] group-hover:text-white transition-all shadow-inner">
                      <FileText className="w-5 h-5" />
                    </div>

                    <h3 className="font-['Outfit'] font-bold text-base sm:text-lg text-slate-900 group-hover:text-[#4A1D96] transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 mt-5 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{item.level || 'All Levels'}</span>
                    <span>{item.uploadedDate}</span>
                  </div>

                  {/* Action Buttons: Read PDF */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReadingResource(item)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#4A1D96] hover:bg-[#3C166D] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer"
                      title="Read PDF in In-App Protected Viewer"
                    >
                      <BookOpen className="w-4 h-4 text-purple-200" />
                      <span>Read PDF</span>
                    </button>

                    {item.allowDownload && item.downloadUrl && item.downloadUrl !== '#' && (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-slate-200 hover:border-purple-300 bg-white hover:bg-purple-50 text-slate-700 hover:text-[#4A1D96] transition-colors cursor-pointer"
                        title="Download PDF Copy"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </section>

      {/* =========================================================================
          HELP & ACADEMY SUPPORT BANNER
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-gradient-to-br from-[#281648] via-[#3C166D] to-[#1E0E38] rounded-3xl p-6 sm:p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold uppercase tracking-wider border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Need Live Guidance?</span>
            </div>
            <h3 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold">
              Have Questions About The Lessons Or Need Study Help?
            </h3>
            <p className="text-sm text-purple-100/90 leading-relaxed font-normal">
              Connect directly with Lead Mentor Ziyaur Rehman Zia on WhatsApp for personalized practice advice, batch admissions, and diagnostic assessments.
            </p>
          </div>

          <a
            href={`https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodeURIComponent("Hello Wits Lingo! I am reading the study materials on the Learning Resources page and have a question.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950/20 transition-all shrink-0 cursor-pointer hover:scale-[1.02]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </section>

      {/* =========================================================================
          PROTECTED IN-APP PDF VIEWER MODAL
          ========================================================================= */}
      <ProtectedPdfViewer
        isOpen={Boolean(readingResource)}
        onClose={() => setReadingResource(null)}
        title={readingResource?.title || 'Study Material'}
        pdfUrl={readingResource?.pdfUrl || readingResource?.downloadUrl}
        category={readingResource?.category}
        batchName="Wits Lingo Academy"
        description={readingResource?.description}
        allowDownload={readingResource?.allowDownload}
      />
    </div>
  );
};
