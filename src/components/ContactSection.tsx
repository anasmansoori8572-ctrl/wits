import React, { useState } from 'react';
import { Mail, Phone, MapPin, MessageCircle, Send, CheckCircle2, Instagram, Facebook } from 'lucide-react';
import { SiteSettings } from '../types';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

interface ContactSectionProps {
  siteSettings?: SiteSettings;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ siteSettings }) => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    learningInterest: 'Spoken English & Daily Conversation',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [whatsappInfo, setWhatsappInfo] = useState<{ studentUrl: string | null; adminUrl: string; confirmationMessage: string } | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const phone1 = siteSettings?.phone1 || '+91 7310952271';
  const phone2 = siteSettings?.phone2 || WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER;
  const email = siteSettings?.email || 'hello@witslingo.com';
  const address = siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh, India';
  const academyName = siteSettings?.academyName || 'WITS LINGO';
  const tagline = siteSettings?.tagline || 'A Global Language Platform';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact || !formData.message) {
      alert('Please fill in your name, contact details, and message.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.whatsapp) {
        setWhatsappInfo(data.whatsapp);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-[#581C87] text-xs font-bold uppercase tracking-wider shadow-2xs">
            Get In Touch
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            Contact {academyName}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Have questions about courses, upcoming batch timings, or admissions? Reach out to our team.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-start">
          
          {/* Left Column: Academy Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-50/80 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
              <div>
                <span className="text-xs font-bold text-[#4A1D96] uppercase tracking-wider block">
                  Official Institution
                </span>
                <h3 className="font-['Outfit'] text-2xl font-bold text-[#1E1B26] mt-1">
                  {academyName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {tagline}
                </p>
              </div>

              {/* Contact Items */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Academy Address</span>
                    <span className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                      {address}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Email Address</span>
                    <a
                      href={`mailto:${email}`}
                      className="text-[#4A1D96] hover:underline font-medium text-xs sm:text-sm"
                    >
                      {email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Phone Support</span>
                    <div className="flex flex-col gap-0.5 mt-0.5 font-medium text-slate-700 text-xs sm:text-sm">
                      <a href={`tel:${phone1.replace(/\s+/g, '')}`} className="hover:text-[#4A1D96]">
                        {phone1}
                      </a>
                      <a href={`tel:${phone2.replace(/\s+/g, '')}`} className="hover:text-[#4A1D96]">
                        {phone2}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">WhatsApp Support</span>
                    <a
                      href={`https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodeURIComponent("Hello! I am inquiring about Wits Lingo English courses.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-semibold hover:underline block text-xs sm:text-sm"
                    >
                      Chat on WhatsApp ({WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER})
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Media Links */}
              <div className="pt-4 border-t border-slate-200/60">
                <span className="text-xs font-bold text-slate-600 block mb-2.5">Connect with us:</span>
                <div className="flex items-center gap-2">
                  <a
                    href="https://whatsapp.com/channel/0029VbDjNY9InlqQJsC6G02Y"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 transition-colors shadow-2xs"
                    title="WhatsApp Channel"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-pink-600 hover:bg-pink-50 transition-colors shadow-2xs"
                    title="Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.facebook.com/share/1BP5jTfk9B/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs"
                    title="Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
              <h3 className="font-['Outfit'] text-2xl font-bold text-[#1E1B26] mb-1">
                Send an Inquiry
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                Fill out the form below and our team will get back to you with batch details.
              </p>

              {submitted ? (
                <div className="p-6 sm:p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-['Outfit'] font-bold text-lg text-emerald-950">Inquiry Received & WhatsApp Confirmation Ready!</h4>
                    <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                      Thank you for contacting {academyName}. We have prepared an official inquiry confirmation for your records.
                    </p>
                  </div>

                  {whatsappInfo && (
                    <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-left space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <MessageCircle className="w-4 h-4 text-[#25D366]" />
                          WhatsApp Confirmation Details
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Live Connected
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                          href={whatsappInfo.adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Open Confirmation on WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(whatsappInfo.confirmationMessage);
                            setCopiedMsg(true);
                            setTimeout(() => setCopiedMsg(false), 2000);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedMsg ? 'Copied to Clipboard!' : 'Copy Details'}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setWhatsappInfo(null);
                      setFormData({ name: '', contact: '', learningInterest: 'Spoken English & Daily Conversation', message: '' });
                    }}
                    className="px-4.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mohd Farhan"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-200 focus:outline-none focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-500/15 text-xs text-slate-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Email / Phone *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 7310952271 / farhan@gmail.com"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-200 focus:outline-none focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-500/15 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">What would you like to learn?</label>
                    <select
                      value={formData.learningInterest}
                      onChange={(e) => setFormData({ ...formData, learningInterest: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-200 focus:outline-none focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-500/15 text-xs text-slate-800"
                    >
                      <option value="Spoken English">Spoken English (Everyday Fluency & Hesitation Removal)</option>
                      <option value="English Foundation">English Foundation (Beginner Alphabet & Phonetics)</option>
                      <option value="English Vocabulary">English Vocabulary (High-Frequency Words & Collocations)</option>
                      <option value="English Conversation">English Conversation (Real-Life Situations & Small Talk)</option>
                      <option value="Communication Skills">Communication Skills (Interviews & Public Speaking)</option>
                      <option value="Advanced English">Advanced English (Strong Fluency & Tone Nuances)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Message *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Share your current challenges in English or ask any questions regarding upcoming batches..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-200 focus:outline-none focus:border-[#4A1D96] focus:ring-2 focus:ring-purple-500/15 text-xs text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold tracking-wide shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loading ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
