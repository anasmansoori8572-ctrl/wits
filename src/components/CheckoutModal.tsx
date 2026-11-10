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
  Video
} from 'lucide-react';

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
  const [fullName, setFullName] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  
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
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalPayable = Math.max(1, coursePrice - discountAmount);

  // Apply Coupon Client-side Preview (Final verification is strictly enforced by server)
  const handleApplyCoupon = () => {
    setCouponError('');
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'WELCOME10') {
      const disc = Math.round(coursePrice * 0.10);
      setAppliedCoupon({ code, discount: disc, label: '10% Launch Discount Applied!' });
    } else if (code === 'WITS100') {
      const disc = Math.min(coursePrice - 1, 100);
      setAppliedCoupon({ code, discount: disc, label: '₹100 Flat Discount Applied!' });
    } else if (code === 'TEST100' || code === 'DEMO99') {
      const disc = Math.max(0, coursePrice - 1);
      setAppliedCoupon({ code, discount: disc, label: 'Test Simulation Mode (Pay ₹1)' });
    } else {
      setCouponError('Invalid or expired coupon code. Try WELCOME10 for 10% off.');
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

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

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit WhatsApp number.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create Pending Order on Server (Server verifies course price)
      const orderRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: fullName.trim(),
          whatsapp: cleanPhone,
          email: email.trim() || undefined,
          courseId: selectedCourseId,
          couponCode: appliedCoupon?.code || couponCode.trim() || undefined
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
            razorpaySignature: 'test_signature_mode'
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
          email: email.trim() || `${cleanPhone}@student.witslingo.com`,
          contact: cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
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
                razorpaySignature: response.razorpay_signature
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
                Razorpay Test Mode
              </span>
            )}
          </div>

          <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold tracking-tight">
            Enrol in {currentCourse?.name || 'Wits Lingo'}
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-1">
            {currentCourse?.shortDescription || 'Instant admission, batch seat confirmation & WhatsApp joining instructions.'}
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

          {/* Course Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Course <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-[#4A1D96]">
                ₹{coursePrice.toLocaleString()}
              </span>
            </div>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setAppliedCoupon(null);
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-purple-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4A1D96] bg-purple-50/20 cursor-pointer shadow-2xs"
            >
              {publishedCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.level}) — ₹{Number(course.fee).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

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

          {/* Student Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Student Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mohd Farhan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
            />
          </div>

          {/* WhatsApp Number (Mandatory) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                WhatsApp Number <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-purple-700 font-semibold flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-emerald-600" />
                Confirmation will be sent here
              </span>
            </div>
            <div className="relative flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#4A1D96]">
              <span className="inline-flex items-center px-3.5 bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-200">
                +91 (India)
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10-digit mobile number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Email Address <span className="text-slate-400 font-normal">(Optional for receipt)</span>
            </label>
            <input
              type="email"
              placeholder="e.g. student@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
            />
          </div>

          {/* Coupon Code Section */}
          <div className="pt-1 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-700" />
              Discount Coupon Code
            </label>
            {!appliedCoupon ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs uppercase tracking-wider font-semibold focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4A1D96] text-xs font-bold transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{appliedCoupon.label}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
            {couponError && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{couponError}</p>
            )}
          </div>

          {/* Pricing Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Standard Course Fee ({currentCourse?.name || 'Selected Course'})</span>
              <span className="font-semibold text-slate-800">₹{coursePrice.toLocaleString()}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-700">
                <span>Discount ({appliedCoupon?.code})</span>
                <span className="font-bold">-₹{discountAmount.toLocaleString()}</span>
              </div>
            )}

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

          {/* Benefits Bullet Points */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Live Google Meet Sessions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>60-Day Class Replays</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Free Study Material (PDF)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>7-Day 100% Money-Back</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#4A1D96] to-[#6B21A8] hover:from-[#3B0764] hover:to-[#581C87] text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-900/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Opening Secure Razorpay Portal...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Pay ₹{finalPayable.toLocaleString()} for {currentCourse?.name || 'Selected Course'} & Start Learning</span>
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
            <span>Encrypted 256-Bit SSL • Official Razorpay Gateway • Instant WhatsApp Dispatch</span>
          </div>
        </form>

      </div>
    </div>
  );
};
