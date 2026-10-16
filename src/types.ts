export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  batchIds: string[];
  enrolledBatchIds?: string[];
  admissionId?: string;
  registrationDate?: string;
}

export interface StudentRegistration {
  id: string;
  admissionId: string;
  name: string;
  fatherName: string;
  dob: string;
  gender: string;
  country?: string;
  district: string;
  state: string;
  pincode?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  qualification: string;
  currentEnglishLevel: string;
  courseId: string;
  courseName: string;
  batchId: string;
  batchName: string;
  feeAmount: number;
  paymentStatus: 'Paid' | 'Pending';
  paymentMethod: string;
  paymentCurrency?: string;
  paymentAmountFormatted?: string;
  paymentTxnId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  googleMeetLink?: string;
  whatsappDeliveryStatus?: 'pending' | 'sent' | 'failed' | 'skipped';
  whatsappMessageId?: string;
  whatsappSentAt?: string;
  whatsappError?: string;
  facilities?: string[];
  registeredAt: string;
}

export interface Batch {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  batchCode: string;
  startDate: string;
  endDate: string;
  teacherName: string;
  scheduleTime: string;
  classTime?: string;
  scheduleInfo?: string;
  maxStudents: number;
  currentStudentsCount: number;
  enrolledCount?: number;
  maxCapacity?: number;
  status: 'Active' | 'Upcoming' | 'Completed' | 'Archived';
  recordingsExpiryDate?: string;
  description?: string;
  isVisibleOnWebsite?: boolean;
  googleMeetLink?: string;
  meetLink?: string;
}

export interface ClassSession {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  topic: string;
  classNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  time?: string;
  durationMinutes: number;
  teacherName: string;
  instructorName?: string;
  description: string;
  status: 'Upcoming' | 'Live' | 'Completed' | 'Scheduled';
  joinUrl?: string;
  recordingId?: string;
  hasStudyMaterial: boolean;
  hasAssignment: boolean;
  videoKey?: string;
}

export interface Recording {
  id: string;
  classId: string;
  batchId: string;
  batchName: string;
  title: string;
  topic: string;
  classNumber: number;
  date: string;
  recordedDate?: string;
  duration: string;
  status: 'Available' | 'Processing' | 'Archived';
  videoKey: string;
  description?: string;
  notesSummary?: string;
}

export type LearningResourceType = 'pdf' | 'youtube';

export interface StudyMaterial {
  id: string;
  resourceType?: LearningResourceType;
  batchId: string;
  classId?: string;
  title: string;
  description: string;
  fileType: 'pdf' | 'doc' | 'notes' | string;
  fileSize: string;
  downloadUrl: string;
  pdfUrl?: string;
  b2FileId?: string;
  b2FileName?: string;
  mimeType?: string;
  isViewOnly?: boolean;
  allowDownload?: boolean;
  uploadedAt: string;
  uploadedDate?: string;
  category?: string;
  level?: string;
  isVisibleOnWebsite?: boolean;
  isPublished?: boolean;
  displayOrder?: number;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  b2ThumbnailId?: string;
  b2ThumbnailName?: string;
  duration?: string;
  views?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  batchId: string;
  classId?: string;
  title: string;
  description: string;
  dueDate: string;
  totalPoints: number;
  submissionsCount: number;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  batchId: string;
  submittedAt: string;
  content: string;
  status: 'Submitted' | 'Graded';
  score?: number;
  feedback?: string;
}

export interface Announcement {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  message: string;
  date: string;
  author: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  category?: 'Holiday' | 'Class Notice' | 'Schedule Change' | 'Urgent Alert' | 'Exam / Test' | 'General';
  effectiveDate?: string;
  isPinned?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  batchId: string;
  batchName: string;
  classId: string;
  classTitle: string;
  joinTime: string;
  leaveTime?: string;
  durationMinutes: number;
  status: 'Present' | 'Late' | 'Absent';
  date: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  batchId?: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'class_live' | 'class_scheduled' | 'recording_ready' | 'material_uploaded' | 'assignment_due' | 'announcement';
  read: boolean;
}

export interface CourseData {
  id: string;
  name: string;
  level: string;
  shortDescription: string;
  whatYouWillLearn: string[];
  facilities?: string[];
  duration: string;
  learningFormat: string;
  fee: number;
  badge?: string;
  isPublished?: boolean;
  order?: number;
}

export interface TestimonialData {
  id: string;
  studentName: string;
  courseBatch: string;
  testimonial: string;
  avatar?: string;
  city?: string;
  date?: string;
  verified?: boolean;
}

export interface ResourceItem {
  id: string;
  resourceType?: LearningResourceType;
  title: string;
  category: string;
  description: string;
  level: string;
  downloadCount: number;
  fileType: string;
  pdfUrl?: string;
  downloadUrl?: string;
  isViewOnly?: boolean;
  allowDownload?: boolean;
  batchId?: string;
  uploadedDate?: string;
  isUploaded?: boolean;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  duration?: string;
  views?: string;
  isPublished?: boolean;
  displayOrder?: number;
}

export interface GalleryItem {
  id: string;
  title?: string;
  caption?: string;
  category?: string; // e.g. 'Classrooms', 'Live Sessions', 'Events & Workshops', 'Student Activities', 'Community', 'General'
  imageUrl: string;
  thumbnailUrl?: string;
  b2FileId?: string;
  b2FileName?: string;
  isPublished: boolean;
  displayOrder: number;
  uploadedAt: string;
  uploadedBy?: string;
  fileSize?: string;
}

export interface SiteSettings {
  academyName: string;
  tagline: string;
  phone1: string;
  phone2: string;
  email: string;
  address: string;
  whatsappChannelUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  announcementText: string;
  announcementBtnText?: string;
  showAnnouncement: boolean;
  showBatchesSection?: boolean;
  founderName: string;
  founderTitle: string;
  batchesCompletedCount: string;
  activeStudentsCount: string;
  adminPasskey?: string;

  // Bank & Direct Payment Settings
  bankName?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankBranch?: string;
  bankAccountType?: string;
  bankSwiftBic?: string; // International SWIFT / BIC code for all country currency transactions
  upiId?: string; // Primary UPI ID (e.g. 9027729917@ybl)
  upiNumber?: string; // Google Pay / PhonePe / Paytm registered number
  razorpayPaymentLink?: string;
  paypalEmailOrLink?: string;

  // Hero Video Management
  heroVideoUrl?: string;
  heroVideoPosterUrl?: string;

  // Central Website Logo Management (Backblaze B2)
  logoUrl?: string;
  logoVersion?: number | string;
  b2LogoId?: string;
  b2LogoName?: string;

  // Razorpay Public Configuration
  razorpayKeyId?: string;
}

export interface RazorpayOrderResponse {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  courseName?: string;
  batchName?: string;
  error?: string;
  requiresConfig?: boolean;
}
