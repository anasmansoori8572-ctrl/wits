import React, { useState, useEffect, useRef } from 'react';
import { CourseData, User } from '../types';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  CreditCard, 
  MessageSquare, 
  Tag, 
  Lock, 
  AlertCircle,
  Clock,
  Video,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { CountryPhoneCode, DEFAULT_COUNTRY_CODE, ALL_COUNTRY_PHONE_CODES } from '../data/countryPhoneCodes';
import { CountryCodePhoneInput } from './CountryCodePhoneInput';
import { AddressHierarchySelector } from './AddressHierarchySelector';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CourseData[];
  initialCourseId?: string;
  onPaymentVerified: (data: {
    order: any;
    payment: any;
    studentUser?: User;
    meetLink: string;
    startDate: string;
  }) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialCourseId,
  onPaymentVerified
}) => {
  const publishedCourses = courses.filter(c => c.isPublished !== false);
  const defaultCourse = publishedCourses.find(c => c.id === initialCourseId) || publishedCourses[0] || courses[0];

  const [selectedCourseId, setSelectedCourseId] = useState<string>(defaultCourse?.id || 'course-spoken-english');
  
  // Personal Info
  const [fullName, setFullName] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [dob, setDob] = useState<string>('');

  // Contact
  const [phoneCountry, setPhoneCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState<string>('');
  const [whatsappCountry, setWhatsappCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  // Address
  const [country, setCountry] = useState<string>('India');
  const [countryFlag, setCountryFlag] = useState<string>('🇮🇳');
  const [state, setState] = useState<string>('Uttar Pradesh');
  const [district, setDistrict] = useState<string>('Amroha');
  const [pincode, setPincode] = useState<string>('');

  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [gatewayConfig, setGatewayConfig] = useState<{ configured: boolean; keyId: string | null; isTestMode: boolean } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLFormElement>(null);

  // Lock background body scrolling completely while modal is open
  useScrollLock(isOpen);

  // Route mouse-wheel and touch gestures anywhere on the backdrop/overlay directly to the scrollable form
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      const formEl = formContainerRef.current;
      if (!formEl) return;

      // If wheel occurred outside the scrollable form (e.g. over backdrop or header), scroll form
      if (!formEl.contains(e.target as Node)) {
        e.preventDefault();
        formEl.scrollTop += e.deltaY;
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const formEl = formContainerRef.current;
      if (!formEl || !e.touches || !e.touches[0]) return;

      if (!formEl.contains(e.target as Node)) {
        e.preventDefault();
        const currentTouchY = e.touches[0].clientY;
        const deltaY = touchStartY - currentTouchY;
        touchStartY = currentTouchY;
        formEl.scrollTop += deltaY;
      }
    };

    const overlayEl = overlayRef.current;
    if (overlayEl) {
      overlayEl.addEventListener('wheel', handleWheel, { passive: false });
      overlayEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      overlayEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      if (overlayEl) {
        overlayEl.removeEventListener('wheel', handleWheel);
        overlayEl.removeEventListener('touchstart', handleTouchStart);
        overlayEl.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/payments/razorpay/config')
        .then(res => res.json())
        .then(data => {
          if (data && data.keyId) {
            setGatewayConfig(data);
          }
        })
        .catch(err => console.warn('[Checkout] Failed to fetch gateway config:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    } else if (publishedCourses.length > 0 && !publishedCourses.some(c => c.id === selectedCourseId)) {
      setSelectedCourseId(publishedCourses[0].id);
    }
  }, [initialCourseId, courses]);

  if (!isOpen) return null;

  const currentCourse = publishedCourses.find(c => 
    c.id === selectedCourseId || 
    (selectedCourseId === 'course-communication' && (c.id === 'course-communication-skills' || c.id === 'course-communication')) ||
    (selectedCourseId === 'course-communication-skills' && (c.id === 'course-communication-skills' || c.id === 'course-communication')) ||
    (selectedCourseId === 'course-advanced' && (c.id === 'course-advanced-english' || c.id === 'course-advanced')) ||
    (selectedCourseId === 'course-advanced-english' && (c.id === 'course-advanced-english' || c.id === 'course-advanced'))
  ) || defaultCourse;

  const coursePrice = currentCourse ? Number(currentCourse.fee) : 1499;
  const finalPayable = coursePrice;
  // Dynamically load Razorpay SDK
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!gender) {
      setErrorMsg('Please select your gender.');
      return;
    }

    if (!dob) {
      setErrorMsg('Please enter your date of birth.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      setErrorMsg('Please enter a valid phone number (at least 7 to 10 digits).');
      return;
    }

    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    if (cleanWhatsapp.length < 7) {
      setErrorMsg('Please enter a valid WhatsApp number (at least 7 to 10 digits).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address for receiving purchase confirmation.');
      return;
    }

    if (!country.trim()) {
      setErrorMsg('Please select your country.');
      return;
    }

    if (!state.trim()) {
      setErrorMsg('Please enter your state / province.');
      return;
    }

    if (!district.trim()) {
      setErrorMsg('Please enter your district / city.');
      return;
    }

    if (!pincode.trim() || pincode.trim().length < 3) {
      setErrorMsg('Please enter a valid zip / pin code.');
      return;
    }

    const fullPhone = `${phoneCountry.dialCode} ${cleanPhone}`;
    const fullWhatsapp = `${whatsappCountry.dialCode} ${cleanWhatsapp}`;
    const fullAddress = `${district.trim()}, ${state.trim()}, ${country.trim()}${pincode.trim() ? ' - ' + pincode.trim() : ''}`;

    const studentDetails = {
      name: fullName.trim(),
      gender,
      dob,
      phone: fullPhone,
      whatsapp: fullWhatsapp,
      email: email.trim(),
      country: country.trim(),
      state: state.trim(),
      district: district.trim(),
      pincode: pincode.trim(),
      address: fullAddress
    };

    setIsLoading(true);

    try {
      // 1. Create Pending Order on Server (Server verifies course price)
      const orderRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: fullName.trim(),
          gender,
          dob,
          phone: fullPhone,
          whatsapp: fullWhatsapp,
          rawPhone: cleanPhone,
          rawWhatsapp: cleanWhatsapp,
          phoneDialCode: phoneCountry.dialCode,
          whatsappDialCode: whatsappCountry.dialCode,
          email: email.trim() || undefined,
          country: country.trim(),
          state: state.trim(),
          district: district.trim(),
          pincode: pincode.trim(),
          address: fullAddress,
          courseId: selectedCourseId,
          courseName: currentCourse?.name,
          courseFee: currentCourse?.fee || 1499,
          fee: currentCourse?.fee || 1499,
          level: currentCourse?.level,
          duration: currentCourse?.duration,
          learningFormat: currentCourse?.learningFormat,
          badge: currentCourse?.badge
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initiate course order.');
      }

      const { order, keyId, amountPaise, isTestMode } = orderData;

      // 2. Load Razorpay Checkout Script
      const scriptLoaded = await loadRazorpayScript();

      // Only bypass Razorpay modal if script failed to load, window.Razorpay is missing, or key is an unconfigured placeholder
      const isPlaceholder = !keyId || keyId === 'rzp_test_witslingo_placeholder' || keyId.includes('placeholder');
      if (!scriptLoaded || !(window as any).Razorpay || isPlaceholder) {
        console.log('[Checkout] Razorpay SDK unavailable or placeholder key used. Running fallback verification...');
        // Simulate immediate verified order completion
        const verifyRes = await fetch('/api/payments/razorpay/verify-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: `pay_test_${Date.now()}`,
            razorpaySignature: 'test_signature_mode',
            studentDetails
          })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || 'Test payment verification failed.');
        }

        setIsLoading(false);
        onPaymentVerified({
          order: verifyData.order,
          payment: verifyData.payment,
          meetLink: verifyData.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
          startDate: verifyData.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE
        });
        return;
      }

      // 3. Launch Official Razorpay Checkout Modal
      const dialDigits = (whatsappCountry.dialCode || '+91').replace(/\D/g, '') || '91';
      const rzpOptions = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'Wits Lingo Academy',
        description: `Enrolment: ${currentCourse?.name || 'English Course'}`,
        image: '/wits-lingo-logo.png',
        order_id: order.razorpayOrderId && !order.razorpayOrderId.startsWith('order_test_') 
          ? order.razorpayOrderId 
          : undefined,
        prefill: {
          name: fullName.trim(),
          email: email.trim() || `${cleanWhatsapp}@student.witslingo.com`,
          contact: `${dialDigits}${cleanWhatsapp}`
        },
        theme: {
          color: '#4A1D96'
        },
        handler: async (response: any) => {
          try {
            setIsLoading(true);
            const verifyRes = await fetch('/api/payments/razorpay/verify-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: order.id,
                razorpayOrderId: response.razorpay_order_id || order.razorpayOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                studentDetails
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment signature verification failed.');
            }

            setIsLoading(false);
            onPaymentVerified({
              order: verifyData.order,
              payment: verifyData.payment,
              meetLink: verifyData.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
              startDate: verifyData.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE
            });
          } catch (verifyErr: any) {
            setIsLoading(false);
            setErrorMsg(verifyErr.message || 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            console.log('[Checkout] Razorpay modal closed by user.');
          }
        }
      };

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', (resp: any) => {
        setIsLoading(false);
        setErrorMsg(resp.error?.description || 'Payment was declined or failed. Please try again.');
      });

      rzp.open();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Checkout failed. Please try again.');
    }
  };

  return (
    <div 
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 md:p-6 overscroll-none animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-100 flex flex-col overflow-hidden max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2.5rem)] my-auto"
      >
        
        {/* Header - Pinned at top, always visible and never cut off */}
        <div className="bg-gradient-to-r from-[#3B0764] via-[#4A1D96] to-[#6B21A8] text-white p-5 sm:p-7 relative shrink-0 z-10 border-b border-purple-800/40">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2 flex-wrap pr-10">
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-purple-100 text-[11px] font-bold uppercase tracking-wider">
              Express Enrolment
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
              <Lock className="w-3 h-3" />
              Secure Checkout
            </span>
            {currentCourse?.level && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-900/60 text-purple-200 text-[11px] font-bold border border-purple-400/30">
                {currentCourse.level}
              </span>
            )}
            {currentCourse?.badge && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-purple-950 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-950" />
                {currentCourse.badge}
              </span>
            )}
            {(gatewayConfig?.isTestMode || gatewayConfig?.keyId?.startsWith('rzp_test_')) && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-purple-950 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-950 animate-pulse" />
                Test Payment Mode
              </span>
            )}
          </div>

          <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold tracking-tight">
            Buy {currentCourse?.name || 'Course'}
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-1">
            Instant online purchase, live classroom access & instant WhatsApp confirmation.
          </p>
        </div>

        {/* Content Body - Scrollable inside popup, never scrolling the background */}
        <form 
          ref={formContainerRef}
          onSubmit={handlePayNow} 
          className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}


          {/* Dynamic Selected Course Details (Strictly updates per selected course, hiding all other courses) */}
          {currentCourse && (
            <div 
              key={`selected-course-card-${currentCourse.id}`}
              className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-br from-purple-50/90 via-purple-50/40 to-slate-50 border border-purple-200/90 shadow-2xs space-y-3 transition-all"
            >
              {/* Header: Title, Level & Price */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#4A1D96] text-white">
                      {currentCourse.level}
                    </span>
                    {currentCourse.badge && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        {currentCourse.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-['Outfit'] font-bold text-base sm:text-lg text-[#1E1B26] leading-tight">
                    {currentCourse.name}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Course Fee</span>
                  <span className="font-['Outfit'] text-xl sm:text-2xl font-black text-[#3B0764]">
                    ₹{coursePrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Course Description */}
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {currentCourse.shortDescription}
              </p>

              {/* Duration & Learning Format Metadata */}
              {(currentCourse.duration || currentCourse.learningFormat) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-purple-100 text-xs">
                  {currentCourse.duration && (
                    <div className="flex items-start gap-2 bg-white/80 p-2 rounded-xl border border-purple-100/80 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#4A1D96] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Duration</span>
                        <span className="font-bold text-slate-800 text-[11px] block break-words whitespace-normal leading-snug">{currentCourse.duration}</span>
                      </div>
                    </div>
                  )}
                  {currentCourse.learningFormat && (
                    <div className="flex items-start gap-2 bg-white/80 p-2 rounded-xl border border-purple-100/80 min-w-0">
                      <Video className="w-3.5 h-3.5 text-[#4A1D96] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Format</span>
                        <span className="font-bold text-slate-800 text-[11px] block break-words whitespace-normal leading-snug">{currentCourse.learningFormat}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Course-Specific Highlights & Benefits */}
              {currentCourse.whatYouWillLearn && currentCourse.whatYouWillLearn.length > 0 && (
                <div className="pt-2 border-t border-purple-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-950 block">
                    What You Will Learn & Benefits:
                  </span>
                  <ul className="space-y-1.5">
                    {currentCourse.whatYouWillLearn.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Personal Info */}
          <div className="bg-[#FAF9FC] border border-purple-100/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-purple-100/80 pb-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-[#4A1D96]">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Personal Info
                </h4>
                <p className="text-[11px] text-slate-500">
                  Required for official enrollment and verifiable certificate
                </p>
              </div>
            </div>

            {/* Student Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mohd Farhan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-[#4A1D96]"
              />
            </div>

            {/* Gender & DoB Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#4A1D96] transition-colors appearance-none pr-8 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DoB (Date of Birth) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-[#4A1D96]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact */}
          <div className="bg-[#FAF9FC] border border-purple-100/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-purple-100/80 pb-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-[#4A1D96]">
                <Phone className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Contact
                </h4>
                <p className="text-[11px] text-slate-500">
                  Live session links, admission receipts & WhatsApp updates
                </p>
              </div>
            </div>

            {/* Phone No. & WhatsApp No. in 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <CountryCodePhoneInput
                id="checkout-phone"
                label="Phone No."
                required={true}
                country={phoneCountry}
                onCountryChange={setPhoneCountry}
                phoneNumber={phone}
                onPhoneNumberChange={setPhone}
                placeholder="9876543210"
              />

              <CountryCodePhoneInput
                id="checkout-whatsapp"
                label="WhatsApp No."
                required={true}
                country={whatsappCountry}
                onCountryChange={setWhatsappCountry}
                phoneNumber={whatsapp}
                onPhoneNumberChange={setWhatsapp}
                placeholder="9876543210"
                extraHeaderAction={
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappCountry(phoneCountry);
                      setWhatsapp(phone);
                    }}
                    className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                    title="Copy number from Phone No."
                  >
                    Same as Phone
                  </button>
                }
              />
            </div>

            {/* E-mail ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  E-mail ID <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-purple-700 font-semibold">
                  Official receipt & student portal credentials
                </span>
              </div>
              <input
                type="email"
                required
                placeholder="e.g. yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-[#4A1D96]"
              />
            </div>
          </div>

          {/* Section 3: Address */}
          <div className="bg-[#FAF9FC] border border-purple-100/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-purple-100/80 pb-2">
              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-[#4A1D96]">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Address
                </h4>
                <p className="text-[11px] text-slate-500">
                  Country, state/province, district & zip/pin code
                </p>
              </div>
            </div>

            <AddressHierarchySelector
              country={country}
              onCountryChange={(newCountry, flag) => {
                setCountry(newCountry);
                setCountryFlag(flag);
                const matchedPhone = ALL_COUNTRY_PHONE_CODES.find(
                  (c) => c.name.toLowerCase() === newCountry.toLowerCase()
                );
                if (matchedPhone) {
                  setPhoneCountry(matchedPhone);
                  setWhatsappCountry(matchedPhone);
                }
              }}
              state={state}
              onStateChange={setState}
              district={district}
              onDistrictChange={setDistrict}
              pincode={pincode}
              onPincodeChange={setPincode}
              showResidentialAddress={false}
              required={true}
            />
          </div>

          {/* Pricing Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Standard Course Fee ({currentCourse?.name || 'Selected Course'})</span>
              <span className="font-semibold text-slate-800">₹{coursePrice.toLocaleString()}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Total Payable</span>
                <span className="text-[11px] text-slate-500">Includes live sessions, replays & study materials</span>
              </div>
              <div className="text-right">
                <span className="font-['Outfit'] text-2xl font-black text-[#3B0764]">
                  ₹{finalPayable.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Benefits Bullet Points (Strictly follows Course Facilities in Admin Dashboard) */}
          {Boolean(currentCourse?.facilities && currentCourse.facilities.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              {currentCourse!.facilities!.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="leading-tight break-words">{benefit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#4A1D96] to-[#6B21A8] hover:from-[#3B0764] hover:to-[#581C87] text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-900/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Opening Secure Payment Portal...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Buy Course • Pay ₹{finalPayable.toLocaleString()} (UPI, Cards, NetBanking)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Explicit Policy Agreement */}
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            By proceeding, you agree to Wits Lingo's{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#4A1D96] font-semibold underline">
              Terms & Conditions
            </a>
            ,{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4A1D96] font-semibold underline">
              Privacy Policy
            </a>
            , and{' '}
            <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="text-[#4A1D96] font-semibold underline">
              7-Day Refund Policy
            </a>
            .
          </p>

          {/* Security footnote */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted 256-Bit SSL • 100% Safe & Secure Payment • Instant WhatsApp Dispatch</span>
          </div>
        </form>

      </div>
    </div>
  );
};
