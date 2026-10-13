import React, { useState, useEffect } from 'react';
import { User, Batch, ClassSession, Recording, StudyMaterial, CourseData, TestimonialData, SiteSettings, Announcement, GalleryItem } from '../types';
import { 
  Users, Layers, Video, Play, FileText, Settings, Plus, Trash2, 
  Edit3, CheckCircle2, Download, Search, ShieldCheck, LogOut, 
  ExternalLink, Filter, ArrowLeft, Save, Globe, MessageSquare, 
  X, Check, AlertTriangle, Phone, Mail, MapPin, Eye, EyeOff, RefreshCw,
  Megaphone, Pin, Clock, Calendar, Tag, Lock, Sparkles, Link as LinkIcon, BookOpen, Bell,
  Landmark, CreditCard, Cloud, Film, UploadCloud, Copy, PlayCircle,
  Image as ImageIcon, Images, ArrowUp, ArrowDown, FolderPlus, Youtube,
  AlertCircle
} from 'lucide-react';
import { AdminAutomationTabs } from './AdminAutomationTabs';
import { AnnouncementModal } from './AnnouncementModal';
import { ProtectedPdfViewer } from './ProtectedPdfViewer';
import { PdfUploadInput } from './PdfUploadInput';
import { optimizePdfUrl } from '../utils/pdfOptimizer';
import { useScrollLock } from '../hooks/useScrollLock';
import { CountryCodePhoneInput } from './CountryCodePhoneInput';
import { CountryPhoneCode, DEFAULT_COUNTRY_CODE, ALL_COUNTRY_PHONE_CODES } from '../data/countryPhoneCodes';
import { AddressHierarchySelector } from './AddressHierarchySelector';

export type AdminTabType = 'students' | 'courses' | 'batches' | 'classes' | 'recordings' | 'materials' | 'youtube-lessons' | 'hero-video' | 'gallery' | 'testimonials' | 'announcements' | 'settings' | 'orders-payments' | 'whatsapp-notifications' | 'support-tickets' | 'knowledge-base';

function extractYouTubeVideoId(url?: string): string {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return (match && match[1]) ? match[1] : '';
}

interface AdminPanelProps {
  currentUser: User;
  token: string;
  onLogout: () => void;
  onBackToHome?: () => void;
  onOpenSystemReport?: () => void;
  courses: CourseData[];
  onUpdateCourses: (courses: CourseData[]) => void;
  batches: Batch[];
  onUpdateBatches: (batches: Batch[]) => void;
  testimonials: TestimonialData[];
  onUpdateTestimonials: (testimonials: TestimonialData[]) => void;
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (settings: SiteSettings) => void;
  announcements?: Announcement[];
  onUpdateAnnouncements?: (announcements: Announcement[]) => void;
  materials?: StudyMaterial[];
  onUpdateMaterials?: (materials: StudyMaterial[]) => void;
  initialTab?: AdminTabType;
  onTabChange?: (tab: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  token,
  onLogout,
  onBackToHome,
  onOpenSystemReport,
  courses,
  onUpdateCourses,
  batches,
  onUpdateBatches,
  testimonials,
  onUpdateTestimonials,
  siteSettings,
  onUpdateSiteSettings,
  announcements = [],
  onUpdateAnnouncements,
  materials: externalMaterials = [],
  onUpdateMaterials,
  initialTab,
  onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabType>(initialTab || 'students');

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSelect = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      try {
        window.history.pushState(null, '', `/admin/${tabId}`);
      } catch (e) {}
    }
  };
  
  // Data states
  const [students, setStudents] = useState<any[]>([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('All');
  const [searchStudent, setSearchStudent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Gallery Management States
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState('all');
  const [galleryPublishFilter, setGalleryPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [showAddGalleryModal, setShowAddGalleryModal] = useState(false);
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [previewGalleryItem, setPreviewGalleryItem] = useState<GalleryItem | null>(null);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<Array<{ file: File; preview: string; title: string; caption: string; category: string }>>([]);

  // Hero Video Control States
  const [customHeroVideoUrl, setCustomHeroVideoUrl] = useState<string>(siteSettings.heroVideoUrl || '');
  const [simulatedHeroOverlay, setSimulatedHeroOverlay] = useState<boolean>(true);
  const [selectedHeroFile, setSelectedHeroFile] = useState<File | null>(null);
  const [copiedHeroUrl, setCopiedHeroUrl] = useState<boolean>(false);

  // Class, Recording, Material state
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => {
    if (externalMaterials && externalMaterials.length > 0) return externalMaterials;
    try {
      const saved = localStorage.getItem('wits_lingo_materials');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    if (externalMaterials && externalMaterials.length > 0) {
      setMaterials(externalMaterials);
    }
  }, [externalMaterials]);

  // Modals state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseData | null>(null);
  const [courseVisibilityFilter, setCourseVisibilityFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseLevelFilter, setCourseLevelFilter] = useState('all');
  const [newBulletPointForEdit, setNewBulletPointForEdit] = useState('');
  const [newBulletPointForAdd, setNewBulletPointForAdd] = useState('');
  const [newFacilityForEdit, setNewFacilityForEdit] = useState('');
  const [newFacilityForAdd, setNewFacilityForAdd] = useState('');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchVisibilityFilter, setBatchVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [showAddRecordingModal, setShowAddRecordingModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<StudyMaterial | null>(null);
  const [previewingPdfMaterial, setPreviewingPdfMaterial] = useState<{ title: string; pdfUrl?: string; description?: string; category?: string; batchName?: string } | null>(null);
  const [materialFilterBatch, setMaterialFilterBatch] = useState<string>('all');
  const [materialSubTab, setMaterialSubTab] = useState<'pdf' | 'youtube'>('pdf');
  const [materialSearchQuery, setMaterialSearchQuery] = useState<string>('');
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState<string>('all');
  const [showAddYouTubeModal, setShowAddYouTubeModal] = useState(false);
  const [isFetchingYtMetadata, setIsFetchingYtMetadata] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [showAddTestimonialModal, setShowAddTestimonialModal] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialData | null>(null);

  // Delete Confirmation Modal State (Safe for sandboxed iframes - never blocks)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemType: string;
    description?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isUploadingHeroVideo, setIsUploadingHeroVideo] = useState(false);

  // Central Website Logo Management state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPreviewBg, setLogoPreviewBg] = useState<'light' | 'dark'>('dark');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // Announcements & Holiday Notices state
  const [localAnnouncements, setLocalAnnouncements] = useState<Announcement[]>(announcements || []);
  const [showAddAnnouncementModal, setShowAddAnnouncementModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [previewingAnnouncement, setPreviewingAnnouncement] = useState<Announcement | null>(null);
  const [announcementFilter, setAnnouncementFilter] = useState<string>('all');

  const [newAnnouncement, setNewAnnouncement] = useState<{
    title: string;
    category: 'Holiday' | 'Class Notice' | 'Schedule Change' | 'Urgent Alert' | 'Exam / Test' | 'General';
    batchId: string;
    priority: 'Normal' | 'Important' | 'Urgent';
    effectiveDate: string;
    message: string;
    isPinned: boolean;
  }>({
    title: '',
    category: 'Holiday',
    batchId: 'all',
    priority: 'Important',
    effectiveDate: '',
    message: '',
    isPinned: false
  });

  // Lock background body scroll whenever any admin modal/overlay is open
  const isAnyAdminModalOpen = Boolean(
    showAddStudentModal ||
    editingStudent ||
    showAddCourseModal ||
    editingCourse ||
    showAddBatchModal ||
    editingBatch ||
    showAddClassModal ||
    editingClass ||
    showAddRecordingModal ||
    showAddMaterialModal ||
    showAddYouTubeModal ||
    editingMaterial ||
    previewingPdfMaterial ||
    showAddTestimonialModal ||
    editingTestimonial ||
    showAddAnnouncementModal ||
    editingAnnouncement ||
    previewingAnnouncement ||
    showAddGalleryModal ||
    editingGalleryItem ||
    previewGalleryItem ||
    deleteModal
  );
  useScrollLock(isAnyAdminModalOpen);

  useEffect(() => {
    if (announcements && announcements.length > 0) {
      setLocalAnnouncements(announcements);
    }
  }, [announcements]);

  const updateAllAnnouncements = (newAnns: Announcement[]) => {
    setLocalAnnouncements(newAnns);
    if (onUpdateAnnouncements) {
      onUpdateAnnouncements(newAnns);
    }
  };

  // Form states for new additions
  const [adminPhoneCountry, setAdminPhoneCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [adminWhatsappCountry, setAdminWhatsappCountry] = useState<CountryPhoneCode>(DEFAULT_COUNTRY_CODE);
  const [newStudent, setNewStudent] = useState({
    name: '',
    fatherName: '',
    dob: '2000-01-01',
    phone: '',
    whatsapp: '',
    email: '',
    country: 'India',
    state: 'Uttar Pradesh',
    district: 'Amroha',
    pincode: '244221',
    address: '',
    batchId: batches[0]?.id || 'batch-spoken-oct-2026',
    courseId: courses[0]?.id || 'course-spoken-english'
  });

  const [newCourse, setNewCourse] = useState<Partial<CourseData>>({
    name: '',
    level: 'Beginner to Intermediate',
    shortDescription: '',
    whatYouWillLearn: ['Master natural conversational speaking', 'Overcome public hesitation and stage fear', 'Daily vocabulary in context', 'Pronunciation and accent clarity'],
    facilities: [
      'Live Interactive Online Classes on Google Meet',
      'Digital PDF Study Notes & Practice Workbooks',
      'Telegram & WhatsApp Student Practice Community',
      'Course Completion Certificate',
      'Class Recording Access for Revision'
    ],
    duration: '2 Months (40 Sessions)',
    learningFormat: 'Live Online Classroom (Evening Batches)',
    fee: 1499,
    badge: 'Popular'
  });

  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    name: '',
    batchCode: '',
    courseId: courses[0]?.id || 'course-spoken-english',
    courseName: courses[0]?.name || 'Spoken English',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    scheduleTime: '07:30 PM - 08:30 PM IST (Mon, Wed, Fri)',
    maxCapacity: 35,
    maxStudents: 35,
    currentStudentsCount: 0,
    enrolledCount: 0,
    status: 'Upcoming',
    teacherName: 'Ziyaur Rehman Zia',
    isVisibleOnWebsite: true,
    googleMeetLink: ''
  });

  const [newClass, setNewClass] = useState({
    batchId: batches[0]?.id || 'batch-spoken-oct-2026',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '07:30 PM - 08:30 PM IST',
    joinUrl: 'https://meet.google.com/wits-lingo-live',
    instructorName: 'Ziyaur Rehman Zia'
  });

  const [newRecording, setNewRecording] = useState({
    batchId: batches[0]?.id || 'batch-spoken-oct-2026',
    title: '',
    topic: 'Spoken English Practice',
    duration: '60 min',
    videoUrl: 'https://www.youtube.com',
    recordedDate: new Date().toLocaleDateString('en-GB'),
    description: 'Auto-synced class recording for enrolled students.'
  });

  const [newMaterial, setNewMaterial] = useState({
    batchId: 'all',
    title: '',
    description: 'Practical PDF notes & daily vocabulary drill sheet.',
    fileType: 'pdf',
    fileSize: '1.8 MB',
    downloadUrl: '',
    pdfUrl: '',
    b2FileId: '',
    b2FileName: '',
    mimeType: 'application/pdf',
    isViewOnly: true,
    allowDownload: false,
    category: 'Worksheets',
    level: 'All Levels',
    isVisibleOnWebsite: true,
    isPublished: true,
    displayOrder: 1
  });

  const [newYouTubeResource, setNewYouTubeResource] = useState({
    youtubeUrl: '',
    title: '',
    description: 'Watch this video lesson for practical spoken English fluency.',
    category: 'Daily English',
    displayOrder: 1,
    isPublished: true,
    duration: '',
    thumbnailUrl: '',
    b2ThumbnailId: '',
    b2ThumbnailName: ''
  });

  const [newTestimonial, setNewTestimonial] = useState<Partial<TestimonialData>>({
    studentName: '',
    courseBatch: 'Spoken English • Batch 01',
    city: 'Amroha, UP',
    testimonial: '',
    verified: true
  });

  // Local site settings copy for CMS editing
  const [localSettings, setLocalSettings] = useState<SiteSettings>({ ...siteSettings });

  // YouTube Channel URL & Management states
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState<string>(() => {
    return siteSettings.youtubeUrl || 'https://www.youtube.com/@witslingoeng';
  });
  const [isSavingYoutubeChannel, setIsSavingYoutubeChannel] = useState(false);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeCategoryFilter, setYoutubeCategoryFilter] = useState('all');
  const [youtubePublishFilter, setYoutubePublishFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Sync YouTube channel input if siteSettings changes from outside
  useEffect(() => {
    if (siteSettings.youtubeUrl) {
      setYoutubeChannelUrl(siteSettings.youtubeUrl);
    }
  }, [siteSettings.youtubeUrl]);

  // Show transient feedback message
  const triggerFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleSaveYoutubeChannel = async () => {
    if (!youtubeChannelUrl.trim()) {
      alert('Please enter a valid YouTube channel URL.');
      return;
    }
    setIsSavingYoutubeChannel(true);
    try {
      const updatedSettings: SiteSettings = {
        ...localSettings,
        youtubeUrl: youtubeChannelUrl.trim()
      };
      setLocalSettings(updatedSettings);
      onUpdateSiteSettings(updatedSettings);
      localStorage.setItem('wits_lingo_site_settings', JSON.stringify(updatedSettings));

      const res = await fetch('/api/cms/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: {
            youtubeUrl: youtubeChannelUrl.trim()
          }
        })
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('wits_lingo_settings_updated', { detail: updatedSettings }));
        window.dispatchEvent(new Event('storage'));
        triggerFeedback('Official YouTube Channel URL saved successfully!');
      } else {
        triggerFeedback('Channel URL saved locally.');
      }
    } catch (err) {
      console.warn('Could not save YouTube channel URL:', err);
      triggerFeedback('Channel URL saved locally.');
    } finally {
      setIsSavingYoutubeChannel(false);
    }
  };

  // Load initial admin data
  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      // 1. Batches
      const bRes = await fetch('/api/batches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        if (Array.isArray(bData) && bData.length > 0) {
          onUpdateBatches(bData);
        }
      }

      // 2. Students
      const sRes = await fetch('/api/admin/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        setStudents(sData.students || []);
      }

      // 3. Classes
      const cRes = await fetch('/api/batches/batch-spoken-oct-2026/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (cRes.ok) {
        const cData = await cRes.json();
        setClasses(Array.isArray(cData) ? cData : (cData.classes || []));
      }

      // 4. Study Materials
      const mRes = await fetch('/api/admin/materials', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        const loaded = Array.isArray(mData) ? mData : (mData.materials || []);
        setMaterials(loaded);
        if (onUpdateMaterials) onUpdateMaterials(loaded);
        try {
          localStorage.setItem('wits_lingo_materials', JSON.stringify(loaded));
        } catch (e) {}
      }

      // 5. Gallery Items
      const gRes = await fetch('/api/admin/gallery', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.success && Array.isArray(gData.items)) {
          setGalleryItems(gData.items);
        }
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------
  // 1. STUDENTS / ADMISSIONS HANDLERS
  // ----------------------------------------------------------------------
  const filteredStudents = students.filter((st) => {
    const matchesBatch = selectedBatchFilter === 'All' || 
      st.batchId === selectedBatchFilter || 
      (st.enrolledBatchIds && st.enrolledBatchIds.includes(selectedBatchFilter));
    const matchesSearch = 
      st.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      st.district?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      st.phone?.includes(searchStudent) ||
      st.admissionId?.toLowerCase().includes(searchStudent.toLowerCase());
    return matchesBatch && matchesSearch;
  });

  const handleDeleteStudent = (studentId: string, name: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Student Admission',
      itemName: name,
      itemType: 'student admission record',
      description: `Are you sure you want to delete the admission record for "${name}" (${studentId})? This student will be removed from all enrolled batch rosters and portal access.`,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/students/${studentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (err) {
          console.error('Delete student error', err);
        }
        setStudents(prev => prev.filter(s => s.id !== studentId && s.admissionId !== studentId));
        triggerFeedback(`Student admission for "${name}" deleted.`);
      }
    });
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await fetch(`/api/admin/students/${editingStudent.id || editingStudent.admissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editingStudent)
      });
      setStudents(prev => prev.map(s => (s.id === editingStudent.id ? editingStudent : s)));
      setEditingStudent(null);
      triggerFeedback('Student admission details updated successfully.');
    } catch (err) {
      setStudents(prev => prev.map(s => (s.id === editingStudent.id ? editingStudent : s)));
      setEditingStudent(null);
      triggerFeedback('Student details saved.');
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newStudent.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('Mobile Phone Number is required and must be exactly 10 digits.');
      return;
    }
    const cleanWhatsapp = (newStudent.whatsapp || '').replace(/\D/g, '');
    if (cleanWhatsapp.length !== 10) {
      alert('WhatsApp Number is required and must be exactly 10 digits.');
      return;
    }
    const createdId = `reg-${Date.now()}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const admissionId = `WL-OCT26-${randomSeq}`;
    const targetBatch = batches.find(b => b.id === newStudent.batchId);
    const targetCourse = courses.find(c => c.id === newStudent.courseId);

    const record = {
      id: createdId,
      admissionId,
      name: newStudent.name.trim(),
      fatherName: newStudent.fatherName.trim(),
      dob: newStudent.dob,
      phone: `${adminPhoneCountry.dialCode} ${cleanPhone}`,
      whatsapp: `${adminWhatsappCountry.dialCode} ${cleanWhatsapp}`,
      email: newStudent.email.trim().toLowerCase(),
      country: newStudent.country || 'India',
      district: newStudent.district.trim(),
      state: newStudent.state.trim(),
      pincode: newStudent.pincode.trim(),
      address: newStudent.address || `${newStudent.district}, ${newStudent.state}, ${newStudent.country}`,
      batchId: newStudent.batchId,
      batchName: targetBatch?.name || 'Spoken English Batch',
      enrolledBatchIds: [newStudent.batchId],
      courseId: newStudent.courseId,
      courseName: targetCourse?.name || 'Spoken English',
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Cash / Manual Admission',
      registeredAt: new Date().toISOString()
    };

    setStudents([record, ...students]);
    setShowAddStudentModal(false);
    setNewStudent({
      name: '',
      fatherName: '',
      dob: '2000-01-01',
      phone: '',
      whatsapp: '',
      email: '',
      country: 'India',
      state: 'Uttar Pradesh',
      district: 'Amroha',
      pincode: '244221',
      address: '',
      batchId: batches[0]?.id || 'batch-spoken-oct-2026',
      courseId: courses[0]?.id || 'course-spoken-english'
    });
    triggerFeedback(`Student "${record.name}" admitted successfully! (Admission ID: ${admissionId})`);
  };

  const handleExportCSV = () => {
    const headers = ['Admission ID', 'Student Name', "Father's Name", 'DOB', 'Country', 'State', 'District', 'PIN / Postal Code', 'Phone', 'WhatsApp', 'Email', 'Batch', 'Fee Status'];
    const rows = filteredStudents.map(s => [
      s.admissionId || '',
      `"${s.name || ''}"`,
      `"${s.fatherName || ''}"`,
      s.dob || '',
      `"${s.country || 'India'}"`,
      `"${s.state || ''}"`,
      `"${s.district || ''}"`,
      `"${s.pincode || ''}"`,
      s.phone || '',
      s.whatsapp || '',
      s.email || '',
      `"${s.batchName || (s.enrolledBatchIds ? s.enrolledBatchIds.join(', ') : '')}"`,
      s.paymentStatus || 'Paid'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Wits_Lingo_Students_${selectedBatchFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResendWhatsApp = async (studentId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/students/${studentId}/resend-whatsapp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerFeedback(`✓ WhatsApp enrollment message sent successfully! (Message ID: ${data.messageId || 'Delivered'})`);
        setStudents(prev => prev.map(s => (s.id === studentId || s.admissionId === studentId) ? { ...s, whatsappDeliveryStatus: 'sent', whatsappMessageId: data.messageId } : s));
      } else {
        triggerFeedback(`⚠ WhatsApp dispatch notice: ${data.error || 'Check server WhatsApp Cloud API configuration'}`);
        setStudents(prev => prev.map(s => (s.id === studentId || s.admissionId === studentId) ? { ...s, whatsappDeliveryStatus: 'failed', whatsappError: data.error } : s));
      }
    } catch (err: any) {
      triggerFeedback(`⚠ Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------
  // 2. COURSES CMS HANDLERS (Editable at any time, past or post publication)
  // ----------------------------------------------------------------------
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.name) return;
    const courseToAdd: CourseData = {
      id: `course-${newCourse.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name: newCourse.name,
      level: newCourse.level || 'Beginner to Intermediate',
      shortDescription: newCourse.shortDescription || 'Practical language training.',
      whatYouWillLearn: Array.isArray(newCourse.whatYouWillLearn) && newCourse.whatYouWillLearn.length > 0
        ? newCourse.whatYouWillLearn
        : ['Master natural conversational speaking', 'Overcome public hesitation and stage fear', 'Daily vocabulary in context', 'Pronunciation and accent clarity'],
      facilities: Array.isArray(newCourse.facilities) && newCourse.facilities.length > 0
        ? newCourse.facilities
        : [
            'Live Interactive Online Classes on Google Meet',
            'Digital PDF Study Notes & Practice Workbooks',
            'Telegram & WhatsApp Student Practice Community',
            'Course Completion Certificate',
            'Class Recording Access for Revision'
          ],
      duration: newCourse.duration || '2 Months (40 Sessions)',
      learningFormat: newCourse.learningFormat || 'Live Online Classroom',
      fee: Number(newCourse.fee) || 1499,
      badge: newCourse.badge || '',
      isPublished: newCourse.isPublished !== false
    };
    const updated = [...courses, courseToAdd];
    onUpdateCourses(updated);
    setShowAddCourseModal(false);
    setNewBulletPointForAdd('');
    setNewFacilityForAdd('');
    triggerFeedback(
      courseToAdd.isPublished
        ? `New course "${courseToAdd.name}" published live to website!`
        : `New course "${courseToAdd.name}" saved as draft (unpublished).`
    );
  };

  const handleSaveEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    const updated = courses.map(c => c.id === editingCourse.id ? editingCourse : c);
    onUpdateCourses(updated);
    setEditingCourse(null);
    setNewBulletPointForEdit('');
    setNewFacilityForEdit('');
    triggerFeedback(`Course "${editingCourse.name}" changes saved successfully! (Status: ${editingCourse.isPublished !== false ? 'Live Published' : 'Draft / Unpublished'})`);
  };

  const handleTogglePublishCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    const nextStatus = !(course.isPublished !== false);
    const updated = courses.map(c => c.id === courseId ? { ...c, isPublished: nextStatus } : c);
    onUpdateCourses(updated);
    triggerFeedback(
      nextStatus
        ? `Course "${course.name}" is now LIVE on website (Published)!`
        : `Course "${course.name}" is now UNPUBLISHED (Saved as Draft, hidden from public visitors).`
    );
  };

  const handleDeleteCourse = (courseId: string, name: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Course',
      itemName: name,
      itemType: 'course',
      description: `Are you sure you want to permanently delete course "${name}" from the academy catalog? This action cannot be undone.`,
      onConfirm: () => {
        const updated = courses.filter(c => c.id !== courseId);
        onUpdateCourses(updated);
        triggerFeedback(`Course "${name}" deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 3. BATCHES HANDLERS
  // ----------------------------------------------------------------------
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.name || !newBatch.batchCode) return;
    const batchToAdd: Batch = {
      id: `batch-${newBatch.batchCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name: newBatch.name,
      batchCode: newBatch.batchCode,
      courseId: newBatch.courseId || courses[0]?.id || 'course-spoken-english',
      courseName: newBatch.courseName || courses[0]?.name || 'Spoken English',
      startDate: newBatch.startDate || '2026-10-01',
      endDate: newBatch.endDate || '2026-12-31',
      scheduleTime: newBatch.scheduleTime || '07:30 PM - 08:30 PM IST',
      maxCapacity: Number(newBatch.maxCapacity) || 35,
      maxStudents: Number(newBatch.maxCapacity) || 35,
      currentStudentsCount: 0,
      enrolledCount: 0,
      status: newBatch.status || 'Upcoming',
      teacherName: newBatch.teacherName || 'Ziyaur Rehman Zia',
      isVisibleOnWebsite: newBatch.isVisibleOnWebsite !== false,
      googleMeetLink: newBatch.googleMeetLink || ''
    };

    try {
      await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(batchToAdd)
      });
    } catch (e) {}

    const updated = [batchToAdd, ...batches];
    onUpdateBatches(updated);
    setShowAddBatchModal(false);
    setNewBatch({
      name: '',
      batchCode: '',
      courseId: courses[0]?.id || 'course-spoken-english',
      courseName: courses[0]?.name || 'Spoken English',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2026-12-31',
      scheduleTime: '07:30 PM - 08:30 PM IST (Mon, Wed, Fri)',
      maxCapacity: 35,
      maxStudents: 35,
      currentStudentsCount: 0,
      enrolledCount: 0,
      status: 'Upcoming',
      teacherName: 'Ziyaur Rehman Zia',
      isVisibleOnWebsite: true,
      googleMeetLink: ''
    });
    triggerFeedback(`Batch "${batchToAdd.name}" created.`);
  };

  const handleToggleBatchVisibility = async (batchId: string) => {
    const target = batches.find(b => b.id === batchId);
    if (!target) return;
    const nextState = !(target.isVisibleOnWebsite !== false);
    const updatedBatch: Batch = {
      ...target,
      isVisibleOnWebsite: nextState
    };
    try {
      await fetch(`/api/admin/batches/${batchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedBatch)
      });
    } catch (e) {}
    const updated = batches.map(b => b.id === batchId ? updatedBatch : b);
    onUpdateBatches(updated);
    triggerFeedback(
      nextState
        ? `Batch "${target.name}" is now VISIBLE on website.`
        : `Batch "${target.name}" is now HIDDEN from website.`
    );
  };

  const handleToggleShowBatchesSection = async () => {
    const nextState = !(localSettings.showBatchesSection ?? true);
    const updatedSettings: SiteSettings = {
      ...localSettings,
      showBatchesSection: nextState
    };
    setLocalSettings(updatedSettings);
    onUpdateSiteSettings(updatedSettings);
    try {
      await fetch('/api/cms/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          showBatchesSection: nextState,
          settings: updatedSettings
        })
      });
    } catch (e) {}
    triggerFeedback(
      nextState
        ? 'Batches & Seat Capacity section is now VISIBLE on public website!'
        : 'Batches & Seat Capacity section is now HIDDEN from public website.'
    );
  };

  const handleSaveEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    try {
      await fetch(`/api/admin/batches/${editingBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editingBatch)
      });
    } catch (e) {}
    const updated = batches.map(b => b.id === editingBatch.id ? editingBatch : b);
    onUpdateBatches(updated);
    setEditingBatch(null);
    triggerFeedback(`Batch "${editingBatch.name}" updated.`);
  };

  const handleDeleteBatch = (batchId: string, name: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Batch',
      itemName: name,
      itemType: 'batch',
      description: `Are you sure you want to delete batch "${name}"? Active schedules and class rosters associated with this batch will be impacted.`,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/batches/${batchId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
        const updated = batches.filter(b => b.id !== batchId);
        onUpdateBatches(updated);
        triggerFeedback(`Batch "${name}" deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 4. LIVE CLASSES HANDLERS
  // ----------------------------------------------------------------------
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const created: ClassSession = {
      id: `cls-${Date.now()}`,
      batchId: newClass.batchId,
      batchName: batches.find(b => b.id === newClass.batchId)?.name || 'Spoken English Batch',
      title: newClass.title,
      topic: 'Live English Session',
      classNumber: classes.length + 1,
      startTime: '07:30 PM',
      endTime: '08:30 PM',
      durationMinutes: 60,
      teacherName: newClass.instructorName || 'Ziyaur Rehman Zia',
      description: newClass.description || 'Live interactive session.',
      date: newClass.date,
      time: newClass.time,
      status: 'Upcoming',
      joinUrl: newClass.joinUrl,
      instructorName: newClass.instructorName,
      hasStudyMaterial: false,
      hasAssignment: false
    };
    try {
      await fetch(`/api/admin/batches/${newClass.batchId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(created)
      });
    } catch (e) {}
    setClasses([created, ...classes]);
    setShowAddClassModal(false);
    triggerFeedback(`Class "${created.title}" scheduled! Enrolled students will see it in their dashboard.`);
  };

  const handleToggleClassStatus = async (clsId: string, newStatus: 'Upcoming' | 'Live' | 'Completed') => {
    setClasses(prev => prev.map(c => c.id === clsId ? { ...c, status: newStatus } : c));
    try {
      await fetch(`/api/admin/classes/${clsId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}
    triggerFeedback(`Class status switched to ${newStatus}.`);
  };

  const handleDeleteClass = (clsId: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Class Session',
      itemName: title,
      itemType: 'scheduled class',
      description: `Are you sure you want to delete the class session "${title}"?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/classes/${clsId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
        setClasses(prev => prev.filter(c => c.id !== clsId));
        triggerFeedback(`Class "${title}" deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 5. RECORDINGS HANDLERS
  // ----------------------------------------------------------------------
  const handleAddRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    const rec: Recording = {
      id: `rec-${Date.now()}`,
      batchId: newRecording.batchId,
      batchName: batches.find(b => b.id === newRecording.batchId)?.name || 'Spoken English',
      classId: `cls-${Date.now()}`,
      title: newRecording.title,
      topic: newRecording.topic,
      classNumber: recordings.length + 1,
      date: newRecording.recordedDate,
      duration: newRecording.duration,
      status: 'Available',
      videoKey: newRecording.videoUrl,
      recordedDate: newRecording.recordedDate,
      description: newRecording.description
    };
    try {
      await fetch('/api/admin/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(rec)
      });
    } catch (e) {}
    setRecordings([rec, ...recordings]);
    setShowAddRecordingModal(false);
    triggerFeedback(`Recording "${rec.title}" uploaded.`);
  };

  const handleDeleteRecording = (recId: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Recording',
      itemName: title,
      itemType: 'lecture recording',
      description: `Are you sure you want to delete recording "${title}" from the student vault?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/recordings/${recId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
        setRecordings(prev => prev.filter(r => r.id !== recId));
        triggerFeedback(`Recording deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 6. LEARNING RESOURCES & STUDY MATERIALS HANDLERS (PDF & YouTube)
  // ----------------------------------------------------------------------
  const handleFetchYouTubeMetadata = async (url: string, isEditing: boolean = false) => {
    if (!url || !url.trim()) return;
    setIsFetchingYtMetadata(true);
    try {
      const res = await fetch('/api/admin/youtube-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (isEditing) {
            setEditingMaterial(prev => prev ? {
              ...prev,
              title: prev.title && prev.title !== 'YouTube Video Lesson' ? prev.title : (data.title || prev.title),
              thumbnailUrl: prev.thumbnailUrl || data.thumbnailUrl
            } : null);
          } else {
            setNewYouTubeResource(prev => ({
              ...prev,
              title: data.title || prev.title,
              thumbnailUrl: data.thumbnailUrl || prev.thumbnailUrl
            }));
          }
          triggerFeedback('YouTube video information loaded!');
        }
      }
    } catch (err) {
      console.warn('Could not auto-fetch YouTube metadata:', err);
    } finally {
      setIsFetchingYtMetadata(false);
    }
  };

  const handleUploadThumbnail = async (file: File, isEditing: boolean = false) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    setIsUploadingThumbnail(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataBase64 = e.target?.result as string;
        const res = await fetch('/api/admin/upload-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            filename: file.name,
            dataBase64,
            mimeType: file.type
          })
        });
        if (res.ok) {
          const data = await res.json();
          const uploadedUrl = data.url || data.b2Url;
          if (isEditing) {
            setEditingMaterial(prev => prev ? {
              ...prev,
              thumbnailUrl: uploadedUrl,
              b2ThumbnailId: data.b2FileId,
              b2ThumbnailName: data.b2FileName
            } : null);
          } else {
            setNewYouTubeResource(prev => ({
              ...prev,
              thumbnailUrl: uploadedUrl,
              b2ThumbnailId: data.b2FileId,
              b2ThumbnailName: data.b2FileName
            }));
          }
          triggerFeedback('Custom thumbnail uploaded to Backblaze B2!');
        } else {
          alert('Thumbnail upload failed. Please try again.');
        }
        setIsUploadingThumbnail(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Thumbnail upload error:', err);
      setIsUploadingThumbnail(false);
    }
  };

  const handleTogglePublishMaterial = async (mat: StudyMaterial) => {
    const currentStatus = mat.isPublished !== false && mat.isVisibleOnWebsite !== false;
    const newStatus = !currentStatus;
    const updated: StudyMaterial = {
      ...mat,
      isPublished: newStatus,
      isVisibleOnWebsite: newStatus
    };

    const updatedList = materials.map(m => m.id === mat.id ? updated : m);
    setMaterials(updatedList);
    if (onUpdateMaterials) onUpdateMaterials(updatedList);
    try {
      localStorage.setItem('wits_lingo_materials', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: updatedList }));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    try {
      const res = await fetch(`/api/admin/materials/${mat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isPublished: newStatus, isVisibleOnWebsite: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.materials && Array.isArray(data.materials)) {
          setMaterials(data.materials);
          if (onUpdateMaterials) onUpdateMaterials(data.materials);
        }
      }
    } catch (e) {
      console.warn('Failed to toggle publish on backend:', e);
    }

    triggerFeedback(newStatus ? `"${mat.title}" published to website.` : `"${mat.title}" unpublished (Draft mode).`);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const opt = optimizePdfUrl(newMaterial.pdfUrl);
    const newId = `mat-${Date.now()}`;
    const mat: StudyMaterial = {
      id: newId,
      resourceType: 'pdf',
      batchId: newMaterial.batchId || 'all',
      title: newMaterial.title,
      description: newMaterial.description,
      fileType: (newMaterial.fileType as 'pdf' | 'doc' | 'notes') || 'pdf',
      fileSize: newMaterial.fileSize || '2.1 MB',
      downloadUrl: (newMaterial.downloadUrl && newMaterial.downloadUrl !== '#') ? newMaterial.downloadUrl : `/api/files/download/${newId}`,
      pdfUrl: opt.embedUrl || newMaterial.pdfUrl,
      b2FileId: newMaterial.b2FileId || undefined,
      b2FileName: newMaterial.b2FileName || undefined,
      mimeType: newMaterial.mimeType || 'application/pdf',
      isViewOnly: newMaterial.isViewOnly !== false,
      allowDownload: Boolean(newMaterial.allowDownload),
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      uploadedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      category: newMaterial.category || 'Worksheets',
      level: newMaterial.level || 'All Levels',
      isVisibleOnWebsite: newMaterial.isVisibleOnWebsite !== false,
      isPublished: newMaterial.isPublished !== false,
      displayOrder: newMaterial.displayOrder || (materials.length + 1)
    };

    let updatedList = [mat, ...materials];
    try {
      const res = await fetch('/api/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(mat)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.materials && Array.isArray(data.materials)) {
          updatedList = data.materials;
        }
      }
    } catch (e) {
      console.warn('Failed to upload material to backend:', e);
    }

    setMaterials(updatedList);
    if (onUpdateMaterials) onUpdateMaterials(updatedList);
    try {
      localStorage.setItem('wits_lingo_materials', JSON.stringify(updatedList));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: updatedList }));
    } catch (e) {}

    setShowAddMaterialModal(false);
    setNewMaterial({
      batchId: 'all',
      title: '',
      description: 'Practical PDF notes & daily vocabulary drill sheet.',
      fileType: 'pdf',
      fileSize: '1.8 MB',
      downloadUrl: '',
      pdfUrl: '',
      b2FileId: '',
      b2FileName: '',
      mimeType: 'application/pdf',
      isViewOnly: true,
      allowDownload: false,
      category: 'Worksheets',
      level: 'All Levels',
      isVisibleOnWebsite: true,
      isPublished: true,
      displayOrder: materials.length + 2
    });
    triggerFeedback(`Study material "${mat.title}" published & visible on website!`);
  };

  const handleAddYouTubeResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = newYouTubeResource.youtubeUrl.trim();
    const vidId = extractYouTubeVideoId(rawUrl);
    if (!vidId) {
      alert('Invalid YouTube Video URL. Please enter a valid YouTube video link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/... or https://www.youtube.com/shorts/...).');
      return;
    }

    const finalVideoUrl = `https://www.youtube.com/watch?v=${vidId}`;
    const finalTitle = newYouTubeResource.title.trim() || 'YouTube Spoken English Lesson';
    const newId = `mat-yt-${Date.now()}`;
    const mat: StudyMaterial = {
      id: newId,
      resourceType: 'youtube',
      batchId: 'all',
      title: finalTitle,
      description: newYouTubeResource.description.trim() || 'Watch this video lesson for practical spoken English fluency.',
      fileType: 'youtube',
      fileSize: 'Video',
      downloadUrl: finalVideoUrl,
      youtubeUrl: finalVideoUrl,
      thumbnailUrl: newYouTubeResource.thumbnailUrl.trim() || `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`,
      b2ThumbnailId: newYouTubeResource.b2ThumbnailId || undefined,
      b2ThumbnailName: newYouTubeResource.b2ThumbnailName || undefined,
      duration: newYouTubeResource.duration?.trim() || 'Video Lesson',
      views: 'Wits Lingo',
      isPublished: newYouTubeResource.isPublished !== false,
      isVisibleOnWebsite: newYouTubeResource.isPublished !== false,
      displayOrder: newYouTubeResource.displayOrder || (materials.filter(m => m.resourceType === 'youtube' || m.fileType === 'youtube').length + 1),
      category: newYouTubeResource.category || 'Daily English',
      level: 'All Levels',
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      uploadedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    let updatedList = [mat, ...materials];
    try {
      const res = await fetch('/api/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(mat)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.materials && Array.isArray(data.materials)) {
          updatedList = data.materials;
        }
      }
    } catch (e) {
      console.warn('Failed to add YouTube resource to backend:', e);
    }

    setMaterials(updatedList);
    if (onUpdateMaterials) onUpdateMaterials(updatedList);
    try {
      localStorage.setItem('wits_lingo_materials', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: updatedList }));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setShowAddYouTubeModal(false);
    setNewYouTubeResource({
      youtubeUrl: '',
      title: '',
      description: 'Watch this video lesson for practical spoken English fluency.',
      category: 'Daily English',
      displayOrder: materials.filter(m => m.resourceType === 'youtube' || m.fileType === 'youtube').length + 2,
      isPublished: true,
      duration: '',
      thumbnailUrl: '',
      b2ThumbnailId: '',
      b2ThumbnailName: ''
    });
    triggerFeedback(`YouTube lesson "${finalTitle}" published successfully!`);
  };

  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    let finalYoutubeUrl = editingMaterial.youtubeUrl;
    let finalThumb = editingMaterial.thumbnailUrl;

    if (editingMaterial.resourceType === 'youtube' || editingMaterial.fileType === 'youtube') {
      const rawUrl = (editingMaterial.youtubeUrl || '').trim();
      const vidId = extractYouTubeVideoId(rawUrl);
      if (!vidId) {
        alert('Invalid YouTube Video URL. Please enter a valid YouTube video link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/... or https://www.youtube.com/shorts/...).');
        return;
      }
      finalYoutubeUrl = `https://www.youtube.com/watch?v=${vidId}`;
      if (!finalThumb) {
        finalThumb = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
      }
    }

    const opt = optimizePdfUrl(editingMaterial.pdfUrl || '');
    const updated: StudyMaterial = {
      ...editingMaterial,
      youtubeUrl: finalYoutubeUrl,
      thumbnailUrl: finalThumb,
      pdfUrl: opt.embedUrl || editingMaterial.pdfUrl,
      downloadUrl: (editingMaterial.downloadUrl && editingMaterial.downloadUrl !== '#') ? editingMaterial.downloadUrl : (editingMaterial.resourceType === 'youtube' ? (finalYoutubeUrl || '') : `/api/files/download/${editingMaterial.id}`),
      isViewOnly: editingMaterial.isViewOnly !== false,
      allowDownload: Boolean(editingMaterial.allowDownload),
      category: editingMaterial.category || (editingMaterial.resourceType === 'youtube' ? 'Daily English' : 'Worksheets'),
      level: editingMaterial.level || 'All Levels',
      isVisibleOnWebsite: editingMaterial.isVisibleOnWebsite !== false,
      isPublished: editingMaterial.isPublished !== false
    };

    let updatedList = materials.map(m => m.id === editingMaterial.id ? updated : m);
    try {
      const res = await fetch(`/api/admin/materials/${editingMaterial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.materials && Array.isArray(data.materials)) {
          updatedList = data.materials;
        }
      }
    } catch (e) {
      console.warn('Failed to update material on backend:', e);
    }

    setMaterials(updatedList);
    if (onUpdateMaterials) onUpdateMaterials(updatedList);
    try {
      localStorage.setItem('wits_lingo_materials', JSON.stringify(updatedList));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: updatedList }));
    } catch (e) {}

    setEditingMaterial(null);
    triggerFeedback(`"${updated.title}" updated.`);
  };

  const handleDeleteMaterial = (matId: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Learning Resource',
      itemName: title,
      itemType: 'learning resource',
      description: `Are you sure you want to delete "${title}"? Any associated cloud files in Backblaze B2 will be permanently removed.`,
      onConfirm: async () => {
        let updatedList = materials.filter(m => m.id !== matId);
        try {
          const res = await fetch(`/api/admin/materials/${matId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.materials && Array.isArray(data.materials)) {
              updatedList = data.materials;
            }
          }
        } catch (e) {
          console.warn('Failed to delete material on backend:', e);
        }

        setMaterials(updatedList);
        if (onUpdateMaterials) onUpdateMaterials(updatedList);
        try {
          localStorage.setItem('wits_lingo_materials', JSON.stringify(updatedList));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('wits_lingo_material_updated', { detail: updatedList }));
        } catch (e) {}

        triggerFeedback(`Learning resource deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 7. TESTIMONIALS HANDLERS
  // ----------------------------------------------------------------------
  const handleAddTestimonial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestimonial.studentName || !newTestimonial.testimonial) return;
    const item: TestimonialData = {
      id: `test-${Date.now()}`,
      studentName: newTestimonial.studentName,
      courseBatch: newTestimonial.courseBatch || 'Spoken English',
      city: newTestimonial.city || 'India',
      testimonial: newTestimonial.testimonial,
      verified: newTestimonial.verified ?? true
    };
    const updated = [item, ...testimonials];
    onUpdateTestimonials(updated);
    setShowAddTestimonialModal(false);
    triggerFeedback(`Review from "${item.studentName}" published on homepage!`);
  };

  const handleSaveEditTestimonial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestimonial) return;
    const updated = testimonials.map(t => t.id === editingTestimonial.id ? editingTestimonial : t);
    onUpdateTestimonials(updated);
    setEditingTestimonial(null);
    triggerFeedback('Testimonial updated.');
  };

  const handleDeleteTestimonial = (id: string, name: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Testimonial',
      itemName: name,
      itemType: 'student review',
      description: `Are you sure you want to delete the testimonial from "${name}"? It will be removed from the homepage reviews section.`,
      onConfirm: () => {
        const updated = testimonials.filter(t => t.id !== id);
        onUpdateTestimonials(updated);
        triggerFeedback(`Review deleted.`);
      }
    });
  };

  // ----------------------------------------------------------------------
  // 7b. ANNOUNCEMENTS & HOLIDAYS MANAGEMENT
  // ----------------------------------------------------------------------
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      triggerFeedback('Please provide both notice title and description.');
      return;
    }

    const targetBatch = batches.find(b => b.id === newAnnouncement.batchId);
    const batchName = newAnnouncement.batchId === 'all' 
      ? 'All Batches (Academy-wide)' 
      : (targetBatch?.name || 'All Batches');

    const createdAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: newAnnouncement.title.trim(),
      message: newAnnouncement.message.trim(),
      category: newAnnouncement.category,
      batchId: newAnnouncement.batchId,
      batchName,
      priority: newAnnouncement.priority,
      effectiveDate: newAnnouncement.effectiveDate.trim() || new Date().toLocaleDateString('en-GB'),
      isPinned: newAnnouncement.isPinned,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      author: siteSettings?.founderName || 'Ziyaur Rehman Zia'
    };

    try {
      await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(createdAnn)
      });
    } catch (err) {}

    const updated = [createdAnn, ...localAnnouncements];
    updateAllAnnouncements(updated);
    setShowAddAnnouncementModal(false);
    setNewAnnouncement({
      title: '',
      category: 'Holiday',
      batchId: 'all',
      priority: 'Important',
      effectiveDate: '',
      message: '',
      isPinned: false
    });
    triggerFeedback(`Notice "${createdAnn.title}" published successfully!`);
  };

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    const targetBatch = batches.find(b => b.id === editingAnnouncement.batchId);
    const updatedRecord: Announcement = {
      ...editingAnnouncement,
      batchName: editingAnnouncement.batchId === 'all'
        ? 'All Batches (Academy-wide)'
        : (targetBatch?.name || editingAnnouncement.batchName)
    };

    try {
      await fetch(`/api/admin/announcements/${updatedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedRecord)
      });
    } catch (err) {}

    const updated = localAnnouncements.map(a => a.id === updatedRecord.id ? updatedRecord : a);
    updateAllAnnouncements(updated);
    setEditingAnnouncement(null);
    triggerFeedback(`Notice "${updatedRecord.title}" updated.`);
  };

  const handleDeleteAnnouncement = (id: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Notice',
      itemName: title,
      itemType: 'academy circular',
      description: `Are you sure you want to remove the notice "${title}"? It will no longer be visible on student notices or homepage boards.`,
      onConfirm: async () => {
        try {
          await fetch(`/api/admin/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (err) {}

        const updated = localAnnouncements.filter(a => a.id !== id);
        updateAllAnnouncements(updated);
        triggerFeedback(`Notice removed.`);
      }
    });
  };

  const handleTogglePinAnnouncement = async (id: string) => {
    const target = localAnnouncements.find(a => a.id === id);
    if (!target) return;
    const updatedTarget = { ...target, isPinned: !target.isPinned };
    try {
      await fetch(`/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isPinned: updatedTarget.isPinned })
      });
    } catch (err) {}

    const updated = localAnnouncements.map(a => a.id === id ? updatedTarget : a);
    updateAllAnnouncements(updated);
    triggerFeedback(updatedTarget.isPinned ? `Notice pinned to top.` : `Notice unpinned.`);
  };

  // ----------------------------------------------------------------------
  // 8. SITE SETTINGS & HERO VIDEO MANAGEMENT
  // ----------------------------------------------------------------------
  const handleUploadHeroVideo = async (file: File) => {
    if (!file) return;
    setIsUploadingHeroVideo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/admin/hero-video/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              filename: file.name,
              dataBase64: base64Data,
              mimeType: file.type || 'video/mp4'
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            const updated = {
              ...localSettings,
              heroVideoUrl: data.heroVideoUrl
            };
            setLocalSettings(updated);
            onUpdateSiteSettings(updated);
            triggerFeedback(data.uploadedToB2 
              ? 'Hero video uploaded directly to Backblaze B2 and updated live!' 
              : 'Hero video updated live on website (Local storage fallback)!'
            );
          } else {
            triggerFeedback(data.error || 'Failed to upload hero video.');
          }
        } catch (err: any) {
          triggerFeedback(err?.message || 'Error processing video file.');
        } finally {
          setIsUploadingHeroVideo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      triggerFeedback('Could not read video file.');
      setIsUploadingHeroVideo(false);
    }
  };

  const handleResetHeroVideo = async () => {
    try {
      const res = await fetch('/api/admin/hero-video/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = {
          ...localSettings,
          heroVideoUrl: '/video/wits-lingo-intro.mp4'
        };
        setLocalSettings(updated);
        setCustomHeroVideoUrl('/video/wits-lingo-intro.mp4');
        onUpdateSiteSettings(updated);
        triggerFeedback('Hero video reset to default academy introduction video.');
      }
    } catch (err) {
      triggerFeedback('Error resetting hero video.');
    }
  };

  const handlePublishHeroVideoUrl = async (customUrl: string) => {
    const urlToSet = customUrl.trim() || '/video/wits-lingo-intro.mp4';
    const updated = {
      ...localSettings,
      heroVideoUrl: urlToSet
    };
    setLocalSettings(updated);
    setCustomHeroVideoUrl(urlToSet);
    onUpdateSiteSettings(updated);
    try {
      await fetch('/api/cms/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          phoneNumbers: [localSettings.phone1, localSettings.phone2],
          email: localSettings.email,
          location: localSettings.address,
          announcementText: localSettings.announcementText,
          announcementBtnText: localSettings.announcementBtnText || '',
          showAnnouncement: localSettings.showAnnouncement,
          settings: updated
        })
      });
    } catch (e) {}
    triggerFeedback('Hero video URL published and active on homepage!');
  };

  // ----------------------------------------------------------------------
  // 8b. CENTRAL WEBSITE LOGO MANAGEMENT (BACKBLAZE B2 STORAGE)
  // ----------------------------------------------------------------------
  const handleSelectLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(png|jpg|jpeg|webp|svg)$/i)) {
      setLogoUploadError('Please select a valid image file (PNG, JPG, WEBP, or SVG).');
      return;
    }

    // Validate size (<= 8MB)
    if (file.size > 8 * 1024 * 1024) {
      setLogoUploadError('Logo file size exceeds 8MB limit. Please choose a smaller image.');
      return;
    }

    setLogoUploadError(null);
    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile && !logoPreviewUrl) {
      setLogoUploadError('Please select an image file first.');
      return;
    }

    setIsUploadingLogo(true);
    setLogoUploadError(null);

    try {
      let base64Data = logoPreviewUrl;
      if (!base64Data && logoFile) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(logoFile);
        });
      }

      const res = await fetch('/api/admin/logo/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: logoFile?.name || 'wits-lingo-logo.png',
          dataBase64: base64Data,
          mimeType: logoFile?.type || 'image/png'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updated: SiteSettings = {
          ...localSettings,
          logoUrl: data.logoUrl,
          logoVersion: data.logoVersion
        };
        setLocalSettings(updated);
        onUpdateSiteSettings(updated);
        localStorage.setItem('wits_lingo_site_settings', JSON.stringify(updated));

        // Dispatch real-time global update
        window.dispatchEvent(new CustomEvent('wits_lingo_logo_updated', {
          detail: {
            logoUrl: data.logoUrl,
            logoVersion: data.logoVersion
          }
        }));

        setLogoFile(null);
        setLogoPreviewUrl(null);
        triggerFeedback('Main website logo updated successfully! Published across all headers, footers & branding.');
      } else {
        setLogoUploadError(data.error || 'Failed to upload logo.');
        triggerFeedback(data.error || 'Failed to upload logo.');
      }
    } catch (err: any) {
      setLogoUploadError(err?.message || 'Error processing logo upload.');
      triggerFeedback(err?.message || 'Error processing logo upload.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    setDeleteModal({
      isOpen: true,
      title: 'Reset Website Logo',
      itemName: 'Main Logo',
      itemType: 'website branding',
      description: 'Are you sure you want to reset the website logo to the default original Wits Lingo SVG logo? All headers and footers will revert to the default mascot emblem.',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/logo/reset', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const updated: SiteSettings = {
              ...localSettings,
              logoUrl: '/logo.svg',
              logoVersion: data.logoVersion || Date.now()
            };
            setLocalSettings(updated);
            onUpdateSiteSettings(updated);
            localStorage.setItem('wits_lingo_site_settings', JSON.stringify(updated));

            window.dispatchEvent(new CustomEvent('wits_lingo_logo_updated', {
              detail: {
                logoUrl: '/logo.svg',
                logoVersion: data.logoVersion
              }
            }));

            setLogoFile(null);
            setLogoPreviewUrl(null);
            setLogoUploadError(null);
            triggerFeedback('Website logo reset to default original SVG logo.');
          }
        } catch (err) {
          triggerFeedback('Error resetting logo.');
        }
      }
    });
  };

  // ----------------------------------------------------------------------
  // 9. GALLERY MANAGEMENT HANDLERS (BACKBLAZE B2 STORAGE)
  // ----------------------------------------------------------------------
  const handleUploadGalleryFiles = async (filesToUpload: Array<{ file: File; title: string; caption: string; category: string }>) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setIsUploadingGallery(true);
    try {
      const imagePayloads: Array<{
        dataBase64: string;
        filename: string;
        mimeType: string;
        title: string;
        caption: string;
        category: string;
        isPublished: boolean;
      }> = [];

      for (const item of filesToUpload) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });

        imagePayloads.push({
          dataBase64: base64,
          filename: item.file.name,
          mimeType: item.file.type || 'image/jpeg',
          title: item.title,
          caption: item.caption,
          category: item.category || 'Classrooms',
          isPublished: true
        });
      }

      const res = await fetch('/api/admin/gallery/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ images: imagePayloads })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.items)) {
          setGalleryItems(prev => [...data.items, ...prev]);
        } else {
          const gRes = await fetch('/api/admin/gallery', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            if (Array.isArray(gData.items)) setGalleryItems(gData.items);
          }
        }
        setShowAddGalleryModal(false);
        setSelectedUploadFiles([]);
        triggerFeedback(`Successfully uploaded ${filesToUpload.length} image(s) to Backblaze B2 & Gallery!`);
      } else {
        triggerFeedback(data.error || 'Failed to upload gallery images.');
      }
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      triggerFeedback(err?.message || 'Error uploading gallery photos.');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleUpdateGalleryMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGalleryItem) return;
    try {
      const res = await fetch(`/api/admin/gallery/${editingGalleryItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editingGalleryItem.title,
          caption: editingGalleryItem.caption,
          category: editingGalleryItem.category,
          isPublished: editingGalleryItem.isPublished,
          displayOrder: editingGalleryItem.displayOrder
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGalleryItems(prev => prev.map(item => item.id === editingGalleryItem.id ? data.item : item));
        setEditingGalleryItem(null);
        triggerFeedback('Gallery photo details updated successfully.');
      } else {
        triggerFeedback(data.error || 'Failed to update photo.');
      }
    } catch (err) {
      triggerFeedback('Error updating photo metadata.');
    }
  };

  const handleToggleGalleryPublish = async (item: GalleryItem) => {
    const nextStatus = !item.isPublished;
    try {
      const res = await fetch(`/api/admin/gallery/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isPublished: nextStatus })
      });
      if (res.ok) {
        setGalleryItems(prev => prev.map(g => g.id === item.id ? { ...g, isPublished: nextStatus } : g));
        triggerFeedback(nextStatus ? `Photo published live to public /gallery.` : `Photo changed to Draft (Unpublished).`);
      }
    } catch (err) {
      triggerFeedback('Error updating publish status.');
    }
  };

  const handleDeleteGalleryPhoto = (item: GalleryItem) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Gallery Image',
      itemName: item.title || 'Untitled Photo',
      itemType: 'gallery photograph',
      description: `Are you sure you want to delete this photo from the gallery? It will be removed from the public website and safely erased from cloud storage.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/gallery/${item.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setGalleryItems(prev => prev.filter(g => g.id !== item.id));
            triggerFeedback('Gallery photo deleted successfully.');
          } else {
            triggerFeedback('Failed to delete photo.');
          }
        } catch (err) {
          triggerFeedback('Error deleting photo.');
        }
      }
    });
  };

  const handleMoveGalleryOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= galleryItems.length) return;

    const reordered = [...galleryItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    setGalleryItems(updated);

    try {
      await fetch('/api/admin/gallery/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderedIds: updated.map(i => i.id) })
      });
      triggerFeedback('Gallery display order updated.');
    } catch (e) {
      console.warn('Could not persist gallery order:', e);
    }
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSiteSettings(localSettings);
    try {
      await fetch('/api/cms/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          phoneNumbers: [localSettings.phone1, localSettings.phone2],
          email: localSettings.email,
          location: localSettings.address,
          announcementText: localSettings.announcementText,
          announcementBtnText: localSettings.announcementBtnText || '',
          showAnnouncement: localSettings.showAnnouncement,
          settings: localSettings
        })
      });
    } catch (e) {}
    triggerFeedback('All website settings and top announcement banner saved live!');
  };

  return (
    <div className="min-h-screen bg-[#F8F6FB] pt-6 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Toast / Feedback Banner */}
        {feedbackMessage && (
          <div className="fixed top-5 right-5 z-50 bg-[#3B0764] text-white px-5 py-3 rounded-2xl shadow-xl border border-purple-400/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-xs font-semibold">{feedbackMessage}</span>
          </div>
        )}

        {/* Top Navigation & Brand Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-purple-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#3B0764] to-[#4A1D96] text-white flex items-center justify-center font-extrabold text-lg shadow-md tracking-wider">
              ZRZ
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-[#4A1D96]">
                  Wits Lingo Academy Master Admin
                </span>
                <span className="text-xs text-slate-400">
                  Logged in as: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.email})
                </span>
              </div>
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Website & Academy Control Dashboard
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Add, edit, change, or delete any function, course, batch, admission, class, recording, or setting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
            {onOpenSystemReport && (
              <button
                onClick={onOpenSystemReport}
                className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#4A1D96] text-xs font-bold transition-colors flex items-center gap-1.5 border border-purple-200 cursor-pointer"
                title="Download full report of the website as PDF"
              >
                <FileText className="w-3.5 h-3.5 text-purple-700" />
                <span>Website Report (PDF)</span>
              </button>
            )}

            {onBackToHome && (
              <button
                onClick={onBackToHome}
                id="admin-view-website-btn"
                className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#4A1D96] text-xs font-bold transition-colors flex items-center gap-1.5 border border-purple-200 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>View Live Website</span>
              </button>
            )}

            <button
              onClick={onLogout}
              id="admin-logout-btn"
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-red-50 text-xs font-bold text-slate-600 hover:text-red-600 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-2 border-b border-purple-100 pb-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'students', label: `Admissions & Students (${students.length})`, icon: Users },
            { id: 'courses', label: `Courses & Pricing (${courses.length})`, icon: Layers },
            { id: 'batches', label: `Batches & Capacity (${batches.length})`, icon: RefreshCw },
            { id: 'orders-payments', label: 'Orders & Payments', icon: CreditCard },
            { id: 'whatsapp-notifications', label: 'WhatsApp Logs', icon: MessageSquare },
            { id: 'support-tickets', label: 'Support Tickets & AI', icon: AlertCircle },
            { id: 'knowledge-base', label: 'AI Knowledge & FAQs', icon: BookOpen },
            { id: 'classes', label: 'Live Classes Scheduler', icon: Video },
            { id: 'recordings', label: 'Class Recordings', icon: Play },
            { id: 'materials', label: `Study Notes & PDFs (${materials.filter(m => m.resourceType !== 'youtube' && m.fileType !== 'youtube').length})`, icon: FileText },
            { id: 'youtube-lessons', label: `Video Lessons / YouTube (${materials.filter(m => m.resourceType === 'youtube' || m.fileType === 'youtube').length})`, icon: Youtube },
            { id: 'hero-video', label: 'Hero Video', icon: Film },
            { id: 'gallery', label: `Gallery (${galleryItems.length})`, icon: ImageIcon },
            { id: 'testimonials', label: `Student Reviews (${testimonials.length})`, icon: MessageSquare },
            { id: 'announcements', label: `Notices & Holidays (${localAnnouncements.length})`, icon: Megaphone },
            { id: 'settings', label: 'Website CMS & Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                onClick={() => handleTabSelect(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#4A1D96] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-purple-50 hover:text-[#4A1D96]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: ADMISSIONS & REGISTERED STUDENTS */}
        {/* ==================================================================== */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                  Student Admissions & Records
                </h2>
                <p className="text-xs text-slate-500">
                  Search, edit, verify, or remove enrolled students across all academy batches.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  id="admin-add-student-btn"
                  className="px-3.5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Admit New Student</span>
                </button>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={selectedBatchFilter}
                    onChange={(e) => setSelectedBatchFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="All">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student, phone, city..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="pl-8.5 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#4A1D96] w-48 sm:w-60"
                  />
                </div>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-3 px-4 rounded-l-xl">Admission ID</th>
                    <th className="py-3 px-4">Student & Parent</th>
                    <th className="py-3 px-4">District & State</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Batch Enrolled</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">WhatsApp Status</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st) => (
                      <tr key={st.id || st.admissionId} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#4A1D96]">
                          {st.admissionId || 'WL-PENDING'}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{st.name}</p>
                          <p className="text-[11px] text-slate-500">S/D/O {st.fatherName || 'Guardian'}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          <p className="font-semibold text-slate-900">{st.district || 'Amroha'}, {st.state || 'UP'}</p>
                          <p className="text-[11px] text-slate-500">
                            {st.country || 'India'}{st.pincode ? ` • ${st.pincode}` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-900">{st.phone}</p>
                          <p className="text-[11px] text-slate-500">{st.email}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-[#4A1D96] border border-purple-200">
                            {batches.find(b => b.id === st.batchId)?.name || st.batchName || 'October Batch'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {st.paymentStatus || 'Paid'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-800">
                                {st.paymentAmountFormatted || `₹${st.feeAmount || 1499}`}
                              </span>
                            </div>
                            <p className="text-[10px] font-semibold text-purple-900 truncate max-w-[130px]" title={st.paymentMethod}>
                              {st.paymentMethod || 'UPI / Bank'}
                            </p>
                            {st.paymentTxnId && (
                              <p className="text-[9px] font-mono text-slate-400 truncate max-w-[125px]" title={st.paymentTxnId}>
                                Ref: {st.paymentTxnId}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {st.whatsappDeliveryStatus === 'sent' ? (
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                              title={`WhatsApp Confirmed\nMessage ID: ${st.whatsappMessageId || 'N/A'}`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sent</span>
                            </span>
                          ) : st.whatsappDeliveryStatus === 'failed' ? (
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                              title={`Delivery status: ${st.whatsappError || 'Meta Cloud API issue'}`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleResendWhatsApp(st.id || st.admissionId)}
                            title="Resend WhatsApp Enrollment Confirmation Message"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingStudent({ ...st })}
                            title="Edit Student"
                            className="p-1.5 text-slate-400 hover:text-[#4A1D96] hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(st.id || st.admissionId, st.name)}
                            title="Delete Student"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: COURSES CATALOG & PRICING CMS (Anytime Editable Past or Post Publication) */}
        {/* ==================================================================== */}
        {activeTab === 'courses' && (() => {
          const totalCount = courses.length;
          const publishedCount = courses.filter(c => c.isPublished !== false).length;
          const draftCount = courses.filter(c => c.isPublished === false).length;

          const filteredCourses = courses.filter((course) => {
            if (courseVisibilityFilter === 'published' && course.isPublished === false) return false;
            if (courseVisibilityFilter === 'draft' && course.isPublished !== false) return false;
            if (courseLevelFilter !== 'all' && !course.level.toLowerCase().includes(courseLevelFilter.toLowerCase())) return false;
            if (courseSearchQuery.trim()) {
              const q = courseSearchQuery.toLowerCase();
              const matchName = course.name.toLowerCase().includes(q);
              const matchDesc = course.shortDescription?.toLowerCase().includes(q);
              const matchLevel = course.level?.toLowerCase().includes(q);
              const matchBadge = course.badge?.toLowerCase().includes(q);
              const matchFormat = course.learningFormat?.toLowerCase().includes(q);
              const matchSyllabus = course.whatYouWillLearn?.some(item => item.toLowerCase().includes(q));
              if (!matchName && !matchDesc && !matchLevel && !matchBadge && !matchFormat && !matchSyllabus) return false;
            }
            return true;
          });

          return (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
              {/* Header & Stats */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                      Courses Catalog & Publication CMS
                    </h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#4A1D96]">
                      Editable Anytime
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Edit course titles, pricing, curriculum points, duration, and learning formats anytime — before publication (drafts) or after publication (live website).
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start lg:self-auto">
                  <button
                    onClick={() => {
                      setNewCourse({
                        name: '',
                        level: 'Beginner to Intermediate',
                        shortDescription: '',
                        whatYouWillLearn: [
                          'Master natural conversational speaking',
                          'Overcome public hesitation and stage fear',
                          'Daily vocabulary in context',
                          'Pronunciation and accent clarity'
                        ],
                        duration: '2 Months (40 Sessions)',
                        learningFormat: 'Live Online Classroom (Evening Batches)',
                        fee: 1499,
                        badge: 'Popular Foundation',
                        isPublished: true
                      });
                      setNewBulletPointForAdd('');
                      setShowAddCourseModal(true);
                    }}
                    id="admin-add-course-btn"
                    className="px-4 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Course</span>
                  </button>
                </div>
              </div>

              {/* Course Status Stats Bar */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setCourseVisibilityFilter('all')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    courseVisibilityFilter === 'all'
                      ? 'border-purple-300 bg-purple-50/70 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">All Courses</span>
                  <span className="font-['Outfit'] text-xl font-extrabold text-[#4A1D96]">{totalCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseVisibilityFilter('published')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    courseVisibilityFilter === 'published'
                      ? 'border-emerald-300 bg-emerald-50/70 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    Live on Website
                  </span>
                  <span className="font-['Outfit'] text-xl font-extrabold text-emerald-700">{publishedCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseVisibilityFilter('draft')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    courseVisibilityFilter === 'draft'
                      ? 'border-amber-300 bg-amber-50/70 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-amber-700 block flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                    Drafts / Unpublished
                  </span>
                  <span className="font-['Outfit'] text-xl font-extrabold text-amber-700">{draftCount}</span>
                </button>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF9FC] p-3 rounded-2xl border border-purple-100">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by course title, syllabus topic, level, or format..."
                    value={courseSearchQuery}
                    onChange={(e) => setCourseSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                  />
                  {courseSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCourseSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Level:</span>
                  {['all', 'Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCourseLevelFilter(lvl)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        courseLevelFilter === lvl
                          ? 'bg-[#4A1D96] text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {lvl === 'all' ? 'All Levels' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => {
                    const isLive = course.isPublished !== false;
                    return (
                      <div
                        key={course.id}
                        className={`rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                          isLive
                            ? 'border-purple-200 bg-white hover:border-purple-300 hover:shadow-md'
                            : 'border-amber-200/90 bg-amber-50/20 hover:border-amber-300'
                        }`}
                      >
                        {/* Status Ribbon & Quick Publish Toggle */}
                        <div
                          className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
                            isLive
                              ? 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          <span className="font-bold flex items-center gap-1.5 text-[11px]">
                            {isLive ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>LIVE ON WEBSITE</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>DRAFT (UNPUBLISHED)</span>
                              </>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTogglePublishCourse(course.id)}
                            title={isLive ? 'Unpublish from public website' : 'Publish to live website'}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              isLive
                                ? 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                            }`}
                          >
                            {isLive ? 'Unpublish' : 'Publish Now'}
                          </button>
                        </div>

                        {/* Card Body */}
                        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            {/* Badges */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-[#4A1D96] border border-purple-200">
                                {course.level}
                              </span>
                              {course.badge && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>{course.badge}</span>
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                              {course.name}
                            </h3>

                            {/* Short Description */}
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {course.shortDescription}
                            </p>

                            {/* Metadata Pills: Duration & Format */}
                            <div className="grid grid-cols-2 gap-2 py-2.5 border-y border-slate-100 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <div className="truncate">
                                  <span className="text-[9px] text-slate-400 block uppercase font-semibold">Duration</span>
                                  <span className="font-bold text-slate-800 truncate block text-[11px]">{course.duration}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <div className="truncate">
                                  <span className="text-[9px] text-slate-400 block uppercase font-semibold">Format</span>
                                  <span className="font-bold text-slate-800 truncate block text-[11px]">{course.learningFormat}</span>
                                </div>
                              </div>
                            </div>

                            {/* What Students Learn (Full Bullet Checklist) */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  What You Will Learn ({course.whatYouWillLearn?.length || 0})
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {course.whatYouWillLearn?.map((item, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700 leading-tight">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Price & Actions */}
                          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] text-slate-400 block font-bold uppercase">Course Fee</span>
                              <span className="font-['Outfit'] font-black text-xl text-[#3B0764]">
                                ₹{course.fee?.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-500 ml-1">/ batch</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCourse({
                                    ...course,
                                    whatYouWillLearn: Array.isArray(course.whatYouWillLearn)
                                      ? [...course.whatYouWillLearn]
                                      : []
                                  });
                                  setNewBulletPointForEdit('');
                                }}
                                className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-[#4A1D96] transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Course</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCourse(course.id, course.name)}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Delete Course"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <p className="text-sm font-bold text-slate-600">No courses match your filter.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseVisibilityFilter('all');
                        setCourseSearchQuery('');
                        setCourseLevelFilter('all');
                      }}
                      className="text-xs font-bold text-purple-700 hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* TAB 3: BATCHES MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'batches' && (() => {
          const isSectionVisible = localSettings.showBatchesSection ?? true;
          const visibleBatchesCount = batches.filter(b => b.isVisibleOnWebsite !== false).length;
          const hiddenBatchesCount = batches.filter(b => b.isVisibleOnWebsite === false).length;

          const filteredBatches = batches.filter((batch) => {
            if (batchVisibilityFilter === 'visible' && batch.isVisibleOnWebsite === false) return false;
            if (batchVisibilityFilter === 'hidden' && batch.isVisibleOnWebsite !== false) return false;

            if (batchSearchQuery.trim()) {
              const q = batchSearchQuery.toLowerCase();
              const matchName = batch.name?.toLowerCase().includes(q);
              const matchCode = batch.batchCode?.toLowerCase().includes(q);
              const matchCourse = batch.courseName?.toLowerCase().includes(q);
              const matchMentor = batch.teacherName?.toLowerCase().includes(q);
              if (!matchName && !matchCode && !matchCourse && !matchMentor) return false;
            }
            return true;
          });

          return (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
              {/* Header & Master Section Switch */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                      Batches & Seat Capacity Control
                    </h2>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                      isSectionVisible 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isSectionVisible ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Section Live on Website</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 text-amber-700" />
                          <span>Section Hidden from Website</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage batch names, schedules, timing, student capacity, and public website visibility.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                  {/* Master Section Visibility Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleShowBatchesSection}
                    id="admin-toggle-batches-section-btn"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-2xs ${
                      isSectionVisible
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                    title={isSectionVisible ? 'Click to hide the Batches & Capacity section from the public website' : 'Click to show the Batches & Capacity section on the public website'}
                  >
                    {isSectionVisible ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hide Section from Website</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-amber-700" />
                        <span>Show Section on Website</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowAddBatchModal(true)}
                    id="admin-add-batch-btn"
                    className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Batch</span>
                  </button>
                </div>
              </div>

              {/* Master Status Notice (when whole section is hidden) */}
              {!isSectionVisible && (
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                      <EyeOff className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-950">
                        The entire "Batches & Capacity" section is currently hidden from the public website.
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Visitors cannot see this section or any batches until you click "Show Section on Website".
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleShowBatchesSection}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Turn On Section
                  </button>
                </div>
              )}

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-purple-50/40 p-3 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setBatchVisibilityFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      batchVisibilityFilter === 'all'
                        ? 'bg-[#4A1D96] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-purple-100/60 border border-purple-100'
                    }`}
                  >
                    All Batches ({batches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchVisibilityFilter('visible')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      batchVisibilityFilter === 'visible'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Live on Web ({visibleBatchesCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchVisibilityFilter('hidden')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      batchVisibilityFilter === 'hidden'
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                    }`}
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Hidden from Web ({hiddenBatchesCount})</span>
                  </button>
                </div>

                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by batch, code, mentor..."
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-purple-400 placeholder:text-slate-400"
                  />
                  {batchSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBatchSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Batches Grid */}
              {filteredBatches.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <EyeOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No batches match your filter or search.</p>
                  <button
                    type="button"
                    onClick={() => { setBatchVisibilityFilter('all'); setBatchSearchQuery(''); }}
                    className="mt-3 text-xs text-[#4A1D96] font-bold hover:underline cursor-pointer"
                  >
                    Reset filters and show all
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBatches.map((batch) => {
                    const enrolled = batch.enrolledCount ?? batch.currentStudentsCount ?? 0;
                    const capacity = batch.maxCapacity ?? batch.maxStudents ?? 35;
                    const pct = Math.min(100, Math.round((enrolled / capacity) * 100));
                    const isVisible = batch.isVisibleOnWebsite !== false;

                    return (
                      <div
                        key={batch.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isVisible
                            ? 'border-purple-100 bg-[#FAF9FC] hover:border-purple-300 hover:shadow-xs'
                            : 'border-dashed border-amber-300/80 bg-amber-50/25'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Badges Row */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] font-bold text-[#4A1D96] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                {batch.batchCode}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                batch.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                                batch.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {batch.status}
                              </span>
                            </div>

                            {/* Live/Hidden indicator */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              isVisible
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {isVisible ? (
                                <>
                                  <Eye className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Live on Web</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Hidden</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-['Outfit'] font-bold text-base text-slate-900 mt-1">
                              {batch.name}
                            </h3>
                            <p className="text-[11px] text-purple-700 font-medium">
                              {batch.courseName || 'Spoken English'}
                            </p>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600">
                            <p>
                              <strong>Timing:</strong> {batch.scheduleTime}
                            </p>
                            <p>
                              <strong>Mentor:</strong> {batch.teacherName || 'Ziyaur Rehman Zia'}
                            </p>
                            {batch.googleMeetLink && (
                              <div className="pt-1 flex items-center justify-between bg-purple-50/70 px-2.5 py-1.5 rounded-lg border border-purple-200 text-[11px]">
                                <span className="text-purple-900 font-semibold truncate flex items-center gap-1">
                                  <Video className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                  <span className="truncate">Google Meet Link Configured</span>
                                </span>
                                <a
                                  href={batch.googleMeetLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-700 hover:text-purple-900 font-bold flex items-center gap-0.5 shrink-0 ml-1"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Capacity Bar */}
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                              <span>Capacity Enrollment</span>
                              <span>{enrolled} / {capacity} Students ({pct}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-amber-500' : 'bg-[#4A1D96]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="pt-3 mt-4 border-t border-slate-200/60 flex items-center justify-between gap-2">
                          {/* Toggle batch visibility */}
                          <button
                            type="button"
                            onClick={() => handleToggleBatchVisibility(batch.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isVisible
                                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 shadow-2xs'
                            }`}
                            title={isVisible ? 'Hide this batch card from the public website' : 'Make this batch card visible on the public website'}
                          >
                            {isVisible ? (
                              <>
                                <EyeOff className="w-3 h-3 text-slate-500" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 text-emerald-600" />
                                <span>Unhide</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingBatch({ ...batch })}
                              className="px-3 py-1.5 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 text-xs font-bold text-[#4A1D96] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(batch.id, batch.name)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete Batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* TAB 4: LIVE CLASSES SCHEDULER */}
        {/* ==================================================================== */}
        {activeTab === 'classes' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                  Live Class Sessions & Meeting Links
                </h2>
                <p className="text-xs text-slate-500">
                  Schedule live sessions, update Google Meet / Zoom links, and trigger live or completed status.
                </p>
              </div>

              <button
                onClick={() => setShowAddClassModal(true)}
                id="admin-add-class-btn"
                className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule New Class</span>
              </button>
            </div>

            <div className="space-y-4">
              {classes.length > 0 ? (
                classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-[#FAF9FC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-purple-200 transition-colors"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{cls.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cls.status === 'Live' ? 'bg-red-100 text-red-700 animate-pulse' :
                          cls.status === 'Completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {cls.status === 'Live' ? '🔴 LIVE NOW' : cls.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        <strong>Date:</strong> {cls.date} • <strong>Time:</strong> {cls.time}
                      </p>
                      {cls.joinUrl && (
                        <p className="text-xs text-purple-700 font-mono truncate max-w-md">
                          <strong>Meet Link:</strong> {cls.joinUrl}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                      {cls.status !== 'Live' && (
                        <button
                          onClick={() => handleToggleClassStatus(cls.id, 'Live')}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                        >
                          Start Live
                        </button>
                      )}
                      {cls.status === 'Live' && (
                        <button
                          onClick={() => handleToggleClassStatus(cls.id, 'Completed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          Mark Completed
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClass(cls.id, cls.title)}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Class"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400">
                  No classes scheduled yet. Click "Schedule New Class" above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: CLASS RECORDINGS */}
        {/* ==================================================================== */}
        {activeTab === 'recordings' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                  Batch Recorded Lectures & Vault
                </h2>
                <p className="text-xs text-slate-500">
                  Upload, manage, and delete lecture recordings accessible to authorized batch students.
                </p>
              </div>

              <button
                onClick={() => setShowAddRecordingModal(true)}
                id="admin-add-rec-btn"
                className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Recording</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recordings.length > 0 ? (
                recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-[#FAF9FC] space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#4A1D96]">
                        <span>{rec.topic || 'Class Lecture'}</span>
                        <span className="text-slate-400">{rec.duration || '60 min'}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{rec.title}</h4>
                      <p className="text-[11px] text-slate-500">Recorded: {rec.recordedDate || 'Recent'}</p>
                      {rec.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{rec.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => handleDeleteRecording(rec.id, rec.title)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-12 text-center text-slate-400">
                  No recordings added yet. Click "Add New Recording" to attach lectures.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ==================================================================== */}
        {/* TAB 6: STUDY NOTES & PDFS (VIEW-ONLY PROTECTED & DOWNLOADABLE GUIDES) */}
        {/* ==================================================================== */}
        {activeTab === 'materials' && (() => {
          const pdfMaterials = materials.filter(m => m.resourceType !== 'youtube' && m.fileType !== 'youtube');

          const filteredPdfs = pdfMaterials.filter(m => {
            const matchBatch = materialFilterBatch === 'all' || m.batchId === materialFilterBatch;
            const matchCat = materialCategoryFilter === 'all' || m.category === materialCategoryFilter;
            const matchSearch = !materialSearchQuery.trim() ||
              m.title.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
              m.description.toLowerCase().includes(materialSearchQuery.toLowerCase());
            return matchBatch && matchCat && matchSearch;
          });

          return (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
              {/* Section Top Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                      Study Notes & PDFs Management
                    </h2>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                      {pdfMaterials.length} PDF Guides
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage view-only PDF study guides, worksheets, and curriculum notes displayed in the Knowledge Bank.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setShowAddMaterialModal(true)}
                    id="admin-add-mat-btn"
                    className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload PDF Guide</span>
                  </button>

                  <button
                    onClick={() => handleTabSelect('youtube-lessons')}
                    className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-red-200 cursor-pointer"
                  >
                    <Youtube className="w-3.5 h-3.5 text-red-600" />
                    <span>Video Lessons CMS →</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search document title, description..."
                    value={materialSearchQuery}
                    onChange={(e) => setMaterialSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-[#4A1D96]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={materialFilterBatch}
                    onChange={(e) => setMaterialFilterBatch(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:border-[#4A1D96]"
                  >
                    <option value="all">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  <select
                    value={materialCategoryFilter}
                    onChange={(e) => setMaterialCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:border-[#4A1D96]"
                  >
                    <option value="all">All Categories</option>
                    <option value="Worksheets">Worksheets</option>
                    <option value="English Vocabulary">English Vocabulary</option>
                    <option value="Daily Sentences">Daily Sentences</option>
                    <option value="Grammar Guides">Grammar Guides</option>
                    <option value="Speaking Practice">Speaking Practice</option>
                    <option value="E-books">E-books</option>
                    <option value="Study Notes">Study Notes</option>
                  </select>
                </div>
              </div>

              {/* Protected Notice Banner */}
              <div className="p-4 rounded-2xl bg-linear-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#4A1D96] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Protected PDF Viewing Engine Active</h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      PDF notes and worksheets are stored in <strong>Backblaze B2</strong> and rendered in a secure View-Only container. Right-click, Ctrl+S save, and native saving are intercepted to protect academy notes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-[11px] font-bold text-purple-900 bg-white/80 px-3 py-1.5 rounded-xl border border-purple-200">
                  <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Backblaze B2 Cloud Storage</span>
                </div>
              </div>

              {/* PDF STUDY GUIDES GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPdfs.length > 0 ? (
                  filteredPdfs.map((mat) => {
                    const batchObj = batches.find(b => b.id === mat.batchId);
                    const opt = optimizePdfUrl(mat.pdfUrl || '');
                    const isPub = mat.isPublished !== false && mat.isVisibleOnWebsite !== false;

                    return (
                      <div
                        key={mat.id}
                        className={`p-4.5 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                          isPub ? 'border-slate-200 bg-[#FAF9FC] hover:border-purple-300 shadow-2xs' : 'border-dashed border-amber-300 bg-amber-50/40'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900">
                              {mat.category || 'Worksheets'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{mat.displayOrder || 1}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                {mat.fileSize || '1.8 MB'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 block truncate">
                              📚 {batchObj ? batchObj.name : 'Academy Wide (All Batches)'}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 mt-0.5 line-clamp-1">{mat.title}</h4>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-1">{mat.description}</p>
                          </div>

                          {/* Storage & Visibility Status Badges */}
                          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleTogglePublishMaterial(mat)}
                              className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                isPub
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                              }`}
                              title="Click to Toggle Publish / Draft status"
                            >
                              {isPub ? <Eye className="w-2.5 h-2.5 text-emerald-600" /> : <EyeOff className="w-2.5 h-2.5 text-amber-600" />}
                              <span>{isPub ? 'Published' : 'Draft (Unpublished)'}</span>
                            </button>

                            {mat.allowDownload ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1">
                                <Download className="w-2.5 h-2.5" />
                                <span>Download On</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>View-Only</span>
                              </span>
                            )}

                            {(mat.b2FileId || mat.b2FileName || mat.pdfUrl?.includes('backblazeb2.com') || mat.pdfUrl?.includes('/api/files/pdf/')) ? (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold flex items-center gap-1">
                                <Cloud className="w-2.5 h-2.5 text-indigo-600" />
                                <span>B2 Cloud</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium truncate max-w-[140px]">
                                {opt.provider}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setPreviewingPdfMaterial({
                              title: mat.title,
                              pdfUrl: mat.pdfUrl || mat.downloadUrl,
                              description: mat.description,
                              category: mat.category || 'Study Material',
                              batchName: batchObj?.name || 'Wits Lingo Academy'
                            })}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-[#4A1D96] text-[#4A1D96] hover:text-white border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Test View-Only Reader as a student"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Test Reader</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingMaterial(mat)}
                              className="p-1.5 text-slate-500 hover:text-[#4A1D96] hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Material & Replace PDF"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete PDF Resource"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    No PDF study guides match the selected filters. Click "Upload PDF Guide" to add materials.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* TAB 7: VIDEO LESSONS / YOUTUBE (ADMIN-CONTROLLED CMS) */}
        {/* ==================================================================== */}
        {activeTab === 'youtube-lessons' && (() => {
          const ytVideos = materials.filter(m => m.resourceType === 'youtube' || m.fileType === 'youtube');
          const publishedCount = ytVideos.filter(m => m.isPublished !== false && m.isVisibleOnWebsite !== false).length;
          const draftCount = ytVideos.length - publishedCount;

          const filteredVideos = ytVideos.filter(m => {
            const matchCat = youtubeCategoryFilter === 'all' || m.category === youtubeCategoryFilter;
            const isPub = m.isPublished !== false && m.isVisibleOnWebsite !== false;
            const matchPub = youtubePublishFilter === 'all' || (youtubePublishFilter === 'published' ? isPub : !isPub);
            const matchSearch = !youtubeSearchQuery.trim() ||
              m.title.toLowerCase().includes(youtubeSearchQuery.toLowerCase()) ||
              m.description.toLowerCase().includes(youtubeSearchQuery.toLowerCase());
            return matchCat && matchPub && matchSearch;
          }).sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

          return (
            <div className="space-y-6">
              {/* SECTION A: OFFICIAL YOUTUBE CHANNEL SETTINGS */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-red-100 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Youtube className="w-5 h-5 fill-red-600 text-red-600" />
                    </div>
                    <div>
                      <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                        Official YouTube Channel Settings
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure the official channel link for the top <strong>"Watch on YouTube"</strong> button across the entire public website.
                      </p>
                    </div>
                  </div>

                  <a
                    href={youtubeChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start md:self-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Test Channel Link</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2">
                  <div className="md:col-span-9 space-y-1.5">
                    <label className="font-bold text-slate-700 text-xs flex items-center justify-between">
                      <span>YouTube Channel URL</span>
                      <span className="text-[11px] text-slate-400 font-normal">Default: https://www.youtube.com/@witslingoeng</span>
                    </label>
                    <input
                      type="url"
                      value={youtubeChannelUrl}
                      onChange={(e) => setYoutubeChannelUrl(e.target.value)}
                      placeholder="https://www.youtube.com/@witslingoeng"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-600 text-xs text-slate-900 font-mono"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="button"
                      disabled={isSavingYoutubeChannel}
                      onClick={handleSaveYoutubeChannel}
                      className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingYoutubeChannel ? 'Saving...' : 'Save Channel URL'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION B: VIDEO LESSONS MANAGEMENT */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
                {/* Header & Stats */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                        Video Lessons CMS
                      </h2>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        {ytVideos.length} Videos
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage dynamic video lesson cards displayed in the website Learning Resources section.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setNewYouTubeResource({
                        youtubeUrl: '',
                        title: '',
                        description: 'Watch this video lesson for practical spoken English fluency.',
                        category: 'Daily English',
                        displayOrder: ytVideos.length + 1,
                        isPublished: true,
                        duration: 'Video Lesson',
                        thumbnailUrl: '',
                        b2ThumbnailId: '',
                        b2ThumbnailName: ''
                      });
                      setShowAddYouTubeModal(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Video</span>
                  </button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <span className="text-[11px] text-slate-500 font-medium block">Total Videos</span>
                    <span className="text-lg font-extrabold text-slate-800 font-['Outfit']">{ytVideos.length}</span>
                  </div>
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl">
                    <span className="text-[11px] text-emerald-700 font-medium block">Published (Live)</span>
                    <span className="text-lg font-extrabold text-emerald-900 font-['Outfit']">{publishedCount}</span>
                  </div>
                  <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl">
                    <span className="text-[11px] text-amber-700 font-medium block">Drafts (Hidden)</span>
                    <span className="text-lg font-extrabold text-amber-900 font-['Outfit']">{draftCount}</span>
                  </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search video title, description..."
                      value={youtubeSearchQuery}
                      onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:border-red-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={youtubeCategoryFilter}
                      onChange={(e) => setYoutubeCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:border-red-600"
                    >
                      <option value="all">All Categories</option>
                      <option value="Pronunciation & Phonics">Pronunciation & Phonics</option>
                      <option value="Spoken English & Fluency">Spoken English & Fluency</option>
                      <option value="Learning Mindset">Learning Mindset</option>
                      <option value="English Foundations">English Foundations</option>
                      <option value="Daily Motivation">Daily Motivation</option>
                      <option value="Daily English">Daily English</option>
                      <option value="Vocabulary">Vocabulary</option>
                      <option value="Grammar Made Easy">Grammar Made Easy</option>
                      <option value="General">General</option>
                    </select>

                    <select
                      value={youtubePublishFilter}
                      onChange={(e) => setYoutubePublishFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:border-red-600"
                    >
                      <option value="all">All Status</option>
                      <option value="published">Published Only</option>
                      <option value="draft">Drafts Only</option>
                    </select>
                  </div>
                </div>

                {/* Videos Grid */}
                {filteredVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredVideos.map((mat) => {
                      const isPub = mat.isPublished !== false && mat.isVisibleOnWebsite !== false;
                      const thumb = mat.thumbnailUrl || (mat.youtubeUrl ? `https://img.youtube.com/vi/${extractYouTubeVideoId(mat.youtubeUrl) || 'dQw4w9WgXcQ'}/hqdefault.jpg` : '');

                      return (
                        <div
                          key={mat.id}
                          className={`p-4.5 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                            isPub ? 'border-slate-200 bg-[#FAF9FC] hover:border-red-300 shadow-2xs' : 'border-dashed border-amber-300 bg-amber-50/40'
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Video Thumbnail Preview */}
                            <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden group shadow-inner">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={mat.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                                  <Youtube className="w-8 h-8 text-red-500" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                                  <Play className="w-4 h-4 fill-white ml-0.5" />
                                </div>
                              </div>
                              {mat.duration && (
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white">
                                  {mat.duration}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                              <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                {mat.category || 'Daily English'}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Order #{mat.displayOrder || 1}
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-sm text-slate-900 line-clamp-2">{mat.title}</h4>
                              <p className="text-xs text-slate-600 line-clamp-2 mt-1">{mat.description}</p>
                            </div>

                            {/* Status & Thumbnail Tag */}
                            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => handleTogglePublishMaterial(mat)}
                                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                  isPub
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                }`}
                                title="Click to Toggle Publish / Draft status"
                              >
                                {isPub ? <Eye className="w-2.5 h-2.5 text-emerald-600" /> : <EyeOff className="w-2.5 h-2.5 text-amber-600" />}
                                <span>{isPub ? 'Published' : 'Draft'}</span>
                              </button>

                              {mat.b2ThumbnailId ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                                  Custom B2 Thumbnail
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                  Auto YouTube Thumbnail
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                            <a
                              href={mat.youtubeUrl || youtubeChannelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Test Video URL</span>
                            </a>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingMaterial(mat)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Video Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Video"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <Youtube className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No video lessons found</p>
                    <p className="text-xs text-slate-500 mt-1">Click "+ Add Video" above to add your first YouTube video lesson.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* TAB: HOMEPAGE HERO VIDEO MANAGEMENT (BACKBLAZE B2 & CDN) */}
        {/* ==================================================================== */}
        {activeTab === 'hero-video' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-8">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3B0764] to-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                    <Film className="w-4 h-4" />
                  </div>
                  <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                    Hero Video Management
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live on Homepage
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Backblaze B2 & CDN
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Manage, preview, upload, and publish the full-bleed video playing in the main WITS LINGO homepage Hero background.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleResetHeroVideo}
                  id="hero-video-reset-btn"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset hero video to original academy intro video"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset to Default Video</span>
                </button>

                {onBackToHome && (
                  <button
                    type="button"
                    onClick={onBackToHome}
                    id="hero-video-view-live-btn"
                    className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#4A1D96] text-xs font-bold flex items-center gap-1.5 transition-colors border border-purple-200 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>View on Live Homepage</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Live Video Player & Overlay Simulation */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-[#4A1D96]" />
                    <span>Current Active Video Preview</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSimulatedHeroOverlay(!simulatedHeroOverlay)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      simulatedHeroOverlay 
                        ? 'bg-purple-900 text-white border-purple-900' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Toggle dark cinematic overlay and text preview"
                  >
                    <Sparkles className="w-3 h-3 text-purple-300" />
                    <span>{simulatedHeroOverlay ? 'Overlay Simulation: ON' : 'Overlay Simulation: OFF'}</span>
                  </button>
                </div>

                {/* Video Container */}
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black border-2 border-purple-200 shadow-md">
                  <video
                    key={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                    src={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                    poster={localSettings.heroVideoPosterUrl || '/video/wits-lingo-poster.jpg'}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    className="w-full h-full object-cover"
                  />

                  {/* Simulated Cinematic Overlay */}
                  {simulatedHeroOverlay && (
                    <div 
                      className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6"
                      style={{ backgroundColor: 'rgba(26, 10, 52, 0.45)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                          Live Homepage Overlay Preview
                        </span>
                        <span className="text-[10px] text-purple-200 font-semibold">
                          Uniform Tint 45%
                        </span>
                      </div>

                      <div className="space-y-1.5 max-w-xs">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2E1065]/80 text-[9px] font-bold text-purple-200 uppercase">
                          {localSettings.academyName || 'WITS LINGO'}
                        </div>
                        <h4 className="text-white text-sm font-extrabold leading-tight">
                          Speak English with Confidence & Fluency
                        </h4>
                        <p className="text-purple-100/80 text-[10px] line-clamp-2">
                          Interactive Live Online Classes with Expert Mentors across India.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Video Info Pill */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Current Stream Source:</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      {(localSettings.heroVideoUrl || '').includes('backblazeb2.com') || (localSettings.heroVideoUrl || '').startsWith('/api/files/') ? (
                        <span className="text-purple-700 flex items-center gap-1">
                          <Cloud className="w-3.5 h-3.5" /> Backblaze B2 Cloud
                        </span>
                      ) : (
                        <span className="text-slate-700">Default Academy Asset</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-mono text-slate-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4');
                        setCopiedHeroUrl(true);
                        setTimeout(() => setCopiedHeroUrl(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                      title="Copy URL to clipboard"
                    >
                      {copiedHeroUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedHeroUrl ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Upload New Video / Replace / Publish Custom URL */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* Method 1: Upload Video File to Backblaze B2 */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50/60 via-white to-white border-2 border-purple-200/80 space-y-4 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#4A1D96] text-white flex items-center justify-center">
                      <UploadCloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Upload & Replace Video (Backblaze B2)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Upload a video file from your computer directly to your Backblaze B2 Cloud bucket.
                      </p>
                    </div>
                  </div>

                  {/* Drag & Drop File Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith('video/')) {
                          setSelectedHeroFile(file);
                        } else {
                          triggerFeedback('Please select a valid video file (MP4, WebM, MOV).');
                        }
                      }
                    }}
                    className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/60 rounded-2xl p-6 text-center transition-all cursor-pointer relative"
                  >
                    <input
                      type="file"
                      id="hero-video-file-input"
                      accept="video/mp4,video/webm,video/quicktime"
                      disabled={isUploadingHeroVideo}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedHeroFile(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    <div className="space-y-2 pointer-events-none">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-purple-200 text-[#4A1D96] flex items-center justify-center mx-auto shadow-2xs">
                        <Film className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {selectedHeroFile ? (
                          <span className="text-purple-900 font-extrabold">{selectedHeroFile.name} ({(selectedHeroFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        ) : (
                          <span>Click to browse or drag & drop video file here</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Supported: <strong className="text-slate-700">MP4, WebM, MOV</strong> (1080p / 720p recommended)
                      </p>
                    </div>
                  </div>

                  {/* Upload Action Button */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={!selectedHeroFile || isUploadingHeroVideo}
                      onClick={() => {
                        if (selectedHeroFile) {
                          handleUploadHeroVideo(selectedHeroFile);
                        }
                      }}
                      id="hero-video-upload-btn"
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                        !selectedHeroFile || isUploadingHeroVideo
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-[#4A1D96] hover:bg-[#3B0764] text-white shadow-purple-900/20 active:scale-98'
                      }`}
                    >
                      {isUploadingHeroVideo ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Uploading Video to Backblaze B2...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>Upload & Set Live on Homepage</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Method 2: Set Custom Video URL / CDN Link */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Publish Direct Video URL / CDN Link
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Provide a direct Backblaze B2 public link, Cloudflare CDN, or custom host URL.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Video Stream URL:
                      </label>
                      <input
                        type="text"
                        value={customHeroVideoUrl}
                        onChange={(e) => setCustomHeroVideoUrl(e.target.value)}
                        placeholder="e.g. https://f005.backblazeb2.com/file/my-bucket/intro.mp4"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#4A1D96] bg-slate-50 focus:bg-white text-xs font-mono text-slate-900 focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePublishHeroVideoUrl(customHeroVideoUrl)}
                      id="hero-video-publish-url-btn"
                      className="w-full py-2.5 rounded-xl bg-purple-50 hover:bg-[#4A1D96] text-[#4A1D96] hover:text-white border border-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Publish & Set Active</span>
                    </button>
                  </div>
                </div>

                {/* Video Optimization Best Practices Info */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Best Practices for Homepage Video:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
                    <li>Recommended format: <strong>H.264 MP4</strong> (universally supported on iPhone/Android/Desktop).</li>
                    <li>Ideal resolution: <strong>1080p (1920x1080)</strong> or <strong>720p (1280x720)</strong>.</li>
                    <li>Audio is automatically muted in background so modern browsers autoplay smoothly without user interaction.</li>
                  </ul>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB: GALLERY & MEDIA MANAGEMENT (BACKBLAZE B2 STORAGE) */}
        {/* ==================================================================== */}
        {activeTab === 'gallery' && (() => {
          const filteredGallery = galleryItems.filter(item => {
            const matchesQuery = !gallerySearchQuery.trim() || 
              (item.title || '').toLowerCase().includes(gallerySearchQuery.toLowerCase()) ||
              (item.caption || '').toLowerCase().includes(gallerySearchQuery.toLowerCase()) ||
              (item.category || '').toLowerCase().includes(gallerySearchQuery.toLowerCase());
            
            const matchesCat = galleryCategoryFilter === 'all' || (item.category || '').toLowerCase() === galleryCategoryFilter.toLowerCase();
            
            const matchesPublish = galleryPublishFilter === 'all' || 
              (galleryPublishFilter === 'published' && item.isPublished) ||
              (galleryPublishFilter === 'draft' && !item.isPublished);

            return matchesQuery && matchesCat && matchesPublish;
          });

          const allCategories = ['Classrooms', 'Live Sessions', 'Events & Workshops', 'Student Activities', 'Community', 'General'];
          const publishedCount = galleryItems.filter(i => i.isPublished).length;
          const draftCount = galleryItems.filter(i => !i.isPublished).length;

          return (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3B0764] to-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                      Gallery & Media Management
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Backblaze B2 Synced
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {publishedCount} Live on /gallery
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Upload, organize, edit metadata, and publish classroom moments and student activities to the public website gallery.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedUploadFiles([]);
                      setShowAddGalleryModal(true);
                    }}
                    id="admin-add-gallery-btn"
                    className="px-4 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-purple-900/20 active:scale-98 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload New Photos (B2)</span>
                  </button>

                  {onBackToHome && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash = '#gallery';
                        window.location.reload();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#4A1D96] text-xs font-bold flex items-center gap-1.5 transition-colors border border-purple-200 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>View Public Gallery</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Photos</span>
                  <span className="text-xl font-extrabold text-[#4A1D96] font-['Outfit']">{galleryItems.length}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-700 block">Published Live</span>
                  <span className="text-xl font-extrabold text-emerald-800 font-['Outfit']">{publishedCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 block">Draft / Hidden</span>
                  <span className="text-xl font-extrabold text-slate-700 font-['Outfit']">{draftCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1">
                  <span className="text-[11px] font-semibold text-amber-700 block">Categories</span>
                  <span className="text-xl font-extrabold text-amber-800 font-['Outfit']">{allCategories.length}</span>
                </div>
              </div>

              {/* Filters & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span>Category:</span>
                    <select
                      value={galleryCategoryFilter}
                      onChange={(e) => setGalleryCategoryFilter(e.target.value)}
                      className="bg-transparent text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {allCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <span>Status:</span>
                    <select
                      value={galleryPublishFilter}
                      onChange={(e) => setGalleryPublishFilter(e.target.value as any)}
                      className="bg-transparent text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="published">Published Only</option>
                      <option value="draft">Drafts Only</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search moments by title, caption..."
                    value={gallerySearchQuery}
                    onChange={(e) => setGallerySearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-8.5 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#4A1D96]"
                  />
                </div>
              </div>

              {/* Gallery Items Grid */}
              {filteredGallery.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {filteredGallery.map((item, index) => (
                    <div
                      key={item.id}
                      className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all bg-white shadow-2xs hover:shadow-md ${
                        item.isPublished ? 'border-purple-200/90' : 'border-slate-300 opacity-80'
                      }`}
                    >
                      {/* Image Frame */}
                      <div className="relative aspect-4/3 overflow-hidden bg-slate-900 group">
                        <img
                          src={item.imageUrl}
                          alt={item.title || 'Gallery item'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Order & Category Badges */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                          <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white">
                            #{item.displayOrder || (index + 1)}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#4A1D96]/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                            {item.category || 'Classrooms'}
                          </span>
                        </div>

                        {/* Publish Status Badge */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <button
                            type="button"
                            onClick={() => handleToggleGalleryPublish(item)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase transition-all shadow-xs cursor-pointer ${
                              item.isPublished
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-slate-700 text-slate-200 hover:bg-slate-800'
                            }`}
                            title="Click to toggle publish / draft"
                          >
                            {item.isPublished ? 'Live' : 'Draft'}
                          </button>
                        </div>

                        {/* Hover Quick Preview Button */}
                        <div 
                          onClick={() => setPreviewGalleryItem(item)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                          <div className="px-3 py-1.5 rounded-xl bg-white/90 text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-md">
                            <Eye className="w-3.5 h-3.5 text-[#4A1D96]" />
                            <span>Preview</span>
                          </div>
                        </div>
                      </div>

                      {/* Details & Actions */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="font-['Outfit'] font-bold text-sm text-slate-900 line-clamp-1">
                            {item.title || 'Untitled Moment'}
                          </h4>
                          {item.caption ? (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {item.caption}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No description provided</p>
                          )}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{item.fileSize || 'Image'}</span>
                            <span>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : ''}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          {/* Reorder Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveGalleryOrder(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4A1D96] hover:bg-purple-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move photo up in order"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveGalleryOrder(index, 'down')}
                              disabled={index === filteredGallery.length - 1}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4A1D96] hover:bg-purple-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move photo down in order"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Edit, Preview & Delete */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingGalleryItem(item)}
                              className="p-1.5 text-slate-600 hover:text-[#4A1D96] hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit photo title, caption, category"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGalleryPhoto(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 px-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#4A1D96] flex items-center justify-center mx-auto">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h4 className="font-['Outfit'] font-bold text-base text-slate-800">
                    No Gallery Photos Found
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {gallerySearchQuery || galleryCategoryFilter !== 'all' || galleryPublishFilter !== 'all'
                      ? 'No photos match your active search or filter criteria.'
                      : 'Upload classroom photos and moments to get started.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGallerySearchQuery('');
                      setGalleryCategoryFilter('all');
                      setGalleryPublishFilter('all');
                      setShowAddGalleryModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#4A1D96] text-white text-xs font-bold hover:bg-[#3B0764] transition-colors cursor-pointer"
                  >
                    Upload First Photo
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* TAB 7: STUDENT TESTIMONIALS & REVIEWS CMS */}
        {/* ==================================================================== */}
        {activeTab === 'testimonials' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                  Homepage Student Testimonials CMS
                </h2>
                <p className="text-xs text-slate-500">
                  Control all student reviews displayed in the "Student Success & Reviews" section of the website.
                </p>
              </div>

              <button
                onClick={() => setShowAddTestimonialModal(true)}
                id="admin-add-testimonial-btn"
                className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Student Review</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((test) => (
                <div
                  key={test.id}
                  className="p-5 rounded-2xl border border-purple-100 bg-[#FAF9FC] space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{test.studentName}</h4>
                        <p className="text-[11px] text-purple-700 font-semibold">{test.courseBatch}</p>
                      </div>
                      {test.verified && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 italic leading-relaxed">
                      "{test.testimonial}"
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">Location: {test.city || 'India'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingTestimonial({ ...test })}
                      className="px-3 py-1.5 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 text-xs font-bold text-[#4A1D96] transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTestimonial(test.id, test.studentName)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Testimonial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 7b: ACADEMY NOTICES, HOLIDAYS & BATCH CIRCULARS */}
        {/* ==================================================================== */}
        {activeTab === 'announcements' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                    Academy Notices, Holidays & Batch Circulars
                  </h2>
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    {localAnnouncements.length} Total
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Manage official academy holiday notices, batch class circulars, and schedule adjustments. Any changes appear instantly on the live website notice board and in the official popup circular.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  id="admin-add-announcement-btn"
                  onClick={() => setShowAddAnnouncementModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Notice / Holiday</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: 'all', label: 'All Notices' },
                { id: 'Holiday', label: '🏖️ Holidays' },
                { id: 'Class Notice', label: '📢 Class Notices' },
                { id: 'Schedule Change', label: '🕒 Schedule Changes' },
                { id: 'Urgent Alert', label: '🚨 Urgent Alerts' },
                { id: 'General', label: '📌 General Updates' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setAnnouncementFilter(filter.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    announcementFilter === filter.id
                      ? 'bg-[#4A1D96] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Announcements List */}
            <div className="space-y-3.5">
              {localAnnouncements
                .filter(a => announcementFilter === 'all' || a.category === announcementFilter)
                .map((ann) => {
                  const isHoliday = ann.category === 'Holiday';
                  const isClassNotice = ann.category === 'Class Notice';
                  const isSchedule = ann.category === 'Schedule Change';
                  const isUrgent = ann.priority === 'Urgent';

                  return (
                    <div
                      key={ann.id}
                      className="p-5 rounded-2xl border border-slate-200/90 hover:border-purple-200 bg-white hover:bg-purple-50/20 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                            isHoliday
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : isClassNotice
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                              : isSchedule
                              ? 'bg-blue-100 text-blue-900 border-blue-200'
                              : 'bg-purple-100 text-purple-900 border-purple-200'
                          }`}>
                            {isHoliday ? '🏖️ Holiday Notice' : isClassNotice ? '📢 Class Notice' : isSchedule ? '🕒 Schedule Update' : '📌 Notice'}
                          </span>

                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isUrgent
                              ? 'bg-rose-100 text-rose-800'
                              : ann.priority === 'Important'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ann.priority} Priority
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTogglePinAnnouncement(ann.id)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                              ann.isPinned
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="Toggle pin to top of homepage board"
                          >
                            <Pin className={`w-3 h-3 ${ann.isPinned ? 'fill-amber-600 text-amber-600' : ''}`} />
                            <span>{ann.isPinned ? 'Pinned' : 'Pin'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Published: {ann.date}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 font-['Outfit']">
                          {ann.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line line-clamp-3 leading-relaxed">
                          {ann.message}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-3 flex-wrap text-slate-500">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Target: {ann.batchName}
                          </span>
                          {ann.effectiveDate && (
                            <span className="text-purple-700 font-medium">
                              Effective: {ann.effectiveDate}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewingAnnouncement(ann)}
                            className="px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#4A1D96] font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Popup</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingAnnouncement(ann)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Notice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Notice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {localAnnouncements.filter(a => announcementFilter === 'all' || a.category === announcementFilter).length === 0 && (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Megaphone className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No notices found</p>
                  <p className="text-xs text-slate-500 mt-1">Publish a new holiday notice or class circular using the button above.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8: WEBSITE SETTINGS & ACADEMY CMS */}
        {/* ==================================================================== */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="font-['Outfit'] font-bold text-xl text-slate-900">
                Website Content & Institutional Settings CMS
              </h2>
              <p className="text-xs text-slate-500">
                Change your academy contact details, announcement bar, founder highlights, and social links in real time.
              </p>
            </div>

            <form onSubmit={handleSaveSiteSettings} className="space-y-6">
              {/* Announcement Bar & Live Preview */}
              <div className="p-6 rounded-3xl bg-purple-50/70 border-2 border-purple-200/80 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Top Website Announcement Banner (CMS)</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-200 text-[#3B0764]">
                          Live Header
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Controls the purple announcement bar at the very top of your website and the hero notice badge.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 bg-white px-3.5 py-1.5 rounded-xl border border-purple-200 shadow-xs self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={localSettings.showAnnouncement}
                      onChange={(e) => setLocalSettings({ ...localSettings, showAnnouncement: e.target.checked })}
                      className="w-4 h-4 rounded text-[#4A1D96] accent-[#4A1D96] cursor-pointer"
                    />
                    <span>{localSettings.showAnnouncement ? '🟢 Banner Active' : '⚪ Banner Hidden'}</span>
                  </label>
                </div>

                {/* Live Header Simulation Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 flex items-center gap-1.5">
                      <span>Live Website Header Preview</span>
                      <span className="text-[10px] text-purple-700 font-semibold">(Updates in real-time as you type)</span>
                    </span>
                    {!localSettings.showAnnouncement && (
                      <span className="text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded">
                        Currently hidden on website
                      </span>
                    )}
                  </div>

                  <div className={`relative overflow-hidden rounded-2xl border ${localSettings.showAnnouncement ? 'border-purple-900 shadow-md' : 'border-slate-300 opacity-60'}`}>
                    <div className="bg-gradient-to-r from-[#2E1065] via-[#4A1D96] to-[#3B0764] text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2 flex-wrap sm:flex-nowrap">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="font-medium truncate max-w-xl">
                        {localSettings.announcementText || 'New Batch Starts from 1st of each month • Admissions Open for October & November 2026'}
                      </span>
                      {localSettings.announcementBtnText ? (
                        <span className="underline ml-2 font-semibold text-purple-200 flex-shrink-0">
                          {localSettings.announcementBtnText}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Fields for Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="md:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      Banner Announcement Message *
                    </label>
                    <input
                      type="text"
                      required
                      value={localSettings.announcementText}
                      onChange={(e) => setLocalSettings({ ...localSettings, announcementText: e.target.value })}
                      placeholder="e.g. New Batch Starts from 1st of each month • Admissions Open for October & November 2026"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-300 bg-white text-xs text-slate-900 font-medium focus:outline-hidden focus:border-[#4A1D96] shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      Action Button Text
                    </label>
                    <input
                      type="text"
                      value={localSettings.announcementBtnText || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, announcementBtnText: e.target.value })}
                      placeholder="Optional (leave empty for no button)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-300 bg-white text-xs text-slate-900 font-medium focus:outline-hidden focus:border-[#4A1D96] shadow-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Opens the admission registration popup</span>
                  </div>
                </div>

                {/* Quick 1-Click Preset Templates */}
                <div className="pt-2 border-t border-purple-200/60">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    💡 Quick Presets (Click to apply template):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalSettings({
                        ...localSettings,
                        announcementText: 'New Batch Starts from 1st of each month • Admissions Open for October & November 2026',
                        announcementBtnText: '',
                        showAnnouncement: true
                      })}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100/80 text-purple-900 border border-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      📅 1st of Each Month (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalSettings({
                        ...localSettings,
                        announcementText: '⚡ Admissions Open for Next Month Batch — Only 5 Seats Left for Personal Speaking Attention!',
                        announcementBtnText: 'Claim Your Seat →',
                        showAnnouncement: true
                      })}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100/80 text-purple-900 border border-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      🚨 Limited Seats Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalSettings({
                        ...localSettings,
                        announcementText: '🏖️ Academy Holiday Notice: Classes Closed for Holiday Observance • Online Drills Active 24/7',
                        announcementBtnText: 'View Details →',
                        showAnnouncement: true
                      })}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100/80 text-purple-900 border border-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      🏖️ Holiday Notice
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalSettings({
                        ...localSettings,
                        announcementText: '🎉 Free Live Spoken English Trial Class This Weekend • Limited Free Registrations Open!',
                        announcementBtnText: 'Book Free Demo →',
                        showAnnouncement: true
                      })}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100/80 text-purple-900 border border-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      🎉 Free Demo Weekend
                    </button>
                  </div>
                </div>
              </div>

              {/* Batches & Seat Capacity Section Visibility Control */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-amber-50/40 border border-purple-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Batches & Seat Capacity Public Section</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          (localSettings.showBatchesSection ?? true)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {(localSettings.showBatchesSection ?? true) ? 'Live Section' : 'Section Hidden'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Controls whether the "Upcoming Batches & Seat Capacity" section is rendered on the public website homepage and navbar.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 bg-white px-3.5 py-1.5 rounded-xl border border-purple-200 shadow-2xs self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={localSettings.showBatchesSection ?? true}
                      onChange={(e) => setLocalSettings({ ...localSettings, showBatchesSection: e.target.checked })}
                      className="w-4 h-4 rounded text-[#4A1D96] accent-[#4A1D96] cursor-pointer"
                    />
                    <span>{(localSettings.showBatchesSection ?? true) ? '🟢 Section Visible' : '⚪ Section Hidden'}</span>
                  </label>
                </div>
              </div>

              {/* Hero Video Management & Backblaze B2 Storage */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#2E1065]/5 via-white to-purple-50/60 border-2 border-purple-200/80 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/70 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Hero Section Video Management</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                          Backblaze B2 & CDN
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Controls the full-screen cinematic video playing in the homepage hero section.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetHeroVideo}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to Default Video</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Preview Player */}
                  <div className="md:col-span-4 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">Current Hero Video Preview:</span>
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-purple-200 shadow-xs relative">
                      <video
                        key={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                        src={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                        Active Hero Visual
                      </div>
                    </div>
                  </div>

                  {/* Video URL & Upload Action */}
                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        Hero Video URL (Backblaze B2 Direct Link or Local Path)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={localSettings.heroVideoUrl || '/video/wits-lingo-intro.mp4'}
                          onChange={(e) => setLocalSettings({ ...localSettings, heroVideoUrl: e.target.value })}
                          placeholder="e.g. /video/wits-lingo-intro.mp4 or https://f005.backblazeb2.com/file/..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 bg-white text-xs font-mono text-slate-900 focus:outline-hidden focus:border-[#4A1D96]"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Default: <code className="text-purple-700 font-bold">/video/wits-lingo-intro.mp4</code>. Backblaze B2 and cloud CDN streams are supported.
                      </span>
                    </div>

                    {/* File Upload to B2 & Server */}
                    <div className="p-4 rounded-2xl bg-white border border-purple-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                          <span>Upload New Video File (MP4 / WebM)</span>
                        </span>
                        {isUploadingHeroVideo && (
                          <span className="text-[11px] font-bold text-purple-700 animate-pulse flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Uploading to Storage...
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Uploads directly to your Backblaze B2 storage bucket and updates the homepage hero video immediately.
                      </p>
                      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold cursor-pointer transition-all shadow-xs ${isUploadingHeroVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Download className="w-3.5 h-3.5 rotate-180" />
                        <span>{isUploadingHeroVideo ? 'Uploading Video...' : 'Choose MP4/WebM Video to Upload'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          disabled={isUploadingHeroVideo}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleUploadHeroVideo(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Central Website Logo Management & Backblaze B2 Storage */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/50 border-2 border-purple-200/90 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/70 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3B0764] to-[#6D28D9] text-white flex items-center justify-center shadow-xs">
                      <ImageIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Main Website Logo & Central Branding</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-[#4A1D96] border border-purple-200">
                          Backblaze B2 Storage
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Upload or replace the official website logo. Updates Navbar, Footer, Mobile Header, and all academy branding across the platform.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5 shadow-2xs"
                    title="Reset to default mascot SVG logo"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-purple-700" />
                    <span>Reset to Default Logo</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Current Active Logo Preview */}
                  <div className="md:col-span-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Active Website Logo Preview:
                      </span>
                      <div className="flex items-center gap-1 text-[10px] bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setLogoPreviewBg('dark')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            logoPreviewBg === 'dark' ? 'bg-[#1E1B26] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Dark Bg
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoPreviewBg('light')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                            logoPreviewBg === 'light' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Light Bg
                        </button>
                      </div>
                    </div>

                    <div
                      className={`w-full p-6 rounded-2xl border flex flex-col items-center justify-center min-h-[140px] transition-colors relative shadow-2xs ${
                        logoPreviewBg === 'dark'
                          ? 'bg-[#1E1B26] border-slate-800 text-white'
                          : 'bg-white border-purple-200 text-slate-900'
                      }`}
                    >
                      <div className="w-20 h-20 rounded-full flex items-center justify-center p-1 relative overflow-hidden bg-white/10 border border-white/20 shadow-md">
                        <img
                          src={logoPreviewUrl || (localSettings.logoUrl ? `${localSettings.logoUrl}${localSettings.logoVersion ? '?v=' + localSettings.logoVersion : ''}` : '/logo.svg')}
                          alt="Website Logo Preview"
                          className="w-full h-full object-contain rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                          }}
                        />
                      </div>
                      <div className="mt-2 text-center">
                        <span className="text-xs font-black uppercase font-['Outfit'] tracking-wide block">
                          WITS LINGO
                        </span>
                        <span className={`text-[10px] ${logoPreviewBg === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                          A Global Language Platform
                        </span>
                      </div>

                      {logoPreviewUrl && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 font-bold text-[9px] shadow-xs">
                          Unsaved Preview
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Upload & Action Area */}
                  <div className="md:col-span-7 space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 block text-xs">
                        Upload New Logo Image (PNG, JPG, WEBP, SVG)
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Recommended: Square (1:1) or circular transparent PNG/SVG with high resolution (e.g. 512×512px). Maximum file size: 8MB.
                      </p>
                    </div>

                    {logoUploadError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{logoUploadError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <label
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-purple-300 hover:border-[#4A1D96] bg-white hover:bg-purple-50/50 text-slate-700 text-xs font-bold transition-colors cursor-pointer ${
                          isUploadingLogo ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <UploadCloud className="w-4 h-4 text-[#4A1D96]" />
                        <span className="truncate">
                          {logoFile ? logoFile.name : 'Choose Logo File to Upload...'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          onChange={handleSelectLogoFile}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </label>

                      {logoPreviewUrl && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPreviewUrl(null);
                              setLogoUploadError(null);
                            }}
                            disabled={isUploadingLogo}
                            className="px-3 py-3 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-bold transition-colors cursor-pointer"
                            title="Cancel selection"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={handleUploadLogo}
                            disabled={isUploadingLogo}
                            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#4A1D96] to-[#6D28D9] hover:from-[#3B0764] hover:to-[#5B21B6] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-900/20 cursor-pointer disabled:opacity-50"
                          >
                            {isUploadingLogo ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Uploading to B2...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save & Publish Logo</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-[11px] text-purple-950 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <span>
                        Once published, the new logo is securely stored on Backblaze B2 and immediately loaded on the Navbar, Footer, Mobile Drawer, and student portal without rebuilding the code.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academy Identity & Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Academy Brand Name</label>
                  <input
                    type="text"
                    value={localSettings.academyName}
                    onChange={(e) => setLocalSettings({ ...localSettings, academyName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Tagline</label>
                  <input
                    type="text"
                    value={localSettings.tagline}
                    onChange={(e) => setLocalSettings({ ...localSettings, tagline: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Primary Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={localSettings.phone1}
                    onChange={(e) => setLocalSettings({ ...localSettings, phone1: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Secondary Phone</label>
                  <input
                    type="text"
                    value={localSettings.phone2}
                    onChange={(e) => setLocalSettings({ ...localSettings, phone2: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Email</label>
                  <input
                    type="email"
                    value={localSettings.email}
                    onChange={(e) => setLocalSettings({ ...localSettings, email: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Physical Academy Location / Address</label>
                  <input
                    type="text"
                    value={localSettings.address}
                    onChange={(e) => setLocalSettings({ ...localSettings, address: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Social URLs */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Official Channels & Social Links
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">WhatsApp Channel URL</label>
                    <input
                      type="url"
                      value={localSettings.whatsappChannelUrl}
                      onChange={(e) => setLocalSettings({ ...localSettings, whatsappChannelUrl: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Instagram URL</label>
                    <input
                      type="url"
                      value={localSettings.instagramUrl}
                      onChange={(e) => setLocalSettings({ ...localSettings, instagramUrl: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">YouTube Channel URL</label>
                    <input
                      type="url"
                      value={localSettings.youtubeUrl}
                      onChange={(e) => setLocalSettings({ ...localSettings, youtubeUrl: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Facebook URL</label>
                    <input
                      type="url"
                      value={localSettings.facebookUrl}
                      onChange={(e) => setLocalSettings({ ...localSettings, facebookUrl: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Bank Account & Payment Options Configuration */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50/70 via-white to-emerald-50/30 border-2 border-purple-200/80 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Direct Bank Account & Payment Options Setup</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          Incoming Payments
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Configure your official bank account details, UPI ID, and SWIFT code to receive student fee transfers directly into your bank account.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Bank Name *</label>
                    <input
                      type="text"
                      value={localSettings.bankName || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankName: e.target.value })}
                      placeholder="e.g. State Bank of India"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Account Holder Name *</label>
                    <input
                      type="text"
                      value={localSettings.bankAccountHolder || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankAccountHolder: e.target.value })}
                      placeholder="e.g. Wits Lingo Academy / Mohammad Ziya"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Account Number *</label>
                    <input
                      type="text"
                      value={localSettings.bankAccountNumber || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankAccountNumber: e.target.value })}
                      placeholder="e.g. 38920194821"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">IFSC Code *</label>
                    <input
                      type="text"
                      value={localSettings.bankIfscCode || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankIfscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Account Type</label>
                    <select
                      value={localSettings.bankAccountType || 'Current Account'}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankAccountType: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="Current Account">Current Account (Business)</option>
                      <option value="Savings Account">Savings Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Branch Location</label>
                    <input
                      type="text"
                      value={localSettings.bankBranch || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankBranch: e.target.value })}
                      placeholder="e.g. Amroha Main Branch, Uttar Pradesh, India"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      International SWIFT / BIC Code (For All Countries Remittance)
                    </label>
                    <input
                      type="text"
                      value={localSettings.bankSwiftBic || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, bankSwiftBic: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBININBB123"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono uppercase"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Used by foreign banks worldwide for direct international inward wires in all currencies</span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Primary UPI ID (Google Pay / PhonePe / Paytm / QR)</label>
                    <input
                      type="text"
                      value={localSettings.upiId || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, upiId: e.target.value })}
                      placeholder="e.g. 8791287575@ybl"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">PhonePe / Google Pay Registered Mobile Number</label>
                    <input
                      type="text"
                      value={localSettings.upiNumber || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, upiNumber: e.target.value })}
                      placeholder="e.g. +91 8791287575"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">
                      Razorpay Payment Gateway Link (For Cards, NetBanking & International)
                    </label>
                    <input
                      type="url"
                      value={localSettings.razorpayPaymentLink || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, razorpayPaymentLink: e.target.value })}
                      placeholder="https://rzp.io/l/witslingo"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Direct students to your official Razorpay payment page for instant card, net banking, or international card checkouts.
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Highlights */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Our Accomplishments & Stats Numbers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Completed Batches Metric</label>
                    <input
                      type="text"
                      value={localSettings.batchesCompletedCount}
                      onChange={(e) => setLocalSettings({ ...localSettings, batchesCompletedCount: e.target.value })}
                      placeholder="15+"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Students Improved Metric</label>
                    <input
                      type="text"
                      value={localSettings.activeStudentsCount}
                      onChange={(e) => setLocalSettings({ ...localSettings, activeStudentsCount: e.target.value })}
                      placeholder="100+"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Security Password */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#4A1D96]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Admin Security Passkey / Password
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500">
                  This is the simple security key required to open the Admin Dashboard from the website footer.
                </p>
                <div className="max-w-xs pt-1">
                  <input
                    type="text"
                    value={localSettings.adminPasskey || 'admin123'}
                    onChange={(e) => setLocalSettings({ ...localSettings, adminPasskey: e.target.value })}
                    placeholder="admin123"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  id="admin-save-settings-btn"
                  className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-md shadow-purple-900/10"
                >
                  <Save className="w-4 h-4" />
                  <span>Save All Website Settings</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* AUTOMATION TABS: ORDERS & PAYMENTS, WHATSAPP, TICKETS, KNOWLEDGE BASE */}
        {/* ==================================================================== */}
        {(activeTab === 'orders-payments' || 
          activeTab === 'whatsapp-notifications' || 
          activeTab === 'support-tickets' || 
          activeTab === 'knowledge-base') && (
          <AdminAutomationTabs activeTab={activeTab} token={token} />
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADMIT NEW STUDENT */}
        {/* ==================================================================== */}
        {showAddStudentModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Admit New Student to Batch
                </h3>
                <button
                  onClick={() => setShowAddStudentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="e.g. Mohammad Bilal"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Father's Name *</label>
                    <input
                      type="text"
                      required
                      value={newStudent.fatherName}
                      onChange={(e) => setNewStudent({ ...newStudent, fatherName: e.target.value })}
                      placeholder="Father's full name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={newStudent.dob}
                      onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CountryCodePhoneInput
                    id="admin-new-student-phone"
                    label="Mobile Phone"
                    required={true}
                    country={adminPhoneCountry}
                    onCountryChange={setAdminPhoneCountry}
                    phoneNumber={newStudent.phone}
                    onPhoneNumberChange={(cleanDigits) =>
                      setNewStudent((prev) => ({ ...prev, phone: cleanDigits }))
                    }
                    placeholder="9876543210"
                  />
                  <CountryCodePhoneInput
                    id="admin-new-student-whatsapp"
                    label="WhatsApp Number"
                    required={true}
                    country={adminWhatsappCountry}
                    onCountryChange={setAdminWhatsappCountry}
                    phoneNumber={newStudent.whatsapp}
                    onPhoneNumberChange={(cleanDigits) =>
                      setNewStudent((prev) => ({ ...prev, whatsapp: cleanDigits }))
                    }
                    placeholder="9876543210"
                    extraHeaderAction={
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWhatsappCountry(adminPhoneCountry);
                          setNewStudent((prev) => ({ ...prev, whatsapp: prev.phone }));
                        }}
                        className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                        title="Copy from Mobile Phone"
                      >
                        Same as Mobile
                      </button>
                    }
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                {/* Location Hierarchy: Country, State, District, Postal Code */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="mb-2">
                    <span className="font-bold text-slate-800 text-xs block">
                      Student Location & Address
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Country, State/Province, District/City, and Postal Code
                    </span>
                  </div>

                  <AddressHierarchySelector
                    country={newStudent.country}
                    onCountryChange={(newCountry) => {
                      setNewStudent((prev) => ({ ...prev, country: newCountry }));
                      const matched = ALL_COUNTRY_PHONE_CODES.find(
                        (c) => c.name.toLowerCase() === newCountry.toLowerCase()
                      );
                      if (matched) {
                        setAdminPhoneCountry(matched);
                        setAdminWhatsappCountry(matched);
                      }
                    }}
                    state={newStudent.state}
                    onStateChange={(newState) =>
                      setNewStudent((prev) => ({ ...prev, state: newState }))
                    }
                    district={newStudent.district}
                    onDistrictChange={(newDistrict) =>
                      setNewStudent((prev) => ({ ...prev, district: newDistrict }))
                    }
                    pincode={newStudent.pincode}
                    onPincodeChange={(newPincode) =>
                      setNewStudent((prev) => ({ ...prev, pincode: newPincode }))
                    }
                    address={newStudent.address}
                    onAddressChange={(newAddress) =>
                      setNewStudent((prev) => ({ ...prev, address: newAddress }))
                    }
                    required={true}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assign to Batch *</label>
                  <select
                    value={newStudent.batchId}
                    onChange={(e) => setNewStudent({ ...newStudent, batchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.batchCode})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Confirm Admission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT STUDENT */}
        {/* ==================================================================== */}
        {editingStudent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Edit Student Admission ({editingStudent.admissionId})
                </h3>
                <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStudent} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Father's Name</label>
                    <input
                      type="text"
                      value={editingStudent.fatherName || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone</label>
                    <input
                      type="text"
                      value={editingStudent.phone || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="mb-2">
                    <span className="font-bold text-slate-800 text-xs block">
                      Student Location & Address
                    </span>
                  </div>
                  <AddressHierarchySelector
                    country={editingStudent.country || 'India'}
                    onCountryChange={(c) => setEditingStudent((prev: any) => ({ ...prev, country: c }))}
                    state={editingStudent.state || ''}
                    onStateChange={(s) => setEditingStudent((prev: any) => ({ ...prev, state: s }))}
                    district={editingStudent.district || ''}
                    onDistrictChange={(d) => setEditingStudent((prev: any) => ({ ...prev, district: d }))}
                    pincode={editingStudent.pincode || ''}
                    onPincodeChange={(p) => setEditingStudent((prev: any) => ({ ...prev, pincode: p }))}
                    address={editingStudent.address || ''}
                    onAddressChange={(a) => setEditingStudent((prev: any) => ({ ...prev, address: a }))}
                    required={false}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Batch</label>
                  <select
                    value={editingStudent.batchId || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, batchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD NEW COURSE */}
        {/* ==================================================================== */}
        {showAddCourseModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-['Outfit'] font-bold text-xl text-slate-900">
                    Add New Course to Academy
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define course details, pricing, syllabus points, and choose whether to publish immediately or save as draft.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCourse} className="space-y-4 text-xs">
                {/* Publication Status Selector */}
                <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-purple-100 space-y-2">
                  <label className="font-bold text-slate-800 block text-xs">
                    Publication Status <span className="text-slate-400 font-normal">(Can be edited anytime)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewCourse({ ...newCourse, isPublished: true })}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        newCourse.isPublished !== false
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                      <div>
                        <span className="font-bold block text-xs">🟢 Publish to Live Website</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">Immediately visible & open for admissions</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewCourse({ ...newCourse, isPublished: false })}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        newCourse.isPublished === false
                          ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                      <div>
                        <span className="font-bold block text-xs">🟡 Save as Draft</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">Hidden from website, refine before publishing</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Course Name */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Course Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Spoken English & Accent Mastery"
                    value={newCourse.name || ''}
                    onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-900 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                  />
                </div>

                {/* Level & Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Target Level</label>
                    <select
                      value={newCourse.level || 'Beginner to Intermediate'}
                      onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Beginner to Intermediate">Beginner to Intermediate</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Intermediate to Advanced">Intermediate to Advanced</option>
                      <option value="Advanced">Advanced</option>
                      <option value="All Levels">All Levels</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Course Fee (INR ₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        value={newCourse.fee || 1499}
                        onChange={(e) => setNewCourse({ ...newCourse, fee: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 font-extrabold text-[#4A1D96] text-xs focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>
                  </div>
                </div>

                {/* Duration & Learning Format */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duration</label>
                    <input
                      type="text"
                      value={newCourse.duration || ''}
                      onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                      placeholder="e.g. 2.5 Months (50 Sessions)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Learning Format</label>
                    <input
                      type="text"
                      value={newCourse.learningFormat || ''}
                      onChange={(e) => setNewCourse({ ...newCourse, learningFormat: e.target.value })}
                      placeholder="e.g. Live Batches + Daily Speaking Drills"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                  </div>
                </div>

                {/* Badge / Ribbon */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Badge / Ribbon <span className="text-slate-400 font-normal">(Optional label shown on course card)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCourse.badge || ''}
                      onChange={(e) => setNewCourse({ ...newCourse, badge: e.target.value })}
                      placeholder="e.g. Popular Foundation, Most Popular, Career Boost"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                    <div className="flex items-center gap-1">
                      {['Popular Foundation', 'Most Popular', 'Career Boost'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNewCourse({ ...newCourse, badge: preset })}
                          className="px-2 py-1 bg-slate-100 hover:bg-purple-100 hover:text-[#4A1D96] rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                  <textarea
                    rows={2}
                    value={newCourse.shortDescription || ''}
                    onChange={(e) => setNewCourse({ ...newCourse, shortDescription: e.target.value })}
                    placeholder="Brief engaging overview of the course for website visitors"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs leading-relaxed focus:outline-hidden focus:border-[#4A1D96]"
                  />
                </div>

                {/* What You Will Learn (Interactive Bullet Points Manager) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 block text-xs">
                      What Students Learn (Curriculum Bullet Points) — {newCourse.whatYouWillLearn?.length || 0} Points
                    </label>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {newCourse.whatYouWillLearn && newCourse.whatYouWillLearn.length > 0 ? (
                      newCourse.whatYouWillLearn.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-[#4A1D96] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const updatedPoints = [...(newCourse.whatYouWillLearn || [])];
                              updatedPoints[idx] = e.target.value;
                              setNewCourse({ ...newCourse, whatYouWillLearn: updatedPoints });
                            }}
                            className="flex-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updatedPoints = (newCourse.whatYouWillLearn || []).filter((_, i) => i !== idx);
                              setNewCourse({ ...newCourse, whatYouWillLearn: updatedPoints });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic py-2">No learning outcomes added yet.</p>
                    )}
                  </div>

                  {/* Add Point Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add a new learning outcome point (e.g. Master interview self-pitch)..."
                      value={newBulletPointForAdd}
                      onChange={(e) => setNewBulletPointForAdd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newBulletPointForAdd.trim()) {
                            setNewCourse({
                              ...newCourse,
                              whatYouWillLearn: [...(newCourse.whatYouWillLearn || []), newBulletPointForAdd.trim()]
                            });
                            setNewBulletPointForAdd('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newBulletPointForAdd.trim()) {
                          setNewCourse({
                            ...newCourse,
                            whatYouWillLearn: [...(newCourse.whatYouWillLearn || []), newBulletPointForAdd.trim()]
                          });
                          setNewBulletPointForAdd('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4A1D96] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Course Facilities / Inclusions (Delivered on Admission & WhatsApp) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-800 block text-xs">
                        Course Facilities & Inclusions ({newCourse.facilities?.length || 0})
                      </label>
                      <p className="text-[10px] text-slate-500">Included in admission confirmation & WhatsApp messages</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {newCourse.facilities && newCourse.facilities.length > 0 ? (
                      newCourse.facilities.map((facility, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                            ✓
                          </span>
                          <input
                            type="text"
                            value={facility}
                            onChange={(e) => {
                              const updated = [...(newCourse.facilities || [])];
                              updated[idx] = e.target.value;
                              setNewCourse({ ...newCourse, facilities: updated });
                            }}
                            className="flex-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (newCourse.facilities || []).filter((_, i) => i !== idx);
                              setNewCourse({ ...newCourse, facilities: updated });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Facility"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic py-1">No facilities configured.</p>
                    )}
                  </div>

                  {/* Add Facility Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add facility (e.g. 1-on-1 speaking feedback sessions)..."
                      value={newFacilityForAdd}
                      onChange={(e) => setNewFacilityForAdd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newFacilityForAdd.trim()) {
                            setNewCourse({
                              ...newCourse,
                              facilities: [...(newCourse.facilities || []), newFacilityForAdd.trim()]
                            });
                            setNewFacilityForAdd('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newFacilityForAdd.trim()) {
                          setNewCourse({
                            ...newCourse,
                            facilities: [...(newCourse.facilities || []), newFacilityForAdd.trim()]
                          });
                          setNewFacilityForAdd('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddCourseModal(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{newCourse.isPublished !== false ? 'Publish Course Live' : 'Save as Draft Course'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT COURSE (Editable at any time, past or post publication) */}
        {/* ==================================================================== */}
        {editingCourse && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-['Outfit'] font-bold text-xl text-slate-900">
                      Edit Course: {editingCourse.name}
                    </h3>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        editingCourse.isPublished !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {editingCourse.isPublished !== false ? 'Live Published' : 'Draft / Unpublished'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin Control: Modify all course specifications, syllabus bullets, fees, and publication status anytime (past or post publication).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditCourse} className="space-y-4 text-xs">
                {/* Publication Status Toggle Card */}
                <div className="p-4 rounded-2xl bg-[#FAF9FC] border border-purple-100 space-y-2">
                  <label className="font-bold text-slate-800 block text-xs">
                    Publication Status (Switch anytime past or post publication)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingCourse({ ...editingCourse, isPublished: true })}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        editingCourse.isPublished !== false
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                      <div>
                        <span className="font-bold block text-xs">🟢 Live Published on Website</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">Displayed in course catalog and open for admissions</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingCourse({ ...editingCourse, isPublished: false })}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        editingCourse.isPublished === false
                          ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                      <div>
                        <span className="font-bold block text-xs">🟡 Draft / Unpublished</span>
                        <span className="text-[10px] text-slate-500 block leading-tight">Hidden from website visitors, safe to edit privately</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Course Name */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Course Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-900 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                  />
                </div>

                {/* Fee & Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Live Website Fee (INR ₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editingCourse.fee}
                        onChange={(e) => setEditingCourse({ ...editingCourse, fee: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 font-extrabold text-[#4A1D96] text-xs focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Target Level</label>
                    <select
                      value={editingCourse.level}
                      onChange={(e) => setEditingCourse({ ...editingCourse, level: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Beginner to Intermediate">Beginner to Intermediate</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Intermediate to Advanced">Intermediate to Advanced</option>
                      <option value="Advanced">Advanced</option>
                      <option value="All Levels">All Levels</option>
                    </select>
                  </div>
                </div>

                {/* Duration & Learning Format */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duration</label>
                    <input
                      type="text"
                      value={editingCourse.duration}
                      onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                      placeholder="e.g. 2 Months (40 Sessions)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Learning Format</label>
                    <input
                      type="text"
                      value={editingCourse.learningFormat || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, learningFormat: e.target.value })}
                      placeholder="e.g. Live Online Classroom (Evening Batches)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                  </div>
                </div>

                {/* Badge */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Badge / Ribbon <span className="text-slate-400 font-normal">(Shown on course card, or leave blank)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingCourse.badge || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, badge: e.target.value })}
                      placeholder="e.g. Popular Foundation, Most Popular, Career Boost"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#4A1D96]"
                    />
                    <div className="flex items-center gap-1">
                      {['Popular Foundation', 'Most Popular', 'Career Boost'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditingCourse({ ...editingCourse, badge: preset })}
                          className="px-2 py-1 bg-slate-100 hover:bg-purple-100 hover:text-[#4A1D96] rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                      {editingCourse.badge && (
                        <button
                          type="button"
                          onClick={() => setEditingCourse({ ...editingCourse, badge: '' })}
                          className="px-2 py-1 text-slate-400 hover:text-red-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                  <textarea
                    rows={2}
                    value={editingCourse.shortDescription}
                    onChange={(e) => setEditingCourse({ ...editingCourse, shortDescription: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs leading-relaxed focus:outline-hidden focus:border-[#4A1D96]"
                  />
                </div>

                {/* What You Will Learn (Interactive Bullet Points Manager) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 block text-xs">
                      What Students Learn (Curriculum Bullet Points) — {editingCourse.whatYouWillLearn?.length || 0} Points
                    </label>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {editingCourse.whatYouWillLearn && editingCourse.whatYouWillLearn.length > 0 ? (
                      editingCourse.whatYouWillLearn.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-[#4A1D96] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const updatedPoints = [...(editingCourse.whatYouWillLearn || [])];
                              updatedPoints[idx] = e.target.value;
                              setEditingCourse({ ...editingCourse, whatYouWillLearn: updatedPoints });
                            }}
                            className="flex-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updatedPoints = (editingCourse.whatYouWillLearn || []).filter((_, i) => i !== idx);
                              setEditingCourse({ ...editingCourse, whatYouWillLearn: updatedPoints });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic py-2">No learning outcomes added yet.</p>
                    )}
                  </div>

                  {/* Add Point Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add a new learning outcome point (e.g. Situational roleplay & debates)..."
                      value={newBulletPointForEdit}
                      onChange={(e) => setNewBulletPointForEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newBulletPointForEdit.trim()) {
                            setEditingCourse({
                              ...editingCourse,
                              whatYouWillLearn: [...(editingCourse.whatYouWillLearn || []), newBulletPointForEdit.trim()]
                            });
                            setNewBulletPointForEdit('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newBulletPointForEdit.trim()) {
                          setEditingCourse({
                            ...editingCourse,
                            whatYouWillLearn: [...(editingCourse.whatYouWillLearn || []), newBulletPointForEdit.trim()]
                          });
                          setNewBulletPointForEdit('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4A1D96] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Course Facilities / Inclusions (Delivered on Admission & WhatsApp) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-800 block text-xs">
                        Course Facilities & Inclusions ({editingCourse.facilities?.length || 0})
                      </label>
                      <p className="text-[10px] text-slate-500">Included in admission confirmation & WhatsApp messages</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editingCourse.facilities && editingCourse.facilities.length > 0 ? (
                      editingCourse.facilities.map((facility, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                            ✓
                          </span>
                          <input
                            type="text"
                            value={facility}
                            onChange={(e) => {
                              const updated = [...(editingCourse.facilities || [])];
                              updated[idx] = e.target.value;
                              setEditingCourse({ ...editingCourse, facilities: updated });
                            }}
                            className="flex-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editingCourse.facilities || []).filter((_, i) => i !== idx);
                              setEditingCourse({ ...editingCourse, facilities: updated });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Facility"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic py-1">No facilities configured.</p>
                    )}
                  </div>

                  {/* Add Facility Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add facility (e.g. 1-on-1 speaking feedback sessions)..."
                      value={newFacilityForEdit}
                      onChange={(e) => setNewFacilityForEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newFacilityForEdit.trim()) {
                            setEditingCourse({
                              ...editingCourse,
                              facilities: [...(editingCourse.facilities || []), newFacilityForEdit.trim()]
                            });
                            setNewFacilityForEdit('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newFacilityForEdit.trim()) {
                          setEditingCourse({
                            ...editingCourse,
                            facilities: [...(editingCourse.facilities || []), newFacilityForEdit.trim()]
                          });
                          setNewFacilityForEdit('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingCourse({
                      ...editingCourse,
                      isPublished: !(editingCourse.isPublished !== false)
                    })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      editingCourse.isPublished !== false
                        ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                        : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    {editingCourse.isPublished !== false ? 'Switch to Draft (Unpublish)' : 'Switch to Published (Live)'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCourse(null)}
                      className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Course Changes</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD BATCH */}
        {/* ==================================================================== */}
        {showAddBatchModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Create New Batch
                </h3>
                <button onClick={() => setShowAddBatchModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddBatch} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Batch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Spoken English — Batch November 2026"
                    value={newBatch.name || ''}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Batch Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BATCH-NOV-2026"
                      value={newBatch.batchCode || ''}
                      onChange={(e) => setNewBatch({ ...newBatch, batchCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Max Student Intake</label>
                    <input
                      type="number"
                      value={newBatch.maxCapacity || 35}
                      onChange={(e) => setNewBatch({ ...newBatch, maxCapacity: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Schedule Timing</label>
                  <input
                    type="text"
                    value={newBatch.scheduleTime || ''}
                    onChange={(e) => setNewBatch({ ...newBatch, scheduleTime: e.target.value })}
                    placeholder="e.g. Mon, Wed, Fri 7:30 PM - 8:30 PM IST"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newBatch.startDate || ''}
                      onChange={(e) => setNewBatch({ ...newBatch, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Status</label>
                    <select
                      value={newBatch.status || 'Upcoming'}
                      onChange={(e) => setNewBatch({ ...newBatch, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Website Visibility Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Show on Public Website</span>
                    <span className="text-[11px] text-slate-500">Allow website visitors to see this batch and its seat capacity</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={newBatch.isVisibleOnWebsite !== false}
                      onChange={(e) => setNewBatch({ ...newBatch, isVisibleOnWebsite: e.target.checked })}
                      className="w-4 h-4 rounded text-[#4A1D96] accent-[#4A1D96] cursor-pointer"
                    />
                    <span className={newBatch.isVisibleOnWebsite !== false ? 'text-emerald-700 font-bold' : 'text-slate-500 font-bold'}>
                      {newBatch.isVisibleOnWebsite !== false ? '🟢 Visible' : '⚪ Hidden'}
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddBatchModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Publish Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT BATCH */}
        {/* ==================================================================== */}
        {editingBatch && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Edit Batch ({editingBatch.name})
                </h3>
                <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditBatch} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Batch Name</label>
                  <input
                    type="text"
                    required
                    value={editingBatch.name}
                    onChange={(e) => setEditingBatch({ ...editingBatch, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Schedule Time</label>
                  <input
                    type="text"
                    value={editingBatch.scheduleTime}
                    onChange={(e) => setEditingBatch({ ...editingBatch, scheduleTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Capacity</label>
                    <input
                      type="number"
                      value={editingBatch.maxCapacity || 35}
                      onChange={(e) => setEditingBatch({ ...editingBatch, maxCapacity: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Status</label>
                    <select
                      value={editingBatch.status}
                      onChange={(e) => setEditingBatch({ ...editingBatch, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Website Visibility Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Show on Public Website</span>
                    <span className="text-[11px] text-slate-500">Allow website visitors to see this batch and its seat capacity</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={editingBatch.isVisibleOnWebsite !== false}
                      onChange={(e) => setEditingBatch({ ...editingBatch, isVisibleOnWebsite: e.target.checked })}
                      className="w-4 h-4 rounded text-[#4A1D96] accent-[#4A1D96] cursor-pointer"
                    />
                    <span className={editingBatch.isVisibleOnWebsite !== false ? 'text-emerald-700 font-bold' : 'text-slate-500 font-bold'}>
                      {editingBatch.isVisibleOnWebsite !== false ? '🟢 Visible' : '⚪ Hidden'}
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingBatch(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Save Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: SCHEDULE LIVE CLASS */}
        {/* ==================================================================== */}
        {showAddClassModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Schedule New Class Session
                </h3>
                <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Batch</label>
                  <select
                    value={newClass.batchId}
                    onChange={(e) => setNewClass({ ...newClass, batchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Class Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Day 04: Real-Life Hesitation Removal Drills"
                    value={newClass.title}
                    onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newClass.date}
                      onChange={(e) => setNewClass({ ...newClass, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Time</label>
                    <input
                      type="text"
                      required
                      value={newClass.time}
                      onChange={(e) => setNewClass({ ...newClass, time: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Live Meeting URL (Zoom / Google Meet)</label>
                  <input
                    type="url"
                    required
                    value={newClass.joinUrl}
                    onChange={(e) => setNewClass({ ...newClass, joinUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddClassModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Publish Class
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD RECORDING */}
        {/* ==================================================================== */}
        {showAddRecordingModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Upload / Attach Lecture Recording
                </h3>
                <button onClick={() => setShowAddRecordingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRecording} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Batch</label>
                  <select
                    value={newRecording.batchId}
                    onChange={(e) => setNewRecording({ ...newRecording, batchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recording Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="Class 03 — Practical Dialogue Drills"
                    value={newRecording.title}
                    onChange={(e) => setNewRecording({ ...newRecording, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Topic</label>
                    <input
                      type="text"
                      value={newRecording.topic}
                      onChange={(e) => setNewRecording({ ...newRecording, topic: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duration</label>
                    <input
                      type="text"
                      value={newRecording.duration}
                      onChange={(e) => setNewRecording({ ...newRecording, duration: e.target.value })}
                      placeholder="60 min"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Video Stream / Storage Key</label>
                  <input
                    type="text"
                    value={newRecording.videoUrl}
                    onChange={(e) => setNewRecording({ ...newRecording, videoUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddRecordingModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Save Recording
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD PDF STUDY GUIDE RESOURCE */}
        {/* ==================================================================== */}
        {showAddMaterialModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Upload PDF Study Guide
                    </h3>
                    <p className="text-[11px] text-slate-500">Upload PDF to Backblaze B2 or provide a cloud document link</p>
                  </div>
                </div>
                <button onClick={() => setShowAddMaterialModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMaterial} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Batch *</label>
                  <select
                    value={newMaterial.batchId}
                    onChange={(e) => setNewMaterial({ ...newMaterial, batchId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] bg-slate-50 text-slate-900 font-medium"
                  >
                    <option value="all">🌟 All Batches & Public Website (Knowledge Bank)</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Knowledge Bank Category *</label>
                    <select
                      value={newMaterial.category}
                      onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    >
                      <option value="Worksheets">Worksheets</option>
                      <option value="English Vocabulary">English Vocabulary</option>
                      <option value="Daily Sentences">Daily Sentences</option>
                      <option value="Grammar Guides">Grammar Guides</option>
                      <option value="Speaking Practice">Speaking Practice</option>
                      <option value="E-books">E-books</option>
                      <option value="Learning Tips">Learning Tips</option>
                      <option value="Practice Tests">Practice Tests</option>
                      <option value="Study Notes">Study Notes</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Proficiency Level</label>
                    <select
                      value={newMaterial.level}
                      onChange={(e) => setNewMaterial({ ...newMaterial, level: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    >
                      <option value="All Levels">All Levels</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Foundation">Foundation</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">Document Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 50 High-Frequency Daily Words.pdf"
                      value={newMaterial.title}
                      onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Order #</label>
                    <input
                      type="number"
                      min={1}
                      value={newMaterial.displayOrder}
                      onChange={(e) => setNewMaterial({ ...newMaterial, displayOrder: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-medium"
                    />
                  </div>
                </div>

                {/* Public Website Visibility */}
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-950 block text-xs">
                      Publish on Website (Learning Resources Section)
                    </span>
                    <span className="text-[11px] text-purple-700">
                      Visible in the website's PDF Study Guides & Knowledge Bank
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMaterial.isVisibleOnWebsite}
                    onChange={(e) => setNewMaterial({ ...newMaterial, isVisibleOnWebsite: e.target.checked, isPublished: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                  />
                </div>

                {/* PDF Upload / Cloud Link Engine */}
                <PdfUploadInput
                  pdfUrl={newMaterial.pdfUrl}
                  onPdfUrlChange={(url) => setNewMaterial({ ...newMaterial, pdfUrl: url })}
                  token={token}
                  titleValue={newMaterial.title}
                  onTitleSuggest={(suggestedTitle) => {
                    if (!newMaterial.title || newMaterial.title.trim() === '') {
                      setNewMaterial(prev => ({ ...prev, title: suggestedTitle }));
                    }
                  }}
                  onFileUploaded={({ fileSize, downloadUrl, b2FileId, b2FileName, mimeType }) => {
                    setNewMaterial(prev => ({
                      ...prev,
                      fileSize: fileSize || prev.fileSize,
                      downloadUrl: downloadUrl || prev.downloadUrl,
                      b2FileId: b2FileId || prev.b2FileId,
                      b2FileName: b2FileName || prev.b2FileName,
                      mimeType: mimeType || prev.mimeType,
                      fileType: 'pdf'
                    }));
                  }}
                  onPreviewTest={(url) => setPreviewingPdfMaterial({
                    title: newMaterial.title || 'PDF Preview',
                    pdfUrl: url,
                    description: newMaterial.description,
                    category: 'Study Resource Preview'
                  })}
                />

                {/* View-Only Protection Setting */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#4A1D96]" />
                      <span>View-Only Protection (Strict Anti-Download)</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Blocks Ctrl+S save, Ctrl+P print, right-click menu, and native toolbar saving
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMaterial.isViewOnly}
                    onChange={(e) => setNewMaterial({ ...newMaterial, isViewOnly: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                  />
                </div>

                {/* Allow Download Setting */}
                <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                      <Download className="w-3 h-3 text-[#4A1D96]" />
                      <span>Allow Student File Download</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Enable a direct download button for students and website visitors
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMaterial.allowDownload}
                    onChange={(e) => setNewMaterial({ ...newMaterial, allowDownload: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Description / Summary</label>
                  <textarea
                    rows={2}
                    value={newMaterial.description}
                    onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#4A1D96]"
                    placeholder="Brief summary of the document for students..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddMaterialModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold cursor-pointer shadow-xs"
                  >
                    Upload Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD YOUTUBE VIDEO LEARNING RESOURCE */}
        {/* ==================================================================== */}
        {showAddYouTubeModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                    <Youtube className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Add YouTube Video Resource
                    </h3>
                    <p className="text-[11px] text-slate-500">Provide a YouTube link; title & thumbnail will be auto-fetched</p>
                  </div>
                </div>
                <button onClick={() => setShowAddYouTubeModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddYouTubeResource} className="space-y-3.5 text-xs">
                {/* YouTube URL */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">YouTube Video URL *</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={newYouTubeResource.youtubeUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewYouTubeResource({ ...newYouTubeResource, youtubeUrl: val });
                      }}
                      onBlur={(e) => {
                        if (e.target.value && !newYouTubeResource.title) {
                          handleFetchYouTubeMetadata(e.target.value, false);
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-600 text-slate-900 font-medium"
                    />
                    <button
                      type="button"
                      disabled={isFetchingYtMetadata || !newYouTubeResource.youtubeUrl.trim()}
                      onClick={() => handleFetchYouTubeMetadata(newYouTubeResource.youtubeUrl, false)}
                      className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isFetchingYtMetadata ? 'animate-spin' : 'text-red-600'}`} />
                      <span>{isFetchingYtMetadata ? 'Fetching...' : 'Auto-Fetch'}</span>
                    </button>
                  </div>
                </div>

                {/* Video Title (Auto-fetched with editable fallback) */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Video Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50 Daily Routine Sentences Used in Real Life"
                    value={newYouTubeResource.title}
                    onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-600 text-slate-900 font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Auto-fetched from YouTube. You can customize or edit this title anytime.
                  </span>
                </div>

                {/* Category, Display Order & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Category *</label>
                    <select
                      value={newYouTubeResource.category}
                      onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, category: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    >
                      <option value="Pronunciation & Phonics">Pronunciation & Phonics</option>
                      <option value="Spoken English & Fluency">Spoken English & Fluency</option>
                      <option value="Learning Mindset">Learning Mindset</option>
                      <option value="English Foundations">English Foundations</option>
                      <option value="Daily Motivation">Daily Motivation</option>
                      <option value="Daily English">Daily English</option>
                      <option value="Vocabulary">Vocabulary</option>
                      <option value="Grammar Made Easy">Grammar Made Easy</option>
                      <option value="Speaking Practice">Speaking Practice</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Display Order (1 = First)</label>
                    <input
                      type="number"
                      min={1}
                      value={newYouTubeResource.displayOrder}
                      onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, displayOrder: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duration (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 05:20 or 00:58"
                      value={newYouTubeResource.duration}
                      onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, duration: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                    />
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Description / Content</label>
                  <textarea
                    rows={2}
                    value={newYouTubeResource.description}
                    onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-red-600"
                    placeholder="Brief description of the lesson..."
                  />
                </div>

                {/* Custom Thumbnail Upload & Preview */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Video Thumbnail</span>
                    {newYouTubeResource.b2ThumbnailId ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Custom B2 Image Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500">
                        YouTube Auto-Thumbnail
                      </span>
                    )}
                  </div>

                  {newYouTubeResource.thumbnailUrl && (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 border border-slate-200">
                      <img
                        src={newYouTubeResource.thumbnailUrl}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-center cursor-pointer text-[11px] transition-colors">
                      <UploadCloud className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                      <span>{isUploadingThumbnail ? 'Uploading to B2...' : 'Upload Custom Thumbnail (B2)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingThumbnail}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadThumbnail(file, false);
                        }}
                      />
                    </label>

                    {newYouTubeResource.thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const vidId = extractYouTubeVideoId(newYouTubeResource.youtubeUrl);
                          setNewYouTubeResource(prev => ({
                            ...prev,
                            thumbnailUrl: vidId ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` : '',
                            b2ThumbnailId: '',
                            b2ThumbnailName: ''
                          }));
                        }}
                        className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 text-[11px] font-medium transition-colors cursor-pointer"
                        title="Reset to default YouTube thumbnail"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Publish Toggle */}
                <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-red-950 block text-xs">
                      Publish on Public Website
                    </span>
                    <span className="text-[11px] text-red-700">
                      Instantly visible in the Video Lessons hub on Learning Resources
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newYouTubeResource.isPublished}
                    onChange={(e) => setNewYouTubeResource({ ...newYouTubeResource, isPublished: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded cursor-pointer accent-red-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddYouTubeModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Publish YouTube Lesson
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD TESTIMONIAL */}
        {/* ==================================================================== */}
        {showAddTestimonialModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Add Student Testimonial
                </h3>
                <button onClick={() => setShowAddTestimonialModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTestimonial} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohd Tariq"
                    value={newTestimonial.studentName || ''}
                    onChange={(e) => setNewTestimonial({ ...newTestimonial, studentName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Course / Batch</label>
                    <input
                      type="text"
                      value={newTestimonial.courseBatch || ''}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, courseBatch: e.target.value })}
                      placeholder="e.g. Spoken English • Batch 01"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Location / City</label>
                    <input
                      type="text"
                      value={newTestimonial.city || ''}
                      onChange={(e) => setNewTestimonial({ ...newTestimonial, city: e.target.value })}
                      placeholder="e.g. Sambhal, UP"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Review Statement *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write the student's review..."
                    value={newTestimonial.testimonial || ''}
                    onChange={(e) => setNewTestimonial({ ...newTestimonial, testimonial: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddTestimonialModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Publish Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT TESTIMONIAL */}
        {/* ==================================================================== */}
        {editingTestimonial && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                  Edit Student Testimonial
                </h3>
                <button onClick={() => setEditingTestimonial(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditTestimonial} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={editingTestimonial.studentName}
                    onChange={(e) => setEditingTestimonial({ ...editingTestimonial, studentName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Course / Batch</label>
                    <input
                      type="text"
                      value={editingTestimonial.courseBatch}
                      onChange={(e) => setEditingTestimonial({ ...editingTestimonial, courseBatch: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Location</label>
                    <input
                      type="text"
                      value={editingTestimonial.city || ''}
                      onChange={(e) => setEditingTestimonial({ ...editingTestimonial, city: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Review</label>
                  <textarea
                    rows={4}
                    value={editingTestimonial.testimonial}
                    onChange={(e) => setEditingTestimonial({ ...editingTestimonial, testimonial: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTestimonial(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADD NEW ANNOUNCEMENT / HOLIDAY / CLASS NOTICE */}
        {/* ==================================================================== */}
        {showAddAnnouncementModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Publish Academy Notice / Holiday
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Broadcast notices to all students or specific batches
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowAddAnnouncementModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notice Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 🏖️ Academy Holiday Notice: Gandhi Jayanti Observance"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Notice Category *</label>
                    <select
                      value={newAnnouncement.category}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, category: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="Holiday">🏖️ Holiday Notice (Class closed)</option>
                      <option value="Class Notice">📢 Class Notice (Mock test, speaking pairs)</option>
                      <option value="Schedule Change">🕒 Schedule / Timing Change</option>
                      <option value="Urgent Alert">🚨 Urgent Alert</option>
                      <option value="Exam / Test">📝 Exam / Assessment Notice</option>
                      <option value="General">📌 General Academy Circular</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Target Batch / Audience *</label>
                    <select
                      value={newAnnouncement.batchId}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, batchId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="all">All Batches (Academy-wide Notice)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Priority Level</label>
                    <select
                      value={newAnnouncement.priority}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="Normal">Normal (Standard information)</option>
                      <option value="Important">Important (High visibility)</option>
                      <option value="Urgent">Urgent (Flashing priority tag)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Effective Date / Timing</label>
                    <input
                      type="text"
                      placeholder="e.g. 2nd October 2026 (Full Day) or Friday 7:30 PM"
                      value={newAnnouncement.effectiveDate}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, effectiveDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Circular Notice & Guidelines *</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Enter detailed notice message, instructions for students, class resumption dates, homework guidelines, etc..."
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs leading-relaxed"
                  />
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Pin to Top of Website Notice Board</span>
                    <span className="text-[11px] text-slate-500">Highlighted first when students visit the academy homepage</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newAnnouncement.isPinned}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, isPinned: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddAnnouncementModal(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Publish Notice Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT EXISTING ANNOUNCEMENT */}
        {/* ==================================================================== */}
        {editingAnnouncement && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Edit Academy Notice
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Update notice details, timings, or guidelines
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingAnnouncement(null)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateAnnouncement} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notice Title *</label>
                  <input
                    type="text"
                    required
                    value={editingAnnouncement.title}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Notice Category *</label>
                    <select
                      value={editingAnnouncement.category || 'General'}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, category: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="Holiday">🏖️ Holiday Notice (Class closed)</option>
                      <option value="Class Notice">📢 Class Notice (Mock test, speaking pairs)</option>
                      <option value="Schedule Change">🕒 Schedule / Timing Change</option>
                      <option value="Urgent Alert">🚨 Urgent Alert</option>
                      <option value="Exam / Test">📝 Exam / Assessment Notice</option>
                      <option value="General">📌 General Academy Circular</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Target Batch / Audience *</label>
                    <select
                      value={editingAnnouncement.batchId}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, batchId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="all">All Batches (Academy-wide Notice)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Priority Level</label>
                    <select
                      value={editingAnnouncement.priority}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, priority: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs font-semibold"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Effective Date / Timing</label>
                    <input
                      type="text"
                      value={editingAnnouncement.effectiveDate || ''}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, effectiveDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Circular Notice & Guidelines *</label>
                  <textarea
                    required
                    rows={5}
                    value={editingAnnouncement.message}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 text-xs leading-relaxed"
                  />
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Pin to Top of Website Notice Board</span>
                    <span className="text-[11px] text-slate-500">Showcases prominently on homepage</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(editingAnnouncement.isPinned)}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, isPinned: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncement(null)}
                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PREVIEW NOTICE POPUP CIRCULAR MODAL */}
        {/* ==================================================================== */}
        {previewingAnnouncement && (
          <AnnouncementModal
            isOpen={Boolean(previewingAnnouncement)}
            announcement={previewingAnnouncement}
            onClose={() => setPreviewingAnnouncement(null)}
            siteSettings={siteSettings}
          />
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT LEARNING RESOURCE (PDF OR YOUTUBE) */}
        {/* ==================================================================== */}
        {editingMaterial && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain smooth-scroll-viewport">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto overscroll-contain smooth-scroll-viewport">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    editingMaterial.resourceType === 'youtube' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-[#4A1D96]'
                  }`}>
                    {editingMaterial.resourceType === 'youtube' ? <Youtube className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      {editingMaterial.resourceType === 'youtube' ? 'Edit YouTube Video Resource' : 'Edit PDF Study Guide'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {editingMaterial.resourceType === 'youtube'
                        ? 'Update video URL, custom thumbnail, or description'
                        : 'Upload new PDF to Backblaze B2 or update document details'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditingMaterial(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateMaterial} className="space-y-3.5 text-xs">
                {editingMaterial.resourceType === 'youtube' ? (
                  <>
                    {/* YouTube URL */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">YouTube Video URL *</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          required
                          value={editingMaterial.youtubeUrl || editingMaterial.downloadUrl || ''}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, youtubeUrl: e.target.value, downloadUrl: e.target.value })}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-600 text-slate-900 font-medium"
                        />
                        <button
                          type="button"
                          disabled={isFetchingYtMetadata || !editingMaterial.youtubeUrl?.trim()}
                          onClick={() => handleFetchYouTubeMetadata(editingMaterial.youtubeUrl || '', true)}
                          className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isFetchingYtMetadata ? 'animate-spin' : 'text-red-600'}`} />
                          <span>{isFetchingYtMetadata ? 'Fetching...' : 'Re-Fetch'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Video Title */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Video Title *</label>
                      <input
                        type="text"
                        required
                        value={editingMaterial.title}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-600 text-slate-900 font-medium"
                      />
                    </div>

                    {/* Category, Display Order & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Category *</label>
                        <select
                          value={editingMaterial.category || 'Daily English'}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                        >
                          <option value="Pronunciation & Phonics">Pronunciation & Phonics</option>
                          <option value="Spoken English & Fluency">Spoken English & Fluency</option>
                          <option value="Learning Mindset">Learning Mindset</option>
                          <option value="English Foundations">English Foundations</option>
                          <option value="Daily Motivation">Daily Motivation</option>
                          <option value="Daily English">Daily English</option>
                          <option value="Vocabulary">Vocabulary</option>
                          <option value="Grammar Made Easy">Grammar Made Easy</option>
                          <option value="Speaking Practice">Speaking Practice</option>
                          <option value="General">General</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Display Order</label>
                        <input
                          type="number"
                          min={1}
                          value={editingMaterial.displayOrder || 1}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, displayOrder: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Duration (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. 05:20 or 00:58"
                          value={editingMaterial.duration || ''}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, duration: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                        />
                      </div>
                    </div>

                    {/* Short Description */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                      <textarea
                        rows={2}
                        value={editingMaterial.description}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-red-600"
                      />
                    </div>

                    {/* Custom Thumbnail Upload & Preview */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">Video Thumbnail</span>
                        {editingMaterial.b2ThumbnailId ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            Custom B2 Thumbnail
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">
                            YouTube Auto-Thumbnail
                          </span>
                        )}
                      </div>

                      {editingMaterial.thumbnailUrl && (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/10 border border-slate-200">
                          <img
                            src={editingMaterial.thumbnailUrl}
                            alt="Thumbnail preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <label className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-center cursor-pointer text-[11px] transition-colors">
                          <UploadCloud className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                          <span>{isUploadingThumbnail ? 'Uploading to B2...' : 'Replace Thumbnail (B2)'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingThumbnail}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadThumbnail(file, true);
                            }}
                          />
                        </label>

                        {editingMaterial.thumbnailUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const vidId = extractYouTubeVideoId(editingMaterial.youtubeUrl || '');
                              setEditingMaterial(prev => prev ? ({
                                ...prev,
                                thumbnailUrl: vidId ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` : '',
                                b2ThumbnailId: '',
                                b2ThumbnailName: ''
                              }) : null);
                            }}
                            className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Publish Toggle */}
                    <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-red-950 block text-xs">
                          Publish on Public Website
                        </span>
                        <span className="text-[11px] text-red-700">
                          Visible in the Video Lessons section
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editingMaterial.isVisibleOnWebsite !== false && editingMaterial.isPublished !== false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, isVisibleOnWebsite: e.target.checked, isPublished: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded cursor-pointer accent-red-600"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* PDF Edit Form */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target Batch *</label>
                      <select
                        value={editingMaterial.batchId}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, batchId: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] bg-slate-50 text-slate-900 font-medium"
                      >
                        <option value="all">🌟 All Batches & Public Website (Knowledge Bank)</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Knowledge Bank Category *</label>
                        <select
                          value={editingMaterial.category || 'Worksheets'}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                        >
                          <option value="Worksheets">Worksheets</option>
                          <option value="English Vocabulary">English Vocabulary</option>
                          <option value="Daily Sentences">Daily Sentences</option>
                          <option value="Grammar Guides">Grammar Guides</option>
                          <option value="Speaking Practice">Speaking Practice</option>
                          <option value="E-books">E-books</option>
                          <option value="Learning Tips">Learning Tips</option>
                          <option value="Practice Tests">Practice Tests</option>
                          <option value="Study Notes">Study Notes</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Proficiency Level</label>
                        <select
                          value={editingMaterial.level || 'All Levels'}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, level: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium"
                        >
                          <option value="All Levels">All Levels</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Foundation">Foundation</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Document Title *</label>
                        <input
                          type="text"
                          required
                          value={editingMaterial.title}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#4A1D96] text-slate-900 font-medium"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Order #</label>
                        <input
                          type="number"
                          min={1}
                          value={editingMaterial.displayOrder || 1}
                          onChange={(e) => setEditingMaterial({ ...editingMaterial, displayOrder: parseInt(e.target.value) || 1 })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-medium"
                        />
                      </div>
                    </div>

                    {/* Public Website Visibility */}
                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-purple-950 block text-xs">
                          Display on Public Website (Learning Resources Section)
                        </span>
                        <span className="text-[11px] text-purple-700">
                          Visible in the website's PDF Study Guides & Knowledge Bank
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editingMaterial.isVisibleOnWebsite !== false && editingMaterial.isPublished !== false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, isVisibleOnWebsite: e.target.checked, isPublished: e.target.checked })}
                        className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                      />
                    </div>

                    {/* PDF Upload / Replace Engine (Backblaze B2) */}
                    <div className="space-y-1">
                      <span className="font-bold text-slate-700 block text-xs">
                        Attached PDF File (Upload new file to replace)
                      </span>
                      <PdfUploadInput
                        pdfUrl={editingMaterial.pdfUrl || ''}
                        onPdfUrlChange={(url) => setEditingMaterial({ ...editingMaterial, pdfUrl: url })}
                        token={token}
                        titleValue={editingMaterial.title}
                        onTitleSuggest={(suggestedTitle) => {
                          if (!editingMaterial.title || editingMaterial.title.trim() === '') {
                            setEditingMaterial(prev => prev ? ({ ...prev, title: suggestedTitle }) : null);
                          }
                        }}
                        onFileUploaded={({ fileSize, downloadUrl, b2FileId, b2FileName, mimeType }) => {
                          setEditingMaterial(prev => prev ? ({
                            ...prev,
                            fileSize: fileSize || prev.fileSize,
                            downloadUrl: downloadUrl || prev.downloadUrl,
                            b2FileId: b2FileId || prev.b2FileId,
                            b2FileName: b2FileName || prev.b2FileName,
                            mimeType: mimeType || prev.mimeType,
                            fileType: 'pdf'
                          }) : null);
                        }}
                        onPreviewTest={(url) => setPreviewingPdfMaterial({
                          title: editingMaterial.title || 'PDF Preview',
                          pdfUrl: url,
                          description: editingMaterial.description,
                          category: 'Study Resource Preview'
                        })}
                      />
                    </div>

                    {/* View-Only Protection Setting */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                          <Lock className="w-3 h-3 text-[#4A1D96]" />
                          <span>View-Only Protection (Strict Anti-Download)</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Prevents student downloads, print commands, and context menu saving
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editingMaterial.isViewOnly !== false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, isViewOnly: e.target.checked })}
                        className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                      />
                    </div>

                    {/* Allow Download Setting */}
                    <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                          <Download className="w-3 h-3 text-[#4A1D96]" />
                          <span>Allow Student File Download</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Enable direct file downloads for students and website visitors
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editingMaterial.allowDownload === true}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, allowDownload: e.target.checked })}
                        className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Description / Summary</label>
                      <textarea
                        rows={2}
                        value={editingMaterial.description}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#4A1D96]"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold cursor-pointer shadow-xs"
                  >
                    Update Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADMIN PROTECTED PDF VIEWER TESTER */}
        {/* ==================================================================== */}
        {previewingPdfMaterial && (
          <ProtectedPdfViewer
            isOpen={Boolean(previewingPdfMaterial)}
            onClose={() => setPreviewingPdfMaterial(null)}
            title={previewingPdfMaterial.title}
            pdfUrl={previewingPdfMaterial.pdfUrl}
            category={previewingPdfMaterial.category || 'Batch Study Material'}
            batchName={previewingPdfMaterial.batchName || 'Wits Lingo Academy'}
            studentName="Admin Test Preview"
            description={previewingPdfMaterial.description}
            allowDownload={false}
          />
        )}

        {/* ==================================================================== */}
        {/* MODAL: UPLOAD MULTIPLE GALLERY IMAGES (BACKBLAZE B2 STORAGE) */}
        {/* ==================================================================== */}
        {showAddGalleryModal && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 overscroll-contain smooth-scroll-viewport"
            onClick={() => !isUploadingGallery && setShowAddGalleryModal(false)}
          >
            <div 
              className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3B0764] to-[#4A1D96] text-white flex items-center justify-center shadow-xs">
                    <Images className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Upload Photos to Gallery (Backblaze B2)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select one or multiple photos to upload directly to Backblaze B2 storage.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUploadingGallery}
                  onClick={() => setShowAddGalleryModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drag & Drop File Picker */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const newFiles: typeof selectedUploadFiles = [];
                    Array.from(e.dataTransfer.files).forEach((file: File) => {
                      if (file.type.startsWith('image/')) {
                        const preview = URL.createObjectURL(file);
                        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        newFiles.push({
                          file,
                          preview,
                          title: cleanTitle,
                          caption: '',
                          category: 'Classrooms'
                        });
                      }
                    });
                    setSelectedUploadFiles(prev => [...prev, ...newFiles]);
                  }
                }}
                className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/70 rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer relative"
              >
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={isUploadingGallery}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const newFiles: typeof selectedUploadFiles = [];
                      Array.from(e.target.files).forEach((file: File) => {
                        const preview = URL.createObjectURL(file);
                        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        newFiles.push({
                          file,
                          preview,
                          title: cleanTitle,
                          caption: '',
                          category: 'Classrooms'
                        });
                      });
                      setSelectedUploadFiles(prev => [...prev, ...newFiles]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="space-y-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-purple-200 text-[#4A1D96] flex items-center justify-center mx-auto shadow-2xs">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Click to browse or drag & drop multiple images
                  </div>
                  <p className="text-xs text-slate-500">
                    Supports <strong className="text-slate-700">JPEG, PNG, WebP, AVIF, GIF</strong> (Up to 25MB each)
                  </p>
                </div>
              </div>

              {/* Selected Files Preview & Metadata Form */}
              {selectedUploadFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#4A1D96]" />
                      <span>Selected Photos ({selectedUploadFiles.length})</span>
                    </span>

                    {/* Batch Category Setter */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Apply category to all:</span>
                      <select
                        onChange={(e) => {
                          const cat = e.target.value;
                          if (cat) {
                            setSelectedUploadFiles(prev => prev.map(f => ({ ...f, category: cat })));
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 font-bold text-xs"
                      >
                        <option value="">Select Category...</option>
                        <option value="Classrooms">Classrooms</option>
                        <option value="Live Sessions">Live Sessions</option>
                        <option value="Events & Workshops">Events & Workshops</option>
                        <option value="Student Activities">Student Activities</option>
                        <option value="Community">Community</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedUploadFiles.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img
                            src={item.preview}
                            alt="preview"
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-1 flex-1 min-w-0">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedUploadFiles(prev => prev.map((f, i) => i === idx ? { ...f, title: val } : f));
                              }}
                              placeholder="Photo Title..."
                              className="w-full px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#4A1D96]"
                            />
                            <input
                              type="text"
                              value={item.caption}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedUploadFiles(prev => prev.map((f, i) => i === idx ? { ...f, caption: val } : f));
                              }}
                              placeholder="Optional short caption..."
                              className="w-full px-2.5 py-1 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#4A1D96]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedUploadFiles(prev => prev.map((f, i) => i === idx ? { ...f, category: val } : f));
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800"
                          >
                            <option value="Classrooms">Classrooms</option>
                            <option value="Live Sessions">Live Sessions</option>
                            <option value="Events & Workshops">Events & Workshops</option>
                            <option value="Student Activities">Student Activities</option>
                            <option value="Community">Community</option>
                            <option value="General">General</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUploadFiles(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Action Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isUploadingGallery}
                  onClick={() => {
                    setSelectedUploadFiles([]);
                    setShowAddGalleryModal(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="submit-gallery-upload-btn"
                  disabled={selectedUploadFiles.length === 0 || isUploadingGallery}
                  onClick={() => handleUploadGalleryFiles(selectedUploadFiles)}
                  className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-xs shadow-md shadow-purple-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingGallery ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading to Backblaze B2...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload & Publish {selectedUploadFiles.length > 0 ? `(${selectedUploadFiles.length})` : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: EDIT GALLERY ITEM METADATA */}
        {/* ==================================================================== */}
        {editingGalleryItem && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 overscroll-contain smooth-scroll-viewport"
            onClick={() => setEditingGalleryItem(null)}
          >
            <div 
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-[#4A1D96] flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                      Edit Gallery Photo Details
                    </h3>
                    <p className="text-xs text-slate-500">
                      Update title, caption description, category, and display order.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingGalleryItem(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photo Thumbnail */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 relative">
                <img
                  src={editingGalleryItem.imageUrl}
                  alt={editingGalleryItem.title || 'Edit'}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Edit Form */}
              <form onSubmit={handleUpdateGalleryMetadata} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Photo Title:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingGalleryItem.title || ''}
                    onChange={(e) => setEditingGalleryItem({ ...editingGalleryItem, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#4A1D96] font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Description / Caption:
                  </label>
                  <textarea
                    rows={3}
                    value={editingGalleryItem.caption || ''}
                    onChange={(e) => setEditingGalleryItem({ ...editingGalleryItem, caption: e.target.value })}
                    placeholder="Brief description of this moment..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#4A1D96] font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Category:
                    </label>
                    <select
                      value={editingGalleryItem.category || 'Classrooms'}
                      onChange={(e) => setEditingGalleryItem({ ...editingGalleryItem, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                    >
                      <option value="Classrooms">Classrooms</option>
                      <option value="Live Sessions">Live Sessions</option>
                      <option value="Events & Workshops">Events & Workshops</option>
                      <option value="Student Activities">Student Activities</option>
                      <option value="Community">Community</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Display Order:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editingGalleryItem.displayOrder || 1}
                      onChange={(e) => setEditingGalleryItem({ ...editingGalleryItem, displayOrder: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                {/* Published Checkbox */}
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-950 block text-xs">
                      Published on Public /gallery
                    </span>
                    <span className="text-[11px] text-purple-700">
                      When checked, this photo will be visible to all website visitors.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingGalleryItem.isPublished !== false}
                    onChange={(e) => setEditingGalleryItem({ ...editingGalleryItem, isPublished: e.target.checked })}
                    className="w-4 h-4 text-[#4A1D96] rounded cursor-pointer accent-[#4A1D96]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingGalleryItem(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: ADMIN LIGHTBOX PREVIEW */}
        {/* ==================================================================== */}
        {previewGalleryItem && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewGalleryItem(null)}
          >
            <div 
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewGalleryItem(null)}
                className="absolute top-2 right-2 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer z-50"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="rounded-2xl overflow-hidden border border-white/20 bg-black max-h-[75vh] flex items-center justify-center">
                <img
                  src={previewGalleryItem.imageUrl}
                  alt={previewGalleryItem.title || 'Preview'}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>

              <div className="mt-3 p-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl text-white text-center w-full max-w-lg space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#4A1D96] text-[10px] font-bold uppercase text-purple-200">
                    {previewGalleryItem.category || 'Classrooms'}
                  </span>
                  <h4 className="font-bold text-sm">{previewGalleryItem.title}</h4>
                </div>
                {previewGalleryItem.caption && (
                  <p className="text-xs text-purple-200/90">{previewGalleryItem.caption}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: CUSTOM IN-APP DELETE CONFIRMATION (IFRAME SAFE) */}
        {/* ==================================================================== */}
        {deleteModal && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-150 overscroll-contain smooth-scroll-viewport"
            onClick={() => !isDeletingItem && setDeleteModal(null)}
          >
            <div 
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain smooth-scroll-viewport"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">
                    {deleteModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {deleteModal.description}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-red-50/70 rounded-xl border border-red-100 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <div className="text-xs text-red-900 truncate">
                  <span className="text-red-600 font-medium">Record: </span>
                  <strong className="font-bold">{deleteModal.itemName}</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingItem}
                  onClick={() => setDeleteModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-delete-action-btn"
                  disabled={isDeletingItem}
                  onClick={async () => {
                    setIsDeletingItem(true);
                    try {
                      await deleteModal.onConfirm();
                    } finally {
                      setIsDeletingItem(false);
                      setDeleteModal(null);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingItem ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
