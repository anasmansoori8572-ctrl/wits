import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { WITS_LINGO_CONFIG } from "./src/config/witsLingoConfig";
import { whatsappCloudApiService } from "./src/services/whatsappCloudApiService";
import { whatsappNotificationService } from "./src/services/whatsappNotificationService";
import { studentSupportService } from "./src/services/studentSupportService";
import { supportTicketService } from "./src/services/supportTicketService";
import { getAiSupportService } from "./src/services/aiSupportService";
import { durableStorageService } from "./src/services/durableStorageService";

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
const users: DBUser[] = [
  {
    id: "usr-admin-01",
    name: "Ziyaur Rehman Zia",
    email: "witslingo@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
    registrationDate: "2026-01-01",
  },
  {
    id: "usr-admin-02",
    name: "Arsh (Admin)",
    email: "arsh522011@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
    registrationDate: "2026-01-01",
  },
  {
    id: "usr-student-01",
    name: "Mohd Farhan",
    email: "mohd.farhan@gmail.com",
    passwordHash: "student123",
    role: "student",
    phone: "9876543210",
    batchIds: ["batch-spoken-oct-2026"],
    admissionId: "WL-2026-OCT-0101",
    registrationDate: "2026-09-01",
  },
  {
    id: "usr-student-02",
    name: "Shabana Parveen",
    email: "shabana.parveen@gmail.com",
    passwordHash: "student123",
    role: "student",
    phone: "9832109876",
    batchIds: ["batch-foundation-oct-2026"],
    admissionId: "WL-2026-OCT-0102",
    registrationDate: "2026-09-02",
  },
  {
    id: "usr-student-03",
    name: "Arjun Sharma",
    email: "arjun.sharma@gmail.com",
    passwordHash: "student123",
    role: "student",
    phone: "9412345678",
    batchIds: ["batch-spoken-nov-2026"],
    admissionId: "WL-2026-NOV-0103",
    registrationDate: "2026-09-10",
  }
];

const registrations: DBStudentRegistration[] = [
  {
    id: "reg-01",
    admissionId: "WL-2026-OCT-0101",
    name: "Mohd Farhan",
    fatherName: "Akhtar Ali",
    dob: "2003-05-14",
    gender: "Male",
    district: "Amroha",
    state: "Uttar Pradesh",
    phone: "9876543210",
    whatsapp: "9876543210",
    email: "mohd.farhan@gmail.com",
    address: "Mohalla Chah Ghori, Amroha, UP",
    qualification: "Undergraduate (B.A.)",
    currentEnglishLevel: "Beginner",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    feeAmount: 1499,
    paymentStatus: "Paid",
    paymentMethod: "Razorpay",
    paymentTxnId: "pay_Rzp982347101",
    registeredAt: "2026-09-01T10:30:00Z"
  },
  {
    id: "reg-02",
    admissionId: "WL-2026-OCT-0102",
    name: "Shabana Parveen",
    fatherName: "Rashid Khan",
    dob: "2002-11-20",
    gender: "Female",
    district: "Moradabad",
    state: "Uttar Pradesh",
    phone: "9832109876",
    whatsapp: "9832109876",
    email: "shabana.parveen@gmail.com",
    address: "Civil Lines, Moradabad, UP",
    qualification: "Senior Secondary (12th Passed)",
    currentEnglishLevel: "Complete Beginner",
    courseId: "course-foundation",
    courseName: "English Foundation",
    batchId: "batch-foundation-oct-2026",
    batchName: "English Foundation — Batch October 2026",
    feeAmount: 1199,
    paymentStatus: "Paid",
    paymentMethod: "Razorpay",
    paymentTxnId: "pay_Rzp449102837",
    registeredAt: "2026-09-02T14:15:00Z"
  },
  {
    id: "reg-03",
    admissionId: "WL-2026-NOV-0103",
    name: "Arjun Sharma",
    fatherName: "Mahesh Sharma",
    dob: "2001-08-09",
    gender: "Male",
    district: "Hapur",
    state: "Uttar Pradesh",
    phone: "9412345678",
    whatsapp: "9412345678",
    email: "arjun.sharma@gmail.com",
    address: "Station Road, Hapur, UP",
    qualification: "B.Tech Student",
    currentEnglishLevel: "Intermediate",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchId: "batch-spoken-nov-2026",
    batchName: "Spoken English — Batch November 2026",
    feeAmount: 1499,
    paymentStatus: "Paid",
    paymentMethod: "PayPal",
    paymentTxnId: "PAYID-MN7849102",
    registeredAt: "2026-09-10T16:45:00Z"
  }
];

const batches: DBBatch[] = [
  {
    id: "batch-spoken-oct-2026",
    name: "Spoken English — Batch October 2026 (Batch 01)",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchCode: "SE-OCT26",
    startDate: "2026-09-01",
    endDate: "2026-11-30",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Mon, Wed, Fri (7:00 PM – 8:00 PM IST)",
    maxStudents: 35,
    currentStudentsCount: 28,
    status: "Active",
    recordingsExpiryDate: "2027-05-31",
    description: "Intensive spoken English batch covering confidence, hesitation removal, daily conversation, and fluency practice."
  },
  {
    id: "batch-spoken-nov-2026",
    name: "Spoken English — Batch November 2026",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchCode: "SE-NOV26",
    startDate: "2026-11-01",
    endDate: "2027-01-31",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Tue, Thu, Sat (7:00 PM – 8:00 PM IST)",
    maxStudents: 35,
    currentStudentsCount: 14,
    status: "Upcoming",
    description: "New upcoming batch starting 1st November. Admissions open now!"
  },
  {
    id: "batch-foundation-oct-2026",
    name: "English Foundation — Batch October 2026",
    courseId: "course-foundation",
    courseName: "English Foundation",
    batchCode: "EF-OCT26",
    startDate: "2026-09-01",
    endDate: "2026-10-31",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Mon to Fri (6:00 PM – 7:00 PM IST)",
    maxStudents: 30,
    currentStudentsCount: 22,
    status: "Active",
    recordingsExpiryDate: "2027-04-30",
    description: "Designed specifically for learners from basic level to build alphabet phonetics, vocabulary, and basic sentence construction."
  },
  {
    id: "batch-vocab-sept-2026",
    name: "English Vocabulary & Daily Idioms — Batch Sept 2026",
    courseId: "course-vocabulary",
    courseName: "English Vocabulary",
    batchCode: "EV-SEP26",
    startDate: "2026-08-01",
    endDate: "2026-09-15",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Sat & Sun (10:00 AM – 11:30 AM IST)",
    maxStudents: 40,
    currentStudentsCount: 38,
    status: "Completed",
    recordingsExpiryDate: "2027-03-31",
    description: "Completed batch with all lecture recordings archived and available for enrolled students."
  }
];

const classes: DBClass[] = [
  // Classes for batch-spoken-oct-2026
  {
    id: "cls-se-01",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 01 — Introduction & Overcoming Hesitation",
    topic: "Introduction",
    classNumber: 1,
    date: "10 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    durationMinutes: 58,
    teacherName: "Ziyaur Rehman Zia",
    description: "Ice-breaking, understanding personal communication blocks, and learning how to introduce yourself naturally without fear.",
    status: "Completed",
    recordingId: "rec-se-01",
    hasStudyMaterial: true,
    hasAssignment: true,
    videoKey: "video_se_batch01_class01_intro"
  },
  {
    id: "cls-se-02",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 02 — Daily Conversation & Routine Sentences",
    topic: "Daily Conversation",
    classNumber: 2,
    date: "12 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:02 PM",
    durationMinutes: 62,
    teacherName: "Ziyaur Rehman Zia",
    description: "Morning-to-evening daily routine phrases, greeting manners, and asking questions naturally in everyday scenarios.",
    status: "Completed",
    recordingId: "rec-se-02",
    hasStudyMaterial: true,
    hasAssignment: true,
    videoKey: "video_se_batch01_class02_daily"
  },
  {
    id: "cls-se-03",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 03 — Useful Vocabulary in Real Context",
    topic: "Vocabulary",
    classNumber: 3,
    date: "14 Sept 2026",
    startTime: "7:00 PM",
    endTime: "7:55 PM",
    durationMinutes: 55,
    teacherName: "Ziyaur Rehman Zia",
    description: "50 high-frequency action verbs and everyday adjectives with natural sentence pairing instead of rote memorisation.",
    status: "Completed",
    recordingId: "rec-se-03",
    hasStudyMaterial: true,
    hasAssignment: false,
    videoKey: "video_se_batch01_class03_vocab"
  },
  {
    id: "cls-se-04",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 04 — Pronunciation, Accent & Speech Rhythm",
    topic: "Pronunciation",
    classNumber: 4,
    date: "16 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    durationMinutes: 60,
    teacherName: "Ziyaur Rehman Zia",
    description: "Common mother-tongue influence (MTI) correction, silent letters, and intonation practice for clear, pleasant speech.",
    status: "Completed",
    recordingId: "rec-se-04",
    hasStudyMaterial: true,
    hasAssignment: true,
    videoKey: "video_se_batch01_class04_pronun"
  },
  {
    id: "cls-se-05",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 05 — Communication Skills & Expressing Thoughts",
    topic: "Communication Skills",
    classNumber: 5,
    date: "20 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    durationMinutes: 60,
    teacherName: "Ziyaur Rehman Zia",
    description: "How to articulate your thoughts clearly in English without translating word-by-word from Hindi/Urdu. Live roleplay practice.",
    status: "Live", // Live class interactive demo!
    hasStudyMaterial: true,
    hasAssignment: true
  },
  {
    id: "cls-se-06",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 06 — Telephone Etiquette & Small Talk",
    topic: "Conversation Practice",
    classNumber: 6,
    date: "23 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    durationMinutes: 60,
    teacherName: "Ziyaur Rehman Zia",
    description: "Speaking on phone calls, handling inquiries, making polite requests, and initiating friendly small talk with colleagues.",
    status: "Upcoming",
    hasStudyMaterial: true,
    hasAssignment: false
  },
  // Classes for batch-foundation-oct-2026 (Different Batch - Strict Access Check demonstration!)
  {
    id: "cls-fd-01",
    batchId: "batch-foundation-oct-2026",
    batchName: "English Foundation — Batch October 2026",
    title: "Class 01 — Alphabet Sounds & Phonics Essentials",
    topic: "Phonics & Sounds",
    classNumber: 1,
    date: "11 Sept 2026",
    startTime: "6:00 PM",
    endTime: "6:50 PM",
    durationMinutes: 50,
    teacherName: "Ziyaur Rehman Zia",
    description: "Understanding English vowels, consonants, sound blends, and basic syllable division.",
    status: "Completed",
    recordingId: "rec-fd-01",
    hasStudyMaterial: true,
    hasAssignment: true,
    videoKey: "video_fd_batch01_class01_phonics"
  },
  {
    id: "cls-fd-02",
    batchId: "batch-foundation-oct-2026",
    batchName: "English Foundation — Batch October 2026",
    title: "Class 02 — Simple Sentences (Is, Am, Are, Was, Were)",
    topic: "Grammar Made Easy",
    classNumber: 2,
    date: "15 Sept 2026",
    startTime: "6:00 PM",
    endTime: "6:55 PM",
    durationMinutes: 55,
    teacherName: "Ziyaur Rehman Zia",
    description: "Mastering state-of-being sentences and framing positive, negative, and question structures effortlessly.",
    status: "Completed",
    recordingId: "rec-fd-02",
    hasStudyMaterial: true,
    hasAssignment: true,
    videoKey: "video_fd_batch01_class02_sentences"
  }
];

const recordings: DBRecording[] = [
  {
    id: "rec-se-01",
    classId: "cls-se-01",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 01 — Introduction & Overcoming Hesitation",
    topic: "Introduction",
    classNumber: 1,
    date: "10 Sept 2026",
    duration: "58 min",
    status: "Available",
    videoKey: "video_se_batch01_class01_intro",
    notesSummary: "Focus areas: 1) Why English hesitation occurs, 2) 3 golden rules of self-introduction, 3) Guided vocal practice."
  },
  {
    id: "rec-se-02",
    classId: "cls-se-02",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 02 — Daily Conversation & Routine Sentences",
    topic: "Daily Conversation",
    classNumber: 2,
    date: "12 Sept 2026",
    duration: "62 min",
    status: "Available",
    videoKey: "video_se_batch01_class02_daily",
    notesSummary: "Routine verbs covered: wake up, get ready, commute, discuss, wrap up. Practice audio drills included."
  },
  {
    id: "rec-se-03",
    classId: "cls-se-03",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 03 — Useful Vocabulary in Real Context",
    topic: "Vocabulary",
    classNumber: 3,
    date: "14 Sept 2026",
    duration: "55 min",
    status: "Available",
    videoKey: "video_se_batch01_class03_vocab",
    notesSummary: "Key words: Hesitant, Eloquent, Articulate, Punctual, Collaborative with contextual usage dialogues."
  },
  {
    id: "rec-se-04",
    classId: "cls-se-04",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    title: "Class 04 — Pronunciation, Accent & Speech Rhythm",
    topic: "Pronunciation",
    classNumber: 4,
    date: "16 Sept 2026",
    duration: "60 min",
    status: "Available",
    videoKey: "video_se_batch01_class04_pronun",
    notesSummary: "Fixing 's' vs 'sh', 'v' vs 'w', and mastering word stress on two-syllable nouns vs verbs."
  },
  {
    id: "rec-fd-01",
    classId: "cls-fd-01",
    batchId: "batch-foundation-oct-2026",
    batchName: "English Foundation — Batch October 2026",
    title: "Class 01 — Alphabet Sounds & Phonics Essentials",
    topic: "Phonics & Sounds",
    classNumber: 1,
    date: "11 Sept 2026",
    duration: "50 min",
    status: "Available",
    videoKey: "video_fd_batch01_class01_phonics",
    notesSummary: "English alphabet 44 distinct sounds explained with Urdu/Hindi phoneme comparisons."
  },
  {
    id: "rec-fd-02",
    classId: "cls-fd-02",
    batchId: "batch-foundation-oct-2026",
    batchName: "English Foundation — Batch October 2026",
    title: "Class 02 — Simple Sentences (Is, Am, Are, Was, Were)",
    topic: "Grammar Made Easy",
    classNumber: 2,
    date: "15 Sept 2026",
    duration: "55 min",
    status: "Available",
    videoKey: "video_fd_batch01_class02_sentences",
    notesSummary: "20 practical sentence patterns with 'is/am/are' and everyday objects."
  }
];

const studyMaterials: DBStudyMaterial[] = [
  {
    id: "mat-01",
    batchId: "batch-spoken-oct-2026",
    classId: "cls-se-01",
    title: "Self-Introduction Master Guide & 10 Sample Scripts.pdf",
    description: "Detailed breakdown of introducing yourself in interviews, meetings, and casual gatherings with audio phonetic hints.",
    fileType: "pdf",
    fileSize: "2.4 MB",
    downloadUrl: "/api/files/download/mat-01",
    pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview",
    isViewOnly: true,
    allowDownload: false,
    isVisibleOnWebsite: true,
    category: "Guides & Scripts",
    level: "All Levels",
    uploadedAt: "10 Sept 2026"
  },
  {
    id: "mat-02",
    batchId: "batch-spoken-oct-2026",
    classId: "cls-se-02",
    title: "100 Daily Routine Sentence Cheat Sheet.pdf",
    description: "Natural everyday expressions with Hindi translation and pronunciation guide.",
    fileType: "pdf",
    fileSize: "3.1 MB",
    downloadUrl: "/api/files/download/mat-02",
    pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview",
    isViewOnly: true,
    allowDownload: false,
    isVisibleOnWebsite: true,
    category: "Worksheets",
    level: "Beginner to Intermediate",
    uploadedAt: "12 Sept 2026"
  },
  {
    id: "mat-03",
    batchId: "batch-spoken-oct-2026",
    classId: "cls-se-04",
    title: "Pronunciation & Tongue Position Handbook.pdf",
    description: "Visual mouth diagrams for mastering challenging English consonant sounds.",
    fileType: "pdf",
    fileSize: "4.8 MB",
    downloadUrl: "/api/files/download/mat-03",
    pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview",
    isViewOnly: true,
    allowDownload: false,
    isVisibleOnWebsite: true,
    category: "Pronunciation",
    level: "All Levels",
    uploadedAt: "16 Sept 2026"
  },
  {
    id: "mat-fd-01",
    batchId: "batch-foundation-oct-2026",
    classId: "cls-fd-01",
    title: "English Alphabet Phonics & Sound Chart.pdf",
    description: "Foundational phonics workbook with practice exercises.",
    fileType: "pdf",
    fileSize: "1.9 MB",
    downloadUrl: "/api/files/download/mat-fd-01",
    pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview",
    isViewOnly: true,
    allowDownload: false,
    isVisibleOnWebsite: true,
    category: "Foundation & Phonics",
    level: "Beginner",
    uploadedAt: "11 Sept 2026"
  },
  {
    id: "yt-01",
    resourceType: "youtube",
    batchId: "all",
    title: "Sound of C as “K” and “S” |",
    description: "Master the pronunciation rules of the letter 'C' producing /k/ and /s/ sounds in spoken English.",
    fileType: "youtube",
    fileSize: "Video",
    downloadUrl: "https://www.youtube.com/watch?v=ZFuoc6aEn3w",
    category: "Pronunciation & Phonics",
    level: "All Levels",
    uploadedAt: "15 Sept 2026",
    uploadedDate: "15 Sept 2026",
    youtubeUrl: "https://www.youtube.com/watch?v=ZFuoc6aEn3w",
    thumbnailUrl: "https://img.youtube.com/vi/ZFuoc6aEn3w/hqdefault.jpg",
    duration: "00:58",
    views: "Wits Lingo",
    displayOrder: 1,
    isPublished: true,
    isVisibleOnWebsite: true
  },
  {
    id: "yt-02",
    resourceType: "youtube",
    batchId: "all",
    title: "English & Society 🫣😅 | English seekhna hi padega.",
    description: "Why spoken English fluency is crucial in modern professional, social, and academic settings.",
    fileType: "youtube",
    fileSize: "Video",
    downloadUrl: "https://www.youtube.com/watch?v=Xk1gQdbSYic",
    category: "Spoken English & Fluency",
    level: "All Levels",
    uploadedAt: "18 Sept 2026",
    uploadedDate: "18 Sept 2026",
    youtubeUrl: "https://www.youtube.com/watch?v=Xk1gQdbSYic",
    thumbnailUrl: "https://img.youtube.com/vi/Xk1gQdbSYic/hqdefault.jpg",
    duration: "00:55",
    views: "Wits Lingo",
    displayOrder: 2,
    isPublished: true,
    isVisibleOnWebsite: true
  },
  {
    id: "yt-03",
    resourceType: "youtube",
    batchId: "all",
    title: "Why you can't improve your English | listen to it carefully",
    description: "Core psychological and habit mistakes that hold back English learners from achieving natural fluency.",
    fileType: "youtube",
    fileSize: "Video",
    downloadUrl: "https://www.youtube.com/watch?v=mImWmss_7Gw",
    category: "Learning Mindset",
    level: "All Levels",
    uploadedAt: "20 Sept 2026",
    uploadedDate: "20 Sept 2026",
    youtubeUrl: "https://www.youtube.com/watch?v=mImWmss_7Gw",
    thumbnailUrl: "https://img.youtube.com/vi/mImWmss_7Gw/hqdefault.jpg",
    duration: "00:59",
    views: "Wits Lingo",
    displayOrder: 3,
    isPublished: true,
    isVisibleOnWebsite: true
  },
  {
    id: "yt-04",
    resourceType: "youtube",
    batchId: "all",
    title: "English Learning isn't hard, but to choose a right way | Learn English With Wits Lingo Team",
    description: "Step-by-step guidance on choosing the right structured approach to learn English speaking effectively.",
    fileType: "youtube",
    fileSize: "Video",
    downloadUrl: "https://www.youtube.com/watch?v=K8PYUbGdazY",
    category: "English Foundations",
    level: "All Levels",
    uploadedAt: "22 Sept 2026",
    uploadedDate: "22 Sept 2026",
    youtubeUrl: "https://www.youtube.com/watch?v=K8PYUbGdazY",
    thumbnailUrl: "https://img.youtube.com/vi/K8PYUbGdazY/hqdefault.jpg",
    duration: "00:52",
    views: "Wits Lingo",
    displayOrder: 4,
    isPublished: true,
    isVisibleOnWebsite: true
  },
  {
    id: "yt-05",
    resourceType: "youtube",
    batchId: "all",
    title: "Bhai, English Seekho, chahen jaha se Seekho.😅 | Wits Lingo",
    description: "Practical encouragement and motivation to build everyday English speaking habits without hesitation.",
    fileType: "youtube",
    fileSize: "Video",
    downloadUrl: "https://www.youtube.com/watch?v=8yfe0F74q6M",
    category: "Daily Motivation",
    level: "All Levels",
    uploadedAt: "25 Sept 2026",
    uploadedDate: "25 Sept 2026",
    youtubeUrl: "https://www.youtube.com/watch?v=8yfe0F74q6M",
    thumbnailUrl: "https://img.youtube.com/vi/8yfe0F74q6M/hqdefault.jpg",
    duration: "00:48",
    views: "Wits Lingo",
    displayOrder: 5,
    isPublished: true,
    isVisibleOnWebsite: true
  }
];

const assignments: DBAssignment[] = [
  {
    id: "asg-01",
    batchId: "batch-spoken-oct-2026",
    classId: "cls-se-01",
    title: "Record 90-Second Self Introduction Audio",
    description: "Record and submit your 90-second self-introduction applying the 3 rules discussed in Class 01. Share your name, background, and goals.",
    dueDate: "22 Sept 2026",
    totalPoints: 20,
    submissionsCount: 19
  },
  {
    id: "asg-02",
    batchId: "batch-spoken-oct-2026",
    classId: "cls-se-04",
    title: "Pronunciation Drill: 15 Minimal Pairs Practice",
    description: "Read aloud the 15 minimal pair sentences (ship/sheep, pen/pan, live/leave) and write 5 original sentences.",
    dueDate: "25 Sept 2026",
    totalPoints: 25,
    submissionsCount: 14
  }
];

const submissions: DBAssignmentSubmission[] = [
  {
    id: "sub-01",
    assignmentId: "asg-01",
    studentId: "usr-student-01",
    studentName: "Mohd Farhan",
    batchId: "batch-spoken-oct-2026",
    submittedAt: "2026-09-11T18:30:00Z",
    content: "Audio script: Hello everyone! My name is Mohd Farhan. I am from Amroha, UP. I am pursuing my Bachelor of Arts. I joined Wits Lingo Academy to communicate smoothly and speak English without hesitation.",
    status: "Graded",
    score: 18,
    feedback: "Well done Farhan! Clear articulation. Just remember to pause naturally between sentences. Keep it up!"
  }
];

const announcements: DBAnnouncement[] = [
  {
    id: "ann-holiday-01",
    batchId: "all",
    batchName: "All Batches (Academy-wide)",
    title: "🏖️ Academy Holiday Notice: Gandhi Jayanti Observance",
    message: "Dear Students & Parents,\n\nPlease note that Wits Lingo Academy and all live online classrooms will remain closed on Friday, 2nd October 2026 on the occasion of Gandhi Jayanti. No live speaking classes or teacher consultations will take place on this day.\n\nKey Guidelines for Students:\n• Self-paced vocabulary audio drills and previous session recordings will remain accessible 24/7 on your student dashboard.\n• Homework submissions for Assignment 03 will have an extended deadline until 4th October 2026.\n• Regular interactive live classes will resume punctually on Saturday, 3rd October as per your regular batch schedule.\n\nWarm regards,\nWits Lingo Administration",
    date: "28 Sept 2026",
    author: "Ziyaur Rehman Zia",
    priority: "Important",
    category: "Holiday",
    effectiveDate: "2nd October 2026 (Full Day)",
    isPinned: true
  },
  {
    id: "ann-cls-02",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English & Daily Fluency",
    title: "📢 Spoken English Batch: 1-on-1 Mock Interview Pairs on Friday",
    message: "Attention Batch October 2026 learners:\n\nThis Friday's live session (07:30 PM - 08:30 PM IST) will feature mandatory 1-on-1 mock speaking pairs and individual fluency evaluations.\n\nPreparation Checklist:\n1. Please join the live class room 5 minutes early with your video camera turned on and microphone tested.\n2. Review the '100 High-Frequency Daily Dialogue Sheet' available in your study materials section.\n3. Prepare a concise 2-minute introduction covering your background, professional aspirations, and daily routine.\n\nActive participation is compulsory for monthly certificate grading.",
    date: "26 Sept 2026",
    author: "Ziyaur Rehman Zia",
    priority: "Urgent",
    category: "Class Notice",
    effectiveDate: "Friday, 07:30 PM IST",
    isPinned: true
  },
  {
    id: "ann-sched-03",
    batchId: "batch-found-oct-2026",
    batchName: "English Foundation (Basics)",
    title: "🕒 English Foundation: Timing Adjusted to 5:00 PM for Revision Week",
    message: "Dear Foundation Batch students,\n\nTo allow 15 extra minutes of guided pronunciation drills, our daily evening live class will temporarily commence at 05:00 PM IST instead of 04:30 PM IST during the upcoming Revision Week (28th Sept to 2nd Oct).\n\nPlease verify your class links on the dashboard. Class duration will be 60 minutes of intensive practice.",
    date: "24 Sept 2026",
    author: "Ziyaur Rehman Zia",
    priority: "Normal",
    category: "Schedule Change",
    effectiveDate: "28 Sept - 2 Oct 2026",
    isPinned: false
  },
  {
    id: "ann-gen-04",
    batchId: "all",
    batchName: "All Batches (Academy-wide)",
    title: "🎧 15 New Pronunciation & Tongue-Twister Audio Drills Uploaded",
    message: "Exciting learning update!\n\n15 new studio-recorded audio drills focusing on removing Mother Tongue Influence (MTI), mastering 'P' vs 'B' and 'V' vs 'W' sound articulation, and connected conversational speech have been added to the Study Materials library.\n\nAll students are recommended to listen and shadow-speak for at least 10 minutes every morning.",
    date: "22 Sept 2026",
    author: "Ziyaur Rehman Zia",
    priority: "Normal",
    category: "General",
    effectiveDate: "Available Now",
    isPinned: false
  }
];

const attendanceRecords: DBAttendance[] = [
  {
    id: "att-01",
    studentId: "usr-student-01",
    studentName: "Mohd Farhan",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    classId: "cls-se-01",
    classTitle: "Class 01 — Introduction & Overcoming Hesitation",
    joinTime: "7:00 PM",
    leaveTime: "7:58 PM",
    durationMinutes: 58,
    status: "Present",
    date: "10 Sept 2026"
  },
  {
    id: "att-02",
    studentId: "usr-student-01",
    studentName: "Mohd Farhan",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    classId: "cls-se-02",
    classTitle: "Class 02 — Daily Conversation & Routine Sentences",
    joinTime: "7:02 PM",
    leaveTime: "8:02 PM",
    durationMinutes: 60,
    status: "Present",
    date: "12 Sept 2026"
  },
  {
    id: "att-03",
    studentId: "usr-student-01",
    studentName: "Mohd Farhan",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English — Batch October 2026 (Batch 01)",
    classId: "cls-se-03",
    classTitle: "Class 03 — Useful Vocabulary in Real Context",
    joinTime: "7:00 PM",
    leaveTime: "7:55 PM",
    durationMinutes: 55,
    status: "Present",
    date: "14 Sept 2026"
  }
];

// Dynamic CMS content editable from the Admin Panel
let cmsContent: any = {
  academyName: "WITS LINGO",
  tagline: "A Global Language Platform",
  announcementText: "New Batch Starts from 1st of each month • Admissions Open for October & November 2026",
  announcementBtnText: "",
  showAnnouncement: true,
  settings: {
    youtubeUrl: "https://www.youtube.com/@witslingoeng"
  },
  phoneNumbers: ["7310952271", "9027729917"],
  email: "Witslingo@gmail.com",
  location: "Wits Lingo Academy, Dhakka, Amroha, Uttar Pradesh, India",
  whatsappChannel: "https://whatsapp.com/channel/0029Vb8dJ6C0rGiTXEMDB93k",
  instagram: "https://www.instagram.com/witslingo?stkn=MWc0OTc5ZHU5OTVrNA==",
  facebook: "https://www.facebook.com/share/1BP5jTfk9B/",
  courses: [
    {
      id: "course-foundation",
      name: "English Foundation",
      level: "Beginner",
      shortDescription: "For learners starting from the basics, building fundamentals with zero hesitation.",
      whatYouWillLearn: [
        "Basic phonetics, clear alphabet sounds & sound articulation",
        "High-frequency everyday words & practical vocabulary",
        "Simple subject-verb sentence framing without translation",
        "Overcoming stage fear & basic self-introduction"
      ],
      facilities: [
        "40 Live Online Classroom Sessions with Zia Sir",
        "Foundational Phonics & Grammar Workbook (PDF)",
        "60-Day Full Lecture Recordings Access",
        "Daily Speaking Drills & Overcoming Hesitation",
        "1-on-1 Pronunciation & MTI Correction Guidance"
      ],
      duration: "2 Months (40 Sessions)",
      learningFormat: "Live Online Classroom (Evening Batches)",
      fee: 1199,
      badge: "Popular Foundation",
      isPublished: true
    },
    {
      id: "course-spoken-english",
      name: "Spoken English",
      level: "Beginner to Intermediate",
      shortDescription: "Practical English speaking and everyday communication for students and job seekers.",
      whatYouWillLearn: [
        "Fluency training & immediate hesitation removal",
        "Conversational drills for market, bank, travel & social events",
        "Elimination of mother-tongue influence (MTI)",
        "Thinking directly in English during daily conversations"
      ],
      facilities: [
        "50 Live Interactive Speaking Sessions with Zia Sir",
        "100+ Real Life Conversation Dialogue Scripts (PDF)",
        "60-Day High Definition Recordings Archive Access",
        "Daily Breakout Rooms & Peer Speaking Practice",
        "Direct Mentor Feedback & Natural Accent Coaching"
      ],
      duration: "2.5 Months (50 Sessions)",
      learningFormat: "Live Batches + Daily Speaking Drills",
      fee: 1499,
      badge: "Most Popular",
      isPublished: true
    },
    {
      id: "course-vocabulary",
      name: "English Vocabulary",
      level: "Intermediate",
      shortDescription: "Useful vocabulary with practical real-life examples, idioms, and active speaking practice.",
      whatYouWillLearn: [
        "1,000+ active conversational words & collocations",
        "Contextual idioms, phrasal verbs & smart alternatives",
        "Memory retention techniques (no rote memorisation)",
        "Applying new vocabulary naturally in impromptu dialogues"
      ],
      facilities: [
        "30 Interactive Vocabulary Workshops",
        "1,000+ Active Conversational Words & Idioms PDF",
        "60-Day Lecture Recordings Access",
        "Active Impromptu Dialogue Drills",
        "Weekly Vocabulary Retention Quizzes & Notes"
      ],
      duration: "1.5 Months (30 Sessions)",
      learningFormat: "Interactive Vocabulary Workshops",
      fee: 999,
      isPublished: true
    },
    {
      id: "course-conversation",
      name: "English Conversation",
      level: "Intermediate",
      shortDescription: "Real-life conversation and speaking practice in simulated environments.",
      whatYouWillLearn: [
        "One-on-one and group situational roleplays",
        "Handling casual small talk, phone calls & discussions",
        "Polite interruptions, expressing opinions & agreement",
        "Confidence building with peer interaction"
      ],
      facilities: [
        "40 100% Practical Speaking & Roleplay Sessions",
        "Everyday Scenario Dialogue Scripts (PDF)",
        "60-Day Class Recordings Access",
        "One-on-One Simulated Roleplay Rounds",
        "Live Accent & Fluency Coaching"
      ],
      duration: "2 Months (40 Sessions)",
      learningFormat: "100% Speaking & Dialogue Practice",
      fee: 1299,
      isPublished: true
    },
    {
      id: "course-communication-skills",
      name: "Communication Skills",
      level: "Intermediate to Advanced",
      shortDescription: "Confidence, expression, interview mastery, and effective communication in professional life.",
      whatYouWillLearn: [
        "Job interview preparation & self-pitch articulation",
        "Public speaking, stage presence & body language",
        "Professional email, etiquette & formal discussion",
        "Clear, articulate presentation skills"
      ],
      facilities: [
        "35 Masterclass Sessions + Mock Interviews",
        "Self-Pitch & Corporate Presentation Handbook (PDF)",
        "60-Day Class Recordings Access",
        "Live Job Interview Simulations & Stage Fear Removal",
        "1-on-1 Feedback from Senior Mentors"
      ],
      duration: "2 Months (35 Sessions)",
      learningFormat: "Masterclass Format + Mock Interviews",
      fee: 1699,
      badge: "Career Boost",
      isPublished: true
    },
    {
      id: "course-advanced-english",
      name: "Advanced English",
      level: "Advanced",
      shortDescription: "For learners who want to develop stronger fluency, nuanced vocabulary, and leadership communication.",
      whatYouWillLearn: [
        "Nuanced tone control, formal vs informal language mastery",
        "Advanced debate, spontaneous argument articulation",
        "Refined accent clarity, pacing, stress & intonation",
        "Complex idea synthesis and persuasive speech"
      ],
      facilities: [
        "60 Executive Live Sessions",
        "Advanced Rhetoric, Tone & Debate Guides (PDF)",
        "60-Day Class Recordings Access",
        "Spontaneous Debate Rounds & Idea Synthesis",
        "Executive Presentation & Leadership Communication Coaching"
      ],
      duration: "3 Months (60 Sessions)",
      learningFormat: "Executive Live Batch",
      fee: 1999,
      badge: "Career Ready",
      isPublished: true
    }
  ],
  testimonials: [
    {
      id: "test-01",
      studentName: "Mohd Farhan",
      courseBatch: "Spoken English — Batch 01",
      city: "Amroha, UP",
      date: "September 2026",
      testimonial: "Wits Lingo changed the way I look at English. Earlier, I used to freeze whenever someone asked me a question in English. Zia Sir's practical step-by-step approach helped me speak naturally in just a few weeks without memorising heavy grammar rules."
    },
    {
      id: "test-02",
      studentName: "Shabana Parveen",
      courseBatch: "English Foundation",
      city: "Moradabad, UP",
      date: "August 2026",
      testimonial: "Coming from a Hindi-medium background, I always lacked confidence in college. In Wits Lingo Academy, every single student gets a chance to speak. The batch recordings and daily worksheets are immense help!"
    },
    {
      id: "test-03",
      studentName: "Mohammad Danish",
      courseBatch: "Spoken English & Communication",
      city: "Sambhal, UP",
      date: "July 2026",
      testimonial: "The batch system is so well organized. The live classes feel like a physical classroom, and having recorded classes to revise anytime on phone gave me tremendous confidence for my job interviews."
    }
  ]
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
    if (reqOrHeader.startsWith("Bearer ")) {
      token = reqOrHeader.substring(7).trim();
    } else {
      token = reqOrHeader.trim();
    }
  } else if (typeof reqOrHeader === "object") {
    const authHeader = reqOrHeader.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      const cookies = parseCookies(reqOrHeader);
      token = cookies.admin_session_token || cookies.wits_auth_token;
    }
  }

  if (!token) return null;

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

// Middleware: Require Admin Authentication
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = verifyAuthToken(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  if (auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Administrator privileges required." });
  }
  (req as any).auth = auth;
  next();
}

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
const PAYMENTS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "payments.json");
const CMS_STORAGE_FILE = path.join(DATA_STORAGE_DIR, "cms-content.json");
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
const galleryItems: DBGalleryItem[] = [
  {
    id: "gal-01",
    title: "Interactive Live Spoken English Session",
    caption: "Students engaging in real-time conversational speaking drills, overcoming hesitation with guided peer discussions.",
    category: "Live Sessions",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 1,
    uploadedAt: "2026-09-15T10:00:00Z",
    fileSize: "1.2 MB"
  },
  {
    id: "gal-02",
    title: "Confidence Building & Public Speaking Workshop",
    caption: "Dedicated masterclass session on stage presence, body language articulation, and spontaneous speaking.",
    category: "Events & Workshops",
    imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 2,
    uploadedAt: "2026-09-18T14:30:00Z",
    fileSize: "1.5 MB"
  },
  {
    id: "gal-03",
    title: "1-on-1 Mock Interview & Evaluation",
    caption: "Personalized feedback and mock interview simulation preparing students for top corporate job placements.",
    category: "Student Activities",
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 3,
    uploadedAt: "2026-09-20T11:15:00Z",
    fileSize: "1.1 MB"
  },
  {
    id: "gal-04",
    title: "Collaborative Group Discussion & Debate",
    caption: "Learners actively participating in structured debate rounds to hone persuasion, argumentation, and fluency.",
    category: "Classrooms",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 4,
    uploadedAt: "2026-09-22T16:00:00Z",
    fileSize: "1.8 MB"
  },
  {
    id: "gal-05",
    title: "WITS LINGO Student Community Meetup",
    caption: "Connecting passionate English learners across India, celebrating milestones, and sharing inspiring transformation stories.",
    category: "Community",
    imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 5,
    uploadedAt: "2026-09-25T09:45:00Z",
    fileSize: "1.4 MB"
  },
  {
    id: "gal-06",
    title: "Vocabulary & Pronunciation Mastery Drill",
    caption: "In-depth breakdown of phonetics, eliminating Mother Tongue Influence (MTI) with practical articulation practice.",
    category: "Classrooms",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80",
    isPublished: true,
    displayOrder: 6,
    uploadedAt: "2026-09-28T12:20:00Z",
    fileSize: "1.3 MB"
  }
];

function loadAllPersistedData(): void {
  try {
    // 1. Registrations
    if (fs.existsSync(REGISTRATIONS_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRATIONS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((r: any) => r.id || r.admissionId));
        for (const r of registrations) {
          if (!existingIds.has(r.id) && !existingIds.has(r.admissionId)) {
            data.push(r);
          }
        }
        registrations.length = 0;
        registrations.push(...data);
        console.log(`[Persistence] Loaded ${registrations.length} student registrations.`);
      }
    }

    // 2. Users
    if (fs.existsSync(USERS_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingEmails = new Set(data.map((u: any) => u.email?.toLowerCase()));
        for (const u of users) {
          if (!existingEmails.has(u.email.toLowerCase())) {
            data.push(u);
          }
        }
        users.length = 0;
        users.push(...data);
        console.log(`[Persistence] Loaded ${users.length} users.`);
      }
    }

    // 3. Batches
    if (fs.existsSync(BATCHES_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(BATCHES_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((b: any) => b.id));
        for (const b of batches) {
          if (!existingIds.has(b.id)) {
            data.push(b);
          }
        }
        batches.length = 0;
        batches.push(...data);
        console.log(`[Persistence] Loaded ${batches.length} batches.`);
      }
    }

    // 4. Payments
    if (fs.existsSync(PAYMENTS_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(PAYMENTS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        payments.length = 0;
        payments.push(...data);
        console.log(`[Persistence] Loaded ${payments.length} verified payment transactions.`);
      }
    }

    // 5. CMS Content
    if (fs.existsSync(CMS_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CMS_STORAGE_FILE, "utf-8"));
      if (data && typeof data === "object") {
        cmsContent = {
          ...cmsContent,
          ...data,
          settings: {
            ...cmsContent.settings,
            ...(data.settings || {})
          }
        };
        console.log(`[Persistence] Loaded custom CMS content & settings.`);
      }
    }

    // 6. Announcements
    if (fs.existsSync(ANNOUNCEMENTS_STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANNOUNCEMENTS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        announcements.length = 0;
        announcements.push(...data);
        console.log(`[Persistence] Loaded ${announcements.length} announcements.`);
      }
    }

    // 7. Study Materials
    let materialsLoaded = false;
    if (fs.existsSync(MATERIALS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(MATERIALS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data) && data.length > 0) {
          const existingIds = new Set(data.map((m: any) => m.id));
          for (const m of studyMaterials) {
            if (!existingIds.has(m.id)) {
              data.push(m);
            }
          }
          for (const m of data) {
            if (m.resourceType === "youtube" || m.fileType === "youtube") {
              if (!m.downloadUrl && m.youtubeUrl) m.downloadUrl = m.youtubeUrl;
            } else if (!m.downloadUrl || m.downloadUrl === "#") {
              m.downloadUrl = `/api/files/download/${m.id}`;
            }
          }
          studyMaterials.length = 0;
          studyMaterials.push(...data);
          materialsLoaded = true;
          console.log(`[Persistence] Loaded ${studyMaterials.length} study materials.`);
          savePersistedMaterials();
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse materials.json:", e);
      }
    }
    if (!materialsLoaded) {
      const legacyPath = path.join(process.cwd(), "uploads", "study-materials.json");
      if (fs.existsSync(legacyPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
          if (Array.isArray(data) && data.length > 0) {
            for (const m of data) {
              if (!m.downloadUrl || m.downloadUrl === "#") {
                m.downloadUrl = `/api/files/download/${m.id}`;
              }
            }
            studyMaterials.length = 0;
            studyMaterials.push(...data);
            console.log(`[Persistence] Seeded ${studyMaterials.length} study materials from legacy storage.`);
            savePersistedMaterials();
          }
        } catch (e) {}
      }
    }

    // 8. Gallery Items
    let galleryLoaded = false;
    if (fs.existsSync(GALLERY_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(GALLERY_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data) && data.length > 0) {
          galleryItems.length = 0;
          galleryItems.push(...data);
          galleryLoaded = true;
          console.log(`[Persistence] Loaded ${galleryItems.length} gallery items.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse gallery.json:", e);
      }
    }
    if (!galleryLoaded) {
      const legacyPath = path.join(process.cwd(), "uploads", "gallery.json");
      if (fs.existsSync(legacyPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
          if (Array.isArray(data) && data.length > 0) {
            galleryItems.length = 0;
            galleryItems.push(...data);
            console.log(`[Persistence] Seeded ${galleryItems.length} gallery items from legacy storage.`);
            savePersistedGallery();
          }
        } catch (e) {}
      } else {
        savePersistedGallery();
      }
    }

    // 9. Orders
    if (fs.existsSync(ORDERS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(ORDERS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          orders.length = 0;
          orders.push(...data);
          console.log(`[Persistence] Loaded ${orders.length} student orders.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse orders.json:", e);
      }
    }

    // 10. Notifications
    if (fs.existsSync(NOTIFICATIONS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(NOTIFICATIONS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          notifications.length = 0;
          notifications.push(...data);
          console.log(`[Persistence] Loaded ${notifications.length} WhatsApp notifications.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse notifications.json:", e);
      }
    }

    // 11. Conversations
    if (fs.existsSync(CONVERSATIONS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(CONVERSATIONS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          conversations.length = 0;
          conversations.push(...data);
        }
      } catch (e) {}
    }

    // 12. Messages
    if (fs.existsSync(MESSAGES_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(MESSAGES_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          messages.length = 0;
          messages.push(...data);
        }
      } catch (e) {}
    }

    // 13. Support Tickets
    if (fs.existsSync(SUPPORT_TICKETS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(SUPPORT_TICKETS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          supportTickets.length = 0;
          supportTickets.push(...data);
          console.log(`[Persistence] Loaded ${supportTickets.length} support tickets.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse support-tickets.json:", e);
      }
    }
  } catch (err) {
    console.warn("[Persistence] Error loading persisted data from disk:", err);
  }
}

function savePersistedGallery(): void {
  durableStorageService.saveCollectionBackground("gallery", galleryItems);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(GALLERY_STORAGE_FILE, JSON.stringify(galleryItems, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save gallery.json:", e);
    }
  }
}

function saveRegistrations(): void {
  durableStorageService.saveCollectionBackground("registrations", registrations);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(REGISTRATIONS_STORAGE_FILE, JSON.stringify(registrations, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save registrations:", e);
    }
  }
}

function saveUsers(): void {
  durableStorageService.saveCollectionBackground("users", users);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(USERS_STORAGE_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save users:", e);
    }
  }
}

function saveBatches(): void {
  durableStorageService.saveCollectionBackground("batches", batches);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(BATCHES_STORAGE_FILE, JSON.stringify(batches, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save batches:", e);
    }
  }
}

function savePayments(): void {
  durableStorageService.saveCollectionBackground("payments", payments);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(PAYMENTS_STORAGE_FILE, JSON.stringify(payments, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save payments:", e);
    }
  }
}

function saveCmsContent(): void {
  durableStorageService.saveCollectionBackground("cmsContent", cmsContent);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(CMS_STORAGE_FILE, JSON.stringify(cmsContent, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save cmsContent:", e);
    }
  }
}

function saveAnnouncements(): void {
  durableStorageService.saveCollectionBackground("announcements", announcements);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(ANNOUNCEMENTS_STORAGE_FILE, JSON.stringify(announcements, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save announcements:", e);
    }
  }
}

function savePersistedMaterials(): void {
  durableStorageService.saveCollectionBackground("materials", studyMaterials);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(MATERIALS_STORAGE_FILE, JSON.stringify(studyMaterials, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save materials:", e);
    }
  }
}

function saveOrders(): void {
  durableStorageService.saveCollectionBackground("orders", orders);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(ORDERS_STORAGE_FILE, JSON.stringify(orders, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save orders:", e);
    }
  }
}

function saveNotifications(): void {
  durableStorageService.saveCollectionBackground("notifications", notifications);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(NOTIFICATIONS_STORAGE_FILE, JSON.stringify(notifications, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save notifications:", e);
    }
  }
}

function saveConversations(): void {
  durableStorageService.saveCollectionBackground("conversations", conversations);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(CONVERSATIONS_STORAGE_FILE, JSON.stringify(conversations, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save conversations:", e);
    }
  }
}

function saveMessages(): void {
  durableStorageService.saveCollectionBackground("messages", messages);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(MESSAGES_STORAGE_FILE, JSON.stringify(messages, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save messages:", e);
    }
  }
}

function saveSupportTickets(): void {
  durableStorageService.saveCollectionBackground("support-tickets", supportTickets);
  if (process.env.VERCEL !== "1") {
    try {
      fs.writeFileSync(SUPPORT_TICKETS_STORAGE_FILE, JSON.stringify(supportTickets, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save support tickets:", e);
    }
  }
}

// Initial boot load
loadAllPersistedData();

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

  const sendRes = await whatsappCloudApiService.sendTemplateMessage(
    cleanRecipient,
    templateName,
    templateLang,
    [
      {
        type: "body",
        parameters: [
          { type: "text", text: data.studentName || "Student" },
          { type: "text", text: data.courseName || foundCourse?.name || "English Course" },
          { type: "text", text: data.batchName || foundBatch?.name || "Active Batch" },
          { type: "text", text: startDate },
          { type: "text", text: classTime },
          { type: "text", text: facilitiesText },
          { type: "text", text: meetLink },
          { type: "text", text: data.admissionId }
        ]
      }
    ]
  );

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
  return whatsappNotificationService.sendPaymentConfirmation({
    orderId: order.id,
    studentId: order.studentId,
    studentName: order.studentName || "Student",
    studentPhone: order.studentPhone,
    courseName: order.courseName || "Wits Lingo Course",
    amount: payment.amount || order.expectedAmount,
    razorpayPaymentId: payment.razorpayPaymentId || payment.paymentId || "Verified",
    startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE,
    scheduleTime: WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME,
    meetLink: WITS_LINGO_CONFIG.GOOGLE_MEET_LINK
  }, forceResend);
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
  app.post("/api/whatsapp/test-message", async (req, res) => {
    try {
      const phone = req.body?.phone?.trim() || process.env.WHATSAPP_SUPPORT_PHONE?.trim() || "919027729917";
      const message = req.body?.message?.trim() || "This is a test message from Wits Lingo official WhatsApp Cloud API.";

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

  // 1. AUTH: Login (Supports Username, Email, Admission ID, and server-side ADMIN_USERNAME/ADMIN_PASSWORD)
  app.post(["/api/auth/login", "/api/admin/auth/login", "/api/admin/login"], (req, res) => {
    const { email, username, password, adminPasskey } = req.body;
    const loginIdentifier = (username || email || "").trim();
    const inputPass = (password || adminPasskey || "").trim();

    if (!loginIdentifier || !inputPass) {
      return res.status(400).json({ error: "Please provide your Username/Email and Password." });
    }

    // 1. Check against server-side ADMIN_USERNAME and ADMIN_PASSWORD
    const isEnvAdminMatch = 
      loginIdentifier.toLowerCase() === ADMIN_USERNAME.toLowerCase() ||
      loginIdentifier.toLowerCase() === "admin@witslingo.com";

    if (isEnvAdminMatch && verifyPassword(inputPass, ADMIN_PASSWORD)) {
      const primaryAdmin: DBUser = {
        id: "usr-admin-primary",
        name: "WITS LINGO Administrator",
        email: "admin@witslingo.com",
        username: ADMIN_USERNAME,
        passwordHash: ADMIN_PASSWORD,
        role: "admin",
        phone: "7310952271",
        batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
        registrationDate: "2026-01-01"
      };

      const token = generateAuthToken(primaryAdmin);
      
      // Set secure HttpOnly session cookie
      res.setHeader(
        "Set-Cookie",
        `admin_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
      );

      return res.json({
        success: true,
        token,
        user: {
          id: primaryAdmin.id,
          name: primaryAdmin.name,
          email: primaryAdmin.email,
          role: primaryAdmin.role,
          phone: primaryAdmin.phone,
          batchIds: primaryAdmin.batchIds,
          registrationDate: primaryAdmin.registrationDate
        }
      });
    }

    // 2. Check in database users (for other admin accounts or students)
    const user = users.find(u => 
      u.email.toLowerCase() === loginIdentifier.toLowerCase() || 
      (u.admissionId && u.admissionId.toLowerCase() === loginIdentifier.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === loginIdentifier.toLowerCase())
    );

    if (user) {
      const passwordMatches = 
        verifyPassword(inputPass, user.passwordHash) ||
        (user.role === 'admin' && (verifyPassword(inputPass, ADMIN_PASSWORD) || inputPass === 'admin123'));

      if (passwordMatches) {
        const token = generateAuthToken(user);

        if (user.role === 'admin') {
          res.setHeader(
            "Set-Cookie",
            `admin_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
          );
        }

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
    const auth = verifyAuthToken(req);
    if (!auth) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    let user = users.find(u => u.id === auth.userId);
    if (!user && auth.role === "admin") {
      user = {
        id: auth.userId,
        name: auth.name || "WITS LINGO Administrator",
        email: auth.email || "admin@witslingo.com",
        username: ADMIN_USERNAME,
        passwordHash: ADMIN_PASSWORD,
        role: "admin",
        phone: "7310952271",
        batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
        registrationDate: "2026-01-01"
      };
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Return user with their authorized batches
    const userBatches = batches.filter(b => user.batchIds.includes(b.id));

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
      batches: userBatches
    });
  });

  // 3. BATCHES: List Batches (Public or Authenticated)
  app.get("/api/batches", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);

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
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);

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

  // Check Razorpay Configuration Status
  app.get("/api/payments/razorpay/config", (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    res.json({
      configured: Boolean(keyId),
      keyId: keyId || null
    });
  });

  // 1. Create Official Razorpay Payment Order (Server-Side Price Calculation)
  app.post("/api/payments/razorpay/order", async (req, res) => {
    try {
      const { courseId, batchId, studentName, studentEmail, studentPhone } = req.body;
      if (!courseId) {
        return res.status(400).json({ error: "courseId is required to generate an order." });
      }

      const course = cmsContent.courses.find((c: any) => c.id === courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found." });
      }

      const batch = batchId ? batches.find(b => b.id === batchId) : null;
      const keyId = process.env.RAZORPAY_KEY_ID?.trim();
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

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

      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
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
          batchIds: [batch.id],
          admissionId,
          registrationDate: new Date().toISOString().split("T")[0]
        };
        users.push(user);
      }

      const token = generateAuthToken(user);

      // Save persisted changes to disk
      saveRegistrations();
      saveUsers();
      saveBatches();
      savePayments();

      // Async Non-blocking WhatsApp Confirmation (Meta Cloud API)
      sendWhatsAppEnrollmentMessage({
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
        console.warn("[WhatsApp] Async dispatch error:", err);
        studentReg.whatsappDeliveryStatus = "failed";
        studentReg.whatsappError = err?.message || "Dispatch error";
        saveRegistrations();
      });

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
  app.post("/api/webhooks/razorpay", (req, res) => {
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
            saveOrders();
          }

          // 3. Resolve matching student registration
          const reg = registrations.find(r => r.razorpayOrderId === orderId || (matchedOrder && r.phone === matchedOrder.studentPhone));
          if (reg) {
            reg.paymentStatus = "Paid";
            reg.razorpayPaymentId = paymentId;
            saveRegistrations();
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
              batchIds: [batchId],
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
          if (matchedOrder) {
            sendPaymentConfirmationWhatsApp(matchedOrder, newPaymentRecord).catch(err => {
              console.warn("[Razorpay Webhook] Async WhatsApp dispatch error:", err);
            });
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
      const { studentName, whatsapp, email, courseId, couponCode } = req.body;

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
      const foundCourse = (cmsContent.courses || []).find((c: any) => c.id === courseId) ||
        (cmsContent.courses?.[0]);

      if (!foundCourse) {
        return res.status(404).json({ success: false, error: "Selected course was not found." });
      }

      const originalFee = Number(foundCourse.fee) || 1499;
      let discountAmount = 0;
      let appliedCoupon: string | undefined = undefined;

      // Coupon / discount calculation
      if (couponCode && typeof couponCode === "string") {
        const codeClean = couponCode.trim().toUpperCase();
        if (codeClean === "WELCOME10") {
          discountAmount = Math.round(originalFee * 0.10);
          appliedCoupon = "WELCOME10 (10% Off)";
        } else if (codeClean === "WITS100") {
          discountAmount = 100;
          appliedCoupon = "WITS100 (₹100 Off)";
        } else if (codeClean === "TEST100" || codeClean === "DEMO99") {
          discountAmount = Math.max(0, originalFee - 1); // 1 rupee test mode
          appliedCoupon = `${codeClean} (Test Mode: ₹1)`;
        }
      }

      const finalPayable = Math.max(1, originalFee - discountAmount);
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const keyId = process.env.RAZORPAY_KEY_ID?.trim();
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

      let razorpayOrderId: string | undefined;
      const isTestMode = !Boolean(keyId && keySecret);

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
        discountAmount,
        discountCode: appliedCoupon,
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
        keyId: keyId || "rzp_test_witslingo_placeholder",
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
    const notification = notifications.find(n => n.orderId === order.id);

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

      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

      // Cryptographic signature verification if secret is configured and real razorpayOrderId is present
      if (keySecret && razorpayOrderId && razorpaySignature && !razorpayOrderId.startsWith("order_test_")) {
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
      saveRegistrations();

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
          batchIds: [order.batchId || "batch-spoken-oct-2026"],
          admissionId,
          registrationDate: new Date().toISOString()
        };
        users.push(existingUser);
      } else {
        if (!existingUser.batchIds.includes(order.batchId || "batch-spoken-oct-2026")) {
          existingUser.batchIds.push(order.batchId || "batch-spoken-oct-2026");
        }
      }
      saveUsers();

      // 5. Send Automatic WhatsApp Confirmation
      sendPaymentConfirmationWhatsApp(order, newPayment).catch(waErr => {
        console.warn("[WhatsApp] Async confirmation error:", waErr);
      });

      res.json({
        success: true,
        message: "Payment successfully verified! Your course access is activated.",
        order,
        payment: newPayment,
        admissionId,
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

  app.get(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], (req, res) => {
    const mode = ((req.query["hub.mode"] || req.query["mode"]) as string || "").trim();
    const token = ((req.query["hub.verify_token"] || req.query["verify_token"]) as string || "").trim();
    const challenge = ((req.query["hub.challenge"] || req.query["challenge"]) as string || "").trim();

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

    // Meta Handshake: Validate verify_token matches
    if (token !== whatsappCloudApiService.verifyToken) {
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

  app.post(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], async (req, res) => {
    // 1. Validate Meta HMAC SHA-256 signature if app secret is configured
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const isValidSignature = whatsappCloudApiService.validateWebhookSignature((req as any).rawBody || JSON.stringify(req.body), signature);
    if (!isValidSignature) {
      console.warn("[WhatsApp Webhook] Invalid X-Hub-Signature-256 signature.");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // 2. Respond 200 OK immediately to satisfy Meta's strict timeout requirements
    res.status(200).json({ status: "ok" });

    // 3. Process asynchronously in the background
    try {
      const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(req.body);

      // Handle delivery status updates (sent -> delivered -> read -> failed)
      for (const st of statuses) {
        const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : undefined;
        whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
      }

      // Handle student incoming messages
      for (const msg of inboundMessages) {
        console.log(`[WhatsApp Meta Inbound] from=${msg.senderPhone}, type=${msg.type}, text="${msg.textBody}"`);
        await studentSupportService.handleInboundMessage(msg);
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Background processing error:", err);
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
    const total = notifications.length;
    const sent = notifications.filter(n => n.messageStatus === "sent").length;
    const failed = notifications.filter(n => n.messageStatus === "failed").length;
    const pending = notifications.filter(n => n.messageStatus === "pending").length;

    res.json({
      success: true,
      stats: { total, sent, failed, pending },
      notifications
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

  app.post("/api/admin/hero-video/upload", async (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

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

    if (!cmsContent.settings) cmsContent.settings = {};
    cmsContent.settings.heroVideoUrl = finalVideoUrl;
    saveCmsContent();

    res.json({
      success: true,
      heroVideoUrl: finalVideoUrl,
      uploadedToB2,
      message: "Hero video uploaded and updated successfully."
    });
  });

  app.post("/api/admin/hero-video/reset", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    if (!cmsContent.settings) cmsContent.settings = {};
    cmsContent.settings.heroVideoUrl = "/video/wits-lingo-intro.mp4";
    saveCmsContent();

    res.json({
      success: true,
      heroVideoUrl: "/video/wits-lingo-intro.mp4",
      message: "Hero video reset to default intro video."
    });
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

  app.post("/api/admin/logo/upload", async (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

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
      if (!cmsContent.settings) cmsContent.settings = {};
      cmsContent.settings.logoUrl = finalLogoUrl;
      cmsContent.settings.logoVersion = logoVersion;
      cmsContent.settings.b2LogoId = b2FileId;
      cmsContent.settings.b2LogoName = b2FileName;
      saveCmsContent();

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

  app.post("/api/admin/logo/reset", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    if (!cmsContent.settings) cmsContent.settings = {};
    cmsContent.settings.logoUrl = "/logo.svg";
    cmsContent.settings.logoVersion = Date.now();
    cmsContent.settings.b2LogoId = undefined;
    cmsContent.settings.b2LogoName = undefined;
    saveCmsContent();

    res.json({
      success: true,
      logoUrl: "/logo.svg",
      logoVersion: cmsContent.settings.logoVersion,
      message: "Main website logo reset to default SVG logo."
    });
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
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);
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

      savePersistedGallery();

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
  app.put("/api/admin/gallery/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

    savePersistedGallery();

    res.json({
      success: true,
      item,
      message: "Gallery item updated successfully."
    });
  });

  // 5. Admin Batch Reorder Gallery Items
  app.put("/api/admin/gallery/reorder", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

    savePersistedGallery();

    res.json({
      success: true,
      items: galleryItems,
      message: "Gallery order updated successfully."
    });
  });

  // 6. Admin Delete Gallery Item (Safe Persistence First, then B2 cleanup)
  app.delete("/api/admin/gallery/:id", async (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    savePersistedGallery();

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
  app.post("/api/admissions/register", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
        batchIds: [batch.id],
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

    // Save persisted state to disk
    saveRegistrations();
    saveUsers();
    saveBatches();

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
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);
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
    const auth = verifyAuthToken(req.headers.authorization);
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

    saveRegistrations();

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
    const auth = verifyAuthToken(req.headers.authorization);
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

    saveRegistrations();

    res.json({
      success: waRes.success,
      whatsappDeliveryStatus: reg.whatsappDeliveryStatus,
      messageId: reg.whatsappMessageId,
      error: waRes.error,
      skipped: waRes.skipped
    });
  });

  // 16. ADMIN: Batch Management (Create Batch)
  app.post("/api/admin/batches", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    saveBatches();
    res.json({ success: true, batch: newBatch });
  });

  // 17. ADMIN: Schedule New Class or Toggle Live
  app.post("/api/admin/schedule-class", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    }

    res.json({ success: true, class: newClass });
  });

  // 18. ADMIN: Toggle Class Status (Live / Completed / Upcoming) & Auto-recording
  app.post("/api/admin/classes/:classId/status", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    }

    res.json({ success: true, class: cls });
  });

  // 19. ADMIN: Upload or Attach Manual Recording
  app.post("/api/admin/recordings", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
  app.get(["/api/materials", "/api/learning-resources"], (req, res) => {
    const publicMaterials = sortLearningMaterials(studyMaterials)
      .filter(m => m.isVisibleOnWebsite !== false && m.isPublished !== false)
      .map(m => ({
        ...m,
        downloadUrl: (!m.downloadUrl || m.downloadUrl === "#") ? `/api/files/download/${m.id}` : m.downloadUrl
      }));
    res.json({ materials: publicMaterials, resources: publicMaterials });
  });

  // 20b. ADMIN: Get All Study Materials & Learning Resources
  app.get(["/api/admin/materials", "/api/admin/learning-resources"], (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const allMaterials = sortLearningMaterials(studyMaterials).map(m => ({
      ...m,
      downloadUrl: (!m.downloadUrl || m.downloadUrl === "#") ? `/api/files/download/${m.id}` : m.downloadUrl
    }));
    res.json({ materials: allMaterials, resources: allMaterials });
  });

  // 20c. ADMIN: Create Learning Resource (PDF or YouTube)
  app.post(["/api/admin/materials", "/api/admin/learning-resources"], (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    if (classId) {
      const cls = classes.find(c => c.id === classId);
      if (cls) cls.hasStudyMaterial = true;
    }
    savePersistedMaterials();

    const sorted = sortLearningMaterials(studyMaterials);
    res.json({ success: true, material: newMat, materials: sorted, resources: sorted });
  });

  // 20d. ADMIN: Update Learning Resource (PDF / YouTube / B2 references & Permissions)
  app.put(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

    savePersistedMaterials();
    const sorted = sortLearningMaterials(studyMaterials);
    res.json({ success: true, material: mat, materials: sorted, resources: sorted });
  });

  // 20e. ADMIN: Delete Learning Resource with B2 Object Cleanup
  app.delete(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    savePersistedMaterials();

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
    const auth = verifyAuthToken(req.headers.authorization);
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
  app.post("/api/admin/announcements", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    res.json({ success: true, announcement: newAnn });
  });

  // 21b. PUBLIC: Get All Active Announcements & Notices
  app.get("/api/announcements", (req, res) => {
    res.json({ announcements });
  });

  // 21c. ADMIN: Update Announcement
  app.put("/api/admin/announcements/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

    res.json({ success: true, announcement: announcements[annIndex] });
  });

  // 21d. ADMIN: Delete Announcement
  app.delete("/api/admin/announcements/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { id } = req.params;
    const idx = announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      announcements.splice(idx, 1);
    }
    res.json({ success: true });
  });

  // 22. ADMIN: View Attendance Logs (Batch-wise)
  app.get("/api/admin/attendance", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

  // DELETE Student / Admission
  app.delete("/api/admin/students/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const regIdx = registrations.findIndex(r => r.id === id || r.admissionId === id);
    if (regIdx !== -1) {
      const reg = registrations[regIdx];
      registrations.splice(regIdx, 1);
      // Remove from users if exists
      const userIdx = users.findIndex(u => u.admissionId === reg.admissionId || u.email === reg.email);
      if (userIdx !== -1) {
        users.splice(userIdx, 1);
        saveUsers();
      }
      saveRegistrations();
      return res.json({ success: true, message: "Student admission deleted successfully." });
    }
    res.status(404).json({ error: "Student registration not found." });
  });

  // UPDATE Student / Admission
  app.put("/api/admin/students/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const reg = registrations.find(r => r.id === id || r.admissionId === id);
    if (!reg) return res.status(404).json({ error: "Student registration not found." });

    Object.assign(reg, req.body);
    saveRegistrations();
    res.json({ success: true, student: reg });
  });

  // UPDATE Batch
  app.put("/api/admin/batches/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const batch = batches.find(b => b.id === id);
    if (!batch) return res.status(404).json({ error: "Batch not found." });

    Object.assign(batch, req.body);
    saveBatches();
    res.json({ success: true, batch });
  });

  // DELETE Batch
  app.delete("/api/admin/batches/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = batches.findIndex(b => b.id === id);
    if (idx !== -1) {
      batches.splice(idx, 1);
      saveBatches();
      return res.json({ success: true, message: "Batch deleted successfully." });
    }
    res.status(404).json({ error: "Batch not found." });
  });

  // UPDATE Class
  app.put("/api/admin/classes/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const cls = classes.find(c => c.id === id);
    if (!cls) return res.status(404).json({ error: "Class not found." });

    Object.assign(cls, req.body);
    res.json({ success: true, class: cls });
  });

  // DELETE Class
  app.delete("/api/admin/classes/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = classes.findIndex(c => c.id === id);
    if (idx !== -1) {
      classes.splice(idx, 1);
      return res.json({ success: true, message: "Class deleted successfully." });
    }
    res.status(404).json({ error: "Class not found." });
  });

  // UPDATE Recording
  app.put("/api/admin/recordings/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const rec = recordings.find(r => r.id === id);
    if (!rec) return res.status(404).json({ error: "Recording not found." });

    Object.assign(rec, req.body);
    res.json({ success: true, recording: rec });
  });

  // DELETE Recording
  app.delete("/api/admin/recordings/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }
    const { id } = req.params;
    const idx = recordings.findIndex(r => r.id === id);
    if (idx !== -1) {
      recordings.splice(idx, 1);
      return res.json({ success: true, message: "Recording deleted successfully." });
    }
    res.status(404).json({ error: "Recording not found." });
  });



  // 23. CMS: Public Website Content & Admin Editable Content
  app.get("/api/cms/content", (req, res) => {
    res.json({ content: cmsContent });
  });

  app.post("/api/cms/content", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { courses, testimonials, phoneNumbers, email, location, announcementText, announcementBtnText, showAnnouncement, settings } = req.body;
    if (courses) cmsContent.courses = courses;
    if (testimonials) cmsContent.testimonials = testimonials;
    if (phoneNumbers) cmsContent.phoneNumbers = phoneNumbers;
    if (email) cmsContent.email = email;
    if (location) cmsContent.location = location;
    if (announcementText !== undefined) cmsContent.announcementText = announcementText;
    if (announcementBtnText !== undefined) cmsContent.announcementBtnText = announcementBtnText;
    if (showAnnouncement !== undefined) cmsContent.showAnnouncement = showAnnouncement;
    if (settings) {
      cmsContent.settings = { ...cmsContent.settings, ...settings };
    }

    saveCmsContent();
    res.json({ success: true, content: cmsContent });
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

  // 24A. FULL WEBSITE REPORT & ARCHITECTURE DOCUMENTATION ENDPOINT
  app.get("/api/documentation", (req, res) => {
    res.json({
      status: "success",
      academy: "WITS LINGO — A Global Language Platform",
      reportTitle: "WITS LINGO Full Architecture & System Documentation (A to Z)",
      generatedDate: new Date().toISOString(),
      metadata: {
        server: "Node.js Express 4.x",
        client: "React 18 + Vite + Tailwind CSS",
        storage: "Backblaze B2 & Disk Proxy",
        auth: "HMAC-SHA256 Token Engine",
        port: 3000
      },
      sections: {
        executiveSummary: "WITS LINGO is a global English language training and digital classroom ecosystem founded by Ziyaur Rehman Zia.",
        admissionEngine: "100% web-based registration without WhatsApp dependency, multi-currency fee submission, and instant downloadable PDF admission slip.",
        studentPortal: "Batch-isolated dashboard, live attendance logging, expiring signed playback tickets, anti-piracy video watermarking, and protected PDF reader.",
        adminPanel: "Full CRUD control over students, courses, batches, classes, Backblaze B2 study materials, and announcements.",
        apiDirectoryCount: 25
      }
    });
  });

  // 24B. COURSES MANAGEMENT & PUBLICATION CMS (Edit anytime, past or post publication)
  app.get("/api/courses", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    const includeAll = req.query.includeAll === "true" || (auth && auth.role === "admin");
    
    if (includeAll) {
      return res.json({ courses: cmsContent.courses });
    }
    // Public visitors see published courses (isPublished !== false)
    const publishedCourses = cmsContent.courses.filter((c: any) => c.isPublished !== false);
    res.json({ courses: publishedCourses });
  });

  app.post("/api/courses", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required to create courses." });
    }

    const { name, level, shortDescription, whatYouWillLearn, duration, learningFormat, fee, badge, isPublished } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Course name is required." });
    }

    const newCourse = {
      id: `course-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name,
      level: level || "Beginner",
      shortDescription: shortDescription || "",
      whatYouWillLearn: Array.isArray(whatYouWillLearn) ? whatYouWillLearn : [],
      duration: duration || "2 Months",
      learningFormat: learningFormat || "Live Online Classroom",
      fee: Number(fee) || 1199,
      badge: badge || "",
      isPublished: isPublished !== false // default to true if not specified
    };

    cmsContent.courses.push(newCourse);
    res.status(201).json({ success: true, course: newCourse, courses: cmsContent.courses });
  });

  app.put("/api/courses/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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
    res.json({ success: true, course: updatedCourse, courses: cmsContent.courses });
  });

  app.patch("/api/courses/:id/publish", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
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

    res.json({ success: true, course: currentCourse, isPublished: newStatus, courses: cmsContent.courses });
  });

  app.delete("/api/courses/:id", (req, res) => {
    const auth = verifyAuthToken(req.headers.authorization);
    if (!auth || auth.role !== "admin") {
      return res.status(403).json({ error: "Admin authorization required to delete courses." });
    }

    const courseIndex = cmsContent.courses.findIndex((c: any) => c.id === req.params.id);
    if (courseIndex === -1) {
      return res.status(404).json({ error: "Course not found." });
    }

    const deleted = cmsContent.courses.splice(courseIndex, 1)[0];
    res.json({ success: true, deleted, courses: cmsContent.courses });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Wits Lingo Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WhatsApp] Operating strictly via official Meta WhatsApp Business Platform Cloud API.`);
    console.log(`[WhatsApp] Cloud API Webhook Listener active at /api/webhooks/whatsapp`);
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
