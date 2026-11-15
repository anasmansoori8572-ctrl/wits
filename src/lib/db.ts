import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

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
