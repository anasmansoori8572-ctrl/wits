import { CourseData, Batch, TestimonialData, SiteSettings, Announcement, GalleryItem } from '../types';

export const INITIAL_COURSES: CourseData[] = [];

export const INITIAL_BATCHES: Batch[] = [];

export const INITIAL_TESTIMONIALS: TestimonialData[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const INITIAL_GALLERY_ITEMS: GalleryItem[] = [];

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  academyName: 'WITS LINGO',
  tagline: 'A Global Language Platform',
  phone1: '',
  phone2: '',
  email: 'hello@witslingo.com',
  address: '',
  whatsappChannelUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  announcementText: '',
  announcementBtnText: '',
  showAnnouncement: false,
  showBatchesSection: true,
  founderName: '',
  founderTitle: '',
  batchesCompletedCount: '0',
  activeStudentsCount: '0',
  bankName: '',
  bankAccountHolder: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  bankBranch: '',
  bankAccountType: '',
  bankSwiftBic: '',
  upiId: '',
  upiNumber: '',
  razorpayPaymentLink: '',
  paypalEmailOrLink: '',
  heroVideoUrl: '',
  heroVideoPosterUrl: '',
  logoUrl: '/logo.svg'
};
