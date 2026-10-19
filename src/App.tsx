import React, { useState, useEffect } from 'react';
import { User, CourseData, Batch, TestimonialData, SiteSettings, Announcement, StudyMaterial } from './types';
import { INITIAL_COURSES, INITIAL_BATCHES, INITIAL_TESTIMONIALS, INITIAL_SITE_SETTINGS, INITIAL_ANNOUNCEMENTS } from './data/initialData';

// Components
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { StatsSection } from './components/StatsSection';
import { WhatWeTeach } from './components/WhatWeTeach';
import { CoursesSection } from './components/CoursesSection';
import { BatchesSection } from './components/BatchesSection';
import { LearningResources } from './components/LearningResources';
import { CommunitySection } from './components/CommunitySection';
import { FounderSection } from './components/FounderSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';

// Modals & Portals
import { AdmissionModal } from './components/AdmissionModal';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginPage } from './components/AdminLoginPage';
import { GalleryPage } from './components/GalleryPage';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { SystemReportModal } from './components/SystemReportModal';
import { CheckoutModal } from './components/CheckoutModal';
import { PaymentStatusModal } from './components/PaymentStatusModal';
import { PolicyPages, PolicyTab } from './components/PolicyPages';
import { WITS_LINGO_CONFIG } from './config/witsLingoConfig';

type AdminTabType = 'students' | 'courses' | 'batches' | 'classes' | 'recordings' | 'materials' | 'youtube-lessons' | 'hero-video' | 'gallery' | 'testimonials' | 'announcements' | 'settings' | 'orders-payments' | 'whatsapp-notifications' | 'support-tickets' | 'knowledge-base';

function parseAdminSubroute(path: string, hash: string): AdminTabType | undefined {
  const p = path.toLowerCase();
  const h = hash.toLowerCase();
  const raw = p.startsWith('/admin') ? p.replace(/^\/admin\/?/, '') : h.startsWith('#admin') ? h.replace(/^#admin\/?/, '') : '';
  const sub = raw.split('/')[0]?.split('?')[0];
  if (!sub) return undefined;
  if (sub === 'courses') return 'courses';
  if (sub === 'batches') return 'batches';
  if (sub === 'students' || sub === 'admissions') return 'students';
  if (sub === 'resources' || sub === 'materials' || sub === 'notes' || sub === 'pdfs') return 'materials';
  if (sub === 'youtube' || sub === 'youtube-lessons' || sub === 'video-lessons' || sub === 'videos') return 'youtube-lessons';
  if (sub === 'gallery') return 'gallery';
  if (sub === 'hero-video' || sub === 'video') return 'hero-video';
  if (sub === 'classes') return 'classes';
  if (sub === 'recordings') return 'recordings';
  if (sub === 'testimonials' || sub === 'reviews') return 'testimonials';
  if (sub === 'announcements' || sub === 'notices') return 'announcements';
  if (sub === 'settings' || sub === 'logo' || sub === 'cms') return 'settings';
  if (sub === 'orders' || sub === 'payments' || sub === 'orders-payments') return 'orders-payments';
  if (sub === 'whatsapp' || sub === 'notifications' || sub === 'whatsapp-notifications') return 'whatsapp-notifications';
  if (sub === 'tickets' || sub === 'support' || sub === 'support-tickets') return 'support-tickets';
  if (sub === 'knowledge' || sub === 'knowledge-base' || sub === 'faqs' || sub === 'faq') return 'knowledge-base';
  return undefined;
}

function parsePolicySubroute(path: string, hash: string): PolicyTab | undefined {
  const p = path.toLowerCase().replace(/^\/+/, '').split('/')[0]?.split('?')[0] || '';
  const h = hash.toLowerCase().replace(/^#+/, '').split('/')[0]?.split('?')[0] || '';

  const check = (str: string): PolicyTab | undefined => {
    if (!str) return undefined;
    if (str === 'terms' || str === 'terms-and-conditions' || str === 'terms-of-service' || str === 'tos') return 'terms';
    if (str === 'privacy' || str === 'privacy-policy') return 'privacy';
    if (str === 'refund-policy' || str === 'refund' || str === 'refunds' || str === 'cancellation-refund' || str === 'cancellation') return 'refund-policy';
    if (str === 'shipping-policy' || str === 'shipping' || str === 'shipping-and-delivery' || str === 'delivery') return 'shipping-policy';
    if (str === 'contact-us' || str === 'contact' || str === 'support' || str === 'grievance') return 'contact';
    if (str === 'about-us' || str === 'about') return 'about';
    return undefined;
  };

  return check(p) || check(h);
}

export default function App() {
  // Navigation View: 'home' | 'student-dashboard' | 'admin-panel' | 'gallery' | 'admin-login' | 'policy'
  const [currentView, setCurrentView] = useState<'home' | 'student-dashboard' | 'admin-panel' | 'gallery' | 'admin-login' | 'policy'>(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (path === '/admin' || path.startsWith('/admin') || hash === '#admin' || hash.startsWith('#admin')) {
        const savedUserStr = localStorage.getItem('wits_lingo_user');
        const savedToken = localStorage.getItem('wits_lingo_token');
        if (savedUserStr && savedToken) {
          try {
            const u = JSON.parse(savedUserStr);
            if (u.role === 'admin') return 'admin-panel';
          } catch (e) {}
        }
        return 'admin-login';
      }
      if (path === '/gallery' || path.startsWith('/gallery') || hash === '#gallery') {
        return 'gallery';
      }
      if (parsePolicySubroute(path, hash)) {
        return 'policy';
      }
    }
    return 'home';
  });

  const [policyTab, setPolicyTab] = useState<PolicyTab>(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const matched = parsePolicySubroute(path, hash);
      if (matched) return matched;
    }
    return 'terms';
  });

  const [adminTab, setAdminTab] = useState<AdminTabType | undefined>(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      return parseAdminSubroute(path, hash);
    }
    return undefined;
  });

  const [isVerifyingAdminSession, setIsVerifyingAdminSession] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const isAdminRoute = path === '/admin' || path.startsWith('/admin') || hash === '#admin' || hash.startsWith('#admin');
      const savedToken = localStorage.getItem('wits_lingo_token');
      if (isAdminRoute && savedToken) return true;
    }
    return false;
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('wits_lingo_user');
      if (savedUser) {
        try { return JSON.parse(savedUser); } catch (e) {}
      }
    }
    return null;
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wits_lingo_token');
    }
    return null;
  });

  // Modals
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSystemReportOpen, setIsSystemReportOpen] = useState(false);
  const [authRole, setAuthRole] = useState<'student' | 'admin'>('student');
  const [selectedCourseForAdmission, setSelectedCourseForAdmission] = useState<string | undefined>();
  const [selectedBatchForAdmission, setSelectedBatchForAdmission] = useState<string | undefined>();

  // Automated Checkout & Payment Status Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCourseForCheckout, setSelectedCourseForCheckout] = useState<string | undefined>();
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false);
  const [paymentStatusOrderId, setPaymentStatusOrderId] = useState<string | undefined>();
  const [paymentStatusData, setPaymentStatusData] = useState<any>(null);

  const handleOpenCheckout = (courseId?: string) => {
    setSelectedCourseForCheckout(courseId || courses[0]?.id || 'course-spoken-english');
    setIsCheckoutOpen(true);
  };

  // Live CMS Course, Batch, Testimonial, and Site Settings State with LocalStorage Caching
  const [courses, setCourses] = useState<CourseData[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_courses');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_COURSES;
  });

  const [batches, setBatches] = useState<Batch[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_batches');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_BATCHES;
  });

  const [testimonials, setTestimonials] = useState<TestimonialData[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_testimonials');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_TESTIMONIALS;
  });

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_site_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = {
          ...INITIAL_SITE_SETTINGS,
          ...parsed,
          academyName: (parsed.academyName === 'Wits Lingo Academy' || !parsed.academyName) ? 'WITS LINGO' : parsed.academyName,
          tagline: 'A Global Language Platform',
        };
        if (!merged.youtubeUrl || merged.youtubeUrl.includes('@witslingo') && !merged.youtubeUrl.includes('@witslingoeng')) {
          merged.youtubeUrl = 'https://youtube.com/@witslingoeng';
        }
        return merged;
      }
    } catch (e) {}
    return INITIAL_SITE_SETTINGS;
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_announcements');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_ANNOUNCEMENTS;
  });

  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    try {
      const saved = localStorage.getItem('wits_lingo_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const handleUpdateCourses = async (newCourses: CourseData[]) => {
    setCourses(newCourses);
    localStorage.setItem('wits_lingo_courses', JSON.stringify(newCourses));
    try {
      await fetch('/api/cms/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({ courses: newCourses })
      });
    } catch (e) {
      console.warn('Could not sync courses to backend:', e);
    }
  };

  const handleUpdateBatches = (newBatches: Batch[]) => {
    setBatches(newBatches);
    localStorage.setItem('wits_lingo_batches', JSON.stringify(newBatches));
  };

  const handleUpdateTestimonials = (newTestimonials: TestimonialData[]) => {
    setTestimonials(newTestimonials);
    localStorage.setItem('wits_lingo_testimonials', JSON.stringify(newTestimonials));
  };

  const handleUpdateSiteSettings = (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    localStorage.setItem('wits_lingo_site_settings', JSON.stringify(newSettings));
  };

  const handleUpdateAnnouncements = (newAnnouncements: Announcement[]) => {
    setAnnouncements(newAnnouncements);
    localStorage.setItem('wits_lingo_announcements', JSON.stringify(newAnnouncements));
  };

  const handleUpdateMaterials = (newMaterials: StudyMaterial[]) => {
    setMaterials(newMaterials);
    localStorage.setItem('wits_lingo_materials', JSON.stringify(newMaterials));
    window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: newMaterials }));
  };

  // Check saved session & fetch materials on mount
  useEffect(() => {
    const path = (window.location.pathname || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    const isAdminRoute = path === '/admin' || path.startsWith('/admin') || hash === '#admin' || hash.startsWith('#admin');
    
    if (isAdminRoute) {
      const sub = parseAdminSubroute(path, hash);
      if (sub) setAdminTab(sub);
    }

    const savedUser = localStorage.getItem('wits_lingo_user');
    const savedToken = localStorage.getItem('wits_lingo_token');

    if (isAdminRoute && savedToken) {
      setIsVerifyingAdminSession(true);
    }

    // Verify session authenticity with backend
    if (savedToken) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
        .then(res => {
          if (!res.ok) {
            localStorage.removeItem('wits_lingo_user');
            localStorage.removeItem('wits_lingo_token');
            setCurrentUser(null);
            setAuthToken(null);
            if (isAdminRoute) {
              setCurrentView('admin-login');
            }
          } else {
            return res.json();
          }
        })
        .then(data => {
          if (data?.user) {
            setCurrentUser(data.user);
            setAuthToken(savedToken);
            localStorage.setItem('wits_lingo_user', JSON.stringify(data.user));
            if (isAdminRoute && data.user.role === 'admin') {
              setCurrentView('admin-panel');
            }
          }
        })
        .catch(() => {
          if (savedUser) {
            try {
              const u = JSON.parse(savedUser);
              setCurrentUser(u);
              setAuthToken(savedToken);
            } catch (e) {}
          }
        })
        .finally(() => {
          setIsVerifyingAdminSession(false);
        });
    } else if (isAdminRoute) {
      // Check cookie session fallback
      setIsVerifyingAdminSession(true);
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user && data.user.role === 'admin') {
            setCurrentUser(data.user);
            const tok = data.token || 'admin-session';
            setAuthToken(tok);
            localStorage.setItem('wits_lingo_user', JSON.stringify(data.user));
            localStorage.setItem('wits_lingo_token', tok);
            setCurrentView('admin-panel');
          } else {
            setCurrentView('admin-login');
          }
        })
        .catch(() => {
          setCurrentView('admin-login');
        })
        .finally(() => {
          setIsVerifyingAdminSession(false);
        });
    }

    // Fetch live courses catalog from backend
    fetch('/api/courses?includeAll=true')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          localStorage.setItem('wits_lingo_courses', JSON.stringify(data.courses));
        }
      })
      .catch(err => console.warn('Could not load courses from backend:', err));

    // Fetch live study materials
    fetch('/api/materials')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.materials)) {
          setMaterials(data.materials);
          localStorage.setItem('wits_lingo_materials', JSON.stringify(data.materials));
        }
      })
      .catch(err => console.warn('Could not load materials in App:', err));

    // Fetch CMS settings (including active central logo)
    fetch('/api/cms/content')
      .then(res => res.json())
      .then(data => {
        if (data?.content?.settings) {
          setSiteSettings(prev => {
            const merged = { ...prev, ...data.content.settings };
            localStorage.setItem('wits_lingo_site_settings', JSON.stringify(merged));
            if (data.content.settings.logoUrl) {
              window.dispatchEvent(new CustomEvent('wits_lingo_logo_updated', {
                detail: {
                  logoUrl: data.content.settings.logoUrl,
                  logoVersion: data.content.settings.logoVersion
                }
              }));
            }
            return merged;
          });
        }
      })
      .catch(err => console.warn('Could not sync CMS settings in App:', err));

    // Handle URL path / hash navigation for /gallery, /admin, #gallery, #admin
    const handleUrlChange = () => {
      const hash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();

      const savedUserStr = localStorage.getItem('wits_lingo_user');
      const savedToken = localStorage.getItem('wits_lingo_token');
      let isAdminLoggedIn = false;
      if (savedUserStr && savedToken) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u.role === 'admin') isAdminLoggedIn = true;
        } catch (e) {}
      }

      const policyMatch = parsePolicySubroute(path, hash);
      if (policyMatch) {
        setPolicyTab(policyMatch);
        setCurrentView('policy');
      } else if (path === '/admin' || path.startsWith('/admin') || hash === '#admin' || hash.startsWith('#admin')) {
        const sub = parseAdminSubroute(path, hash);
        if (sub) setAdminTab(sub);
        if (isAdminLoggedIn) {
          setCurrentView('admin-panel');
        } else {
          setCurrentView('admin-login');
        }
      } else if (hash === '#gallery' || path === '/gallery' || path.startsWith('/gallery')) {
        setCurrentView('gallery');
      } else if (hash === '#home' || path === '/') {
        setCurrentView(prev => (prev === 'gallery' || prev === 'admin-login' || prev === 'policy' ? 'home' : prev));
      }

      // Check URL query parameters for instant checkout and payment confirmation
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutCourse = urlParams.get('checkout') || urlParams.get('buy') || urlParams.get('course');
        if (checkoutCourse) {
          setSelectedCourseForCheckout(checkoutCourse);
          setIsCheckoutOpen(true);
        }
        const orderParam = urlParams.get('orderId') || urlParams.get('payment-success') || urlParams.get('order');
        if (orderParam) {
          setPaymentStatusOrderId(orderParam);
          setIsPaymentStatusOpen(true);
        }
      } catch (e) {}
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Handle Login Success
  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('wits_lingo_user', JSON.stringify(user));
    localStorage.setItem('wits_lingo_token', token);

    if (user.role === 'admin') {
      const targetUrl = adminTab ? `/admin/${adminTab}` : '/admin';
      try {
        window.history.pushState(null, '', targetUrl);
      } catch (e) {}
      setCurrentView('admin-panel');
    } else {
      setCurrentView('student-dashboard');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    const wasAdmin = currentUser?.role === 'admin' || currentView === 'admin-panel' || window.location.pathname.startsWith('/admin');
    
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}

    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem('wits_lingo_user');
    localStorage.removeItem('wits_lingo_token');

    if (wasAdmin) {
      try {
        window.history.pushState(null, '', '/admin');
      } catch (e) {}
      setCurrentView('admin-login');
    } else {
      try {
        window.history.pushState(null, '', '/');
      } catch (e) {}
      setCurrentView('home');
    }
  };

  // Handle Policy Navigation
  const handleNavigatePolicy = (tab: PolicyTab = 'terms') => {
    setPolicyTab(tab);
    setCurrentView('policy');
    try {
      window.history.pushState(null, '', `/${tab}`);
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Admission Modal
  const handleOpenAdmission = (courseId?: string, batchId?: string) => {
    setSelectedCourseForAdmission(courseId || courses[1]?.id || courses[0]?.id);
    setSelectedBatchForAdmission(batchId || batches[0]?.id);
    setIsAdmissionOpen(true);
  };

  // Open Auth Modal
  const handleOpenAuth = (role: 'student' | 'admin' = 'student') => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        setCurrentView('admin-panel');
      } else {
        setCurrentView('student-dashboard');
      }
    } else {
      setAuthRole(role);
      setIsAuthOpen(true);
    }
  };

  if (isVerifyingAdminSession) {
    return (
      <div className="min-h-screen bg-[#0F0A1C] text-white flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-purple-200 uppercase tracking-widest font-['Outfit']">
            Verifying Administrator Session...
          </p>
        </div>
      </div>
    );
  }

  if (currentView === 'admin-login') {
    return (
      <AdminLoginPage
        onLoginSuccess={handleLoginSuccess}
        onBackToHome={() => {
          try { window.history.pushState(null, '', '/'); } catch (e) {}
          setCurrentView('home');
        }}
        siteSettings={siteSettings}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Plus_Jakarta_Sans'] selection:bg-purple-100 selection:text-purple-900">
      
      {/* Universal Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        siteSettings={siteSettings}
        onOpenAdmission={() => handleOpenAdmission()}
        onOpenAuth={(role) => handleOpenAuth(role || 'student')}
        onOpenDashboard={() => {
          if (currentUser && currentUser.role === 'student') {
            setCurrentView('student-dashboard');
          } else {
            handleOpenAuth('student');
          }
        }}
        onOpenAdmin={() => {
          if (currentUser && currentUser.role === 'admin') {
            setCurrentView('admin-panel');
          } else {
            try { window.history.pushState(null, '', '/admin'); } catch (e) {}
            setCurrentView('admin-login');
          }
        }}
        onLogout={handleLogout}
        onOpenSystemReport={() => setIsSystemReportOpen(true)}
        onNavigateGallery={() => {
          try { window.history.pushState(null, '', '/gallery'); } catch (e) {}
          setCurrentView('gallery');
        }}
        onNavigateHome={() => {
          try { window.history.pushState(null, '', '/'); } catch (e) {}
          setCurrentView('home');
        }}
        activeSection={currentView}
      />

      {/* VIEW SWITCHER */}
      {currentView === 'student-dashboard' && currentUser && authToken ? (
        <StudentDashboard
          currentUser={currentUser}
          token={authToken}
          onLogout={handleLogout}
          onBackToHome={() => {
            try { window.history.pushState(null, '', '/'); } catch (e) {}
            setCurrentView('home');
          }}
        />
      ) : currentView === 'admin-panel' && currentUser && currentUser.role === 'admin' && authToken ? (
        <AdminPanel
          currentUser={currentUser}
          token={authToken}
          initialTab={adminTab}
          onTabChange={(tab) => setAdminTab(tab as any)}
          onLogout={handleLogout}
          onBackToHome={() => {
            try { window.history.pushState(null, '', '/'); } catch (e) {}
            setCurrentView('home');
          }}
          onOpenSystemReport={() => setIsSystemReportOpen(true)}
          courses={courses}
          onUpdateCourses={handleUpdateCourses}
          batches={batches}
          onUpdateBatches={handleUpdateBatches}
          testimonials={testimonials}
          onUpdateTestimonials={handleUpdateTestimonials}
          siteSettings={siteSettings}
          onUpdateSiteSettings={handleUpdateSiteSettings}
          announcements={announcements}
          onUpdateAnnouncements={handleUpdateAnnouncements}
          materials={materials}
          onUpdateMaterials={handleUpdateMaterials}
        />
      ) : currentView === 'gallery' ? (
        <GalleryPage
          onBackToHome={() => {
            try { window.history.pushState(null, '', '/'); } catch (e) {}
            setCurrentView('home');
          }}
          onOpenAdmission={(cId, bId) => handleOpenAdmission(cId, bId)}
          siteSettings={siteSettings}
        />
      ) : currentView === 'policy' ? (
        <PolicyPages
          initialTab={policyTab}
          onNavigateHome={() => {
            try { window.history.pushState(null, '', '/'); } catch (e) {}
            setCurrentView('home');
          }}
          onOpenAdmission={(cId) => handleOpenAdmission(cId)}
          siteSettings={siteSettings}
        />
      ) : (
        /* MAIN HOMEPAGE */
        <main>
          {/* 1. Hero Section */}
          <Hero
            onOpenAdmission={(cId, bId) => handleOpenAdmission(cId, bId)}
            onExploreCourses={() => {
              const el = document.getElementById('courses');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            siteSettings={siteSettings}
            announcements={announcements}
          />

          {/* 2. Courses Section */}
          <CoursesSection
            courses={courses}
            onEnroll={(courseId) => handleOpenAdmission(courseId)}
            onBuyNow={(courseId) => handleOpenCheckout(courseId)}
          />

          {/* 2b. Batches & Seat Capacity */}
          <BatchesSection
            batches={batches}
            onEnrollBatch={(courseId, batchId) => handleOpenAdmission(courseId, batchId)}
            siteSettings={siteSettings}
          />

          {/* 3. About Section: Learn → Understand → Practise → Speak → Grow */}
          <AboutSection />

          {/* 4. Our Journey / Accomplishments: 15+ Batches, 100+ Students */}
          <StatsSection siteSettings={siteSettings} />

          {/* 5. What We Teach: 6 Curriculum Cards (Informational Only) */}
          <WhatWeTeach />

          {/* 7. Learning Resources (Combined Learn & Resources Hub in an Optimized Layout) */}
          <LearningResources
            siteSettings={siteSettings}
            onOpenAdmission={(courseId) => handleOpenAdmission(courseId)}
            onFollow={() => {
              const el = document.getElementById('community');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            materials={materials}
          />

          {/* 8. Community: Learn English Every Day */}
          <CommunitySection
            siteSettings={siteSettings}
            onJoinNewJourney={() => handleOpenAdmission()}
          />

          {/* 12. About the Founder: Ziyaur Rehman Zia */}
          <FounderSection />

          {/* 13. Contact Section */}
          <ContactSection siteSettings={siteSettings} />
        </main>
      )}

      {/* Universal Institutional Footer */}
      <Footer
        onOpenSystemReport={() => setIsSystemReportOpen(true)}
        onNavigateGallery={() => {
          try { window.history.pushState(null, '', '/gallery'); } catch (e) {}
          setCurrentView('gallery');
        }}
        onNavigatePolicy={handleNavigatePolicy}
        siteSettings={siteSettings}
      />

      {/* Website Architecture & Full Report Modal */}
      <SystemReportModal
        isOpen={isSystemReportOpen}
        onClose={() => setIsSystemReportOpen(false)}
      />

      {/* Admission Modal */}
      <AdmissionModal
        isOpen={isAdmissionOpen}
        onClose={() => setIsAdmissionOpen(false)}
        courses={courses}
        batches={batches}
        initialCourseId={selectedCourseForAdmission}
        initialBatchId={selectedBatchForAdmission}
        siteSettings={siteSettings}
        onAdmissionSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          localStorage.setItem('wits_lingo_user', JSON.stringify(user));
          localStorage.setItem('wits_lingo_token', token);
          setCurrentView('student-dashboard');
        }}
      />

      {/* Express Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        courses={courses}
        initialCourseId={selectedCourseForCheckout}
        onPaymentVerified={(data) => {
          setIsCheckoutOpen(false);
          setPaymentStatusData(data);
          setPaymentStatusOrderId(data.order?.id);
          setIsPaymentStatusOpen(true);
          if (data.studentUser) {
            setCurrentUser(data.studentUser);
            localStorage.setItem('wits_lingo_user', JSON.stringify(data.studentUser));
          }
        }}
      />

      {/* Verified Payment Success & Status Modal */}
      <PaymentStatusModal
        isOpen={isPaymentStatusOpen}
        onClose={() => setIsPaymentStatusOpen(false)}
        orderId={paymentStatusOrderId}
        initialData={paymentStatusData}
        onGoToCourse={() => {
          setIsPaymentStatusOpen(false);
          setCurrentView('student-dashboard');
        }}
        onRetryPayment={(courseId) => {
          setIsPaymentStatusOpen(false);
          handleOpenCheckout(courseId);
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        initialRole={authRole}
        siteSettings={siteSettings}
      />

      {/* Floating Corner WhatsApp Visitor Widget */}
      {currentView !== 'admin-panel' && (
        <FloatingWhatsApp phoneNumber={WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN} />
      )}

    </div>
  );
}
