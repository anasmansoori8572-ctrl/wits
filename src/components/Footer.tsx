import React from 'react';
import { Logo } from './Logo';
import { MessageCircle, Instagram, Facebook, Youtube, Mail, Phone, MapPin, ArrowUp, FileText, ShieldCheck, Lock, RotateCcw, Truck } from 'lucide-react';
import { SiteSettings } from '../types';
import { PolicyTab } from './PolicyPages';

interface FooterProps {
  onOpenSystemReport?: () => void;
  onNavigateGallery?: () => void;
  onNavigatePolicy?: (tab: PolicyTab) => void;
  siteSettings?: SiteSettings;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSystemReport, onNavigateGallery, onNavigatePolicy, siteSettings }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePolicyClick = (e: React.MouseEvent, tab: PolicyTab) => {
    if (onNavigatePolicy) {
      e.preventDefault();
      onNavigatePolicy(tab);
    }
  };

  return (
    <footer className="bg-[#14101D] text-white pt-16 sm:pt-20 pb-12 border-t border-purple-950/60">
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
                href={siteSettings?.whatsappChannelUrl || "https://whatsapp.com/channel/0029Vb8dJ6C0rGiTXEMDB93k"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="WhatsApp Channel"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href={siteSettings?.instagramUrl || "https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA=="}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-pink-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={siteSettings?.facebookUrl || "https://www.facebook.com/share/1BP5jTfk9B/"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href={siteSettings?.youtubeUrl || "https://youtube.com/@witslingoeng"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8.5 h-8.5 rounded-xl bg-white/5 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-2xs"
                title="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <a href="#courses" className="hover:text-white transition-colors">Courses & Batches</a>
              </li>
              <li>
                <a 
                  href="/about" 
                  onClick={(e) => handlePolicyClick(e, 'about')}
                  className="hover:text-white transition-colors"
                >
                  About Us
                </a>
              </li>
              <li>
                <a href="#philosophy" className="hover:text-white transition-colors">Learning Philosophy</a>
              </li>
              <li>
                <a href="#learning-resources" className="hover:text-white transition-colors">Study Resources</a>
              </li>
              <li>
                <a 
                  href="/gallery" 
                  onClick={(e) => {
                    if (onNavigateGallery) {
                      e.preventDefault();
                      onNavigateGallery();
                    }
                  }}
                  className="hover:text-white transition-colors font-medium text-purple-200"
                >
                  Gallery & Moments
                </a>
              </li>
              <li>
                <a 
                  href="/contact" 
                  onClick={(e) => handlePolicyClick(e, 'contact')}
                  className="hover:text-white transition-colors"
                >
                  Contact & Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance (Mandatory for Razorpay Approval) */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              Legal & Policy
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <a 
                  href="/terms" 
                  onClick={(e) => handlePolicyClick(e, 'terms')}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>Terms & Conditions</span>
                </a>
              </li>
              <li>
                <a 
                  href="/privacy" 
                  onClick={(e) => handlePolicyClick(e, 'privacy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>Privacy Policy</span>
                </a>
              </li>
              <li>
                <a 
                  href="/refund-policy" 
                  onClick={(e) => handlePolicyClick(e, 'refund-policy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>Refund & Cancellation</span>
                </a>
              </li>
              <li>
                <a 
                  href="/shipping-policy" 
                  onClick={(e) => handlePolicyClick(e, 'shipping-policy')}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>Shipping & Delivery</span>
                </a>
              </li>
              <li>
                <a 
                  href="/contact" 
                  onClick={(e) => handlePolicyClick(e, 'contact')}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>Grievance Redressal</span>
                </a>
              </li>
              {onOpenSystemReport && (
                <li className="pt-1">
                  <button
                    onClick={onOpenSystemReport}
                    className="text-purple-300 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Website Report (PDF)</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Institutional Contact */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300 font-['Outfit']">
              {siteSettings?.academyName || 'Wits Lingo Academy'}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>{siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh - 244222, India'}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <a href={`mailto:${siteSettings?.email || 'Witslingo@gmail.com'}`} className="hover:text-white">
                  {siteSettings?.email || 'Witslingo@gmail.com'}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span>
                  {siteSettings?.phone1 || '+91 7310952271'} {siteSettings?.phone2 ? `/ ${siteSettings.phone2}` : '/ 9027729917'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Mon – Sat: 9:00 AM – 8:00 PM IST
              </p>
            </div>
          </div>

        </div>

        {/* Razorpay Trust & Payment Badges Banner */}
        <div className="py-6 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-white font-semibold text-xs font-['Outfit']">
                100% Secure Payments Powered by Razorpay
              </p>
              <p className="text-[11px] text-slate-400">
                RBI Authorized Payment Aggregator • 256-Bit SSL Encrypted • PCI-DSS Level 1 Certified
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">UPI (GPay / PhonePe / Paytm)</span>
            <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">RuPay</span>
            <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">Visa / MasterCard</span>
            <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">Net Banking (50+ Banks)</span>
          </div>
        </div>

        {/* Bottom Bar with Copyright & Back to Top */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {siteSettings?.academyName || 'WITS LINGO'}. All Rights Reserved. Operating in Amroha, Uttar Pradesh, India.</p>
          
          <div className="flex items-center flex-wrap gap-4 sm:gap-6">
            <a 
              href="/privacy" 
              onClick={(e) => handlePolicyClick(e, 'privacy')}
              className="hover:text-slate-300 transition-colors"
            >
              Privacy Policy
            </a>
            <a 
              href="/terms" 
              onClick={(e) => handlePolicyClick(e, 'terms')}
              className="hover:text-slate-300 transition-colors"
            >
              Terms & Conditions
            </a>
            <a 
              href="/refund-policy" 
              onClick={(e) => handlePolicyClick(e, 'refund-policy')}
              className="hover:text-slate-300 transition-colors"
            >
              Refund Policy
            </a>
            <a 
              href="/shipping-policy" 
              onClick={(e) => handlePolicyClick(e, 'shipping-policy')}
              className="hover:text-slate-300 transition-colors"
            >
              Shipping Policy
            </a>
            
            {onOpenSystemReport && (
              <button
                onClick={onOpenSystemReport}
                className="flex items-center gap-1.5 text-purple-300 hover:text-white transition-colors bg-purple-900/40 hover:bg-purple-900/80 px-2.5 py-1 rounded-lg border border-purple-800/40 font-medium cursor-pointer"
                title="Download Website Report (PDF)"
              >
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>Website Report (PDF)</span>
              </button>
            )}

            <button
              onClick={scrollToTop}
              className="flex items-center gap-1 text-purple-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
