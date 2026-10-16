import { CourseData, Batch, TestimonialData, SiteSettings } from '../types';
import { WITS_LINGO_CONFIG } from '../config/witsLingoConfig';

export const INITIAL_COURSES: CourseData[] = [
  {
    id: 'course-foundation',
    name: 'English Foundation',
    level: 'Beginner',
    shortDescription: 'For learners starting from the basics, building fundamentals with zero hesitation.',
    whatYouWillLearn: [
      'Basic phonetics, clear alphabet sounds & sound articulation',
      'High-frequency everyday words & practical vocabulary',
      'Simple subject-verb sentence framing without translation',
      'Overcoming stage fear & basic self-introduction'
    ],
    duration: '2 Months (40 Sessions)',
    learningFormat: 'Live Online Classroom (Evening Batches)',
    fee: 1199,
    badge: 'Popular Foundation'
  },
  {
    id: 'course-spoken-english',
    name: 'Spoken English',
    level: 'Beginner to Intermediate',
    shortDescription: 'Practical English speaking and everyday communication for students and job seekers.',
    whatYouWillLearn: [
      'Fluency training & immediate hesitation removal',
      'Conversational drills for market, bank, travel & social events',
      'Elimination of mother-tongue influence (MTI)',
      'Thinking directly in English during daily conversations'
    ],
    duration: '2.5 Months (50 Sessions)',
    learningFormat: 'Live Batches + Daily Speaking Drills',
    fee: 1499,
    badge: 'Most Popular'
  },
  {
    id: 'course-vocabulary',
    name: 'English Vocabulary',
    level: 'Intermediate',
    shortDescription: 'Useful vocabulary with practical real-life examples, idioms, and active speaking practice.',
    whatYouWillLearn: [
      '1,000+ active conversational words & collocations',
      'Contextual idioms, phrasal verbs & smart alternatives',
      'Memory retention techniques (no rote memorisation)',
      'Applying new vocabulary naturally in impromptu dialogues'
    ],
    duration: '1.5 Months (30 Sessions)',
    learningFormat: 'Interactive Vocabulary Workshops',
    fee: 999
  },
  {
    id: 'course-conversation',
    name: 'English Conversation',
    level: 'Intermediate',
    shortDescription: 'Real-life conversation and speaking practice in simulated environments.',
    whatYouWillLearn: [
      'One-on-one and group situational roleplays',
      'Handling casual small talk, phone calls & discussions',
      'Polite interruptions, expressing opinions & agreement',
      'Confidence building with peer interaction'
    ],
    duration: '2 Months (40 Sessions)',
    learningFormat: '100% Speaking & Dialogue Practice',
    fee: 1299
  },
  {
    id: 'course-communication',
    name: 'Communication Skills',
    level: 'Intermediate to Advanced',
    shortDescription: 'Confidence, expression, interview mastery, and effective communication in professional life.',
    whatYouWillLearn: [
      'Job interview preparation & self-pitch articulation',
      'Public speaking, stage presence & body language',
      'Professional email, etiquette & formal discussion',
      'Clear, articulate presentation skills'
    ],
    duration: '2 Months (35 Sessions)',
    learningFormat: 'Masterclass Format + Mock Interviews',
    fee: 1699,
    badge: 'Career Boost'
  },
  {
    id: 'course-advanced',
    name: 'Advanced English',
    level: 'Advanced',
    shortDescription: 'For learners who want to develop stronger fluency, nuanced vocabulary, and leadership communication.',
    whatYouWillLearn: [
      'Nuanced tone control, formal vs informal language mastery',
      'Advanced debate, spontaneous argument articulation',
      'Refined accent clarity, pacing, stress & intonation',
      'Complex idea synthesis and persuasive speech'
    ],
    duration: '3 Months (60 Sessions)',
    learningFormat: 'Executive Live Batch',
    fee: 1999
  }
];

export const INITIAL_BATCHES: Batch[] = [
  {
    id: 'batch-spoken-oct-2026',
    name: 'Batch October 2026',
    courseId: 'course-spoken-english',
    courseName: 'Spoken English & Daily Fluency',
    batchCode: 'SPK-OCT-26',
    startDate: '1st October 2026',
    endDate: '15th December 2026',
    scheduleTime: '07:30 PM - 08:30 PM IST (Mon-Fri)',
    maxStudents: 35,
    currentStudentsCount: 28,
    enrolledCount: 28,
    maxCapacity: 35,
    status: 'Active',
    teacherName: 'Ziyaur Rehman Zia',
    isVisibleOnWebsite: true,
    googleMeetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK
  },
  {
    id: 'batch-spoken-nov-2026',
    name: 'Batch November 2026',
    courseId: 'course-spoken-english',
    courseName: 'Spoken English & Daily Fluency',
    batchCode: 'SPK-NOV-26',
    startDate: '1st November 2026',
    endDate: '15th January 2027',
    scheduleTime: '06:00 PM - 07:00 PM IST (Mon-Fri)',
    maxStudents: 35,
    currentStudentsCount: 14,
    enrolledCount: 14,
    maxCapacity: 35,
    status: 'Upcoming',
    teacherName: 'Ziyaur Rehman Zia',
    isVisibleOnWebsite: true,
    googleMeetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK
  },
  {
    id: 'batch-found-oct-2026',
    name: 'Batch Foundation October 2026',
    courseId: 'course-foundation',
    courseName: 'English Foundation (Basics)',
    batchCode: 'FND-OCT-26',
    startDate: '1st October 2026',
    endDate: '30th November 2026',
    scheduleTime: '04:30 PM - 05:30 PM IST (Mon-Fri)',
    maxStudents: 30,
    currentStudentsCount: 22,
    enrolledCount: 22,
    maxCapacity: 30,
    status: 'Active',
    teacherName: 'Ziyaur Rehman Zia',
    isVisibleOnWebsite: true,
    googleMeetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK
  }
];

export const INITIAL_TESTIMONIALS: TestimonialData[] = [
  {
    id: 'test-1',
    studentName: 'Mohd Farhan',
    courseBatch: 'Spoken English • Batch October 2026',
    testimonial: 'Before joining Wits Lingo, I was terrified of speaking English in public or during college presentations. Zia Sir\'s practical method of speaking from day one completely removed my hesitation. Now I express my ideas freely without mentally translating!',
    city: 'Amroha, UP',
    verified: true
  },
  {
    id: 'test-2',
    studentName: 'Sneha Patel',
    courseBatch: 'Communication Skills & Speaking',
    testimonial: 'The step-by-step pathway from simple sentences to natural dialogues gave me the exact confidence I needed. The batch environment is so welcoming that you never feel judged for making mistakes.',
    city: 'Moradabad, UP',
    verified: true
  },
  {
    id: 'test-3',
    studentName: 'Ahmad Sayeed',
    courseBatch: 'English Foundation & Fluency',
    testimonial: 'Coming from a Hindi-medium background in a small town, English grammar used to confuse me. Wits Lingo simplified everything with real-life examples. I can now attend job interviews with complete poise.',
    city: 'Hapur, UP',
    verified: true
  }
];

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  academyName: 'WITS LINGO',
  tagline: 'A Global Language Platform',
  phone1: '+91 7310952271',
  phone2: WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER,
  email: 'Witslingo@gmail.com',
  address: 'Dhakka, Amroha, Uttar Pradesh, India',
  whatsappChannelUrl: 'https://whatsapp.com/channel/0029Vb8dJ6C0rGiTXEMDB93k',
  instagramUrl: 'https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA==',
  facebookUrl: 'https://www.facebook.com/share/1BP5jTfk9B/',
  youtubeUrl: 'https://youtube.com/@witslingoeng',
  announcementText: 'New Batch Starts from 1st of each month • Admissions Open for October & November 2026',
  announcementBtnText: '',
  showAnnouncement: true,
  showBatchesSection: true,
  founderName: 'Ziyaur Rehman Zia',
  founderTitle: 'Founder & English Communication Mentor',
  batchesCompletedCount: '15+',
  activeStudentsCount: '100+',
  adminPasskey: 'admin123',
  bankName: 'State Bank of India',
  bankAccountHolder: 'Wits Lingo Academy / Mohammad Ziya',
  bankAccountNumber: '38920194821',
  bankIfscCode: 'SBIN0001234',
  bankBranch: 'Amroha Main Branch, Uttar Pradesh, India',
  bankAccountType: 'Current Account',
  bankSwiftBic: 'SBININBB123',
  upiId: '9027729917@ybl',
  upiNumber: '+91 9027729917',
  razorpayPaymentLink: 'https://rzp.io/l/witslingo',
  paypalEmailOrLink: 'https://paypal.me/witslingo',
  heroVideoUrl: '/video/wits-lingo-intro.mp4',
  heroVideoPosterUrl: '/video/wits-lingo-poster.jpg',
  logoUrl: '/logo.svg'
};

export const INITIAL_ANNOUNCEMENTS: import('../types').Announcement[] = [
  {
    id: 'ann-holiday-01',
    batchId: 'all',
    batchName: 'All Batches (Academy-wide)',
    title: '🏖️ Academy Holiday Notice: Gandhi Jayanti Observance',
    message: 'Dear Students & Parents,\n\nPlease note that Wits Lingo Academy and all live online classrooms will remain closed on Friday, 2nd October 2026 on the occasion of Gandhi Jayanti. No live speaking classes or teacher consultations will take place on this day.\n\nKey Guidelines for Students:\n• Self-paced vocabulary audio drills and previous session recordings will remain accessible 24/7 on your student dashboard.\n• Homework submissions for Assignment 03 will have an extended deadline until 4th October 2026.\n• Regular interactive live classes will resume punctually on Saturday, 3rd October as per your regular batch schedule.\n\nWarm regards,\nWits Lingo Administration',
    date: '28 Sept 2026',
    author: 'Ziyaur Rehman Zia',
    priority: 'Important',
    category: 'Holiday',
    effectiveDate: '2nd October 2026 (Full Day)',
    isPinned: true
  },
  {
    id: 'ann-cls-02',
    batchId: 'batch-spoken-oct-2026',
    batchName: 'Spoken English & Daily Fluency',
    title: '📢 Spoken English Batch: 1-on-1 Mock Interview Pairs on Friday',
    message: 'Attention Batch October 2026 learners:\n\nThis Friday\'s live session (07:30 PM - 08:30 PM IST) will feature mandatory 1-on-1 mock speaking pairs and individual fluency evaluations.\n\nPreparation Checklist:\n1. Please join the live class room 5 minutes early with your video camera turned on and microphone tested.\n2. Review the "100 High-Frequency Daily Dialogue Sheet" available in your study materials section.\n3. Prepare a concise 2-minute introduction covering your background, professional aspirations, and daily routine.\n\nActive participation is compulsory for monthly certificate grading.',
    date: '26 Sept 2026',
    author: 'Ziyaur Rehman Zia',
    priority: 'Urgent',
    category: 'Class Notice',
    effectiveDate: 'Friday, 07:30 PM IST',
    isPinned: true
  },
  {
    id: 'ann-sched-03',
    batchId: 'batch-found-oct-2026',
    batchName: 'English Foundation (Basics)',
    title: '🕒 English Foundation: Timing Adjusted to 5:00 PM for Revision Week',
    message: 'Dear Foundation Batch students,\n\nTo allow 15 extra minutes of guided pronunciation drills, our daily evening live class will temporarily commence at 05:00 PM IST instead of 04:30 PM IST during the upcoming Revision Week (28th Sept to 2nd Oct).\n\nPlease verify your class links on the dashboard. Class duration will be 60 minutes of intensive practice.',
    date: '24 Sept 2026',
    author: 'Ziyaur Rehman Zia',
    priority: 'Normal',
    category: 'Schedule Change',
    effectiveDate: '28 Sept - 2 Oct 2026',
    isPinned: false
  },
  {
    id: 'ann-gen-04',
    batchId: 'all',
    batchName: 'All Batches (Academy-wide)',
    title: '🎧 15 New Pronunciation & Tongue-Twister Audio Drills Uploaded',
    message: 'Exciting learning update!\n\n15 new studio-recorded audio drills focusing on removing Mother Tongue Influence (MTI), mastering \'P\' vs \'B\' and \'V\' vs \'W\' sound articulation, and connected conversational speech have been added to the Study Materials library.\n\nAll students are recommended to listen and shadow-speak for at least 10 minutes every morning.',
    date: '22 Sept 2026',
    author: 'Ziyaur Rehman Zia',
    priority: 'Normal',
    category: 'General',
    effectiveDate: 'Available Now',
    isPinned: false
  }
];

export const INITIAL_GALLERY_ITEMS: import('../types').GalleryItem[] = [
  {
    id: 'gal-01',
    title: 'Interactive Live Spoken English Session',
    caption: 'Students engaging in real-time conversational speaking drills, overcoming hesitation with guided peer discussions.',
    category: 'Live Sessions',
    imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 1,
    uploadedAt: '2026-09-15T10:00:00Z',
    fileSize: '1.2 MB'
  },
  {
    id: 'gal-02',
    title: 'Confidence Building & Public Speaking Workshop',
    caption: 'Dedicated masterclass session on stage presence, body language articulation, and spontaneous speaking.',
    category: 'Events & Workshops',
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 2,
    uploadedAt: '2026-09-18T14:30:00Z',
    fileSize: '1.5 MB'
  },
  {
    id: 'gal-03',
    title: '1-on-1 Mock Interview & Evaluation',
    caption: 'Personalized feedback and mock interview simulation preparing students for top corporate job placements.',
    category: 'Student Activities',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 3,
    uploadedAt: '2026-09-20T11:15:00Z',
    fileSize: '1.1 MB'
  },
  {
    id: 'gal-04',
    title: 'Collaborative Group Discussion & Debate',
    caption: 'Learners actively participating in structured debate rounds to hone persuasion, argumentation, and fluency.',
    category: 'Classrooms',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 4,
    uploadedAt: '2026-09-22T16:00:00Z',
    fileSize: '1.8 MB'
  },
  {
    id: 'gal-05',
    title: 'WITS LINGO Student Community Meetup',
    caption: 'Connecting passionate English learners across India, celebrating milestones, and sharing inspiring transformation stories.',
    category: 'Community',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 5,
    uploadedAt: '2026-09-25T09:45:00Z',
    fileSize: '1.4 MB'
  },
  {
    id: 'gal-06',
    title: 'Vocabulary & Pronunciation Mastery Drill',
    caption: 'In-depth breakdown of phonetics, eliminating Mother Tongue Influence (MTI) with practical articulation practice.',
    category: 'Classrooms',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    isPublished: true,
    displayOrder: 6,
    uploadedAt: '2026-09-28T12:20:00Z',
    fileSize: '1.3 MB'
  }
];

