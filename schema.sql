-- ============================================================================
-- WITS LINGO DATABASE SCHEMA (Neon Postgres)
-- Target: PostgreSQL 15 / 16 (Neon Serverless Postgres compatible)
--
-- Fresh Installation Policy:
-- 1. Clean DDL: All tables, relationships, constraints, indexes, and triggers.
-- 2. No demo records or AI-generated sample data imported.
-- 3. File storage: Backblaze B2 holds binary assets; PostgreSQL stores URLs & metadata.
-- 4. All foreign keys have explicit ON DELETE actions (CASCADE or SET NULL).
-- 5. Zero secret keys or passwords stored in plain text.
-- 6. Dynamic Counts: Batch enrolled count and assignment submissions count are
--    calculated dynamically from their respective child tables (student_registrations
--    and assignment_submissions) rather than stored as de-synced static counters.
-- 7. Atomic Counters: Resource download count is incremented atomically via
--    UPDATE study_materials SET download_count = download_count + 1 WHERE id = $1.
-- ============================================================================

-- 0. EXTENSIONS & UTILITY FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- Administrators, Teachers, and Enrolled Students
-- Note: password_hash stores standard one-way bcrypt hashes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    phone VARCHAR(50),
    batch_ids JSONB DEFAULT '[]'::jsonb,
    admission_id VARCHAR(100),
    avatar_url TEXT,
    registration_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_admission_id ON users(admission_id);

CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. COURSES CATALOG
-- Master course curriculum, deliverables, facilities, badges & fees
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level VARCHAR(100) NOT NULL,
    short_description TEXT,
    what_you_will_learn JSONB DEFAULT '[]'::jsonb,
    facilities JSONB DEFAULT '[]'::jsonb,
    duration VARCHAR(100),
    learning_format VARCHAR(150),
    fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    badge VARCHAR(50),
    image_url TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_order ON courses(display_order);

CREATE OR REPLACE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. BATCHES
-- Live & upcoming student cohorts, schedule timings, capacity & mentor.
-- Note: max_students represents the cohort capacity. Enrolled count is NOT
-- stored statically; it is calculated dynamically from student_registrations.
-- ============================================================================
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    course_id VARCHAR(100) REFERENCES courses(id) ON DELETE SET NULL,
    course_name VARCHAR(255),
    batch_code VARCHAR(100),
    start_date VARCHAR(50),
    end_date VARCHAR(50),
    teacher_name VARCHAR(255),
    schedule_time VARCHAR(100),
    class_time VARCHAR(100),
    schedule_info TEXT,
    max_students INTEGER DEFAULT 30,
    status VARCHAR(30) DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Upcoming', 'Completed', 'Archived')),
    recordings_expiry_date VARCHAR(50),
    description TEXT,
    is_visible_on_website BOOLEAN DEFAULT TRUE,
    google_meet_link TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_course_id ON batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_visible ON batches(is_visible_on_website);

CREATE OR REPLACE TRIGGER trg_batches_updated_at
BEFORE UPDATE ON batches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. STUDENT REGISTRATIONS & ADMISSIONS
-- Complete student academic profile, contact details, payment & WhatsApp status
-- ON DELETE: If a course or batch is deleted, references are SET NULL so student
-- admission records and receipts are NEVER accidentally destroyed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_registrations (
    id VARCHAR(100) PRIMARY KEY,
    admission_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255),
    dob VARCHAR(50),
    gender VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    phone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT,
    qualification VARCHAR(255),
    current_english_level VARCHAR(100),
    course_id VARCHAR(100) REFERENCES courses(id) ON DELETE SET NULL,
    course_name VARCHAR(255),
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    batch_name VARCHAR(255),
    fee_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_status VARCHAR(30) DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Pending')),
    payment_method VARCHAR(100),
    payment_currency VARCHAR(10) DEFAULT 'INR',
    payment_amount_formatted VARCHAR(50),
    payment_txn_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    google_meet_link TEXT,
    whatsapp_delivery_status VARCHAR(30) DEFAULT 'pending' CHECK (whatsapp_delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
    whatsapp_message_id VARCHAR(150),
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_error TEXT,
    facilities JSONB DEFAULT '[]'::jsonb,
    whatsapp_confirmation_message TEXT,
    whatsapp_student_url TEXT,
    whatsapp_admin_url TEXT,
    registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_registrations_admission_id ON student_registrations(admission_id);
CREATE INDEX IF NOT EXISTS idx_registrations_phone ON student_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON student_registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_batch_id ON student_registrations(batch_id);
CREATE INDEX IF NOT EXISTS idx_registrations_course_id ON student_registrations(course_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON student_registrations(payment_status);

CREATE OR REPLACE TRIGGER trg_student_registrations_updated_at
BEFORE UPDATE ON student_registrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. CLASSES (CLASS SESSIONS / TIMETABLE)
-- Scheduled live class sessions with topic, timings & Google Meet/Zoom links
-- ON DELETE: If a batch is deleted, all its class timetable slots CASCADE delete.
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(100) PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    batch_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    class_number INTEGER DEFAULT 1,
    date VARCHAR(50),
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    duration_minutes INTEGER DEFAULT 60,
    teacher_name VARCHAR(255),
    description TEXT,
    status VARCHAR(30) DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Live', 'Completed', 'Scheduled')),
    join_url TEXT,
    recording_id VARCHAR(100),
    has_study_material BOOLEAN DEFAULT FALSE,
    has_assignment BOOLEAN DEFAULT FALSE,
    video_key TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_batch_id ON classes(batch_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_date ON classes(date);

CREATE OR REPLACE TRIGGER trg_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. RECORDINGS (CLASS LECTURE ARCHIVE)
-- Lecture video recordings archive with Backblaze B2 video key & notes summary
-- ON DELETE: If a class timetable slot is deleted, class_id is SET NULL (preserving the video).
-- If the entire batch is deleted, recordings CASCADE delete.
-- ============================================================================
CREATE TABLE IF NOT EXISTS recordings (
    id VARCHAR(100) PRIMARY KEY,
    class_id VARCHAR(100) REFERENCES classes(id) ON DELETE SET NULL,
    batch_id VARCHAR(100) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    batch_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    class_number INTEGER DEFAULT 1,
    date VARCHAR(50),
    duration VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Available' CHECK (status IN ('Available', 'Processing', 'Archived')),
    video_key TEXT NOT NULL,
    notes_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_batch_id ON recordings(batch_id);
CREATE INDEX IF NOT EXISTS idx_recordings_class_id ON recordings(class_id);

CREATE OR REPLACE TRIGGER trg_recordings_updated_at
BEFORE UPDATE ON recordings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. STUDY MATERIALS & VIDEO LESSONS (CMS)
-- Stores BOTH PDF study materials AND curated YouTube video lessons.
-- Backblaze B2 stores binary PDFs & custom thumbnails; PostgreSQL stores URLs & metadata.
-- Counter Policy: download_count is incremented atomically:
--   UPDATE study_materials SET download_count = download_count + 1 WHERE id = $1
-- ============================================================================
CREATE TABLE IF NOT EXISTS study_materials (
    id VARCHAR(100) PRIMARY KEY,
    resource_type VARCHAR(20) DEFAULT 'pdf' CHECK (resource_type IN ('pdf', 'youtube')),
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    class_id VARCHAR(100) REFERENCES classes(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    level VARCHAR(100),
    file_type VARCHAR(50) DEFAULT 'pdf',
    file_size VARCHAR(50),
    download_url TEXT,
    pdf_url TEXT,
    b2_file_id VARCHAR(255),
    b2_file_name VARCHAR(255),
    mime_type VARCHAR(100),
    is_view_only BOOLEAN DEFAULT TRUE,
    allow_download BOOLEAN DEFAULT FALSE,
    is_visible_on_website BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    youtube_url TEXT,
    thumbnail_url TEXT,
    b2_thumbnail_id VARCHAR(255),
    b2_thumbnail_name VARCHAR(255),
    duration VARCHAR(50),
    views VARCHAR(50) DEFAULT '0',
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_materials_type ON study_materials(resource_type);
CREATE INDEX IF NOT EXISTS idx_materials_batch_id ON study_materials(batch_id);
CREATE INDEX IF NOT EXISTS idx_materials_published ON study_materials(is_published);
CREATE INDEX IF NOT EXISTS idx_materials_order ON study_materials(display_order);

CREATE OR REPLACE TRIGGER trg_study_materials_updated_at
BEFORE UPDATE ON study_materials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. REVIEWS & TESTIMONIALS
-- Student ratings, verified reviews & homepage testimonials
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(100) PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    course_batch VARCHAR(255),
    testimonial TEXT NOT NULL,
    avatar_url TEXT,
    city VARCHAR(100),
    date VARCHAR(50),
    verified BOOLEAN DEFAULT TRUE,
    rating NUMERIC(2, 1) DEFAULT 5.0,
    author_key VARCHAR(100),
    is_approved BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

CREATE OR REPLACE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. ANNOUNCEMENTS & NOTICES
-- Academy circulars, holiday alerts, and schedule changes with priority & pin
-- ON DELETE: If a batch is deleted, announcements default to SET NULL (global)
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(100) PRIMARY KEY,
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    batch_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    date VARCHAR(50),
    author VARCHAR(255) DEFAULT 'Administration',
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Urgent')),
    category VARCHAR(100),
    effective_date VARCHAR(50),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_batch_id ON announcements(batch_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

CREATE OR REPLACE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. GALLERY ITEMS
-- Campus moments, classroom activities & event photos (backed by B2 storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gallery_items (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255),
    caption TEXT,
    category VARCHAR(100) DEFAULT 'General',
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    b2_file_id VARCHAR(255),
    b2_file_name VARCHAR(255),
    file_size VARCHAR(50),
    uploaded_by VARCHAR(255),
    is_published BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gallery_published ON gallery_items(is_published);
CREATE INDEX IF NOT EXISTS idx_gallery_order ON gallery_items(display_order);

CREATE OR REPLACE TRIGGER trg_gallery_items_updated_at
BEFORE UPDATE ON gallery_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. ASSIGNMENTS (HOMEWORK & PRACTICE WORKSHEETS)
-- Homework tasks given to specific cohorts with due dates and max points.
-- Note: submissions_count is NOT stored statically; it is calculated
-- dynamically from assignment_submissions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(100) PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    class_id VARCHAR(100) REFERENCES classes(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date VARCHAR(50),
    total_points INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_batch_id ON assignments(batch_id);

CREATE OR REPLACE TRIGGER trg_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. ASSIGNMENT SUBMISSIONS
-- Student homework submissions, marks awarded, and mentor feedback
-- ON DELETE: If an assignment or batch is deleted, submissions CASCADE delete.
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id VARCHAR(100) PRIMARY KEY,
    assignment_id VARCHAR(100) NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    batch_id VARCHAR(100) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Graded')),
    score NUMERIC(5, 2),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_batch_id ON assignment_submissions(batch_id);

CREATE OR REPLACE TRIGGER trg_assignment_submissions_updated_at
BEFORE UPDATE ON assignment_submissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. ATTENDANCE RECORDS
-- Student attendance per live class session
-- ON DELETE: If a batch or class is deleted, attendance records CASCADE delete.
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(100) PRIMARY KEY,
    student_id VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    batch_id VARCHAR(100) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    batch_name VARCHAR(255),
    class_id VARCHAR(100) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    class_title VARCHAR(255),
    join_time VARCHAR(50),
    leave_time VARCHAR(50),
    duration_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Absent')),
    date VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_id ON attendance_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance_records(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

-- ============================================================================
-- 14. ORDERS & CHECKOUT SESSIONS
-- Student checkout sessions, payment intents, and coupon discounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    student_id VARCHAR(100),
    student_name VARCHAR(255) NOT NULL,
    student_phone VARCHAR(50) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    course_id VARCHAR(100) REFERENCES courses(id) ON DELETE SET NULL,
    course_name VARCHAR(255) NOT NULL,
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    batch_name VARCHAR(255),
    course_price NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    discount_code VARCHAR(50),
    expected_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    order_status VARCHAR(30) DEFAULT 'pending' CHECK (order_status IN ('pending', 'paid', 'failed', 'cancelled')),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_student_email ON orders(student_email);
CREATE INDEX IF NOT EXISTS idx_orders_student_phone ON orders(student_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);

CREATE OR REPLACE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 15. PAYMENTS & TRANSACTIONS AUDIT
-- Real payment receipts, Razorpay verification, and webhook audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE SET NULL,
    payment_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    signature VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(30) DEFAULT 'Paid' CHECK (status IN ('Paid', 'Failed', 'Refunded')),
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    student_phone VARCHAR(50),
    course_id VARCHAR(100) REFERENCES courses(id) ON DELETE SET NULL,
    course_name VARCHAR(255),
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    batch_name VARCHAR(255),
    admission_id VARCHAR(100),
    method VARCHAR(50),
    source VARCHAR(30) DEFAULT 'razorpay_verify',
    raw_payload JSONB,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_admission_id ON payments(admission_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_phone ON payments(student_phone);

-- ============================================================================
-- 16. NOTIFICATIONS (IN-APP & WHATSAPP DELIVERY)
-- Automated admission letters, reminders, and delivery receipts
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE SET NULL,
    student_id VARCHAR(100),
    batch_id VARCHAR(100) REFERENCES batches(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(50),
    channel VARCHAR(30) DEFAULT 'in_app' CHECK (channel IN ('whatsapp', 'in_app')),
    template_name VARCHAR(100),
    title VARCHAR(255),
    message_body TEXT NOT NULL,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    message_status VARCHAR(30) DEFAULT 'pending' CHECK (message_status IN ('pending', 'accepted', 'sent', 'delivered', 'read', 'failed')),
    provider VARCHAR(30) DEFAULT 'none',
    provider_message_id VARCHAR(150),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_batch_id ON notifications(batch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_phone ON notifications(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);

-- ============================================================================
-- 17. CONVERSATIONS (SUPPORT & WHATSAPP CHAT SESSIONS)
-- Chat threads for student inquiries and AI support interactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    student_id VARCHAR(100),
    student_name VARCHAR(255),
    whatsapp_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'resolved')),
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp ON conversations(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE OR REPLACE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 18. CHAT MESSAGES
-- Inbound & outbound messages exchanged in conversations
-- ON DELETE: If a conversation thread is deleted, all its messages CASCADE delete.
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(100) PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_text TEXT NOT NULL,
    provider VARCHAR(50) DEFAULT 'admin',
    provider_message_id VARCHAR(150),
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================================
-- 19. SUPPORT TICKETS
-- Escalations, student disputes, join link inquiries & human handover
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(100) PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    student_id VARCHAR(100),
    student_name VARCHAR(255),
    student_phone VARCHAR(50),
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE SET NULL,
    category VARCHAR(50) DEFAULT 'general_query',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'Open' CHECK (status IN ('Open', 'Assigned', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed')),
    assigned_agent_id VARCHAR(100),
    assigned_agent_name VARCHAR(255),
    original_question TEXT NOT NULL,
    conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_phone ON support_tickets(student_phone);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

CREATE OR REPLACE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 20. KNOWLEDGE BASE ARTICLES
-- Institutional FAQs, policies, syllabi used by AI support chatbot
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
    id VARCHAR(100) PRIMARY KEY,
    category VARCHAR(50) DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);

CREATE OR REPLACE TRIGGER trg_knowledge_base_updated_at
BEFORE UPDATE ON knowledge_base
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 21. SITE SETTINGS & INSTITUTIONAL CMS MASTER
-- Academy info, bank details, UPI, hero video, central logos & favicons.
-- No secret keys or passkeys are stored here.
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'primary',
    academy_name VARCHAR(255) DEFAULT 'WITS LINGO',
    tagline VARCHAR(255),
    phone1 VARCHAR(50),
    phone2 VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    whatsapp_channel_url TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    youtube_url TEXT,
    announcement_text TEXT,
    announcement_btn_text VARCHAR(100),
    show_announcement BOOLEAN DEFAULT FALSE,
    show_batches_section BOOLEAN DEFAULT TRUE,
    founder_name VARCHAR(255),
    founder_title VARCHAR(255),
    batches_completed_count VARCHAR(50),
    active_students_count VARCHAR(50),
    bank_name VARCHAR(255),
    bank_account_holder VARCHAR(255),
    bank_account_number VARCHAR(100),
    bank_ifsc_code VARCHAR(50),
    bank_branch VARCHAR(255),
    bank_account_type VARCHAR(50),
    bank_swift_bic VARCHAR(50),
    upi_id VARCHAR(100),
    upi_number VARCHAR(50),
    razorpay_payment_link TEXT,
    paypal_email_or_link TEXT,
    hero_video_url TEXT,
    hero_video_poster_url TEXT,
    logo_url TEXT,
    logo_version VARCHAR(50) DEFAULT '1',
    b2_logo_id VARCHAR(255),
    b2_logo_name VARCHAR(255),
    favicon_url TEXT,
    b2_favicon_id VARCHAR(255),
    b2_favicon_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_site_settings_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 22. WEBHOOK DEDUPLICATION LOG
-- Ensures WhatsApp and Razorpay webhooks are processed idempotently
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
    id VARCHAR(100) PRIMARY KEY,
    event_key VARCHAR(255) UNIQUE NOT NULL,
    scope VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_key ON webhook_events(event_key);
CREATE INDEX IF NOT EXISTS idx_webhook_expires ON webhook_events(expires_at);

-- ============================================================================
-- 23. MINIMAL INITIAL ROOT CONFIGURATION
-- Only provisions the singleton primary settings row (with no demo values).
-- All course, batch, material, and student records start 100% empty.
-- ============================================================================
INSERT INTO site_settings (id, academy_name)
VALUES ('primary', 'WITS LINGO')
ON CONFLICT (id) DO NOTHING;
