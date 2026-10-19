import React, { useState } from 'react';
import { Logo } from './Logo';
import { User, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { Menu, X, BookOpen, ChevronRight, FileText, Download } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  siteSettings?: SiteSettings;
  onOpenAdmission: (courseId?: string, batchId?: string) => void;
  onOpenAuth: (role?: 'student' | 'admin') => void;
  onOpenDashboard: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onOpenSystemReport?: () => void;
  onNavigateGallery?: () => void;
  onNavigateHome?: () => void;
  activeSection: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  siteSettings,
  onOpenAdmission,
  onOpenAuth,
  onOpenDashboard,
  onOpenAdmin,
  onLogout,
  onOpenSystemReport,
  onNavigateGallery,
  onNavigateHome,
  activeSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = React.useRef<HTMLElement>(null);
  useScrollLock(mobileMenuOpen);

  React.useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const h = headerRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${Math.round(h)}px`);
      }
    };

    updateHeaderHeight();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(headerRef.current);
    }
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [siteSettings?.showAnnouncement, siteSettings?.announcementText]);

  const navLinks = [
    { label: 'Home', href: '#home', isGallery: false },
    { label: 'Courses', href: '#courses', isGallery: false },
    ...(siteSettings?.showBatchesSection !== false ? [{ label: 'Batches', href: '#batches', isGallery: false }] : []),
    { label: 'About', href: '#about', isGallery: false },
    { label: 'Learning Resources', href: '#learning-resources', isGallery: false },
    { label: 'Gallery', href: '#gallery', isGallery: true },
    { label: 'Contact', href: '#contact', isGallery: false },
  ];

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      {/* Top micro-announcement banner */}
      {(siteSettings?.showAnnouncement ?? true) && (
        <div className="bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white text-xs py-1.5 px-3 sm:px-4 text-center font-medium flex items-center justify-between gap-2 transition-all w-full overflow-hidden border-b border-purple-900/30">
          <div className="flex items-center gap-2 mx-auto">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="truncate max-w-[70vw] sm:max-w-none text-[11px] sm:text-xs tracking-tight font-medium">
              {siteSettings?.announcementText || 'New Batch Starts from 1st of each month • Admissions Open for October & November 2026'}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <a 
            href="#home" 
            onClick={(e) => {
              if (activeSection === 'gallery' && onNavigateHome) {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            className="min-w-0 cursor-pointer py-1 flex items-center pr-1 sm:pr-0"
          >
            {/* Desktop & Tablet: Full logo with tagline */}
            <div className="hidden sm:block">
              <Logo size="md" showTagline={true} />
            </div>
            {/* Mobile: Clean, compact logo with tagline */}
            <div className="sm:hidden">
              <Logo size="sm" showTagline={true} />
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  if (link.isGallery) {
                    e.preventDefault();
                    if (onNavigateGallery) onNavigateGallery();
                    else window.location.hash = '#gallery';
                  } else if ((activeSection === 'gallery' || activeSection === 'policy') && onNavigateHome) {
                    onNavigateHome();
                    if (link.href.startsWith('#')) {
                      setTimeout(() => {
                        const targetId = link.href.substring(1);
                        const el = document.getElementById(targetId);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }
                }}
                className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  link.isGallery && activeSection === 'gallery'
                    ? 'text-[#4A1D96] bg-purple-50 font-bold border border-purple-200'
                    : 'text-slate-700 hover:text-[#4A1D96] hover:bg-purple-50/70'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {currentUser && currentUser.role !== 'admin' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onOpenDashboard}
                  id="nav-student-dashboard-btn"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-50 text-[#4A1D96] hover:bg-purple-100 border border-purple-200 transition-all shadow-2xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>My Batch Dashboard</span>
                </button>
              </div>
            )}

            {/* Primary CTA */}
            <button
              onClick={() => onOpenAdmission()}
              id="nav-register-cta-btn"
              className="px-5 py-2.5 rounded-full bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold tracking-wide shadow-sm shadow-purple-900/20 hover:shadow-md hover:shadow-purple-900/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Register Now
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => onOpenAdmission()}
              className="sm:hidden px-3.5 py-1.5 rounded-full bg-[#4A1D96] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              Register
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 sm:p-2 text-slate-700 hover:text-[#4A1D96] hover:bg-purple-50 rounded-lg active:scale-95 transition-colors cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-purple-100 bg-white px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain smooth-scroll-viewport">
          <div className="space-y-1 pb-4 border-b border-slate-100">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  if (link.isGallery) {
                    e.preventDefault();
                    if (onNavigateGallery) onNavigateGallery();
                    else window.location.hash = '#gallery';
                  } else if ((activeSection === 'gallery' || activeSection === 'policy') && onNavigateHome) {
                    onNavigateHome();
                    if (link.href.startsWith('#')) {
                      setTimeout(() => {
                        const targetId = link.href.substring(1);
                        const el = document.getElementById(targetId);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }
                }}
                className={`block px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  link.isGallery && activeSection === 'gallery'
                    ? 'bg-purple-50 text-[#4A1D96] font-bold'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-[#4A1D96]'
                }`}
              >
                {link.label}
              </a>
            ))}
            {onOpenSystemReport && (
              <button
                onClick={() => {
                  onOpenSystemReport();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-purple-900 bg-purple-50/70 hover:bg-purple-100 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-700" />
                  Website Report & Architecture (PDF)
                </span>
                <Download className="w-4 h-4 text-purple-700" />
              </button>
            )}
          </div>

          <div className="pt-4 space-y-3">
            <button
              onClick={() => {
                onOpenAdmission();
                setMobileMenuOpen(false);
              }}
              className="w-full py-3 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-sm font-bold shadow-md shadow-purple-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Register Now — Admission Form</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
