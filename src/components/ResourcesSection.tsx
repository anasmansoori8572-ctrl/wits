import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, CheckCircle2, Sparkles, ExternalLink, ArrowRight, Eye, Lock, ShieldCheck } from 'lucide-react';
import { ResourceItem } from '../types';
import { ProtectedPdfViewer } from './ProtectedPdfViewer';

export const ResourcesSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewingResource, setViewingResource] = useState<ResourceItem | null>(null);

  const categories = [
    'All',
    'Worksheets',
    'English Vocabulary',
    'Daily Sentences',
    'Speaking Practice',
    'Learning Tips',
    'Study Notes'
  ];

  const [backendMaterials, setBackendMaterials] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_materials');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    fetch('/api/materials')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.materials)) {
          setBackendMaterials(data.materials);
        }
      })
      .catch(err => console.warn('Could not fetch materials in ResourcesSection:', err));

    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('wits_lingo_materials');
        if (saved) setBackendMaterials(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wits_lingo_material_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wits_lingo_material_updated', handleStorageChange);
    };
  }, []);

  const resources: ResourceItem[] = React.useMemo(() => {
    return backendMaterials
      .filter(m => (m.resourceType === 'pdf' || (!m.resourceType && !m.youtubeUrl)) && m.isVisibleOnWebsite !== false && m.isPublished !== false)
      .map(m => ({
        id: m.id,
        title: m.title,
        category: m.category || 'Worksheets',
        description: m.description || 'Uploaded course study materials and practice guides.',
        level: m.level || 'All Levels',
        downloadCount: 1200,
        fileType: (m.fileType || 'PDF').toUpperCase(),
        pdfUrl: m.pdfUrl,
        downloadUrl: m.downloadUrl,
        isViewOnly: m.isViewOnly !== false,
        allowDownload: Boolean(m.allowDownload),
        batchId: m.batchId,
        uploadedDate: m.uploadedDate || m.uploadedAt
      }));
  }, [backendMaterials]);

  const filtered = resources.filter((item) => {
    const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <section id="resources" className="py-20 bg-white border-b border-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#4A1D96] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Knowledge Bank • View-Only</span>
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-[#1E1B26]">
            Learning Resources & Study Guides
          </h2>
          <p className="text-base text-slate-600">
            Read practical guides, worksheets, and vocabulary cheat sheets curated by Wits Lingo Academy in our optimized, download-protected reader.
          </p>
        </div>

        {/* Search Bar & Category Filter */}
        <div className="max-w-4xl mx-auto space-y-4 mb-10">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vocabulary, grammar guides, conversation scripts, worksheets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#FAF9FC] border border-slate-200 focus:outline-none focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-100 text-sm text-slate-800 transition-all"
            />
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#4A1D96] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Resources Grid */}
        {resources.length === 0 ? (
          <div className="py-16 text-center bg-[#FAF9FC] rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
            <p className="font-bold text-slate-800 text-base">No study materials available yet.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Check back soon for new guides and worksheets.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-[#FAF9FC] rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
            <p className="font-bold text-slate-800 text-base">No study materials found</p>
            <button
              type="button"
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4A1D96] font-bold text-xs transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {filtered.map((res) => (
            <div
              key={res.id}
              className="bg-[#FAF9FC] hover:bg-white rounded-2xl p-5 border border-purple-100/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                    {res.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>View-Only</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {res.fileType}
                    </span>
                  </div>
                </div>

                <h3 className="font-['Outfit'] font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#4A1D96] transition-colors line-clamp-2">
                  {res.title}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {res.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {res.level}
                </span>

                <button
                  type="button"
                  onClick={() => setViewingResource(res)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 group-hover:bg-[#4A1D96] text-[#4A1D96] group-hover:text-white text-xs font-bold border border-purple-200 group-hover:border-[#4A1D96] transition-all shadow-xs cursor-pointer"
                  title="Read in Protected View-Only Reader"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Security & Copyright Notice Banner */}
        <div className="mt-12 text-center p-6 bg-purple-50/50 rounded-2xl border border-purple-100/70 max-w-2xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-[#4A1D96] uppercase tracking-wide">
            <Lock className="w-3.5 h-3.5" />
            <span>Protected Academy Learning Material</span>
          </div>
          <p className="text-xs text-slate-600">
            All PDF notes, worksheets, and handbooks are secured with Wits Lingo View-Only protection. Students can read smoothly on any phone, tablet, or PC without file downloads.
          </p>
        </div>

        {/* Protected View-Only PDF Viewer Modal */}
        {viewingResource && (
          <ProtectedPdfViewer
            isOpen={Boolean(viewingResource)}
            onClose={() => setViewingResource(null)}
            title={viewingResource.title}
            pdfUrl={viewingResource.pdfUrl}
            category={viewingResource.category}
            description={viewingResource.description}
            studentName="Wits Lingo Learner"
            allowDownload={true}
          />
        )}

      </div>
    </section>
  );
};

