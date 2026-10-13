import React, { useState, useEffect } from 'react';
import { CourseData, User } from '../types';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';
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

  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  if (!isOpen) return null;

  const currentCourse = publishedCourses.find(c => c.id === selectedCourseId) || defaultCourse;
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

      // If Razorpay keys are not yet configured or in test simulation without live Razorpay SDK
      if (!scriptLoaded || isTestMode || !(window as any).Razorpay) {
        console.log('[Checkout] Running test checkout simulation verification...');
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3B0764] via-[#4A1D96] to-[#6B21A8] text-white p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-purple-100 text-[11px] font-bold uppercase tracking-wider">
              Express Enrolment
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
              <Lock className="w-3 h-3" />
              Secure Checkout
            </span>
          </div>

          <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold tracking-tight">
            Enrol in {currentCourse?.name || 'Wits Lingo'}
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-1">
            Instant admission, batch seat confirmation & WhatsApp joining instructions.
          </p>
        </div>

        {/* Content Body */}
        <form onSubmit={handlePayNow} className="p-6 sm:p-7 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Course Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Selected Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setAppliedCoupon(null);
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4A1D96] bg-slate-50/50"
            >
              {publishedCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.level}) — ₹{Number(course.fee).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

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
              <span>Standard Course Fee</span>
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
                <span className="text-[11px] text-slate-500">Includes all live sessions & study materials</span>
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
                <span>Pay ₹{finalPayable.toLocaleString()} Now & Start Learning</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

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
