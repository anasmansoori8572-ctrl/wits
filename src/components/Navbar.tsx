import React, { useState, useEffect, useRef } from 'react';
import { Logo } from './Logo';
import { User, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { Menu, X, Search, ChevronRight, BookOpen, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  siteSettings?: SiteSettings;
  onOpenAdmission: (courseId?: string, batchId?: string) => void;
  onOpenAuth: (role?: 'student' | 'admin') => void;
  onOpenDashboard: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onNavigateGallery?: () => void;
  onNavigateHome?: () => void;
  activeSection: string;
  onBuyCourse?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  siteSettings,
  onOpenAdmission,
  onOpenAuth,
  onOpenDashboard,
  onOpenAdmin,
  onLogout,
  onNavigateGallery,
  onNavigateHome,
  activeSection,
  onBuyCourse,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useScrollLock(mobileMenuOpen);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleNavClick = (e: React.MouseEvent, targetId: string) => {
    if ((activeSection === 'gallery' || activeSection === 'policy') && onNavigateHome) {
      e.preventDefault();
      onNavigateHome();
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth' });
      try {
        window.history.pushState(null, '', `#${targetId}`);
      } catch (err) {}
    }
  };

  const searchableSections = [
    { title: 'Spoken English & Daily Fluency', target: 'courses', desc: 'Core spoken English batch for daily fluency and active conversation' },
    { title: 'Foundation English & Grammar', target: 'courses', desc: 'Tenses, sentence formation, vocabulary building, and syntax' },
    { title: 'Executive Communication & Public Speaking', target: 'courses', desc: 'Professional fluency, interviews, corporate communication' },
    { title: 'Student Reviews & Success Stories', target: 'testimonials', desc: 'Verified reviews and feedback from our students' },
    { title: 'Free Study Materials & Notes', target: 'learning-resources', desc: 'Downloadable PDF study guides, diagnostic assessments, daily vocabulary' },
    { title: 'About Wits Lingo Academy', target: 'about', desc: 'Our methodology, learning framework, and academy details' },
    { title: 'Contact & Support', target: 'contact', desc: 'WhatsApp support, call assistance, admissions helpline' },
  ];

  const filteredSections = searchQuery.trim()
    ? searchableSections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchableSections.slice(0, 4);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md transition-all select-none w-full"
    >
      <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="flex items-center justify-between h-20 sm:h-22">
          {/* Left: Mascot Logo + Wits Lingo Brand Name */}
          <div className="flex items-center">
            <a
              href="#home"
              onClick={(e) => {
                if ((activeSection === 'gallery' || activeSection === 'policy') && onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                } else {
                  handleNavClick(e, 'home');
                }
              }}
              className="flex items-center gap-3 cursor-pointer py-1 group"
            >
              <Logo size="md" variant="serif" />
            </a>
          </div>

          {/* Center: Desktop Navigation Links (Home, Courses, About, Blog, Contact) */}
          <nav className="hidden lg:flex items-center space-x-8 xl:space-x-10 text-[16px] font-medium">
            {/* 1. Home (Active state with purple pill underline) */}
            <a
              href="#home"
              onClick={(e) => handleNavClick(e, 'home')}
              className={`relative py-2 transition-colors cursor-pointer ${
                activeSection === 'home' ? 'text-[#1E123B] font-semibold' : 'text-[#5A526E] hover:text-[#1E123B]'
              }`}
            >
              <span>Home</span>
              {activeSection === 'home' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-9 h-[3px] bg-[#281648] rounded-full" />
              )}
            </a>

            {/* 2. Courses */}
            <a
              href="#courses"
              onClick={(e) => handleNavClick(e, 'courses')}
              className="relative py-2 text-[#5A526E] hover:text-[#1E123B] transition-colors cursor-pointer"
            >
              <span>Courses</span>
            </a>

            {/* 2b. Reviews */}
            <a
              href="#testimonials"
              onClick={(e) => handleNavClick(e, 'testimonials')}
              className="relative py-2 text-[#5A526E] hover:text-[#1E123B] transition-colors cursor-pointer"
            >
              <span>Reviews</span>
            </a>

            {/* 3. About */}
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, 'about')}
              className="relative py-2 text-[#5A526E] hover:text-[#1E123B] transition-colors cursor-pointer"
            >
              <span>About</span>
            </a>

            {/* 4. Blog */}
            <a
              href="#learning-resources"
              onClick={(e) => handleNavClick(e, 'learning-resources')}
              className="relative py-2 text-[#5A526E] hover:text-[#1E123B] transition-colors cursor-pointer"
            >
              <span>Blog</span>
            </a>

            {/* 5. Contact */}
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, 'contact')}
              className="relative py-2 text-[#5A526E] hover:text-[#1E123B] transition-colors cursor-pointer"
            >
              <span>Contact</span>
            </a>
          </nav>

          {/* Right: Search icon, Login link, Get Started button (Desktop layout only) */}
          <div className="hidden lg:flex items-center space-x-6 xl:space-x-7">
            {/* Search Icon */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-1.5 text-[#281648] hover:text-[#6D28D9] hover:bg-purple-50/70 rounded-full transition-all cursor-pointer"
              aria-label="Search courses and resources"
              title="Search"
            >
              <Search className="w-5 h-5 text-[#281648] stroke-[2.2]" />
            </button>

            {/* Login Link or Logged-in User Dashboard */}
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser.role === 'admin') onOpenAdmin();
                    else onOpenDashboard();
                  }}
                  className="flex items-center gap-1.5 text-[16px] font-semibold text-[#281648] hover:text-[#6D28D9] transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#6D28D9]" />
                  <span>{currentUser.role === 'admin' ? 'Admin' : 'Dashboard'}</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Logout"
                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('student')}
                className="text-[16px] font-semibold text-[#281648] hover:text-[#6D28D9] transition-colors cursor-pointer px-1"
              >
                Login
              </button>
            )}

            {/* Buy Course Button */}
            <button
              type="button"
              onClick={() => (onBuyCourse ? onBuyCourse() : onOpenAdmission())}
              id="nav-get-started-btn"
              style={{ backgroundColor: '#281648', color: '#ffffff' }}
              className="px-6 py-2.5 rounded-full font-bold text-[14px] shadow-sm hover:bg-[#1E0F38] hover:shadow-md transition-all active:scale-[0.98] cursor-pointer text-white flex items-center gap-1.5"
            >
              <span>Buy Course</span>
            </button>
          </div>

          {/* Mobile Header: Large Hamburger Menu on right (ONLY shown below lg breakpoint) */}
          <div className="lg:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 -mr-1 text-[#1E123B] hover:text-[#6D28D9] hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-7 h-7 stroke-[2.3]" /> : <Menu className="w-7 h-7 stroke-[2.3]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Quick Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-purple-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
              <Search className="w-5 h-5 text-[#6D28D9] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses, batches, lessons, or grammar notes..."
                className="w-full text-sm outline-none text-[#1E123B] placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
                {searchQuery ? 'Matching Results' : 'Quick Navigation'}
              </div>
              <div className="space-y-1">
                {filteredSections.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      setSearchOpen(false);
                      setSearchQuery('');
                      handleNavClick(e, item.target);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-purple-50/80 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#1E123B] group-hover:text-[#6D28D9]">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1">{item.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#6D28D9] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-purple-100 bg-white px-5 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain">
          <div className="space-y-1 pb-4 border-b border-slate-100 text-sm font-semibold">
            <a
              href="#home"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, 'home');
              }}
              className="block px-3 py-2.5 rounded-xl text-[#1E123B] hover:bg-purple-50"
            >
              Home
            </a>
            <a
              href="#courses"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, 'courses');
              }}
              className="block px-3 py-2.5 rounded-xl text-[#5A526E] hover:bg-purple-50 hover:text-[#1E123B]"
            >
              Courses
            </a>
            <a
              href="#about"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, 'about');
              }}
              className="block px-3 py-2.5 rounded-xl text-[#5A526E] hover:bg-purple-50 hover:text-[#1E123B]"
            >
              About
            </a>
            <a
              href="#learning-resources"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, 'learning-resources');
              }}
              className="block px-3 py-2.5 rounded-xl text-[#5A526E] hover:bg-purple-50 hover:text-[#1E123B]"
            >
              Blog
            </a>
            <a
              href="#contact"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleNavClick(e, 'contact');
              }}
              className="block px-3 py-2.5 rounded-xl text-[#5A526E] hover:bg-purple-50 hover:text-[#1E123B]"
            >
              Contact
            </a>
          </div>

          <div className="pt-4 space-y-3">
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (currentUser.role === 'admin') onOpenAdmin();
                  else onOpenDashboard();
                }}
                className="w-full py-2.5 rounded-full bg-purple-50 text-[#281648] font-bold text-sm border border-purple-200 cursor-pointer"
              >
                Go to {currentUser.role === 'admin' ? 'Admin Panel' : 'Student Dashboard'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('student');
                }}
                className="w-full py-2.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#281648] font-bold text-sm border border-purple-200 cursor-pointer"
              >
                Login to Student Portal
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmission();
              }}
              style={{ backgroundColor: '#281648', color: '#ffffff' }}
              className="w-full py-3 rounded-full text-white text-sm font-bold shadow-md shadow-purple-950/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
