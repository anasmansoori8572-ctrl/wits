import React, { useState, useEffect, useRef } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  FileText, Loader2, ArrowLeftRight, ChevronLeft, ChevronRight
} from 'lucide-react';
import { optimizePdfUrl } from '../utils/pdfOptimizer';
import { getCurriculumForDocument } from '../data/resourceCurriculumContent';

interface ProtectedPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl?: string;
  category?: string;
  batchName?: string;
  studentName?: string;
  description?: string;
  allowDownload?: boolean;
}

export const ProtectedPdfViewer: React.FC<ProtectedPdfViewerProps> = ({
  isOpen,
  onClose,
  title,
  pdfUrl,
  category = 'Study Material',
  description
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);

  const optimization = optimizePdfUrl(pdfUrl || '');
  const curriculum = getCurriculumForDocument(title, category, description);
  const hasEmbedPdf = Boolean(optimization.embedUrl);

  useScrollLock(isOpen);

  // Reset states when opening a new document
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setZoomLevel(100);
      setCurrentPage(1);
    }
  }, [isOpen, pdfUrl]);

  // Handle Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 15, 175));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 15, 70));
  const handleResetZoom = () => setZoomLevel(100);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const totalPages = curriculum.pages.length || 1;
  const activeCurriculumPage = curriculum.pages[currentPage - 1] || curriculum.pages[0];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={containerRef}
        className="w-full h-full sm:max-h-[96vh] sm:max-w-6xl bg-[#1E1B26] text-white sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden border-0 sm:border sm:border-purple-900/40"
      >
        {/* Minimal, Clean Top Bar */}
        <header className="px-3 sm:px-5 py-2.5 bg-[#14101D] border-b border-white/10 flex items-center justify-between gap-3 shrink-0 z-20">
          
          {/* Document Title & Category */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-900/60 text-purple-300 flex items-center justify-center shrink-0 border border-purple-700/40">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md lg:max-w-lg font-['Outfit']">
                {title}
              </h2>
              {category && (
                <span className="text-[10px] text-purple-300/80 block truncate">
                  {category}
                </span>
              )}
            </div>
          </div>

          {/* Clean Reading Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Page navigation for text curriculum fallback when no external PDF URL */}
            {!hasEmbedPdf && totalPages > 1 && (
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-xs text-slate-300 mr-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-semibold text-white whitespace-nowrap">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-xs text-slate-300">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 70}
                className="p-1.5 hover:text-white disabled:opacity-30 cursor-pointer rounded hover:bg-white/10 transition-colors"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 text-[11px] font-semibold font-mono text-slate-200 hover:text-white cursor-pointer"
                title="Reset Zoom to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 175}
                className="p-1.5 hover:text-white disabled:opacity-30 cursor-pointer rounded hover:bg-white/10 transition-colors"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fit to Width Option */}
            <button
              type="button"
              onClick={() => setFitToWidth(prev => !prev)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                fitToWidth ? 'bg-purple-600 text-white shadow-xs' : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/15'
              }`}
              title={fitToWidth ? 'Centered Mode' : 'Fit to Width'}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Fit Width</span>
            </button>

            {/* Fullscreen Reading Option */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs ml-1"
              title="Close and Return to Learning Resources"
              aria-label="Close PDF Viewer"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Close</span>
            </button>
          </div>
        </header>

        {/* PDF Reading Viewport */}
        <div className="flex-1 overflow-auto relative bg-[#0F0D15] flex justify-center items-stretch p-0 sm:p-2">
          
          {hasEmbedPdf ? (
            <div 
              className={`w-full h-full flex flex-col justify-center transition-all ${
                fitToWidth ? 'max-w-none' : 'max-w-5xl mx-auto'
              }`}
            >
              {/* Subtle Loading Spinner */}
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0F0D15]/90 backdrop-blur-2xs">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-300 font-medium">Loading document...</p>
                </div>
              )}

              {/* PDF Document Container with dynamic Zoom */}
              <div 
                style={{
                  transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                  transformOrigin: 'top center',
                  width: zoomLevel > 100 ? `${zoomLevel}%` : '100%',
                  height: zoomLevel > 100 ? `${zoomLevel}%` : '100%',
                  minHeight: '100%'
                }}
                className="w-full h-full transition-transform duration-100 flex-1"
              >
                <iframe
                  src={optimization.embedUrl}
                  title={title}
                  className="w-full h-full border-0 bg-white rounded-none sm:rounded-xl shadow-inner"
                  allow="fullscreen"
                  onLoad={() => setIsLoading(false)}
                />
              </div>
            </div>
          ) : (
            /* Digital Reader Fallback when document has no external PDF URL */
            <div 
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                transformOrigin: 'top center'
              }}
              className={`w-full transition-transform duration-100 ${
                fitToWidth ? 'max-w-4xl' : 'max-w-2xl'
              } mx-auto my-4 sm:my-8 bg-white text-slate-900 rounded-2xl p-6 sm:p-10 shadow-xl space-y-6`}
            >
              <div className="border-b border-slate-200 pb-4">
                <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                  Page {currentPage} of {totalPages}
                </span>
                <h1 className="font-['Outfit'] font-extrabold text-xl sm:text-2xl text-slate-900 mt-1">
                  {activeCurriculumPage.heading}
                </h1>
                {activeCurriculumPage.subheading && (
                  <p className="text-xs text-slate-500 mt-1">
                    {activeCurriculumPage.subheading}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {activeCurriculumPage.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-2">
                    {sec.title && (
                      <h3 className="font-bold text-sm text-[#4A1D96]">
                        {sec.title}
                      </h3>
                    )}
                    {sec.content && (
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {sec.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProtectedPdfViewer;
