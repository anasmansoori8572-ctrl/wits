import React, { useState, useEffect } from 'react';
import { User, Batch, ClassSession, Recording, StudyMaterial, Assignment, Announcement } from '../types';
import { 
  Play, Video, BookOpen, FileText, CheckCircle2, Lock, ShieldCheck, 
  Clock, Calendar, AlertCircle, LogOut, Download, ExternalLink, Sparkles, ChevronRight, Globe,
  Megaphone, Pin, Tag, Eye, MessageCircle, Copy, Check, X, Printer
} from 'lucide-react';
import { AnnouncementModal } from './AnnouncementModal';
import { ProtectedPdfViewer } from './ProtectedPdfViewer';
import { AdmissionSlipPrintable, AdmissionSlipData } from './AdmissionSlipPrintable';

interface StudentDashboardProps {
  currentUser: User;
  token: string;
  onLogout: () => void;
  onBackToHome?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  token,
  onLogout,
  onBackToHome
}) => {
  const studentBatchIds = currentUser.batchIds || currentUser.enrolledBatchIds || [];
  const [selectedBatchId, setSelectedBatchId] = useState<string>(studentBatchIds[0] || '');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<StudyMaterial | null>(null);
  
  // Admission slip & registration state
  const [admissionSlip, setAdmissionSlip] = useState<AdmissionSlipData | null>(null);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [copiedSlipText, setCopiedSlipText] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active secure video playback state
  const [activePlayback, setActivePlayback] = useState<{
    recording: Recording;
    ticket: string;
    streamUrl: string;
  } | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);

  // Fetch announcements for student
  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(d => {
        if (d && d.announcements) setAnnouncements(d.announcements);
      })
      .catch(() => {});
  }, []);

  // Fetch verified admission slip & WhatsApp confirmation links
  useEffect(() => {
    // 1. Check local storage fallback first for instantaneous render
    try {
      const saved = localStorage.getItem('wits_lingo_last_slip');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.admissionId === currentUser.admissionId || parsed.email === currentUser.email || parsed.username === currentUser.email)) {
          setAdmissionSlip(parsed);
        }
      }
    } catch (e) {}

    // 2. Fetch live official admission slip from server
    fetch('/api/student/admission-slip', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.success && d.slip) {
          setAdmissionSlip(d.slip);
          try {
            localStorage.setItem('wits_lingo_last_slip', JSON.stringify(d.slip));
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, [currentUser, token]);

  // Fetch batches & enrolled data
  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      setError(null);

      try {
        const batchRes = await fetch('/api/batches', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!batchRes.ok) throw new Error('Failed to load batches');
        const batchData = await batchRes.json();
        const batchList: Batch[] = Array.isArray(batchData) ? batchData : (batchData.batches || []);
        
        // Filter to only enrolled batches for this student
        const enrolled = studentBatchIds.length > 0
          ? batchList.filter((b: Batch) => studentBatchIds.includes(b.id))
          : batchList;
        setBatches(enrolled);

        if (enrolled.length > 0 && !selectedBatchId) {
          setSelectedBatchId(enrolled[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [currentUser, token]);

  // When selected batch changes, fetch authorized classes, recordings, materials, assignments
  useEffect(() => {
    if (!selectedBatchId) return;

    const fetchBatchResources = async () => {
      try {
        // Classes
        const cRes = await fetch(`/api/batches/${selectedBatchId}/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          setClasses(Array.isArray(cData) ? cData : (cData.classes || []));
        } else {
          setClasses([]);
        }

        // Recordings
        const rRes = await fetch(`/api/batches/${selectedBatchId}/recordings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          setRecordings(Array.isArray(rData) ? rData : (rData.recordings || []));
        } else {
          setRecordings([]);
        }

        // Materials
        const mRes = await fetch(`/api/batches/${selectedBatchId}/materials`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          setMaterials(Array.isArray(mData) ? mData : (mData.materials || []));
        } else {
          setMaterials([]);
        }

        // Assignments
        const aRes = await fetch(`/api/batches/${selectedBatchId}/assignments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (aRes.ok) {
          const aData = await aRes.json();
          setAssignments(Array.isArray(aData) ? aData : (aData.assignments || []));
        } else {
          setAssignments([]);
        }
      } catch (err) {
        console.warn('Could not load some batch resources:', err);
      }
    };

    fetchBatchResources();
  }, [selectedBatchId, token]);

  // Request backend signed playback token for secure recording stream
  const handlePlayRecording = async (rec: Recording) => {
    setLoadingStream(true);
    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/recordings/${rec.id}/stream-ticket`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unauthorized to access this batch recording.');
      }

      setActivePlayback({
        recording: rec,
        ticket: data.playbackTicket,
        streamUrl: data.streamUrl
      });
    } catch (err: any) {
      alert(err.message || 'Access denied. You do not have permissions for this recording.');
    } finally {
      setLoadingStream(false);
    }
  };

  const currentBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <div className="min-h-screen bg-[#F8F6FB] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Student Welcome Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#4A1D96] to-[#6D28D9] text-white flex items-center justify-center font-bold text-xl shadow-md">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-[#4A1D96]">
                  Verified Student Portal
                </span>
                <span className="text-xs text-slate-400">
                  Admission ID: <strong className="font-mono text-slate-700">{currentUser.admissionId || 'WL-ST-2026'}</strong>
                </span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Welcome, {currentUser.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentUser.email} • {currentUser.phone || '+91 7310952271'}
              </p>
            </div>
          </div>

          {/* Batch Selector & Logout */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">

            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="mt-auto sm:mt-5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#4A1D96] border border-purple-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Back to Website</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="mt-auto sm:mt-5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-red-50 text-xs font-bold text-slate-600 hover:text-red-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Official Admission Form & Certificate Card (Web-Based Downloadable Hub) */}
        {admissionSlip && (
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 border-2 border-purple-200/80 rounded-3xl p-5 sm:p-6 shadow-md shadow-purple-900/5 space-y-4 animate-in fade-in-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4A1D96] to-[#6D28D9] text-white flex items-center justify-center shadow-lg shadow-purple-900/20 shrink-0">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-['Outfit'] font-black text-base sm:text-lg text-slate-900">
                      Official Admission Form & Enrollment Record
                    </h3>
                    <span className="bg-[#4A1D96] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-xs">
                      Roll ID: {admissionSlip.admissionId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Course: <strong>{admissionSlip.courseName}</strong> • Timing: <strong>{admissionSlip.batchTiming || 'Daily Live Class'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Fee Verified ({admissionSlip.formattedAmount || '₹' + admissionSlip.feeAmount})</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Primary Download Action */}
              <button
                type="button"
                onClick={() => setShowSlipModal(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-purple-950/20 transition-all active:scale-95 cursor-pointer ring-2 ring-purple-400 ring-offset-2 ring-offset-white"
              >
                <Download className="w-4 h-4" />
                <span>Download Admission Form (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSlipModal(true)}
                className="px-4 py-2.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-purple-700" />
                <span>Print Form</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSlipModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <FileText className="w-4 h-4 text-purple-300" />
                <span>View Full Form on Web</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const txt = `WITS LINGO Official Admission Record\nAdmission Roll ID: ${admissionSlip.admissionId}\nStudent: ${admissionSlip.name}\nCourse: ${admissionSlip.courseName || admissionSlip.batchName}\nUsername: ${admissionSlip.username || currentUser.email}\nFee Status: ${admissionSlip.paymentStatus}\nTxn Ref: ${admissionSlip.txnId}`;
                  navigator.clipboard.writeText(txt);
                  setCopiedSlipText(true);
                  setTimeout(() => setCopiedSlipText(false), 2200);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSlipText ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSlipText ? 'Details Copied!' : 'Copy Roll ID & Details'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Security & Batch Authorization Notice */}
        <div className="bg-purple-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-bold">Strict Course-Level Authorization Active:</span>
              <span className="text-purple-200 ml-1">
                You are securely accessing content for <strong>{currentBatch?.name || 'Your Course'}</strong> only. Cross-course access is prevented at the backend server.
              </span>
            </div>
          </div>
          <span className="text-[10px] bg-white/10 px-2.5 py-1 rounded-md text-purple-200 font-mono">
            Signed URL Security
          </span>
        </div>

        {/* DASHBOARD GRID: Classes, Recordings, Materials */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area (Classes & Recordings) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. Live & Scheduled Classes */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-purple-100 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#4A1D96]" />
                  <h2 className="font-['Outfit'] font-bold text-lg text-slate-900">
                    Live & Scheduled Classes
                  </h2>
                </div>
                <span className="text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full font-bold">
                  {(classes || []).length} Sessions Scheduled
                </span>
              </div>

              <div className="space-y-3">
                {(!classes || classes.length === 0) ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No scheduled sessions found for this course.
                  </p>
                ) : (
                  (classes || []).map((cls) => (
                  <div
                    key={cls.id}
                    className="p-4 rounded-2xl bg-[#FAF9FC] border border-slate-100 hover:border-purple-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cls.status === 'Live' ? 'bg-red-100 text-red-700 animate-pulse' :
                          cls.status === 'Scheduled' || cls.status === 'Upcoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {cls.status === 'Live' ? '● Live Now' : cls.status}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {cls.date} • {cls.time || `${cls.startTime} - ${cls.endTime}`}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900">{cls.title}</h3>
                      <p className="text-xs text-slate-500">{cls.description}</p>
                      <span className="text-[11px] text-purple-700 font-semibold block">
                        Instructor: {cls.instructorName || cls.teacherName}
                      </span>
                    </div>

                    <div className="flex-shrink-0">
                      {cls.status === 'Live' || cls.status === 'Scheduled' || cls.status === 'Upcoming' ? (
                        <a
                          href={cls.joinUrl || 'https://meet.google.com'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Live Class</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-lg">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                )))}
              </div>
            </div>

            {/* 2. Batch Recordings (Signed Stream Gateway) */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-purple-100 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-[#4A1D96]" />
                  <h2 className="font-['Outfit'] font-bold text-lg text-slate-900">
                    Protected Course Recordings
                  </h2>
                </div>
                <span className="text-[11px] text-slate-500">
                  Protected with dynamic tickets
                </span>
              </div>

              {/* Active Player Modal / Box if open */}
              {activePlayback && (
                <div className="p-4 bg-slate-950 rounded-2xl text-white space-y-3 border border-purple-900">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-bold text-slate-200">
                        Secure Playback: {activePlayback.recording.title}
                      </span>
                    </div>
                    <button
                      onClick={() => setActivePlayback(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Close Player ✕
                    </button>
                  </div>

                  <div className="aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 text-center space-y-3 relative">
                    {/* Simulated protected player with watermarked student identity */}
                    <div className="w-16 h-16 rounded-full bg-purple-600/80 flex items-center justify-center text-white shadow-xl animate-pulse">
                      <Play className="w-8 h-8 fill-white ml-1" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{activePlayback.recording.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Duration: {activePlayback.recording.duration} • Authenticated Ticket Valid
                      </p>
                    </div>

                    {/* Security Watermark on video overlay */}
                    <div className="absolute bottom-3 right-4 text-[10px] text-white/30 font-mono select-none pointer-events-none">
                      Wits Lingo Protected • {currentUser.email} • {activePlayback.ticket.slice(0, 10)}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-purple-300">
                    <span>Direct downloads are disabled for intellectual property security.</span>
                    <span className="text-emerald-400 font-mono">Status: Stream Authorized</span>
                  </div>
                </div>
              )}

              {/* Recordings List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(!recordings || recordings.length === 0) ? (
                  <p className="text-xs text-slate-400 py-6 col-span-1 sm:col-span-2 text-center">
                    No class recordings published for this course yet.
                  </p>
                ) : (
                  (recordings || []).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl bg-[#FAF9FC] border border-slate-100 hover:border-purple-200 transition-all flex flex-col justify-between group space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-purple-800 bg-purple-50 px-2 py-0.5 rounded font-semibold">
                          {rec.recordedDate || rec.date}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {rec.duration}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 line-clamp-2">
                        {rec.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {rec.description || rec.notesSummary || 'Class recording session'}
                      </p>
                    </div>

                    <button
                      onClick={() => handlePlayRecording(rec)}
                      disabled={loadingStream}
                      className="w-full py-2 px-3 rounded-xl bg-purple-100 hover:bg-[#4A1D96] text-[#4A1D96] hover:text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{loadingStream ? 'Requesting...' : 'Play Secure Recording'}</span>
                    </button>
                  </div>
                )))}
              </div>
            </div>

          </div>

          {/* Right Sidebar Area (Notices, Materials & Assignments) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Course & Academy Notices */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                    <Megaphone className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                    Notices & Holidays
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-[#4A1D96] bg-purple-50 px-2 py-0.5 rounded-full">
                  Official
                </span>
              </div>

              {(() => {
                const relevantNotices = announcements.filter(a => 
                  !a.batchId || a.batchId === 'all' || a.batchId === selectedBatchId || studentBatchIds.includes(a.batchId)
                );

                if (relevantNotices.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No active notices for this course today.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {relevantNotices.slice(0, 3).map((notice) => (
                      <div
                        key={notice.id}
                        onClick={() => setSelectedAnnouncement(notice)}
                        className="p-3.5 rounded-xl bg-purple-50/40 hover:bg-purple-50 border border-purple-100/70 transition-all cursor-pointer group space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            notice.category === 'Holiday'
                              ? 'bg-amber-100 text-amber-800'
                              : notice.priority === 'Urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {notice.category || 'Notice'}
                          </span>
                          {notice.effectiveDate && (
                            <span className="text-[10px] font-medium text-slate-500">
                              {notice.effectiveDate}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-[#4A1D96] transition-colors line-clamp-1">
                          {notice.title}
                        </h4>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {notice.message}
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-[#4A1D96]">
                          <span>Click to read full circular</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Course Materials (PDFs) */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#4A1D96]" />
                  <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                    Course Materials (PDFs)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">{(materials || []).length} Files</span>
              </div>

              <div className="space-y-2.5">
                {(!materials || materials.length === 0) ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No study materials uploaded for this course yet.
                  </p>
                ) : (
                  (materials || []).map((mat) => (
                  <div
                    key={mat.id}
                    className="p-3 rounded-xl bg-[#FAF9FC] border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h5 className="font-bold text-slate-800 break-words">{mat.title}</h5>
                        {mat.allowDownload ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 flex items-center gap-0.5 flex-shrink-0">
                            <Download className="w-2 h-2" />
                            <span>Downloadable</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 flex items-center gap-0.5 flex-shrink-0">
                            <Lock className="w-2 h-2" />
                            <span>View-Only</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{mat.fileSize} • {mat.uploadedDate || mat.uploadedAt}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setViewingMaterial(mat)}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-[#4A1D96] text-[#4A1D96] hover:text-white border border-purple-200 hover:border-[#4A1D96] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Read in Protected View-Only Reader"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View PDF</span>
                      </button>

                      {mat.allowDownload && (
                        <a
                          href={`${mat.downloadUrl && mat.downloadUrl !== '#' ? mat.downloadUrl : `/api/files/download/${mat.id}`}?token=${encodeURIComponent(token)}`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="Download PDF File"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                )))}
              </div>
            </div>

            {/* Course Assignments */}
            <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#4A1D96]" />
                  <h3 className="font-['Outfit'] font-bold text-base text-slate-900">
                    Speaking Assignments
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-600 font-bold">Active</span>
              </div>

              <div className="space-y-3">
                {(!assignments || assignments.length === 0) ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No active assignments assigned yet.
                  </p>
                ) : (
                  (assignments || []).map((asgn) => (
                  <div
                    key={asgn.id}
                    className="p-3.5 rounded-xl bg-[#FAF9FC] border border-slate-100 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{asgn.title}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                        Due: {asgn.dueDate}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {asgn.description}
                    </p>
                    <button
                      onClick={() => alert('Assignment submission portal: Submit your 2-minute WhatsApp audio recording to the course instructor.')}
                      className="w-full py-1.5 rounded-lg bg-white border border-purple-200 text-[#4A1D96] text-[11px] font-bold hover:bg-purple-50 transition-colors"
                    >
                      Submit Audio Task
                    </button>
                  </div>
                )))}
              </div>
            </div>

            {/* Official Admission Details Card */}
            <div className="bg-gradient-to-br from-[#3B0764] to-[#4A1D96] text-white rounded-3xl p-6 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300">
                  Student Verification
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-purple-200">Enrolled Student</p>
                <h4 className="font-bold text-base">{currentUser.name}</h4>
                <p className="text-xs text-purple-200 mt-1">
                  Enrolled in Active Course
                </p>
              </div>
              <div className="pt-2 border-t border-white/10 text-[11px] text-purple-200 space-y-1">
                <p>Support WhatsApp: +91 7310952271</p>
                <p>Email: hello@witslingo.com</p>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Notice Popup Circular Modal */}
      {selectedAnnouncement && (
        <AnnouncementModal
          isOpen={Boolean(selectedAnnouncement)}
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

      {/* View-Only Protected PDF Viewer */}
      {viewingMaterial && (
        <ProtectedPdfViewer
          isOpen={Boolean(viewingMaterial)}
          onClose={() => setViewingMaterial(null)}
          title={viewingMaterial.title}
          pdfUrl={viewingMaterial.pdfUrl || viewingMaterial.downloadUrl}
          category="Course Study Material"
          batchName={batches.find(b => b.id === selectedBatchId)?.name || 'Spoken English Batch'}
          studentName={currentUser.name}
          description={viewingMaterial.description}
          allowDownload={Boolean(viewingMaterial.allowDownload)}
        />
      )}

      {/* Official Admission Slip Modal */}
      {showSlipModal && admissionSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain smooth-scroll-viewport">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-purple-100 overflow-hidden my-auto animate-in zoom-in-95 overscroll-contain">
            <div className="bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white p-4 sm:p-6 flex items-center justify-between">
              <div>
                <h3 className="font-['Outfit'] font-extrabold text-lg sm:text-xl">
                  Official Student Admission Slip
                </h3>
                <p className="text-xs text-purple-200">
                  Roll ID: {admissionSlip.admissionId} • Verified Registration
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-7 max-h-[75vh] overflow-y-auto smooth-scroll-viewport">
              <AdmissionSlipPrintable
                data={admissionSlip}
                onClose={() => setShowSlipModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
