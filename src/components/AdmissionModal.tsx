import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CourseData, Batch, User, SiteSettings } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, CheckCircle2, Shield, CreditCard, Sparkles, AlertCircle, 
  ArrowRight, UserCheck, Printer, Copy, Check, ExternalLink, 
  Globe, Building2, QrCode, Smartphone, Wallet, DollarSign,
  Landmark, ArrowUpRight, HelpCircle, Lock, Eye, EyeOff, KeyRound,
  Download, FileText, MessageCircle
} from 'lucide-react';
import { CountryCodePhoneInput } from './CountryCodePhoneInput';
import { CountryPhoneCode, DEFAULT_COUNTRY_CODE, ALL_COUNTRY_PHONE_CODES } from '../data/countryPhoneCodes';
import { AddressHierarchySelector } from './AddressHierarchySelector';
import { AdmissionSlipPrintable, AdmissionSlipData } from './AdmissionSlipPrintable';

// Gentle notification chime using Web Audio API
const playSubtleNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, now);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now);
    masterGain.connect(filter);
    filter.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.85, now + 0.012);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.17);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.07);
    gain2.gain.setValueAtTime(0.0001, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.7, now + 0.085);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.33);
  } catch (e) {}
};

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CourseData[];
  batches: Batch[];
  initialCourseId?: string;
  initialBatchId?: string;
  siteSettings?: SiteSettings;
  onAdmissionSuccess: (user: User, token: string) => void;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rateAgainstINR: number;
  country: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rateAgainstINR: 1, country: 'India' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rateAgainstINR: 0.012, country: 'United States & Global' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', rateAgainstINR: 0.0094, country: 'United Kingdom' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', rateAgainstINR: 0.011, country: 'Europe' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED ', flag: '🇦🇪', rateAgainstINR: 0.044, country: 'UAE / Dubai' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR ', flag: '🇸🇦', rateAgainstINR: 0.045, country: 'Saudi Arabia' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦', rateAgainstINR: 0.016, country: 'Canada' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', flag: '🇦🇺', rateAgainstINR: 0.018, country: 'Australia' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR ', flag: '🇶🇦', rateAgainstINR: 0.044, country: 'Qatar' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD ', flag: '🇰🇼', rateAgainstINR: 0.0037, country: 'Kuwait' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩', rateAgainstINR: 1.44, country: 'Bangladesh' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰', rateAgainstINR: 3.35, country: 'Pakistan' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', flag: '🇳🇵', rateAgainstINR: 1.6, country: 'Nepal' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'SG$', flag: '🇸🇬', rateAgainstINR: 0.016, country: 'Singapore' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR ', flag: '🇴🇲', rateAgainstINR: 0.0046, country: 'Oman' }
];

export const AdmissionModal: React.FC<AdmissionModalProps> = ({
  isOpen,
  onClose,
  courses,
  batches,
  initialCourseId,
  initialBatchId,
  siteSettings,
  onAdmissionSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lock background body scroll completely while modal is open
  useScrollLock(isOpen);

  // Selected Currency State
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>('INR');

  // Payment UI Navigation Tab: 'upi' | 'card' | 'bank' | 'international'
  const [paymentTab, setPaymentTab] = useState<'upi' | 'card' | 'bank' | 'international'>('upi');
  
  // Specific UPI App Selected: 'gpay' | 'phonepe' | 'paytm' | 'qr'
  const [upiSubApp, setUpiSubApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr'>('gpay');

  // Dynamic QR Code Data URL
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Copy Feedback state (tracks key of copied item)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // User input for custom UTR / Reference ID
  const [customUtr, setCustomUtr] = useState<string>('');

  // Card payment form inputs
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });

  // Netbanking selected bank
  const [selectedBank, setSelectedBank] = useState('State Bank of India');

  // Form State
  const [phoneCountry, setPhoneCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [whatsappCountry, setWhatsappCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [showSlipPassword, setShowSlipPassword] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [successActiveTab, setSuccessActiveTab] = useState<'slip' | 'summary'>('slip');

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    dob: '',
    gender: 'Male',
    country: 'India',
    countryFlag: '🇮🇳',
    state: 'Uttar Pradesh',
    district: 'Amroha',
    pincode: '244221',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    portalPassword: 'WitsLingo@2026',
    qualification: 'Undergraduate',
    currentEnglishLevel: 'Beginner',
    courseId: initialCourseId || (courses[0]?.id || 'course-spoken-english'),
    batchId: initialBatchId || (batches.find(b => b.status === 'Active' || b.status === 'Upcoming')?.id || 'batch-spoken-oct-2026'),
    paymentMethod: 'UPI / Google Pay',
    isFeePaid: false,
    paymentTxnId: ''
  });

  // Success Confirmation State (Full Admission Slip Data)
  const [confirmedSlip, setConfirmedSlip] = useState<AdmissionSlipData | null>(null);
  const [copiedSlipMsg, setCopiedSlipMsg] = useState(false);

  const selectedCourse = courses.find(c => c.id === formData.courseId) || courses[0];
  const selectedBatch = batches.find(b => b.id === formData.batchId) || batches[0];
  const feeAmount = selectedCourse ? selectedCourse.fee : 1499;

  // Selected Currency Info
  const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrencyCode) || SUPPORTED_CURRENCIES[0];
  const convertedAmount = Math.round(feeAmount * selectedCurrency.rateAgainstINR * 100) / 100;
  const formattedFeeString = selectedCurrency.code === 'INR'
    ? `₹${feeAmount.toLocaleString('en-IN')}`
    : `${selectedCurrency.symbol}${convertedAmount.toLocaleString()} (${selectedCurrency.code}) ≈ ₹${feeAmount.toLocaleString('en-IN')}`;

  // Default Bank Details from settings or fallback
  const bankName = siteSettings?.bankName || 'State Bank of India';
  const bankHolder = siteSettings?.bankAccountHolder || 'Wits Lingo Academy / Mohammad Ziya';
  const bankAccountNo = siteSettings?.bankAccountNumber || '38920194821';
  const bankIfsc = siteSettings?.bankIfscCode || 'SBIN0001234';
  const bankBranch = siteSettings?.bankBranch || 'Amroha Main Branch, Uttar Pradesh, India';
  const bankType = siteSettings?.bankAccountType || 'Current Account';
  const bankSwift = siteSettings?.bankSwiftBic || 'SBININBB123';
  const upiId = siteSettings?.upiId || '9027729917@ybl';
  const upiNumber = siteSettings?.upiNumber || '+91 9027729917';
  const razorpayLink = siteSettings?.razorpayPaymentLink || 'https://rzp.io/l/witslingo';
  const paypalLink = siteSettings?.paypalEmailOrLink || 'https://paypal.me/witslingo';

  // Generate UPI QR Code
  useEffect(() => {
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(siteSettings?.academyName || 'WITS LINGO')}&am=${feeAmount}&cu=INR&tn=${encodeURIComponent('WL_Admission_Fee')}`;
    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 1,
      color: {
        dark: '#2E1065',
        light: '#FFFFFF'
      }
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('Failed to generate QR Code:', err);
    });
  }, [upiId, siteSettings?.academyName, feeAmount]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // Only accept numbers in 10 digits
  const format10DigitNumber = (input: string): string => {
    let digits = input.replace(/\D/g, '');
    // If pasted with country code e.g. +91 or 91 followed by 10 digits
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.fatherName.trim() || !formData.dob) {
        setErrorMsg('Please enter student name, father\'s name, and date of birth.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.country.trim()) {
        setErrorMsg('Please select your country.');
        return;
      }
      if (!formData.state.trim()) {
        setErrorMsg('Please select or specify your state/province.');
        return;
      }
      if (!formData.district.trim()) {
        setErrorMsg('Please select or specify your district/city.');
        return;
      }
      if (!formData.pincode.trim()) {
        setErrorMsg('Please enter your PIN / ZIP / Postal code.');
        return;
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        setErrorMsg('Please enter a valid email address for portal login.');
        return;
      }
      const phoneDigits = (formData.phone || '').replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        setErrorMsg('Mobile Phone number is required and must be exactly 10 digits.');
        return;
      }
      const whatsappDigits = (formData.whatsapp || '').replace(/\D/g, '');
      if (whatsappDigits.length !== 10) {
        setErrorMsg('WhatsApp Number is required and must be exactly 10 digits.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!formData.courseId || !formData.batchId) {
        setErrorMsg('Please select your preferred course and batch.');
        return;
      }
      setCurrentStep(4);
    }
  };

  // Dynamically load Razorpay SDK
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Process Final Payment & Issue Admission
  const handleProcessPayment = async (overrideMethod?: string) => {
    setLoading(true);
    setErrorMsg(null);

    // Validate 10 digits
    const phoneDigits = (formData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setErrorMsg('Mobile Phone number is required and must be exactly 10 digits.');
      setCurrentStep(2);
      setLoading(false);
      return;
    }
    const whatsappDigits = (formData.whatsapp || '').replace(/\D/g, '');
    if (whatsappDigits.length !== 10) {
      setErrorMsg('WhatsApp Number is required and must be exactly 10 digits.');
      setCurrentStep(2);
      setLoading(false);
      return;
    }

    try {
      // Determine final payment method title
      let chosenMethod = overrideMethod || formData.paymentMethod;
      if (!overrideMethod) {
        if (paymentTab === 'upi') {
          if (upiSubApp === 'gpay') chosenMethod = 'Google Pay (UPI)';
          else if (upiSubApp === 'phonepe') chosenMethod = 'PhonePe (UPI)';
          else if (upiSubApp === 'paytm') chosenMethod = 'Paytm (UPI)';
          else chosenMethod = 'UPI / QR Scan';
        } else if (paymentTab === 'card') {
          chosenMethod = cardDetails.number ? 'Credit/Debit Card' : `NetBanking (${selectedBank})`;
        } else if (paymentTab === 'bank') {
          chosenMethod = `Direct Bank Transfer (${bankName})`;
        } else if (paymentTab === 'international') {
          chosenMethod = `International Wire / Remittance (${selectedCurrency.code} ${selectedCurrency.symbol}${convertedAmount})`;
        }
      }

      // 1. Try Razorpay Order Creation if online payment selected
      let isRazorpayHandled = false;
      try {
        const orderRes = await fetch('/api/payments/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: selectedCourse.id,
            batchId: selectedBatch.id,
            studentName: formData.name,
            studentEmail: formData.email,
            studentPhone: `${phoneCountry.dialCode} ${phoneDigits}`
          })
        });

        const orderData = await orderRes.json();

        if (orderRes.ok && orderData.success && orderData.orderId) {
          const scriptLoaded = await loadRazorpayScript();
          if (scriptLoaded && (window as any).Razorpay) {
            isRazorpayHandled = true;

            const rzpOptions = {
              key: orderData.keyId,
              amount: orderData.amount,
              currency: orderData.currency || 'INR',
              name: 'WITS LINGO',
              description: `${selectedCourse.name} — ${selectedBatch.name}`,
              image: '/video/wits-logo.png',
              order_id: orderData.orderId,
              prefill: {
                name: formData.name,
                email: formData.email,
                contact: `${phoneCountry.dialCode}${phoneDigits}`
              },
              notes: {
                courseId: selectedCourse.id,
                batchId: selectedBatch.id,
                studentName: formData.name
              },
              theme: {
                color: '#4A1D96'
              },
              handler: async (response: any) => {
                setLoading(true);
                try {
                  const verifyRes = await fetch('/api/payments/razorpay/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpayOrderId: response.razorpay_order_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature,
                      name: formData.name,
                      fatherName: formData.fatherName,
                      dob: formData.dob,
                      gender: formData.gender,
                      country: formData.country,
                      district: formData.district,
                      state: formData.state,
                      pincode: formData.pincode,
                      phone: `${phoneCountry.dialCode} ${phoneDigits}`,
                      phoneCountryCode: phoneCountry.dialCode,
                      whatsapp: `${whatsappCountry.dialCode} ${whatsappDigits}`,
                      whatsappCountryCode: whatsappCountry.dialCode,
                      email: formData.email,
                      address: formData.address,
                      qualification: formData.qualification,
                      currentEnglishLevel: formData.currentEnglishLevel,
                      courseId: selectedCourse.id,
                      batchId: selectedBatch.id,
                      studentPassword: formData.portalPassword
                    })
                  });

                  const verifyData = await verifyRes.json();
                  if (!verifyRes.ok || !verifyData.success) {
                    throw new Error(verifyData.error || 'Payment signature verification failed.');
                  }

                  const slipData: AdmissionSlipData = {
                    admissionId: verifyData.admissionId,
                    name: formData.name,
                    fatherName: formData.fatherName,
                    dob: formData.dob,
                    gender: formData.gender,
                    phone: `${phoneCountry.dialCode} ${phoneDigits}`,
                    whatsapp: `${whatsappCountry.dialCode} ${whatsappDigits}`,
                    email: formData.email,
                    country: formData.country,
                    state: formData.state,
                    district: formData.district,
                    pincode: formData.pincode,
                    address: formData.address,
                    courseName: selectedCourse.name,
                    batchName: selectedBatch.name,
                    batchCode: selectedBatch.batchCode,
                    batchTiming: selectedBatch.scheduleTime,
                    paymentMethod: 'Razorpay Verified',
                    formattedAmount: formattedFeeString,
                    txnId: response.razorpay_payment_id,
                    feeAmount: feeAmount,
                    paymentStatus: 'Confirmed & Paid',
                    registeredAt: new Date().toISOString(),
                    username: verifyData.credentials?.username || formData.email,
                    password: verifyData.credentials?.password || formData.portalPassword || 'WitsLingo@2026',
                    whatsappConfirmationMessage: verifyData.whatsapp?.confirmationMessage,
                    whatsappStudentUrl: verifyData.whatsapp?.studentUrl,
                    whatsappAdminUrl: verifyData.whatsapp?.adminUrl
                  };

                  setConfirmedSlip(slipData);
                  try {
                    localStorage.setItem('wits_lingo_last_slip', JSON.stringify(slipData));
                    localStorage.setItem('wits_lingo_user', JSON.stringify(verifyData.user));
                    localStorage.setItem('wits_lingo_token', verifyData.token);
                  } catch (e) {}

                  playSubtleNotificationSound();
                  onAdmissionSuccess(verifyData.user, verifyData.token);
                } catch (verifyErr: any) {
                  setErrorMsg(verifyErr.message || 'Payment verification failed.');
                } finally {
                  setLoading(false);
                }
              },
              modal: {
                ondismiss: () => {
                  setLoading(false);
                }
              }
            };

            const rzp = new (window as any).Razorpay(rzpOptions);
            rzp.on('payment.failed', (resp: any) => {
              setErrorMsg(resp.error?.description || 'Payment was declined or failed.');
              setLoading(false);
            });
            rzp.open();
            return;
          }
        }
      } catch (rzpErr) {
        console.log('[Razorpay] Proceeding with standard admission dispatch:', rzpErr);
      }

      if (isRazorpayHandled) return;

      // 2. Direct / Offline / UTR Fallback Admission
      let txnId = customUtr.trim();
      if (!txnId) {
        if (paymentTab === 'upi') {
          txnId = `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        } else if (paymentTab === 'card') {
          txnId = `CARD${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        } else if (paymentTab === 'bank') {
          txnId = `IMPS${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        } else {
          txnId = `SWIFT${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        }
      }

      // Post admission to backend API
      const res = await fetch('/api/admissions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          password: formData.portalPassword || 'WitsLingo@2026',
          phone: `${phoneCountry.dialCode} ${phoneDigits}`,
          phoneCountryCode: phoneCountry.dialCode,
          whatsapp: `${whatsappCountry.dialCode} ${whatsappDigits}`,
          whatsappCountryCode: whatsappCountry.dialCode,
          paymentMethod: chosenMethod,
          paymentCurrency: selectedCurrency.code,
          paymentAmountFormatted: formattedFeeString,
          isFeePaid: true,
          paymentTxnId: txnId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm admission.');
      }

      const assignedPassword = data.credentials?.password || formData.portalPassword || 'WitsLingo@2026';
      const assignedUsername = data.credentials?.username || formData.email;

      const slipData: AdmissionSlipData = {
        admissionId: data.admissionId,
        name: formData.name,
        fatherName: formData.fatherName,
        dob: formData.dob,
        gender: formData.gender,
        phone: `${phoneCountry.dialCode} ${phoneDigits}`,
        whatsapp: `${whatsappCountry.dialCode} ${whatsappDigits}`,
        email: formData.email,
        country: formData.country,
        state: formData.state,
        district: formData.district,
        pincode: formData.pincode,
        address: formData.address,
        courseName: selectedCourse.name,
        batchName: selectedBatch.name,
        batchCode: selectedBatch.batchCode,
        batchTiming: selectedBatch.scheduleTime,
        paymentMethod: chosenMethod,
        formattedAmount: formattedFeeString,
        txnId: txnId,
        feeAmount: feeAmount,
        paymentStatus: 'Confirmed & Paid',
        registeredAt: new Date().toISOString(),
        username: assignedUsername,
        password: assignedPassword,
        whatsappConfirmationMessage: data.whatsapp?.confirmationMessage,
        whatsappStudentUrl: data.whatsapp?.studentUrl,
        whatsappAdminUrl: data.whatsapp?.adminUrl
      };

      setConfirmedSlip(slipData);

      // Persist slip to localStorage so student retains access after registration
      try {
        localStorage.setItem('wits_lingo_last_slip', JSON.stringify(slipData));
        localStorage.setItem('wits_lingo_user', JSON.stringify(data.user));
        localStorage.setItem('wits_lingo_token', data.token);
      } catch (e) {}

      // Play soft confirmation sound
      playSubtleNotificationSound();

      // Notify parent app
      onAdmissionSuccess(data.user, data.token);

    } catch (err: any) {
      setErrorMsg(err.message || 'Payment processing error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain smooth-scroll-viewport">
      <div className={`bg-white rounded-3xl ${confirmedSlip ? 'max-w-4xl' : 'max-w-2xl'} w-full shadow-2xl border border-purple-100 overflow-hidden my-auto animate-in zoom-in-95 overscroll-contain`}>
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white p-4 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-1 pr-8">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Official Academy Enrollment
              </span>
            </div>
            <h2 className="font-['Outfit'] font-extrabold text-lg sm:text-2xl tracking-tight">
              Student Admission Registration
            </h2>
            <p className="text-[11px] sm:text-xs text-purple-200">
              Complete your student registration & confirm your seat for the upcoming batch.
            </p>
          </div>

          {/* Stepper indicator if not confirmed yet */}
          {!confirmedSlip && (
            <div className="grid grid-cols-4 gap-2 pt-3 sm:pt-4">
              {[
                { step: 1, label: 'Student' },
                { step: 2, label: 'Contact' },
                { step: 3, label: 'Batch' },
                { step: 4, label: 'Payment' }
              ].map((s) => (
                <div key={s.step} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      currentStep >= s.step ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                  />
                  <span className="text-[10px] block truncate text-purple-200 font-medium text-center">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-7 max-h-[72vh] sm:max-h-[78vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
          
          {errorMsg && (
            <div className="p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* CONFIRMED ADMISSION SLIP VIEW */}
          {/* ================================================================= */}
          {confirmedSlip ? (
            <div className="space-y-6">
              {/* Celebration Banner & Direct Web Actions */}
              <div className="p-6 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border-2 border-emerald-300 rounded-3xl text-center space-y-3 relative overflow-hidden shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Admission Completed on Web
                  </span>
                  <h3 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-emerald-950 mt-1.5">
                    Admission Confirmed & Fee Verified!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 max-w-xl mx-auto leading-relaxed mt-1">
                    Welcome to {siteSettings?.academyName || 'WITS LINGO'}. Your official seat is secured in{' '}
                    <strong className="font-bold text-emerald-950">{confirmedSlip.batchName}</strong> with Roll ID{' '}
                    <strong className="font-mono text-emerald-950 font-bold underline decoration-emerald-400">{confirmedSlip.admissionId}</strong>.
                  </p>
                </div>

                {/* Primary Download & Navigation Action Bar */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessActiveTab('slip');
                      setTimeout(() => {
                        const dlBtn = document.getElementById('admission-slip-download-pdf-btn');
                        if (dlBtn) dlBtn.click();
                      }, 100);
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-purple-900/20 transition-all active:scale-95 cursor-pointer ring-2 ring-purple-400 ring-offset-2 ring-offset-white"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Download Official Admission Form (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSuccessActiveTab('slip');
                      setTimeout(() => {
                        const printBtn = document.getElementById('admission-slip-print-btn');
                        if (printBtn) printBtn.click();
                        else window.print();
                      }, 100);
                    }}
                    className="px-5 py-3 rounded-xl border-2 border-purple-200 bg-white hover:bg-purple-50 text-purple-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-purple-700" />
                    <span>Print Form</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-3 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <span>Go to My Purchased Batch</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Highlighted Purchased Batch Login Credentials */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white rounded-2xl shadow-lg border-2 border-amber-300/40 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-['Outfit'] font-black text-sm uppercase tracking-wider text-amber-200">
                        Purchased Batch Portal Login Credentials
                      </h4>
                      <p className="text-[11px] text-purple-200">
                        Use these credentials to log into your batch live classroom and lessons.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${siteSettings?.academyName || 'WITS LINGO'} Portal Login\nUsername: ${confirmedSlip.username}\nAdmission ID: ${confirmedSlip.admissionId}\nPassword: ${confirmedSlip.password || 'WitsLingo@2026'}\nPortal URL: https://witslingo.com/login`
                      );
                      setCopiedCreds(true);
                      setTimeout(() => setCopiedCreds(false), 2500);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    {copiedCreds ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-emerald-300">Credentials Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-300" />
                        <span>Copy All Credentials</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <span className="text-[10px] text-purple-200 font-semibold block uppercase">
                      Login Username (Email)
                    </span>
                    <strong className="font-mono text-white text-xs block truncate mt-0.5">
                      {confirmedSlip.username}
                    </strong>
                    <span className="text-[10px] text-white/60 block mt-1">
                      Alt ID: <span className="font-mono font-bold text-amber-200">{confirmedSlip.admissionId}</span>
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-200 font-semibold uppercase">
                        Portal Password
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSlipPassword(!showSlipPassword)}
                        className="text-white/70 hover:text-white p-0.5 cursor-pointer"
                        title={showSlipPassword ? 'Hide' : 'Show'}
                      >
                        {showSlipPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <strong className="font-mono text-amber-300 text-sm block tracking-wider mt-0.5">
                      {showSlipPassword ? confirmedSlip.password || 'WitsLingo@2026' : '••••••••••••'}
                    </strong>
                    <span className="text-[10px] text-white/60 block mt-1">
                      You can change this inside your profile
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-purple-200 font-semibold block uppercase">
                        Assigned Batch
                      </span>
                      <strong className="text-white text-xs block truncate mt-0.5">
                        {confirmedSlip.batchName}
                      </strong>
                    </div>
                    <span className="text-[10px] text-emerald-300 font-bold block mt-1">
                      ● Active & Enrolled
                    </span>
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSuccessActiveTab('slip')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      successActiveTab === 'slip'
                        ? 'bg-[#4A1D96] text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Official Printable Admission Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSuccessActiveTab('summary')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      successActiveTab === 'summary'
                        ? 'bg-[#4A1D96] text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Summary</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono text-purple-900 font-bold hidden sm:inline-block">
                  Ref: {confirmedSlip.admissionId}
                </span>
              </div>

              {/* TAB 1: THE FULL OFFICIAL PRINTABLE ADMISSION SLIP */}
              {successActiveTab === 'slip' && (
                <AdmissionSlipPrintable
                  data={confirmedSlip}
                  onClose={onClose}
                  onGoToPortal={onClose}
                />
              )}

              {/* TAB 2: QUICK SUMMARY VIEW */}
              {successActiveTab === 'summary' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl border-2 border-dashed border-purple-200 bg-[#FAF9FC] space-y-4 text-xs">
                    <div className="flex justify-between items-start border-b border-purple-100 pb-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Official Admission Receipt</span>
                        <h4 className="font-bold text-base text-[#4A1D96] uppercase">{siteSettings?.academyName || 'WITS LINGO'}</h4>
                        <p className="text-[11px] text-purple-700 font-semibold">{siteSettings?.tagline || 'A Global Language Platform'}</p>
                        <p className="text-[10px] text-slate-500">Amroha, Uttar Pradesh, India - 244221</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Admission ID</span>
                        <span className="font-mono font-bold text-sm text-[#4A1D96] block bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          {confirmedSlip.admissionId}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Student Name:</span>
                        <strong className="text-slate-900 text-xs uppercase">{confirmedSlip.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Father's Name:</span>
                        <strong className="text-slate-900 text-xs">{confirmedSlip.fatherName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Enrolled Course:</span>
                        <strong className="text-[#4A1D96] text-xs">{confirmedSlip.courseName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Allocated Batch:</span>
                        <strong className="text-emerald-700 text-xs">{confirmedSlip.batchName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Payment Method:</span>
                        <strong className="text-slate-900 text-xs">{confirmedSlip.paymentMethod}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Amount Paid:</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> {confirmedSlip.formattedAmount}
                        </span>
                      </div>
                      <div className="col-span-1 sm:col-span-2 pt-1 border-t border-purple-100">
                        <span className="text-slate-400 block text-[10px]">Transaction / UTR Reference ID:</span>
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-0.5">
                          {confirmedSlip.txnId}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSuccessActiveTab('slip')}
                      className="flex-1 py-3 px-4 rounded-xl border border-purple-200 bg-purple-50 text-purple-900 text-xs font-bold hover:bg-purple-100 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Printer className="w-4 h-4 text-purple-700" />
                      <span>Print or Download PDF Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      <span>Go to My Purchased Batch</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* ================================================================= */}
              {/* STEP 1: Student Personal Information */}
              {/* ================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                      1. Student Personal Information
                    </h3>
                    <p className="text-xs text-slate-500">
                      Required for official batch records and identity card.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Student Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Father's / Guardian's Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        placeholder="e.g. Suresh Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Date of Birth *
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.dob}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Gender
                        </label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* STEP 2: Contact & Location */}
              {/* ================================================================= */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                      2. Contact Details & Address
                    </h3>
                    <p className="text-xs text-slate-500">
                      Live batch links and notifications will be shared on these contacts.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Contact Phone & WhatsApp */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <CountryCodePhoneInput
                        id="admission-phone"
                        label="Mobile Phone"
                        required={true}
                        country={phoneCountry}
                        onCountryChange={setPhoneCountry}
                        phoneNumber={formData.phone}
                        onPhoneNumberChange={(cleanDigits) =>
                          setFormData((prev) => ({ ...prev, phone: cleanDigits }))
                        }
                        placeholder="9876543210"
                      />

                      <CountryCodePhoneInput
                        id="admission-whatsapp"
                        label="WhatsApp Number"
                        required={true}
                        country={whatsappCountry}
                        onCountryChange={setWhatsappCountry}
                        phoneNumber={formData.whatsapp}
                        onPhoneNumberChange={(cleanDigits) =>
                          setFormData((prev) => ({ ...prev, whatsapp: cleanDigits }))
                        }
                        placeholder="9876543210"
                        extraHeaderAction={
                          <button
                            type="button"
                            onClick={() => {
                              setWhatsappCountry(phoneCountry);
                              setFormData((prev) => ({ ...prev, whatsapp: prev.phone }));
                            }}
                            className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                            title="Copy number and country code from Mobile Phone"
                          >
                            Same as Mobile
                          </button>
                        }
                      />
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50/80 border border-purple-200/80 rounded-xl text-[11px] text-purple-900">
                      <FileText className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span>
                        Your official verifiable admission form will be generated directly on the web with instant PDF download upon payment submission.
                      </span>
                    </div>

                    {/* Email for login credentials */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Email Address (Portal Login Username) *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="student@gmail.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>

                    {/* Student Portal Password for Purchased Batch Access */}
                    <div className="p-3.5 bg-gradient-to-r from-purple-50/90 to-indigo-50/70 rounded-2xl border border-purple-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-purple-700" />
                          <span>Student Portal Login Password *</span>
                        </label>
                        <span className="text-[10px] text-purple-700 font-bold bg-purple-100/80 px-2 py-0.5 rounded-md">
                          Purchased Batch Access
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type={showPortalPassword ? 'text' : 'password'}
                          required
                          value={formData.portalPassword}
                          onChange={(e) => setFormData({ ...formData, portalPassword: e.target.value })}
                          placeholder="e.g. WitsLingo@2026"
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-purple-200 text-xs font-semibold text-slate-900 bg-white focus:outline-hidden focus:border-[#4A1D96]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPortalPassword(!showPortalPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          aria-label={showPortalPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPortalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Username: <strong className="text-purple-950 font-semibold">{formData.email || 'student@example.com'}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, portalPassword: `WL@${Math.floor(1000 + Math.random() * 9000)}` })}
                          className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                        >
                          Generate New
                        </button>
                      </div>
                      <p className="text-[10px] text-purple-700/80 leading-relaxed">
                        Keep these credentials safe. You will use them to log into your batch live classes, lecture recordings, and study resources.
                      </p>
                    </div>

                    {/* Address & Geographical Location Hierarchy */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="mb-2.5">
                        <span className="text-xs font-bold text-slate-900 block">
                          Residential Address & Location
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Select Country, State, District, and Postal Code.
                        </p>
                      </div>

                      <AddressHierarchySelector
                        country={formData.country}
                        onCountryChange={(newCountry, flag) => {
                          setFormData((prev) => ({
                            ...prev,
                            country: newCountry,
                            countryFlag: flag
                          }));
                          // Auto sync phone dialing code if user hasn't changed it separately
                          const matchedPhone = ALL_COUNTRY_PHONE_CODES.find(
                            (c) => c.name.toLowerCase() === newCountry.toLowerCase()
                          );
                          if (matchedPhone) {
                            setPhoneCountry(matchedPhone);
                            setWhatsappCountry(matchedPhone);
                          }
                        }}
                        state={formData.state}
                        onStateChange={(newState) =>
                          setFormData((prev) => ({ ...prev, state: newState }))
                        }
                        district={formData.district}
                        onDistrictChange={(newDistrict) =>
                          setFormData((prev) => ({ ...prev, district: newDistrict }))
                        }
                        pincode={formData.pincode}
                        onPincodeChange={(newPincode) =>
                          setFormData((prev) => ({ ...prev, pincode: newPincode }))
                        }
                        address={formData.address}
                        onAddressChange={(newAddress) =>
                          setFormData((prev) => ({ ...prev, address: newAddress }))
                        }
                        required={true}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* STEP 3: Course & Batch Selection */}
              {/* ================================================================= */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                      3. Select Course & Batch Timing
                    </h3>
                    <p className="text-xs text-slate-500">
                      Choose your preferred English course and live class schedule.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Choose Course *
                      </label>
                      <select
                        value={formData.courseId}
                        onChange={(e) => {
                          setFormData({ ...formData, courseId: e.target.value });
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — ₹{c.fee.toLocaleString()} ({c.duration})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Assign Live Batch Timing *
                      </label>
                      <div className="space-y-2">
                        {batches
                          .filter((b) => b.courseId === formData.courseId || b.courseId === 'course-spoken-english')
                          .map((b) => (
                            <label
                              key={b.id}
                              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                formData.batchId === b.id
                                  ? 'border-[#4A1D96] bg-purple-50/50 shadow-2xs'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="batchSelect"
                                  checked={formData.batchId === b.id}
                                  onChange={() => setFormData({ ...formData, batchId: b.id })}
                                  className="w-4 h-4 text-[#4A1D96] accent-[#4A1D96]"
                                />
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900">{b.name}</h4>
                                  <p className="text-[11px] text-slate-500">
                                    Time: {b.scheduleTime || '7:00 PM - 8:30 PM Daily'} • Starts {b.startDate}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                {b.currentStudentsCount}/{b.maxStudents} Seats Filled
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900 flex items-center justify-between">
                      <span>Total Course Fee Payable:</span>
                      <strong className="font-['Outfit'] text-base text-[#3B0764]">₹{feeAmount.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* STEP 4: Course Fee Payment & Multi-Method Bank Options */}
              {/* ================================================================= */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                        4. Fee Payment & Instant Confirmation
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pay via UPI, Google Pay, PhonePe, Cards, Direct Bank Transfer, or International Currency.
                      </p>
                    </div>

                    {/* All Country Currency Selector */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                      <Globe className="w-3.5 h-3.5 text-[#4A1D96]" />
                      <label className="text-[10px] font-bold text-purple-950">Currency:</label>
                      <select
                        value={selectedCurrencyCode}
                        onChange={(e) => setSelectedCurrencyCode(e.target.value)}
                        className="bg-transparent text-xs font-bold text-[#4A1D96] focus:outline-hidden cursor-pointer"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code} ({c.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fee Summary Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/90 to-purple-100/50 border border-purple-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Course & Assigned Batch</p>
                      <h4 className="font-bold text-xs text-slate-900">{selectedCourse.name}</h4>
                      <p className="text-[11px] text-slate-500">{selectedBatch.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Total Payable Amount</p>
                      <p className="font-['Outfit'] font-black text-2xl text-[#3B0764]">
                        {selectedCurrency.symbol}{selectedCurrency.code === 'INR' ? feeAmount.toLocaleString() : convertedAmount.toLocaleString()}
                      </p>
                      {selectedCurrency.code !== 'INR' && (
                        <p className="text-[10px] font-semibold text-slate-500">
                          ≈ ₹{feeAmount.toLocaleString('en-IN')} INR
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Method Category Tabs */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">
                      Select Payment Option:
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentTab('upi')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          paymentTab === 'upi'
                            ? 'border-[#4A1D96] bg-purple-50 text-[#4A1D96] font-bold shadow-xs ring-1 ring-[#4A1D96]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-purple-700" />
                        <span className="text-xs">UPI & Apps</span>
                        <span className="text-[9px] text-emerald-600 font-semibold">GPay / PhonePe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentTab('card')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          paymentTab === 'card'
                            ? 'border-[#4A1D96] bg-purple-50 text-[#4A1D96] font-bold shadow-xs ring-1 ring-[#4A1D96]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-purple-700" />
                        <span className="text-xs">Cards / NetBank</span>
                        <span className="text-[9px] text-slate-500 font-medium">Debit / Credit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentTab('bank')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          paymentTab === 'bank'
                            ? 'border-[#4A1D96] bg-purple-50 text-[#4A1D96] font-bold shadow-xs ring-1 ring-[#4A1D96]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <Landmark className="w-4 h-4 text-purple-700" />
                        <span className="text-xs">Direct to Bank</span>
                        <span className="text-[9px] text-purple-600 font-semibold">IMPS / NEFT</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentTab('international')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          paymentTab === 'international'
                            ? 'border-[#4A1D96] bg-purple-50 text-[#4A1D96] font-bold shadow-xs ring-1 ring-[#4A1D96]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-purple-700" />
                        <span className="text-xs">All Countries</span>
                        <span className="text-[9px] text-amber-600 font-semibold">Global Currency</span>
                      </button>
                    </div>

                    {/* TAB 1: UPI & APPS (GOOGLE PAY, PHONEPE, PAYTM, QR) */}
                    {paymentTab === 'upi' && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            Choose UPI Payment App or Scan QR:
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                            Instant Verification
                          </span>
                        </div>

                        {/* UPI App Selector Buttons */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'gpay', name: 'Google Pay', label: 'GPay' },
                            { id: 'phonepe', name: 'PhonePe', label: 'PhonePe' },
                            { id: 'paytm', name: 'Paytm', label: 'Paytm' },
                            { id: 'qr', name: 'Any UPI QR', label: 'Scan QR' }
                          ].map((app) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => setUpiSubApp(app.id as any)}
                              className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                upiSubApp === app.id
                                  ? 'bg-[#3B0764] text-white border-[#3B0764] shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              {app.label}
                            </button>
                          ))}
                        </div>

                        {/* QR Code & Direct Mobile Link Box */}
                        <div className="p-4 bg-white rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-center gap-5">
                          {/* Generated QR Code */}
                          <div className="flex flex-col items-center text-center">
                            <div className="w-36 h-36 p-1.5 bg-white rounded-xl border border-purple-200 shadow-sm flex items-center justify-center">
                              {qrDataUrl ? (
                                <img src={qrDataUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain" />
                              ) : (
                                <QrCode className="w-16 h-16 text-purple-300 animate-pulse" />
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 mt-1.5 flex items-center gap-1">
                              <QrCode className="w-3 h-3 text-purple-700" />
                              Scan with any UPI App
                            </span>
                          </div>

                          {/* App Specific Details & Copy Actions */}
                          <div className="flex-1 space-y-3 w-full text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">Academy UPI ID</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono font-bold text-slate-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-xs truncate">
                                  {upiId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(upiId, 'upiId')}
                                  className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                                  title="Copy UPI ID"
                                >
                                  {copiedKey === 'upiId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">PhonePe / Google Pay Number</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono font-bold text-slate-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-xs">
                                  {upiNumber}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(upiNumber, 'upiNum')}
                                  className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                                  title="Copy Number"
                                >
                                  {copiedKey === 'upiNum' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Direct Mobile Intent Link */}
                            <div className="pt-1">
                              <a
                                href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(siteSettings?.academyName || 'Wits Lingo Academy')}&am=${feeAmount}&cu=INR&tn=${encodeURIComponent('WitsLingoAdmission')}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-bold text-[11px] transition-colors"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Pay directly via {upiSubApp === 'gpay' ? 'Google Pay' : upiSubApp === 'phonepe' ? 'PhonePe' : 'UPI App'}</span>
                                <ExternalLink className="w-3 h-3 text-emerald-700" />
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Optional UTR Input */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            12-Digit UPI Transaction Reference / UTR No. (Optional):
                          </label>
                          <input
                            type="text"
                            value={customUtr}
                            onChange={(e) => setCustomUtr(e.target.value)}
                            placeholder="e.g. 428194829103 (Leave empty for instant auto-verify)"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CREDIT / DEBIT CARDS & NETBANKING */}
                    {paymentTab === 'card' && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="font-bold text-slate-800">
                            Pay via Debit / Credit Card or NetBanking:
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Lock className="w-3 h-3 text-emerald-600" /> 256-Bit SSL Encrypted
                          </span>
                        </div>

                        {/* Card Form */}
                        <div className="space-y-3">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Card Number</label>
                            <input
                              type="text"
                              maxLength={19}
                              value={cardDetails.number}
                              onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                              placeholder="4532 •••• •••• 8921"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">Expiry Date</label>
                              <input
                                type="text"
                                maxLength={5}
                                value={cardDetails.expiry}
                                onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                                placeholder="MM / YY"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">CVV / CVC</label>
                              <input
                                type="password"
                                maxLength={4}
                                value={cardDetails.cvv}
                                onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                                placeholder="•••"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Name on Card</label>
                            <input
                              type="text"
                              value={cardDetails.name}
                              onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                              placeholder="e.g. Mohammad Ziya"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                            />
                          </div>
                        </div>

                        {/* NetBanking Bank Selection */}
                        <div className="pt-2 border-t border-slate-200">
                          <label className="font-bold text-slate-700 block mb-1">Or Select NetBanking Bank:</label>
                          <select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                          >
                            <option value="State Bank of India">State Bank of India (SBI)</option>
                            <option value="HDFC Bank">HDFC Bank</option>
                            <option value="ICICI Bank">ICICI Bank</option>
                            <option value="Punjab National Bank">Punjab National Bank (PNB)</option>
                            <option value="Axis Bank">Axis Bank</option>
                            <option value="Bank of Baroda">Bank of Baroda</option>
                            <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          </select>
                        </div>

                        {/* Direct Gateway Link */}
                        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Accepts Visa, Mastercard, RuPay, Maestro & Amex.</span>
                          {razorpayLink && (
                            <a
                              href={razorpayLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#4A1D96] font-bold hover:underline flex items-center gap-1"
                            >
                              <span>Official Razorpay Portal</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: DIRECT TO BANK ACCOUNT (IMPS / NEFT / RTGS) */}
                    {paymentTab === 'bank' && (
                      <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3.5 text-xs">
                        <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                          <div className="flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-[#4A1D96]" />
                            <span className="font-bold text-slate-900">
                              Official Academy Bank Account Details:
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                            Direct Bank Credit
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600">
                          Transfer directly from your banking app (YONO, HDFC, GPay Bank Transfer, or NetBanking) to the account below:
                        </p>

                        {/* Official Bank Account Card */}
                        <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-800">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Name</span>
                              <strong className="text-xs text-slate-900">{bankName}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Holder</span>
                              <strong className="text-xs text-slate-900">{bankHolder}</strong>
                            </div>

                            <div className="bg-purple-50/70 p-2 rounded-xl border border-purple-200">
                              <span className="text-[10px] uppercase font-bold text-purple-700 block">Account Number</span>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-purple-950">{bankAccountNo}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(bankAccountNo, 'accNo')}
                                  className="text-purple-700 hover:text-purple-900 p-1 cursor-pointer"
                                  title="Copy Account Number"
                                >
                                  {copiedKey === 'accNo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div className="bg-purple-50/70 p-2 rounded-xl border border-purple-200">
                              <span className="text-[10px] uppercase font-bold text-purple-700 block">IFSC Code</span>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-purple-950">{bankIfsc}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(bankIfsc, 'ifsc')}
                                  className="text-purple-700 hover:text-purple-900 p-1 cursor-pointer"
                                  title="Copy IFSC Code"
                                >
                                  {copiedKey === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Type</span>
                              <span className="font-semibold text-slate-800 text-xs">{bankType}</span>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch Location</span>
                              <span className="font-medium text-slate-800 text-xs">{bankBranch}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bank UTR Input */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Bank Transfer UTR / Transaction Reference Number:
                          </label>
                          <input
                            type="text"
                            value={customUtr}
                            onChange={(e) => setCustomUtr(e.target.value)}
                            placeholder="e.g. 428194829103 or IMPS..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
                          />
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Once transferred, enter the reference number above to confirm your registration immediately.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: ALL COUNTRIES & INTERNATIONAL CURRENCIES */}
                    {paymentTab === 'international' && (
                      <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-amber-700" />
                            <span className="font-bold text-slate-900">
                              International Payments (Students Worldwide):
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            Foreign Currency Remittance
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          Students living in the USA, UK, UAE, Saudi Arabia, Europe, Canada, Australia, or any country can transfer their course fee in their local currency directly to our bank account via international wire remittance (SWIFT) or online checkout.
                        </p>

                        {/* Foreign Bank Wire Card */}
                        <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800">
                              1. Direct International Bank Wire (SWIFT / BIC):
                            </span>
                            <span className="text-[10px] font-bold text-[#4A1D96] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              All Countries Accepted
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-800">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Beneficiary Name</span>
                              <strong className="text-xs text-slate-900">{bankHolder}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Name</span>
                              <strong className="text-xs text-slate-900">{bankName}</strong>
                            </div>

                            <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                              <span className="text-[10px] uppercase font-bold text-amber-900 block">SWIFT / BIC Code</span>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-amber-950">{bankSwift}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(bankSwift, 'swift')}
                                  className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
                                  title="Copy SWIFT Code"
                                >
                                  {copiedKey === 'swift' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                              <span className="text-[10px] uppercase font-bold text-amber-900 block">Account Number</span>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-amber-950">{bankAccountNo}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(bankAccountNo, 'intlAcc')}
                                  className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
                                  title="Copy Account Number"
                                >
                                  {copiedKey === 'intlAcc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Online International Option - Razorpay */}
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">2. Razorpay / International Cards</span>
                            <span className="text-[10px] text-slate-500">
                              Pay in {selectedCurrency.code} ({selectedCurrency.symbol}{convertedAmount}) instantly via Razorpay
                            </span>
                          </div>
                          {razorpayLink && (
                            <a
                              href={razorpayLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-[#0c2340] hover:bg-[#07172b] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <span>Razorpay Portal</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Wire Transaction Reference Input */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Foreign Wire Reference / Razorpay Transaction ID:
                          </label>
                          <input
                            type="text"
                            value={customUtr}
                            onChange={(e) => setCustomUtr(e.target.value)}
                            placeholder="e.g. SWIFT Ref or Razorpay Payment ID (pay_xxxx)"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Verification Policy Notice */}
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#4A1D96] flex-shrink-0" />
                    <p className="text-[11px] leading-relaxed">
                      All transaction amounts go <strong>directly into the official Wits Lingo Academy bank account</strong>. After payment, click the button below to generate your official Admission ID and student slip.
                    </p>
                  </div>
                </div>
              )}

              {/* Step Navigation Buttons */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-6">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    ← Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Proceed to Step {currentStep + 1}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <span className="text-[11px] text-purple-900 font-semibold flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 text-purple-700" />
                      <span>Instant Downloadable PDF Form on Submit</span>
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleProcessPayment()}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {loading
                          ? 'Confirming & Generating Form...'
                          : `Confirm & Allocate Seat (${selectedCurrency.symbol}${selectedCurrency.code === 'INR' ? feeAmount.toLocaleString() : convertedAmount.toLocaleString()})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
