import fs from 'fs';
import path from 'path';
import { 
  INITIAL_COURSES, 
  INITIAL_BATCHES, 
  INITIAL_TESTIMONIALS, 
  INITIAL_SITE_SETTINGS, 
  INITIAL_ANNOUNCEMENTS 
} from '../src/data/initialData';

const DATA_DIR = path.resolve(process.cwd(), 'uploads/data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeIfMissing(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  let shouldWrite = !fs.existsSync(filePath);
  if (!shouldWrite) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length === 0) {
        shouldWrite = true;
      }
    } catch (e) {
      shouldWrite = true;
    }
  }
  if (shouldWrite) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Seed] Seeded ${filename} with initial records.`);
  } else {
    console.log(`[Seed] ${filename} already exists.`);
  }
}

// 1. Courses
writeIfMissing('courses.json', INITIAL_COURSES);

// 2. Batches
writeIfMissing('batches.json', INITIAL_BATCHES);

// 3. Classes
const initialClasses = [
  {
    id: 'cls-1',
    batchId: INITIAL_BATCHES[0]?.id || 'batch-se-01',
    batchName: INITIAL_BATCHES[0]?.name || 'Spoken English Batch',
    title: 'Orientation & Hesitation Removal Drills',
    topic: 'Overcoming Stage Fear & Speaking Confidence',
    classNumber: 1,
    date: '2026-10-05',
    startTime: '07:30 PM',
    endTime: '08:30 PM',
    durationMinutes: 60,
    teacherName: 'Ziyaur Rehman Zia',
    description: 'First interactive icebreaker session and confidence building exercises.',
    status: 'Completed',
    googleMeetLink: 'https://meet.google.com/audit-orientation'
  }
];
writeIfMissing('classes.json', initialClasses);

// 4. Recordings
const initialRecordings = [
  {
    id: 'rec-1',
    batchId: INITIAL_BATCHES[0]?.id || 'batch-se-01',
    classId: 'cls-1',
    title: 'Orientation & Speaking Hesitation Removal',
    duration: '58 min',
    recordedDate: '2026-10-05',
    expiryDate: '2027-10-05',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=600&q=80',
    viewsCount: 38
  }
];
writeIfMissing('recordings.json', initialRecordings);

// 5. CMS Content
const cmsContent = {
  courses: INITIAL_COURSES,
  testimonials: INITIAL_TESTIMONIALS,
  settings: INITIAL_SITE_SETTINGS,
  email: 'hello@witslingo.com'
};
writeIfMissing('cms-content.json', cmsContent);
writeIfMissing('cmsContent.json', cmsContent);

// 6. Announcements
writeIfMissing('announcements.json', INITIAL_ANNOUNCEMENTS);

console.log('[Seed] All database persistence stores successfully verified!');
