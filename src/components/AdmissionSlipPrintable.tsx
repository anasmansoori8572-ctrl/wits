import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Printer,
  Download,
  Copy,
  Check,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  Lock,
  MessageCircle
} from 'lucide-react';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export interface AdmissionSlipData {
  admissionId: string;
  name: string;
  fatherName: string;
  dob: string;
  gender?: string;
  phone: string;
  whatsapp: string;
  email: string;
  country: string;
  state: string;
  district: string;
  pincode?: string;
  address?: string;
  courseName: string;
  batchName: string;
  batchCode?: string;
  batchTiming?: string;
  feeAmount: number | string;
  formattedAmount?: string;
  paymentStatus: string;
  paymentMethod: string;
  txnId: string;
  registeredAt?: string;
  username: string;
  password?: string;
  whatsappConfirmationMessage?: string;
  whatsappStudentUrl?: string;
  whatsappAdminUrl?: string;
}

interface AdmissionSlipPrintableProps {
  data: AdmissionSlipData;
  onClose?: () => void;
  onGoToPortal?: () => void;
}

export const AdmissionSlipPrintable: React.FC<AdmissionSlipPrintableProps> = ({
  data,
  onClose,
  onGoToPortal
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  // Verification Payload for QR Code
  useEffect(() => {
    const payload = `WITS LINGO ACADEMY - OFFICIAL ADMISSION
Admission ID: ${data.admissionId}
Student: ${data.name}
Father: ${data.fatherName}
Course: ${data.courseName}
Batch: ${data.batchName} (${data.batchCode || 'ACTIVE'})
Status: ${data.paymentStatus} (Verified)
Txn Ref: ${data.txnId}
Verify Online: https://witslingo.com/verify/${data.admissionId}`;

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#2E1065',
        light: '#FFFFFF'
      }
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('QR code generation failed', err));
  }, [data]);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 1. Direct High-Quality PDF Download
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = printableRef.current;
      
      // Render canvas with high scale for crisp vector-like text
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: 1000
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      
      // Standard A4 dimensions in mm: 210 x 297
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Wits_Lingo_Admission_Slip_${data.admissionId}.pdf`);
    } catch (error) {
      console.error('PDF Generation failed:', error);
      alert('Could not generate PDF directly. Please use "Print / Save as PDF".');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Browser Print / Save as PDF
  const handlePrint = () => {
    if (!printableRef.current) return;

    // Create a dedicated clean popup print window to avoid iframe or modal CSS interference
    const printWindow = window.open('', '_blank', 'width=950,height=1100');
    if (!printWindow) {
      // Fallback to standard window.print()
      window.print();
      return;
    }

    const htmlContent = printableRef.current.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admission Slip - ${data.admissionId} - ${data.name}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              background-color: #ffffff;
              color: #0f172a;
              display: flex;
              justify-content: center;
              padding: 20px;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            @media print {
              body {
                padding: 0;
                background: transparent;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
          <!-- Tailwind script for full styling fidelity in the print popup -->
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div style="width: 100%; max-width: 820px;">
            ${htmlContent}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formattedDate = data.registeredAt
    ? new Date(data.registeredAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

  const fallbackWhatsappText = encodeURIComponent(
    `🎓 *WITS LINGO — OFFICIAL ADMISSION SLIP*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Dear *${data.name}*,\n` +
    `Your seat has been confirmed at *WITS LINGO — A Global Language Platform*!\n\n` +
    `📋 *ADMISSION DETAILS*\n` +
    `• Admission ID: ${data.admissionId}\n` +
    `• Student: ${data.name}\n` +
    `• Course: ${data.courseName}\n` +
    `• Batch: ${data.batchName}\n` +
    `• Timings: ${data.batchTiming || 'Daily Live Batch'}\n` +
    `• Fee Status: ${data.paymentStatus} (${data.formattedAmount || '₹' + data.feeAmount})\n` +
    `• Payment Ref: ${data.txnId}\n\n` +
    `🔐 *PORTAL LOGIN CREDENTIALS*\n` +
    `• URL: https://witslingo.com/login\n` +
    `• Username: ${data.username}\n` +
    `• Password: ${data.password || 'WitsLingo@2026'}\n\n` +
    `📞 Mentor Support: ${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}\n` +
    `*WITS LINGO — A Global Language Platform*`
  );

  const rawCleanPhone = (data.whatsapp || data.phone || '').replace(/\D/g, '');
  const recipientDigits = rawCleanPhone.length === 10 ? `91${rawCleanPhone}` : rawCleanPhone;
  const whatsappUrl = data.whatsappStudentUrl || (recipientDigits ? `https://wa.me/${recipientDigits}?text=${fallbackWhatsappText}` : `https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${fallbackWhatsappText}`);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-50/80 p-3.5 rounded-2xl border border-purple-100 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Admission Verified & Active
            </span>
            <span className="font-mono text-xs font-bold text-purple-950">
              Roll ID: {data.admissionId}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Official verifiable admission form. Download as crisp PDF or print directly on the web.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="admission-slip-download-pdf-btn"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Download high-resolution vector PDF admission form"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Admission Form (PDF)</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="admission-slip-print-btn"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            title="Print directly or save as PDF via system dialog"
          >
            <Printer className="w-4 h-4 text-purple-700" />
            <span>Print Form</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THE BEAUTIFUL PRINTABLE ADMISSION SLIP (A4 Layout) */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={printableRef}
          id="wits-lingo-admission-slip"
          className="w-full max-w-[780px] mx-auto bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]"
          style={{ minHeight: '1000px' }}
        >
          {/* Subtle Decorative Background Watermark */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.025] flex items-center justify-center">
            <GraduationCap className="w-[500px] h-[500px] text-purple-900" />
          </div>

          {/* Top Decorative Border */}
          <div className="h-2.5 w-full bg-gradient-to-r from-purple-900 via-indigo-700 to-purple-900 rounded-full mb-2" />

          {/* ACADEMY HEADER */}
          <div className="border-b-2 border-purple-900/20 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Crest / Logo */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B0764] via-[#4A1D96] to-[#6B21A8] flex items-center justify-center text-white shadow-md border-2 border-purple-200 shrink-0">
                  <div className="text-center leading-tight">
                    <GraduationCap className="w-7 h-7 mx-auto text-amber-300" />
                    <span className="font-['Outfit'] text-[9px] font-black tracking-widest text-amber-200 block uppercase">
                      WITS
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-['Outfit'] font-black text-xl sm:text-2xl text-[#2E1065] tracking-tight uppercase">
                      Wits Lingo Academy
                    </h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      Govt. Regd.
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-purple-800 tracking-wide">
                    Premier Institution for Spoken English, Fluency & Communication Excellence
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Amroha, Uttar Pradesh, India - 244221 • Helpline: +91 9876543210 • Email: hello@witslingo.com
                  </p>
                </div>
              </div>

              {/* QR Code with roll badge */}
              <div className="flex sm:flex-col items-center justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 sm:text-right shrink-0">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Digital Admission Verification QR"
                    className="w-20 h-20 border border-purple-200 rounded-lg p-1 bg-white shadow-2xs"
                  />
                ) : (
                  <div className="w-20 h-20 bg-purple-50 rounded-lg animate-pulse" />
                )}
                <span className="text-[9px] font-mono text-slate-500 mt-1 block">
                  Scan to Verify Online
                </span>
              </div>
            </div>

            {/* Banner strip */}
            <div className="mt-3.5 py-1.5 px-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 rounded-xl text-white flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <span className="font-['Outfit'] font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Official Admission Confirmation & Fee Receipt
              </span>
              <span className="text-[11px] font-semibold text-purple-200">
                Academic Session: 2026 – 2027
              </span>
            </div>
          </div>

          {/* KEY REFERENCE IDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission ID</span>
              <span className="font-mono font-black text-purple-950 text-sm">{data.admissionId}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Admission</span>
              <span className="font-bold text-slate-800">{formattedDate}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" /> Confirmed
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Fee Receipt Status</span>
              <span className="font-bold text-emerald-700">Full Payment Verified</span>
            </div>
          </div>

          {/* SECTION 1: STUDENT PROFILE & CONTACT */}
          <div className="space-y-2">
            <h2 className="text-xs font-black font-['Outfit'] tracking-wider uppercase text-purple-950 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <span className="w-4 h-4 rounded-full bg-purple-900 text-white flex items-center justify-center text-[10px]">1</span>
              Student Personal & Contact Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Student Full Name:</span>
                <span className="font-bold text-slate-900 uppercase">{data.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Father's / Guardian's Name:</span>
                <span className="font-bold text-slate-900">{data.fatherName}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Date of Birth:</span>
                <span className="font-semibold text-slate-800">{data.dob}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Gender:</span>
                <span className="font-semibold text-slate-800">{data.gender || 'Not Specified'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Mobile Phone:</span>
                <span className="font-semibold text-slate-900">{data.phone}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">WhatsApp Number:</span>
                <span className="font-semibold text-slate-900">{data.whatsapp}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 sm:col-span-2">
                <span className="text-slate-500 font-medium">Registered Email:</span>
                <span className="font-semibold text-purple-900">{data.email}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 sm:col-span-2">
                <span className="text-slate-500 font-medium">Permanent Location / Address:</span>
                <span className="font-medium text-slate-800 text-right">
                  {data.address ? `${data.address}, ` : ''}
                  {data.district}, {data.state}, {data.country}
                  {data.pincode ? ` - ${data.pincode}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: ENROLLED BATCH & COURSE DETAILS */}
          <div className="space-y-2">
            <h2 className="text-xs font-black font-['Outfit'] tracking-wider uppercase text-purple-950 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <span className="w-4 h-4 rounded-full bg-purple-900 text-white flex items-center justify-center text-[10px]">2</span>
              Course & Enrolled Batch Allocation
            </h2>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Enrolled Program</span>
                <span className="font-bold text-purple-950 text-sm block">{data.courseName}</span>
                <span className="text-[11px] text-slate-500">Live Interactive Speaking Classes + Grammar & Pronunciation</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Allocated Batch</span>
                <span className="font-bold text-slate-900 text-sm block">{data.batchName}</span>
                <span className="font-mono text-[10px] font-bold text-purple-700">Code: {data.batchCode || 'ACTIVE'}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Batch Timing & Schedule</span>
                <span className="font-semibold text-slate-800 block">
                  {data.batchTiming || 'Mon - Fri • Evening Live Interactive Session'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Course Mode & Validity</span>
                <span className="font-semibold text-slate-800 block">
                  Interactive Live Video Classes • Lifetime LMS Access
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3: OFFICIAL FEE RECEIPT & PAYMENT CONFIRMATION */}
          <div className="space-y-2">
            <h2 className="text-xs font-black font-['Outfit'] tracking-wider uppercase text-purple-950 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <span className="w-4 h-4 rounded-full bg-purple-900 text-white flex items-center justify-center text-[10px]">3</span>
              Official Fee Payment Voucher
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Amount Paid</span>
                <span className="font-black text-emerald-900 text-base">
                  {data.formattedAmount || `₹${data.feeAmount}`}
                </span>
                <span className="text-[9px] text-emerald-700 block font-medium">Payment Cleared (100%)</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Payment Mode</span>
                <span className="font-bold text-slate-900 text-xs block truncate">{data.paymentMethod}</span>
                <span className="text-[9px] text-slate-500 block">Digital Receipt Verified</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Transaction Reference / UTR ID</span>
                <span className="font-mono font-bold text-purple-950 text-xs block truncate">{data.txnId}</span>
                <span className="text-[9px] text-slate-500 block">Verified with Payment Gateway</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: STUDENT PORTAL LOGIN CREDENTIALS (HIGHLIGHTED BOX) */}
          <div className="p-4 bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 text-white rounded-2xl shadow-md border-2 border-amber-300/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-white/15 pb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-300" />
                <span className="font-['Outfit'] font-black text-xs uppercase tracking-wider text-amber-200">
                  Student Portal Login Credentials (Purchased Batch Access)
                </span>
              </div>
              <span className="text-[10px] text-white/70">Keep Confidential</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
                <span className="text-[10px] text-purple-200 font-medium block">Portal Username (Email)</span>
                <span className="font-bold text-white text-xs block truncate">{data.email}</span>
                <span className="text-[9px] text-white/60 block mt-0.5">Alt: {data.admissionId}</span>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
                <span className="text-[10px] text-purple-200 font-medium block">Portal Password</span>
                <span className="font-mono font-bold text-amber-300 text-sm block tracking-wider">
                  {data.password || 'WitsLingo@2026'}
                </span>
                <span className="text-[9px] text-white/60 block mt-0.5">Changeable anytime in settings</span>
              </div>

              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-purple-200 font-medium block">Student Portal URL</span>
                  <span className="font-bold text-white text-xs block">witslingo.com/login</span>
                </div>
                <div className="text-[9px] text-amber-200 font-medium mt-1">
                  Access live batch, video lessons & materials
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: INSTRUCTIONS & ACADEMIC CODE */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-800" />
              Important Guidelines for Enrolled Students:
            </h3>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600 pl-1">
              <li>Live class links, syllabus, study PDFs, and assignments are unlocked inside your Student Dashboard.</li>
              <li>A minimum of 80% attendance in live sessions is required for Academy Certification.</li>
              <li>Official batch WhatsApp group link and calendar invites are sent to your registered contact numbers.</li>
              <li>For any academic or technical support, contact helpline <strong>+91 9876543210</strong> or email <strong>hello@witslingo.com</strong>.</li>
            </ul>
          </div>

          {/* SIGNATURE & STAMP FOOTER */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 items-end text-center">
            {/* Student Acknowledgement */}
            <div className="text-center">
              <div className="h-10 border-b border-slate-300 mx-auto w-3/4 mb-1" />
              <span className="text-[10px] font-bold text-slate-700 block uppercase">Student Signature</span>
              <span className="text-[9px] text-slate-400">Accepted Terms of Admission</span>
            </div>

            {/* Official Seal */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-purple-800 flex items-center justify-center p-1 bg-purple-50/50">
                <div className="text-center">
                  <span className="text-[8px] font-black text-purple-950 uppercase block leading-tight">WITS LINGO</span>
                  <GraduationCap className="w-3.5 h-3.5 text-purple-900 mx-auto" />
                  <span className="text-[7px] font-bold text-purple-800 uppercase block">AMROHA, U.P.</span>
                </div>
              </div>
              <span className="text-[9px] font-bold text-purple-900 mt-1 uppercase">Official Stamp</span>
            </div>

            {/* Authorized Signatory */}
            <div className="text-center">
              <div className="h-10 flex items-end justify-center border-b border-slate-300 mx-auto w-3/4 mb-1">
                <span className="font-['Playfair_Display'] italic font-bold text-purple-950 text-sm">
                  Dr. M. R. Siddiqui
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-700 block uppercase">Authorized Registrar</span>
              <span className="text-[9px] text-slate-400">Wits Lingo Academy</span>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
            <span>System Generated Valid Electronic Admission Document</span>
            <span>Document Ref: {data.admissionId} • {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating/Fixed Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 no-print">
        <button
          type="button"
          onClick={() => handleCopy(`${data.email} | ${data.password || 'WitsLingo@2026'}`, 'all-creds')}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {copiedField === 'all-creds' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Credentials Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-purple-700" />
              <span>Copy Login Credentials</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
          )}

          {onGoToPortal && (
            <button
              type="button"
              onClick={onGoToPortal}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <span>Go to My Purchased Batch</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
