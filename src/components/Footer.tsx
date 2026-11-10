import React from 'react';
import { Logo } from './Logo';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin, ArrowUp, FileText, Lock, RotateCcw, Truck } from 'lucide-react';
import { WhatsAppIcon } from './FloatingWhatsApp';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';
import { SiteSettings } from '../types';
import { PolicyTab } from './PolicyPages';

interface FooterProps {
  onOpenSystemReport?: () => void;
  onNavigateGallery?: () => void;
  onNavigatePolicy?: (tab: PolicyTab) => void;
  onNavigateSection?: (sectionId: string) => void;
  onNavigateHome?: () => void;
  siteSettings?: SiteSettings;
}

export const Footer: React.FC<FooterProps> = ({ 
  onOpenSystemReport, 
  onNavigateGallery, 
  onNavigatePolicy, 
  onNavigateSection,
  onNavigateHome,
  siteSettings 
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Policy & legal tabs handler
  const handlePolicyClick = (e: React.MouseEvent, tab: PolicyTab) => {
    e.preventDefault();
    if (onNavigatePolicy) {
      onNavigatePolicy(tab);
    }
  };

  // Robust in-page section scrolling handler (works on homepage as well as cross-page from gallery/policy)
  const handleSectionClick = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    if (onNavigateSection) {
      onNavigateSection(targetId);
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      const navHeight = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const offsetPosition = elementRect - bodyRect - navHeight;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      try {
        window.history.pushState(null, '', `#${targetId}`);
      } catch (err) {}
    } else if (onNavigateHome) {
      onNavigateHome();
      setTimeout(() => {
        const delayedEl = document.getElementById(targetId);
        if (delayedEl) {
          const navHeight = 80;
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = delayedEl.getBoundingClientRect().top;
          const offsetPosition = elementRect - bodyRect - navHeight;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 120);
    }
  };

  const phone1 = siteSettings?.phone1 || '+91 7310952271';
  const phone2 = siteSettings?.phone2 || '+91 90277 29917';
  const cleanPhone1 = phone1.replace(/\s+/g, '');
  const cleanPhone2 = phone2.replace(/\s+/g, '');
  const email = siteSettings?.email || 'hello@witslingo.com';
  const address = siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh - 244222, India';
  const mapQueryUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Wits Lingo Academy ' + address)}`;

  return (
    <footer className="bg-[#14101D] text-white pt-16 sm:pt-20 pb-12 border-t border-purple-950/60 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 sm:gap-12 pb-12 border-b border-white/10">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Logo size="lg" variant="light" showTagline={true} />
            <p className="text-xs text-purple-200/80 max-w-sm leading-relaxed font-['Outfit'] font-semibold">
              {siteSettings?.tagline || 'A Global Language Platform'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Operating under <strong className="text-white font-medium">{siteSettings?.academyName || 'WITS LINGO'}</strong>. Practical spoken English and communication skills for ambitious learners across India.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={`https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodeURIComponent("Hello Wits Lingo, I would like to know more about your English courses.")}`}
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('wits_open_whatsapp_popup'));
                }}
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-[#25D366] text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer group"
                title="Chat on WhatsApp"
                aria-label="Open WhatsApp Support Chat"
              >
                <WhatsAppIcon className="w-4.5 h-4.5 fill-current text-slate-300 group-hover:text-white transition-colors" />
              </a>
              <a
                href={siteSettings?.instagramUrl || "https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA=="}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-pink-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="Instagram"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={siteSettings?.facebookUrl || "https://www.facebook.com/share/1BP5jTfk9B/"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="Facebook"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href={siteSettings?.youtubeUrl || "https://youtube.com/@witslingoeng"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="YouTube"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links (Platform Section) */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a 
                  href="#courses" 
                  onClick={(e) => handleSectionClick(e, 'courses')}
                  className="hover:text-white transition-colors py-1 block cursor-pointer"
                >
                  Courses & Batches
                </a>
              </li>
              <li>
                <a 
                  href="#about" 
                  onClick={(e) => handleSectionClick(e, 'about')}
                  className="hover:text-white transition-colors py-1 block cursor-pointer"
                >
                  About Us
                </a>
              </li>
              <li>
                <a 
                  href="#philosophy" 
                  onClick={(e) => handleSectionClick(e, 'philosophy')}
                  className="hover:text-white transition-colors py-1 block cursor-pointer"
                >
                  Learning Philosophy
                </a>
              </li>
              <li>
                <a 
                  href="#learning-resources" 
                  onClick={(e) => handleSectionClick(e, 'learning-resources')}
                  className="hover:text-white transition-colors py-1 block cursor-pointer"
                >
                  Study Resources
                </a>
              </li>
              <li>
                <a 
                  href="/gallery" 
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateGallery) {
                      onNavigateGallery();
                    }
                  }}
                  className="hover:text-white transition-colors font-medium text-purple-200 py-1 block cursor-pointer"
                >
                  Gallery & Moments
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  onClick={(e) => handleSectionClick(e, 'contact')}
                  className="hover:text-white transition-colors py-1 block cursor-pointer"
                >
                  Contact & Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Policy Section */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              Legal & Policy
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a 
                  href="/terms" 
                  onClick={(e) => handlePolicyClick(e, 'terms')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                  <span>Terms & Conditions</span>
                </a>
              </li>
              <li>
                <a 
                  href="/privacy" 
                  onClick={(e) => handlePolicyClick(e, 'privacy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                  <span>Privacy Policy</span>
                </a>
              </li>
              <li>
                <a 
                  href="/refund-policy" 
                  onClick={(e) => handlePolicyClick(e, 'refund-policy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                  <span>Refund & Cancellation</span>
                </a>
              </li>
              <li>
                <a 
                  href="/shipping-policy" 
                  onClick={(e) => handlePolicyClick(e, 'shipping-policy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                  <span>Shipping & Delivery</span>
                </a>
              </li>
              <li>
                <a 
                  href="/contact" 
                  onClick={(e) => handlePolicyClick(e, 'contact')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 py-1 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                  <span>Grievance Redressal</span>
                </a>
              </li>
              {onOpenSystemReport && (
                <li className="pt-0.5">
                  <button
                    type="button"
                    onClick={onOpenSystemReport}
                    className="text-purple-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Website Report (PDF)</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Institutional Contact Section */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              {siteSettings?.academyName || 'Wits Lingo Academy'}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <a 
                  href={mapQueryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors hover:underline"
                  title="Open location in Google Maps"
                >
                  {address}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <a 
                  href={`mailto:${email}`} 
                  className="hover:text-white transition-colors hover:underline"
                >
                  {email}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="flex items-center gap-1.5 flex-wrap">
                  <a 
                    href={`tel:${cleanPhone1}`} 
                    className="hover:text-white transition-colors hover:underline"
                    title={`Call ${phone1}`}
                  >
                    {phone1}
                  </a>
                  <span className="text-slate-600">/</span>
                  <a 
                    href={`tel:${cleanPhone2}`} 
                    className="hover:text-white transition-colors hover:underline"
                    title={`Call ${phone2}`}
                  >
                    {phone2}
                  </a>
                </span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Mon – Sat: 9:00 AM – 8:00 PM IST
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Scroll to Top */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {siteSettings?.academyName || 'WITS LINGO'}. All rights reserved.</p>
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer group py-1"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
