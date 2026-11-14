import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('       WITS LINGO FULL CRUD PERSISTENCE & DATABASE AUDIT        ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failCount++;
  }
}

const DATA_DIR = path.resolve(process.cwd(), 'uploads/data');

// Test 1: Verify data directory exists
assert(fs.existsSync(DATA_DIR), 'Persistence data directory exists at uploads/data');

// Test 2: Check courses persistence file
const coursesFile = path.join(DATA_DIR, 'courses.json');
assert(fs.existsSync(coursesFile), 'courses.json storage file exists on disk');
let coursesData: any[] = [];
try {
  coursesData = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));
  assert(Array.isArray(coursesData) && coursesData.length > 0, `courses.json contains ${coursesData.length} persistent course records`);
} catch (e: any) {
  assert(false, `courses.json read failed: ${e.message}`);
}

// Test 3: Check batches persistence file
const batchesFile = path.join(DATA_DIR, 'batches.json');
assert(fs.existsSync(batchesFile), 'batches.json storage file exists on disk');
let batchesData: any[] = [];
try {
  batchesData = JSON.parse(fs.readFileSync(batchesFile, 'utf-8'));
  assert(Array.isArray(batchesData) && batchesData.length > 0, `batches.json contains ${batchesData.length} persistent batch records`);
} catch (e: any) {
  assert(false, `batches.json read failed: ${e.message}`);
}

// Test 4: Check classes persistence file
const classesFile = path.join(DATA_DIR, 'classes.json');
assert(fs.existsSync(classesFile), 'classes.json storage file exists on disk');
let classesData: any[] = [];
try {
  classesData = JSON.parse(fs.readFileSync(classesFile, 'utf-8'));
  assert(Array.isArray(classesData), `classes.json contains ${classesData.length} scheduled class records`);
} catch (e: any) {
  assert(false, `classes.json read failed: ${e.message}`);
}

// Test 5: Check recordings persistence file
const recordingsFile = path.join(DATA_DIR, 'recordings.json');
assert(fs.existsSync(recordingsFile), 'recordings.json storage file exists on disk');
let recordingsData: any[] = [];
try {
  recordingsData = JSON.parse(fs.readFileSync(recordingsFile, 'utf-8'));
  assert(Array.isArray(recordingsData), `recordings.json contains ${recordingsData.length} recording archive records`);
} catch (e: any) {
  assert(false, `recordings.json read failed: ${e.message}`);
}

// Test 6: Check cms-content / cmsContent persistence files
const cmsFile1 = path.join(DATA_DIR, 'cms-content.json');
const cmsFile2 = path.join(DATA_DIR, 'cmsContent.json');
assert(fs.existsSync(cmsFile1) || fs.existsSync(cmsFile2), 'CMS content storage file exists for durable cloud synchronization');

// Test 7: Check announcements persistence file
const announcementsFile = path.join(DATA_DIR, 'announcements.json');
assert(fs.existsSync(announcementsFile), 'announcements.json storage file exists on disk');
let announcementsData: any[] = [];
try {
  announcementsData = JSON.parse(fs.readFileSync(announcementsFile, 'utf-8'));
  assert(Array.isArray(announcementsData) && announcementsData.length > 0, `announcements.json contains ${announcementsData.length} persistent announcements`);
} catch (e: any) {
  assert(false, `announcements.json read failed: ${e.message}`);
}

// Test 8: Check materials persistence file
const materialsFile = path.join(DATA_DIR, 'materials.json');
assert(fs.existsSync(materialsFile), 'materials.json storage file exists on disk');
let materialsData: any[] = [];
try {
  materialsData = JSON.parse(fs.readFileSync(materialsFile, 'utf-8'));
  assert(Array.isArray(materialsData) && materialsData.length > 0, `materials.json contains ${materialsData.length} persistent study materials`);
} catch (e: any) {
  assert(false, `materials.json read failed: ${e.message}`);
}

// Test 9: Check gallery persistence file
const galleryFile = path.join(DATA_DIR, 'gallery.json');
assert(fs.existsSync(galleryFile), 'gallery.json storage file exists on disk');
let galleryData: any[] = [];
try {
  galleryData = JSON.parse(fs.readFileSync(galleryFile, 'utf-8'));
  assert(Array.isArray(galleryData) && galleryData.length > 0, `gallery.json contains ${galleryData.length} persistent gallery items`);
} catch (e: any) {
  assert(false, `gallery.json read failed: ${e.message}`);
}

// Test 10: Course CRUD Simulation with Full Round-trip Persistence
console.log('\n--- Simulating Course CRUD Data Persistence ---');
const testCourseId = `course-audit-test-${Date.now()}`;
const testCourse = {
  id: testCourseId,
  name: 'Advanced Business Communication & Fluency',
  level: 'Professional',
  shortDescription: 'Executive presentation and corporate vocabulary mastery.',
  fee: 2999,
  badge: 'Popular',
  isPublished: true,
  whatYouWillLearn: ['Boardroom presentations', 'High-stakes negotiations', 'Corporate email writing'],
  facilities: ['Live sessions', 'PDF notes', 'One-on-one coaching']
};

// CREATE
coursesData.push(testCourse);
fs.writeFileSync(coursesFile, JSON.stringify(coursesData, null, 2), 'utf-8');
let reloadedCourses = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));
assert(reloadedCourses.some((c: any) => c.id === testCourseId), 'Course CREATE: successfully persisted to database file');

// READ / UPDATE
const foundCourse = reloadedCourses.find((c: any) => c.id === testCourseId);
foundCourse.fee = 3499;
foundCourse.name = 'Advanced Business Communication & Leadership';
fs.writeFileSync(coursesFile, JSON.stringify(reloadedCourses, null, 2), 'utf-8');
reloadedCourses = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));
const updatedFound = reloadedCourses.find((c: any) => c.id === testCourseId);
assert(updatedFound && updatedFound.fee === 3499 && updatedFound.name === 'Advanced Business Communication & Leadership', 'Course UPDATE: successfully updated and verified from database file');

// DELETE
reloadedCourses = reloadedCourses.filter((c: any) => c.id !== testCourseId);
fs.writeFileSync(coursesFile, JSON.stringify(reloadedCourses, null, 2), 'utf-8');
reloadedCourses = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));
assert(!reloadedCourses.some((c: any) => c.id === testCourseId), 'Course DELETE: successfully removed from persistent database file');

// Test 11: Batch CRUD Simulation
console.log('\n--- Simulating Batch CRUD Data Persistence ---');
const testBatchId = `batch-audit-test-${Date.now()}`;
const testBatch = {
  id: testBatchId,
  name: 'Weekend Fluency Bootcamp',
  batchCode: 'WFB-2026',
  courseId: 'course-spoken-english',
  courseName: 'Spoken English',
  startDate: '2026-12-01',
  endDate: '2027-02-28',
  scheduleTime: 'Sat & Sun 10:00 AM - 12:00 PM IST',
  maxCapacity: 25,
  currentStudentsCount: 0,
  status: 'Upcoming',
  teacherName: 'Ziyaur Rehman Zia',
  isVisibleOnWebsite: true,
  googleMeetLink: 'https://meet.google.com/audit-test-wfb'
};

// CREATE
batchesData.push(testBatch);
fs.writeFileSync(batchesFile, JSON.stringify(batchesData, null, 2), 'utf-8');
let reloadedBatches = JSON.parse(fs.readFileSync(batchesFile, 'utf-8'));
assert(reloadedBatches.some((b: any) => b.id === testBatchId), 'Batch CREATE: successfully persisted to database file');

// UPDATE
const foundBatch = reloadedBatches.find((b: any) => b.id === testBatchId);
foundBatch.maxCapacity = 30;
foundBatch.status = 'Ongoing';
fs.writeFileSync(batchesFile, JSON.stringify(reloadedBatches, null, 2), 'utf-8');
reloadedBatches = JSON.parse(fs.readFileSync(batchesFile, 'utf-8'));
const updatedBatch = reloadedBatches.find((b: any) => b.id === testBatchId);
assert(updatedBatch && updatedBatch.maxCapacity === 30 && updatedBatch.status === 'Ongoing', 'Batch UPDATE: successfully modified and verified from database file');

// DELETE
reloadedBatches = reloadedBatches.filter((b: any) => b.id !== testBatchId);
fs.writeFileSync(batchesFile, JSON.stringify(reloadedBatches, null, 2), 'utf-8');
reloadedBatches = JSON.parse(fs.readFileSync(batchesFile, 'utf-8'));
assert(!reloadedBatches.some((b: any) => b.id === testBatchId), 'Batch DELETE: successfully removed from persistent database file');

// Test 12: SEO Configuration Verification
console.log('\n--- Verifying SEO Files & Tags ---');
const robotsContent = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf-8');
assert(robotsContent.includes('Disallow: /admin') && robotsContent.includes('Disallow: /api/'), 'robots.txt properly protects /admin and /api/ from unauthorized crawler indexing');
assert(robotsContent.includes('Sitemap: https://www.witslingo.com/sitemap.xml'), 'robots.txt references official sitemap.xml');

const sitemapContent = fs.readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf-8');
assert(sitemapContent.includes('<loc>https://www.witslingo.com/resources</loc>'), 'sitemap.xml includes /resources learning materials route');

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
assert(indexHtml.includes('application/ld+json') && indexHtml.includes('EducationalOrganization'), 'index.html contains valid JSON-LD EducationalOrganization structured metadata');

console.log('\n================================================================');
console.log(` AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
