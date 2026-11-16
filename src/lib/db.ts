import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import {
  CourseData,
  Batch,
  StudyMaterial,
  Announcement,
  GalleryItem,
  User,
  StudentRegistration,
  ClassSession,
  Recording,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  NotificationItem
} from "../types";

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedUrl: string | null = null;

/**
 * Returns a Neon serverless SQL query function for executing queries over HTTPS.
 * Throws a descriptive error if process.env.DATABASE_URL is not set.
 */
export function getDb(): NeonQueryFunction<false, false> {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  if (!cachedSql || cachedUrl !== dbUrl) {
    cachedSql = neon(dbUrl);
    cachedUrl = dbUrl;
  }
  return cachedSql;
}

/**
 * Idempotently initializes the primary administrator user in the `users` table.
 * Rules:
 * 1. Checks if ANY admin exists (SELECT id FROM users WHERE role = 'admin' LIMIT 1).
 * 2. Only if NO admin exists, inserts the administrator from ADMIN_EMAIL / ADMIN_PASSWORD.
 * 3. Uses ON CONFLICT (email) DO NOTHING so it NEVER overwrites an existing password.
 * 4. Passwords are securely hashed with bcrypt (cost factor 10).
 */
export async function ensureAdminUserExists(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.warn("[Database] DATABASE_URL not set; skipping admin user verification.");
    return;
  }

  try {
    const sql = getDb();

    // 1. Check if ANY admin already exists
    const existingAdmins = await sql`
      SELECT id, email, username FROM users WHERE role = 'admin' LIMIT 1;
    `;
    if (existingAdmins && existingAdmins.length > 0) {
      console.log(`[Database] Admin already exists in database (id: ${existingAdmins[0].id}). Skipping creation.`);
      return;
    }

    // 2. Derive credentials from environment variables
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@witslingo.com").trim().toLowerCase();
    const adminPassword = (process.env.ADMIN_PASSWORD || "admin123").trim();
    const adminName = (process.env.ADMIN_NAME || "WITS LINGO Administrator").trim();
    const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
    const adminPhone = (process.env.ADMIN_PHONE || "9027729917").trim();
    const adminId = "usr-admin-primary";

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // 3. Idempotent insertion with ON CONFLICT DO NOTHING
    await sql`
      INSERT INTO users (
        id,
        name,
        email,
        username,
        password_hash,
        role,
        phone,
        batch_ids
      ) VALUES (
        ${adminId},
        ${adminName},
        ${adminEmail},
        ${adminUsername},
        ${passwordHash},
        'admin',
        ${adminPhone},
        '[]'::jsonb
      ) ON CONFLICT (email) DO NOTHING;
    `;

    console.log(`[Database] Idempotent admin initialized successfully: ${adminEmail}`);
  } catch (err: any) {
    console.warn("[Database] ensureAdminUserExists notice:", err?.message || err);
  }
}

// ============================================================================
// SITE SETTINGS (NEON POSTGRESQL CRUD)
// ============================================================================

export interface DbSiteSettings {
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
  announcementBtnText: string;
  showAnnouncement: boolean;
  showBatchesSection: boolean;
  founderName: string;
  founderTitle: string;
  batchesCompletedCount: string;
  activeStudentsCount: string;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankBranch: string;
  bankAccountType: string;
  bankSwiftBic: string;
  upiId: string;
  upiNumber: string;
  razorpayPaymentLink: string;
  paypalEmailOrLink: string;
  heroVideoUrl: string;
  heroVideoPosterUrl: string;
  logoUrl: string;
  logoVersion: string;
  b2LogoId?: string;
  b2LogoName?: string;
  faviconUrl?: string;
  b2FaviconId?: string;
  b2FaviconName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function rowToSiteSettings(row: any): DbSiteSettings {
  return {
    academyName: row?.academy_name ?? "WITS LINGO",
    tagline: row?.tagline ?? "A Global Language Platform",
    phone1: row?.phone1 ?? "",
    phone2: row?.phone2 ?? "",
    email: row?.email ?? "",
    address: row?.address ?? "",
    whatsappChannelUrl: row?.whatsapp_channel_url ?? "",
    instagramUrl: row?.instagram_url ?? "",
    facebookUrl: row?.facebook_url ?? "",
    youtubeUrl: row?.youtube_url ?? "",
    announcementText: row?.announcement_text ?? "",
    announcementBtnText: row?.announcement_btn_text ?? "",
    showAnnouncement: Boolean(row?.show_announcement),
    showBatchesSection: row?.show_batches_section !== false,
    founderName: row?.founder_name ?? "",
    founderTitle: row?.founder_title ?? "",
    batchesCompletedCount: row?.batches_completed_count ?? "",
    activeStudentsCount: row?.active_students_count ?? "",
    bankName: row?.bank_name ?? "",
    bankAccountHolder: row?.bank_account_holder ?? "",
    bankAccountNumber: row?.bank_account_number ?? "",
    bankIfscCode: row?.bank_ifsc_code ?? "",
    bankBranch: row?.bank_branch ?? "",
    bankAccountType: row?.bank_account_type ?? "",
    bankSwiftBic: row?.bank_swift_bic ?? "",
    upiId: row?.upi_id ?? "",
    upiNumber: row?.upi_number ?? "",
    razorpayPaymentLink: row?.razorpay_payment_link ?? "",
    paypalEmailOrLink: row?.paypal_email_or_link ?? "",
    heroVideoUrl: row?.hero_video_url ?? "",
    heroVideoPosterUrl: row?.hero_video_poster_url ?? "",
    logoUrl: row?.logo_url ?? "",
    logoVersion: row?.logo_version ?? "1",
    b2LogoId: row?.b2_logo_id || undefined,
    b2LogoName: row?.b2_logo_name || undefined,
    faviconUrl: row?.favicon_url || undefined,
    b2FaviconId: row?.b2_favicon_id || undefined,
    b2FaviconName: row?.b2_favicon_name || undefined,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  };
}

/**
 * Retrieves the current site settings from the database.
 * Never reads from in-memory variables.
 */
export async function getSiteSettingsDb(): Promise<DbSiteSettings> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM site_settings WHERE id = 'primary' LIMIT 1;
  `;

  if (rows.length === 0) {
    // Provision singleton row if not exists
    await sql`
      INSERT INTO site_settings (id, academy_name)
      VALUES ('primary', 'WITS LINGO')
      ON CONFLICT (id) DO NOTHING;
    `;
    const freshRows = await sql`
      SELECT * FROM site_settings WHERE id = 'primary' LIMIT 1;
    `;
    return rowToSiteSettings(freshRows[0]);
  }

  return rowToSiteSettings(rows[0]);
}

/**
 * Updates site settings in the database.
 * Never stores data in in-memory variables.
 */
export async function updateSiteSettingsDb(patch: Partial<Record<string, any>>): Promise<DbSiteSettings> {
  const sql = getDb();

  // Ensure singleton row exists
  await sql`
    INSERT INTO site_settings (id, academy_name)
    VALUES ('primary', 'WITS LINGO')
    ON CONFLICT (id) DO NOTHING;
  `;

  const existingRows = await sql`
    SELECT * FROM site_settings WHERE id = 'primary' LIMIT 1;
  `;
  const cur = existingRows[0] || {};

  const academy_name = patch.academyName !== undefined ? patch.academyName : cur.academy_name;
  const tagline = patch.tagline !== undefined ? patch.tagline : cur.tagline;
  const phone1 = patch.phone1 !== undefined ? patch.phone1 : cur.phone1;
  const phone2 = patch.phone2 !== undefined ? patch.phone2 : cur.phone2;
  const email = patch.email !== undefined ? patch.email : cur.email;
  const address = patch.address !== undefined ? patch.address : cur.address;
  const whatsapp_channel_url = patch.whatsappChannelUrl !== undefined ? patch.whatsappChannelUrl : cur.whatsapp_channel_url;
  const instagram_url = patch.instagramUrl !== undefined ? patch.instagramUrl : cur.instagram_url;
  const facebook_url = patch.facebookUrl !== undefined ? patch.facebookUrl : cur.facebook_url;
  const youtube_url = patch.youtubeUrl !== undefined ? patch.youtubeUrl : cur.youtube_url;
  const announcement_text = patch.announcementText !== undefined ? patch.announcementText : cur.announcement_text;
  const announcement_btn_text = patch.announcementBtnText !== undefined ? patch.announcementBtnText : cur.announcement_btn_text;
  const show_announcement = patch.showAnnouncement !== undefined ? Boolean(patch.showAnnouncement) : cur.show_announcement;
  const show_batches_section = patch.showBatchesSection !== undefined ? Boolean(patch.showBatchesSection) : cur.show_batches_section;
  const founder_name = patch.founderName !== undefined ? patch.founderName : cur.founder_name;
  const founder_title = patch.founderTitle !== undefined ? patch.founderTitle : cur.founder_title;
  const batches_completed_count = patch.batchesCompletedCount !== undefined ? patch.batchesCompletedCount : cur.batches_completed_count;
  const active_students_count = patch.activeStudentsCount !== undefined ? patch.activeStudentsCount : cur.active_students_count;
  const bank_name = patch.bankName !== undefined ? patch.bankName : cur.bank_name;
  const bank_account_holder = patch.bankAccountHolder !== undefined ? patch.bankAccountHolder : cur.bank_account_holder;
  const bank_account_number = patch.bankAccountNumber !== undefined ? patch.bankAccountNumber : cur.bank_account_number;
  const bank_ifsc_code = patch.bankIfscCode !== undefined ? patch.bankIfscCode : cur.bank_ifsc_code;
  const bank_branch = patch.bankBranch !== undefined ? patch.bankBranch : cur.bank_branch;
  const bank_account_type = patch.bankAccountType !== undefined ? patch.bankAccountType : cur.bank_account_type;
  const bank_swift_bic = patch.bankSwiftBic !== undefined ? patch.bankSwiftBic : cur.bank_swift_bic;
  const upi_id = patch.upiId !== undefined ? patch.upiId : cur.upi_id;
  const upi_number = patch.upiNumber !== undefined ? patch.upiNumber : cur.upi_number;
  const razorpay_payment_link = patch.razorpayPaymentLink !== undefined ? patch.razorpayPaymentLink : cur.razorpay_payment_link;
  const paypal_email_or_link = patch.paypalEmailOrLink !== undefined ? patch.paypalEmailOrLink : cur.paypal_email_or_link;
  const hero_video_url = patch.heroVideoUrl !== undefined ? patch.heroVideoUrl : cur.hero_video_url;
  const hero_video_poster_url = patch.heroVideoPosterUrl !== undefined ? patch.heroVideoPosterUrl : cur.hero_video_poster_url;
  const logo_url = patch.logoUrl !== undefined ? patch.logoUrl : cur.logo_url;
  const logo_version = patch.logoVersion !== undefined ? String(patch.logoVersion) : cur.logo_version;
  const b2_logo_id = patch.b2LogoId !== undefined ? patch.b2LogoId : cur.b2_logo_id;
  const b2_logo_name = patch.b2LogoName !== undefined ? patch.b2LogoName : cur.b2_logo_name;
  const favicon_url = patch.faviconUrl !== undefined ? patch.faviconUrl : cur.favicon_url;
  const b2_favicon_id = patch.b2FaviconId !== undefined ? patch.b2FaviconId : cur.b2_favicon_id;
  const b2_favicon_name = patch.b2FaviconName !== undefined ? patch.b2FaviconName : cur.b2_favicon_name;

  const updatedRows = await sql`
    UPDATE site_settings SET
      academy_name = ${academy_name},
      tagline = ${tagline},
      phone1 = ${phone1},
      phone2 = ${phone2},
      email = ${email},
      address = ${address},
      whatsapp_channel_url = ${whatsapp_channel_url},
      instagram_url = ${instagram_url},
      facebook_url = ${facebook_url},
      youtube_url = ${youtube_url},
      announcement_text = ${announcement_text},
      announcement_btn_text = ${announcement_btn_text},
      show_announcement = ${show_announcement},
      show_batches_section = ${show_batches_section},
      founder_name = ${founder_name},
      founder_title = ${founder_title},
      batches_completed_count = ${batches_completed_count},
      active_students_count = ${active_students_count},
      bank_name = ${bank_name},
      bank_account_holder = ${bank_account_holder},
      bank_account_number = ${bank_account_number},
      bank_ifsc_code = ${bank_ifsc_code},
      bank_branch = ${bank_branch},
      bank_account_type = ${bank_account_type},
      bank_swift_bic = ${bank_swift_bic},
      upi_id = ${upi_id},
      upi_number = ${upi_number},
      razorpay_payment_link = ${razorpay_payment_link},
      paypal_email_or_link = ${paypal_email_or_link},
      hero_video_url = ${hero_video_url},
      hero_video_poster_url = ${hero_video_poster_url},
      logo_url = ${logo_url},
      logo_version = ${logo_version},
      b2_logo_id = ${b2_logo_id},
      b2_logo_name = ${b2_logo_name},
      favicon_url = ${favicon_url},
      b2_favicon_id = ${b2_favicon_id},
      b2_favicon_name = ${b2_favicon_name},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'primary'
    RETURNING *;
  `;

  return rowToSiteSettings(updatedRows[0]);
}

// ============================================================================
// REVIEWS & TESTIMONIALS (NEON POSTGRESQL CRUD)
// ============================================================================

export interface DbReview {
  id: string;
  studentName: string;
  courseBatch: string;
  testimonial: string;
  avatar?: string;
  city: string;
  date: string;
  verified: boolean;
  rating: number;
  authorKey?: string;
  isApproved: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export function rowToReview(row: any): DbReview {
  return {
    id: row.id,
    studentName: row.student_name,
    courseBatch: row.course_batch || "Wits Lingo Course",
    testimonial: row.testimonial,
    avatar: row.avatar_url || undefined,
    city: row.city || "Verified Student",
    date: row.date || "",
    verified: Boolean(row.verified),
    rating: Number(row.rating) || 5,
    authorKey: row.author_key || undefined,
    isApproved: Boolean(row.is_approved),
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Retrieves reviews directly from PostgreSQL.
 * Never reads from in-memory variables.
 */
export async function getReviewsDb(isAdmin: boolean = false): Promise<DbReview[]> {
  const sql = getDb();
  let rows;
  if (isAdmin) {
    rows = await sql`
      SELECT * FROM reviews 
      ORDER BY display_order ASC, created_at DESC;
    `;
  } else {
    rows = await sql`
      SELECT * FROM reviews 
      WHERE is_approved = true 
      ORDER BY display_order ASC, created_at DESC;
    `;
  }
  return rows.map(rowToReview);
}

/**
 * Inserts a new student review into PostgreSQL.
 */
export async function createReviewDb(data: {
  studentName: string;
  courseBatch?: string;
  testimonial: string;
  city?: string;
  rating?: number;
  avatarUrl?: string;
}): Promise<{ review: DbReview; authorKey: string }> {
  const sql = getDb();
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const authorKey = `auth_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const student_name = data.studentName.trim();
  const course_batch = (data.courseBatch || "Wits Lingo Course").trim();
  const testimonial = data.testimonial.trim();
  const city = data.city ? data.city.trim() : "Verified Student";
  const rating = Math.min(5, Math.max(1, Number(data.rating) || 5));
  const date = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const avatar_url = data.avatarUrl || null;
  const verified = true;
  const is_approved = true;

  const rows = await sql`
    INSERT INTO reviews (
      id,
      student_name,
      course_batch,
      testimonial,
      avatar_url,
      city,
      date,
      verified,
      rating,
      author_key,
      is_approved
    ) VALUES (
      ${reviewId},
      ${student_name},
      ${course_batch},
      ${testimonial},
      ${avatar_url},
      ${city},
      ${date},
      ${verified},
      ${rating},
      ${authorKey},
      ${is_approved}
    )
    RETURNING *;
  `;

  return {
    review: rowToReview(rows[0]),
    authorKey,
  };
}

/**
 * Updates a review in PostgreSQL.
 * Verifies author ownership or admin privilege.
 */
export async function updateReviewDb(
  id: string,
  data: {
    studentName?: string;
    courseBatch?: string;
    testimonial?: string;
    city?: string;
    rating?: number;
    isApproved?: boolean;
  },
  isAdmin: boolean,
  providedAuthorKey?: string
): Promise<{ status: number; error?: string; review?: DbReview }> {
  const sql = getDb();
  const existingRows = await sql`
    SELECT * FROM reviews WHERE id = ${id} LIMIT 1;
  `;
  if (existingRows.length === 0) {
    return { status: 404, error: "Review not found." };
  }

  const target = existingRows[0];
  const isAuthor = target.author_key && providedAuthorKey === target.author_key;

  if (!isAuthor && !isAdmin) {
    return { status: 403, error: "Unauthorized. You can only edit your own reviews." };
  }

  const student_name = data.studentName ? data.studentName.trim() : target.student_name;
  const course_batch = data.courseBatch ? data.courseBatch.trim() : target.course_batch;
  const testimonial = data.testimonial ? data.testimonial.trim() : target.testimonial;
  const rating = data.rating !== undefined ? Math.min(5, Math.max(1, Number(data.rating) || 5)) : target.rating;
  const city = data.city !== undefined ? data.city.trim() : target.city;
  const is_approved = (isAdmin && data.isApproved !== undefined) ? Boolean(data.isApproved) : target.is_approved;

  const updated = await sql`
    UPDATE reviews SET
      student_name = ${student_name},
      course_batch = ${course_batch},
      testimonial = ${testimonial},
      rating = ${rating},
      city = ${city},
      is_approved = ${is_approved},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;

  return {
    status: 200,
    review: rowToReview(updated[0]),
  };
}

/**
 * Deletes a review from PostgreSQL.
 * Verifies author ownership or admin privilege.
 */
export async function deleteReviewDb(
  id: string,
  isAdmin: boolean,
  providedAuthorKey?: string
): Promise<{ status: number; error?: string; deleted?: DbReview }> {
  const sql = getDb();
  const existingRows = await sql`
    SELECT * FROM reviews WHERE id = ${id} LIMIT 1;
  `;
  if (existingRows.length === 0) {
    return { status: 404, error: "Review not found." };
  }

  const target = existingRows[0];
  const isAuthor = target.author_key && providedAuthorKey === target.author_key;

  if (!isAuthor && !isAdmin) {
    return { status: 403, error: "Unauthorized to delete this review." };
  }

  const deleted = await sql`
    DELETE FROM reviews WHERE id = ${id} RETURNING *;
  `;

  return {
    status: 200,
    deleted: rowToReview(deleted[0]),
  };
}

// ============================================================================
// COURSES DATABASE OPERATIONS (Neon PostgreSQL)
// ============================================================================

function rowToCourse(row: any): CourseData {
  let whatYouWillLearn: string[] = [];
  if (Array.isArray(row.what_you_will_learn)) {
    whatYouWillLearn = row.what_you_will_learn;
  } else if (typeof row.what_you_will_learn === "string") {
    try { whatYouWillLearn = JSON.parse(row.what_you_will_learn); } catch {}
  }

  let facilities: string[] = [];
  if (Array.isArray(row.facilities)) {
    facilities = row.facilities;
  } else if (typeof row.facilities === "string") {
    try { facilities = JSON.parse(row.facilities); } catch {}
  }

  return {
    id: row.id,
    name: row.name,
    level: row.level || "Beginner to Intermediate",
    shortDescription: row.short_description || "",
    whatYouWillLearn,
    facilities,
    duration: row.duration || "",
    learningFormat: row.learning_format || "",
    fee: Number(row.fee) || 0,
    badge: row.badge || undefined,
    imageUrl: row.image_url || undefined,
    isPublished: Boolean(row.is_published),
    order: row.display_order ?? 0,
  };
}

export async function getCoursesDb(includeUnpublished: boolean = false): Promise<CourseData[]> {
  const sql = getDb();
  const rows = includeUnpublished
    ? await sql`SELECT * FROM courses ORDER BY display_order ASC, created_at ASC;`
    : await sql`SELECT * FROM courses WHERE is_published = true ORDER BY display_order ASC, created_at ASC;`;
  return rows.map(rowToCourse);
}

export async function getCourseByIdDb(id: string): Promise<CourseData | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM courses WHERE id = ${id} LIMIT 1;`;
  return rows.length > 0 ? rowToCourse(rows[0]) : null;
}

export async function createCourseDb(data: Partial<CourseData>): Promise<CourseData> {
  const sql = getDb();
  const id = data.id || `course-${Date.now()}`;
  const name = (data.name || "Untitled Course").trim();
  const level = data.level || "Beginner to Intermediate";
  const short_description = data.shortDescription || "";
  const what_you_will_learn = JSON.stringify(data.whatYouWillLearn || []);
  const facilities = JSON.stringify(data.facilities || []);
  const duration = data.duration || "";
  const learning_format = data.learningFormat || "Live Online Classroom";
  const fee = Number(data.fee) || 0;
  const badge = data.badge || null;
  const image_url = data.imageUrl || null;
  const is_published = data.isPublished !== false;
  const display_order = data.order ?? 0;

  const rows = await sql`
    INSERT INTO courses (
      id, name, level, short_description, what_you_will_learn,
      facilities, duration, learning_format, fee, badge,
      image_url, is_published, display_order
    ) VALUES (
      ${id}, ${name}, ${level}, ${short_description}, ${what_you_will_learn}::jsonb,
      ${facilities}::jsonb, ${duration}, ${learning_format}, ${fee}, ${badge},
      ${image_url}, ${is_published}, ${display_order}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      level = EXCLUDED.level,
      short_description = EXCLUDED.short_description,
      what_you_will_learn = EXCLUDED.what_you_will_learn,
      facilities = EXCLUDED.facilities,
      duration = EXCLUDED.duration,
      learning_format = EXCLUDED.learning_format,
      fee = EXCLUDED.fee,
      badge = EXCLUDED.badge,
      image_url = EXCLUDED.image_url,
      is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToCourse(rows[0]);
}

export async function updateCourseDb(id: string, data: Partial<CourseData>): Promise<CourseData | null> {
  const sql = getDb();
  const existing = await getCourseByIdDb(id);
  if (!existing) return null;

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const level = data.level !== undefined ? data.level : existing.level;
  const short_description = data.shortDescription !== undefined ? data.shortDescription : existing.shortDescription;
  const what_you_will_learn = JSON.stringify(data.whatYouWillLearn !== undefined ? data.whatYouWillLearn : existing.whatYouWillLearn);
  const facilities = JSON.stringify(data.facilities !== undefined ? data.facilities : (existing.facilities || []));
  const duration = data.duration !== undefined ? data.duration : existing.duration;
  const learning_format = data.learningFormat !== undefined ? data.learningFormat : existing.learningFormat;
  const fee = data.fee !== undefined ? Number(data.fee) : existing.fee;
  const badge = data.badge !== undefined ? data.badge : (existing.badge || null);
  const image_url = data.imageUrl !== undefined ? data.imageUrl : (existing.imageUrl || null);
  const is_published = data.isPublished !== undefined ? Boolean(data.isPublished) : existing.isPublished;
  const display_order = data.order !== undefined ? data.order : existing.order;

  const rows = await sql`
    UPDATE courses SET
      name = ${name},
      level = ${level},
      short_description = ${short_description},
      what_you_will_learn = ${what_you_will_learn}::jsonb,
      facilities = ${facilities}::jsonb,
      duration = ${duration},
      learning_format = ${learning_format},
      fee = ${fee},
      badge = ${badge},
      image_url = ${image_url},
      is_published = ${is_published},
      display_order = ${display_order},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToCourse(rows[0]) : null;
}

export async function setCoursePublishedDb(id: string, isPublished: boolean): Promise<CourseData | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE courses SET
      is_published = ${isPublished},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToCourse(rows[0]) : null;
}

export async function deleteCourseDb(id: string): Promise<CourseData | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM courses WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToCourse(rows[0]) : null;
}

// ============================================================================
// BATCHES DATABASE OPERATIONS (Neon PostgreSQL)
// Dynamic enrolled_count calculated from student_registrations
// ============================================================================

function rowToBatch(row: any): Batch {
  const enrolled = Number(row.enrolled_count ?? 0);
  const maxCap = Number(row.max_students ?? 30);
  return {
    id: row.id,
    name: row.name,
    courseId: row.course_id || "",
    courseName: row.course_name || "",
    batchCode: row.batch_code || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    teacherName: row.teacher_name || "",
    scheduleTime: row.schedule_time || "",
    classTime: row.class_time || undefined,
    scheduleInfo: row.schedule_info || undefined,
    maxStudents: maxCap,
    currentStudentsCount: enrolled,
    enrolledCount: enrolled,
    maxCapacity: maxCap,
    status: (row.status || "Upcoming") as any,
    recordingsExpiryDate: row.recordings_expiry_date || undefined,
    description: row.description || undefined,
    isVisibleOnWebsite: row.is_visible_on_website !== false,
    googleMeetLink: row.google_meet_link || undefined,
    meetLink: row.google_meet_link || undefined,
  };
}

export async function getBatchesDb(includeHidden: boolean = false): Promise<Batch[]> {
  const sql = getDb();
  const rows = includeHidden
    ? await sql`
        SELECT b.*,
               COALESCE((
                 SELECT count(*)::int 
                 FROM student_registrations sr 
                 WHERE sr.batch_id = b.id
               ), 0) AS enrolled_count
        FROM batches b
        ORDER BY b.created_at DESC;
      `
    : await sql`
        SELECT b.*,
               COALESCE((
                 SELECT count(*)::int 
                 FROM student_registrations sr 
                 WHERE sr.batch_id = b.id
               ), 0) AS enrolled_count
        FROM batches b
        WHERE b.is_visible_on_website = true
        ORDER BY b.created_at DESC;
      `;
  return rows.map(rowToBatch);
}

export async function getBatchByIdDb(id: string): Promise<Batch | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT b.*,
           COALESCE((
             SELECT count(*)::int 
             FROM student_registrations sr 
             WHERE sr.batch_id = b.id
           ), 0) AS enrolled_count
    FROM batches b
    WHERE b.id = ${id}
    LIMIT 1;
  `;
  return rows.length > 0 ? rowToBatch(rows[0]) : null;
}

export async function createBatchDb(data: Partial<Batch>): Promise<Batch> {
  const sql = getDb();
  const id = data.id || `batch-${Date.now()}`;
  const name = (data.name || "New Batch").trim();
  let course_id = (data.courseId && data.courseId !== "all") ? data.courseId : null;
  if (course_id) {
    try {
      const courseRows = await sql`SELECT id FROM courses WHERE id = ${course_id} LIMIT 1;`;
      if (!courseRows || courseRows.length === 0) {
        course_id = null;
      }
    } catch {
      course_id = null;
    }
  }
  const course_name = data.courseName || null;
  const batch_code = data.batchCode || "";
  const start_date = data.startDate || "";
  const end_date = data.endDate || "";
  const teacher_name = data.teacherName || "";
  const schedule_time = data.scheduleTime || "";
  const class_time = data.classTime || schedule_time;
  const schedule_info = data.scheduleInfo || "";
  const max_students = Number(data.maxStudents || data.maxCapacity || 30);
  const status = data.status || "Upcoming";
  const recordings_expiry_date = data.recordingsExpiryDate || null;
  const description = data.description || null;
  const is_visible_on_website = data.isVisibleOnWebsite !== false;
  const google_meet_link = data.googleMeetLink || data.meetLink || null;

  const rows = await sql`
    INSERT INTO batches (
      id, name, course_id, course_name, batch_code,
      start_date, end_date, teacher_name, schedule_time, class_time,
      schedule_info, max_students, status, recordings_expiry_date,
      description, is_visible_on_website, google_meet_link
    ) VALUES (
      ${id}, ${name}, ${course_id}, ${course_name}, ${batch_code},
      ${start_date}, ${end_date}, ${teacher_name}, ${schedule_time}, ${class_time},
      ${schedule_info}, ${max_students}, ${status}, ${recordings_expiry_date},
      ${description}, ${is_visible_on_website}, ${google_meet_link}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      course_id = EXCLUDED.course_id,
      course_name = EXCLUDED.course_name,
      batch_code = EXCLUDED.batch_code,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      teacher_name = EXCLUDED.teacher_name,
      schedule_time = EXCLUDED.schedule_time,
      class_time = EXCLUDED.class_time,
      schedule_info = EXCLUDED.schedule_info,
      max_students = EXCLUDED.max_students,
      status = EXCLUDED.status,
      recordings_expiry_date = EXCLUDED.recordings_expiry_date,
      description = EXCLUDED.description,
      is_visible_on_website = EXCLUDED.is_visible_on_website,
      google_meet_link = EXCLUDED.google_meet_link,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToBatch(rows[0]);
}

export async function updateBatchDb(id: string, data: Partial<Batch>): Promise<Batch | null> {
  const sql = getDb();
  const existing = await getBatchByIdDb(id);
  if (!existing) return null;

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  let rawCourseId = data.courseId !== undefined ? (data.courseId || null) : (existing.courseId || null);
  let course_id = (rawCourseId && rawCourseId !== "all") ? rawCourseId : null;
  if (course_id) {
    try {
      const courseRows = await sql`SELECT id FROM courses WHERE id = ${course_id} LIMIT 1;`;
      if (!courseRows || courseRows.length === 0) {
        course_id = null;
      }
    } catch {
      course_id = null;
    }
  }
  const course_name = data.courseName !== undefined ? data.courseName : existing.courseName;
  const batch_code = data.batchCode !== undefined ? data.batchCode : existing.batchCode;
  const start_date = data.startDate !== undefined ? data.startDate : existing.startDate;
  const end_date = data.endDate !== undefined ? data.endDate : existing.endDate;
  const teacher_name = data.teacherName !== undefined ? data.teacherName : existing.teacherName;
  const schedule_time = data.scheduleTime !== undefined ? data.scheduleTime : existing.scheduleTime;
  const class_time = data.classTime !== undefined ? data.classTime : (existing.classTime || existing.scheduleTime);
  const schedule_info = data.scheduleInfo !== undefined ? data.scheduleInfo : (existing.scheduleInfo || null);
  const max_students = data.maxStudents !== undefined ? Number(data.maxStudents) : (data.maxCapacity !== undefined ? Number(data.maxCapacity) : existing.maxStudents);
  const status = data.status !== undefined ? data.status : existing.status;
  const recordings_expiry_date = data.recordingsExpiryDate !== undefined ? data.recordingsExpiryDate : (existing.recordingsExpiryDate || null);
  const description = data.description !== undefined ? data.description : (existing.description || null);
  const is_visible_on_website = data.isVisibleOnWebsite !== undefined ? Boolean(data.isVisibleOnWebsite) : existing.isVisibleOnWebsite;
  const google_meet_link = (data.googleMeetLink !== undefined || data.meetLink !== undefined) ? (data.googleMeetLink || data.meetLink || null) : (existing.googleMeetLink || null);

  const rows = await sql`
    UPDATE batches SET
      name = ${name},
      course_id = ${course_id},
      course_name = ${course_name},
      batch_code = ${batch_code},
      start_date = ${start_date},
      end_date = ${end_date},
      teacher_name = ${teacher_name},
      schedule_time = ${schedule_time},
      class_time = ${class_time},
      schedule_info = ${schedule_info},
      max_students = ${max_students},
      status = ${status},
      recordings_expiry_date = ${recordings_expiry_date},
      description = ${description},
      is_visible_on_website = ${is_visible_on_website},
      google_meet_link = ${google_meet_link},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToBatch(rows[0]) : null;
}

export async function deleteBatchDb(id: string): Promise<Batch | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM batches WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToBatch(rows[0]) : null;
}

// ============================================================================
// STUDY MATERIALS & VIDEO LESSONS (Neon PostgreSQL)
// Atomic download_count increment
// ============================================================================

function rowToStudyMaterial(row: any): StudyMaterial {
  return {
    id: row.id,
    resourceType: (row.resource_type || "pdf") as any,
    batchId: row.batch_id || "",
    classId: row.class_id || undefined,
    title: row.title,
    description: row.description || "",
    fileType: row.file_type || "pdf",
    fileSize: row.file_size || "",
    downloadUrl: row.download_url || "",
    pdfUrl: row.pdf_url || row.download_url || "",
    b2FileId: row.b2_file_id || undefined,
    b2FileName: row.b2_file_name || undefined,
    mimeType: row.mime_type || undefined,
    isViewOnly: Boolean(row.is_view_only),
    allowDownload: Boolean(row.allow_download),
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
    uploadedDate: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
    category: row.category || "General",
    level: row.level || "All Levels",
    isVisibleOnWebsite: Boolean(row.is_visible_on_website),
    isPublished: Boolean(row.is_published),
    displayOrder: row.display_order ?? 0,
    youtubeUrl: row.youtube_url || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    b2ThumbnailId: row.b2_thumbnail_id || undefined,
    b2ThumbnailName: row.b2_thumbnail_name || undefined,
    duration: row.duration || undefined,
    views: row.views || "0",
    downloadCount: Number(row.download_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getStudyMaterialsDb(opts?: {
  resourceType?: string;
  batchId?: string;
  includeUnpublished?: boolean;
}): Promise<StudyMaterial[]> {
  const sql = getDb();
  const resourceType = opts?.resourceType;
  const batchId = opts?.batchId;
  const includeUnpublished = Boolean(opts?.includeUnpublished);

  let rows;
  if (includeUnpublished) {
    if (resourceType && batchId) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE resource_type = ${resourceType} AND batch_id = ${batchId}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else if (resourceType) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE resource_type = ${resourceType}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else if (batchId) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE batch_id = ${batchId}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else {
      rows = await sql`
        SELECT * FROM study_materials 
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    }
  } else {
    if (resourceType && batchId) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE is_published = true AND resource_type = ${resourceType} AND batch_id = ${batchId}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else if (resourceType) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE is_published = true AND resource_type = ${resourceType}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else if (batchId) {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE is_published = true AND batch_id = ${batchId}
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else {
      rows = await sql`
        SELECT * FROM study_materials 
        WHERE is_published = true
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    }
  }

  return rows.map(rowToStudyMaterial);
}

export async function getStudyMaterialByIdDb(id: string): Promise<StudyMaterial | null> {
  const sql = getDb();
  const cleanId = (id || '').trim();
  if (!cleanId) return null;
  const pattern = `%${cleanId}%`;
  const rows = await sql`
    SELECT * FROM study_materials 
    WHERE id = ${cleanId} 
       OR pdf_url ILIKE ${pattern} 
       OR thumbnail_url ILIKE ${pattern} 
       OR b2_file_name ILIKE ${pattern} 
       OR b2_thumbnail_name ILIKE ${pattern}
    LIMIT 1;
  `;
  return rows.length > 0 ? rowToStudyMaterial(rows[0]) : null;
}

export async function createStudyMaterialDb(data: Partial<StudyMaterial>): Promise<StudyMaterial> {
  const sql = getDb();
  const id = data.id || `mat-${Date.now()}`;
  const resource_type = data.resourceType || "pdf";
  let batch_id = (data.batchId && data.batchId !== "all") ? data.batchId : null;
  if (batch_id) {
    try {
      const batchRows = await sql`SELECT id FROM batches WHERE id = ${batch_id} LIMIT 1;`;
      if (!batchRows || batchRows.length === 0) {
        batch_id = null;
      }
    } catch {
      batch_id = null;
    }
  }
  let class_id = (data.classId && data.classId !== "all") ? data.classId : null;
  if (class_id) {
    try {
      const classRows = await sql`SELECT id FROM classes WHERE id = ${class_id} LIMIT 1;`;
      if (!classRows || classRows.length === 0) {
        class_id = null;
      }
    } catch {
      class_id = null;
    }
  }
  const title = (data.title || "Untitled Resource").trim();
  const description = data.description || "";
  const category = data.category || "General";
  const level = data.level || "All Levels";
  const file_type = data.fileType || "pdf";
  const file_size = data.fileSize || "";
  const download_url = data.downloadUrl || data.pdfUrl || "";
  const pdf_url = data.pdfUrl || download_url;
  const b2_file_id = data.b2FileId || null;
  const b2_file_name = data.b2FileName || null;
  const mime_type = data.mimeType || null;
  const is_view_only = data.isViewOnly !== false;
  const allow_download = data.allowDownload === true;
  const is_visible_on_website = data.isVisibleOnWebsite !== false;
  const is_published = data.isPublished !== false;
  const display_order = data.displayOrder ?? 0;
  const youtube_url = data.youtubeUrl || null;
  const thumbnail_url = data.thumbnailUrl || null;
  const b2_thumbnail_id = data.b2ThumbnailId || null;
  const b2_thumbnail_name = data.b2ThumbnailName || null;
  const duration = data.duration || null;
  const views = data.views || "0";

  const rows = await sql`
    INSERT INTO study_materials (
      id, resource_type, batch_id, class_id, title, description,
      category, level, file_type, file_size, download_url, pdf_url,
      b2_file_id, b2_file_name, mime_type, is_view_only, allow_download,
      is_visible_on_website, is_published, display_order, youtube_url,
      thumbnail_url, b2_thumbnail_id, b2_thumbnail_name, duration, views
    ) VALUES (
      ${id}, ${resource_type}, ${batch_id}, ${class_id}, ${title}, ${description},
      ${category}, ${level}, ${file_type}, ${file_size}, ${download_url}, ${pdf_url},
      ${b2_file_id}, ${b2_file_name}, ${mime_type}, ${is_view_only}, ${allow_download},
      ${is_visible_on_website}, ${is_published}, ${display_order}, ${youtube_url},
      ${thumbnail_url}, ${b2_thumbnail_id}, ${b2_thumbnail_name}, ${duration}, ${views}
    )
    ON CONFLICT (id) DO UPDATE SET
      resource_type = EXCLUDED.resource_type,
      batch_id = EXCLUDED.batch_id,
      class_id = EXCLUDED.class_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      level = EXCLUDED.level,
      file_type = EXCLUDED.file_type,
      file_size = EXCLUDED.file_size,
      download_url = EXCLUDED.download_url,
      pdf_url = EXCLUDED.pdf_url,
      b2_file_id = EXCLUDED.b2_file_id,
      b2_file_name = EXCLUDED.b2_file_name,
      mime_type = EXCLUDED.mime_type,
      is_view_only = EXCLUDED.is_view_only,
      allow_download = EXCLUDED.allow_download,
      is_visible_on_website = EXCLUDED.is_visible_on_website,
      is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order,
      youtube_url = EXCLUDED.youtube_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      b2_thumbnail_id = EXCLUDED.b2_thumbnail_id,
      b2_thumbnail_name = EXCLUDED.b2_thumbnail_name,
      duration = EXCLUDED.duration,
      views = EXCLUDED.views,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToStudyMaterial(rows[0]);
}

export async function updateStudyMaterialDb(id: string, data: Partial<StudyMaterial>): Promise<StudyMaterial | null> {
  const sql = getDb();
  const existing = await getStudyMaterialByIdDb(id);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const description = data.description !== undefined ? data.description : existing.description;
  const category = data.category !== undefined ? data.category : existing.category;
  const level = data.level !== undefined ? data.level : existing.level;
  const file_type = data.fileType !== undefined ? data.fileType : existing.fileType;
  const file_size = data.fileSize !== undefined ? data.fileSize : existing.fileSize;
  const download_url = data.downloadUrl !== undefined ? data.downloadUrl : existing.downloadUrl;
  const pdf_url = data.pdfUrl !== undefined ? data.pdfUrl : existing.pdfUrl;
  const b2_file_id = data.b2FileId !== undefined ? data.b2FileId : (existing.b2FileId || null);
  const b2_file_name = data.b2FileName !== undefined ? data.b2FileName : (existing.b2FileName || null);
  const mime_type = data.mimeType !== undefined ? data.mimeType : (existing.mimeType || null);
  const is_view_only = data.isViewOnly !== undefined ? Boolean(data.isViewOnly) : existing.isViewOnly;
  const allow_download = data.allowDownload !== undefined ? Boolean(data.allowDownload) : existing.allowDownload;
  const is_visible_on_website = data.isVisibleOnWebsite !== undefined ? Boolean(data.isVisibleOnWebsite) : existing.isVisibleOnWebsite;
  const is_published = data.isPublished !== undefined ? Boolean(data.isPublished) : existing.isPublished;
  const display_order = data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder;
  const youtube_url = data.youtubeUrl !== undefined ? data.youtubeUrl : (existing.youtubeUrl || null);
  const thumbnail_url = data.thumbnailUrl !== undefined ? data.thumbnailUrl : (existing.thumbnailUrl || null);
  const b2_thumbnail_id = data.b2ThumbnailId !== undefined ? data.b2ThumbnailId : (existing.b2ThumbnailId || null);
  const b2_thumbnail_name = data.b2ThumbnailName !== undefined ? data.b2ThumbnailName : (existing.b2ThumbnailName || null);
  const duration = data.duration !== undefined ? data.duration : (existing.duration || null);
  const views = data.views !== undefined ? data.views : existing.views;

  const rows = await sql`
    UPDATE study_materials SET
      title = ${title},
      description = ${description},
      category = ${category},
      level = ${level},
      file_type = ${file_type},
      file_size = ${file_size},
      download_url = ${download_url},
      pdf_url = ${pdf_url},
      b2_file_id = ${b2_file_id},
      b2_file_name = ${b2_file_name},
      mime_type = ${mime_type},
      is_view_only = ${is_view_only},
      allow_download = ${allow_download},
      is_visible_on_website = ${is_visible_on_website},
      is_published = ${is_published},
      display_order = ${display_order},
      youtube_url = ${youtube_url},
      thumbnail_url = ${thumbnail_url},
      b2_thumbnail_id = ${b2_thumbnail_id},
      b2_thumbnail_name = ${b2_thumbnail_name},
      duration = ${duration},
      views = ${views},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToStudyMaterial(rows[0]) : null;
}

export async function deleteStudyMaterialDb(id: string): Promise<any | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM study_materials WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rows[0] : null;
}

export async function incrementMaterialDownloadCountDb(id: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    UPDATE study_materials 
    SET download_count = download_count + 1 
    WHERE id = ${id} 
    RETURNING download_count;
  `;
  return rows.length > 0 ? Number(rows[0].download_count) : 0;
}

// ============================================================================
// ANNOUNCEMENTS & NOTICES (Neon PostgreSQL)
// ============================================================================

function rowToAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    batchId: row.batch_id || "all",
    batchName: row.batch_name || "All Batches (Academy-wide)",
    title: row.title,
    message: row.message,
    date: row.date || (row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN") : ""),
    author: row.author || "Administration",
    priority: (row.priority || "Normal") as any,
    category: (row.category || "General") as any,
    effectiveDate: row.effective_date || undefined,
    isPinned: Boolean(row.is_pinned),
  };
}

export async function getAnnouncementsDb(batchId?: string): Promise<Announcement[]> {
  const sql = getDb();
  let rows;
  if (batchId && batchId !== "all") {
    rows = await sql`
      SELECT * FROM announcements 
      WHERE batch_id = ${batchId} OR batch_id IS NULL
      ORDER BY is_pinned DESC, created_at DESC;
    `;
  } else {
    rows = await sql`
      SELECT * FROM announcements 
      ORDER BY is_pinned DESC, created_at DESC;
    `;
  }
  return rows.map(rowToAnnouncement);
}

export async function getAnnouncementByIdDb(id: string): Promise<Announcement | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM announcements WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToAnnouncement(rows[0]) : null;
}

export async function createAnnouncementDb(data: Partial<Announcement>): Promise<Announcement> {
  const sql = getDb();
  const id = data.id || `ann-${Date.now()}`;
  const batch_id = (data.batchId && data.batchId !== "all") ? data.batchId : null;
  const batch_name = batch_id ? (data.batchName || null) : "All Batches (Academy-wide)";
  const title = (data.title || "Announcement").trim();
  const message = (data.message || "").trim();
  const date = data.date || new Date().toLocaleDateString("en-IN");
  const author = data.author || "Administration";
  const validPriorities = ["Normal", "Important", "Urgent"];
  const priority = validPriorities.includes(data.priority as any) ? data.priority : "Normal";
  const category = data.category || "General";
  const effective_date = data.effectiveDate || null;
  const is_pinned = Boolean(data.isPinned);

  const rows = await sql`
    INSERT INTO announcements (
      id, batch_id, batch_name, title, message, date,
      author, priority, category, effective_date, is_pinned
    ) VALUES (
      ${id}, ${batch_id}, ${batch_name}, ${title}, ${message}, ${date},
      ${author}, ${priority}, ${category}, ${effective_date}, ${is_pinned}
    )
    ON CONFLICT (id) DO UPDATE SET
      batch_id = EXCLUDED.batch_id,
      batch_name = EXCLUDED.batch_name,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      date = EXCLUDED.date,
      author = EXCLUDED.author,
      priority = EXCLUDED.priority,
      category = EXCLUDED.category,
      effective_date = EXCLUDED.effective_date,
      is_pinned = EXCLUDED.is_pinned,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToAnnouncement(rows[0]);
}

export async function updateAnnouncementDb(id: string, data: Partial<Announcement>): Promise<Announcement | null> {
  const sql = getDb();
  const existing = await getAnnouncementByIdDb(id);
  if (!existing) return null;

  const batch_id = data.batchId !== undefined 
    ? ((data.batchId && data.batchId !== "all") ? data.batchId : null) 
    : ((existing.batchId && existing.batchId !== "all") ? existing.batchId : null);
  const batch_name = batch_id 
    ? (data.batchName !== undefined ? data.batchName : existing.batchName) 
    : "All Batches (Academy-wide)";
  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const message = data.message !== undefined ? data.message.trim() : existing.message;
  const date = data.date !== undefined ? data.date : existing.date;
  const author = data.author !== undefined ? data.author : existing.author;
  const validPriorities = ["Normal", "Important", "Urgent"];
  const priority = data.priority !== undefined 
    ? (validPriorities.includes(data.priority as any) ? data.priority : "Normal") 
    : existing.priority;
  const category = data.category !== undefined ? data.category : existing.category;
  const effective_date = data.effectiveDate !== undefined ? data.effectiveDate : (existing.effectiveDate || null);
  const is_pinned = data.isPinned !== undefined ? Boolean(data.isPinned) : existing.isPinned;

  const rows = await sql`
    UPDATE announcements SET
      batch_id = ${batch_id},
      batch_name = ${batch_name},
      title = ${title},
      message = ${message},
      date = ${date},
      author = ${author},
      priority = ${priority},
      category = ${category},
      effective_date = ${effective_date},
      is_pinned = ${is_pinned},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToAnnouncement(rows[0]) : null;
}

export async function deleteAnnouncementDb(id: string): Promise<Announcement | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM announcements WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToAnnouncement(rows[0]) : null;
}

// ============================================================================
// GALLERY ITEMS (Neon PostgreSQL)
// ============================================================================

function rowToGalleryItem(row: any): GalleryItem {
  return {
    id: row.id,
    title: row.title || undefined,
    caption: row.caption || undefined,
    category: row.category || "General",
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url || undefined,
    b2FileId: row.b2_file_id || undefined,
    b2FileName: row.b2_file_name || undefined,
    fileSize: row.file_size || undefined,
    uploadedBy: row.uploaded_by || undefined,
    isPublished: Boolean(row.is_published),
    displayOrder: row.display_order ?? 0,
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
  };
}

export async function getGalleryItemsDb(includeUnpublished: boolean = false, categoryFilter?: string): Promise<GalleryItem[]> {
  const sql = getDb();
  let rows;
  const cat = categoryFilter && categoryFilter.toLowerCase() !== "all" && categoryFilter.toLowerCase() !== "all moments" 
    ? categoryFilter.trim() 
    : null;

  if (includeUnpublished) {
    if (cat) {
      rows = await sql`
        SELECT * FROM gallery_items 
        WHERE LOWER(category) = LOWER(${cat})
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else {
      rows = await sql`
        SELECT * FROM gallery_items 
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    }
  } else {
    if (cat) {
      rows = await sql`
        SELECT * FROM gallery_items 
        WHERE is_published = true AND LOWER(category) = LOWER(${cat})
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    } else {
      rows = await sql`
        SELECT * FROM gallery_items 
        WHERE is_published = true
        ORDER BY display_order ASC, uploaded_at DESC;
      `;
    }
  }

  return rows.map(rowToGalleryItem);
}

export async function getGalleryItemByIdDb(id: string): Promise<GalleryItem | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM gallery_items WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToGalleryItem(rows[0]) : null;
}

export async function createGalleryItemDb(data: Partial<GalleryItem>): Promise<GalleryItem> {
  const sql = getDb();
  const id = data.id || `gal-${Date.now()}`;
  const title = data.title || null;
  const caption = data.caption || null;
  const category = data.category || "General";
  const image_url = data.imageUrl || "";
  const thumbnail_url = data.thumbnailUrl || null;
  const b2_file_id = data.b2FileId || null;
  const b2_file_name = data.b2FileName || null;
  const file_size = data.fileSize || null;
  const uploaded_by = data.uploadedBy || "Admin";
  const is_published = data.isPublished !== false;
  const display_order = data.displayOrder ?? 0;

  const rows = await sql`
    INSERT INTO gallery_items (
      id, title, caption, category, image_url, thumbnail_url,
      b2_file_id, b2_file_name, file_size, uploaded_by,
      is_published, display_order
    ) VALUES (
      ${id}, ${title}, ${caption}, ${category}, ${image_url}, ${thumbnail_url},
      ${b2_file_id}, ${b2_file_name}, ${file_size}, ${uploaded_by},
      ${is_published}, ${display_order}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      caption = EXCLUDED.caption,
      category = EXCLUDED.category,
      image_url = EXCLUDED.image_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      b2_file_id = EXCLUDED.b2_file_id,
      b2_file_name = EXCLUDED.b2_file_name,
      file_size = EXCLUDED.file_size,
      uploaded_by = EXCLUDED.uploaded_by,
      is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToGalleryItem(rows[0]);
}

export async function updateGalleryItemDb(id: string, data: Partial<GalleryItem>): Promise<GalleryItem | null> {
  const sql = getDb();
  const existing = await getGalleryItemByIdDb(id);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const caption = data.caption !== undefined ? data.caption : existing.caption;
  const category = data.category !== undefined ? data.category : existing.category;
  const image_url = data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl;
  const thumbnail_url = data.thumbnailUrl !== undefined ? data.thumbnailUrl : (existing.thumbnailUrl || null);
  const b2_file_id = data.b2FileId !== undefined ? data.b2FileId : (existing.b2FileId || null);
  const b2_file_name = data.b2FileName !== undefined ? data.b2FileName : (existing.b2FileName || null);
  const file_size = data.fileSize !== undefined ? data.fileSize : (existing.fileSize || null);
  const uploaded_by = data.uploadedBy !== undefined ? data.uploadedBy : (existing.uploadedBy || null);
  const is_published = data.isPublished !== undefined ? Boolean(data.isPublished) : existing.isPublished;
  const display_order = data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder;

  const rows = await sql`
    UPDATE gallery_items SET
      title = ${title},
      caption = ${caption},
      category = ${category},
      image_url = ${image_url},
      thumbnail_url = ${thumbnail_url},
      b2_file_id = ${b2_file_id},
      b2_file_name = ${b2_file_name},
      file_size = ${file_size},
      uploaded_by = ${uploaded_by},
      is_published = ${is_published},
      display_order = ${display_order},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToGalleryItem(rows[0]) : null;
}

export async function reorderGalleryItemsDb(orderPairs: { id: string; displayOrder: number }[]): Promise<void> {
  const sql = getDb();
  for (const pair of orderPairs) {
    await sql`
      UPDATE gallery_items 
      SET display_order = ${pair.displayOrder}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${pair.id};
    `;
  }
}

export async function deleteGalleryItemDb(id: string): Promise<GalleryItem | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM gallery_items WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToGalleryItem(rows[0]) : null;
}

// ============================================================================
// USERS & AUTHENTICATION (Neon PostgreSQL)
// ============================================================================

export interface DbUserRecord {
  id: string;
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
  role: 'student' | 'teacher' | 'admin';
  phone?: string;
  batchIds: string[];
  admissionId?: string;
  avatarUrl?: string;
  registrationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

function rowToUser(row: any): DbUserRecord {
  let parsedBatchIds: string[] = [];
  if (Array.isArray(row.batch_ids)) {
    parsedBatchIds = row.batch_ids;
  } else if (typeof row.batch_ids === 'string') {
    try {
      parsedBatchIds = JSON.parse(row.batch_ids);
    } catch {
      parsedBatchIds = [];
    }
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username || undefined,
    passwordHash: row.password_hash,
    role: row.role,
    phone: row.phone || undefined,
    batchIds: parsedBatchIds,
    admissionId: row.admission_id || undefined,
    avatarUrl: row.avatar_url || undefined,
    registrationDate: row.registration_date ? new Date(row.registration_date).toISOString() : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getUserByEmailDb(email: string): Promise<DbUserRecord | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM users WHERE LOWER(email) = LOWER(${email.trim()}) LIMIT 1;
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function getUserByIdDb(id: string): Promise<DbUserRecord | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM users WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function createUserDb(user: {
  id?: string;
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
  role?: 'student' | 'teacher' | 'admin';
  phone?: string;
  batchIds?: string[];
  admissionId?: string;
  avatarUrl?: string;
}): Promise<DbUserRecord> {
  const sql = getDb();
  const id = user.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const role = user.role || 'student';
  const batch_ids = JSON.stringify(user.batchIds || []);
  const email = user.email.trim().toLowerCase();

  const rows = await sql`
    INSERT INTO users (
      id, name, email, username, password_hash, role, phone, batch_ids, admission_id, avatar_url
    ) VALUES (
      ${id}, ${user.name}, ${email}, ${user.username || null}, ${user.passwordHash},
      ${role}, ${user.phone || null}, ${batch_ids}::jsonb, ${user.admissionId || null}, ${user.avatarUrl || null}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, users.phone),
      batch_ids = EXCLUDED.batch_ids,
      admission_id = COALESCE(EXCLUDED.admission_id, users.admission_id),
      avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToUser(rows[0]);
}

export async function updateUserDb(id: string, updates: Partial<DbUserRecord>): Promise<DbUserRecord | null> {
  const sql = getDb();
  const existing = await getUserByIdDb(id);
  if (!existing) return null;

  const name = updates.name !== undefined ? updates.name : existing.name;
  const email = updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email;
  const username = updates.username !== undefined ? updates.username : existing.username;
  const passwordHash = updates.passwordHash !== undefined ? updates.passwordHash : existing.passwordHash;
  const role = updates.role !== undefined ? updates.role : existing.role;
  const phone = updates.phone !== undefined ? updates.phone : existing.phone;
  const batch_ids = JSON.stringify(updates.batchIds !== undefined ? updates.batchIds : existing.batchIds);
  const admissionId = updates.admissionId !== undefined ? updates.admissionId : existing.admissionId;
  const avatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl;

  const rows = await sql`
    UPDATE users SET
      name = ${name},
      email = ${email},
      username = ${username || null},
      password_hash = ${passwordHash},
      role = ${role},
      phone = ${phone || null},
      batch_ids = ${batch_ids}::jsonb,
      admission_id = ${admissionId || null},
      avatar_url = ${avatarUrl || null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function deleteUserDb(id: string): Promise<DbUserRecord | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM users WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function getStudentsDb(): Promise<DbUserRecord[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM users WHERE role = 'student' ORDER BY created_at DESC;
  `;
  return rows.map(rowToUser);
}

// ============================================================================
// STUDENT REGISTRATIONS (Neon PostgreSQL)
// ============================================================================

function rowToStudentRegistration(row: any): StudentRegistration {
  return {
    id: row.id,
    admissionId: row.admission_id,
    name: row.name,
    fatherName: row.father_name || '',
    dob: row.dob || '',
    gender: row.gender || '',
    country: row.country || 'India',
    district: row.district || '',
    state: row.state || '',
    pincode: row.pincode || undefined,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address || '',
    qualification: row.qualification || '',
    currentEnglishLevel: row.current_english_level || 'Beginner',
    courseId: row.course_id || '',
    courseName: row.course_name || '',
    batchId: row.batch_id || '',
    batchName: row.batch_name || '',
    feeAmount: Number(row.fee_amount || 0),
    paymentStatus: (row.payment_status || 'Pending') as any,
    paymentMethod: row.payment_method || 'Online',
    paymentCurrency: row.payment_currency || 'INR',
    paymentAmountFormatted: row.payment_amount_formatted || undefined,
    paymentTxnId: row.payment_txn_id || '',
    razorpayOrderId: row.razorpay_order_id || undefined,
    razorpayPaymentId: row.razorpay_payment_id || undefined,
    razorpaySignature: row.razorpay_signature || undefined,
    googleMeetLink: row.google_meet_link || undefined,
    whatsappDeliveryStatus: row.whatsapp_delivery_status || 'pending',
    whatsappMessageId: row.whatsapp_message_id || undefined,
    whatsappSentAt: row.whatsapp_sent_at ? new Date(row.whatsapp_sent_at).toISOString() : undefined,
    whatsappError: row.whatsapp_error || undefined,
    facilities: Array.isArray(row.facilities) ? row.facilities : (typeof row.facilities === 'string' ? JSON.parse(row.facilities) : []),
    registeredAt: row.registered_at ? new Date(row.registered_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString())
  };
}

export async function getRegistrationsDb(batchId?: string): Promise<StudentRegistration[]> {
  const sql = getDb();
  let rows;
  if (batchId) {
    rows = await sql`
      SELECT * FROM student_registrations WHERE batch_id = ${batchId} ORDER BY registered_at DESC;
    `;
  } else {
    rows = await sql`
      SELECT * FROM student_registrations ORDER BY registered_at DESC;
    `;
  }
  return rows.map(rowToStudentRegistration);
}

export async function getRegistrationByIdDb(id: string): Promise<StudentRegistration | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM student_registrations WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToStudentRegistration(rows[0]) : null;
}

export async function getRegistrationByAdmissionIdDb(admissionId: string): Promise<StudentRegistration | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM student_registrations WHERE LOWER(admission_id) = LOWER(${admissionId.trim()}) LIMIT 1;
  `;
  return rows.length > 0 ? rowToStudentRegistration(rows[0]) : null;
}

export async function createRegistrationDb(data: Partial<StudentRegistration> & { whatsappConfirmationMessage?: string; whatsappStudentUrl?: string; whatsappAdminUrl?: string }): Promise<StudentRegistration> {
  const sql = getDb();
  const id = data.id || `reg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const admissionId = data.admissionId || `WL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const facilities = JSON.stringify(data.facilities || []);

  let course_id = (data.courseId && data.courseId !== "all") ? data.courseId : null;
  if (course_id) {
    try {
      const courseRows = await sql`SELECT id FROM courses WHERE id = ${course_id} LIMIT 1;`;
      if (!courseRows || courseRows.length === 0) {
        course_id = null;
      }
    } catch {
      course_id = null;
    }
  }

  let batch_id = (data.batchId && data.batchId !== "all") ? data.batchId : null;
  if (batch_id) {
    try {
      const batchRows = await sql`SELECT id FROM batches WHERE id = ${batch_id} LIMIT 1;`;
      if (!batchRows || batchRows.length === 0) {
        batch_id = null;
      }
    } catch {
      batch_id = null;
    }
  }

  const rows = await sql`
    INSERT INTO student_registrations (
      id, admission_id, name, father_name, dob, gender, country, district, state, pincode,
      phone, whatsapp, email, address, qualification, current_english_level,
      course_id, course_name, batch_id, batch_name, fee_amount, payment_status,
      payment_method, payment_currency, payment_amount_formatted, payment_txn_id,
      razorpay_order_id, razorpay_payment_id, razorpay_signature, google_meet_link,
      whatsapp_delivery_status, whatsapp_message_id, whatsapp_error, facilities,
      whatsapp_confirmation_message, whatsapp_student_url, whatsapp_admin_url
    ) VALUES (
      ${id}, ${admissionId}, ${data.name || ''}, ${data.fatherName || null}, ${data.dob || null},
      ${data.gender || null}, ${data.country || 'India'}, ${data.district || null}, ${data.state || null},
      ${data.pincode || null}, ${data.phone || ''}, ${data.whatsapp || data.phone || ''}, ${data.email || ''},
      ${data.address || null}, ${data.qualification || null}, ${data.currentEnglishLevel || null},
      ${course_id}, ${data.courseName || null}, ${batch_id}, ${data.batchName || null},
      ${Number(data.feeAmount || 0)}, ${data.paymentStatus || 'Pending'}, ${data.paymentMethod || 'Online'},
      ${data.paymentCurrency || 'INR'}, ${data.paymentAmountFormatted || null}, ${data.paymentTxnId || null},
      ${data.razorpayOrderId || null}, ${data.razorpayPaymentId || null}, ${data.razorpaySignature || null},
      ${data.googleMeetLink || null}, ${data.whatsappDeliveryStatus || 'pending'}, ${data.whatsappMessageId || null},
      ${data.whatsappError || null}, ${facilities}::jsonb,
      ${data.whatsappConfirmationMessage || null}, ${data.whatsappStudentUrl || null}, ${data.whatsappAdminUrl || null}
    )
    ON CONFLICT (admission_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      whatsapp = EXCLUDED.whatsapp,
      email = EXCLUDED.email,
      course_id = EXCLUDED.course_id,
      course_name = EXCLUDED.course_name,
      batch_id = EXCLUDED.batch_id,
      batch_name = EXCLUDED.batch_name,
      fee_amount = EXCLUDED.fee_amount,
      payment_status = EXCLUDED.payment_status,
      payment_txn_id = COALESCE(EXCLUDED.payment_txn_id, student_registrations.payment_txn_id),
      razorpay_order_id = COALESCE(EXCLUDED.razorpay_order_id, student_registrations.razorpay_order_id),
      razorpay_payment_id = COALESCE(EXCLUDED.razorpay_payment_id, student_registrations.razorpay_payment_id),
      google_meet_link = COALESCE(EXCLUDED.google_meet_link, student_registrations.google_meet_link),
      whatsapp_delivery_status = COALESCE(EXCLUDED.whatsapp_delivery_status, student_registrations.whatsapp_delivery_status),
      whatsapp_message_id = COALESCE(EXCLUDED.whatsapp_message_id, student_registrations.whatsapp_message_id),
      whatsapp_sent_at = CASE WHEN EXCLUDED.whatsapp_delivery_status = 'sent' THEN CURRENT_TIMESTAMP ELSE student_registrations.whatsapp_sent_at END,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToStudentRegistration(rows[0]);
}

export async function updateRegistrationDb(id: string, data: Partial<StudentRegistration>): Promise<StudentRegistration | null> {
  const sql = getDb();
  const existing = await getRegistrationByIdDb(id);
  if (!existing) return null;

  const name = data.name !== undefined ? data.name : existing.name;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const whatsapp = data.whatsapp !== undefined ? data.whatsapp : existing.whatsapp;
  const email = data.email !== undefined ? data.email : existing.email;
  const courseId = data.courseId !== undefined ? data.courseId : existing.courseId;
  const courseName = data.courseName !== undefined ? data.courseName : existing.courseName;
  const batchId = data.batchId !== undefined ? data.batchId : existing.batchId;
  const batchName = data.batchName !== undefined ? data.batchName : existing.batchName;
  const feeAmount = data.feeAmount !== undefined ? Number(data.feeAmount) : existing.feeAmount;
  const paymentStatus = data.paymentStatus !== undefined ? data.paymentStatus : existing.paymentStatus;
  const paymentMethod = data.paymentMethod !== undefined ? data.paymentMethod : existing.paymentMethod;
  const paymentTxnId = data.paymentTxnId !== undefined ? data.paymentTxnId : existing.paymentTxnId;
  const googleMeetLink = data.googleMeetLink !== undefined ? data.googleMeetLink : existing.googleMeetLink;
  const whatsappDeliveryStatus = data.whatsappDeliveryStatus !== undefined ? data.whatsappDeliveryStatus : existing.whatsappDeliveryStatus;
  const whatsappMessageId = data.whatsappMessageId !== undefined ? data.whatsappMessageId : existing.whatsappMessageId;
  const whatsappError = data.whatsappError !== undefined ? data.whatsappError : existing.whatsappError;

  const rows = await sql`
    UPDATE student_registrations SET
      name = ${name},
      phone = ${phone},
      whatsapp = ${whatsapp},
      email = ${email},
      course_id = ${courseId || null},
      course_name = ${courseName || null},
      batch_id = ${batchId || null},
      batch_name = ${batchName || null},
      fee_amount = ${feeAmount},
      payment_status = ${paymentStatus},
      payment_method = ${paymentMethod || null},
      payment_txn_id = ${paymentTxnId || null},
      google_meet_link = ${googleMeetLink || null},
      whatsapp_delivery_status = ${whatsappDeliveryStatus || 'pending'},
      whatsapp_message_id = ${whatsappMessageId || null},
      whatsapp_error = ${whatsappError || null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToStudentRegistration(rows[0]) : null;
}

export async function deleteRegistrationDb(id: string): Promise<StudentRegistration | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM student_registrations WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToStudentRegistration(rows[0]) : null;
}

// ============================================================================
// CLASSES & TIMETABLE (Neon PostgreSQL)
// ============================================================================

function rowToClass(row: any): ClassSession {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchName: row.batch_name || '',
    title: row.title,
    topic: row.topic || '',
    classNumber: row.class_number ?? 1,
    date: row.date || '',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : (row.start_time || ''),
    durationMinutes: row.duration_minutes ?? 60,
    teacherName: row.teacher_name || 'Ziyaur Rehman Zia',
    instructorName: row.teacher_name || 'Ziyaur Rehman Zia',
    description: row.description || '',
    status: row.status || 'Upcoming',
    joinUrl: row.join_url || undefined,
    recordingId: row.recording_id || undefined,
    hasStudyMaterial: Boolean(row.has_study_material),
    hasAssignment: Boolean(row.has_assignment),
    videoKey: row.video_key || undefined
  };
}

export async function getClassesDb(batchId?: string): Promise<ClassSession[]> {
  const sql = getDb();
  let rows;
  if (batchId) {
    rows = await sql`
      SELECT * FROM classes WHERE batch_id = ${batchId} ORDER BY date ASC, start_time ASC;
    `;
  } else {
    rows = await sql`
      SELECT * FROM classes ORDER BY date ASC, start_time ASC;
    `;
  }
  return rows.map(rowToClass);
}

export async function getClassByIdDb(id: string): Promise<ClassSession | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM classes WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToClass(rows[0]) : null;
}

export async function createClassDb(data: Partial<ClassSession>): Promise<ClassSession> {
  const sql = getDb();
  const id = data.id || `cls-${Date.now()}`;
  let batch_id = data.batchId || "";
  let batch_name = data.batchName || "";
  try {
    const batchRows = await sql`SELECT id, name FROM batches WHERE id = ${batch_id} LIMIT 1;`;
    if (!batchRows || batchRows.length === 0) {
      const anyBatch = await sql`SELECT id, name FROM batches LIMIT 1;`;
      if (anyBatch && anyBatch.length > 0) {
        batch_id = anyBatch[0].id;
        batch_name = anyBatch[0].name;
      } else {
        const autoBatch = await createBatchDb({
          name: "Live Spoken English Cohort",
          batchCode: "BATCH-LIVE-1",
          status: "Upcoming"
        });
        batch_id = autoBatch.id;
        batch_name = autoBatch.name;
      }
    } else {
      batch_name = batchRows[0].name;
    }
  } catch {
    // Keep existing
  }
  const title = data.title || 'Live Interactive Class';
  const topic = data.topic || '';
  const class_number = data.classNumber ?? 1;
  const date = data.date || new Date().toISOString().split('T')[0];
  const start_time = data.startTime || '07:30 PM';
  const end_time = data.endTime || '08:30 PM';
  const duration_minutes = data.durationMinutes ?? 60;
  const teacher_name = data.teacherName || 'Ziyaur Rehman Zia';
  const description = data.description || '';
  const status = data.status || 'Upcoming';
  const join_url = data.joinUrl || null;
  const recording_id = data.recordingId || null;
  const has_study_material = Boolean(data.hasStudyMaterial);
  const has_assignment = Boolean(data.hasAssignment);
  const video_key = data.videoKey || null;

  const rows = await sql`
    INSERT INTO classes (
      id, batch_id, batch_name, title, topic, class_number, date,
      start_time, end_time, duration_minutes, teacher_name, description,
      status, join_url, recording_id, has_study_material, has_assignment, video_key
    ) VALUES (
      ${id}, ${batch_id}, ${batch_name}, ${title}, ${topic}, ${class_number}, ${date},
      ${start_time}, ${end_time}, ${duration_minutes}, ${teacher_name}, ${description},
      ${status}, ${join_url}, ${recording_id}, ${has_study_material}, ${has_assignment}, ${video_key}
    )
    ON CONFLICT (id) DO UPDATE SET
      batch_id = EXCLUDED.batch_id,
      batch_name = EXCLUDED.batch_name,
      title = EXCLUDED.title,
      topic = EXCLUDED.topic,
      class_number = EXCLUDED.class_number,
      date = EXCLUDED.date,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      duration_minutes = EXCLUDED.duration_minutes,
      teacher_name = EXCLUDED.teacher_name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      join_url = EXCLUDED.join_url,
      recording_id = EXCLUDED.recording_id,
      has_study_material = EXCLUDED.has_study_material,
      has_assignment = EXCLUDED.has_assignment,
      video_key = EXCLUDED.video_key,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToClass(rows[0]);
}

export async function updateClassDb(id: string, data: Partial<ClassSession>): Promise<ClassSession | null> {
  const sql = getDb();
  const existing = await getClassByIdDb(id);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const topic = data.topic !== undefined ? data.topic : existing.topic;
  const class_number = data.classNumber !== undefined ? data.classNumber : existing.classNumber;
  const date = data.date !== undefined ? data.date : existing.date;
  const start_time = data.startTime !== undefined ? data.startTime : existing.startTime;
  const end_time = data.endTime !== undefined ? data.endTime : existing.endTime;
  const duration_minutes = data.durationMinutes !== undefined ? data.durationMinutes : existing.durationMinutes;
  const teacher_name = data.teacherName !== undefined ? data.teacherName : existing.teacherName;
  const description = data.description !== undefined ? data.description : existing.description;
  const status = data.status !== undefined ? data.status : existing.status;
  const join_url = data.joinUrl !== undefined ? data.joinUrl : (existing.joinUrl || null);
  const recording_id = data.recordingId !== undefined ? data.recordingId : (existing.recordingId || null);
  const has_study_material = data.hasStudyMaterial !== undefined ? Boolean(data.hasStudyMaterial) : existing.hasStudyMaterial;
  const has_assignment = data.hasAssignment !== undefined ? Boolean(data.hasAssignment) : existing.hasAssignment;
  const video_key = data.videoKey !== undefined ? data.videoKey : (existing.videoKey || null);

  const rows = await sql`
    UPDATE classes SET
      title = ${title},
      topic = ${topic},
      class_number = ${class_number},
      date = ${date},
      start_time = ${start_time},
      end_time = ${end_time},
      duration_minutes = ${duration_minutes},
      teacher_name = ${teacher_name},
      description = ${description},
      status = ${status},
      join_url = ${join_url},
      recording_id = ${recording_id},
      has_study_material = ${has_study_material},
      has_assignment = ${has_assignment},
      video_key = ${video_key},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToClass(rows[0]) : null;
}

export async function deleteClassDb(id: string): Promise<ClassSession | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM classes WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToClass(rows[0]) : null;
}

// ============================================================================
// RECORDINGS (Neon PostgreSQL)
// ============================================================================

function rowToRecording(row: any): Recording {
  return {
    id: row.id,
    classId: row.class_id || '',
    batchId: row.batch_id,
    batchName: row.batch_name || '',
    title: row.title,
    topic: row.topic || '',
    classNumber: row.class_number ?? 1,
    date: row.date || '',
    recordedDate: row.date || '',
    duration: row.duration || '60 min',
    status: row.status || 'Available',
    videoKey: row.video_key,
    description: row.notes_summary || ''
  };
}

export async function getRecordingsDb(batchId?: string): Promise<Recording[]> {
  const sql = getDb();
  let rows;
  if (batchId) {
    rows = await sql`
      SELECT * FROM recordings WHERE batch_id = ${batchId} ORDER BY date DESC, class_number DESC;
    `;
  } else {
    rows = await sql`
      SELECT * FROM recordings ORDER BY date DESC, class_number DESC;
    `;
  }
  return rows.map(rowToRecording);
}

export async function getRecordingByIdDb(id: string): Promise<Recording | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM recordings WHERE id = ${id} LIMIT 1;
  `;
  return rows.length > 0 ? rowToRecording(rows[0]) : null;
}

export async function createRecordingDb(data: Partial<Recording>): Promise<Recording> {
  const sql = getDb();
  const id = data.id || `rec-${Date.now()}`;
  const class_id = data.classId || null;
  const batch_id = data.batchId!;
  const batch_name = data.batchName || '';
  const title = data.title || 'Recorded Lecture Session';
  const topic = data.topic || '';
  const class_number = data.classNumber ?? 1;
  const date = data.date || new Date().toISOString().split('T')[0];
  const duration = data.duration || '60 min';
  const status = data.status || 'Available';
  const video_key = data.videoKey || `video_rec_${batch_id}_${id}`;
  const notes_summary = data.description || '';

  const rows = await sql`
    INSERT INTO recordings (
      id, class_id, batch_id, batch_name, title, topic, class_number,
      date, duration, status, video_key, notes_summary
    ) VALUES (
      ${id}, ${class_id}, ${batch_id}, ${batch_name}, ${title}, ${topic}, ${class_number},
      ${date}, ${duration}, ${status}, ${video_key}, ${notes_summary}
    )
    ON CONFLICT (id) DO UPDATE SET
      class_id = EXCLUDED.class_id,
      batch_id = EXCLUDED.batch_id,
      batch_name = EXCLUDED.batch_name,
      title = EXCLUDED.title,
      topic = EXCLUDED.topic,
      class_number = EXCLUDED.class_number,
      date = EXCLUDED.date,
      duration = EXCLUDED.duration,
      status = EXCLUDED.status,
      video_key = EXCLUDED.video_key,
      notes_summary = EXCLUDED.notes_summary,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToRecording(rows[0]);
}

export async function updateRecordingDb(id: string, data: Partial<Recording>): Promise<Recording | null> {
  const sql = getDb();
  const existing = await getRecordingByIdDb(id);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const topic = data.topic !== undefined ? data.topic : existing.topic;
  const date = data.date !== undefined ? data.date : existing.date;
  const duration = data.duration !== undefined ? data.duration : existing.duration;
  const status = data.status !== undefined ? data.status : existing.status;
  const video_key = data.videoKey !== undefined ? data.videoKey : existing.videoKey;
  const notes_summary = data.description !== undefined ? data.description : existing.description;

  const rows = await sql`
    UPDATE recordings SET
      title = ${title},
      topic = ${topic},
      date = ${date},
      duration = ${duration},
      status = ${status},
      video_key = ${video_key},
      notes_summary = ${notes_summary},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToRecording(rows[0]) : null;
}

export async function deleteRecordingDb(id: string): Promise<Recording | null> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM recordings WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? rowToRecording(rows[0]) : null;
}

// ============================================================================
// ASSIGNMENTS & HOMEWORK (Neon PostgreSQL)
// Dynamic submissions_count via subquery
// ============================================================================

function rowToAssignment(row: any): Assignment {
  return {
    id: row.id,
    batchId: row.batch_id,
    classId: row.class_id || undefined,
    title: row.title,
    description: row.description || '',
    dueDate: row.due_date || '',
    totalPoints: row.total_points ?? 100,
    submissionsCount: Number(row.submissions_count ?? 0)
  };
}

export async function getAssignmentsDb(batchId?: string): Promise<Assignment[]> {
  const sql = getDb();
  let rows;
  if (batchId) {
    rows = await sql`
      SELECT a.*, COALESCE((SELECT COUNT(*)::int FROM assignment_submissions s WHERE s.assignment_id = a.id), 0) AS submissions_count
      FROM assignments a
      WHERE a.batch_id = ${batchId}
      ORDER BY a.created_at DESC;
    `;
  } else {
    rows = await sql`
      SELECT a.*, COALESCE((SELECT COUNT(*)::int FROM assignment_submissions s WHERE s.assignment_id = a.id), 0) AS submissions_count
      FROM assignments a
      ORDER BY a.created_at DESC;
    `;
  }
  return rows.map(rowToAssignment);
}

export async function getAssignmentByIdDb(id: string): Promise<Assignment | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT a.*, COALESCE((SELECT COUNT(*)::int FROM assignment_submissions s WHERE s.assignment_id = a.id), 0) AS submissions_count
    FROM assignments a
    WHERE a.id = ${id}
    LIMIT 1;
  `;
  return rows.length > 0 ? rowToAssignment(rows[0]) : null;
}

export async function createAssignmentDb(data: Partial<Assignment>): Promise<Assignment> {
  const sql = getDb();
  const id = data.id || `asg-${Date.now()}`;
  const batch_id = data.batchId!;
  const class_id = data.classId || null;
  const title = data.title || 'Assignment Task';
  const description = data.description || '';
  const due_date = data.dueDate || '';
  const total_points = data.totalPoints ?? 100;

  const rows = await sql`
    INSERT INTO assignments (id, batch_id, class_id, title, description, due_date, total_points)
    VALUES (${id}, ${batch_id}, ${class_id}, ${title}, ${description}, ${due_date}, ${total_points})
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      due_date = EXCLUDED.due_date,
      total_points = EXCLUDED.total_points,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *, 0 AS submissions_count;
  `;
  return rowToAssignment(rows[0]);
}

function rowToSubmission(row: any): AssignmentSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName: row.student_name,
    batchId: row.batch_id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : new Date().toISOString(),
    content: row.content,
    status: row.status || 'Submitted',
    score: row.score !== null && row.score !== undefined ? Number(row.score) : undefined,
    feedback: row.feedback || undefined
  };
}

export async function getAssignmentSubmissionsDb(opts?: { assignmentId?: string; batchId?: string; studentId?: string }): Promise<AssignmentSubmission[]> {
  const sql = getDb();
  const assignmentId = opts?.assignmentId;
  const batchId = opts?.batchId;
  const studentId = opts?.studentId;

  let rows;
  if (assignmentId) {
    rows = await sql`SELECT * FROM assignment_submissions WHERE assignment_id = ${assignmentId} ORDER BY submitted_at DESC;`;
  } else if (studentId) {
    rows = await sql`SELECT * FROM assignment_submissions WHERE student_id = ${studentId} ORDER BY submitted_at DESC;`;
  } else if (batchId) {
    rows = await sql`SELECT * FROM assignment_submissions WHERE batch_id = ${batchId} ORDER BY submitted_at DESC;`;
  } else {
    rows = await sql`SELECT * FROM assignment_submissions ORDER BY submitted_at DESC;`;
  }
  return rows.map(rowToSubmission);
}

export async function createAssignmentSubmissionDb(data: Partial<AssignmentSubmission>): Promise<AssignmentSubmission> {
  const sql = getDb();
  const id = data.id || `sub-${Date.now()}`;
  const assignment_id = data.assignmentId!;
  const student_id = data.studentId!;
  const student_name = data.studentName || 'Student';
  const batch_id = data.batchId!;
  const content = data.content || '';
  const status = data.status || 'Submitted';

  const rows = await sql`
    INSERT INTO assignment_submissions (id, assignment_id, student_id, student_name, batch_id, content, status)
    VALUES (${id}, ${assignment_id}, ${student_id}, ${student_name}, ${batch_id}, ${content}, ${status})
    RETURNING *;
  `;
  return rowToSubmission(rows[0]);
}

export async function gradeAssignmentSubmissionDb(id: string, score: number, feedback?: string): Promise<AssignmentSubmission | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE assignment_submissions
    SET score = ${score}, feedback = ${feedback || null}, status = 'Graded', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToSubmission(rows[0]) : null;
}

// ============================================================================
// ATTENDANCE RECORDS (Neon PostgreSQL)
// ============================================================================

function rowToAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    batchId: row.batch_id,
    batchName: row.batch_name || '',
    classId: row.class_id,
    classTitle: row.class_title || '',
    joinTime: row.join_time || '',
    leaveTime: row.leave_time || undefined,
    durationMinutes: Number(row.duration_minutes ?? 0),
    status: row.status || 'Present',
    date: row.date || ''
  };
}

export async function getAttendanceRecordsDb(opts?: { batchId?: string; classId?: string; studentId?: string }): Promise<AttendanceRecord[]> {
  const sql = getDb();
  const { batchId, classId, studentId } = opts || {};
  let rows;
  if (classId) {
    rows = await sql`SELECT * FROM attendance_records WHERE class_id = ${classId} ORDER BY created_at DESC;`;
  } else if (batchId) {
    rows = await sql`SELECT * FROM attendance_records WHERE batch_id = ${batchId} ORDER BY created_at DESC;`;
  } else if (studentId) {
    rows = await sql`SELECT * FROM attendance_records WHERE student_id = ${studentId} ORDER BY created_at DESC;`;
  } else {
    rows = await sql`SELECT * FROM attendance_records ORDER BY created_at DESC;`;
  }
  return rows.map(rowToAttendance);
}

export async function logAttendanceJoinDb(data: {
  studentId: string;
  studentName: string;
  batchId: string;
  batchName?: string;
  classId: string;
  classTitle?: string;
  joinTime?: string;
  date?: string;
}): Promise<AttendanceRecord> {
  const sql = getDb();
  const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const joinTime = data.joinTime || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = data.date || new Date().toISOString().split("T")[0];

  const rows = await sql`
    INSERT INTO attendance_records (
      id, student_id, student_name, batch_id, batch_name, class_id, class_title, join_time, status, date
    ) VALUES (
      ${id}, ${data.studentId}, ${data.studentName}, ${data.batchId}, ${data.batchName || null},
      ${data.classId}, ${data.classTitle || null}, ${joinTime}, 'Present', ${date}
    )
    RETURNING *;
  `;
  return rowToAttendance(rows[0]);
}

export async function logAttendanceLeaveDb(classId: string, studentId: string, leaveTime?: string): Promise<AttendanceRecord | null> {
  const sql = getDb();
  const time = leaveTime || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const rows = await sql`
    UPDATE attendance_records
    SET leave_time = ${time}
    WHERE class_id = ${classId} AND student_id = ${studentId} AND leave_time IS NULL
    RETURNING *;
  `;
  return rows.length > 0 ? rowToAttendance(rows[0]) : null;
}

// ============================================================================
// ORDERS & CHECKOUT (Neon PostgreSQL)
// ============================================================================

export interface DbOrderRecord {
  id: string;
  studentId?: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  courseId?: string;
  courseName: string;
  batchId?: string;
  batchName?: string;
  coursePrice: number;
  discountAmount: number;
  discountCode?: string;
  expectedAmount: number;
  currency: string;
  orderStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToOrder(row: any): DbOrderRecord {
  return {
    id: row.id,
    studentId: row.student_id || undefined,
    studentName: row.student_name,
    studentPhone: row.student_phone,
    studentEmail: row.student_email,
    courseId: row.course_id || undefined,
    courseName: row.course_name,
    batchId: row.batch_id || undefined,
    batchName: row.batch_name || undefined,
    coursePrice: Number(row.course_price),
    discountAmount: Number(row.discount_amount || 0),
    discountCode: row.discount_code || undefined,
    expectedAmount: Number(row.expected_amount),
    currency: row.currency || 'INR',
    orderStatus: row.order_status || 'pending',
    razorpayOrderId: row.razorpay_order_id || undefined,
    razorpayPaymentId: row.razorpay_payment_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createOrderDb(data: Partial<DbOrderRecord>): Promise<DbOrderRecord> {
  const sql = getDb();
  const id = data.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const rows = await sql`
    INSERT INTO orders (
      id, student_id, student_name, student_phone, student_email,
      course_id, course_name, batch_id, batch_name, course_price,
      discount_amount, discount_code, expected_amount, currency,
      order_status, razorpay_order_id, razorpay_payment_id
    ) VALUES (
      ${id}, ${data.studentId || null}, ${data.studentName || ''}, ${data.studentPhone || ''}, ${data.studentEmail || ''},
      ${data.courseId || null}, ${data.courseName || ''}, ${data.batchId || null}, ${data.batchName || null},
      ${Number(data.coursePrice || 0)}, ${Number(data.discountAmount || 0)}, ${data.discountCode || null},
      ${Number(data.expectedAmount || 0)}, ${data.currency || 'INR'},
      ${data.orderStatus || 'pending'}, ${data.razorpayOrderId || null}, ${data.razorpayPaymentId || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      order_status = EXCLUDED.order_status,
      razorpay_order_id = COALESCE(EXCLUDED.razorpay_order_id, orders.razorpay_order_id),
      razorpay_payment_id = COALESCE(EXCLUDED.razorpay_payment_id, orders.razorpay_payment_id),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  return rowToOrder(rows[0]);
}

export async function getOrderByIdDb(id: string): Promise<DbOrderRecord | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1;`;
  return rows.length > 0 ? rowToOrder(rows[0]) : null;
}

export async function getOrderByRazorpayOrderIdDb(razorpayOrderId: string): Promise<DbOrderRecord | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM orders WHERE razorpay_order_id = ${razorpayOrderId} LIMIT 1;`;
  return rows.length > 0 ? rowToOrder(rows[0]) : null;
}

export async function updateOrderStatusDb(
  id: string,
  status: string,
  razorpayPaymentId?: string,
  razorpayOrderId?: string
): Promise<DbOrderRecord | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE orders
    SET order_status = ${status},
        razorpay_payment_id = COALESCE(${razorpayPaymentId || null}, razorpay_payment_id),
        razorpay_order_id = COALESCE(${razorpayOrderId || null}, razorpay_order_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rowToOrder(rows[0]) : null;
}

export async function getOrdersDb(): Promise<DbOrderRecord[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC;`;
  return rows.map(rowToOrder);
}

// ============================================================================
// PAYMENTS & AUDIT (Neon PostgreSQL)
// ============================================================================

export interface DbPaymentRecord {
  id: string;
  orderId?: string;
  paymentId: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  signature?: string;
  amount: number;
  currency: string;
  status: 'Paid' | 'Failed' | 'Refunded';
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  courseId?: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  admissionId?: string;
  method?: string;
  source?: string;
  rawPayload?: any;
  verifiedAt?: string;
  createdAt: string;
}

function rowToPayment(row: any): DbPaymentRecord {
  return {
    id: row.id,
    orderId: row.order_id || undefined,
    paymentId: row.payment_id,
    razorpayPaymentId: row.razorpay_payment_id || undefined,
    razorpayOrderId: row.razorpay_order_id || undefined,
    signature: row.signature || undefined,
    amount: Number(row.amount),
    currency: row.currency || 'INR',
    status: row.status || 'Paid',
    studentName: row.student_name || undefined,
    studentEmail: row.student_email || undefined,
    studentPhone: row.student_phone || undefined,
    courseId: row.course_id || undefined,
    courseName: row.course_name || undefined,
    batchId: row.batch_id || undefined,
    batchName: row.batch_name || undefined,
    admissionId: row.admission_id || undefined,
    method: row.method || undefined,
    source: row.source || 'razorpay_verify',
    rawPayload: row.raw_payload || undefined,
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function createPaymentDb(data: Partial<DbPaymentRecord>): Promise<DbPaymentRecord> {
  const sql = getDb();
  const id = data.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const paymentId = data.paymentId || data.razorpayPaymentId || `pay_manual_${Date.now()}`;
  const rawPayload = data.rawPayload ? JSON.stringify(data.rawPayload) : null;

  const rows = await sql`
    INSERT INTO payments (
      id, order_id, payment_id, razorpay_payment_id, razorpay_order_id,
      signature, amount, currency, status, student_name, student_email,
      student_phone, course_id, course_name, batch_id, batch_name,
      admission_id, method, source, raw_payload, verified_at
    ) VALUES (
      ${id}, ${data.orderId || null}, ${paymentId}, ${data.razorpayPaymentId || null},
      ${data.razorpayOrderId || null}, ${data.signature || null}, ${Number(data.amount || 0)},
      ${data.currency || 'INR'}, ${data.status || 'Paid'}, ${data.studentName || null},
      ${data.studentEmail || null}, ${data.studentPhone || null}, ${data.courseId || null},
      ${data.courseName || null}, ${data.batchId || null}, ${data.batchName || null},
      ${data.admissionId || null}, ${data.method || 'online'}, ${data.source || 'razorpay_verify'},
      ${rawPayload}::jsonb, ${data.verifiedAt ? new Date(data.verifiedAt).toISOString() : new Date().toISOString()}
    )
    ON CONFLICT (payment_id) DO UPDATE SET
      status = EXCLUDED.status,
      signature = COALESCE(EXCLUDED.signature, payments.signature),
      verified_at = COALESCE(EXCLUDED.verified_at, payments.verified_at)
    RETURNING *;
  `;
  return rowToPayment(rows[0]);
}

export async function getPaymentsDb(): Promise<DbPaymentRecord[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM payments ORDER BY created_at DESC;`;
  return rows.map(rowToPayment);
}

// ============================================================================
// NOTIFICATIONS, SUPPORT TICKETS & KNOWLEDGE BASE (Neon PostgreSQL)
// ============================================================================

function rowToNotification(row: any): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    batchId: row.batch_id || undefined,
    type: row.type || 'announcement',
    title: row.title,
    message: row.message,
    read: Boolean(row.read),
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function getNotificationsDb(userId?: string): Promise<NotificationItem[]> {
  const sql = getDb();
  let rows;
  if (userId) {
    rows = await sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} OR user_id IS NULL 
      ORDER BY created_at DESC LIMIT 50;
    `;
  } else {
    rows = await sql`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50;
    `;
  }
  return rows.map(rowToNotification);
}

export async function createNotificationDb(data: Partial<NotificationItem>): Promise<NotificationItem> {
  const sql = getDb();
  const id = data.id || `notif-${Date.now()}`;
  const rows = await sql`
    INSERT INTO notifications (id, user_id, batch_id, type, title, message, read)
    VALUES (${id}, ${data.userId || null}, ${data.batchId || null}, ${data.type || 'announcement'}, ${data.title || 'Notification'}, ${data.message || ''}, ${Boolean(data.read)})
    RETURNING *;
  `;
  return rowToNotification(rows[0]);
}

export async function markNotificationReadDb(id: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE notifications SET read = true WHERE id = ${id};`;
}

export async function getSupportTicketsDb(): Promise<any[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM support_tickets ORDER BY created_at DESC;`;
  return rows;
}

export async function createSupportTicketDb(data: any): Promise<any> {
  const sql = getDb();
  const id = data.id || `tkt-${Date.now()}`;
  const rows = await sql`
    INSERT INTO support_tickets (
      id, ticket_number, student_id, student_name, student_phone, order_id,
      category, priority, status, assigned_agent_id, assigned_agent_name,
      original_question, conversation_id, resolution_notes
    ) VALUES (
      ${id}, ${data.ticketNumber || id}, ${data.studentId || null}, ${data.studentName || null},
      ${data.studentPhone || ''}, ${data.orderId || null}, ${data.category || 'general_query'},
      ${data.priority || 'medium'}, ${data.status || 'Open'}, ${data.assignedAgentId || null},
      ${data.assignedAgentName || null}, ${data.originalQuestion || ''}, ${data.conversationId || null},
      ${data.resolutionNotes || null}
    )
    RETURNING *;
  `;
  return rows[0];
}

export async function updateSupportTicketDb(id: string, updates: any): Promise<any> {
  const sql = getDb();
  const rows = await sql`
    UPDATE support_tickets
    SET status = COALESCE(${updates.status || null}, status),
        assigned_agent_id = COALESCE(${updates.assignedAgentId || null}, assigned_agent_id),
        assigned_agent_name = COALESCE(${updates.assignedAgentName || null}, assigned_agent_name),
        resolution_notes = COALESCE(${updates.resolutionNotes || null}, resolution_notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length > 0 ? rows[0] : null;
}

export async function getKnowledgeBaseDb(): Promise<any[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM knowledge_base ORDER BY created_at ASC;`;
  return rows;
}

export async function createKnowledgeBaseDb(data: { category?: string; question: string; answer: string }): Promise<any> {
  const sql = getDb();
  const id = `kb-${Date.now()}`;
  const rows = await sql`
    INSERT INTO knowledge_base (id, category, question, answer)
    VALUES (${id}, ${data.category || 'General'}, ${data.question}, ${data.answer})
    RETURNING *;
  `;
  return rows[0];
}

export async function deleteKnowledgeBaseDb(id: string): Promise<any> {
  const sql = getDb();
  const rows = await sql`DELETE FROM knowledge_base WHERE id = ${id} RETURNING *;`;
  return rows.length > 0 ? rows[0] : null;
}
