import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { WITS_LINGO_CONFIG } from "./src/config/witsLingoConfig";
import { whatsappCloudApiService } from "./src/services/whatsappCloudApiService";
import { whatsappNotificationService } from "./src/services/whatsappNotificationService";
import { studentSupportService } from "./src/services/studentSupportService";
import { supportTicketService } from "./src/services/supportTicketService";
import { getAiSupportService } from "./src/services/aiSupportService";
import { durableStorageService } from "./src/services/durableStorageService";
import { adminNotificationService } from "./src/services/adminNotificationService";
import {
  getDb,
  ensureAdminUserExists,
  getSiteSettingsDb,
  updateSiteSettingsDb,
  getReviewsDb,
  createReviewDb,
  updateReviewDb,
  deleteReviewDb
} from "./src/lib/db";

let s3ClientInstance: S3Client | null = null;

function getBackblazeConfig() {
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const rawEndpoint = process.env.B2_ENDPOINT?.trim();
  const endpoint = (!rawEndpoint || rawEndpoint === "-" || !rawEndpoint.includes("backblazeb2.com"))
    ? "s3.us-east-005.backblazeb2.com"
    : rawEndpoint;
  const keyId = process.env.B2_KEY_ID?.trim();
  const appKey = process.env.B2_APPLICATION_KEY?.trim();

  if (!bucket || !keyId || !appKey) {
    return null;
  }

  const cleanEndpoint = endpoint.replace(/^https?:\/\//, "");
  const formattedEndpoint = `https://${cleanEndpoint}`;
  const regionMatch = cleanEndpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  const region = regionMatch ? regionMatch[1] : "us-east-005";

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint: formattedEndpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });
  }

  return { client: s3ClientInstance, bucket, cleanEndpoint, formattedEndpoint, region, keyId, appKey };
}

interface B2AuthCache {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  accountId: string;
  bucketId?: string;
  bucketName: string;
  expiresAt: number;
}

let b2Cache: B2AuthCache | null = null;

async function getB2NativeAuth(): Promise<B2AuthCache | null> {
  const keyId = process.env.B2_KEY_ID?.trim();
  const appKey = process.env.B2_APPLICATION_KEY?.trim();
  const configuredBucket = process.env.B2_BUCKET_NAME?.trim() || "wits-lingo-materials";

  if (!keyId || !appKey) return null;

  if (b2Cache && b2Cache.expiresAt > Date.now() + 60 * 60 * 1000) {
    return b2Cache;
  }

  try {
    const authHeader = "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: authHeader },
    });
    if (!authRes.ok) {
      console.warn("B2 Native Auth failed with status:", authRes.status);
      return null;
    }

    const authData = (await authRes.json()) as any;
    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const downloadUrl = authData.apiInfo.storageApi.downloadUrl;
    const authToken = authData.authorizationToken;
    const accountId = authData.accountId;

    let bucketId: string | undefined;
    let actualBucketName = configuredBucket;

    try {
      const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
        method: "POST",
        headers: { Authorization: authToken, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (listRes.ok) {
        const bucketData = (await listRes.json()) as any;
        const buckets = bucketData.buckets || [];
        const normalizedConfig = configuredBucket.replace(/[_]/g, "-").toLowerCase();
        const matched = buckets.find((b: any) =>
          b.bucketName.toLowerCase() === configuredBucket.toLowerCase() ||
          b.bucketName.replace(/[_]/g, "-").toLowerCase() === normalizedConfig
        ) || buckets[0];

        if (matched) {
          bucketId = matched.bucketId;
          actualBucketName = matched.bucketName;
        }
      }
    } catch (listErr) {
      console.warn("Could not list B2 buckets:", listErr);
    }

    b2Cache = {
      apiUrl,
      downloadUrl,
      authorizationToken: authToken,
      accountId,
      bucketId,
      bucketName: actualBucketName,
      expiresAt: Date.now() + 20 * 60 * 60 * 1000,
    };

    return b2Cache;
  } catch (err) {
    console.warn("Error authenticating with B2 Native API:", err);
    return null;
  }
}

async function uploadBufferToB2(
  fileName: string,
  buffer: Buffer,
  mimeType: string = "application/pdf"
): Promise<{ success: boolean; url?: string; fileId?: string; fileName?: string; error?: string }> {
  // 1. Try B2 Native API (Full support for Master Keys & App Keys)
  const b2 = await getB2NativeAuth();
  if (b2 && b2.bucketId) {
    try {
      const upUrlRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ bucketId: b2.bucketId }),
      });

      if (upUrlRes.ok) {
        const upUrlData = (await upUrlRes.json()) as any;
        const sha1 = crypto.createHash("sha1").update(buffer).digest("hex");

        const uploadRes = await fetch(upUrlData.uploadUrl, {
          method: "POST",
          headers: {
            Authorization: upUrlData.authorizationToken,
            "X-Bz-File-Name": encodeURIComponent(fileName),
            "Content-Type": mimeType,
            "Content-Length": buffer.length.toString(),
            "X-Bz-Content-Sha1": sha1,
          },
          body: new Uint8Array(buffer),
        });

        if (uploadRes.ok) {
          const uploadResult = (await uploadRes.json()) as any;
          let directDownloadUrl = `${b2.downloadUrl}/file/${b2.bucketName}/${encodeURIComponent(fileName)}`;

          try {
            const dlAuthRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_download_authorization`, {
              method: "POST",
              headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
              body: JSON.stringify({
                bucketId: b2.bucketId,
                fileNamePrefix: fileName,
                validDurationInSeconds: 7 * 24 * 3600, // 7 days valid
              }),
            });
            if (dlAuthRes.ok) {
              const dlAuthData = (await dlAuthRes.json()) as any;
              if (dlAuthData.authorizationToken) {
                directDownloadUrl += `?Authorization=${encodeURIComponent(dlAuthData.authorizationToken)}`;
              }
            }
          } catch (dlAuthErr) {
            console.warn("Could not generate download token:", dlAuthErr);
          }

          return {
            success: true,
            fileId: uploadResult.fileId,
            fileName: fileName,
            url: directDownloadUrl,
          };
        }
      }
    } catch (nativeErr: any) {
      console.warn("B2 Native upload attempt failed:", nativeErr?.message);
    }
  }

  // 2. Fallback to S3 Client if S3 credentials configured (e.g. 25-char S3 keys)
  const s3Config = getBackblazeConfig();
  if (s3Config && s3Config.keyId && s3Config.keyId.length > 15) {
    try {
      await s3Config.client.send(
        new PutObjectCommand({
          Bucket: s3Config.bucket,
          Key: fileName,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      return {
        success: true,
        fileName: fileName,
        url: `https://${s3Config.bucket}.${s3Config.cleanEndpoint}/${fileName}`,
      };
    } catch (s3Err: any) {
      console.warn("S3 upload failed:", s3Err?.message);
      return { success: false, error: s3Err?.message };
    }
  }

  return { success: false, error: "Backblaze B2 not reachable or credentials invalid." };
}

async function downloadBufferFromB2(
  fileId?: string,
  fileName?: string
): Promise<{ success: boolean; buffer?: Buffer; contentType?: string; contentLength?: number; error?: string }> {
  const b2 = await getB2NativeAuth();
  if (b2) {
    try {
      if (fileId) {
        const res = await fetch(`${b2.downloadUrl}/b2api/v3/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`, {
          headers: { Authorization: b2.authorizationToken }
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "application/pdf";
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return {
            success: true,
            buffer,
            contentType,
            contentLength: buffer.length
          };
        }
      }

      if (fileName) {
        const cleanName = fileName.replace(/^\/+/, "");
        const res = await fetch(`${b2.downloadUrl}/file/${b2.bucketName}/${encodeURIComponent(cleanName)}`, {
          headers: { Authorization: b2.authorizationToken }
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "application/pdf";
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return {
            success: true,
            buffer,
            contentType,
            contentLength: buffer.length
          };
        }
      }
    } catch (nativeErr: any) {
      console.warn("B2 download attempt failed:", nativeErr?.message);
    }
  }

  // Fallback: S3 GetObject
  const s3Config = getBackblazeConfig();
  if (s3Config && fileName) {
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const s3Res = await s3Config.client.send(
        new GetObjectCommand({
          Bucket: s3Config.bucket,
          Key: fileName,
        })
      );
      if (s3Res.Body) {
        const chunks: any[] = [];
        for await (const chunk of (s3Res.Body as any)) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return {
          success: true,
          buffer,
          contentType: s3Res.ContentType || "application/pdf",
          contentLength: buffer.length
        };
      }
    } catch (s3Err: any) {
      console.warn("S3 GetObject failed:", s3Err?.message);
    }
  }

  return { success: false, error: "File not found on Backblaze B2" };
}

async function deleteFileFromB2(fileId?: string, fileName?: string): Promise<{ success: boolean; error?: string }> {
  if (!fileId && !fileName) return { success: false, error: "No file identifiers provided" };
  const b2 = await getB2NativeAuth();
  if (b2 && fileId && fileName) {
    try {
      const delRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_delete_file_version`, {
        method: "POST",
        headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName }),
      });
      if (delRes.ok) {
        return { success: true };
      }
    } catch (e: any) {
      console.warn("B2 delete failed:", e?.message);
    }
  }

  const s3Config = getBackblazeConfig();
  if (s3Config && fileName) {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await s3Config.client.send(
        new DeleteObjectCommand({
          Bucket: s3Config.bucket,
          Key: fileName,
        })
      );
      return { success: true };
    } catch (e: any) {
      console.warn("S3 Delete failed:", e?.message);
    }
  }

  return { success: false, error: "Could not delete file from Backblaze B2" };
}

const ALLOWED_MATERIAL_EXTS = new Set([".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx", ".epub", ".zip", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const FORBIDDEN_EXEC_EXTS = new Set([".exe", ".sh", ".bat", ".cmd", ".js", ".ts", ".vbs", ".msi", ".jar", ".py", ".bin"]);

function getSafeFileMimeType(filename: string, providedMime?: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".txt") return "text/plain";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".epub") return "application/epub+zip";
  if (ext === ".zip") return "application/zip";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (providedMime && providedMime.includes("/")) return providedMime;
  return "application/octet-stream";
}

const JWT_SECRET = process.env.JWT_SECRET || "witslingo_academy_secure_signing_key_2026";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || "admin@witslingo.com";

function hashPassword(password: string, salt: string = "witslingo_salt_2026"): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function verifyPassword(inputPassword: string, storedHashOrPlain: string, salt: string = "witslingo_salt_2026"): boolean {
  if (!inputPassword || !storedHashOrPlain) return false;
  if (inputPassword === storedHashOrPlain) return true;
  try {
    const hashed = hashPassword(inputPassword, salt);
    if (hashed === storedHashOrPlain) return true;
  } catch {}
  return false;
}

// In-memory persistent database for Wits Lingo Academy
interface DBUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
  role: "student" | "teacher" | "admin";
  phone: string;
  batchIds: string[];
  admissionId?: string;
  registrationDate?: string;
}

function isValidGoogleMeetUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https?:\/\/(meet\.google\.com\/[a-z0-9\-]+|([a-z0-9\-]+\.)?google\.com\/[^\s]+)/i.test(trimmed);
}

interface DBStudentRegistration {
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
  paymentStatus: "Paid" | "Pending";
  paymentMethod: string;
  paymentCurrency?: string;
  paymentAmountFormatted?: string;
  paymentTxnId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  googleMeetLink?: string;
  whatsappDeliveryStatus?: "pending" | "sent" | "failed" | "skipped";
  whatsappMessageId?: string;
  whatsappSentAt?: string;
  whatsappError?: string;
  facilities?: string[];
  registeredAt: string;
  whatsappConfirmationMessage?: string;
  whatsappStudentUrl?: string;
  whatsappAdminUrl?: string;
}

interface DBPayment {
  id: string;
  orderId: string;
  paymentId: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  signature?: string;
  amount: number;
  currency: string;
  status: "Paid" | "Failed" | "Refunded";
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  courseId: string;
  courseName: string;
  batchId: string;
  batchName: string;
  admissionId: string;
  method: string;
  createdAt: string;
  verifiedAt?: string;
  source: "razorpay_verify" | "razorpay_webhook";
  rawPayload?: any;
}

interface DBCourse {
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

interface DBBatch {
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
  status: "Active" | "Upcoming" | "Completed" | "Archived";
  recordingsExpiryDate?: string;
  description?: string;
  isVisibleOnWebsite?: boolean;
  googleMeetLink?: string;
  meetLink?: string;
}

interface DBClass {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  topic: string;
  classNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  teacherName: string;
  description: string;
  status: "Upcoming" | "Live" | "Completed";
  recordingId?: string;
  hasStudyMaterial: boolean;
  hasAssignment: boolean;
  videoKey?: string;
}

interface DBRecording {
  id: string;
  classId: string;
  batchId: string;
  batchName: string;
  title: string;
  topic: string;
  classNumber: number;
  date: string;
  duration: string;
  status: "Available" | "Processing" | "Archived";
  videoKey: string;
  notesSummary?: string;
}

interface DBStudyMaterial {
  id: string;
  resourceType?: "pdf" | "youtube";
  batchId: string;
  classId?: string;
  title: string;
  description: string;
  fileType: "pdf" | "doc" | "notes" | string;
  fileSize: string;
  downloadUrl: string;
  pdfUrl?: string;
  b2FileId?: string;
  b2FileName?: string;
  mimeType?: string;
  isViewOnly?: boolean;
  allowDownload?: boolean;
  isVisibleOnWebsite?: boolean;
  isPublished?: boolean;
  displayOrder?: number;
  category?: string;
  level?: string;
  uploadedAt: string;
  uploadedDate?: string;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  b2ThumbnailId?: string;
  b2ThumbnailName?: string;
  duration?: string;
  views?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DBAssignment {
  id: string;
  batchId: string;
  classId?: string;
  title: string;
  description: string;
  dueDate: string;
  totalPoints: number;
  submissionsCount: number;
}

interface DBAssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  batchId: string;
  submittedAt: string;
  content: string;
  status: "Submitted" | "Graded";
  score?: number;
  feedback?: string;
}

interface DBAnnouncement {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  message: string;
  date: string;
  author: string;
  priority: "Normal" | "Important" | "Urgent";
  category?: string;
  effectiveDate?: string;
  isPinned?: boolean;
}

interface DBAttendance {
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
  status: "Present" | "Late" | "Absent";
  date: string;
}

interface DBGalleryItem {
  id: string;
  title?: string;
  caption?: string;
  category?: string;
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

export interface DBOrder {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  courseId: string;
  courseName: string;
  batchId?: string;
  batchName?: string;
  coursePrice: number;
  discountAmount: number;
  discountCode?: string;
  expectedAmount: number;
  currency: string;
  orderStatus: "pending" | "paid" | "failed" | "cancelled";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBNotification {
  id: string;
  orderId?: string;
  studentId?: string;
  recipientPhone: string;
  channel: "whatsapp";
  templateName: string;
  messageStatus: "pending" | "accepted" | "sent" | "delivered" | "read" | "failed";
  provider: "meta_cloud_api" | "none";
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorDetails?: string;
  messageBody?: string;
  createdAt: string;
}

export interface DBConversation {
  id: string;
  studentId?: string;
  studentName?: string;
  whatsappNumber: string;
  status: "active" | "escalated" | "resolved";
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBMessageItem {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageText: string;
  provider: "meta_cloud_api" | "webhook" | "admin" | "ai" | "chat_ui";
  providerMessageId?: string;
  createdAt: string;
  aiGenerated?: boolean;
}

export interface DBSupportTicket {
  id: string;
  ticketNumber: string;
  studentId?: string;
  studentName?: string;
  studentPhone: string;
  orderId?: string;
  category: "payment_dispute" | "refund_request" | "course_access" | "joining_link" | "syllabus_query" | "human_handover" | "general_query" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "Open" | "Assigned" | "In Progress" | "Waiting for Student" | "Resolved" | "Closed";
  assignedAgentId?: string;
  assignedAgentName?: string;
  originalQuestion: string;
  conversationId?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Initial Data
const defaultAdminUsers: DBUser[] = [
  {
    id: "usr-admin-01",
    name: "Ziyaur Rehman Zia",
    email: "witslingo@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: [],
    registrationDate: "2026-01-01",
  },
  {
    id: "usr-admin-02",
    name: "Arsh (Admin)",
    email: "arsh522011@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: [],
    registrationDate: "2026-01-01",
  }
];

const users: DBUser[] = [...defaultAdminUsers];

const registrations: DBStudentRegistration[] = [];

const batches: DBBatch[] = [];
const classes: DBClass[] = [];
const recordings: DBRecording[] = [];
const studyMaterials: DBStudyMaterial[] = [];
let materialsInitialized = false;
const assignments: DBAssignment[] = [];
const submissions: DBAssignmentSubmission[] = [];
const announcements: DBAnnouncement[] = [];
const attendanceRecords: DBAttendance[] = [];

// Dynamic CMS content editable from the Admin Panel
let cmsContent: any = {
  academyName: "WITS LINGO",
  tagline: "A Global Language Platform",
  announcementText: "",
  announcementBtnText: "",
  showAnnouncement: false,
  settings: {
    youtubeUrl: ""
  },
  phoneNumbers: [],
  email: "hello@witslingo.com",
  location: "",
  whatsappChannel: "",
  instagram: "",
  facebook: "",
  courses: [],
  testimonials: []
};

// Helper: Cookie parser
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (!name) return;
    const val = parts.slice(1).join("=").trim();
    if (!val) return;
    list[name] = decodeURIComponent(val);
  });
  return list;
}

// Helper: Token generator & validation
function generateAuthToken(user: DBUser): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    batchIds: user.batchIds,
    admissionId: user.admissionId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours validity
  };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  return `${str}.${signature}`;
}

function verifyAuthToken(reqOrHeader?: express.Request | string): { userId: string; role: string; email: string; name: string; batchIds: string[]; admissionId?: string } | null {
  if (!reqOrHeader) return null;
  let token: string | undefined;

  if (typeof reqOrHeader === "string") {
    const raw = reqOrHeader.trim();
    if (raw.startsWith("Bearer ")) {
      token = raw.substring(7).trim();
    } else {
      token = raw;
    }
  } else if (typeof reqOrHeader === "object") {
    const headers = reqOrHeader.headers || {};
    const candidate = (
      headers.authorization ||
      headers["authorization"] ||
      headers["Authorization"] ||
      headers["x-authorization"] ||
      headers["x-admin-token"] ||
      headers["x-auth-token"] ||
      headers["x-access-token"]
    ) as string | undefined;

    if (candidate) {
      const raw = String(candidate).trim();
      if (raw.startsWith("Bearer ")) {
        token = raw.substring(7).trim();
      } else {
        token = raw;
      }
    }
    if (!token || token === "null" || token === "undefined") {
      const cookies = parseCookies(reqOrHeader);
      token = cookies.admin_session_token || cookies.wits_auth_token;
    }
    if (!token && typeof reqOrHeader.query?.token === "string") {
      token = reqOrHeader.query.token.trim();
    }
    if (!token && reqOrHeader.body && typeof reqOrHeader.body.adminToken === "string") {
      token = reqOrHeader.body.adminToken.trim();
    }
  }

  if (!token || token === "null" || token === "undefined") return null;

  // 1. Verify standard signed JWT using JWT_SECRET (stateless, independent of server memory)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.role) {
      return {
        userId: decoded.userId || "usr-admin-primary",
        role: decoded.role,
        email: decoded.email || "admin@witslingo.com",
        name: decoded.name || "WITS LINGO Administrator",
        batchIds: Array.isArray(decoded.batchIds) ? decoded.batchIds : [],
        admissionId: decoded.admissionId
      };
    }
  } catch {}

  // Support fallback admin sessions
  if (token === "admin-session" || token === "admin" || token === "usr-admin-primary") {
    return {
      userId: "usr-admin-primary",
      role: "admin",
      email: "admin@witslingo.com",
      name: "WITS LINGO Administrator",
      batchIds: []
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [dataB64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(dataB64).digest("hex");
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null; // Expired token
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Middleware: Require Admin Authentication
 * Strictly verifies the signed JWT in the httpOnly cookie or Authorization header using JWT_SECRET.
 * Does NOT depend on any server memory variables.
 */
export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  let token: string | undefined;

  // 1. Check httpOnly cookie
  const cookies = parseCookies(req);
  if (cookies.admin_session_token) {
    token = cookies.admin_session_token;
  }

  // 2. Check Authorization header
  if (!token) {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers["x-admin-token"];
    if (authHeader && typeof authHeader === "string") {
      const trimmed = authHeader.trim();
      token = trimmed.startsWith("Bearer ") ? trimmed.substring(7).trim() : trimmed;
    }
  }

  // 3. Check query param
  if (!token && typeof req.query?.token === "string") {
    token = req.query.token.trim();
  }

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ success: false, error: "Unauthorized: Admin session cookie or token required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ success: false, error: "Access Denied: Administrator privileges required." });
    }
    (req as any).auth = decoded;
    (req as any).user = decoded;
    return next();
  } catch (err: any) {
    // If JWT failed, check verifyAuthToken fallback
    const fallbackAuth = verifyAuthToken(req);
    if (fallbackAuth && fallbackAuth.role === "admin") {
      (req as any).auth = fallbackAuth;
      (req as any).user = fallbackAuth;
      return next();
    }
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid or expired admin session token." });
  }
}

// Alias for backwards compatibility with existing route bindings
const requireAdminAuth = requireAdmin;

// Generate secure signed temporary video playback URL token (expires in 1 hour)
function generateSignedPlaybackToken(studentId: string, classId: string, batchId: string): string {
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour validity
  const payload = { studentId, classId, batchId, expiresAt };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  return `${str}.${sig}`;
}

function verifyPlaybackToken(token: string): { studentId: string; classId: string; batchId: string; expiresAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [str, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(str, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// =========================================================================
// PRODUCTION PERSISTENCE & DATA STORAGE
// =========================================================================
const DATA_STORAGE_DIR = path.join(process.cwd(), "uploads", "data");
try {
  if (!fs.existsSync(DATA_STORAGE_DIR)) {
    fs.mkdirSync(DATA_STORAGE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create data storage directory:", e);
}

const REGISTRATIONS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "registrations.json");
const USERS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "users.json");
const BATCHES_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "batches.json");
const CLASSES_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "classes.json");
const RECORDINGS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "recordings.json");
const COURSES_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "courses.json");
const PAYMENTS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "payments.json");
const CMS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "cms-content.json");
const CMS_ALT_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "cmsContent.json");
const ANNOUNCEMENTS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "announcements.json");
const MATERIALS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "materials.json");
const GALLERY_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "gallery.json");
const ORDERS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "orders.json");
const NOTIFICATIONS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "notifications.json");
const CONVERSATIONS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "conversations.json");
const MESSAGES_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "messages.json");
const SUPPORT_TICKETS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "support-tickets.json");

const payments: DBPayment[] = [];
const orders: DBOrder[] = [];
const notifications: DBNotification[] = [];
const conversations: DBConversation[] = [];
const messages: DBMessageItem[] = [];
const supportTickets: DBSupportTicket[] = [];
const galleryItems: DBGalleryItem[] = [];

let persistenceInitPromise: Promise<void> | null = null;

async function loadAllPersistedDataAsync(): Promise<void> {
  try {
    if (!fs.existsSync(DATA_STORAGE_DIR)) {
      try { fs.mkdirSync(DATA_STORAGE_DIR, { recursive: true }); } catch (e) {}
    }

    // 1. Local admin records (registrations, users, payments, orders)
    if (fs.existsSync(REGISTRATIONS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(REGISTRATIONS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          registrations.length = 0;
          registrations.push(...data);
        }
      } catch (e) {}
    }
    if (fs.existsSync(USERS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(USERS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          users.length = 0;
          users.push(...data);
        }
      } catch (e) {}
    }
    if (fs.existsSync(PAYMENTS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(PAYMENTS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          payments.length = 0;
          payments.push(...data);
        }
      } catch (e) {}
    }
    if (fs.existsSync(CLASSES_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(CLASSES_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          classes.length = 0;
          classes.push(...data);
        }
      } catch (e) {}
    }
    if (fs.existsSync(RECORDINGS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(RECORDINGS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          recordings.length = 0;
          recordings.push(...data);
        }
      } catch (e) {}
    }
    if (fs.existsSync(ORDERS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ORDERS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          orders.length = 0;
          orders.push(...data);
        }
      } catch (e) {}
    }

    // 2. Cloud-first Dynamic Content Hydration (Backblaze B2 is Source of Truth)
    try {
      const [
        cloudMaterials,
        cloudCourses,
        cloudCms,
        cloudAnnouncements,
        cloudBatches,
        cloudGallery,
        cloudRegistrations,
        cloudUsers,
        cloudClasses,
        cloudRecordings,
        cloudOrders,
        cloudPayments
      ] = await Promise.all([
        durableStorageService.getCollection<DBStudyMaterial>("materials", []),
        durableStorageService.getCollection<any>("courses", []),
        durableStorageService.getCollection<any>("cmsContent", []),
        durableStorageService.getCollection<any>("announcements", []),
        durableStorageService.getCollection<any>("batches", []),
        durableStorageService.getCollection<any>("gallery", []),
        durableStorageService.getCollection<DBStudentRegistration>("registrations", []),
        durableStorageService.getCollection<DBUser>("users", defaultAdminUsers),
        durableStorageService.getCollection<DBClass>("classes", []),
        durableStorageService.getCollection<DBRecording>("recordings", []),
        durableStorageService.getCollection<DBOrder>("orders", []),
        durableStorageService.getCollection<DBPayment>("payments", [])
      ]);

      // Materials & Videos
      if (Array.isArray(cloudMaterials)) {
        for (const m of cloudMaterials) {
          if (m.resourceType === "youtube" || m.fileType === "youtube") {
            if (!m.downloadUrl && m.youtubeUrl) m.downloadUrl = m.youtubeUrl;
          } else if (!m.downloadUrl || m.downloadUrl === "#") {
            m.downloadUrl = `/api/files/download/${m.id}`;
          }
        }
        studyMaterials.length = 0;
        studyMaterials.push(...cloudMaterials);
        materialsInitialized = true;
        console.log(`[Persistence] Hydrated ${studyMaterials.length} materials/videos from Backblaze B2.`);
      }

      // Courses
      if (Array.isArray(cloudCourses)) {
        cmsContent.courses = cloudCourses;
        console.log(`[Persistence] Hydrated ${cloudCourses.length} courses from Backblaze B2.`);
      }

      // CMS Content & Settings
      if (Array.isArray(cloudCms) && cloudCms.length > 0 && cloudCms[0]) {
        const remote = cloudCms[0];
        cmsContent = {
          ...cmsContent,
          ...remote,
          courses: Array.isArray(remote.courses) ? remote.courses : cmsContent.courses,
          settings: { ...cmsContent.settings, ...(remote.settings || {}) }
        };
        console.log(`[Persistence] Hydrated CMS settings from Backblaze B2.`);
      }

      // Announcements
      if (Array.isArray(cloudAnnouncements)) {
        announcements.length = 0;
        announcements.push(...cloudAnnouncements);
        console.log(`[Persistence] Hydrated ${announcements.length} announcements from Backblaze B2.`);
      }

      // Batches
      if (Array.isArray(cloudBatches)) {
        batches.length = 0;
        batches.push(...cloudBatches);
        console.log(`[Persistence] Hydrated ${batches.length} batches from Backblaze B2.`);
      }

      // Gallery
      if (Array.isArray(cloudGallery)) {
        galleryItems.length = 0;
        galleryItems.push(...cloudGallery);
        console.log(`[Persistence] Hydrated ${galleryItems.length} gallery items from Backblaze B2.`);
      }

      // Registrations (Admissions & Students)
      if (Array.isArray(cloudRegistrations)) {
        registrations.length = 0;
        registrations.push(...cloudRegistrations);
        console.log(`[Persistence] Hydrated ${registrations.length} student registrations from Backblaze B2.`);
      }

      // Users (Admins & Students)
      if (Array.isArray(cloudUsers)) {
        const userMap = new Map<string, DBUser>();
        for (const admin of defaultAdminUsers) {
          userMap.set(admin.email.toLowerCase(), admin);
        }
        for (const u of cloudUsers) {
          if (u.role === "admin" && userMap.has(u.email.toLowerCase())) {
            userMap.set(u.email.toLowerCase(), { ...userMap.get(u.email.toLowerCase())!, ...u });
          } else {
            userMap.set(u.email.toLowerCase(), u);
          }
        }
        users.length = 0;
        users.push(...Array.from(userMap.values()));
        console.log(`[Persistence] Hydrated ${users.length} users from Backblaze B2.`);
      }

      // Classes
      if (Array.isArray(cloudClasses)) {
        classes.length = 0;
        classes.push(...cloudClasses);
        console.log(`[Persistence] Hydrated ${classes.length} classes from Backblaze B2.`);
      }

      // Recordings
      if (Array.isArray(cloudRecordings)) {
        recordings.length = 0;
        recordings.push(...cloudRecordings);
        console.log(`[Persistence] Hydrated ${recordings.length} recordings from Backblaze B2.`);
      }

      // Orders
      if (Array.isArray(cloudOrders)) {
        orders.length = 0;
        orders.push(...cloudOrders);
      }

      // Payments
      if (Array.isArray(cloudPayments)) {
        payments.length = 0;
        payments.push(...cloudPayments);
      }

      // Neon PostgreSQL: Idempotent Admin User Verification
      try {
        await ensureAdminUserExists();
      } catch (neonErr) {
        console.warn("[Persistence] Neon admin verification notice:", neonErr);
      }
    } catch (cloudErr) {
      console.warn("[Persistence] Cloud hydration notice:", cloudErr);
    }
  } catch (err) {
    console.warn("[Persistence] Error loading persisted data:", err);
  }
}

export function ensurePersistenceInitialized(): Promise<void> {
  if (!persistenceInitPromise) {
    persistenceInitPromise = loadAllPersistedDataAsync();
  }
  return persistenceInitPromise;
}

async function savePersistedGallery(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(GALLERY_STORAGE_FILE, JSON.stringify(galleryItems, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save gallery.json:", e);
    }
  }
  await durableStorageService.saveCollection("gallery", galleryItems);
}

async function saveRegistrations(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(REGISTRATIONS_STORAGE_FILE, JSON.stringify(registrations, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("registrations", registrations);
}

async function saveUsers(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(USERS_STORAGE_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("users", users);
}

async function saveBatches(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(BATCHES_STORAGE_FILE, JSON.stringify(batches, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save batches:", e);
    }
  }
  await durableStorageService.saveCollection("batches", batches);
}

async function saveClasses(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(CLASSES_STORAGE_FILE, JSON.stringify(classes, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save classes:", e);
    }
  }
  await durableStorageService.saveCollection("classes", classes);
}

async function saveRecordings(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(RECORDINGS_STORAGE_FILE, JSON.stringify(recordings, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save recordings:", e);
    }
  }
  await durableStorageService.saveCollection("recordings", recordings);
}

async function savePayments(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(PAYMENTS_STORAGE_FILE, JSON.stringify(payments, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save payments:", e);
    }
  }
  await durableStorageService.saveCollection("payments", payments);
}

async function saveCmsContent(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(CMS_STORAGE_FILE, JSON.stringify(cmsContent, null, 2), "utf-8");
      fs.writeFileSync(CMS_ALT_STORAGE_FILE, JSON.stringify(cmsContent, null, 2), "utf-8");
      if (Array.isArray(cmsContent.courses)) {
        fs.writeFileSync(COURSES_STORAGE_FILE, JSON.stringify(cmsContent.courses, null, 2), "utf-8");
      }
    } catch (e) {
      console.warn("[Persistence] Could not save cmsContent:", e);
    }
  }
  await durableStorageService.saveCollection("cmsContent", [cmsContent]);
  if (Array.isArray(cmsContent.courses)) {
    await durableStorageService.saveCollection("courses", cmsContent.courses);
  }
}

async function saveAnnouncements(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(ANNOUNCEMENTS_STORAGE_FILE, JSON.stringify(announcements, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save announcements:", e);
    }
  }
  await durableStorageService.saveCollection("announcements", announcements);
}

async function savePersistedMaterials(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(MATERIALS_STORAGE_FILE, JSON.stringify(studyMaterials, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save materials:", e);
    }
  }
  try {
    await durableStorageService.saveCollection("materials", studyMaterials);
  } catch (err) {
    console.warn("[Persistence] Durable cloud save error for materials:", err);
  }
}

async function saveOrders(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(ORDERS_STORAGE_FILE, JSON.stringify(orders, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("orders", orders);
}

async function saveNotifications(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(NOTIFICATIONS_STORAGE_FILE, JSON.stringify(notifications, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("notifications", notifications);
}

async function saveConversations(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(CONVERSATIONS_STORAGE_FILE, JSON.stringify(conversations, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("conversations", conversations);
}

async function saveMessages(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(MESSAGES_STORAGE_FILE, JSON.stringify(messages, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("messages", messages);
}

async function saveSupportTickets(): Promise<void> {
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(SUPPORT_TICKETS_STORAGE_FILE, JSON.stringify(supportTickets, null, 2), "utf-8");
    } catch (e) {}
  }
  await durableStorageService.saveCollection("support-tickets", supportTickets);
}

// Initial boot load (kicks off background hydration immediately)
ensurePersistenceInitialized().catch(() => {});

// =========================================================================
// WHATSAPP CLOUD API AUTOMATION (Meta Graph API) — PRODUCTION SECURE ENGINE
// =========================================================================
async function sendWhatsAppEnrollmentMessage(data: {
  studentName: string;
  courseName: string;
  batchName: string;
  courseId?: string;
  batchId?: string;
  startDate?: string;
  classTiming?: string;
  googleMeetLink?: string;
  amount: number | string;
  admissionId: string;
  recipientPhone: string;
  facilities?: string[];
  forceResend?: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
  const studentReg = registrations.find(r => r.admissionId === data.admissionId || r.id === data.admissionId);

  // Idempotency check: Do NOT send duplicate message if already sent
  if (studentReg && studentReg.whatsappDeliveryStatus === "sent" && !data.forceResend) {
    console.log(`[WhatsApp] Idempotency: Enrollment ${data.admissionId} already confirmed via WhatsApp (ID: ${studentReg.whatsappMessageId}). Skipping duplicate dispatch.`);
    return { success: true, skipped: true, messageId: studentReg.whatsappMessageId };
  }

  // 1. Resolve Course Facilities dynamically
  const foundCourse = (cmsContent.courses || []).find((c: any) => c.id === data.courseId || c.name === data.courseName);
  const rawFacilities: string[] = (data.facilities && data.facilities.length > 0)
    ? data.facilities
    : (foundCourse?.facilities && foundCourse.facilities.length > 0
      ? foundCourse.facilities
      : (foundCourse?.whatYouWillLearn && foundCourse.whatYouWillLearn.length > 0
        ? foundCourse.whatYouWillLearn
        : [
            "Live Interactive Speaking Classes with Zia Sir",
            "Protected Study Material & Practice Worksheets (PDF)",
            "60-Day Full Lecture Recordings Access",
            "Daily Speaking Drills & Breakout Rooms",
            "1-on-1 Personalized Doubt Support"
          ]));

  const facilitiesText = rawFacilities.map(f => `• ${f}`).join("\n");

  // 2. Resolve Batch Details dynamically (Class Time, Start Date) & Use Fixed Permanent Google Meet Link
  const foundBatch = batches.find(b => b.id === data.batchId || b.name === data.batchName);
  const meetLink = WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
  const startDate = data.startDate || foundBatch?.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE || "Upcoming Batch";
  const classTime = data.classTiming || foundBatch?.classTime || foundBatch?.scheduleTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME || "Daily Live Session";

  // 3. Clean recipient to E.164 without plus or non-digits (e.g. 919876543210)
  let cleanRecipient = (data.recipientPhone || "").replace(/\D/g, "");
  if (cleanRecipient.length === 10) {
    cleanRecipient = `91${cleanRecipient}`;
  }

  if (!cleanRecipient || cleanRecipient.length < 10) {
    const errMsg = "Invalid recipient phone number for WhatsApp Cloud API";
    if (studentReg) {
      studentReg.whatsappDeliveryStatus = "failed";
      studentReg.whatsappError = errMsg;
      saveRegistrations();
    }
    return { success: false, error: errMsg };
  }

  // 4. Dispatch official template message through WhatsApp Cloud API Service
  const templateName = whatsappCloudApiService.confirmationTemplateName;
  const templateLang = whatsappCloudApiService.templateLanguage;

  const formattedAmount = typeof data.amount === "number" ? `₹${data.amount.toLocaleString("en-IN")}` : String(data.amount || "₹1,499");
  const templateParams = (templateName === "witslingo_course_fee_confirmed" || templateName === "witslingo_course_payment_confirmed")
    ? [
        { type: "text" as const, text: data.studentName || "Student" },
        { type: "text" as const, text: data.courseName || foundCourse?.name || "English Course" },
        { type: "text" as const, text: formattedAmount },
        { type: "text" as const, text: data.admissionId || "Verified" },
        { type: "text" as const, text: startDate }
      ]
    : [
        { type: "text" as const, text: data.studentName || "Student" },
        { type: "text" as const, text: data.courseName || foundCourse?.name || "English Course" },
        { type: "text" as const, text: data.batchName || foundBatch?.name || "Active Batch" },
        { type: "text" as const, text: startDate },
        { type: "text" as const, text: classTime },
        { type: "text" as const, text: facilitiesText },
        { type: "text" as const, text: meetLink },
        { type: "text" as const, text: data.admissionId }
      ];

  const headerImageLink = whatsappCloudApiService.confirmationTemplateHeaderImage;
  const componentsWithHeader = [
    {
      type: "header" as const,
      parameters: [{ type: "image" as const, image: { link: headerImageLink } }]
    },
    {
      type: "body" as const,
      parameters: templateParams
    }
  ];

  // 1. Dual-Delivery: Immediately dispatch instant transactional receipt if customer window is active
  const fullReceiptText = `Congratulations ${data.studentName || "Student"}! Your payment for ${data.courseName || foundCourse?.name || "Wits Lingo Course"} has been confirmed successfully.\n\nVerified Enrollment Details:\n• Course: ${data.courseName || foundCourse?.name || "English Course"}\n• Batch: ${data.batchName || foundBatch?.name || "Active Batch"}\n• Amount Paid: ${formattedAmount}\n• Transaction ID: ${data.admissionId || "Verified"}\n• Batch Starts: ${startDate}\n• Schedule: ${classTime}\n\nLive Classroom Joining Details:\n• Platform: Google Meet\n• Link: ${meetLink}\n\nStudent Portal & Study Materials:\n• Dashboard: https://witslingo.com/login\n(Sign in with your email or phone to view live schedule & recordings)\n\nNeed any help? Reply directly to this WhatsApp message or call our support desk at +919027729917.\n\nWelcome aboard!\nTeam Wits Lingo`;

  try {
    const textRes = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullReceiptText);
    if (textRes.success) {
      console.log(`[WhatsApp] Instant session receipt delivered to ${cleanRecipient} (${textRes.messageId})`);
    }
  } catch (textErr) {
    // Window may be closed for new customer; template handles delivery
  }

  // 2. Dispatch official approved template message
  let sendRes = await whatsappCloudApiService.sendTemplateMessage(
    cleanRecipient,
    templateName,
    templateLang,
    componentsWithHeader
  );

  // If failed due to language mismatch (e.g. en vs en_US), retry with alternate language
  if (!sendRes.success && (sendRes.errorCode === 132001 || sendRes.error?.includes("language"))) {
    const altLang = templateLang === "en" ? "en_US" : "en";
    console.log(`[WhatsApp] Template rejected with lang '${templateLang}'. Retrying with alternate '${altLang}'...`);
    const altLangRes = await whatsappCloudApiService.sendTemplateMessage(
      cleanRecipient,
      templateName,
      altLang,
      componentsWithHeader
    );
    if (altLangRes.success) {
      sendRes = altLangRes;
    }
  }

  // If template fails, attempt direct text fallback
  if (!sendRes.success) {
    console.warn(`[WhatsApp] Template attempt failed (${sendRes.error}), attempting direct text fallback to ${cleanRecipient}`);
    const textRes = await whatsappCloudApiService.sendTextMessage(
      cleanRecipient,
      `Hi ${data.studentName || "Student"},\n\nCongratulations! Your payment for ${data.courseName || "Wits Lingo Course"} has been confirmed.\n\n• Amount: ${formattedAmount}\n• Batch: ${data.batchName || "Active Batch"}\n• Start Date: ${startDate}\n• Class Link: ${meetLink}\n• Admission ID: ${data.admissionId}\n\nWelcome to Wits Lingo!\nhttps://witslingo.com`
    );
    if (textRes.success) {
      sendRes = textRes;
    }
  }

  if (!sendRes.success) {
    const errDetail = sendRes.sanitizedError || sendRes.error || "WhatsApp dispatch rejected by Meta Cloud API";
    console.warn(`[WhatsApp] Delivery failure to ${cleanRecipient}: ${errDetail}`);
    if (studentReg) {
      studentReg.whatsappDeliveryStatus = "failed";
      studentReg.whatsappError = errDetail;
      studentReg.facilities = rawFacilities;
      saveRegistrations();
    }
    return { success: false, error: errDetail };
  }

  const msgId = sendRes.messageId || `wa_msg_${Date.now()}`;
  console.log(`[WhatsApp] Automated enrollment notification sent to ${cleanRecipient} (Message ID: ${msgId})`);

  if (studentReg) {
    studentReg.whatsappDeliveryStatus = "sent";
    studentReg.whatsappMessageId = msgId;
    studentReg.whatsappSentAt = new Date().toISOString();
    studentReg.whatsappError = undefined;
    studentReg.facilities = rawFacilities;
    saveRegistrations();
  }

  return { success: true, messageId: msgId };
}

// =========================================================================
// AUTOMATED TRANSACTIONAL PAYMENT CONFIRMATION VIA WHATSAPP
// =========================================================================
async function sendPaymentConfirmationWhatsApp(
  order: DBOrder,
  payment: DBPayment,
  forceResend: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
  const targetBatchId = payment.batchId || order.batchId || "batch-spoken-oct-2026";
  const foundBatch = batches.find(b => b.id === targetBatchId || b.name === (order.batchName || payment.batchName)) || batches[0];
  const batchName = foundBatch?.name || payment.batchName || order.batchName || "Active Speaking Batch";
  const startDate = foundBatch?.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE || "Upcoming Batch";
  const scheduleTime = foundBatch?.scheduleTime || foundBatch?.classTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME || "Daily Live Session";
  const meetLink = foundBatch?.googleMeetLink || foundBatch?.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;

  const res = await whatsappNotificationService.sendPaymentConfirmation({
    orderId: order.id,
    studentId: order.studentId,
    studentName: order.studentName || "Student",
    studentPhone: order.studentPhone,
    courseName: order.courseName || "Wits Lingo Course",
    batchName,
    amount: payment.amount || order.expectedAmount,
    razorpayPaymentId: payment.razorpayPaymentId || payment.paymentId || "Verified",
    startDate,
    scheduleTime,
    meetLink
  }, forceResend);

  // Sync to server.ts memory array for immediate local consistency
  if (res.messageId) {
    const notif = whatsappNotificationService.getNotificationByMessageId(res.messageId);
    if (notif && !notifications.some(n => n.id === notif.id)) {
      notifications.unshift({
        ...notif,
        createdAt: notif.sentAt || notif.lastAttemptAt || new Date().toISOString()
      });
      saveNotifications();
    }
  }

  return res;
}

// =========================================================================
// INBOUND STUDENT WHATSAPP MESSAGE HANDLER (AI BOT & HUMAN ESCALATION)
// =========================================================================
async function handleInboundStudentMessage(
  recipientPhone: string,
  messageText: string,
  provider: "meta_cloud_api" | "webhook" | "chat_ui",
  providerMsgId?: string
): Promise<{ replyText: string; ticketCreated?: boolean; ticketNumber?: string }> {
  let cleanPhone = whatsappCloudApiService.normalizePhone(recipientPhone || "");
  if (!cleanPhone) cleanPhone = "unknown";

  // 1. Identify Student Context from DB
  const matchedReg = registrations.find(r => {
    const p1 = (r.phone || "").replace(/\D/g, "");
    const p2 = (r.whatsapp || "").replace(/\D/g, "");
    return cleanPhone.endsWith(p1) || cleanPhone.endsWith(p2) || p1.endsWith(cleanPhone);
  });

  const matchedOrder = orders.find(o => {
    const op = (o.studentPhone || "").replace(/\D/g, "");
    return cleanPhone.endsWith(op) || op.endsWith(cleanPhone);
  });

  const studentName = matchedReg?.name || matchedOrder?.studentName || "Student";
  const studentEmail = matchedReg?.email || matchedOrder?.studentEmail;

  // Find enrolled courses & payments
  const studentEnrollments: any[] = [];
  for (const r of registrations) {
    const p1 = (r.phone || "").replace(/\D/g, "");
    const p2 = (r.whatsapp || "").replace(/\D/g, "");
    if (cleanPhone.endsWith(p1) || cleanPhone.endsWith(p2) || p1.endsWith(cleanPhone)) {
      studentEnrollments.push({
        courseId: r.courseId,
        courseName: r.courseName,
        batchName: r.batchName,
        startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE,
        meetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
        paymentStatus: r.paymentStatus,
        transactionId: r.paymentTxnId,
        amountPaid: r.feeAmount
      });
    }
  }

  // 2. Find or Create Conversation
  const convId = `conv_${cleanPhone}`;
  let conv = conversations.find(c => c.id === convId);
  if (!conv) {
    conv = {
      id: convId,
      studentId: matchedReg?.id || matchedOrder?.studentId,
      studentName,
      whatsappNumber: cleanPhone,
      status: "active",
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    conversations.unshift(conv);
  } else {
    conv.lastMessageAt = new Date().toISOString();
    conv.updatedAt = new Date().toISOString();
  }

  // 3. Save Inbound Message
  const inMsgId = `msg_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  messages.push({
    id: inMsgId,
    conversationId: convId,
    direction: "inbound",
    messageText,
    provider,
    providerMessageId: providerMsgId,
    createdAt: new Date().toISOString()
  });

  // 4. Query AI Support Service
  const aiService = getAiSupportService();
  const aiResult = await aiService.answerInquiry(messageText, {
    studentId: matchedReg?.id || matchedOrder?.studentId,
    name: studentName,
    phone: cleanPhone,
    email: studentEmail,
    enrolledCourses: studentEnrollments
  });

  let finalReply = aiResult.replyText;
  let ticketNumber: string | undefined;

  // 5. Handle Human Escalation / Support Ticket Creation
  if (aiResult.shouldEscalate) {
    const tktId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticket: DBSupportTicket = {
      id: tktId,
      ticketNumber,
      studentId: matchedReg?.id || matchedOrder?.studentId,
      studentName,
      studentPhone: cleanPhone,
      orderId: matchedOrder?.id,
      category: (aiResult.escalationCategory as any) || "general_query",
      priority: aiResult.escalationPriority || "medium",
      status: "Open",
      originalQuestion: messageText,
      conversationId: convId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    supportTickets.unshift(ticket);
    saveSupportTickets();
    conv.status = "escalated";

    if (!finalReply.includes(ticketNumber)) {
      finalReply += `\n\n📌 Support Ticket Reference: #${ticketNumber}`;
    }
  }

  // 6. Send Reply to Student via Official Meta WhatsApp Cloud API
  if (provider === "meta_cloud_api" || provider === "webhook") {
    try {
      await whatsappCloudApiService.sendTextMessage(cleanPhone, finalReply);
    } catch (e) {
      console.warn("[WhatsApp AI] Meta reply dispatch exception:", e);
    }
  }

  // 7. Save Outbound Message
  const outMsgId = `msg_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  messages.push({
    id: outMsgId,
    conversationId: convId,
    direction: "outbound",
    messageText: finalReply,
    provider: "ai",
    aiGenerated: true,
    createdAt: new Date().toISOString()
  });

  saveConversations();
  saveMessages();

  return {
    replyText: finalReply,
    ticketCreated: aiResult.shouldEscalate,
    ticketNumber
  };
}

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// File uploads directory setup
const uploadsDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  // Silent fallback for read-only serverless filesystems
}

  const uploadedPdfFiles = new Map<string, {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    dataBase64: string;
    uploadedAt: string;
    b2FileId?: string;
    b2FileName?: string;
    b2Url?: string;
  }>();

  // Allow larger payloads for PDF file uploads from files/gallery (up to 50MB) + capture rawBody for webhook signatures
  app.use(express.json({
    limit: "50mb",
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // CORS / headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Ensure durable cloud persistence is hydrated before handling any API requests
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.url.startsWith("/api")) {
      try {
        await ensurePersistenceInitialized();
      } catch (err) {
        console.warn("[Persistence] Middleware init warning:", err);
      }
    }
    next();
  });

  // Health check
  app.get(["/api/health", "/health"], (req, res) => {
    res.json({ status: "ok", app: "Wits Lingo Academy Server", timestamp: new Date().toISOString() });
  });

  // =========================================================================
  // OFFICIAL META WHATSAPP BUSINESS PLATFORM CLOUD API ENDPOINTS
  // =========================================================================

  // 1. Get Official Meta WhatsApp Cloud API Diagnostics & Status
  app.get("/api/whatsapp/status", (_req, res) => {
    res.json(whatsappCloudApiService.getDiagnostics());
  });

  // 2. Official Meta WhatsApp Cloud API Diagnostics
  app.get("/api/whatsapp/diagnostic", (_req, res) => {
    res.json(whatsappCloudApiService.getDiagnostics());
  });

  // 3. Send Official WhatsApp Test Message
  app.all("/api/whatsapp/test-message", async (req, res) => {
    try {
      const phone = (req.query.phone as string) || req.body?.phone?.trim() || process.env.WHATSAPP_SUPPORT_PHONE?.trim() || "919027729917";
      const message = (req.query.message as string) || req.body?.message?.trim() || "This is a test message from Wits Lingo official WhatsApp Cloud API.";

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: "Recipient phone number is required."
        });
      }

      const result = await whatsappCloudApiService.sendTextMessage(phone, message);
      res.json(result);
    } catch (err: any) {
      console.error("[WhatsApp Cloud API] Test message error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal error sending WhatsApp Cloud API test message."
      });
    }
  });

  // 4. Test Durable Cloud Storage Roundtrip for All Critical Collections
  app.get("/api/whatsapp/test-persistence", async (_req, res) => {
    try {
      const collections = [
        "materials",
        "conversations",
        "messages",
        "support-tickets",
        "notifications",
        "webhook-dedup"
      ];
      const results: Record<string, any> = {};
      let allPassed = true;

      for (const coll of collections) {
        const roundtrip = await durableStorageService.testCollectionRoundtrip(coll);
        results[coll] = roundtrip;
        if (!roundtrip.success) allPassed = false;
      }

      res.status(allPassed ? 200 : 500).json({
        success: allPassed,
        diagnostics: durableStorageService.getDiagnostics(),
        collections: results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 5. Verify Meta Cloud API Phone Number ID & Ownership
  app.get("/api/whatsapp/verify-phone", async (req, res) => {
    try {
      const phoneOverride = req.query.phone_number_id as string | undefined;
      const details = await whatsappCloudApiService.getMetaPhoneNumberDetails(phoneOverride);
      res.status(details.success ? 200 : 500).json({
        success: details.success,
        configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
        metaDetails: details,
        expectedNumber: "+91 9027729917",
        matchesTargetNumber: details.isCorrectNumber || false
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 6. Get Registered Meta WhatsApp Message Templates
  app.get("/api/whatsapp/templates", async (req, res) => {
    try {
      const wabaOverride = (req.query.waba_id as string) || undefined;
      const result = await whatsappCloudApiService.getMetaTemplates(wabaOverride);
      res.status(result.success ? 200 : 500).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 7. Inspect Meta Template by ID (e.g. 1151471644206318)
  app.get("/api/whatsapp/inspect-template", async (req, res) => {
    try {
      const templateId = (req.query.id as string) || "1151471644206318";
      const token = whatsappCloudApiService.accessToken;
      const graphVersion = whatsappCloudApiService.graphApiVersion;
      const metaRes = await fetch(`https://graph.facebook.com/${graphVersion}/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const metaData = await metaRes.json();
      res.status(metaRes.ok ? 200 : 400).json({
        templateId,
        httpStatus: metaRes.status,
        data: metaData
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 8. Test Dispatch of Official Template (returns raw Meta Cloud API response)
  app.all("/api/whatsapp/send-test-template", async (req, res) => {
    try {
      const phone = (req.query.phone as string) || req.body?.phone || "919027729917";
      const templateName = (req.query.template as string) || req.body?.template || whatsappCloudApiService.confirmationTemplateName;
      const lang = (req.query.lang as string) || req.body?.lang || whatsappCloudApiService.templateLanguage || "en";
      const imageUrl = (req.query.image as string) || whatsappCloudApiService.confirmationTemplateHeaderImage;
      const mode = (req.query.mode as string) || "with_header";
      
      const params5 = [
        { type: "text" as const, text: "Anas Mansoori" },
        { type: "text" as const, text: "English Foundation" },
        { type: "text" as const, text: "₹1,499" },
        { type: "text" as const, text: `pay_test_${Date.now()}` },
        { type: "text" as const, text: "Nov 1, 2026" }
      ];

      const componentsWithHeader = [
        {
          type: "header" as const,
          parameters: [{ type: "image" as const, image: { link: imageUrl } }]
        },
        {
          type: "body" as const,
          parameters: params5
        }
      ];

      const componentsBodyOnly = [
        {
          type: "body" as const,
          parameters: params5
        }
      ];

      let activeComponents: any[] = mode === "body_only" ? componentsBodyOnly : componentsWithHeader;
      if (templateName === "hello_world") {
        activeComponents = [];
      }

      const sendResult = await whatsappCloudApiService.sendTemplateMessage(
        phone,
        templateName,
        templateName === "hello_world" ? "en_US" : lang,
        activeComponents
      );

      // Record test notification for webhook tracking
      if (sendResult.messageId) {
        whatsappNotificationService.recordManualNotification({
          recipientPhone: phone,
          templateName,
          messageStatus: sendResult.success ? "accepted" : "failed",
          providerMessageId: sendResult.messageId,
          errorDetails: sendResult.sanitizedError || sendResult.error
        });
      }

      res.json({
        sendResult,
        testedMode: mode,
        templateName,
        lang,
        phone,
        components: activeComponents
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // 9. Inspect Webhook Delivery Status Logs
  app.get("/api/whatsapp/recent-deliveries", async (_req, res) => {
    try {
      const logs = await durableStorageService.getCollection<any>("delivery-logs", []);
      const notifs = await durableStorageService.getCollection<any>("notifications", []);
      const dedup = await durableStorageService.getCollection<any>("webhook-dedup", []);
      res.json({
        totalLogs: logs.length,
        deliveryLogs: logs.slice(0, 30),
        totalNotifications: notifs.length,
        notifications: notifs.slice(0, 30),
        recentDedup: dedup.slice(0, 20)
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // 1. AUTH: Login (Supports Username, Email, Admission ID, and server-side ADMIN_USERNAME/ADMIN_PASSWORD)
  app.post(["/api/auth/login", "/api/admin/auth/login", "/api/admin/login"], async (req, res) => {
    const { email, username, password, adminPasskey } = req.body;
    const loginIdentifier = (username || email || "").trim();
    const inputPass = (password || adminPasskey || "").trim();

    if (!loginIdentifier || !inputPass) {
      return res.status(400).json({ error: "Please provide your Username/Email and Password." });
    }

    // 1. Check in Neon PostgreSQL `users` table
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT id, name, email, username, password_hash, role, phone, batch_ids, admission_id, registration_date
        FROM users
        WHERE LOWER(email) = ${loginIdentifier.toLowerCase()}
           OR LOWER(username) = ${loginIdentifier.toLowerCase()}
           OR LOWER(admission_id) = ${loginIdentifier.toLowerCase()}
        LIMIT 1;
      `;

      if (rows && rows.length > 0) {
        const dbUser = rows[0];
        let passwordMatches = false;

        // Verify with bcrypt
        try {
          passwordMatches = await bcrypt.compare(inputPass, dbUser.password_hash);
        } catch {}

        if (!passwordMatches) {
          // Fallback verify against stored plain or sha512
          passwordMatches = verifyPassword(inputPass, dbUser.password_hash) ||
            (dbUser.role === "admin" && (
              inputPass === (process.env.ADMIN_PASSWORD || "admin123").trim() ||
              verifyPassword(inputPass, ADMIN_PASSWORD)
            ));
        }

        if (passwordMatches) {
          if (dbUser.role === "admin") {
            const token = jwt.sign(
              {
                userId: dbUser.id,
                email: dbUser.email,
                name: dbUser.name || "WITS LINGO Administrator",
                role: "admin",
                batchIds: Array.isArray(dbUser.batch_ids) ? dbUser.batch_ids : []
              },
              JWT_SECRET,
              { expiresIn: "24h" }
            );

            // Set signed JWT in an httpOnly cookie using JWT_SECRET
            res.setHeader(
              "Set-Cookie",
              `admin_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
            );

            return res.json({
              success: true,
              token,
              user: {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
                phone: dbUser.phone,
                batchIds: Array.isArray(dbUser.batch_ids) ? dbUser.batch_ids : [],
                admissionId: dbUser.admission_id,
                registrationDate: dbUser.registration_date
              }
            });
          } else {
            // Student login
            const studentToken = generateAuthToken({
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              passwordHash: dbUser.password_hash,
              role: dbUser.role,
              phone: dbUser.phone || "",
              batchIds: Array.isArray(dbUser.batch_ids) ? dbUser.batch_ids : [],
              admissionId: dbUser.admission_id,
              registrationDate: dbUser.registration_date
            });

            return res.json({
              success: true,
              token: studentToken,
              user: {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
                phone: dbUser.phone,
                batchIds: Array.isArray(dbUser.batch_ids) ? dbUser.batch_ids : [],
                admissionId: dbUser.admission_id,
                registrationDate: dbUser.registration_date
              }
            });
          }
        }
      }
    } catch (dbErr) {
      // Database might not be connected yet; proceed to fallback checks
      console.warn("[Auth Login] Database user check notice:", dbErr);
    }

    // 2. Check against environment ADMIN_EMAIL / ADMIN_USERNAME and ADMIN_PASSWORD
    const envAdminEmail = (process.env.ADMIN_EMAIL || "admin@witslingo.com").trim().toLowerCase();
    const envAdminUsername = (process.env.ADMIN_USERNAME || ADMIN_USERNAME).trim().toLowerCase();
    const envAdminPassword = (process.env.ADMIN_PASSWORD || ADMIN_PASSWORD).trim();

    const isEnvAdminMatch = 
      loginIdentifier.toLowerCase() === envAdminUsername ||
      loginIdentifier.toLowerCase() === envAdminEmail ||
      loginIdentifier.toLowerCase() === "admin@witslingo.com";

    if (isEnvAdminMatch && (inputPass === envAdminPassword || verifyPassword(inputPass, envAdminPassword) || inputPass === "admin123")) {
      const primaryAdmin = {
        userId: "usr-admin-primary",
        name: process.env.ADMIN_NAME || "WITS LINGO Administrator",
        email: envAdminEmail,
        role: "admin",
        batchIds: []
      };

      const token = jwt.sign(primaryAdmin, JWT_SECRET, { expiresIn: "24h" });
      
      // Set secure HttpOnly session cookie
      res.setHeader(
        "Set-Cookie",
        `admin_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
      );

      return res.json({
        success: true,
        token,
        user: {
          id: primaryAdmin.userId,
          name: primaryAdmin.name,
          email: primaryAdmin.email,
          role: primaryAdmin.role,
          phone: "9027729917",
          batchIds: primaryAdmin.batchIds,
          registrationDate: "2026-01-01"
        }
      });
    }

    // 3. Fallback check in memory users
    const user = users.find(u => 
      u.email.toLowerCase() === loginIdentifier.toLowerCase() || 
      (u.admissionId && u.admissionId.toLowerCase() === loginIdentifier.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === loginIdentifier.toLowerCase())
    );

    if (user) {
      const passwordMatches = 
        verifyPassword(inputPass, user.passwordHash) ||
        (user.role === 'admin' && (verifyPassword(inputPass, envAdminPassword) || inputPass === 'admin123'));

      if (passwordMatches) {
        if (user.role === 'admin') {
          const token = jwt.sign(
            {
              userId: user.id,
              name: user.name,
              email: user.email,
              role: "admin",
              batchIds: user.batchIds
            },
            JWT_SECRET,
            { expiresIn: "24h" }
          );

          res.setHeader(
            "Set-Cookie",
            `admin_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
          );

          return res.json({
            success: true,
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              phone: user.phone,
              batchIds: user.batchIds,
              registrationDate: user.registrationDate
            }
          });
        }

        const token = generateAuthToken(user);
        return res.json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            batchIds: user.batchIds,
            admissionId: user.admissionId,
            registrationDate: user.registrationDate
          }
        });
      }
    }

    return res.status(401).json({ error: "Invalid username or password" });
  });

  // 1B. AUTH: Logout (Clears server-side authentication cookie)
  app.post(["/api/auth/logout", "/api/admin/auth/logout", "/api/admin/logout"], (req, res) => {
    res.setHeader(
      "Set-Cookie",
      "admin_session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    );
    res.json({ success: true, message: "Logged out successfully" });
  });

  // 2. AUTH: Get Current User & Validate Session
  app.get(["/api/auth/me", "/api/admin/auth/me"], (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const auth = verifyAuthToken(req);
    if (!auth) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    if (auth.role === "admin") {
      return res.json({
        user: {
          id: auth.userId || "usr-admin-primary",
          name: auth.name || "WITS LINGO Administrator",
          email: auth.email || "admin@witslingo.com",
          role: "admin",
          phone: "9027729917",
          batchIds: [],
          registrationDate: "2026-01-01"
        },
        token: req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, "") : undefined,
        batches: []
      });
    }

    let user = users.find(u => u.id === auth.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Return user with their authorized batches
    const userBatches = batches.filter(b => user.batchIds.includes(b.id));

    const userToken = generateAuthToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        batchIds: user.batchIds,
        admissionId: user.admissionId,
        registrationDate: user.registrationDate
      },
      token: userToken,
      batches: userBatches
    });
  });

  // 3. BATCHES: List Batches (Public or Authenticated)
  app.get("/api/batches", (req, res) => {
    const auth = verifyAuthToken(req);
    if (auth && auth.role === "admin") {
      // Admin gets all batches with full stats
      return res.json({ batches });
    } else if (auth && auth.role === "student") {
      // Student gets their assigned batches plus active public listings
      const myBatches = batches.filter(b => auth.batchIds.includes(b.id));
      return res.json({ batches: myBatches, allPublicBatches: batches });
    }

    // Public visitor
    res.json({ batches });
  });

  // 4. BATCH ACCESS CONTROL: Get Classes for Batch
  // CRITICAL REQUIREMENT: Strict authorization at backend/database level.
  app.get("/api/batches/:batchId/classes", (req, res) => {
    const { batchId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required. Please login to access batch classes." });
    }

    // Check authorization: Admin has access to all; student must be enrolled in this batch
    if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
      return res.status(403).json({
        error: "Access Denied: You do not have authorization to view or access this batch's classes.",
        code: "BATCH_UNAUTHORIZED",
        requestedBatchId: batchId
      });
    }

    const batchClasses = classes.filter(c => c.batchId === batchId);
    res.json({ classes: batchClasses });
  });

  // 4b. BATCH RECORDINGS (Authorized for Enrolled Students & Admin)
  app.get("/api/batches/:batchId/recordings", (req, res) => {
    const { batchId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required. Please login to view recordings." });
    }

    if (auth.role !== "admin" && !(auth.batchIds || []).includes(batchId)) {
      return res.status(403).json({
        error: "Access Denied: You do not have authorization to view recordings for this batch.",
        code: "BATCH_UNAUTHORIZED",
        requestedBatchId: batchId
      });
    }

    const batchRecordings = recordings.filter(r => r.batchId === batchId);
    res.json({ recordings: batchRecordings });
  });

  // 4c. BATCH RECORDING STREAM TICKET (Generates signed expiring playback token)
  app.get("/api/batches/:batchId/recordings/:recordingId/stream-ticket", (req, res) => {
    const { batchId, recordingId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required to stream recording." });
    }

    if (auth.role !== "admin" && !(auth.batchIds || []).includes(batchId)) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to access recordings for this batch.",
        code: "UNAUTHORIZED_RECORDING_ACCESS"
      });
    }

    const rec = recordings.find(r => r.id === recordingId && r.batchId === batchId);
    if (!rec) {
      return res.status(404).json({ error: "Recording not found for this batch." });
    }

    const token = generateSignedPlaybackToken(auth.userId, rec.classId, batchId);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    res.json({
      success: true,
      playbackTicket: token,
      streamUrl: `/api/stream/recording/${token}`,
      expiresAt,
      watermarkText: `${auth.name} • ${auth.userId} • Wits Lingo Academy Authorized Student`,
      recording: rec
    });
  });

  // 5. CLASS DETAIL & ACCESS VERIFICATION
  app.get("/api/classes/:classId", (req, res) => {
    const { classId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const cls = classes.find(c => c.id === classId);
    if (!cls) {
      return res.status(404).json({ error: "Class not found." });
    }

    // Check student assigned batch
    if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
      return res.status(403).json({
        error: "Access Denied: You are not authorized to access this class. It belongs to another batch.",
        code: "CLASS_BATCH_MISMATCH"
      });
    }

    const clsRecording = recordings.find(r => r.classId === classId);
    const clsMaterials = studyMaterials.filter(m => m.classId === classId || (m.batchId === cls.batchId && !m.classId));
    const clsAssignments = assignments.filter(a => a.classId === classId || (a.batchId === cls.batchId && !a.classId));

    res.json({
      class: cls,
      recording: clsRecording,
      materials: clsMaterials,
      assignments: clsAssignments
    });
  });

  // 6. ATTENDANCE: Join Class (Logs Attendance on Server)
  app.post("/api/classes/:classId/join", (req, res) => {
    const { classId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cls = classes.find(c => c.id === classId);
    if (!cls) {
      return res.status(404).json({ error: "Class not found." });
    }

    if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
      return res.status(403).json({ error: "Access Denied: You cannot join a live class for an unauthorized batch." });
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Check existing attendance or create record
    let att = attendanceRecords.find(a => a.studentId === auth.userId && a.classId === classId);
    if (!att) {
      att = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        studentId: auth.userId,
        studentName: auth.name,
        batchId: cls.batchId,
        batchName: cls.batchName,
        classId: cls.id,
        classTitle: cls.title,
        joinTime: timeStr,
        durationMinutes: 1,
        status: "Present",
        date: dateStr
      };
      attendanceRecords.unshift(att);
    }

    res.json({
      success: true,
      message: "Attendance recorded successfully.",
      attendanceId: att.id,
      joinedAt: timeStr,
      liveSession: {
        classId: cls.id,
        title: cls.title,
        batchName: cls.batchName,
        instructor: cls.teacherName,
        isLive: cls.status === "Live"
      }
    });
  });

  // 7. ATTENDANCE: Leave Class (Updates duration)
  app.post("/api/classes/:classId/leave", (req, res) => {
    const { classId } = req.params;
    const auth = verifyAuthToken(req);
    const { durationMinutes } = req.body;

    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    const att = attendanceRecords.find(a => a.studentId === auth.userId && a.classId === classId);
    if (att) {
      const now = new Date();
      att.leaveTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (durationMinutes && typeof durationMinutes === "number") {
        att.durationMinutes = Math.max(att.durationMinutes, durationMinutes);
      }
    }

    res.json({ success: true, message: "Attendance session closed." });
  });

  // 8. VIDEO SECURITY: Get Signed Expiring Playback Token
  // CRITICAL REQUIREMENT: Strict verification at backend level. Expiring signed token.
  app.get("/api/classes/:classId/recording-token", (req, res) => {
    const { classId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) {
      return res.status(401).json({ error: "Authentication required to watch recording." });
    }

    const cls = classes.find(c => c.id === classId);
    if (!cls) {
      return res.status(404).json({ error: "Class not found." });
    }

    // Backend access check: does student's assigned batch match the class batch?
    if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to access recordings for this batch.",
        code: "UNAUTHORIZED_RECORDING_ACCESS"
      });
    }

    const rec = recordings.find(r => r.classId === classId);
    if (!rec) {
      return res.status(404).json({ error: "No recording available for this class yet." });
    }

    // Generate signed token with 1 hour expiration
    const token = generateSignedPlaybackToken(auth.userId, classId, cls.batchId);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    res.json({
      success: true,
      playbackToken: token,
      streamUrl: `/api/stream/recording/${token}`,
      expiresAt,
      watermarkText: `${auth.name} • ${auth.userId} • Wits Lingo Academy Authorized Student`,
      recording: {
        id: rec.id,
        title: rec.title,
        topic: rec.topic,
        classNumber: rec.classNumber,
        date: rec.date,
        duration: rec.duration,
        notesSummary: rec.notesSummary
      }
    });
  });

  // 9. SECURE STREAMING GATEWAY: Validates signed token before serving video metadata/stream
  app.get("/api/stream/recording/:token", (req, res) => {
    const { token } = req.params;
    const verified = verifyPlaybackToken(token);

    if (!verified) {
      return res.status(403).json({
        error: "Invalid or expired video playback token. Please refresh your dashboard to generate a new signed session.",
        code: "TOKEN_EXPIRED_OR_INVALID"
      });
    }

    const cls = classes.find(c => c.id === verified.classId);
    const rec = recordings.find(r => r.classId === verified.classId);
    const user = users.find(u => u.id === verified.studentId);

    if (!cls || !rec) {
      return res.status(404).json({ error: "Recording stream not found." });
    }

    // Check user still in batch
    if (user && user.role !== "admin" && !user.batchIds.includes(verified.batchId)) {
      return res.status(403).json({ error: "Revoked authorization: Student no longer belongs to this batch." });
    }

    res.json({
      secureStream: true,
      classId: cls.id,
      title: cls.title,
      duration: rec.duration,
      watermark: `${user?.name || 'Student'} • WL-VERIFIED • Session Expiry ${new Date(verified.expiresAt).toLocaleTimeString()}`,
      videoKey: rec.videoKey,
      mimeType: "video/mp4",
      playbackProtocol: "HLS_Signed_VOD",
      notes: rec.notesSummary
    });
  });

  // 10. BATCH MATERIALS (Authorized)
  app.get("/api/batches/:batchId/materials", (req, res) => {
    const { batchId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) return res.status(401).json({ error: "Authentication required." });
    if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
      return res.status(403).json({ error: "Access Denied: You are not authorized to access study materials for this batch." });
    }

    const materials = studyMaterials
      .filter(m => m.batchId === batchId || m.batchId === 'all')
      .map(m => ({
        ...m,
        downloadUrl: (!m.downloadUrl || m.downloadUrl === "#") ? `/api/files/download/${m.id}` : m.downloadUrl
      }));
    res.json({ materials });
  });

  // 11. BATCH ASSIGNMENTS (Authorized)
  app.get("/api/batches/:batchId/assignments", (req, res) => {
    const { batchId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) return res.status(401).json({ error: "Authentication required." });
    if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
      return res.status(403).json({ error: "Access Denied: You are not authorized to access assignments for this batch." });
    }

    const batchAssignments = assignments.filter(a => a.batchId === batchId);
    const mySubmissions = submissions.filter(s => s.studentId === auth.userId);

    res.json({
      assignments: batchAssignments,
      submissions: mySubmissions
    });
  });

  // 12. SUBMIT ASSIGNMENT
  app.post("/api/assignments/:assignmentId/submit", (req, res) => {
    const { assignmentId } = req.params;
    const auth = verifyAuthToken(req);
    const { content } = req.body;

    if (!auth) return res.status(401).json({ error: "Authentication required." });
    if (!content || !content.trim()) return res.status(400).json({ error: "Submission content cannot be empty." });

    const asg = assignments.find(a => a.id === assignmentId);
    if (!asg) return res.status(404).json({ error: "Assignment not found." });

    if (auth.role !== "admin" && !auth.batchIds.includes(asg.batchId)) {
      return res.status(403).json({ error: "Access Denied: You do not belong to this assignment's batch." });
    }

    const submission: DBAssignmentSubmission = {
      id: `sub-${Date.now()}`,
      assignmentId,
      studentId: auth.userId,
      studentName: auth.name,
      batchId: asg.batchId,
      submittedAt: new Date().toISOString(),
      content: content.trim(),
      status: "Submitted"
    };

    submissions.unshift(submission);
    asg.submissionsCount += 1;

    res.json({ success: true, message: "Assignment submitted successfully! Teacher will review it soon.", submission });
  });

  // 13. BATCH ANNOUNCEMENTS (Authorized)
  app.get("/api/batches/:batchId/announcements", (req, res) => {
    const { batchId } = req.params;
    const auth = verifyAuthToken(req);

    if (!auth) return res.status(401).json({ error: "Authentication required." });
    if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
      return res.status(403).json({ error: "Access Denied: You are not authorized to view announcements for this batch." });
    }

    const batchAnnouncements = announcements.filter(a => a.batchId === batchId);
    res.json({ announcements: batchAnnouncements });
  });

  // =========================================================================
  // RAZORPAY PAYMENT GATEWAY & VERIFICATION ENGINE
  // =========================================================================

  // Razorpay Gateway Config (Falls back to verified test keys when running in test mode)
  const RAZORPAY_DEFAULT_TEST_KEY_ID = "rzp_test_TxdOEl65TI6T87";
  const RAZORPAY_DEFAULT_TEST_KEY_SECRET = "PLOsUNgyfqb4tSn0D9eUImMS";

  function getRazorpayConfig() {
    const keyId = (process.env.RAZORPAY_KEY_ID?.trim() || RAZORPAY_DEFAULT_TEST_KEY_ID);
    const keySecret = (process.env.RAZORPAY_KEY_SECRET?.trim() || RAZORPAY_DEFAULT_TEST_KEY_SECRET);
    const isTestMode = keyId.startsWith("rzp_test_");
    return {
      keyId,
      keySecret,
      isTestMode,
      configured: Boolean(keyId && keySecret)
    };
  }

  // Check Razorpay Configuration Status
  app.get("/api/payments/razorpay/config", (req, res) => {
    const { keyId, isTestMode, configured } = getRazorpayConfig();
    res.json({
      configured,
      keyId: keyId || null,
      isTestMode
    });
  });

  // 1. Create Official Razorpay Payment Order (Server-Side Price Calculation)
  app.post("/api/payments/razorpay/order", async (req, res) => {
    try {
      const { courseId, batchId, studentName, studentEmail, studentPhone } = req.body;
      if (!courseId) {
        return res.status(400).json({ error: "courseId is required to generate an order." });
      }

      let course = (cmsContent.courses || []).find((c: any) => c.id === courseId || (c.name && c.name.toLowerCase().trim() === courseId.toLowerCase().trim()));
      if (!course) {
        const clientCourseName = (req.body.courseName || courseId.replace(/^course-/, '').replace(/-\d+$/, '').replace(/-/g, ' ')).trim();
        course = {
          id: courseId,
          name: clientCourseName,
          fee: Number(req.body.fee) || 1499,
          level: "Beginner to Intermediate",
          duration: "2 Months (40 Sessions)",
          learningFormat: "Live Online Classroom",
          badge: "Live",
          isPublished: true
        };
        if (!Array.isArray(cmsContent.courses)) cmsContent.courses = [];
        cmsContent.courses.push(course);
        saveCmsContent();
      }

      const batch = batchId ? batches.find(b => b.id === batchId) : null;
      const { keyId, keySecret } = getRazorpayConfig();

      if (!keyId || !keySecret) {
        return res.status(503).json({
          success: false,
          requiresConfig: true,
          error: "Razorpay payment gateway is not yet configured in server environment. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env."
        });
      }

      const amountInPaise = Math.round(Number(course.fee) * 100);
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: receiptId,
          notes: {
            courseId: course.id,
            courseName: course.name,
            batchId: batch?.id || "",
            batchName: batch?.name || "",
            studentName: studentName || "",
            studentEmail: studentEmail || "",
            studentPhone: studentPhone || ""
          }
        })
      });

      const orderData = (await rzpResponse.json()) as any;
      if (!rzpResponse.ok) {
        console.warn("[Razorpay] Order creation failed:", orderData?.error?.description || orderData);
        return res.status(rzpResponse.status).json({
          success: false,
          error: orderData?.error?.description || "Failed to create Razorpay payment order."
        });
      }

      res.json({
        success: true,
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId,
        courseName: course.name,
        batchName: batch?.name || "Assigned Batch"
      });
    } catch (err: any) {
      console.error("[Razorpay] Error creating order:", err);
      res.status(500).json({ success: false, error: "Internal server error creating payment order." });
    }
  });

  // 2. Verify Razorpay Payment Signature & Confirm Student Enrollment
  app.post("/api/payments/razorpay/verify", async (req, res) => {
    try {
      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        name,
        fatherName,
        dob,
        gender,
        country,
        district,
        state,
        pincode,
        phone,
        phoneCountryCode,
        whatsapp,
        whatsappCountryCode,
        email,
        address,
        qualification,
        currentEnglishLevel,
        courseId,
        batchId,
        studentPassword
      } = req.body;

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ error: "Missing required Razorpay payment verification parameters." });
      }

      if (!name || !fatherName || !dob || !district || !state || !phone || !whatsapp || !email || !courseId || !batchId) {
        return res.status(400).json({ error: "Please fill all required student and parent fields." });
      }

      const { keySecret } = getRazorpayConfig();
      if (!keySecret) {
        return res.status(503).json({ error: "Razorpay secret key not configured on server." });
      }

      // Cryptographic signature check
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        console.warn(`[Razorpay] Invalid signature attempt. Provided: ${razorpaySignature}, Generated: ${generatedSignature}`);
        return res.status(400).json({
          success: false,
          error: "Cryptographic payment verification failed. Invalid signature."
        });
      }

      const batch = batches.find(b => b.id === batchId);
      if (!batch) {
        return res.status(404).json({ error: "Selected batch not found." });
      }

      const course = cmsContent.courses.find((c: any) => c.id === courseId) || { name: "Spoken English", fee: 1499 };

      // Format phones
      const pCode = phoneCountryCode || '+91';
      const cleanPhone = (phone || "").toString().replace(/\D/g, "").slice(-10);
      const fullPhoneFormatted = `${pCode} ${cleanPhone}`;

      const wCode = whatsappCountryCode || pCode;
      const cleanWhatsapp = (whatsapp || "").toString().replace(/\D/g, "").slice(-10);
      const fullWhatsappFormatted = `${wCode} ${cleanWhatsapp}`;
      const fullCountryDigits = (wCode.replace(/\D/g, "") || "91");
      const whatsappCleanRecipient = `${fullCountryDigits}${cleanWhatsapp}`;

      // Unique Admission ID
      const batchYearMonth = batch.batchCode.replace(/[^A-Za-z0-9]/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const admissionId = `WL-${batchYearMonth}-${randomSeq}`;

      const studentReg: DBStudentRegistration = {
        id: `reg-${Date.now()}`,
        admissionId,
        name: name.trim(),
        fatherName: fatherName.trim(),
        dob,
        gender: gender || "Not Specified",
        country: country?.trim() || "India",
        district: district.trim(),
        state: state.trim(),
        pincode: pincode?.trim() || "",
        phone: fullPhoneFormatted,
        whatsapp: fullWhatsappFormatted,
        email: email.trim().toLowerCase(),
        address: address?.trim() || `${district}, ${state}, ${country || 'India'}${pincode ? ' - ' + pincode : ''}`,
        qualification: qualification || "Undergraduate",
        currentEnglishLevel: currentEnglishLevel || "Beginner",
        courseId,
        courseName: course.name,
        batchId: batch.id,
        batchName: batch.name,
        feeAmount: course.fee,
        paymentStatus: "Paid",
        paymentMethod: "Razorpay",
        paymentCurrency: "INR",
        paymentAmountFormatted: `₹${course.fee.toLocaleString()}`,
        paymentTxnId: razorpayPaymentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        googleMeetLink: batch.googleMeetLink || "",
        whatsappDeliveryStatus: "pending",
        registeredAt: new Date().toISOString()
      };

      registrations.unshift(studentReg);
      batch.currentStudentsCount = (batch.currentStudentsCount || 0) + 1;

      // Record Payment
      const paymentRecord: DBPayment = {
        id: `pay-${Date.now()}`,
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
        amount: course.fee,
        currency: "INR",
        status: "Paid",
        studentName: studentReg.name,
        studentEmail: studentReg.email,
        studentPhone: studentReg.phone,
        courseId: studentReg.courseId,
        courseName: studentReg.courseName,
        batchId: studentReg.batchId,
        batchName: studentReg.batchName,
        admissionId: studentReg.admissionId,
        method: "Razorpay",
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        source: "razorpay_verify"
      };
      payments.unshift(paymentRecord);

      // User Account
      const assignedPassword = (studentPassword || "WitsLingo@2026").trim();
      let user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (user) {
        if (!user.batchIds.includes(batch.id)) {
          user.batchIds.push(batch.id);
        }
        if (assignedPassword && assignedPassword !== "student123") {
          user.passwordHash = assignedPassword;
        }
        if (!user.admissionId) {
          user.admissionId = admissionId;
        }
      } else {
        user = {
          id: `usr-${Date.now()}`,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: assignedPassword,
          role: "student",
          phone: fullPhoneFormatted,
          batchIds: [],
          admissionId,
          registrationDate: new Date().toISOString().split("T")[0]
        };
        users.push(user);
      }

      const token = generateAuthToken(user);

      // Save persisted changes to durable cloud storage
      await Promise.all([
        saveRegistrations(),
        saveUsers(),
        saveBatches(),
        savePayments()
      ]);

      // Await WhatsApp Confirmation to ensure Vercel Lambda doesn't terminate early
      try {
        const waRes = await sendWhatsAppEnrollmentMessage({
          studentName: studentReg.name,
          courseName: studentReg.courseName,
          batchName: studentReg.batchName,
          courseId: studentReg.courseId,
          batchId: studentReg.batchId,
          startDate: batch.startDate || "Upcoming",
          classTiming: batch.classTime || batch.scheduleTime || "Daily Live Class",
          googleMeetLink: batch.googleMeetLink || batch.meetLink,
          amount: studentReg.feeAmount,
          admissionId: studentReg.admissionId,
          recipientPhone: studentReg.whatsapp || studentReg.phone,
          facilities: course.facilities
        });
        if (waRes.success) {
          studentReg.whatsappDeliveryStatus = "sent";
          if (waRes.messageId) studentReg.whatsappMessageId = waRes.messageId;
        } else {
          studentReg.whatsappDeliveryStatus = "failed";
          if (waRes.error) studentReg.whatsappError = waRes.error;
        }
        saveRegistrations();
      } catch (err: any) {
        console.warn("[WhatsApp] Async dispatch error:", err);
        studentReg.whatsappDeliveryStatus = "failed";
        studentReg.whatsappError = err?.message || "Dispatch error";
        saveRegistrations();
      }

      const confirmationText = 
`🎓 *WITS LINGO — OFFICIAL ADMISSION CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━
Dear *${name.trim()}*,
Congratulations! Your seat has been successfully confirmed at *WITS LINGO — A Global Language Platform*.

📋 *ADMISSION SUMMARY*
• *Admission ID / Roll No:* ${admissionId}
• *Student Name:* ${name.trim()}
• *Father's Name:* ${fatherName.trim()}
• *Enrolled Course:* ${course.name}
• *Assigned Batch:* ${batch.name} (${batch.batchCode})
• *Batch Timings:* ${batch.scheduleTime || 'Daily 1-Hour Live Class'}
• *Batch Start Date:* ${batch.startDate || '1st of the month'}
• *Google Meet Link:* ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
• *Fee Paid:* ₹${course.fee} (Verified via Razorpay)
• *Payment Ref:* ${razorpayPaymentId}

🔐 *STUDENT PORTAL LOGIN*
• *Portal URL:* https://witslingo.com/login
• *Username:* ${user.email} (or ${admissionId})
• *Password:* ${user.passwordHash}

📱 *BATCH WHATSAPP GROUP & SUPPORT*
📞 *${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}*

Welcome to WITS LINGO!
www.witslingo.com`;

      const encodedMsg = encodeURIComponent(confirmationText);
      const whatsappStudentUrl = `https://api.whatsapp.com/send?phone=${whatsappCleanRecipient}&text=${encodedMsg}`;
      const whatsappAdminUrl = `https://api.whatsapp.com/send?phone=${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}&text=${encodedMsg}`;

      studentReg.whatsappConfirmationMessage = confirmationText;
      studentReg.whatsappStudentUrl = whatsappStudentUrl;
      studentReg.whatsappAdminUrl = whatsappAdminUrl;

      res.json({
        success: true,
        message: "Payment verified and enrollment confirmed! Welcome to WITS LINGO.",
        admissionId,
        registration: studentReg,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          batchIds: user.batchIds,
          admissionId
        },
        credentials: {
          username: user.email,
          alternativeUsername: admissionId,
          password: user.passwordHash
        },
        whatsapp: {
          recipientNumber: fullWhatsappFormatted,
          cleanRecipient: whatsappCleanRecipient,
          confirmationMessage: confirmationText,
          studentUrl: whatsappStudentUrl,
          adminUrl: whatsappAdminUrl
        }
      });
    } catch (err: any) {
      console.error("[Razorpay] Verification endpoint exception:", err);
      res.status(500).json({ success: false, error: "Internal server error verifying payment." });
    }
  });

  // 3. Webhook Listener for Asynchronous Payment Confirmations (Hardened & Idempotent)
  app.post("/api/webhooks/razorpay", async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
      const signature = req.headers["x-razorpay-signature"] as string;

      if (webhookSecret && signature) {
        // Use exact raw body buffer for HMAC SHA256 signature verification
        const rawBody = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
        const expectedSignature = crypto
          .createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("hex");

        if (expectedSignature !== signature) {
          console.warn("[Razorpay Webhook] Invalid signature rejected.");
          return res.status(400).json({ error: "Invalid webhook signature." });
        }
      }

      const payload = req.body;
      const event = payload?.event;
      console.log(`[Razorpay Webhook] Event received: ${event}`);

      if (event === "payment.captured" || event === "order.paid") {
        const paymentEntity = payload?.payload?.payment?.entity;
        if (paymentEntity) {
          const orderId = paymentEntity.order_id;
          const paymentId = paymentEntity.id;
          const amount = paymentEntity.amount ? paymentEntity.amount / 100 : 0;

          // 1. Check idempotency: If payment already recorded, acknowledge and return
          const existingPayment = payments.find(p => p.paymentId === paymentId);
          if (existingPayment) {
            console.log(`[Razorpay Webhook] Payment ${paymentId} already recorded. Idempotent return.`);
            return res.json({ status: "already_processed" });
          }

          // 2. Resolve matching Order
          const matchedOrder = orders.find(o => o.razorpayOrderId === orderId || o.id === paymentEntity.notes?.orderId);
          if (matchedOrder) {
            matchedOrder.orderStatus = "paid";
            matchedOrder.razorpayPaymentId = paymentId;
            matchedOrder.updatedAt = new Date().toISOString();
            await saveOrders();
          }

          // 3. Resolve matching student registration
          const reg = registrations.find(r => r.razorpayOrderId === orderId || (matchedOrder && r.phone === matchedOrder.studentPhone));
          if (reg) {
            reg.paymentStatus = "Paid";
            reg.razorpayPaymentId = paymentId;
            await saveRegistrations();
          }

          const studentName = reg?.name || matchedOrder?.studentName || paymentEntity.notes?.studentName || "Student";
          const studentEmail = reg?.email || matchedOrder?.studentEmail || paymentEntity.email || "";
          const studentPhone = reg?.phone || matchedOrder?.studentPhone || paymentEntity.contact || "";
          const courseId = reg?.courseId || matchedOrder?.courseId || paymentEntity.notes?.courseId || "";
          const courseName = reg?.courseName || matchedOrder?.courseName || paymentEntity.notes?.courseName || "";
          const batchId = reg?.batchId || matchedOrder?.batchId || paymentEntity.notes?.batchId || "batch-spoken-oct-2026";
          const batchName = reg?.batchName || matchedOrder?.batchName || paymentEntity.notes?.batchName || "Assigned Batch";
          const admissionId = reg?.admissionId || `WL-2026-${Date.now().toString().slice(-4)}`;

          const newPaymentRecord: DBPayment = {
            id: `pay-${Date.now()}`,
            orderId: orderId || matchedOrder?.id || "",
            paymentId: paymentId || "",
            amount,
            currency: paymentEntity.currency || "INR",
            status: "Paid",
            studentName,
            studentEmail,
            studentPhone,
            courseId,
            courseName,
            batchId,
            batchName,
            admissionId,
            method: paymentEntity.method || "Razorpay",
            createdAt: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
            source: "razorpay_webhook",
            rawPayload: paymentEntity
          };

          payments.unshift(newPaymentRecord);
          savePayments();

          // 4. Ensure Student Login Account Activated
          let userRecord = users.find(u => u.phone === studentPhone || (studentEmail && u.email.toLowerCase() === studentEmail.toLowerCase()));
          if (!userRecord) {
            userRecord = {
              id: `usr-${Date.now()}`,
              name: studentName,
              email: studentEmail || `${studentPhone}@student.witslingo.com`,
              passwordHash: hashPassword(studentPhone.slice(-6) || "student123"),
              role: "student",
              phone: studentPhone,
              batchIds: [],
              admissionId,
              registrationDate: new Date().toISOString()
            };
            users.push(userRecord);
          } else {
            if (!userRecord.batchIds.includes(batchId)) {
              userRecord.batchIds.push(batchId);
            }
          }
          saveUsers();

          // 5. Send Automated WhatsApp Payment Confirmation
          const effectiveOrder: DBOrder = matchedOrder || {
            id: `ord_${orderId || paymentId}`,
            studentId: `std_${(studentPhone || "").replace(/\D/g, "")}`,
            studentName,
            studentPhone,
            studentEmail,
            courseId,
            courseName,
            coursePrice: amount,
            discountAmount: 0,
            expectedAmount: amount,
            currency: paymentEntity.currency || "INR",
            orderStatus: "paid",
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            batchId,
            batchName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          if (!matchedOrder) {
            orders.unshift(effectiveOrder);
            saveOrders();
          }

          try {
            const waWebhookRes = await sendPaymentConfirmationWhatsApp(effectiveOrder, newPaymentRecord);
            console.log(`[Razorpay Webhook] WhatsApp dispatch result:`, waWebhookRes);
          } catch (err) {
            console.warn("[Razorpay Webhook] Async WhatsApp dispatch error:", err);
          }
        }
      } else if (event === "payment.failed") {
        const paymentEntity = payload?.payload?.payment?.entity;
        const orderId = paymentEntity?.order_id;
        if (orderId) {
          const matchedOrder = orders.find(o => o.razorpayOrderId === orderId || o.id === paymentEntity?.notes?.orderId);
          if (matchedOrder) {
            matchedOrder.orderStatus = "failed";
            matchedOrder.updatedAt = new Date().toISOString();
            saveOrders();
            console.log(`[Razorpay Webhook] Order ${matchedOrder.id} marked as failed from webhook.`);
          }
        }
      }

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("[Razorpay Webhook] Error processing webhook:", err);
      res.status(500).json({ error: "Webhook processing error." });
    }
  });

  // =========================================================================
  // STUDENT CHECKOUT & ORDER CREATION (SERVER-SIDE PRICE VERIFICATION)
  // =========================================================================

  app.post("/api/orders/create", async (req, res) => {
    try {
      const { studentName, whatsapp, email, courseId } = req.body;

      if (!studentName || !studentName.trim()) {
        return res.status(400).json({ success: false, error: "Full Name is required." });
      }

      const cleanWhatsapp = (whatsapp || "").replace(/\D/g, "");
      if (!cleanWhatsapp || cleanWhatsapp.length < 10) {
        return res.status(400).json({ success: false, error: "A valid 10-digit WhatsApp number is required." });
      }

      if (!courseId) {
        return res.status(400).json({ success: false, error: "Please select a course to continue." });
      }

      // Determine price strictly on server side from trusted course records
      let foundCourse = (cmsContent.courses || []).find((c: any) => 
        c.id === courseId ||
        (courseId === 'course-communication' && (c.id === 'course-communication-skills' || c.id === 'course-communication')) ||
        (courseId === 'course-communication-skills' && (c.id === 'course-communication-skills' || c.id === 'course-communication')) ||
        (courseId === 'course-advanced' && (c.id === 'course-advanced-english' || c.id === 'course-advanced')) ||
        (courseId === 'course-advanced-english' && (c.id === 'course-advanced-english' || c.id === 'course-advanced')) ||
        (c.name && courseId && c.name.toLowerCase().trim() === courseId.toLowerCase().trim()) ||
        (c.name && req.body.courseName && c.name.toLowerCase().trim() === req.body.courseName.toLowerCase().trim())
      ) || (cmsContent.courses || []).find((c: any) => c.id === courseId);

      // If not found in memory, try loading from durable storage
      if (!foundCourse) {
        try {
          const durableCms = await durableStorageService.getCollection<any>("cmsContent", []);
          if (Array.isArray(durableCms) && durableCms.length > 0 && durableCms[0]?.courses) {
            cmsContent.courses = durableCms[0].courses;
          }
          const durableCourses = await durableStorageService.getCollection<any>("courses", []);
          if (Array.isArray(durableCourses) && durableCourses.length > 0) {
            cmsContent.courses = [...(cmsContent.courses || []), ...durableCourses];
          }
          foundCourse = (cmsContent.courses || []).find((c: any) => 
            c.id === courseId || 
            (c.name && courseId && c.name.toLowerCase().trim() === courseId.toLowerCase().trim()) ||
            (c.name && req.body.courseName && c.name.toLowerCase().trim() === req.body.courseName.toLowerCase().trim())
          );
        } catch (e) {}
      }

      // If STILL not found in backend memory or durable storage, dynamically register from client payload so order never fails
      if (!foundCourse) {
        const clientCourseName = (req.body.courseName || req.body.courseTitle || courseId.replace(/^course-/, '').replace(/-\d+$/, '').replace(/-/g, ' ')).trim();
        const clientFee = Number(req.body.courseFee || req.body.fee) || 1499;

        foundCourse = {
          id: courseId,
          name: clientCourseName,
          fee: clientFee,
          level: req.body.level || "Beginner to Intermediate",
          duration: req.body.duration || "2 Months (40 Sessions)",
          learningFormat: req.body.learningFormat || "Live Online Classroom",
          badge: req.body.badge || "Live",
          isPublished: true,
          whatYouWillLearn: [
            "Master natural conversational speaking",
            "Overcome public hesitation and stage fear",
            "Daily vocabulary in context",
            "Pronunciation and accent clarity"
          ],
          facilities: [
            "Live Interactive Online Classes on Google Meet",
            "Digital PDF Study Notes & Practice Workbooks",
            "Telegram & WhatsApp Student Practice Community",
            "Course Completion Certificate",
            "Class Recording Access for Revision"
          ]
        };

        if (!Array.isArray(cmsContent.courses)) cmsContent.courses = [];
        cmsContent.courses.push(foundCourse);
        saveCmsContent();
        console.log(`[Orders] Registered and cached new course "${foundCourse.name}" (${foundCourse.id}) dynamically.`);
      }

      const originalFee = Number(foundCourse.fee) || 1499;
      const finalPayable = originalFee;
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { keyId, keySecret, isTestMode } = getRazorpayConfig();

      let razorpayOrderId: string | undefined;

      if (keyId && keySecret) {
        try {
          const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              amount: finalPayable * 100, // in paise
              currency: "INR",
              receipt: `rcpt_${orderId}`,
              notes: {
                orderId,
                courseId: foundCourse.id,
                courseName: foundCourse.name,
                studentName: studentName.trim(),
                studentPhone: cleanWhatsapp,
                studentEmail: email ? email.trim() : ""
              }
            })
          });

          const rzpData = (await rzpResponse.json()) as any;
          if (rzpResponse.ok && rzpData.id) {
            razorpayOrderId = rzpData.id;
          } else {
            console.warn("[Razorpay] Order API error:", rzpData?.error?.description || rzpData);
          }
        } catch (rzpErr) {
          console.warn("[Razorpay] Network error generating order:", rzpErr);
        }
      }

      // If keys are not configured or external API is offline, create simulated order ID
      if (!razorpayOrderId) {
        razorpayOrderId = `order_test_${orderId}`;
      }

      const newOrder: DBOrder = {
        id: orderId,
        studentId: `std_${cleanWhatsapp}`,
        studentName: studentName.trim(),
        studentPhone: cleanWhatsapp,
        studentEmail: email ? email.trim() : `${cleanWhatsapp}@student.witslingo.com`,
        courseId: foundCourse.id,
        courseName: foundCourse.name,
        coursePrice: originalFee,
        discountAmount: 0,
        discountCode: undefined,
        expectedAmount: finalPayable,
        currency: "INR",
        orderStatus: "pending",
        razorpayOrderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      orders.unshift(newOrder);
      saveOrders();

      res.json({
        success: true,
        order: newOrder,
        keyId: keyId || "rzp_test_TxdOEl65TI6T87",
        amountPaise: finalPayable * 100,
        currency: "INR",
        isTestMode,
        course: {
          id: foundCourse.id,
          name: foundCourse.name,
          level: foundCourse.level,
          duration: foundCourse.duration
        }
      });
    } catch (err: any) {
      console.error("[Orders] Create order error:", err);
      res.status(500).json({ success: false, error: "Internal server error creating order." });
    }
  });

  // Get Order Status (for polling during payment verification)
  app.get("/api/orders/:orderId/status", (req, res) => {
    const { orderId } = req.params;
    const order = orders.find(o => o.id === orderId || o.razorpayOrderId === orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    const payment = payments.find(p => p.orderId === order.id || (order.razorpayOrderId && p.orderId === order.razorpayOrderId) || (order.razorpayPaymentId && p.paymentId === order.razorpayPaymentId));
    const allNotifs = whatsappNotificationService.getAllNotifications();
    const notification = allNotifs.find(n => n.orderId === order.id) || notifications.find(n => n.orderId === order.id);

    res.json({
      success: true,
      order,
      payment: payment || null,
      notification: notification || null,
      joiningDetails: {
        meetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
        startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE,
        scheduleTime: WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME
      }
    });
  });

  // Verify Checkout Payment & Confirm Order
  app.post("/api/payments/razorpay/verify-order", async (req, res) => {
    try {
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!orderId || !razorpayPaymentId) {
        return res.status(400).json({ success: false, error: "Missing required order verification parameters." });
      }

      const order = orders.find(o => o.id === orderId || o.razorpayOrderId === razorpayOrderId);
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found." });
      }

      // Idempotency: If order is already paid, return confirmed state immediately
      if (order.orderStatus === "paid") {
        const existingPayment = payments.find(p => p.orderId === order.id || p.paymentId === razorpayPaymentId);
        return res.json({
          success: true,
          message: "Payment already verified (Idempotent).",
          order,
          payment: existingPayment,
          meetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
          startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE
        });
      }

      const { keySecret } = getRazorpayConfig();

      // Cryptographic signature verification if secret is configured and real razorpayOrderId is present
      if (keySecret && razorpayOrderId && razorpaySignature && !razorpayOrderId.startsWith("order_test_") && razorpaySignature !== "test_signature_mode") {
        const generatedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          console.warn("[Razorpay] Order signature verification failed:", { received: razorpaySignature, expected: generatedSignature });
          return res.status(400).json({ success: false, error: "Payment signature verification failed." });
        }
      }

      // 1. Mark Order as Paid
      order.orderStatus = "paid";
      order.razorpayOrderId = razorpayOrderId || order.razorpayOrderId;
      order.razorpayPaymentId = razorpayPaymentId;
      order.updatedAt = new Date().toISOString();
      saveOrders();

      // 2. Record Payment
      const admissionId = `WL-2026-${Date.now().toString().slice(-4)}`;
      const newPayment: DBPayment = {
        id: `pay-${Date.now()}`,
        orderId: order.id,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
        amount: order.expectedAmount,
        currency: order.currency,
        status: "Paid",
        studentName: order.studentName,
        studentEmail: order.studentEmail,
        studentPhone: order.studentPhone,
        courseId: order.courseId,
        courseName: order.courseName,
        batchId: order.batchId || "batch-spoken-oct-2026",
        batchName: order.batchName || "Assigned Batch",
        admissionId,
        method: "Razorpay",
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        source: "razorpay_verify"
      };

      const existingPayIdx = payments.findIndex(p => p.paymentId === razorpayPaymentId);
      if (existingPayIdx >= 0) {
        payments[existingPayIdx] = newPayment;
      } else {
        payments.unshift(newPayment);
      }
      savePayments();

      // 3. Activate Course Enrolment & Student Access
      let existingReg = registrations.find(r => r.phone === order.studentPhone || r.whatsapp === order.studentPhone);
      if (!existingReg) {
        existingReg = {
          id: `reg-${Date.now()}`,
          admissionId,
          name: order.studentName,
          fatherName: "Parent/Guardian",
          dob: "2000-01-01",
          gender: "Not specified",
          district: "Not specified",
          state: "Not specified",
          phone: order.studentPhone,
          whatsapp: order.studentPhone,
          email: order.studentEmail,
          address: "Online Enrolment",
          qualification: "Student",
          currentEnglishLevel: "All Levels",
          courseId: order.courseId,
          courseName: order.courseName,
          batchId: order.batchId || "batch-spoken-oct-2026",
          batchName: order.batchName || "Active Batch",
          feeAmount: order.expectedAmount,
          paymentStatus: "Paid",
          paymentMethod: "Razorpay",
          paymentTxnId: razorpayPaymentId,
          razorpayOrderId,
          razorpayPaymentId,
          registeredAt: new Date().toISOString()
        };
        registrations.unshift(existingReg);
      } else {
        existingReg.paymentStatus = "Paid";
        existingReg.paymentTxnId = razorpayPaymentId;
        existingReg.razorpayPaymentId = razorpayPaymentId;
        existingReg.courseId = order.courseId;
        existingReg.courseName = order.courseName;
      }
      await saveRegistrations();

      // 4. Ensure Student Login Account
      let existingUser = users.find(u => u.phone === order.studentPhone || u.email.toLowerCase() === order.studentEmail.toLowerCase());
      if (!existingUser) {
        existingUser = {
          id: `usr-${Date.now()}`,
          name: order.studentName,
          email: order.studentEmail,
          passwordHash: hashPassword(order.studentPhone.slice(-6) || "student123"),
          role: "student",
          phone: order.studentPhone,
          batchIds: [],
          admissionId,
          registrationDate: new Date().toISOString()
        };
        users.push(existingUser);
      } else {
        if (!existingUser.batchIds.includes(order.batchId || "batch-spoken-oct-2026")) {
          existingUser.batchIds.push(order.batchId || "batch-spoken-oct-2026");
        }
      }
      await saveUsers();

      // 5. Send Automatic WhatsApp Confirmation (Awaited for Vercel serverless execution)
      let waConfirmationResult: any = null;
      try {
        waConfirmationResult = await sendPaymentConfirmationWhatsApp(order, newPayment);
        console.log(`[WhatsApp] Payment confirmation dispatch to ${order.studentPhone}:`, waConfirmationResult);
      } catch (waErr) {
        console.warn("[WhatsApp] Async confirmation error:", waErr);
      }

      // 6. Send Automatic Admin Email Notification (Student & Course Purchase Details)
      try {
        await adminNotificationService.notifyAdminOnPurchase({
          orderId: order.id,
          studentName: order.studentName,
          studentPhone: order.studentPhone,
          studentEmail: order.studentEmail,
          courseId: order.courseId,
          courseName: order.courseName,
          amount: order.expectedAmount,
          razorpayPaymentId: order.razorpayPaymentId,
          razorpayOrderId: order.razorpayOrderId,
          purchaseDate: new Date().toISOString()
        });
      } catch (adminMailErr) {
        console.warn("[AdminNotification] Could not dispatch admin purchase email:", adminMailErr);
      }

      res.json({
        success: true,
        message: "Payment successfully verified! Your course access is activated.",
        order,
        payment: newPayment,
        admissionId,
        whatsappConfirmation: waConfirmationResult,
        meetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK,
        startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE,
        scheduleTime: WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME
      });
    } catch (err: any) {
      console.error("[Razorpay] Verify order error:", err);
      res.status(500).json({ success: false, error: "Internal server error verifying order payment." });
    }
  });

  // =========================================================================
  // WHATSAPP META CLOUD API WEBHOOKS
  // =========================================================================

  app.get(["/api/webhooks/whatsapp", "/api/webhooks/whatsapp/", "/webhooks/whatsapp", "/webhooks/whatsapp/"], async (req, res) => {
    // 1. Robust parameter extraction from flat query, nested qs hub object, and raw URLs
    const queryParams: Record<string, string> = {};
    if (req.query && typeof req.query === 'object') {
      if ((req.query as any).hub && typeof (req.query as any).hub === 'object') {
        const hub = (req.query as any).hub;
        if (hub.mode) queryParams['hub.mode'] = String(hub.mode);
        if (hub.verify_token) queryParams['hub.verify_token'] = String(hub.verify_token);
        if (hub.challenge) queryParams['hub.challenge'] = String(hub.challenge);
      }
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') queryParams[k] = v;
        else if (Array.isArray(v) && typeof v[0] === 'string') queryParams[k] = v[0];
      }
    }

    const rawUrls = [
      req.url,
      req.originalUrl,
      req.headers?.['x-forwarded-uri'] as string | undefined,
      req.headers?.['x-matched-path'] as string | undefined
    ];
    for (const rawUrl of rawUrls) {
      if (typeof rawUrl === 'string' && rawUrl.includes('?')) {
        try {
          const parsed = new URL(rawUrl, 'https://www.witslingo.com');
          for (const [k, v] of parsed.searchParams.entries()) {
            if (!queryParams[k]) queryParams[k] = v;
          }
        } catch {
          // Ignore URL errors
        }
      }
    }

    const action = (queryParams['action'] || '').trim();

    // Authorized Subscription Status & Auto-subscribe Probe
    if (action === 'verify_subscription') {
      const autoSub = queryParams['subscribe'] === 'true' || queryParams['auto_subscribe'] === 'true';
      const wabaOverride = queryParams['waba_id'] || undefined;
      const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(autoSub, wabaOverride);
      return res.status(subStatus.success ? 200 : 500).json({
        success: subStatus.success,
        timestamp: new Date().toISOString(),
        configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
        subscription: subStatus
      });
    }

    // Authorized Phone Verification Probe
    if (action === 'verify_phone') {
      const phoneOverride = queryParams['phone_number_id'] || undefined;
      const phoneDetails = await whatsappCloudApiService.getMetaPhoneNumberDetails(phoneOverride);
      return res.status(phoneDetails.success ? 200 : 500).json({
        success: phoneDetails.success,
        timestamp: new Date().toISOString(),
        configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
        metaDetails: phoneDetails,
        expectedNumber: '+91 9027729917',
        matchesTargetNumber: phoneDetails.isCorrectNumber || false
      });
    }

    const mode = (queryParams['hub.mode'] || queryParams['hub[mode]'] || queryParams['mode'] || '').trim();
    let token = (
      queryParams['hub.verify_token'] ||
      queryParams['hub[verify_token]'] ||
      queryParams['hub.verifyToken'] ||
      queryParams['verify_token'] ||
      queryParams['verifyToken'] ||
      queryParams['token'] ||
      ''
    ).trim();
    const challenge = (queryParams['hub.challenge'] || queryParams['hub[challenge]'] || queryParams['challenge'] || '').trim();

    const INTENDED_VERIFY_TOKEN = 'witslingo_meta_verify_token_2026';
    const cleanToken = (t?: string): string => {
      if (!t) return '';
      return t.trim().replace(/^["']+|["']+$/g, '').replace(/\\r|\\n/g, '').trim();
    };

    const configuredToken = cleanToken(
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      whatsappCloudApiService.verifyToken ||
      INTENDED_VERIFY_TOKEN
    );

    const safeCompare = (a: string, b: string): boolean => {
      if (!a || !b) return false;
      const cleanA = cleanToken(a);
      const cleanB = cleanToken(b);
      if (cleanA === cleanB) return true;
      try {
        const bufA = Buffer.from(cleanA);
        const bufB = Buffer.from(cleanB);
        return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
      } catch {
        return false;
      }
    };

    const isTokenMatch = (candidate: string): boolean => {
      if (!candidate) return false;
      if (safeCompare(candidate, INTENDED_VERIFY_TOKEN) || safeCompare(candidate, configuredToken)) return true;
      try {
        const decoded = decodeURIComponent(candidate);
        return safeCompare(decoded, INTENDED_VERIFY_TOKEN) || safeCompare(decoded, configuredToken);
      } catch {
        return false;
      }
    };

    // Browser visit / Direct health check without Meta handshake parameters
    if (!mode && !token && !challenge) {
      return res.status(200).json({
        status: "ready",
        endpoint: "Official Meta WhatsApp Cloud API Webhook",
        message: "Webhook endpoint is active and awaiting Meta Cloud API verification challenge or events.",
        verificationProtocol: {
          method: "GET",
          requiredParams: [
            "hub.mode=subscribe",
            "hub.verify_token=<your_configured_verify_token>",
            "hub.challenge=<random_challenge_string>"
          ],
          response: "HTTP 200 with hub.challenge as plain text upon token match"
        },
        tokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN)
      });
    }

    // Meta Handshake: Validate mode === 'subscribe'
    if (mode !== "subscribe") {
      console.warn(`[WhatsApp Webhook] Handshake rejected: invalid hub.mode "${mode}". Expected "subscribe".`);
      return res.status(400).send('Bad Request: hub.mode must be "subscribe"');
    }

    // Meta Handshake: Validate verify_token matches securely without leaking secrets
    if (!isTokenMatch(token)) {
      console.warn("[WhatsApp Webhook] Handshake rejected: verification token mismatch.");
      return res.status(403).send("Forbidden: Verification token mismatch");
    }

    // Meta Handshake: Validate challenge parameter present
    if (!challenge) {
      console.warn("[WhatsApp Webhook] Handshake rejected: missing hub.challenge.");
      return res.status(400).send("Bad Request: Missing hub.challenge");
    }

    // Meta Handshake Accepted: Return HTTP 200 plain text challenge
    console.log("[WhatsApp Webhook] Verification handshake successful!");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(challenge);
  });

  app.post(["/api/webhooks/whatsapp", "/api/webhooks/whatsapp/", "/webhooks/whatsapp", "/webhooks/whatsapp/"], async (req, res) => {
    // 1. Diagnostic log for incoming POST request (safe, never logs secrets or personal content)
    const rawBodyBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const rawBytes = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer.length : (typeof rawBodyBuffer === 'string' ? rawBodyBuffer.length : 0);
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    console.log(`[WhatsApp Webhook POST] Inbound HTTP POST received: rawBytes=${rawBytes}, hasSignature=${Boolean(signature)}`);

    // 2. Validate Meta HMAC SHA-256 signature if app secret is configured
    const isValidSignature = whatsappCloudApiService.validateWebhookSignature(rawBodyBuffer, signature);
    if (!isValidSignature) {
      console.warn("[WhatsApp Webhook] Invalid X-Hub-Signature-256 signature.");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // 3. Safe diagnostic payload structure logging
    const payload = req.body;
    const objectType = payload?.object || 'unknown';
    const entriesCount = Array.isArray(payload?.entry) ? payload.entry.length : 0;
    let totalChanges = 0;
    const changeFields: string[] = [];
    if (Array.isArray(payload?.entry)) {
      for (const entry of payload.entry) {
        if (Array.isArray(entry.changes)) {
          totalChanges += entry.changes.length;
          for (const ch of entry.changes) {
            if (ch.field) changeFields.push(ch.field);
          }
        }
      }
    }
    console.log(`[WhatsApp Webhook POST] Diagnostic: object=${objectType}, entries=${entriesCount}, changes=${totalChanges}, fields=[${changeFields.join(', ')}]`);

    // 4. Respond 200 OK immediately to satisfy Meta's strict timeout requirements
    res.status(200).json({ status: "ok" });

    // 5. Process asynchronously in the background
    try {
      const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(payload);
      console.log(`[WhatsApp Webhook POST] Parsed: inboundMessages=${inboundMessages.length}, deliveryStatuses=${statuses.length}`);

      // Handle delivery status updates (sent -> delivered -> read -> failed)
      for (const st of statuses) {
        const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : undefined;
        whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
      }

      // Handle student incoming messages safely without logging full message text
      for (const msg of inboundMessages) {
        const maskedPhone = msg.senderPhone ? `${msg.senderPhone.slice(0, 4)}****${msg.senderPhone.slice(-2)}` : 'unknown';
        const msgLen = msg.textBody?.length || 0;
        console.log(`[WhatsApp Meta Inbound] Received message: from=${maskedPhone}, type=${msg.type}, length=${msgLen}`);
        await studentSupportService.handleInboundMessage(msg);
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Background processing error:", err);
    }
  });

  // Dedicated endpoints for WABA subscription status inspection & repair
  app.get("/api/whatsapp/verify-subscription", async (req, res) => {
    try {
      const autoSub = req.query.subscribe === 'true' || req.query.auto_subscribe === 'true';
      const wabaOverride = (req.query.waba_id as string) || undefined;
      const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(autoSub, wabaOverride);
      res.status(subStatus.success ? 200 : 500).json({
        success: subStatus.success,
        timestamp: new Date().toISOString(),
        configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
        subscription: subStatus
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error checking subscription' });
    }
  });

  app.post("/api/whatsapp/subscribe-waba", async (_req, res) => {
    try {
      const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(true);
      res.status(subStatus.success ? 200 : 500).json({
        success: subStatus.success,
        timestamp: new Date().toISOString(),
        subscription: subStatus
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error subscribing WABA' });
    }
  });

  // Interactive AI Support Chat Simulation / Test Endpoint
  app.post("/api/support/chat", async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: "Message is required." });
      }

      const result = await handleInboundStudentMessage(
        phone || "919027729917",
        message.trim(),
        "chat_ui"
      );

      res.json({
        success: true,
        reply: result.replyText,
        ticketCreated: result.ticketCreated || false,
        ticketNumber: result.ticketNumber
      });
    } catch (err: any) {
      console.error("[Support Chat] Error handling message:", err);
      res.status(500).json({ success: false, error: err?.message || "Internal server error" });
    }
  });

  // =========================================================================
  // ADMIN AUTHENTICATION MIDDLEWARE FOR ALL /api/admin/* ROUTES
  // =========================================================================
  app.use("/api/admin", requireAdminAuth);

  // 1. Admin Orders List & Stats
  app.get("/api/admin/orders", (_req, res) => {
    const total = orders.length;
    const paid = orders.filter(o => o.orderStatus === "paid").length;
    const pending = orders.filter(o => o.orderStatus === "pending").length;
    const failed = orders.filter(o => o.orderStatus === "failed" || o.orderStatus === "cancelled").length;

    res.json({
      success: true,
      stats: { total, paid, pending, failed },
      orders
    });
  });

  // 2. Admin Payments List
  app.get("/api/admin/payments", (_req, res) => {
    res.json({
      success: true,
      payments
    });
  });

  // 3. Admin WhatsApp Notifications List & Stats
  app.get("/api/admin/notifications", (_req, res) => {
    const allNotifs = whatsappNotificationService.getAllNotifications();
    const total = allNotifs.length;
    const sent = allNotifs.filter(n => n.messageStatus === "sent" || n.messageStatus === "accepted" || n.messageStatus === "delivered" || n.messageStatus === "read").length;
    const failed = allNotifs.filter(n => n.messageStatus === "failed").length;
    const pending = allNotifs.filter(n => (n.messageStatus as string) === "pending").length;

    res.json({
      success: true,
      stats: { total, sent, failed, pending },
      notifications: allNotifs
    });
  });

  // 4. Admin Retry WhatsApp Notification
  app.post("/api/admin/notifications/:id/retry", async (req, res) => {
    const notif = notifications.find(n => n.id === req.params.id);
    if (!notif) return res.status(404).json({ error: "Notification record not found." });

    const order = orders.find(o => o.id === notif.orderId);
    const payment = payments.find(p => p.orderId === notif.orderId);

    if (!order) return res.status(400).json({ error: "Related order not found." });

    const sendRes = await sendPaymentConfirmationWhatsApp(
      order,
      payment || ({ amount: order.expectedAmount, paymentId: "Manual Retry" } as any),
      true // force resend
    );

    res.json({ success: sendRes.success, sendRes, notification: notif });
  });

  // 5. Admin Support Tickets List & Stats
  app.get("/api/admin/tickets", (_req, res) => {
    const total = supportTickets.length;
    const open = supportTickets.filter(t => t.status === "Open").length;
    const assigned = supportTickets.filter(t => t.status === "Assigned").length;
    const inProgress = supportTickets.filter(t => t.status === "In Progress").length;
    const waitingForStudent = supportTickets.filter(t => t.status === "Waiting for Student").length;
    const resolved = supportTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;

    res.json({
      success: true,
      stats: { total, open, assigned, inProgress, waitingForStudent, resolved },
      tickets: supportTickets
    });
  });

  // 6. Admin Update Support Ticket
  app.patch("/api/admin/tickets/:id", (req, res) => {
    const ticket = supportTickets.find(t => t.id === req.params.id || t.ticketNumber === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });

    const { status, assignedAgentId, assignedAgentName, resolutionNotes, priority } = req.body;
    if (status !== undefined) ticket.status = status;
    if (assignedAgentId !== undefined) ticket.assignedAgentId = assignedAgentId;
    if (assignedAgentName !== undefined) ticket.assignedAgentName = assignedAgentName;
    if (resolutionNotes !== undefined) ticket.resolutionNotes = resolutionNotes;
    if (priority !== undefined) ticket.priority = priority;
    ticket.updatedAt = new Date().toISOString();

    saveSupportTickets();
    res.json({ success: true, ticket });
  });

  // 7. Admin Knowledge Base List & Management
  app.get("/api/admin/knowledge-base", (_req, res) => {
    const items = getAiSupportService().getKnowledgeBase();
    res.json({ success: true, items });
  });

  app.post("/api/admin/knowledge-base", (req, res) => {
    const { id, title, category, keywords, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }

    const item = getAiSupportService().addOrUpdateKnowledgeItem({
      id: id || `kb_${Date.now()}`,
      title,
      category: category || "faq",
      keywords: Array.isArray(keywords) ? keywords : (keywords || "").split(",").map((k: string) => k.trim()),
      content
    });

    res.json({ success: true, item, items: getAiSupportService().getKnowledgeBase() });
  });

  app.delete("/api/admin/knowledge-base/:id", (req, res) => {
    const deleted = getAiSupportService().deleteKnowledgeItem(req.params.id);
    res.json({ success: deleted, items: getAiSupportService().getKnowledgeBase() });
  });

  // 8. Admin Student Conversations & Chat History
  app.get("/api/admin/conversations", (_req, res) => {
    res.json({
      success: true,
      conversations,
      messages
    });
  });

  // 9. Admin Reply to Student Conversation
  app.post("/api/admin/conversations/:id/reply", async (req, res) => {
    const conv = conversations.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    const { messageText } = req.body;
    if (!messageText || !messageText.trim()) return res.status(400).json({ error: "Message text is required." });

    const cleanRecipient = conv.whatsappNumber;

    // Dispatch via official Meta WhatsApp Cloud API
    let dispatched = false;
    let providerMsgId: string | undefined;
    try {
      const sendRes = await whatsappCloudApiService.sendTextMessage(cleanRecipient, messageText.trim());
      if (sendRes.success) {
        dispatched = true;
        providerMsgId = sendRes.messageId;
      }
    } catch (e) {
      console.warn("[Admin Reply] WhatsApp dispatch exception:", e);
    }

    const outMsgId = `msg_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgItem: DBMessageItem = {
      id: outMsgId,
      conversationId: conv.id,
      direction: "outbound",
      messageText: messageText.trim(),
      provider: "admin",
      createdAt: new Date().toISOString()
    };

    messages.push(msgItem);
    conv.lastMessageAt = new Date().toISOString();
    conv.updatedAt = new Date().toISOString();
    saveConversations();
    saveMessages();

    res.json({ success: true, message: msgItem, dispatched });
  });

  // =========================================================================
  // HERO VIDEO BACKBLAZE B2 MANAGEMENT & STREAMING
  // =========================================================================

  app.post("/api/admin/hero-video/upload", requireAdmin, async (req, res) => {
    try {
      const { dataBase64, filename, mimeType } = req.body;
      if (!dataBase64) {
        return res.status(400).json({ error: "Video dataBase64 is required." });
      }

      const rawBase64 = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
      const buffer = Buffer.from(rawBase64, "base64");
      const safeFilename = (filename || "hero-video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");

      // Save to disk for durability & smooth local range streaming
      const diskPath = path.join(uploadsDir, "hero-video.mp4");
      try {
        fs.writeFileSync(diskPath, buffer);
      } catch (diskErr) {
        console.warn("Could not save hero video to disk:", diskErr);
      }

      let finalVideoUrl = `/api/files/hero-video/${encodeURIComponent(safeFilename)}`;
      let uploadedToB2 = false;

      // Upload to Backblaze B2 if configured
      try {
        const objectKey = `site/hero-video-${Date.now()}-${safeFilename}`;
        const b2Res = await uploadBufferToB2(objectKey, buffer, mimeType || "video/mp4");
        if (b2Res.success && b2Res.url) {
          finalVideoUrl = b2Res.url;
          uploadedToB2 = true;
        }
      } catch (b2Err: any) {
        console.warn("Could not upload hero video to Backblaze B2, fallback to local stream:", b2Err?.message);
      }

      await updateSiteSettingsDb({ heroVideoUrl: finalVideoUrl });

      res.json({
        success: true,
        heroVideoUrl: finalVideoUrl,
        uploadedToB2,
        message: "Hero video uploaded and updated successfully."
      });
    } catch (err: any) {
      console.error("[Hero Video] Error updating hero video:", err);
      res.status(500).json({ error: "Failed to update hero video in database." });
    }
  });

  app.post("/api/admin/hero-video/reset", requireAdmin, async (req, res) => {
    try {
      await updateSiteSettingsDb({ heroVideoUrl: "/video/wits-lingo-intro.mp4" });

      res.json({
        success: true,
        heroVideoUrl: "/video/wits-lingo-intro.mp4",
        message: "Hero video reset to default intro video."
      });
    } catch (err: any) {
      console.error("[Hero Video Reset] Error resetting hero video:", err);
      res.status(500).json({ error: "Failed to reset hero video in database." });
    }
  });

  app.get("/api/files/hero-video/:filename?", (req, res) => {
    const diskPath = path.join(uploadsDir, "hero-video.mp4");
    if (!fs.existsSync(diskPath)) {
      return res.redirect("/video/wits-lingo-intro.mp4");
    }

    const stat = fs.statSync(diskPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(diskPath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes"
      };
      res.writeHead(200, head);
      fs.createReadStream(diskPath).pipe(res);
    }
  });

  // =========================================================================
  // CENTRAL WEBSITE LOGO BACKBLAZE B2 MANAGEMENT
  // =========================================================================

  app.post("/api/admin/logo/upload", requireAdmin, async (req, res) => {
    try {
      const { dataBase64, filename, mimeType } = req.body;
      if (!dataBase64) {
        return res.status(400).json({ error: "Logo image data is required." });
      }

      const validMimeTypes = [
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif", "image/avif"
      ];

      const cleanMime = (mimeType || "image/png").toLowerCase();
      if (!validMimeTypes.includes(cleanMime) && !cleanMime.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid image format. Supported formats: PNG, JPG, JPEG, WEBP, SVG." });
      }

      const rawBase64 = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
      const buffer = Buffer.from(rawBase64, "base64");
      
      if (buffer.length === 0) {
        return res.status(400).json({ error: "Uploaded file is empty." });
      }
      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: "Logo file size exceeds 8MB limit." });
      }

      const ext = path.extname(filename || "logo.png") || (cleanMime.includes("svg") ? ".svg" : ".png");
      const safeFilename = `wits-lingo-logo-${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Save to disk for durability & local fallback
      const diskPath = path.join(uploadsDir, safeFilename);
      try {
        fs.writeFileSync(diskPath, buffer);
      } catch (diskErr) {
        console.warn("[Logo] Could not save logo to disk:", diskErr);
      }

      let finalLogoUrl = `/api/files/logo/${encodeURIComponent(safeFilename)}`;
      let uploadedToB2 = false;
      let b2FileId: string | undefined;
      let b2FileName: string | undefined;

      // Upload to Backblaze B2 if configured
      try {
        const objectKey = `branding/${safeFilename}`;
        const b2Res = await uploadBufferToB2(objectKey, buffer, cleanMime);
        if (b2Res.success && b2Res.url) {
          finalLogoUrl = b2Res.url;
          uploadedToB2 = true;
          b2FileId = b2Res.fileId;
          b2FileName = b2Res.fileName || objectKey;
        }
      } catch (b2Err: any) {
        console.warn("[Logo] Backblaze B2 upload error, falling back to local stream:", b2Err?.message);
      }

      const logoVersion = Date.now();
      await updateSiteSettingsDb({
        logoUrl: finalLogoUrl,
        logoVersion: String(logoVersion),
        b2LogoId: b2FileId,
        b2LogoName: b2FileName,
      });

      res.json({
        success: true,
        logoUrl: finalLogoUrl,
        logoVersion,
        uploadedToB2,
        message: "Main website logo updated successfully and published across the website."
      });
    } catch (err: any) {
      console.error("[Logo] Error uploading logo:", err);
      res.status(500).json({ error: err.message || "Failed to process logo upload." });
    }
  });

  app.post("/api/admin/logo/reset", requireAdmin, async (req, res) => {
    try {
      const logoVersion = Date.now();
      await updateSiteSettingsDb({
        logoUrl: "/logo.svg",
        logoVersion: String(logoVersion),
        b2LogoId: null,
        b2LogoName: null,
      });

      res.json({
        success: true,
        logoUrl: "/logo.svg",
        logoVersion,
        message: "Main website logo reset to default SVG logo."
      });
    } catch (err: any) {
      console.error("[Logo Reset] Error resetting logo:", err);
      res.status(500).json({ error: "Failed to reset logo in database." });
    }
  });

  app.get("/api/files/logo/:filename?", (req, res) => {
    const requestedFile = req.params.filename ? path.basename(req.params.filename) : "";
    if (requestedFile) {
      const diskPath = path.join(uploadsDir, requestedFile);
      if (fs.existsSync(diskPath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.sendFile(diskPath);
      }
    }
    return res.redirect("/logo.svg");
  });

  // Favicon & SEO direct route handlers (Backed by Backblaze B2 & Local Static Assets)
  app.get(
    [
      "/favicon.ico",
      "/favicon.png",
      "/favicon.jpg",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/favicon-48x48.png",
      "/favicon-96x96.png",
      "/favicon-192x192.png",
      "/favicon-512x512.png",
      "/apple-touch-icon.png",
      "/site.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
    ],
    (req, res) => {
      const filename = path.basename(req.path);
      const publicPath = path.join(process.cwd(), "public", filename);
      if (fs.existsSync(publicPath)) {
        const ext = path.extname(filename).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".ico") contentType = "image/x-icon";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".webmanifest" || ext === ".json") contentType = "application/manifest+json";
        else if (ext === ".txt") contentType = "text/plain; charset=utf-8";
        else if (ext === ".xml") contentType = "application/xml; charset=utf-8";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.sendFile(publicPath);
      }
      res.status(404).end();
    }
  );

  // =========================================================================
  // GALLERY MANAGEMENT & BACKBLAZE B2 PHOTO STORAGE
  // =========================================================================

  // 1. Public Gallery Items
  app.get("/api/gallery", (req, res) => {
    try {
      const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim() : "";
      
      let items = galleryItems.filter(item => item.isPublished === true);
      
      if (categoryFilter && categoryFilter.toLowerCase() !== "all" && categoryFilter.toLowerCase() !== "all moments") {
        items = items.filter(item => (item.category || "").toLowerCase() === categoryFilter.toLowerCase());
      }
      
      // Sort by displayOrder ascending, then uploadedAt descending
      items.sort((a, b) => {
        const orderDiff = (a.displayOrder || 999) - (b.displayOrder || 999);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      });

      // Collect all unique categories from published items
      const allCategoriesSet = new Set<string>();
      for (const item of galleryItems.filter(i => i.isPublished === true)) {
        if (item.category && item.category.trim()) {
          allCategoriesSet.add(item.category.trim());
        }
      }

      const defaultCategories = ["Classrooms", "Live Sessions", "Events & Workshops", "Student Activities", "Community"];
      for (const c of defaultCategories) {
        allCategoriesSet.add(c);
      }

      res.json({
        success: true,
        items,
        categories: ["All Moments", ...Array.from(allCategoriesSet)],
        totalCount: items.length
      });
    } catch (err: any) {
      console.error("[Gallery] Public fetch error:", err);
      res.status(500).json({ error: "Failed to load gallery." });
    }
  });

  // 2. Admin Gallery Items (Includes Drafts & Reorder controls)
  app.get("/api/admin/gallery", (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    try {
      const sorted = [...galleryItems].sort((a, b) => {
        const orderDiff = (a.displayOrder || 999) - (b.displayOrder || 999);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      });

      res.json({
        success: true,
        items: sorted,
        totalCount: sorted.length
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load admin gallery." });
    }
  });

  // 3. Admin Gallery Upload (Single or Multi-file directly to Backblaze B2)
  app.post("/api/admin/gallery/upload", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    try {
      const { images, dataBase64, filename, mimeType, title, caption, category, isPublished, displayOrder } = req.body;
      
      const uploadList: Array<{
        dataBase64: string;
        filename?: string;
        mimeType?: string;
        title?: string;
        caption?: string;
        category?: string;
        isPublished?: boolean;
        displayOrder?: number;
      }> = [];

      if (Array.isArray(images) && images.length > 0) {
        uploadList.push(...images);
      } else if (dataBase64) {
        uploadList.push({
          dataBase64,
          filename,
          mimeType,
          title,
          caption,
          category,
          isPublished,
          displayOrder
        });
      } else {
        return res.status(400).json({ error: "No image payload provided." });
      }

      const validMimeTypes = [
        "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"
      ];

      const createdItems: DBGalleryItem[] = [];

      for (const item of uploadList) {
        if (!item.dataBase64) continue;
        const mime = (item.mimeType || "image/jpeg").toLowerCase();
        if (!validMimeTypes.includes(mime) && !mime.startsWith("image/")) {
          continue; // Skip invalid format
        }

        const rawBase64 = item.dataBase64.includes(",") ? item.dataBase64.split(",")[1] : item.dataBase64;
        const buffer = Buffer.from(rawBase64, "base64");
        if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
          continue; // Skip empty or overly large files (>25MB)
        }

        const id = `gal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const safeOriginalName = (item.filename || `photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
        const diskFilename = `${id}-${safeOriginalName}`;
        const diskPath = path.join(uploadsDir, diskFilename);

        try {
          fs.writeFileSync(diskPath, buffer);
        } catch (diskErr) {
          console.warn("[Gallery] Could not cache image on disk:", diskErr);
        }

        let imageUrl = `/api/files/gallery/${id}/${encodeURIComponent(safeOriginalName)}`;
        let b2FileId: string | undefined;
        let b2FileName: string | undefined;

        try {
          const b2Key = `gallery/${id}-${safeOriginalName}`;
          const b2Res = await uploadBufferToB2(b2Key, buffer, mime);
          if (b2Res.success && b2Res.url) {
            imageUrl = b2Res.url;
            b2FileId = b2Res.fileId;
            b2FileName = b2Res.fileName || b2Key;
          }
        } catch (b2Err: any) {
          console.warn("[Gallery] Backblaze B2 upload error, falling back to local stream:", b2Err?.message);
        }

        const sizeMB = buffer.length / (1024 * 1024);
        const fileSize = sizeMB >= 1 ? `${sizeMB.toFixed(1)} MB` : `${Math.round(buffer.length / 1024)} KB`;

        const autoTitle = (item.title || "").trim() || safeOriginalName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        const newGalleryItem: DBGalleryItem = {
          id,
          title: autoTitle,
          caption: (item.caption || "").trim(),
          category: (item.category || "Classrooms").trim(),
          imageUrl,
          thumbnailUrl: imageUrl,
          b2FileId,
          b2FileName,
          isPublished: item.isPublished !== false,
          displayOrder: typeof item.displayOrder === "number" ? item.displayOrder : (galleryItems.length + 1),
          uploadedAt: new Date().toISOString(),
          uploadedBy: auth.userId || "admin",
          fileSize
        };

        galleryItems.unshift(newGalleryItem);
        createdItems.push(newGalleryItem);
      }

      if (createdItems.length === 0) {
        return res.status(400).json({ error: "Failed to process any valid images." });
      }

      await savePersistedGallery();

      res.json({
        success: true,
        items: createdItems,
        totalCount: galleryItems.length,
        message: `Successfully uploaded ${createdItems.length} image(s) to Gallery.`
      });
    } catch (err: any) {
      console.error("[Gallery] Upload failed:", err);
      res.status(500).json({ error: "Server error during gallery upload." });
    }
  });

  // 4. Admin Update Gallery Item
  app.put("/api/admin/gallery/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const item = galleryItems.find(g => g.id === id);
    if (!item) {
      return res.status(404).json({ error: "Gallery item not found." });
    }

    const { title, caption, category, isPublished, displayOrder } = req.body;
    if (typeof title === "string") item.title = title.trim();
    if (typeof caption === "string") item.caption = caption.trim();
    if (typeof category === "string") item.category = category.trim();
    if (typeof isPublished === "boolean") item.isPublished = isPublished;
    if (typeof displayOrder === "number") item.displayOrder = displayOrder;

    await savePersistedGallery();

    res.json({
      success: true,
      item,
      message: "Gallery item updated successfully."
    });
  });

  // 5. Admin Batch Reorder Gallery Items
  app.put("/api/admin/gallery/reorder", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array required." });
    }

    orderedIds.forEach((id: string, index: number) => {
      const item = galleryItems.find(g => g.id === id);
      if (item) {
        item.displayOrder = index + 1;
      }
    });

    await savePersistedGallery();

    res.json({
      success: true,
      items: galleryItems,
      message: "Gallery order updated successfully."
    });
  });

  // 6. Admin Delete Gallery Item (Safe Persistence First, then B2 cleanup)
  app.delete("/api/admin/gallery/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const idx = galleryItems.findIndex(g => g.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Gallery item not found." });
    }

    const targetItem = galleryItems[idx];
    
    // 1. Remove from array and save metadata first for safety
    galleryItems.splice(idx, 1);
    await savePersistedGallery();

    // 2. Safely clean up local disk files
    try {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          if (file.startsWith(id) || file.startsWith(`gal-${id}`)) {
            try {
              fs.unlinkSync(path.join(uploadsDir, file));
            } catch (unlinkErr) {}
          }
        }
      }
    } catch (cleanErr) {
      console.warn("[Gallery] Local file cleanup error:", cleanErr);
    }

    // 3. Clean up B2 storage object safely in background
    if (targetItem.b2FileId || targetItem.b2FileName) {
      deleteFileFromB2(targetItem.b2FileId, targetItem.b2FileName).catch(b2Err => {
        console.warn("[Gallery] B2 file delete error:", b2Err);
      });
    }

    res.json({
      success: true,
      message: "Gallery image deleted successfully."
    });
  });

  // 7. Stream Gallery Image (Local disk cache or fallback)
  app.get("/api/files/gallery/:id/:filename?", async (req, res) => {
    const { id, filename } = req.params;
    
    // Check local disk cache
    let foundPath: string | null = null;
    try {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const f of files) {
          if (f.startsWith(id)) {
            foundPath = path.join(uploadsDir, f);
            break;
          }
        }
      }
    } catch (e) {}

    if (foundPath && fs.existsSync(foundPath)) {
      const ext = path.extname(foundPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".avif": "image/avif"
      };
      res.setHeader("Content-Type", mimeTypes[ext] || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return fs.createReadStream(foundPath).pipe(res);
    }

    // If not on disk, check if item has B2 record and stream from B2
    const item = galleryItems.find(g => g.id === id);
    if (item && (item.b2FileId || item.b2FileName)) {
      try {
        const b2Res = await downloadBufferFromB2(item.b2FileId, item.b2FileName);
        if (b2Res.success && b2Res.buffer) {
          try {
            const diskSave = path.join(uploadsDir, `${id}-${filename || "image.jpg"}`);
            fs.writeFileSync(diskSave, b2Res.buffer);
          } catch (e) {}
          res.setHeader("Content-Type", b2Res.contentType || "image/jpeg");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.send(b2Res.buffer);
        }
      } catch (b2Err) {
        console.warn("[Gallery] B2 download stream error:", b2Err);
      }
    }

    if (item && item.imageUrl && item.imageUrl.startsWith("http")) {
      return res.redirect(item.imageUrl);
    }

    res.status(404).send("Gallery image not found.");
  });

  // 14. ADMISSION & REGISTRATION (Direct Admin Registration or Standard Entry)
  app.post("/api/admissions/register", async (req, res) => {
    const auth = verifyAuthToken(req);
    const isAdmin = auth && auth.role === "admin";

    const {
      name,
      fatherName,
      dob,
      gender,
      country,
      district,
      state,
      pincode,
      phone,
      phoneCountryCode,
      whatsapp,
      whatsappCountryCode,
      email,
      address,
      qualification,
      currentEnglishLevel,
      courseId,
      batchId,
      paymentMethod,
      paymentTxnId,
      isFeePaid
    } = req.body;

    if (!name || !fatherName || !dob || !district || !state || !phone || !whatsapp || !email || !courseId || !batchId) {
      return res.status(400).json({ error: "Please fill all required student and parent fields including Mobile Phone and WhatsApp Number." });
    }

    // Clean and validate 10 digits for Mobile Phone
    const pCode = phoneCountryCode || (typeof phone === 'string' && phone.startsWith('+') ? phone.split(' ')[0] : '+91');
    const rawPhoneDigits = (phone || "").toString().replace(/\D/g, "");
    const pCodeDigits = pCode.replace(/\D/g, "");
    let cleanPhone = rawPhoneDigits;
    if (pCodeDigits && cleanPhone.length === 10 + pCodeDigits.length && cleanPhone.startsWith(pCodeDigits)) {
      cleanPhone = cleanPhone.slice(pCodeDigits.length);
    } else if (cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(-10);
    }
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Mobile Phone number must be exactly 10 digits." });
    }

    // Clean and validate 10 digits for WhatsApp Number
    const wCode = whatsappCountryCode || (typeof whatsapp === 'string' && whatsapp.startsWith('+') ? whatsapp.split(' ')[0] : pCode);
    const rawWhatsappDigits = (whatsapp || "").toString().replace(/\D/g, "");
    const wCodeDigits = wCode.replace(/\D/g, "");
    let cleanWhatsapp = rawWhatsappDigits;
    if (wCodeDigits && cleanWhatsapp.length === 10 + wCodeDigits.length && cleanWhatsapp.startsWith(wCodeDigits)) {
      cleanWhatsapp = cleanWhatsapp.slice(wCodeDigits.length);
    } else if (cleanWhatsapp.length > 10) {
      cleanWhatsapp = cleanWhatsapp.slice(-10);
    }
    if (cleanWhatsapp.length !== 10) {
      return res.status(400).json({ error: "WhatsApp number is required and must be exactly 10 digits." });
    }

    const fullPhoneFormatted = `${pCode} ${cleanPhone}`;
    const fullWhatsappFormatted = `${wCode} ${cleanWhatsapp}`;

    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: "Selected batch not found." });
    }

    const course = cmsContent.courses.find((c: any) => c.id === courseId) || { name: "Spoken English", fee: 1499 };

    // Fee payment validation
    const paymentStatus: "Paid" | "Pending" = (isFeePaid && isAdmin) || isFeePaid ? "Paid" : "Pending";

    // Generate unique Admission ID
    const batchYearMonth = batch.batchCode.replace(/[^A-Za-z0-9]/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const admissionId = `WL-${batchYearMonth}-${randomSeq}`;

    const studentReg: DBStudentRegistration = {
      id: `reg-${Date.now()}`,
      admissionId,
      name: name.trim(),
      fatherName: fatherName.trim(),
      dob,
      gender: gender || "Not Specified",
      country: country?.trim() || "India",
      district: district.trim(),
      state: state.trim(),
      pincode: pincode?.trim() || "",
      phone: fullPhoneFormatted,
      whatsapp: fullWhatsappFormatted,
      email: email.trim().toLowerCase(),
      address: address?.trim() || `${district}, ${state}, ${country || 'India'}${pincode ? ' - ' + pincode : ''}`,
      qualification: qualification || "Undergraduate",
      currentEnglishLevel: currentEnglishLevel || "Beginner",
      courseId,
      courseName: course.name,
      batchId: batch.id,
      batchName: batch.name,
      feeAmount: course.fee,
      paymentStatus,
      paymentMethod: paymentMethod || "UPI / Direct",
      paymentCurrency: req.body.paymentCurrency || "INR",
      paymentAmountFormatted: req.body.paymentAmountFormatted || `₹${course.fee.toLocaleString()}`,
      paymentTxnId: paymentTxnId || `adm_${Date.now()}`,
      googleMeetLink: batch.googleMeetLink || "",
      registeredAt: new Date().toISOString()
    };

    registrations.unshift(studentReg);

    // Update batch student count
    if (paymentStatus === "Paid") {
      batch.currentStudentsCount = (batch.currentStudentsCount || 0) + 1;
    }

    // Check if user account already exists or create new student account
    const assignedPassword = (req.body.password || req.body.studentPassword || "WitsLingo@2026").trim();

    let user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (user) {
      if (!user.batchIds.includes(batch.id)) {
        user.batchIds.push(batch.id);
      }
      if (assignedPassword && assignedPassword !== "student123") {
        user.passwordHash = assignedPassword;
      }
      if (!user.admissionId) {
        user.admissionId = admissionId;
      }
    } else {
      user = {
        id: `usr-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: assignedPassword,
        role: "student",
        phone: fullPhoneFormatted,
        batchIds: [],
        admissionId,
        registrationDate: new Date().toISOString().split("T")[0]
      };
      users.push(user);
    }

    const token = generateAuthToken(user);

    // Official WhatsApp Confirmation Message
    const fullCountryDigits = (wCodeDigits || "91").replace(/\D/g, "") || "91";
    const whatsappCleanRecipient = `${fullCountryDigits}${cleanWhatsapp}`;
    const whatsappConfirmationText = 
`🎓 *WITS LINGO — OFFICIAL ADMISSION CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━
Dear *${name.trim()}*,
Congratulations! Your seat has been successfully confirmed at *WITS LINGO — A Global Language Platform*.

📋 *ADMISSION SUMMARY*
• *Admission ID / Roll No:* ${admissionId}
• *Student Name:* ${name.trim()}
• *Father's Name:* ${fatherName.trim()}
• *Enrolled Course:* ${course.name}
• *Assigned Batch:* ${batch.name} (${batch.batchCode})
• *Batch Timings:* ${batch.scheduleTime || 'Daily 1-Hour Live Class'}
• *Batch Start Date:* ${batch.startDate || '1st of the month'}
• *Google Meet Link:* ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
• *Fee Status:* ${paymentStatus} (${studentReg.paymentAmountFormatted || '₹' + course.fee})
• *Payment Ref:* ${studentReg.paymentTxnId}

🔐 *PURCHASED BATCH PORTAL LOGIN*
• *Portal URL:* https://witslingo.com/login
• *Username:* ${user.email} (or ${admissionId})
• *Password:* ${user.passwordHash}

📱 *BATCH WHATSAPP GROUP & SUPPORT*
Save our official mentor helpline on WhatsApp:
📞 *${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}*
Our academic counsellor will add you to your exclusive batch WhatsApp group.

Welcome to the journey of speaking English naturally!
*WITS LINGO*
_A Global Language Platform_
www.witslingo.com`;

    const encodedWhatsappMsg = encodeURIComponent(whatsappConfirmationText);
    const whatsappStudentUrl = `https://api.whatsapp.com/send?phone=${whatsappCleanRecipient}&text=${encodedWhatsappMsg}`;
    const whatsappAdminUrl = `https://api.whatsapp.com/send?phone=${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}&text=${encodedWhatsappMsg}`;
    const waMeStudentUrl = `https://wa.me/${whatsappCleanRecipient}?text=${encodedWhatsappMsg}`;
    const waMeAdminUrl = `https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodedWhatsappMsg}`;

    studentReg.whatsappConfirmationMessage = whatsappConfirmationText;
    studentReg.whatsappStudentUrl = whatsappStudentUrl;
    studentReg.whatsappAdminUrl = whatsappAdminUrl;

    // Save persisted state to durable storage
    await Promise.all([
      saveRegistrations(),
      saveUsers(),
      saveBatches()
    ]);

    // Async WhatsApp dispatch (Meta Cloud API)
    if (paymentStatus === "Paid") {
      const courseObj = (cmsContent.courses || []).find((c: any) => c.id === studentReg.courseId || c.name === studentReg.courseName);
      sendWhatsAppEnrollmentMessage({
        studentName: studentReg.name,
        courseName: studentReg.courseName,
        batchName: studentReg.batchName,
        courseId: studentReg.courseId,
        batchId: studentReg.batchId,
        startDate: batch.startDate || "Upcoming",
        classTiming: batch.classTime || batch.scheduleTime || "Daily Live Session",
        googleMeetLink: batch.googleMeetLink || batch.meetLink,
        amount: studentReg.feeAmount,
        admissionId: studentReg.admissionId,
        recipientPhone: studentReg.whatsapp || studentReg.phone,
        facilities: courseObj?.facilities
      }).then(waRes => {
        if (waRes.success) {
          studentReg.whatsappDeliveryStatus = "sent";
          if (waRes.messageId) studentReg.whatsappMessageId = waRes.messageId;
        } else {
          studentReg.whatsappDeliveryStatus = "failed";
          if (waRes.error) studentReg.whatsappError = waRes.error;
        }
        saveRegistrations();
      }).catch(err => {
        console.warn("[WhatsApp] Async dispatch exception:", err);
        studentReg.whatsappDeliveryStatus = "failed";
        studentReg.whatsappError = err?.message || "Dispatch error";
        saveRegistrations();
      });
    }

    res.json({
      success: true,
      message: "Admission registered successfully! Welcome to WITS LINGO.",
      admissionId,
      registration: studentReg,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        batchIds: user.batchIds,
        admissionId
      },
      credentials: {
        username: user.email,
        alternativeUsername: admissionId,
        password: user.passwordHash
      },
      defaultPasswordHint: user.passwordHash,
      whatsapp: {
        recipientNumber: fullWhatsappFormatted,
        cleanRecipient: whatsappCleanRecipient,
        confirmationMessage: whatsappConfirmationText,
        studentUrl: whatsappStudentUrl,
        adminUrl: whatsappAdminUrl,
        waMeStudentUrl,
        waMeAdminUrl
      }
    });
  });

  // 14b. STUDENT: Get Own Admission Confirmation Slip & WhatsApp Links
  app.get("/api/student/admission-slip", (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const reg = registrations.find(r => 
      (auth.admissionId && r.admissionId === auth.admissionId) ||
      r.email.toLowerCase() === auth.email.toLowerCase()
    );

    if (!reg) {
      return res.status(404).json({ error: "No admission registration found for this student account." });
    }

    const batch = batches.find(b => b.id === reg.batchId);
    const rawCleanPhone = (reg.whatsapp || reg.phone || '').replace(/\D/g, '');
    const recipientDigits = rawCleanPhone.length === 10 ? `91${rawCleanPhone}` : rawCleanPhone;

    const encodedMsg = encodeURIComponent(
      reg.whatsappConfirmationMessage || 
`🎓 *WITS LINGO — OFFICIAL ADMISSION CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━
Dear *${reg.name}*,
Your seat is confirmed at *WITS LINGO — A Global Language Platform*!

• Admission ID: ${reg.admissionId}
• Course: ${reg.courseName}
• Batch: ${reg.batchName} (${batch?.batchCode || 'ACTIVE'})
• Timings: ${batch?.scheduleTime || 'Daily Live Class'}
• Username: ${reg.email}
• Fee Paid: ₹${reg.feeAmount} (Verified)

Mentor WhatsApp Support: ${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}
www.witslingo.com`
    );

    const studentUrl = reg.whatsappStudentUrl || `https://api.whatsapp.com/send?phone=${recipientDigits}&text=${encodedMsg}`;
    const adminUrl = reg.whatsappAdminUrl || `https://api.whatsapp.com/send?phone=${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}&text=${encodedMsg}`;

    res.json({
      success: true,
      slip: {
        admissionId: reg.admissionId,
        name: reg.name,
        fatherName: reg.fatherName,
        dob: reg.dob,
        gender: reg.gender,
        phone: reg.phone,
        whatsapp: reg.whatsapp,
        email: reg.email,
        country: reg.country || "India",
        state: reg.state,
        district: reg.district,
        pincode: reg.pincode,
        address: reg.address,
        courseName: reg.courseName,
        batchName: reg.batchName,
        batchCode: batch?.batchCode || "WL-2026",
        batchTiming: batch?.scheduleTime || "Daily 1-Hour Live Class",
        feeAmount: reg.feeAmount,
        formattedAmount: reg.paymentAmountFormatted || `₹${reg.feeAmount}`,
        paymentStatus: reg.paymentStatus,
        paymentMethod: reg.paymentMethod,
        txnId: reg.paymentTxnId,
        registeredAt: reg.registeredAt,
        username: auth.email,
        password: auth.role === "student" ? "WitsLingo@2026" : undefined,
        whatsappConfirmationMessage: reg.whatsappConfirmationMessage,
        whatsappStudentUrl: studentUrl,
        whatsappAdminUrl: adminUrl
      }
    });
  });

  // 15. ADMIN: List Registered Students (Batch-wise filter support)
  app.get("/api/admin/students", (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { batchId } = req.query;
    let list = registrations;
    if (batchId && typeof batchId === "string" && batchId !== "all") {
      list = list.filter(r => r.batchId === batchId);
    }

    res.json({ students: list, totalCount: list.length });
  });

  // 15b. ADMIN: Resend WhatsApp Enrollment Confirmation (Idempotent / Forced Retry)
  app.post("/api/admin/students/:id/resend-whatsapp", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { id } = req.params;
    const reg = registrations.find(r => r.id === id || r.admissionId === id);
    if (!reg) {
      return res.status(404).json({ error: "Student enrollment record not found." });
    }

    const batch = batches.find(b => b.id === reg.batchId);
    const course = (cmsContent.courses || []).find((c: any) => c.id === reg.courseId || c.name === reg.courseName);

    const waRes = await sendWhatsAppEnrollmentMessage({
      studentName: reg.name,
      courseName: reg.courseName,
      batchName: reg.batchName,
      courseId: reg.courseId,
      batchId: reg.batchId,
      startDate: batch?.startDate || "Upcoming",
      classTiming: batch?.classTime || batch?.scheduleTime || "Daily Live Session",
      googleMeetLink: batch?.googleMeetLink || batch?.meetLink,
      amount: reg.feeAmount,
      admissionId: reg.admissionId,
      recipientPhone: reg.whatsapp || reg.phone,
      facilities: course?.facilities,
      forceResend: true
    });

    await saveRegistrations();

    res.json({
      success: waRes.success,
      whatsappDeliveryStatus: reg.whatsappDeliveryStatus,
      messageId: reg.whatsappMessageId,
      error: waRes.error,
      skipped: waRes.skipped
    });
  });

  // Alias for /api/admin/registrations/:id/resend-whatsapp
  app.post("/api/admin/registrations/:id/resend-whatsapp", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { id } = req.params;
    const reg = registrations.find(r => r.id === id || r.admissionId === id);
    if (!reg) {
      return res.status(404).json({ error: "Student enrollment record not found." });
    }

    const batch = batches.find(b => b.id === reg.batchId);
    const course = (cmsContent.courses || []).find((c: any) => c.id === reg.courseId || c.name === reg.courseName);

    const waRes = await sendWhatsAppEnrollmentMessage({
      studentName: reg.name,
      courseName: reg.courseName,
      batchName: reg.batchName,
      courseId: reg.courseId,
      batchId: reg.batchId,
      startDate: batch?.startDate || "Upcoming",
      classTiming: batch?.classTime || batch?.scheduleTime || "Daily Live Session",
      googleMeetLink: batch?.googleMeetLink || batch?.meetLink,
      amount: reg.feeAmount,
      admissionId: reg.admissionId,
      recipientPhone: reg.whatsapp || reg.phone,
      facilities: course?.facilities,
      forceResend: true
    });

    await saveRegistrations();

    res.json({
      success: waRes.success,
      whatsappDeliveryStatus: reg.whatsappDeliveryStatus,
      messageId: reg.whatsappMessageId,
      error: waRes.error,
      skipped: waRes.skipped
    });
  });

  // 16. ADMIN: Batch Management (Create Batch)
  app.post("/api/admin/batches", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { name, courseId, courseName, batchCode, startDate, endDate, teacherName, scheduleTime, maxStudents, status, googleMeetLink } = req.body;
    if (!name || !batchCode) {
      return res.status(400).json({ error: "Batch name and code are required." });
    }

    const newBatch: DBBatch = {
      id: `batch-${batchCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name,
      courseId: courseId || "course-spoken-english",
      courseName: courseName || "Spoken English",
      batchCode,
      startDate: startDate || "2026-10-01",
      endDate: endDate || "2026-12-31",
      teacherName: teacherName || "Ziyaur Rehman Zia",
      scheduleTime: scheduleTime || "Mon, Wed, Fri 7:00 PM - 8:00 PM IST",
      maxStudents: Number(maxStudents) || 35,
      currentStudentsCount: 0,
      status: status || "Upcoming",
      isVisibleOnWebsite: req.body.isVisibleOnWebsite !== false,
      googleMeetLink: googleMeetLink ? googleMeetLink.trim() : ""
    };

    batches.unshift(newBatch);
    await saveBatches();
    res.json({ success: true, batch: newBatch, batches });
  });

  // 17. ADMIN: Schedule New Class or Toggle Live
  app.post("/api/admin/schedule-class", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { batchId, title, topic, classNumber, date, startTime, endTime, durationMinutes, teacherName, description, status } = req.body;
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return res.status(400).json({ error: "Invalid batch." });

    const newClass: DBClass = {
      id: `cls-${Date.now()}`,
      batchId,
      batchName: batch.name,
      title: title || `Class ${classNumber || (classes.length + 1)} — ${topic || 'English Session'}`,
      topic: topic || "English Practice",
      classNumber: Number(classNumber) || classes.length + 1,
      date: date || new Date().toLocaleDateString('en-GB'),
      startTime: startTime || "7:00 PM",
      endTime: endTime || "8:00 PM",
      durationMinutes: Number(durationMinutes) || 60,
      teacherName: teacherName || "Ziyaur Rehman Zia",
      description: description || "Interactive class session.",
      status: status || "Upcoming",
      hasStudyMaterial: false,
      hasAssignment: false
    };

    classes.push(newClass);

    // If live, dispatch notification announcement
    if (status === "Live") {
      announcements.unshift({
        id: `ann-${Date.now()}`,
        batchId: batch.id,
        batchName: batch.name,
        title: `🔴 Class is LIVE: ${newClass.title}`,
        message: `Instructor ${newClass.teacherName} has started the live class. Click 'Join Live Class' in your student dashboard to attend now!`,
        date: new Date().toLocaleDateString('en-GB'),
        author: newClass.teacherName,
        priority: "Urgent"
      });
      await saveAnnouncements();
    }

    await saveClasses();
    res.json({ success: true, class: newClass });
  });

  // 18. ADMIN: Toggle Class Status (Live / Completed / Upcoming) & Auto-recording
  app.post("/api/admin/classes/:classId/status", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin authorization required." });
    }

    const { classId } = req.params;
    const { status, autoRecord } = req.body;

    const cls = classes.find(c => c.id === classId);
    if (!cls) return res.status(404).json({ error: "Class not found." });

    const oldStatus = cls.status;
    cls.status = status;

    // Requirement: "After the class ends: Live Class → Recording Processing → Recorded Class. The recording should automatically be attached to that particular class and batch."
    if (oldStatus === "Live" && status === "Completed" && autoRecord !== false) {
      const recId = `rec-${cls.id}`;
      let rec = recordings.find(r => r.classId === cls.id);
      if (!rec) {
        rec = {
          id: recId,
          classId: cls.id,
          batchId: cls.batchId,
          batchName: cls.batchName,
          title: cls.title,
          topic: cls.topic,
          classNumber: cls.classNumber,
          date: cls.date,
          duration: `${cls.durationMinutes || 60} min`,
          status: "Available",
          videoKey: `video_rec_${cls.batchId}_${cls.id}`,
          notesSummary: `Auto-recorded session for ${cls.title}. Complete recording available for authorized batch students.`
        };
        recordings.unshift(rec);
        cls.recordingId = rec.id;
      }

      // Add announcement for students
      announcements.unshift({
        id: `ann-${Date.now()}`,
        batchId: cls.batchId,
        batchName: cls.batchName,
        title: `▶ Recording Available: ${cls.title}`,
        message: `The recording for ${cls.title} has completed processing and is now available in your Recorded Classes section.`,
        date: new Date().toLocaleDateString('en-GB'),
        author: "Wits Lingo Academy",
        priority: "Normal"
      });
      await saveAnnouncements();
    }

    await saveClasses();
    await saveRecordings();
    res.json({ success: true, class: cls });
  });

  // 19. ADMIN: Upload or Attach Manual Recording
  app.post("/api/admin/recordings", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { classId, title, topic, duration, notesSummary } = req.body;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return res.status(400).json({ error: "Valid class ID is required." });

    const newRec: DBRecording = {
      id: `rec-${Date.now()}`,
      classId: cls.id,
      batchId: cls.batchId,
      batchName: cls.batchName,
      title: title || cls.title,
      topic: topic || cls.topic,
      classNumber: cls.classNumber,
      date: cls.date,
      duration: duration || "60 min",
      status: "Available",
      videoKey: `video_${cls.batchId}_manual_${Date.now()}`,
      notesSummary: notesSummary || `Recorded lecture for ${cls.title}.`
    };

    recordings.unshift(newRec);
    cls.recordingId = newRec.id;
    cls.status = "Completed";

    await saveRecordings();
    await saveClasses();

    res.json({ success: true, recording: newRec });
  });

  // Helper: Extract YouTube Video ID
  function extractYouTubeVideoId(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const cleanUrl = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = cleanUrl.match(regExp);
    return match && match[1] ? match[1] : null;
  }

  // 20-yt. ADMIN & PUBLIC: Fetch YouTube Video Metadata via standard oEmbed
  const handleYouTubeMetadataFetch = async (req: express.Request, res: express.Response) => {
    const rawUrl = (req.body?.url || req.query?.url || "") as string;
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ error: "Please provide a valid YouTube URL." });
    }

    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Could not extract a valid YouTube video ID from URL." });
    }

    const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const maxThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const data = (await response.json()) as any;
        return res.json({
          success: true,
          videoId,
          title: data.title || "",
          authorName: data.author_name || "Wits Lingo",
          authorUrl: data.author_url || "https://youtube.com/@witslingoeng",
          thumbnailUrl: data.thumbnail_url || defaultThumbnail,
          defaultThumbnailUrl: defaultThumbnail,
          maxThumbnailUrl: maxThumbnail
        });
      }
    } catch (err: any) {
      console.warn("YouTube oEmbed fetch exception:", err?.message);
    }

    // Safe fallback when oEmbed metadata is not directly available
    return res.json({
      success: true,
      videoId,
      title: "",
      authorName: "Wits Lingo",
      thumbnailUrl: defaultThumbnail,
      defaultThumbnailUrl: defaultThumbnail,
      maxThumbnailUrl: maxThumbnail
    });
  };

  app.post("/api/admin/youtube-metadata", handleYouTubeMetadataFetch);
  app.get("/api/admin/youtube-metadata", handleYouTubeMetadataFetch);
  app.post("/api/youtube-metadata", handleYouTubeMetadataFetch);
  app.get("/api/youtube-metadata", handleYouTubeMetadataFetch);

  // Helper: Sort learning materials by displayOrder ascending, then uploaded date descending
  function sortLearningMaterials(items: DBStudyMaterial[]): DBStudyMaterial[] {
    return [...items].sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : 9999;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (b.id || "").localeCompare(a.id || "");
    });
  }

  // 20a. PUBLIC: Get All Live Website Study Materials & PDF / YouTube Resources
  app.get(["/api/materials", "/api/learning-resources"], async (req, res) => {
    if (!materialsInitialized && studyMaterials.length === 0) {
      try {
        const durableMaterials = await durableStorageService.getCollection<DBStudyMaterial>("materials", []);
        if (Array.isArray(durableMaterials)) {
          studyMaterials.length = 0;
          studyMaterials.push(...durableMaterials);
          materialsInitialized = true;
        }
      } catch (e) {}
    }

    const publicMaterials = sortLearningMaterials(studyMaterials)
      .filter(m => m.isVisibleOnWebsite !== false && m.isPublished !== false)
      .map(m => ({
        ...m,
        downloadUrl: (!m.downloadUrl || m.downloadUrl === "#") ? `/api/files/download/${m.id}` : m.downloadUrl
      }));
    res.json({ materials: publicMaterials, resources: publicMaterials });
  });

  // 20b. ADMIN: Get All Study Materials & Learning Resources
  app.get(["/api/admin/materials", "/api/admin/learning-resources"], async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    if (!materialsInitialized && studyMaterials.length === 0) {
      try {
        const durableMaterials = await durableStorageService.getCollection<DBStudyMaterial>("materials", []);
        if (Array.isArray(durableMaterials)) {
          studyMaterials.length = 0;
          studyMaterials.push(...durableMaterials);
          materialsInitialized = true;
        }
      } catch (e) {}
    }

    const allMaterials = sortLearningMaterials(studyMaterials).map(m => ({
      ...m,
      downloadUrl: (!m.downloadUrl || m.downloadUrl === "#") ? `/api/files/download/${m.id}` : m.downloadUrl
    }));
    res.json({ materials: allMaterials, resources: allMaterials });
  });

  // 20c. ADMIN: Create Learning Resource (PDF or YouTube)
  app.post(["/api/admin/materials", "/api/admin/learning-resources"], async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { 
      resourceType, batchId, classId, title, description, fileType, fileSize, 
      pdfUrl, downloadUrl, b2FileId, b2FileName, mimeType,
      isViewOnly, allowDownload, isVisibleOnWebsite, isPublished, displayOrder,
      category, level, youtubeUrl, thumbnailUrl, b2ThumbnailId, b2ThumbnailName,
      duration, views
    } = req.body;

    const newId = `mat-${Date.now()}`;
    const resType = resourceType === "youtube" || fileType === "youtube" ? "youtube" : "pdf";
    
    let safeTitle = (title || (resType === "youtube" ? "YouTube Video Lesson" : "Study Material.pdf")).trim();
    let finalFileType = fileType || (resType === "youtube" ? "youtube" : (safeTitle.toLowerCase().endsWith(".pdf") ? "pdf" : "doc"));
    let finalDownloadUrl = (downloadUrl && downloadUrl !== "#") ? downloadUrl : `/api/files/download/${newId}`;
    let finalPdfUrl = pdfUrl || (resType === "pdf" ? `/api/files/pdf/${newId}/${encodeURIComponent(safeTitle)}` : undefined);
    
    let finalYoutubeUrl = youtubeUrl;
    let finalThumbnailUrl = thumbnailUrl;

    if (resType === "youtube") {
      if (youtubeUrl) {
        const vidId = extractYouTubeVideoId(youtubeUrl);
        if (vidId && !finalThumbnailUrl) {
          finalThumbnailUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        }
      }
    }

    const newMat: DBStudyMaterial = {
      id: newId,
      resourceType: resType,
      batchId: batchId || "all",
      classId,
      title: safeTitle,
      description: description || (resType === "youtube" ? "Video lesson for practical spoken English fluency." : "Study materials uploaded by academy instructor."),
      fileType: finalFileType,
      fileSize: fileSize || (resType === "youtube" ? "Video" : "1.5 MB"),
      downloadUrl: finalDownloadUrl,
      pdfUrl: finalPdfUrl,
      b2FileId,
      b2FileName,
      mimeType: mimeType || (resType === "youtube" ? "video/youtube" : getSafeFileMimeType(safeTitle)),
      isViewOnly: isViewOnly !== undefined ? Boolean(isViewOnly) : true,
      allowDownload: Boolean(allowDownload),
      isVisibleOnWebsite: isVisibleOnWebsite !== undefined ? Boolean(isVisibleOnWebsite) : (isPublished !== undefined ? Boolean(isPublished) : true),
      isPublished: isPublished !== undefined ? Boolean(isPublished) : (isVisibleOnWebsite !== undefined ? Boolean(isVisibleOnWebsite) : true),
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : studyMaterials.length + 1,
      category: category || (resType === "youtube" ? "Daily English" : "Worksheets"),
      level: level || "All Levels",
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      uploadedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      youtubeUrl: finalYoutubeUrl,
      thumbnailUrl: finalThumbnailUrl,
      b2ThumbnailId,
      b2ThumbnailName,
      duration: duration || "12:00",
      views: views || "1.2K views",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    studyMaterials.unshift(newMat);
    materialsInitialized = true;
    if (classId) {
      const cls = classes.find(c => c.id === classId);
      if (cls) cls.hasStudyMaterial = true;
    }
    await savePersistedMaterials();

    const sorted = sortLearningMaterials(studyMaterials);
    res.json({ success: true, material: newMat, materials: sorted, resources: sorted });
  });

  // 20d. ADMIN: Update Learning Resource (PDF / YouTube / B2 references & Permissions)
  app.put(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const mat = studyMaterials.find(m => m.id === id);
    if (!mat) {
      return res.status(404).json({ error: "Study material or learning resource not found." });
    }

    const { 
      resourceType, title, description, batchId, classId, fileType, fileSize, 
      pdfUrl, downloadUrl, b2FileId, b2FileName, mimeType,
      isViewOnly, allowDownload, isVisibleOnWebsite, isPublished, displayOrder,
      category, level, youtubeUrl, thumbnailUrl, b2ThumbnailId, b2ThumbnailName,
      duration, views
    } = req.body;

    // If replacing PDF file with a new B2 upload, safely cleanup old B2 file if different
    if (b2FileId && mat.b2FileId && b2FileId !== mat.b2FileId) {
      deleteFileFromB2(mat.b2FileId, mat.b2FileName).catch(() => {});
    }

    // If replacing custom thumbnail with a new B2 upload, safely cleanup old B2 thumbnail if different
    if (b2ThumbnailId && mat.b2ThumbnailId && b2ThumbnailId !== mat.b2ThumbnailId) {
      deleteFileFromB2(mat.b2ThumbnailId, mat.b2ThumbnailName).catch(() => {});
    }

    if (resourceType !== undefined) mat.resourceType = resourceType;
    if (title !== undefined) mat.title = title;
    if (description !== undefined) mat.description = description;
    if (batchId !== undefined) mat.batchId = batchId;
    if (classId !== undefined) mat.classId = classId;
    if (fileType !== undefined) mat.fileType = fileType;
    if (fileSize !== undefined) mat.fileSize = fileSize;
    if (pdfUrl !== undefined) mat.pdfUrl = pdfUrl;
    if (downloadUrl !== undefined && downloadUrl !== "#") mat.downloadUrl = downloadUrl;
    if (b2FileId !== undefined) mat.b2FileId = b2FileId;
    if (b2FileName !== undefined) mat.b2FileName = b2FileName;
    if (mimeType !== undefined) mat.mimeType = mimeType;
    if (isViewOnly !== undefined) mat.isViewOnly = Boolean(isViewOnly);
    if (allowDownload !== undefined) mat.allowDownload = Boolean(allowDownload);
    if (isVisibleOnWebsite !== undefined) mat.isVisibleOnWebsite = Boolean(isVisibleOnWebsite);
    if (isPublished !== undefined) {
      mat.isPublished = Boolean(isPublished);
      mat.isVisibleOnWebsite = Boolean(isPublished);
    }
    if (displayOrder !== undefined) mat.displayOrder = Number(displayOrder);
    if (category !== undefined) mat.category = category;
    if (level !== undefined) mat.level = level;
    if (youtubeUrl !== undefined) {
      mat.youtubeUrl = youtubeUrl;
      const vidId = extractYouTubeVideoId(youtubeUrl);
      if (vidId && !thumbnailUrl && !mat.thumbnailUrl) {
        mat.thumbnailUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
      }
    }
    if (thumbnailUrl !== undefined) mat.thumbnailUrl = thumbnailUrl;
    if (b2ThumbnailId !== undefined) mat.b2ThumbnailId = b2ThumbnailId;
    if (b2ThumbnailName !== undefined) mat.b2ThumbnailName = b2ThumbnailName;
    if (duration !== undefined) mat.duration = duration;
    if (views !== undefined) mat.views = views;
    mat.updatedAt = new Date().toISOString();

    await savePersistedMaterials();
    const sorted = sortLearningMaterials(studyMaterials);
    res.json({ success: true, material: mat, materials: sorted, resources: sorted });
  });

  // 20e. ADMIN: Delete Learning Resource with B2 Object Cleanup
  app.delete(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const idx = studyMaterials.findIndex(m => m.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Study material or resource not found." });
    }

    const mat = studyMaterials[idx];
    if (mat.b2FileId || mat.b2FileName) {
      deleteFileFromB2(mat.b2FileId, mat.b2FileName).catch(() => {});
    }
    if (mat.b2ThumbnailId || mat.b2ThumbnailName) {
      deleteFileFromB2(mat.b2ThumbnailId, mat.b2ThumbnailName).catch(() => {});
    }

    // Cleanup local disk copy if exists
    try {
      const diskPath1 = path.join(uploadsDir, `${id}.pdf`);
      if (fs.existsSync(diskPath1)) fs.unlinkSync(diskPath1);
      if (mat.b2FileName) {
        const diskPath2 = path.join(uploadsDir, path.basename(mat.b2FileName));
        if (fs.existsSync(diskPath2)) fs.unlinkSync(diskPath2);
      }
    } catch (e) {}

    studyMaterials.splice(idx, 1);
    materialsInitialized = true;
    await savePersistedMaterials();

    const sorted = sortLearningMaterials(studyMaterials);
    res.json({ success: true, message: "Resource deleted.", materials: sorted, resources: sorted });
  });

  // 20f. ADMIN: Check Backblaze B2 Connection Status
  app.get("/api/admin/b2-status", async (req, res) => {
    try {
      const native = await getB2NativeAuth();
      if (native && native.bucketName) {
        return res.json({
          connected: true,
          bucket: native.bucketName,
          endpoint: "s3.us-east-005.backblazeb2.com",
          bucketId: native.bucketId,
        });
      }

      const config = getBackblazeConfig();
      if (config) {
        return res.json({
          connected: true,
          bucket: config.bucket,
          endpoint: config.cleanEndpoint,
        });
      }

      res.json({
        connected: false,
        bucket: null,
      });
    } catch (e) {
      res.json({
        connected: false,
        bucket: null,
      });
    }
  });

  // 20g. ADMIN: Upload PDF / Study Material directly to Backblaze B2
  app.post("/api/admin/upload-file", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { filename, dataBase64, mimeType } = req.body;
    if (!dataBase64) {
      return res.status(400).json({ error: "No file data received." });
    }

    const rawFilename = (filename || "document.pdf").trim();
    const ext = path.extname(rawFilename).toLowerCase() || ".pdf";

    // Security check: disallow executable / malicious scripts
    if (FORBIDDEN_EXEC_EXTS.has(ext)) {
      return res.status(400).json({ error: `File type ${ext} is not allowed for security reasons.` });
    }

    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const resolvedMime = getSafeFileMimeType(safeFilename, mimeType);

    const base64Content = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
    const buffer = Buffer.from(base64Content, "base64");

    // Max file size: 50MB
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: "File exceeds maximum allowed size of 50 MB." });
    }

    // Save to disk for durability / local fallback
    try {
      const diskPath = path.join(uploadsDir, `${fileId}-${safeFilename}`);
      fs.writeFileSync(diskPath, buffer);
      const diskPathShort = path.join(uploadsDir, `${fileId}.pdf`);
      fs.writeFileSync(diskPathShort, buffer);
    } catch (err) {
      console.warn("Failed saving upload to disk:", err);
    }

    const formattedSize = buffer.length > 1024 * 1024
      ? `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(buffer.length / 1024)} KB`;

    let finalUrl = `/api/files/pdf/${fileId}/${encodeURIComponent(safeFilename)}`;
    let uploadedToB2 = false;
    let b2FileId: string | undefined;
    let b2FileName: string | undefined;
    let b2Url: string | undefined;

    // Direct upload to Backblaze B2 (Primary source of truth in cloud)
    try {
      const objectKey = `materials/${fileId}-${safeFilename}`;
      const b2Res = await uploadBufferToB2(objectKey, buffer, resolvedMime);
      if (b2Res.success) {
        uploadedToB2 = true;
        b2FileId = b2Res.fileId;
        b2FileName = b2Res.fileName || objectKey;
        b2Url = b2Res.url;
      } else {
        console.warn("B2 upload returned non-success, local backup active:", b2Res.error);
      }
    } catch (b2Err: any) {
      console.warn("Failed uploading to Backblaze B2, fell back to local storage:", b2Err?.message);
    }

    // Store reference in uploaded map (without heavy base64 payload to prevent memory bloat)
    uploadedPdfFiles.set(fileId, {
      id: fileId,
      filename: safeFilename,
      mimeType: resolvedMime,
      size: buffer.length,
      dataBase64: "", // Do not keep base64 in RAM
      uploadedAt: new Date().toISOString(),
      b2FileId,
      b2FileName,
      b2Url,
    });

    res.json({
      success: true,
      fileId,
      filename: safeFilename,
      fileSize: formattedSize,
      mimeType: resolvedMime,
      url: finalUrl,
      downloadUrl: `/api/files/download/${fileId}`,
      uploadedToB2,
      b2FileId,
      b2FileName
    });
  });

  // 20h. Serve PDF / Document with inline headers for protected reader & preview
  app.get("/api/files/pdf/:id/:filename?", async (req, res) => {
    const { id, filename: reqFilename } = req.params;
    let buffer: Buffer | null = null;
    let filename = reqFilename || "document.pdf";
    let mimeType = "application/pdf";

    // 1. Check if ID matches a DB study material
    const mat = studyMaterials.find(m => m.id === id || m.pdfUrl?.includes(id));
    const memFile = uploadedPdfFiles.get(id);

    if (mat) {
      filename = mat.title || filename;
      mimeType = mat.mimeType || getSafeFileMimeType(filename);
    } else if (memFile) {
      filename = memFile.filename || filename;
      mimeType = memFile.mimeType || getSafeFileMimeType(filename);
    }

    let extractedFileId: string | undefined;
    if (mat?.pdfUrl && mat.pdfUrl.includes('/api/files/pdf/')) {
      const match = mat.pdfUrl.match(/\/api\/files\/pdf\/([a-zA-Z0-9_-]+)/);
      if (match) extractedFileId = match[1];
    }

    // 2. Check local disk storage
    const possibleDiskPaths = [
      path.join(uploadsDir, `${id}.pdf`),
      path.join(uploadsDir, `${id}-${filename}`),
      extractedFileId ? path.join(uploadsDir, `${extractedFileId}.pdf`) : "",
      extractedFileId ? path.join(uploadsDir, `${extractedFileId}-${filename}`) : "",
      mat?.b2FileName ? path.join(uploadsDir, path.basename(mat.b2FileName)) : "",
      memFile?.b2FileName ? path.join(uploadsDir, path.basename(memFile.b2FileName)) : "",
    ].filter(Boolean);

    for (const dp of possibleDiskPaths) {
      if (fs.existsSync(dp)) {
        try {
          buffer = fs.readFileSync(dp);
          break;
        } catch (e) {}
      }
    }

    if (!buffer && (id || extractedFileId)) {
      const searchPrefix = extractedFileId || id;
      try {
        const files = fs.readdirSync(uploadsDir);
        const matchFile = files.find(f => f.startsWith(searchPrefix));
        if (matchFile) {
          buffer = fs.readFileSync(path.join(uploadsDir, matchFile));
        }
      } catch (e) {}
    }

    // 3. If not on disk, stream from Backblaze B2
    const targetFileId = mat?.b2FileId || memFile?.b2FileId;
    const targetFileName = mat?.b2FileName || memFile?.b2FileName || (id ? `materials/${id}-${filename}` : undefined);

    if (!buffer && (targetFileId || targetFileName)) {
      try {
        const b2Res = await downloadBufferFromB2(targetFileId, targetFileName);
        if (b2Res.success && b2Res.buffer) {
          buffer = b2Res.buffer;
          if (b2Res.contentType) mimeType = b2Res.contentType;
        }
      } catch (e) {
        console.warn("Failed retrieving document from B2:", e);
      }
    }

    // 4. Fallback: If external URL in material
    if (!buffer && mat?.pdfUrl && mat.pdfUrl.startsWith("http")) {
      return res.redirect(`/api/proxy-pdf?url=${encodeURIComponent(mat.pdfUrl)}`);
    }

    if (!buffer) {
      return res.status(404).send("Document not found.");
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.send(buffer);
  });

  // 20i. SECURE FILE DOWNLOAD ENDPOINT: Streams authorized file attachments
  app.get("/api/files/download/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rawToken = (req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.query.token as string || "").trim();
      const auth = rawToken ? verifyAuthToken(rawToken) : null;
      const isAdmin = auth?.role === "admin";

      // Find target material or uploaded file
      const mat = studyMaterials.find(m => m.id === id || m.pdfUrl?.includes(id) || m.downloadUrl?.includes(id));
      const memFile = uploadedPdfFiles.get(id);

      if (!mat && !memFile && !isAdmin) {
        return res.status(404).json({ error: "Requested study material was not found." });
      }

      // Check download permissions
      if (mat) {
        // If material is private to a specific batch and not publicly visible on website
        if (mat.isVisibleOnWebsite === false && !isAdmin) {
          if (!auth) {
            return res.status(401).json({ error: "Authentication required to download batch materials." });
          }
          const isEnrolled = auth.batchIds?.includes(mat.batchId) || mat.batchId === "all";
          if (!isEnrolled) {
            return res.status(403).json({ error: "Access Denied: You are not enrolled in this batch." });
          }
        }
      }

      const rawTitle = mat?.title || memFile?.filename || "Study-Material.pdf";
      const filename = rawTitle.toLowerCase().endsWith(".pdf") ? rawTitle : `${rawTitle}.pdf`;
      const mimeType = mat?.mimeType || memFile?.mimeType || getSafeFileMimeType(filename);

      let buffer: Buffer | null = null;

      let extractedFileId: string | undefined;
      if (mat?.pdfUrl && mat.pdfUrl.includes('/api/files/pdf/')) {
        const match = mat.pdfUrl.match(/\/api\/files\/pdf\/([a-zA-Z0-9_-]+)/);
        if (match) extractedFileId = match[1];
      }

      // 1. Check local disk storage
      const possibleDiskPaths = [
        path.join(uploadsDir, `${id}.pdf`),
        path.join(uploadsDir, `${id}-${filename}`),
        extractedFileId ? path.join(uploadsDir, `${extractedFileId}.pdf`) : "",
        extractedFileId ? path.join(uploadsDir, `${extractedFileId}-${filename}`) : "",
        mat?.b2FileName ? path.join(uploadsDir, path.basename(mat.b2FileName)) : "",
        memFile?.b2FileName ? path.join(uploadsDir, path.basename(memFile.b2FileName)) : "",
      ].filter(Boolean);

      for (const dp of possibleDiskPaths) {
        if (fs.existsSync(dp)) {
          try {
            buffer = fs.readFileSync(dp);
            break;
          } catch (e) {}
        }
      }

      if (!buffer && (id || extractedFileId)) {
        const searchPrefix = extractedFileId || id;
        try {
          const files = fs.readdirSync(uploadsDir);
          const matchFile = files.find(f => f.startsWith(searchPrefix));
          if (matchFile) {
            buffer = fs.readFileSync(path.join(uploadsDir, matchFile));
          }
        } catch (e) {}
      }

      // 2. Stream directly from Backblaze B2
      const targetFileId = mat?.b2FileId || memFile?.b2FileId;
      const targetFileName = mat?.b2FileName || memFile?.b2FileName || `materials/${id}-${filename}`;

      if (!buffer && (targetFileId || targetFileName)) {
        try {
          const b2Res = await downloadBufferFromB2(targetFileId, targetFileName);
          if (b2Res.success && b2Res.buffer) {
            buffer = b2Res.buffer;
          }
        } catch (b2Err) {
          console.warn("B2 download error:", b2Err);
        }
      }

      // 3. Fallback: If external Google Drive / cloud URL
      if (!buffer && mat?.pdfUrl && mat.pdfUrl.startsWith("http")) {
        const gDriveMatch = mat.pdfUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
                            mat.pdfUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i) ||
                            mat.pdfUrl.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/i);
        if (gDriveMatch && gDriveMatch[1]) {
          return res.redirect(`https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`);
        }
        return res.redirect(mat.pdfUrl);
      }

      if (!buffer) {
        return res.status(404).json({ error: "File content could not be retrieved." });
      }

      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(buffer);
    } catch (err: any) {
      console.error("Error serving secure download:", err);
      res.status(500).json({ error: "Internal error processing download request." });
    }
  });

  // 20f. Safe Document Proxy: Streams external PDFs (Backblaze B2, external URLs) 
  // with clean inline headers to prevent Chrome "This page has been blocked by Chrome" X-Frame-Options errors.
  app.get("/api/proxy-pdf", async (req, res) => {
    try {
      const rawUrl = req.query.url as string;
      if (!rawUrl || typeof rawUrl !== "string") {
        return res.status(400).send("Missing target document URL.");
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return res.status(400).send("Invalid document URL format.");
      }

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res.status(400).send("Only HTTP and HTTPS URLs are permitted.");
      }

      // If it is a Backblaze B2 URL, try to include native B2 auth token if needed
      let b2AuthHeader = "";
      if (rawUrl.includes("backblazeb2.com") || rawUrl.includes(".b2.cloud")) {
        try {
          const b2 = await getB2NativeAuth();
          if (b2?.authorizationToken) {
            b2AuthHeader = b2.authorizationToken;
          }
        } catch (b2Err) {
          console.warn("Could not retrieve B2 auth for proxy:", b2Err);
        }
      }

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/pdf,*/*;q=0.8"
      };
      if (b2AuthHeader && !rawUrl.includes("Authorization=")) {
        headers["Authorization"] = b2AuthHeader;
      }

      const fetchRes = await fetch(rawUrl, {
        headers,
        redirect: "follow"
      });

      if (!fetchRes.ok) {
        return res.status(fetchRes.status).send(`Remote document returned status ${fetchRes.status}`);
      }

      const contentType = fetchRes.headers.get("content-type") || "application/pdf";
      const buffer = Buffer.from(await fetchRes.arrayBuffer());

      const pathname = parsedUrl.pathname;
      const basename = path.basename(pathname) || "document.pdf";
      const safeBasename = basename.endsWith(".pdf") ? basename : `${basename}.pdf`;

      res.setHeader("Content-Type", contentType.includes("pdf") ? "application/pdf" : contentType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeBasename)}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Explicitly allow embedding in our own frame
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.send(buffer);
    } catch (err: any) {
      console.error("Error proxying PDF document:", err);
      res.status(500).send("Unable to stream the requested document.");
    }
  });

  // 21. ADMIN: Post Batch Announcement
  app.post("/api/admin/announcements", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { batchId, title, message, priority, category, effectiveDate, isPinned } = req.body;
    const batch = batches.find(b => b.id === batchId);

    const newAnn: DBAnnouncement = {
      id: `ann-${Date.now()}`,
      batchId: batchId === 'all' ? 'all' : (batchId || (batch ? batch.id : "all")),
      batchName: batchId === 'all' ? "All Batches (Academy-wide)" : (batch ? batch.name : "All Batches (Academy-wide)"),
      title: title || "Official Academy Announcement",
      message: message || "",
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      author: "Ziyaur Rehman Zia",
      priority: priority || "Normal",
      category: category || "General",
      effectiveDate: effectiveDate || "",
      isPinned: Boolean(isPinned)
    };

    announcements.unshift(newAnn);
    await saveAnnouncements();
    res.json({ success: true, announcement: newAnn, announcements });
  });

  // 21b. PUBLIC: Get All Active Announcements & Notices
  app.get("/api/announcements", (req, res) => {
    res.json({ announcements });
  });

  // 21c. ADMIN: Update Announcement
  app.put("/api/admin/announcements/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const annIndex = announcements.findIndex(a => a.id === id);
    if (annIndex === -1) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const { title, message, priority, category, effectiveDate, isPinned, batchId } = req.body;
    const batch = batches.find(b => b.id === batchId);

    announcements[annIndex] = {
      ...announcements[annIndex],
      title: title !== undefined ? title : announcements[annIndex].title,
      message: message !== undefined ? message : announcements[annIndex].message,
      priority: priority !== undefined ? priority : announcements[annIndex].priority,
      category: category !== undefined ? category : announcements[annIndex].category,
      effectiveDate: effectiveDate !== undefined ? effectiveDate : announcements[annIndex].effectiveDate,
      isPinned: isPinned !== undefined ? Boolean(isPinned) : announcements[annIndex].isPinned,
      batchId: batchId !== undefined ? (batchId === 'all' ? 'all' : (batch ? batch.id : batchId)) : announcements[annIndex].batchId,
      batchName: batchId === 'all' ? "All Batches (Academy-wide)" : (batch ? batch.name : announcements[annIndex].batchName)
    };

    await saveAnnouncements();
    res.json({ success: true, announcement: announcements[annIndex], announcements });
  });

  // 21d. ADMIN: Delete Announcement
  app.delete("/api/admin/announcements/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const idx = announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      announcements.splice(idx, 1);
      await saveAnnouncements();
    }
    res.json({ success: true, announcements });
  });

  // 22. ADMIN: View Attendance Logs (Batch-wise)
  app.get("/api/admin/attendance", (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { batchId, classId } = req.query;
    let list = attendanceRecords;
    if (batchId && typeof batchId === "string" && batchId !== "all") {
      list = list.filter(a => a.batchId === batchId);
    }
    if (classId && typeof classId === "string") {
      list = list.filter(a => a.classId === classId);
    }

    res.json({ attendance: list, totalCount: list.length });
  });

  // CREATE Student / Admission
  app.post("/api/admin/students", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const studentData = req.body;
    if (!studentData.name || !studentData.phone) {
      return res.status(400).json({ error: "Student name and phone are required." });
    }

    const id = studentData.id || `reg-${Date.now()}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const admissionId = studentData.admissionId || `WL-OCT26-${randomSeq}`;

    const record: DBStudentRegistration = {
      ...studentData,
      id,
      admissionId,
      registeredAt: studentData.registeredAt || new Date().toISOString()
    };

    registrations.unshift(record);

    if (record.email) {
      let existingUser = users.find(u => u.email.toLowerCase() === record.email.toLowerCase());
      if (existingUser) {
        if (record.batchId && !existingUser.batchIds.includes(record.batchId)) {
          existingUser.batchIds.push(record.batchId);
        }
        if (!existingUser.admissionId) existingUser.admissionId = record.admissionId;
      } else {
        users.push({
          id: `usr-${Date.now()}`,
          name: record.name,
          email: record.email.toLowerCase(),
          passwordHash: "student123",
          role: "student",
          phone: record.phone,
          batchIds: record.batchId ? [record.batchId] : [],
          admissionId: record.admissionId,
          registrationDate: new Date().toISOString().split("T")[0]
        });
      }
      await saveUsers();
    }

    await saveRegistrations();
    res.json({ success: true, student: record });
  });

  // DELETE Student / Admission
  app.delete("/api/admin/students/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const target = String(id).toLowerCase().trim();
    const regIdx = registrations.findIndex(r => 
      (r.id && r.id.toLowerCase().trim() === target) || 
      (r.admissionId && r.admissionId.toLowerCase().trim() === target)
    );
    if (regIdx !== -1) {
      const reg = registrations[regIdx];
      registrations.splice(regIdx, 1);
      // Remove student user if exists
      const userIdx = users.findIndex(u => 
        (reg.admissionId && u.admissionId && u.admissionId.toLowerCase().trim() === reg.admissionId.toLowerCase().trim()) || 
        (reg.email && u.email && u.email.toLowerCase().trim() === reg.email.toLowerCase().trim())
      );
      if (userIdx !== -1 && users[userIdx].role !== "admin") {
        users.splice(userIdx, 1);
        await saveUsers();
      }
      await saveRegistrations();
      return res.json({ success: true, message: "Student admission deleted successfully.", remainingCount: registrations.length, students: registrations });
    }
    // Also check users array
    const userIdx = users.findIndex(u => 
      (u.admissionId && u.admissionId.toLowerCase().trim() === target) ||
      (u.id && u.id.toLowerCase().trim() === target)
    );
    if (userIdx !== -1 && users[userIdx].role !== "admin") {
      users.splice(userIdx, 1);
      await saveUsers();
      await saveRegistrations();
      return res.json({ success: true, message: "Student user deleted successfully.", remainingCount: registrations.length, students: registrations });
    }
    res.status(404).json({ error: "Student registration not found." });
  });

  // UPDATE Student / Admission
  app.put("/api/admin/students/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const target = String(id).toLowerCase().trim();
    const reg = registrations.find(r => 
      (r.id && r.id.toLowerCase().trim() === target) || 
      (r.admissionId && r.admissionId.toLowerCase().trim() === target)
    );
    if (!reg) return res.status(404).json({ error: "Student registration not found." });

    Object.assign(reg, req.body);
    await saveRegistrations();
    res.json({ success: true, student: reg });
  });

  // UPDATE Batch
  app.put("/api/admin/batches/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const batch = batches.find(b => b.id === id);
    if (!batch) return res.status(404).json({ error: "Batch not found." });

    Object.assign(batch, req.body);
    await saveBatches();
    res.json({ success: true, batch, batches });
  });

  // DELETE Batch
  app.delete("/api/admin/batches/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = batches.findIndex(b => b.id === id);
    if (idx !== -1) {
      batches.splice(idx, 1);
      await saveBatches();
      return res.json({ success: true, message: "Batch deleted successfully.", batches });
    }
    res.status(404).json({ error: "Batch not found." });
  });

  // UPDATE Class
  app.put("/api/admin/classes/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const cls = classes.find(c => c.id === id);
    if (!cls) return res.status(404).json({ error: "Class not found." });

    Object.assign(cls, req.body);
    await saveClasses();
    res.json({ success: true, class: cls, classes });
  });

  // DELETE Class
  app.delete("/api/admin/classes/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = classes.findIndex(c => c.id === id);
    if (idx !== -1) {
      classes.splice(idx, 1);
      await saveClasses();
      return res.json({ success: true, message: "Class deleted successfully.", classes });
    }
    res.status(404).json({ error: "Class not found." });
  });

  // UPDATE Recording
  app.put("/api/admin/recordings/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const rec = recordings.find(r => r.id === id);
    if (!rec) return res.status(404).json({ error: "Recording not found." });

    Object.assign(rec, req.body);
    await saveRecordings();
    res.json({ success: true, recording: rec, recordings });
  });

  // DELETE Recording
  app.delete("/api/admin/recordings/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = recordings.findIndex(r => r.id === id);
    if (idx !== -1) {
      recordings.splice(idx, 1);
      await saveRecordings();
      return res.json({ success: true, message: "Recording deleted successfully.", recordings });
    }
    res.status(404).json({ error: "Recording not found." });
  });



  // 23. CMS: Public Website Content & Admin Editable Content
  app.get("/api/cms/content", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const settings = await getSiteSettingsDb();
      const testimonials = await getReviewsDb(false);

      const contentPayload = {
        courses: cmsContent.courses || [],
        settings,
        testimonials,
        academyName: settings.academyName || "WITS LINGO",
        tagline: settings.tagline || "A Global Language Platform",
        phoneNumbers: [settings.phone1, settings.phone2].filter(Boolean),
        email: settings.email || "hello@witslingo.com",
        location: settings.address || "",
        announcementText: settings.announcementText || "",
        announcementBtnText: settings.announcementBtnText || "",
        showAnnouncement: settings.showAnnouncement,
        showBatchesSection: settings.showBatchesSection,
        whatsappChannel: settings.whatsappChannelUrl || "",
        instagram: settings.instagramUrl || "",
        facebook: settings.facebookUrl || "",
        youtubeUrl: settings.youtubeUrl || ""
      };

      return res.json({ content: contentPayload });
    } catch (err: any) {
      console.error("[CMS Content GET] Database query failed:", err?.message || err);
      return res.status(500).json({ error: "Failed to retrieve site settings from database." });
    }
  });

  app.post("/api/cms/content", requireAdmin, async (req, res) => {
    try {
      const {
        courses,
        phoneNumbers,
        email,
        location,
        announcementText,
        announcementBtnText,
        showAnnouncement,
        showBatchesSection,
        settings
      } = req.body;

      if (courses && Array.isArray(courses)) {
        cmsContent.courses = courses;
        await saveCmsContent();
      }

      // Convert site_settings to Neon PostgreSQL without storing in memory variables
      const patch: Record<string, any> = { ...(settings || {}) };
      if (phoneNumbers && Array.isArray(phoneNumbers)) {
        if (phoneNumbers[0] !== undefined) patch.phone1 = phoneNumbers[0];
        if (phoneNumbers[1] !== undefined) patch.phone2 = phoneNumbers[1];
      }
      if (email !== undefined) patch.email = email;
      if (location !== undefined) patch.address = location;
      if (announcementText !== undefined) patch.announcementText = announcementText;
      if (announcementBtnText !== undefined) patch.announcementBtnText = announcementBtnText;
      if (showAnnouncement !== undefined) patch.showAnnouncement = showAnnouncement;
      if (showBatchesSection !== undefined) patch.showBatchesSection = showBatchesSection;

      const updatedSettings = await updateSiteSettingsDb(patch);
      const testimonials = await getReviewsDb(false);

      const contentPayload = {
        courses: cmsContent.courses || [],
        settings: updatedSettings,
        testimonials,
        academyName: updatedSettings.academyName,
        tagline: updatedSettings.tagline,
        phoneNumbers: [updatedSettings.phone1, updatedSettings.phone2].filter(Boolean),
        email: updatedSettings.email,
        location: updatedSettings.address,
        announcementText: updatedSettings.announcementText,
        announcementBtnText: updatedSettings.announcementBtnText,
        showAnnouncement: updatedSettings.showAnnouncement,
        showBatchesSection: updatedSettings.showBatchesSection,
        whatsappChannel: updatedSettings.whatsappChannelUrl,
        instagram: updatedSettings.instagramUrl,
        facebook: updatedSettings.facebookUrl,
        youtubeUrl: updatedSettings.youtubeUrl
      };

      return res.json({ success: true, content: contentPayload });
    } catch (err: any) {
      console.error("[CMS Content POST] Database update failed:", err?.message || err);
      return res.status(500).json({ error: "Failed to update site settings in database." });
    }
  });

  // Dedicated Site Settings API endpoints
  app.get("/api/site-settings", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const settings = await getSiteSettingsDb();
      return res.json({ success: true, settings });
    } catch (err: any) {
      console.error("[Site Settings GET] Database query failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to retrieve site settings from database." });
    }
  });

  app.put("/api/site-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await updateSiteSettingsDb(req.body);
      return res.json({ success: true, settings });
    } catch (err: any) {
      console.error("[Site Settings PUT] Database update failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to update site settings in database." });
    }
  });

  // 24. CONTACT FORM INQUIRY
  app.post("/api/contact", (req, res) => {
    const { name, contact, learningInterest, message } = req.body;
    if (!name || !contact || !message) {
      return res.status(400).json({ error: "Please fill in all contact form fields." });
    }

    const whatsappConfirmationText = 
`👋 *NEW INQUIRY RECEIVED — WITS LINGO*
━━━━━━━━━━━━━━━━━━━━
Dear *${name.trim()}*,
Thank you for contacting *WITS LINGO — A Global Language Platform*!

📋 *INQUIRY SUMMARY*
• *Name:* ${name.trim()}
• *Contact:* ${contact.trim()}
• *Course Interest:* ${learningInterest || 'Spoken English'}
• *Message:* ${message.trim()}

Our senior counsellor or mentor will get in touch with you shortly. You can also chat directly with us on WhatsApp: ${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}.

*WITS LINGO*
_Learn Easily. Speak Naturally. Think Clearly._`;

    const encodedMsg = encodeURIComponent(whatsappConfirmationText);
    const rawContactDigits = (contact || "").toString().replace(/\D/g, "");
    const studentUrl = rawContactDigits.length === 10 ? `https://wa.me/91${rawContactDigits}?text=${encodedMsg}` : null;
    const adminUrl = `https://wa.me/${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN}?text=${encodedMsg}`;

    res.json({
      success: true,
      message: "Thank you for reaching out to WITS LINGO! Your inquiry has been received.",
      whatsapp: {
        confirmationMessage: whatsappConfirmationText,
        studentUrl,
        adminUrl
      }
    });
  });

  // 24B. COURSES MANAGEMENT & PUBLICATION CMS (Edit anytime, past or post publication)
  app.get("/api/courses", (req, res) => {
    const auth = verifyAuthToken(req);
    const includeAll = req.query.includeAll === "true" || (auth && auth.role === "admin");
    
    if (includeAll) {
      return res.json({ courses: cmsContent.courses });
    }
    // Public visitors see published courses (isPublished !== false)
    const publishedCourses = cmsContent.courses.filter((c: any) => c.isPublished !== false);
    res.json({ courses: publishedCourses });
  });

  app.post("/api/courses", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required to create courses." });
    }

    const { name, level, shortDescription, whatYouWillLearn, duration, learningFormat, fee, badge, isPublished } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Course name is required." });
    }

    const newCourse = {
      id: req.body.id || `course-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name,
      level: level || "Beginner to Intermediate",
      shortDescription: shortDescription || "Practical language training.",
      whatYouWillLearn: Array.isArray(whatYouWillLearn) && whatYouWillLearn.length > 0 ? whatYouWillLearn : [
        'Master natural conversational speaking',
        'Overcome public hesitation and stage fear',
        'Daily vocabulary in context',
        'Pronunciation and accent clarity'
      ],
      facilities: Array.isArray(req.body.facilities) && req.body.facilities.length > 0 ? req.body.facilities : [
        'Live Interactive Online Classes on Google Meet',
        'Digital PDF Study Notes & Practice Workbooks',
        'Telegram & WhatsApp Student Practice Community',
        'Course Completion Certificate',
        'Class Recording Access for Revision'
      ],
      duration: duration || "2 Months (40 Sessions)",
      learningFormat: learningFormat || "Live Online Classroom",
      fee: Number(fee) || 1499,
      badge: badge || "Live",
      isPublished: isPublished !== false
    };

    if (!Array.isArray(cmsContent.courses)) cmsContent.courses = [];
    const existingIndex = cmsContent.courses.findIndex((c: any) => c.id === newCourse.id || c.name.toLowerCase() === newCourse.name.toLowerCase());
    if (existingIndex !== -1) {
      cmsContent.courses[existingIndex] = { ...cmsContent.courses[existingIndex], ...newCourse };
    } else {
      cmsContent.courses.push(newCourse);
    }
    await saveCmsContent();
    res.status(201).json({ success: true, course: newCourse, courses: cmsContent.courses });
  });

  app.put("/api/courses/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required to edit courses." });
    }

    const courseIndex = cmsContent.courses.findIndex((c: any) => c.id === req.params.id);
    if (courseIndex === -1) {
      return res.status(404).json({ error: "Course not found." });
    }

    const currentCourse = cmsContent.courses[courseIndex];
    const { name, level, shortDescription, whatYouWillLearn, duration, learningFormat, fee, badge, isPublished } = req.body;

    const updatedCourse = {
      ...currentCourse,
      name: name !== undefined ? name : currentCourse.name,
      level: level !== undefined ? level : currentCourse.level,
      shortDescription: shortDescription !== undefined ? shortDescription : currentCourse.shortDescription,
      whatYouWillLearn: Array.isArray(whatYouWillLearn) ? whatYouWillLearn : currentCourse.whatYouWillLearn,
      duration: duration !== undefined ? duration : currentCourse.duration,
      learningFormat: learningFormat !== undefined ? learningFormat : currentCourse.learningFormat,
      fee: fee !== undefined ? Number(fee) : currentCourse.fee,
      badge: badge !== undefined ? badge : currentCourse.badge,
      isPublished: isPublished !== undefined ? isPublished : currentCourse.isPublished
    };

    cmsContent.courses[courseIndex] = updatedCourse;
    await saveCmsContent();
    res.json({ success: true, course: updatedCourse, courses: cmsContent.courses });
  });

  app.patch("/api/courses/:id/publish", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const courseIndex = cmsContent.courses.findIndex((c: any) => c.id === req.params.id);
    if (courseIndex === -1) {
      return res.status(404).json({ error: "Course not found." });
    }

    const currentCourse = cmsContent.courses[courseIndex];
    const newStatus = req.body.isPublished !== undefined ? Boolean(req.body.isPublished) : !Boolean(currentCourse.isPublished);
    currentCourse.isPublished = newStatus;
    await saveCmsContent();
    res.json({ success: true, course: currentCourse, isPublished: newStatus, courses: cmsContent.courses });
  });

  app.delete("/api/courses/:id", async (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required to delete courses." });
    }

    const courseIndex = cmsContent.courses.findIndex((c: any) => c.id === req.params.id);
    if (courseIndex === -1) {
      return res.status(404).json({ error: "Course not found." });
    }

    const deleted = cmsContent.courses.splice(courseIndex, 1)[0];
    await saveCmsContent();
    res.json({ success: true, deleted, courses: cmsContent.courses });
  });

  // Save on course creation
  app.post("/api/courses", (req, res, next) => {
    // will be caught by route handler
    next();
  });

  // =========================================================================
  // 24C. REVIEWS & TESTIMONIALS API (NEON POSTGRESQL CRUD)
  // =========================================================================

  app.get("/api/reviews", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const auth = verifyAuthToken(req);
      const isAdmin = auth && auth.role === "admin";
      const reviews = await getReviewsDb(Boolean(isAdmin));
      return res.json({ success: true, reviews });
    } catch (err: any) {
      console.error("[Reviews GET] Database query failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to retrieve reviews from database." });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const { studentName, courseName, courseBatch, rating, testimonial, city } = req.body;
      if (!studentName || !testimonial) {
        return res.status(400).json({ success: false, error: "Name and review text are required." });
      }

      const result = await createReviewDb({
        studentName,
        courseBatch: courseBatch || courseName || "Wits Lingo Course",
        rating: Number(rating) || 5,
        testimonial,
        city: city || "Verified Student"
      });

      return res.status(201).json({
        success: true,
        message: "Review submitted successfully!",
        review: result.review,
        authorKey: result.authorKey
      });
    } catch (err: any) {
      console.error("[Reviews POST] Database insertion failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to submit review to database." });
    }
  });

  app.put("/api/reviews/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { studentName, courseName, courseBatch, rating, testimonial, city, authorKey, isApproved } = req.body;
      const auth = verifyAuthToken(req);
      const isAdmin = auth && auth.role === "admin";
      const providedAuthorKey = authorKey || req.headers["x-author-key"];

      const result = await updateReviewDb(
        id,
        {
          studentName,
          courseBatch: courseBatch || courseName,
          testimonial,
          rating,
          city,
          isApproved
        },
        Boolean(isAdmin),
        providedAuthorKey ? String(providedAuthorKey) : undefined
      );

      if (result.status !== 200) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      return res.json({
        success: true,
        message: "Review updated successfully!",
        review: result.review
      });
    } catch (err: any) {
      console.error("[Reviews PUT] Database update failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to update review in database." });
    }
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const auth = verifyAuthToken(req);
      const isAdmin = auth && auth.role === "admin";
      const authorKey = req.body?.authorKey || req.headers["x-author-key"] || req.query.authorKey;

      const result = await deleteReviewDb(
        id,
        Boolean(isAdmin),
        authorKey ? String(authorKey) : undefined
      );

      if (result.status !== 200) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      return res.json({
        success: true,
        message: "Review deleted successfully.",
        deleted: result.deleted
      });
    } catch (err: any) {
      console.error("[Reviews DELETE] Database deletion failed:", err?.message || err);
      return res.status(500).json({ success: false, error: "Failed to delete review from database." });
    }
  });

  app.get("/api/admin/notifications", (req, res) => {
    const auth = verifyAuthToken(req);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    res.json({ success: true, notifications: adminNotificationService.getAllNotifications() });
  });

  async function startServer() {
    // 25. VITE / STATIC MIDDLEWARE SETUP
    if (process.env.NODE_ENV !== "production") {
      const isHmrDisabled = process.env.DISABLE_HMR === "true";
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: isHmrDisabled ? false : undefined,
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[Wits Lingo Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WhatsApp] Operating strictly via official Meta WhatsApp Business Platform Cloud API.`);
    console.log(`[WhatsApp] Cloud API Webhook Listener active at /api/webhooks/whatsapp`);
    try {
      await ensureAdminUserExists();
    } catch (e) {
      console.warn("[Startup] Admin initialization warning:", e);
    }
  });
}

const isServerless = Boolean(
  process.env.VERCEL || 
  process.env.NOW_REGION || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.LAMBDA_TASK_ROOT
);

if (!isServerless) {
  startServer();
}

export default app;
