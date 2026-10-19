import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { SiteSettings } from '../types';
import { 
  ShieldCheck, 
  FileText, 
  Lock, 
  RotateCcw, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  ExternalLink,
  Building2,
  UserCheck,
  AlertCircle,
  HelpCircle,
  CreditCard
} from 'lucide-react';

export type PolicyTab = 'terms' | 'privacy' | 'refund-policy' | 'shipping-policy' | 'contact' | 'about';

interface PolicyPagesProps {
  initialTab?: PolicyTab;
  onNavigateHome: () => void;
  onOpenAdmission?: (courseId?: string) => void;
  siteSettings?: SiteSettings;
}

export const PolicyPages: React.FC<PolicyPagesProps> = ({
  initialTab = 'terms',
  onNavigateHome,
  onOpenAdmission,
  siteSettings
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);

  // Sync tab with URL if prop updates
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Scroll to top when active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleTabChange = (tab: PolicyTab) => {
    setActiveTab(tab);
    try {
      window.history.pushState(null, '', `/${tab}`);
    } catch (e) {}
  };

  const academyName = siteSettings?.academyName || 'Wits Lingo Academy';
  const supportEmail = siteSettings?.email || 'Witslingo@gmail.com';
  const supportPhone1 = siteSettings?.phone1 || '+91 73109 52271';
  const supportPhone2 = siteSettings?.phone2 || '+91 90277 29917';
  const address = siteSettings?.address || 'Dhakka, Amroha, Uttar Pradesh - 244222, India';
  const founderName = siteSettings?.founderName || 'Ziyaur Rehman Zia';

  const tabList: { id: PolicyTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'terms', label: 'Terms & Conditions', icon: <FileText className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <Lock className="w-4 h-4" /> },
    { id: 'refund-policy', label: 'Refund & Cancellation', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'shipping-policy', label: 'Shipping & Delivery', icon: <Truck className="w-4 h-4" />, badge: 'Digital' },
    { id: 'contact', label: 'Contact Us & Grievance', icon: <Phone className="w-4 h-4" /> },
    { id: 'about', label: 'About Wits Lingo', icon: <Building2 className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-slate-900 font-['Plus_Jakarta_Sans']">
      
      {/* Top Compliance Bar */}
      <div className="bg-slate-900 text-slate-300 text-[11px] sm:text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-white">Official Institutional & Payment Compliance Portal</span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">Razorpay & RBI Merchant Guidelines Compliant</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Operating under: <strong className="text-white">{academyName}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#4A1D96] hover:bg-purple-50 transition-colors cursor-pointer"
              title="Return to Main Website"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <a href="/" onClick={(e) => { e.preventDefault(); onNavigateHome(); }} className="cursor-pointer">
              <Logo size="md" showTagline={true} />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Print Policy Document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Policy</span>
            </button>

            {onOpenAdmission && (
              <button
                onClick={() => onOpenAdmission()}
                className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Explore Courses
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="border-t border-slate-100 bg-slate-50/80 overflow-x-auto scrollbar-none">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-1 sm:space-x-2 py-2">
            {tabList.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-[#4A1D96] text-white shadow-sm shadow-purple-900/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    activeTab === t.id ? 'bg-white/20 text-white' : 'bg-purple-100 text-[#4A1D96]'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        
        {/* TAB 1: TERMS & CONDITIONS */}
        {activeTab === 'terms' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#4A1D96] text-xs font-bold mb-3 border border-purple-200/60">
                <FileText className="w-3.5 h-3.5" />
                <span>Legally Binding Agreement</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Terms and Conditions
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Last Updated: October 2026 • Effective Immediately for all registered students and visitors.
              </p>
            </header>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">1</span>
                <span>Preamble & Acceptance of Terms</span>
              </h2>
              <p>
                Welcome to <strong>{academyName}</strong> ("Wits Lingo", "we", "us", or "our"). These Terms and Conditions govern your access to and use of our website (<code>https://www.witslingo.com</code>), mobile-responsive portal, live online classroom batches, interactive audio/video coaching, and proprietary study resources.
              </p>
              <p>
                By enrolling in any course, making an online fee payment, or using our digital services, you agree to comply with and be bound by these Terms. If you do not agree with any portion of these terms, please refrain from accessing the site or enrolling in our programs.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">2</span>
                <span>Operating Entity & Registered Address</span>
              </h2>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <p><strong>Merchant Trade Name:</strong> {academyName}</p>
                <p><strong>Founder & Mentor:</strong> {founderName}</p>
                <p><strong>Registered & Operational Address:</strong> {address}</p>
                <p><strong>Direct Helpline:</strong> {supportPhone1} / {supportPhone2}</p>
                <p><strong>Official Support Email:</strong> {supportEmail}</p>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">3</span>
                <span>Services Description</span>
              </h2>
              <p>
                {academyName} provides digital educational programs focused on spoken English, everyday conversational fluency, English grammar fundamentals, pronunciation, and corporate communication skills. Services include:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
                <li>Live interactive online group sessions conducted via Google Meet.</li>
                <li>Digital downloadable study material in PDF and document formats.</li>
                <li>Batch video lecture replays and audio practice drills available inside the student portal.</li>
                <li>Interactive speaking pairs and evaluation feedback from certified mentors.</li>
                <li>Official enrollment slips, course fee receipts, and digital certificates of completion upon successful batch evaluation.</li>
              </ul>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">4</span>
                <span>Course Fees, Taxes & Payment Gateway</span>
              </h2>
              <p>
                All tuition and course fees are displayed explicitly on our website in <strong>Indian Rupees (INR ₹)</strong>. Pricing includes all standard session access, live classes, and curriculum PDFs for the duration of the enrolled batch.
              </p>
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200/70 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#4A1D96]">
                  <CreditCard className="w-4 h-4" />
                  <span>Secure Payment Processing through Razorpay</span>
                </div>
                <p className="text-slate-700">
                  All online payments on {academyName} are processed securely via <strong>Razorpay Software Private Limited</strong>, an RBI-authorized Payment Aggregator compliant with the global Payment Card Industry Data Security Standard (PCI-DSS Level 1). We support UPI (Google Pay, PhonePe, Paytm, BHIM), Debit/Credit Cards (RuPay, Visa, MasterCard), Net Banking (50+ Indian banks), and recognized wallets.
                </p>
                <p className="text-slate-600">
                  {academyName} does <em>not</em> store your card credentials, bank account passwords, or UPI PINs on any server.
                </p>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">5</span>
                <span>Intellectual Property Rights</span>
              </h2>
              <p>
                All course curriculum, lecture slides, video and audio recordings, worksheets, quizzes, graphics, and trade names are the exclusive intellectual property of <strong>{academyName}</strong> and protected under the Indian Copyright Act, 1957.
              </p>
              <p>
                Students are granted a personal, non-exclusive, non-transferable, revocable license to access the materials solely for their individual study. Any commercial re-sale, screen recording, uploading to external file-sharing platforms, or unauthorized group distribution is strictly prohibited and constitutes an actionable copyright violation.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">6</span>
                <span>Student Code of Conduct & Live Classroom Ethics</span>
              </h2>
              <p>
                To maintain a safe, welcoming, and productive learning environment for all students:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-xs sm:text-sm">
                <li>Students must behave politely, ethically, and constructively during all live interactive Google Meet sessions.</li>
                <li>Vulgarity, discrimination, political debate, hate speech, or harassment of instructors or fellow classmates will lead to immediate removal and permanent revocation of admission without refund.</li>
                <li>Sharing your batch Google Meet link or dashboard access credentials with un-enrolled third parties is strictly prohibited.</li>
              </ul>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">7</span>
                <span>Cancellation, Batch Rescheduling & Refunds</span>
              </h2>
              <p>
                All student cancellations, batch switches, and refund requests are governed by our official <button onClick={() => handleTabChange('refund-policy')} className="text-[#4A1D96] font-bold hover:underline cursor-pointer">Refund & Cancellation Policy</button>. We offer a <strong>100% full refund before batch start</strong>, a <strong>7-Day 100% Satisfaction Guarantee</strong>, or a free batch transfer if you encounter scheduling conflicts.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">8</span>
                <span>Governing Law & Dispute Jurisdiction</span>
              </h2>
              <p>
                These Terms and Conditions shall be governed by and construed in accordance with the laws of the <strong>Republic of India</strong>. In the event of any dispute or claim arising out of or related to these terms or services, the courts of competent jurisdiction located in <strong>Amroha / Moradabad, Uttar Pradesh, India</strong> shall have exclusive jurisdiction.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center text-xs font-bold">9</span>
                <span>Contact for Legal Inquiries</span>
              </h2>
              <p>
                For questions regarding these Terms or our academic policies, contact us at <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-semibold underline">{supportEmail}</a> or via WhatsApp/Call at <strong>{supportPhone2}</strong>.
              </p>
            </section>
          </article>
        )}

        {/* TAB 2: PRIVACY POLICY */}
        {activeTab === 'privacy' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-3 border border-emerald-200">
                <Lock className="w-3.5 h-3.5" />
                <span>Data Protection & Privacy</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Last Updated: October 2026 • Compliant with Information Technology Act, 2000 & DPDP Act, 2023 (India).
              </p>
            </header>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">1</span>
                <span>Introduction & Commitment</span>
              </h2>
              <p>
                At <strong>{academyName}</strong> ("Wits Lingo", "we", "our"), we respect your privacy and are committed to protecting the personal data of our learners and visitors. This Privacy Policy outlines what information we collect, how it is safeguarded, and how you can exercise your privacy rights.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">2</span>
                <span>Information We Collect</span>
              </h2>
              <p>
                When you visit our website, register for an admission evaluation, or enroll in a batch, we collect:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
                <li><strong>Personal Identity Information:</strong> Full Name, Email Address, and Phone/WhatsApp Number.</li>
                <li><strong>Course & Academic Information:</strong> Selected course (e.g. Spoken English, English Foundation), batch preferences, attendance records, and homework submissions.</li>
                <li><strong>Transaction Identifiers:</strong> Razorpay Order ID, Payment ID, payment timestamp, and transaction status.</li>
                <li><strong>Technical Telemetry:</strong> Anonymized browser type, operating system, and IP address for security diagnostics and fraud prevention.</li>
              </ul>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span className="text-base font-['Outfit']">Explicit Non-Collection of Financial Credentials</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>We do NOT store, process, or have access to your sensitive financial data.</strong> Your debit card numbers, credit card CVVs, net banking login passwords, and UPI PINs are processed exclusively on the 256-bit SSL encrypted servers of <strong>Razorpay Software Private Limited</strong> (PCI-DSS Level 1 Certified & RBI Regulated Payment Aggregator). {academyName} receives only a cryptographic payment token confirming transaction success or failure.
                </p>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">3</span>
                <span>How We Use Your Information</span>
              </h2>
              <p>We use your information strictly for legitimate academic and administrative purposes:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
                <li>Provisioning your Student Dashboard access and generating course admission slips.</li>
                <li>Delivering instant transactional payment receipts, batch schedules, and Google Meet class links directly to your registered WhatsApp number via the official Meta WhatsApp Business Cloud API.</li>
                <li>Sending academic updates, assignment reviews, and certificate issuance notices.</li>
                <li>Assisting with customer support queries and payment inquiries.</li>
              </ul>
              <p className="font-semibold text-slate-900 text-xs">
                We NEVER sell, rent, monetize, or trade your contact information with third-party advertisers or telemarketers.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">4</span>
                <span>Third-Party Sub-Processors</span>
              </h2>
              <p>
                To provide dependable educational services, we collaborate with industry-leading, compliant infrastructure partners:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Razorpay</p>
                  <p className="text-slate-600">Payment gateway processing under RBI and PCI-DSS standards.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Meta WhatsApp Cloud API</p>
                  <p className="text-slate-600">Enterprise transactional delivery of receipts and batch links.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Backblaze B2 / AWS S3</p>
                  <p className="text-slate-600">Encrypted cloud storage for lecture notes and study PDFs.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">5</span>
                <span>Data Retention & Security Measures</span>
              </h2>
              <p>
                We implement industry-standard 256-bit TLS/SSL encryption across all website communications. Administrative logins and student credentials are salt-hashed and stored securely. Personal records are retained only for the duration necessary to deliver the enrolled courses and fulfill statutory accounting obligations.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">6</span>
                <span>Your Rights & Grievance Redressal</span>
              </h2>
              <p>
                Under applicable Indian laws, you have the right to request access to your recorded data, request corrections, or request complete account erasure once your batch is concluded.
              </p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <p className="font-bold text-slate-900">Designated Grievance Officer:</p>
                <p><strong>Name:</strong> {founderName}</p>
                <p><strong>Entity:</strong> {academyName}</p>
                <p><strong>Email:</strong> <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-semibold underline">{supportEmail}</a></p>
                <p><strong>Address:</strong> {address}</p>
                <p className="text-slate-500">We acknowledge and address all data inquiries within 24 to 48 business hours.</p>
              </div>
            </section>
          </article>
        )}

        {/* TAB 3: REFUND & CANCELLATION */}
        {activeTab === 'refund-policy' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold mb-3 border border-amber-200">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Student-First Protection</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Refund and Cancellation Policy
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Transparent cancellation terms, guaranteed refund turnaround, and hassle-free batch transfer options.
              </p>
            </header>

            {/* Highlight Banner */}
            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                <span className="text-base font-['Outfit']">Our 7-Day 100% Satisfaction Guarantee</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                We are fully dedicated to providing the highest quality English speaking mentorship. If you join an enrolled batch and feel within the <strong>first 7 calendar days of batch commencement</strong> that the course does not suit your learning style or requirements, we will issue a <strong>100% full refund</strong> of your course fee—no questions asked.
              </p>
            </div>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">1</span>
                <span>Cancellation Prior to Batch Commencement</span>
              </h2>
              <p>
                If you enroll in an upcoming batch and decide to cancel before the first scheduled live Google Meet class takes place, you are entitled to a <strong>100% full refund with zero cancellation charges</strong>. Simply email or WhatsApp us before the batch start date, and your cancellation will be processed immediately.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">2</span>
                <span>Free Batch Transfer / Rescheduling Option</span>
              </h2>
              <p>
                We understand that unexpected exams, job shifts, or family emergencies happen. If you are unable to attend your assigned batch timings:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
                <li>You can request a <strong>100% Free Transfer</strong> to any upcoming batch within the next 3 months.</li>
                <li>You can switch between evening, morning, or weekend batch slots without paying any penalty or fee difference.</li>
                <li>Your enrolled status and study materials remain fully active during the transition.</li>
              </ul>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">3</span>
                <span>Refund Processing Timelines & Source Method</span>
              </h2>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <strong className="text-slate-900 block font-semibold">Acknowledgment & Verification:</strong>
                    <span className="text-slate-600">Your refund request is acknowledged and verified within <strong>24 business hours</strong>.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <strong className="text-slate-900 block font-semibold">Initiation via Gateway:</strong>
                    <span className="text-slate-600">Approved refunds are initiated through our official Razorpay portal within <strong>24 to 48 hours</strong>.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <strong className="text-slate-900 block font-semibold">Credit to Source Account:</strong>
                    <span className="text-slate-600">
                      As mandated by Reserve Bank of India (RBI) payment clearing guidelines, funds will be credited directly back to your <strong>original payment method</strong> (original UPI VPA, Bank Account, or Card) within <strong>5 to 7 working days</strong>.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">4</span>
                <span>How to Initiate a Refund</span>
              </h2>
              <p>
                To request a cancellation or refund, please submit your request through either of the following channels:
              </p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <p><strong>Option A (Email):</strong> Send an email to <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-semibold underline">{supportEmail}</a> with the subject <em>"Refund Request - [Your Name]"</em>.</p>
                <p><strong>Option B (WhatsApp):</strong> Message our official institutional helpline at <strong>{supportPhone2}</strong>.</p>
                <p className="text-slate-500 pt-1">
                  Please include your <strong>Registered Phone Number</strong>, <strong>Student Name</strong>, <strong>Course Name</strong>, and <strong>Razorpay Payment ID / Order ID</strong> (available on your WhatsApp receipt).
                </p>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">5</span>
                <span>Exceptions & Ineligible Scenarios</span>
              </h2>
              <ul className="list-disc pl-6 space-y-1 text-xs sm:text-sm">
                <li>Refund requests submitted after 7 calendar days from the official batch start date are generally not eligible for cash refunds, but remain eligible for free batch transfer.</li>
                <li>Students terminated from the academy due to misconduct, offensive behavior, or unauthorized re-distribution of copyrighted lecture materials forfeit their eligibility for a refund.</li>
              </ul>
            </section>
          </article>
        )}

        {/* TAB 4: SHIPPING & DELIVERY POLICY */}
        {activeTab === 'shipping-policy' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-200">
                <Truck className="w-3.5 h-3.5" />
                <span>Digital Delivery Fulfillment</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Shipping and Delivery Policy
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Information on how digital educational products, live classroom access, and course materials are delivered.
              </p>
            </header>

            {/* Digital Service Callout */}
            <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200/80 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="text-base font-['Outfit']">100% Digital Educational Services & Instant Delivery</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                All courses, coaching sessions, lecture recordings, and study notes provided by <strong>{academyName}</strong> are <strong>purely digital products and online services</strong>. No physical packages, books, or tangible goods are shipped via courier or post.
              </p>
            </div>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">1</span>
                <span>Delivery Mechanism & Timelines</span>
              </h2>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">1. Instant On-Screen Confirmation</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Instant (0s)</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Immediately upon successful completion of your Razorpay payment, an on-screen verified confirmation page displays your official Order ID, Payment Reference, Course Name, and Admission Slip.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">2. Instant WhatsApp Receipt & Welcome Package</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">&lt; 60 Seconds</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    An official enrollment receipt, batch code, student details, and onboarding checklist are automatically dispatched to your registered WhatsApp mobile number from our verified business account (<strong>{supportPhone2}</strong>) via Meta's Cloud API.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">3. Student Portal & Classroom Link Activation</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#4A1D96] text-[10px] font-bold">1 to 24 Hours</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Your student dashboard login is instantly functional. The live interactive Google Meet classroom link and batch WhatsApp community invite are activated within <strong>1 to 24 hours prior to batch commencement</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">4. Study Notes & Replay Video Materials</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#4A1D96] text-[10px] font-bold">24/7 Access</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Curriculum worksheets, PDF dialogue sheets, and class recording replays are made available digitally inside your dashboard and updated progressively as each class concludes.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">2</span>
                <span>Shipping & Delivery Charges</span>
              </h2>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <p className="text-base font-bold text-slate-900">
                  Total Delivery Charge: <span className="text-emerald-600">₹0.00 (Completely Free Worldwide)</span>
                </p>
                <p className="text-slate-600">
                  Because all services, class attendance, and study materials are delivered electronically over high-speed cloud networks, zero shipping, handling, packaging, or courier fees will ever be applied to your transaction.
                </p>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">3</span>
                <span>Assistance for Non-Delivery or Access Issues</span>
              </h2>
              <p>
                If for any technical reason you have successfully made a payment but have not received your WhatsApp receipt or dashboard access within <strong>15 minutes</strong>, please do not worry. Your transaction is permanently logged in our Razorpay system.
              </p>
              <p>
                Simply reach out to us with your phone number or screenshot of payment:
              </p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1">
                <p><strong>WhatsApp Helpline:</strong> {supportPhone2}</p>
                <p><strong>Direct Call Support:</strong> {supportPhone1}</p>
                <p><strong>Email:</strong> <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-semibold underline">{supportEmail}</a></p>
                <p className="text-slate-500 pt-1">Our support team manually verifies and activates access within 30 minutes.</p>
              </div>
            </section>
          </article>
        )}

        {/* TAB 5: CONTACT US & GRIEVANCE */}
        {activeTab === 'contact' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-3 border border-indigo-200">
                <Phone className="w-3.5 h-3.5" />
                <span>Institutional Contact & Support</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Contact Us & Grievance Redressal
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Official contact details, operational hours, physical address, and statutory grievance escalation.
              </p>
            </header>

            {/* Grid of contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200/70 space-y-2">
                <div className="flex items-center gap-2 text-[#4A1D96] font-bold text-sm">
                  <Building2 className="w-4 h-4" />
                  <span>Institutional Entity</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{academyName}</p>
                <p className="text-xs text-slate-600">A Global Language Platform • Spoken English & Communication Skills</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <MapPin className="w-4 h-4 text-[#4A1D96]" />
                  <span>Physical & Registered Address</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">{address}</p>
                <p className="text-[11px] text-slate-500">State: Uttar Pradesh • Country: India</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Phone className="w-4 h-4 text-[#4A1D96]" />
                  <span>Telephone & WhatsApp Support</span>
                </div>
                <p className="text-xs text-slate-800"><strong>WhatsApp & Enrolment:</strong> {supportPhone2}</p>
                <p className="text-xs text-slate-800"><strong>Direct Helpline:</strong> {supportPhone1}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Mail className="w-4 h-4 text-[#4A1D96]" />
                  <span>Official Support Email</span>
                </div>
                <p className="text-xs text-slate-800">
                  <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-bold hover:underline">{supportEmail}</a>
                </p>
                <p className="text-[11px] text-slate-500">General Support, Admissions, and Technical Inquiries</p>
              </div>
            </div>

            {/* Operating Hours */}
            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#4A1D96]" />
                <span>Operating Hours & Service SLA</span>
              </h2>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-medium text-slate-700">Monday to Saturday:</span>
                  <span className="font-bold text-slate-900">09:00 AM – 08:00 PM IST</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-medium text-slate-700">Sunday:</span>
                  <span className="font-bold text-slate-900">10:00 AM – 04:00 PM IST</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium text-slate-700">Average Email / WhatsApp Response Time:</span>
                  <span className="font-bold text-emerald-700">Under 2 Hours (Within 24h Guaranteed)</span>
                </div>
              </div>
            </section>

            {/* Statutory Grievance Redressal */}
            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#4A1D96]" />
                <span>Statutory Grievance Redressal Mechanism</span>
              </h2>
              <p>
                In compliance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and consumer protection guidelines, the designated Grievance Officer details are provided below:
              </p>
              <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200/70 text-xs space-y-2">
                <p><strong>Grievance Redressal Officer:</strong> {founderName}</p>
                <p><strong>Designation:</strong> Founder & Head of Operations, {academyName}</p>
                <p><strong>Physical Address:</strong> {address}</p>
                <p><strong>Direct Grievance Email:</strong> <a href={`mailto:${supportEmail}`} className="text-[#4A1D96] font-bold underline">{supportEmail}</a></p>
                <p><strong>Escalation Phone:</strong> {supportPhone2}</p>
                <p className="text-slate-600 pt-1">
                  <em>Grievance SLA:</em> All student grievances or payment escalation disputes are formally acknowledged within 24 hours, with definitive investigation and resolution completed within 48 to 72 business hours.
                </p>
              </div>
            </section>
          </article>
        )}

        {/* TAB 6: ABOUT US */}
        {activeTab === 'about' && (
          <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-8">
            <header className="border-b border-slate-200 pb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-[#4A1D96] text-xs font-bold mb-3 border border-purple-200">
                <Building2 className="w-3.5 h-3.5" />
                <span>Institutional Background</span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                About Wits Lingo Academy
              </h1>
              <p className="text-xs text-slate-500 mt-2">
                Empowering everyday learners with practical, confident, and natural spoken English fluency.
              </p>
            </header>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900">
                Our Mission & Vision
              </h2>
              <p>
                <strong>{academyName}</strong> was founded with a singular purpose: to bridge the gap between theoretical English grammar taught in traditional classrooms and real-world spoken fluency needed in interviews, workplaces, and daily life.
              </p>
              <p>
                We believe that speaking a language shouldn't feel intimidating. Through a supportive, interactive batch structure and practical conversational simulations, we help students overcome hesitation, build intuitive grammar comprehension, and speak English with genuine poise.
              </p>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900">
                The Wits Lingo 5-Step Methodology
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-[#4A1D96]">
                  1. Learn
                  <span className="block font-normal text-slate-600 text-[11px] mt-1">Core structures & high-frequency vocabulary</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-[#4A1D96]">
                  2. Understand
                  <span className="block font-normal text-slate-600 text-[11px] mt-1">Sentence mechanics without rote rules</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-[#4A1D96]">
                  3. Practise
                  <span className="block font-normal text-slate-600 text-[11px] mt-1">1-on-1 peer dialogues & guided scenarios</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-[#4A1D96]">
                  4. Speak
                  <span className="block font-normal text-slate-600 text-[11px] mt-1">Live speaking drills from day one</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-[#4A1D96]">
                  5. Grow
                  <span className="block font-normal text-slate-600 text-[11px] mt-1">Lifelong career & social communication ease</span>
                </div>
              </div>
            </section>

            <section className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <h2 className="font-['Outfit'] text-lg font-bold text-slate-900">
                About Founder & Lead Mentor: {founderName}
              </h2>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs sm:text-sm">
                <p>
                  <strong>{founderName} (Zia Sir)</strong> is an experienced English language educator, mentor, and public speaking coach based in Uttar Pradesh, India. Having trained hundreds of school students, college graduates, competitive exam aspirants, and working professionals, Zia Sir is renowned for his friendly, encouraging, and zero-fear teaching style.
                </p>
                <p>
                  Under his leadership, {academyName} has successfully trained <strong>{siteSettings?.batchesCompletedCount || '15+'} batches</strong> and over <strong>{siteSettings?.activeStudentsCount || '100+'} active learners</strong> who now confidently participate in group discussions, job interviews, and international client calls.
                </p>
              </div>
            </section>

            <section className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Ready to transform your English speaking journey?</p>
                <p className="text-sm font-bold text-slate-900">Admissions are open for upcoming batches.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onNavigateHome}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  View Curriculum
                </button>
                {onOpenAdmission && (
                  <button
                    onClick={() => onOpenAdmission()}
                    className="px-5 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    Register for Next Batch
                  </button>
                )}
              </div>
            </section>
          </article>
        )}

        {/* Razorpay Trust & Merchant Compliance Footer Card */}
        <div className="mt-12 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#4A1D96] flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6 text-[#4A1D96]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-['Outfit']">
                  Razorpay Verified Merchant Security
                </h4>
                <p className="text-[11px] text-slate-500">
                  RBI Regulated Payment Aggregator • PCI-DSS Level 1 Compliant • 256-Bit SSL Encryption
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">UPI</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">RuPay</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Visa / MC</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">NetBanking</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p>© {academyName}. All Rights Reserved. Operating from {address}.</p>
            <div className="flex items-center gap-4">
              <button onClick={() => handleTabChange('terms')} className="hover:text-[#4A1D96] transition-colors cursor-pointer">Terms</button>
              <button onClick={() => handleTabChange('privacy')} className="hover:text-[#4A1D96] transition-colors cursor-pointer">Privacy</button>
              <button onClick={() => handleTabChange('refund-policy')} className="hover:text-[#4A1D96] transition-colors cursor-pointer">Refunds</button>
              <button onClick={() => handleTabChange('shipping-policy')} className="hover:text-[#4A1D96] transition-colors cursor-pointer">Shipping</button>
              <button onClick={() => handleTabChange('contact')} className="hover:text-[#4A1D96] transition-colors cursor-pointer">Contact</button>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
};
