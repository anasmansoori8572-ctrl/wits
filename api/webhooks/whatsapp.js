// src/api/webhooks/whatsapp.ts
import crypto2 from "crypto";

// src/services/whatsappCloudApiService.ts
import crypto from "crypto";
var WhatsAppCloudApiService = class _WhatsAppCloudApiService {
  constructor() {
  }
  static getInstance() {
    if (!_WhatsAppCloudApiService.instance) {
      _WhatsAppCloudApiService.instance = new _WhatsAppCloudApiService();
    }
    return _WhatsAppCloudApiService.instance;
  }
  // Configuration getters (reading dynamically so env changes don't require process restart)
  get phoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  }
  get businessAccountId() {
    return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "";
  }
  get accessToken() {
    return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
  }
  get graphApiVersion() {
    return process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v21.0";
  }
  get verifyToken() {
    const raw = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "witslingo_meta_verify_token_2026";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get appSecret() {
    return process.env.WHATSAPP_APP_SECRET?.trim() || "";
  }
  get confirmationTemplateName() {
    return process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME?.trim() || "wits_lingo_enrollment_confirmation";
  }
  get templateLanguage() {
    return process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
  }
  get supportPhone() {
    return process.env.WHATSAPP_SUPPORT_PHONE?.trim() || "918791287575";
  }
  /**
   * Diagnostic summary of Meta Cloud API configuration
   */
  getDiagnostics() {
    return {
      provider: "cloud_api",
      configured: Boolean(this.phoneNumberId && this.accessToken),
      hasPhoneNumberId: Boolean(this.phoneNumberId),
      hasAccessToken: Boolean(this.accessToken),
      hasAppSecret: Boolean(this.appSecret),
      hasBusinessAccountId: Boolean(this.businessAccountId),
      hasWebhookVerifyTokenEnv: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
      graphApiVersion: this.graphApiVersion,
      confirmationTemplateName: this.confirmationTemplateName,
      templateLanguage: this.templateLanguage,
      supportPhone: this.supportPhone,
      endpoint: `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId || "{PHONE_NUMBER_ID}"}/messages`
    };
  }
  /**
   * Normalize any phone number into clean E.164 digits without '+' or punctuation.
   * Defaults to Indian country code '91' if 10 digits provided.
   */
  normalizePhone(phone) {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  }
  /**
   * Verify Webhook challenge from Meta Developers Console (GET /api/webhooks/whatsapp)
   */
  verifyWebhookChallenge(mode, token, challenge) {
    if (mode === "subscribe" && token === this.verifyToken && challenge) {
      return challenge;
    }
    return null;
  }
  /**
   * Validate Meta webhook HMAC SHA-256 signature using WHATSAPP_APP_SECRET
   */
  validateWebhookSignature(rawBody, signatureHeader) {
    if (!this.appSecret) {
      return true;
    }
    if (!signatureHeader) return false;
    try {
      const parts = signatureHeader.split("=");
      if (parts.length !== 2 || parts[0] !== "sha256") return false;
      const signature = parts[1];
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");
      const expectedSignature = crypto.createHmac("sha256", this.appSecret).update(bodyBuffer).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
    } catch (e) {
      console.warn("[WhatsApp Cloud API] Signature validation error:", e);
      return false;
    }
  }
  /**
   * Low-level HTTP POST to Meta Graph API with retry for transient errors
   */
  async postToGraphApi(payload, maxRetries = 2) {
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        success: false,
        status: "failed",
        error: "WhatsApp Cloud API is not configured: Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in server environment.",
        isTransient: false
      };
    }
    const url = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`;
    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12e3);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (res.ok && data?.messages?.[0]?.id) {
          return {
            success: true,
            status: "accepted",
            // Accepted by Meta Graph API; delivery confirmed asynchronously via Webhook
            messageId: data.messages[0].id,
            httpStatus: res.status
          };
        }
        const errorCode = data?.error?.code;
        const errorMessage = data?.error?.message || `Meta API HTTP ${res.status}`;
        const isRateLimit = errorCode === 80007 || errorCode === 4 || errorCode === 17 || res.status === 429;
        const isServerError = res.status >= 500 && res.status < 600;
        const isTransient = isRateLimit || isServerError;
        if (isTransient && attempt <= maxRetries) {
          const delayMs = Math.min(1e3 * Math.pow(2, attempt), 5e3);
          console.warn(`[WhatsApp Cloud API] Transient error (Code: ${errorCode}, Status: ${res.status}). Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return {
          success: false,
          status: "failed",
          error: errorMessage,
          errorCode,
          httpStatus: res.status,
          isTransient
        };
      } catch (networkErr) {
        const isAbort = networkErr?.name === "AbortError";
        const isTransient = true;
        if (attempt <= maxRetries) {
          const delayMs = 1500 * attempt;
          console.warn(`[WhatsApp Cloud API] Network ${isAbort ? "timeout" : "failure"}. Retrying attempt ${attempt}...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return {
          success: false,
          status: "failed",
          error: isAbort ? "Meta Graph API request timed out (12s)" : networkErr?.message || "Network exception",
          isTransient: true
        };
      }
    }
    return {
      success: false,
      status: "failed",
      error: "Max retries exhausted for Meta Graph API call",
      isTransient: false
    };
  }
  /**
   * Send a standard free-form text message via Meta Cloud API.
   * Note: Works within the 24-hour customer service window after a student messages the business.
   */
  async sendTextMessage(recipientPhone, messageText, previewUrl = true) {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return { success: false, status: "failed", error: "Invalid recipient phone number", isTransient: false };
    }
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "text",
      text: {
        preview_url: previewUrl,
        body: messageText
      }
    };
    return this.postToGraphApi(payload);
  }
  /**
   * Send an approved Meta WhatsApp Template message.
   * Required for starting conversations or sending transactional receipts outside the 24h window.
   */
  async sendTemplateMessage(recipientPhone, templateName, languageCode, components = []) {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return { success: false, status: "failed", error: "Invalid recipient phone number", isTransient: false };
    }
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode || "en" }
      }
    };
    if (components && components.length > 0) {
      payload.template.components = components;
    }
    return this.postToGraphApi(payload);
  }
  /**
   * Send interactive Quick Reply buttons (up to 3 buttons)
   */
  async sendInteractiveButtons(recipientPhone, bodyText, buttons, headerText, footerText) {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return { success: false, status: "failed", error: "Invalid recipient phone number", isTransient: false };
    }
    const validButtons = buttons.slice(0, 3).map((btn) => ({
      type: "reply",
      reply: {
        id: btn.id.substring(0, 256),
        title: btn.title.substring(0, 20)
      }
    }));
    const interactivePayload = {
      type: "button",
      body: { text: bodyText },
      action: { buttons: validButtons }
    };
    if (headerText) {
      interactivePayload.header = { type: "text", text: headerText };
    }
    if (footerText) {
      interactivePayload.footer = { text: footerText };
    }
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "interactive",
      interactive: interactivePayload
    };
    return this.postToGraphApi(payload);
  }
  /**
   * Parse incoming Webhook payload into structured events
   */
  parseWebhookPayload(body) {
    const messages = [];
    const statuses = [];
    if (!body || body.object !== "whatsapp_business_account") {
      return { messages, statuses };
    }
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value || value.messaging_product !== "whatsapp") continue;
        if (Array.isArray(value.statuses)) {
          for (const s of value.statuses) {
            if (s.id && s.status) {
              statuses.push({
                messageId: s.id,
                recipientPhone: s.recipient_id || "",
                status: s.status,
                timestamp: s.timestamp ? new Date(parseInt(s.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
                errors: s.errors,
                rawPayload: s
              });
            }
          }
        }
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            const senderPhone = this.normalizePhone(m.from || "");
            const msgId = m.id;
            const ts = m.timestamp ? new Date(parseInt(m.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
            if (m.type === "text" && m.text?.body) {
              messages.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: "text",
                textBody: m.text.body,
                rawPayload: m
              });
            } else if (m.type === "interactive" && m.interactive?.button_reply) {
              messages.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: "interactive_button",
                textBody: m.interactive.button_reply.title,
                buttonPayload: {
                  id: m.interactive.button_reply.id,
                  title: m.interactive.button_reply.title
                },
                rawPayload: m
              });
            } else {
              messages.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: "unsupported",
                textBody: m.text?.body || `[${m.type} message]`,
                rawPayload: m
              });
            }
          }
        }
      }
    }
    return { messages, statuses };
  }
};
var whatsappCloudApiService = WhatsAppCloudApiService.getInstance();

// src/services/whatsappNotificationService.ts
import fs from "fs";
import path from "path";

// src/config/witsLingoConfig.ts
var WITS_LINGO_CONFIG = {
  // Fixed permanent WhatsApp Business sender number
  WHATSAPP_BUSINESS_NUMBER: "+91 87912 87575",
  WHATSAPP_BUSINESS_NUMBER_CLEAN: "918791287575",
  // Fixed permanent Google Meet class link
  GOOGLE_MEET_LINK: "https://meet.google.com/wwu-zohu-yij",
  // Academy Metadata
  ACADEMY_NAME: "Wits Lingo Academy",
  ACADEMY_TAGLINE: "A Global Language Platform",
  SUPPORT_EMAIL: "witslingo@gmail.com",
  WEBSITE_URL: "https://witslingo.com",
  FALLBACK_START_DATE: "1st of the upcoming month",
  DEFAULT_SCHEDULE_TIME: "Monday, Wednesday & Friday (7:30 PM - 8:30 PM IST)"
};

// src/services/whatsappNotificationService.ts
var WhatsAppNotificationService = class _WhatsAppNotificationService {
  constructor() {
    this.notifications = [];
    this.filePath = path.join(process.cwd(), "uploads", "data", "notifications.json");
    this.loadNotifications();
  }
  static getInstance() {
    if (!_WhatsAppNotificationService.instance) {
      _WhatsAppNotificationService.instance = new _WhatsAppNotificationService();
    }
    return _WhatsAppNotificationService.instance;
  }
  loadNotifications() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.notifications = JSON.parse(raw);
      } else {
        this.notifications = [];
      }
    } catch (e) {
      console.warn("[WhatsAppNotificationService] Error loading notifications:", e);
      this.notifications = [];
    }
  }
  saveNotifications() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.notifications, null, 2), "utf-8");
    } catch (e) {
      console.error("[WhatsAppNotificationService] Error saving notifications:", e);
    }
  }
  getAllNotifications() {
    this.loadNotifications();
    return [...this.notifications].sort((a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime());
  }
  getNotificationByMessageId(messageId) {
    this.loadNotifications();
    return this.notifications.find((n) => n.providerMessageId === messageId);
  }
  /**
   * Handle Webhook Delivery Status updates from Meta (sent, delivered, read, failed)
   */
  updateDeliveryStatus(messageId, status, timestamp, errorDetails) {
    this.loadNotifications();
    const notif = this.notifications.find((n) => n.providerMessageId === messageId);
    if (!notif) return false;
    notif.messageStatus = status;
    const timeIso = timestamp || (/* @__PURE__ */ new Date()).toISOString();
    if (status === "delivered") notif.deliveredAt = timeIso;
    if (status === "read") notif.readAt = timeIso;
    if (status === "failed" && errorDetails) {
      notif.errorDetails = errorDetails;
    }
    this.saveNotifications();
    console.log(`[WhatsAppNotificationService] Updated message ${messageId} status to '${status}'`);
    return true;
  }
  /**
   * Send the official Payment & Enrollment Confirmation WhatsApp message
   */
  async sendPaymentConfirmation(payload, forceResend = false) {
    this.loadNotifications();
    const existing = this.notifications.find(
      (n) => n.orderId === payload.orderId && (n.messageStatus === "accepted" || n.messageStatus === "sent" || n.messageStatus === "delivered" || n.messageStatus === "read") && n.templateName === "payment_confirmation"
    );
    if (existing && !forceResend) {
      console.log(`[WhatsAppNotificationService] Idempotency: Order ${payload.orderId} confirmation already sent (${existing.providerMessageId}). Skipping.`);
      return { success: true, skipped: true, messageId: existing.providerMessageId };
    }
    const cleanRecipient = whatsappCloudApiService.normalizePhone(payload.studentPhone);
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const studentName = payload.studentName || "Student";
    const courseName = payload.courseName || "Wits Lingo Course";
    const amountStr = `\u20B9${payload.amount.toLocaleString("en-IN")}`;
    const txnId = payload.razorpayPaymentId || "Verified";
    const startDate = payload.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE;
    const scheduleTime = payload.scheduleTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME;
    const meetLink = payload.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
    const supportPhone = WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN || "918791287575";
    const fullMessageText = `Hi ${studentName},

Congratulations! Your payment for Wits Lingo has been confirmed successfully.

Here are your verified enrollment details:
\u2022 Course: ${courseName}
\u2022 Amount Paid: ${amountStr}
\u2022 Transaction ID: ${txnId}
\u2022 Batch Starts: ${startDate}
\u2022 Schedule: ${scheduleTime}

Live Classroom Joining Details:
\u2022 Platform: Google Meet
\u2022 Link: ${meetLink}

Student Portal & Study Materials:
\u2022 Dashboard: https://witslingo.com/login
(Sign in with your email or phone to view live schedule & recordings)

Need any help or batch change? Reply directly to this WhatsApp message or call our support desk at +${supportPhone}.

Welcome aboard!
Team Wits Lingo`;
    let sendResult;
    const templateName = whatsappCloudApiService.confirmationTemplateName;
    if (whatsappCloudApiService.phoneNumberId && whatsappCloudApiService.accessToken) {
      try {
        console.log(`[WhatsAppNotificationService] Attempting template message '${templateName}' to ${cleanRecipient}...`);
        sendResult = await whatsappCloudApiService.sendTemplateMessage(
          cleanRecipient,
          templateName,
          whatsappCloudApiService.templateLanguage,
          [
            {
              type: "body",
              parameters: [
                { type: "text", text: studentName },
                { type: "text", text: courseName },
                { type: "text", text: amountStr },
                { type: "text", text: txnId },
                { type: "text", text: startDate },
                { type: "text", text: meetLink }
              ]
            }
          ]
        );
        if (!sendResult.success && (sendResult.errorCode === 132001 || sendResult.errorCode === 100 || sendResult.error?.includes("template"))) {
          console.warn(`[WhatsAppNotificationService] Meta template '${templateName}' not found or unapproved (Code ${sendResult.errorCode}). Falling back to transactional text message.`);
          sendResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
        }
      } catch (err) {
        console.warn("[WhatsAppNotificationService] Template attempt failed, falling back to text:", err);
        sendResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
      }
    } else {
      sendResult = {
        success: false,
        status: "failed",
        error: "WhatsApp Cloud API credentials not configured in environment variables."
      };
    }
    const notifRecord = {
      id: notifId,
      orderId: payload.orderId,
      studentId: payload.studentId,
      recipientPhone: cleanRecipient,
      channel: "whatsapp",
      templateName: "payment_confirmation",
      messageStatus: sendResult.success ? "accepted" : "failed",
      provider: "meta_cloud_api",
      providerMessageId: sendResult.messageId,
      sentAt: sendResult.success ? now : void 0,
      lastAttemptAt: now,
      retryCount: 1,
      errorDetails: sendResult.error,
      messageBody: fullMessageText
    };
    this.notifications.unshift(notifRecord);
    this.saveNotifications();
    return {
      success: sendResult.success,
      messageId: sendResult.messageId,
      error: sendResult.error
    };
  }
  /**
   * Safe Admin retry for a failed notification
   */
  async retryNotification(id) {
    this.loadNotifications();
    const notif = this.notifications.find((n) => n.id === id);
    if (!notif) return { success: false, error: "Notification record not found" };
    const cleanRecipient = notif.recipientPhone;
    const body = notif.messageBody || "Hello from Wits Lingo! Your admission is confirmed.";
    const sendRes = await whatsappCloudApiService.sendTextMessage(cleanRecipient, body);
    notif.lastAttemptAt = (/* @__PURE__ */ new Date()).toISOString();
    notif.retryCount = (notif.retryCount || 1) + 1;
    if (sendRes.success) {
      notif.messageStatus = "accepted";
      notif.providerMessageId = sendRes.messageId;
      notif.sentAt = (/* @__PURE__ */ new Date()).toISOString();
      notif.errorDetails = void 0;
    } else {
      notif.errorDetails = sendRes.error || "Retry failed via Meta Cloud API";
    }
    this.saveNotifications();
    return { success: sendRes.success, error: sendRes.error };
  }
};
var whatsappNotificationService = WhatsAppNotificationService.getInstance();

// src/services/studentSupportService.ts
import fs4 from "fs";
import path4 from "path";

// src/services/aiSupportService.ts
import fs2 from "fs";
import path2 from "path";
var DATA_DIR = path2.join(process.cwd(), "uploads", "data");
var KB_FILE = path2.join(DATA_DIR, "knowledge-base.json");
var DEFAULT_KNOWLEDGE_BASE = [
  {
    id: "kb-course-foundation",
    category: "course",
    title: "English Foundation Course",
    keywords: ["foundation", "basic", "beginner", "alphabet", "grammar basics", "start from zero", "zero level"],
    content: "English Foundation is designed for learners starting from absolute basics. Fee: \u20B91,199. Duration: 2 Months (40 Live Sessions). Includes basic phonetics, alphabet articulation, simple sentence framing without translation, overcoming stage fear, and foundation grammar workbook (PDF).",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-course-spoken",
    category: "course",
    title: "Spoken English Course",
    keywords: ["spoken", "spoken english", "speaking", "fluency", "hesitation", "breakout rooms", "conversational"],
    content: "Spoken English is our most popular practical speaking course with Zia Sir. Fee: \u20B91,499. Duration: 2.5 Months (50 Live Sessions). Focuses on eliminating hesitation, daily conversational drills, removal of Mother Tongue Influence (MTI), and thinking directly in English.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-course-vocabulary",
    category: "course",
    title: "English Vocabulary Course",
    keywords: ["vocab", "vocabulary", "words", "idioms", "phrases", "collocations"],
    content: "English Vocabulary course covers 1,000+ active conversational words, idioms, and smart alternatives. Fee: \u20B9999. Duration: 1.5 Months (30 Interactive Workshops). Includes weekly quizzes and memory retention techniques.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-course-communication",
    category: "course",
    title: "Communication Skills Course",
    keywords: ["communication", "interview", "public speaking", "presentation", "corporate", "email etiquette"],
    content: "Communication Skills is designed for career boost and interview preparation. Fee: \u20B91,699. Duration: 2 Months (35 Masterclass Sessions). Includes job interview simulations, stage presence, email writing, and 1-on-1 mentor feedback.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-course-advanced",
    category: "course",
    title: "Advanced English Course",
    keywords: ["advanced", "executive", "debate", "leadership", "nuanced", "rhetoric"],
    content: "Advanced English is for learners seeking executive fluency and leadership speech. Fee: \u20B91,999. Duration: 3 Months (60 Executive Sessions). Includes spontaneous debate rounds, tone control, and complex synthesis.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-fees-all",
    category: "fee",
    title: "Wits Lingo Course Fees Overview",
    keywords: ["fees", "fee", "price", "pricing", "cost", "kitna hai", "kitne paise", "discount"],
    content: "Wits Lingo Course Fees:\n\u2022 English Foundation: \u20B91,199\n\u2022 Spoken English: \u20B91,499\n\u2022 English Vocabulary: \u20B9999\n\u2022 English Conversation: \u20B91,299\n\u2022 Communication Skills: \u20B91,699\n\u2022 Advanced English: \u20B91,999\nAll fees include live sessions, study materials (PDF), and 60-day class recordings access.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-schedule-timings",
    category: "schedule",
    title: "Class Timings & Batch Schedules",
    keywords: ["timing", "timings", "schedule", "time", "kab hoti hai", "start date", "batch start", "class time"],
    content: `Live batches are held in the evening: ${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}. New batches start from the ${WITS_LINGO_CONFIG.FALLBACK_START_DATE}. Full schedules and recording replays are accessible in your Student Dashboard.`,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-joining-meet",
    category: "joining_link",
    title: "Live Class Joining Link & Google Meet",
    keywords: ["meet", "link", "google meet", "join", "class link", "kaise join karein", "session link"],
    content: `Official live classes are conducted online via Google Meet.
Permanent Joining Link: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
Please ensure you are logged in with your registered email before joining the class room.`,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-certificate-policy",
    category: "certificate",
    title: "Course Completion Certificate",
    keywords: ["certificate", "cert", "completion", "marksheet", "diploma"],
    content: "Students receive an official verifiable Wits Lingo Academy Certificate upon completing the course with at least 80% attendance in live sessions and passing the final practical speaking evaluation.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-refund-policy",
    category: "refund",
    title: "Refund & Cancellation Policy",
    keywords: ["refund", "money back", "cancel", "cancellation", "wapas", "return"],
    content: "Wits Lingo offers a 100% money-back guarantee within the first 7 days of batch commencement if you are not fully satisfied with the teaching quality. To initiate a refund, simply request support here or email witslingo@gmail.com with your transaction ID.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "kb-founder-zia",
    category: "general",
    title: "About Founder Ziyaur Rehman Zia",
    keywords: ["mentor", "teacher", "founder", "zia", "sir", "trainer", "who teaches"],
    content: "All primary live sessions are personally conducted by Ziyaur Rehman Zia (Zia Sir), celebrated English language educator and founder of Wits Lingo, known for his zero-hesitation, conversational speaking pedagogy.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var AiSupportService = class {
  constructor() {
    this.knowledgeBase = [];
    this.loadKnowledgeBase();
  }
  loadKnowledgeBase() {
    try {
      if (!fs2.existsSync(DATA_DIR)) {
        fs2.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs2.existsSync(KB_FILE)) {
        const raw = fs2.readFileSync(KB_FILE, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          this.knowledgeBase = data;
          return;
        }
      }
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
      fs2.writeFileSync(KB_FILE, JSON.stringify(this.knowledgeBase, null, 2), "utf-8");
    } catch (err) {
      console.warn("[AI Support] Error loading knowledge base, using in-memory defaults:", err);
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
    }
  }
  getKnowledgeBase() {
    return this.knowledgeBase;
  }
  saveKnowledgeBase(items) {
    this.knowledgeBase = items;
    try {
      if (!fs2.existsSync(DATA_DIR)) {
        fs2.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs2.writeFileSync(KB_FILE, JSON.stringify(items, null, 2), "utf-8");
    } catch (err) {
      console.error("[AI Support] Error saving knowledge base to disk:", err);
    }
  }
  addOrUpdateKnowledgeItem(item) {
    const existingIndex = this.knowledgeBase.findIndex((k) => k.id === item.id);
    const updated = {
      ...item,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existingIndex >= 0) {
      this.knowledgeBase[existingIndex] = updated;
    } else {
      this.knowledgeBase.push(updated);
    }
    this.saveKnowledgeBase(this.knowledgeBase);
    return updated;
  }
  deleteKnowledgeItem(id) {
    const initialLen = this.knowledgeBase.length;
    this.knowledgeBase = this.knowledgeBase.filter((k) => k.id !== id);
    if (this.knowledgeBase.length !== initialLen) {
      this.saveKnowledgeBase(this.knowledgeBase);
      return true;
    }
    return false;
  }
  /**
   * Process a student inquiry and return a verified, accurate answer or escalate to human agent.
   */
  async answerInquiry(question, studentCtx) {
    const trimmed = (question || "").trim();
    if (!trimmed) {
      return {
        replyText: "Hi! How can I assist you with your Wits Lingo courses today? Ask me about course fees, class timings, joining links, or your enrollment details.",
        shouldEscalate: false,
        confidence: 1
      };
    }
    const lowerQ = trimmed.toLowerCase();
    const isRefundRequest = lowerQ.includes("refund") || lowerQ.includes("cancel my course") || lowerQ.includes("money back") || lowerQ.includes("paise wapas");
    const isPaymentDispute = lowerQ.includes("fraud") || lowerQ.includes("payment failed but debited") || lowerQ.includes("paise kat gaye") || lowerQ.includes("money deducted");
    const isHumanRequest = lowerQ.includes("talk to human") || lowerQ.includes("speak with agent") || lowerQ.includes("call me") || lowerQ.includes("human agent") || lowerQ.includes("zia sir se baat");
    if (isRefundRequest) {
      return {
        replyText: `I understand you have a refund / cancellation request regarding Wits Lingo. Under our 7-day money-back policy, your request has been escalated to our administration desk. A support ticket has been created for you, and our team will contact you within 24 hours to process it.`,
        shouldEscalate: true,
        escalationCategory: "refund_request",
        escalationPriority: "high",
        confidence: 0.95
      };
    }
    if (isPaymentDispute) {
      return {
        replyText: `I see that you experienced a payment deduction issue. Please do not worry. If money was debited from your bank/UPI, Razorpay will either auto-reconcile within 24-48 hours or refund it automatically. I have logged an urgent support ticket with our accounts team to verify your payment status manually.`,
        shouldEscalate: true,
        escalationCategory: "payment_dispute",
        escalationPriority: "urgent",
        confidence: 0.95
      };
    }
    if (isHumanRequest) {
      return {
        replyText: `Sure! I have forwarded your request to our senior human support team. A team mentor will get in touch with you right away on this WhatsApp number.`,
        shouldEscalate: true,
        escalationCategory: "human_handover",
        escalationPriority: "medium",
        confidence: 0.95
      };
    }
    const isPaymentQuery = lowerQ.includes("my payment") || lowerQ.includes("transaction") || lowerQ.includes("receipt") || lowerQ.includes("mera payment") || lowerQ.includes("payment status");
    const isJoiningLinkQuery = lowerQ.includes("joining link") || lowerQ.includes("class link") || lowerQ.includes("meet link") || lowerQ.includes("kaise join") || lowerQ.includes("how to join class") || lowerQ.includes("google meet") || lowerQ.includes("platform") || lowerQ.includes("conducted");
    if (isPaymentQuery && studentCtx?.enrolledCourses && studentCtx.enrolledCourses.length > 0) {
      const activeEnrollment = studentCtx.enrolledCourses[0];
      return {
        replyText: `Hello ${studentCtx.name || "Student"}! Here is your verified payment record:

\u2022 Course: ${activeEnrollment.courseName}
\u2022 Status: ${activeEnrollment.paymentStatus || "Verified & Paid"}
\u2022 Amount Paid: \u20B9${activeEnrollment.amountPaid || "Confirmed"}
\u2022 Transaction ID: ${activeEnrollment.transactionId || "Verified on Server"}

Your seat is fully confirmed. You can access your full admission slip and materials in your Student Dashboard anytime!`,
        shouldEscalate: false,
        confidence: 0.98
      };
    }
    if (isJoiningLinkQuery) {
      const meetLink = WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
      if (studentCtx?.enrolledCourses && studentCtx.enrolledCourses.length > 0) {
        const activeEnrollment = studentCtx.enrolledCourses[0];
        return {
          replyText: `Hello ${studentCtx.name || "Student"}! Here are your live class details for ${activeEnrollment.courseName}:

\u2022 Live Platform: Google Meet
\u2022 Joining Link: ${meetLink}
\u2022 Schedule: ${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}
\u2022 Start Date: ${activeEnrollment.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE}

Please join 5 minutes before class time!`,
          shouldEscalate: false,
          confidence: 0.98
        };
      } else {
        return {
          replyText: `Our live classes are held online on Google Meet with Zia Sir (${WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME}).
Permanent Class Link: ${meetLink}

To enroll in an upcoming batch, please visit our website and select your course!`,
          shouldEscalate: false,
          confidence: 0.9
        };
      }
    }
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (geminiKey) {
      try {
        const aiRes = await this.queryGemini(trimmed, studentCtx, geminiKey);
        if (aiRes) return aiRes;
      } catch (err) {
        console.warn("[AI Support] Gemini query failed, falling back to local KB engine:", err);
      }
    } else if (openaiKey) {
      try {
        const aiRes = await this.queryOpenAI(trimmed, studentCtx, openaiKey);
        if (aiRes) return aiRes;
      } catch (err) {
        console.warn("[AI Support] OpenAI query failed, falling back to local KB engine:", err);
      }
    }
    return this.matchKnowledgeBase(trimmed, studentCtx);
  }
  /**
   * Internal Semantic / Keyword Matcher over approved Knowledge Base
   */
  matchKnowledgeBase(query, studentCtx) {
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    let bestMatch = null;
    let maxScore = 0;
    for (const item of this.knowledgeBase) {
      let score = 0;
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (query.toLowerCase().includes(kwLower)) {
          score += 3;
        } else {
          for (const token of tokens) {
            if (kwLower.includes(token)) score += 1;
          }
        }
      }
      if (query.toLowerCase().includes(item.title.toLowerCase())) {
        score += 4;
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }
    if (bestMatch && maxScore >= 2) {
      let personalizedContent = bestMatch.content;
      if (studentCtx?.name) {
        personalizedContent = `Hello ${studentCtx.name}!

${personalizedContent}`;
      }
      return {
        replyText: personalizedContent,
        shouldEscalate: false,
        matchedKnowledgeId: bestMatch.id,
        confidence: Math.min(1, 0.6 + maxScore * 0.08)
      };
    }
    return {
      replyText: `Thank you for reaching out to Wits Lingo! I don't have the exact answer to your question in my knowledge base right now. I have created a support ticket for you so our academic team can review your inquiry and message you directly here on WhatsApp.`,
      shouldEscalate: true,
      escalationCategory: "general_query",
      escalationPriority: "medium",
      confidence: 0.3
    };
  }
  /**
   * Query Google Gemini API
   */
  async queryGemini(query, studentCtx, apiKey) {
    if (!apiKey) return null;
    const systemPrompt = `You are the official AI Student Assistant for Wits Lingo \u2014 A Global Language Platform founded by Ziyaur Rehman Zia (Zia Sir).
Your goal is to assist students politely and accurately regarding courses, schedules, fees, Google Meet joining links, and study materials.

STRICT ACCURACY RULES:
1. ONLY provide facts stated in the Knowledge Base below or verified student records. NEVER invent prices, joining links, certificates, or dates.
2. If student asks about live class link, provide: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}.
3. Support both English and polite conversational Hinglish.
4. Keep responses concise, clear, and student-friendly.
5. If the user asks for a refund, has a payment dispute, or asks something outside the knowledge base, state that you are escalating to a human support agent.

VERIFIED KNOWLEDGE BASE:
${JSON.stringify(this.knowledgeBase.map((k) => ({ title: k.title, content: k.content })))}

STUDENT CONTEXT (IF ENROLLED):
${studentCtx ? JSON.stringify(studentCtx) : "Visitor (not yet logged in)"}
`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}

Student Question: "${query}"` }] }
        ],
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.3
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const shouldEscalate = text.toLowerCase().includes("escalat") || text.toLowerCase().includes("support ticket") || text.toLowerCase().includes("human agent");
    return {
      replyText: text.trim(),
      shouldEscalate,
      escalationCategory: shouldEscalate ? "ai_handover" : void 0,
      escalationPriority: "medium",
      confidence: 0.95
    };
  }
  /**
   * Query OpenAI API
   */
  async queryOpenAI(query, studentCtx, apiKey) {
    if (!apiKey) return null;
    const systemPrompt = `You are the official AI Student Assistant for Wits Lingo Academy founded by Zia Sir.
Answer questions based on the Knowledge Base. Keep responses concise and friendly.
Approved Meet Link: ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
Knowledge: ${JSON.stringify(this.knowledgeBase.map((k) => ({ title: k.title, content: k.content })))}
Student: ${studentCtx ? JSON.stringify(studentCtx) : "Visitor"}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        max_tokens: 350,
        temperature: 0.3
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const shouldEscalate = text.toLowerCase().includes("escalat") || text.toLowerCase().includes("support ticket") || text.toLowerCase().includes("human agent");
    return {
      replyText: text.trim(),
      shouldEscalate,
      escalationCategory: shouldEscalate ? "ai_handover" : void 0,
      confidence: 0.95
    };
  }
};
var aiServiceInstance = null;
function getAiSupportService() {
  if (!aiServiceInstance) {
    aiServiceInstance = new AiSupportService();
  }
  return aiServiceInstance;
}
var aiSupportService = getAiSupportService();

// src/services/supportTicketService.ts
import fs3 from "fs";
import path3 from "path";
var SupportTicketService = class _SupportTicketService {
  constructor() {
    this.tickets = [];
    this.filePath = path3.join(process.cwd(), "uploads", "data", "support-tickets.json");
    this.loadTickets();
  }
  static getInstance() {
    if (!_SupportTicketService.instance) {
      _SupportTicketService.instance = new _SupportTicketService();
    }
    return _SupportTicketService.instance;
  }
  loadTickets() {
    try {
      if (fs3.existsSync(this.filePath)) {
        const raw = fs3.readFileSync(this.filePath, "utf-8");
        this.tickets = JSON.parse(raw);
      } else {
        this.tickets = [];
      }
    } catch (e) {
      console.warn("[SupportTicketService] Error loading tickets, initializing empty:", e);
      this.tickets = [];
    }
  }
  saveTickets() {
    try {
      const dir = path3.dirname(this.filePath);
      if (!fs3.existsSync(dir)) fs3.mkdirSync(dir, { recursive: true });
      fs3.writeFileSync(this.filePath, JSON.stringify(this.tickets, null, 2), "utf-8");
    } catch (e) {
      console.error("[SupportTicketService] Error saving tickets:", e);
    }
  }
  getAllTickets(filter) {
    this.loadTickets();
    let result = [...this.tickets];
    if (filter?.status) {
      result = result.filter((t) => t.status.toLowerCase() === filter.status?.toLowerCase());
    }
    if (filter?.phone) {
      const cleanPhone = filter.phone.replace(/\D/g, "");
      result = result.filter((t) => t.studentPhone.includes(cleanPhone));
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getTicketById(id) {
    this.loadTickets();
    return this.tickets.find((t) => t.id === id);
  }
  getActiveTicketForStudent(phone) {
    this.loadTickets();
    const cleanPhone = phone.replace(/\D/g, "");
    return this.tickets.find(
      (t) => t.studentPhone.includes(cleanPhone) && (t.status === "open" || t.status === "assigned" || t.status === "in_progress" || t.status === "waiting_student")
    );
  }
  createTicket(data) {
    this.loadTickets();
    const cleanPhone = whatsappCloudApiService.normalizePhone(data.studentPhone);
    const id = `TKT-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newTicket = {
      id,
      studentId: data.studentId,
      studentName: data.studentName || "Student",
      studentPhone: cleanPhone,
      category: data.category || "human_handover",
      priority: data.priority || "medium",
      subject: data.subject || (data.description.length > 50 ? data.description.substring(0, 50) + "..." : data.description),
      description: data.description,
      status: "open",
      courseName: data.courseName,
      batchName: data.batchName,
      replyHistory: [
        {
          id: `rep_${Date.now()}`,
          sender: "student",
          senderName: data.studentName || "Student",
          messageText: data.description,
          sentAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    this.tickets.unshift(newTicket);
    this.saveTickets();
    console.log(`[SupportTicketService] Created ticket ${newTicket.id} for ${newTicket.studentPhone} (${newTicket.category})`);
    return newTicket;
  }
  updateTicketStatus(id, updates) {
    this.loadTickets();
    const ticket = this.tickets.find((t) => t.id === id);
    if (!ticket) return null;
    if (updates.status) {
      ticket.status = updates.status;
      if (updates.status === "resolved" || updates.status === "closed") {
        ticket.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    if (updates.assignedTo !== void 0) ticket.assignedTo = updates.assignedTo;
    if (updates.notes !== void 0) ticket.notes = updates.notes;
    if (updates.priority) ticket.priority = updates.priority;
    ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveTickets();
    return ticket;
  }
  /**
   * Human Agent sends a direct WhatsApp reply to the student via official Meta Cloud API
   */
  async sendAgentReply(ticketId, agentName, replyText) {
    this.loadTickets();
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return { success: false, error: "Ticket not found" };
    const cleanRecipient = ticket.studentPhone;
    if (!cleanRecipient) return { success: false, error: "Student phone number missing" };
    const sendRes = await whatsappCloudApiService.sendTextMessage(
      cleanRecipient,
      `[Wits Lingo Support - ${agentName || "Mentor"}]

${replyText}`
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const replyRecord = {
      id: `rep_${Date.now()}`,
      sender: "agent",
      senderName: agentName || "Support Agent",
      messageText: replyText,
      sentAt: now,
      whatsappMessageId: sendRes.messageId,
      deliveryStatus: sendRes.success ? "sent" : "failed"
    };
    ticket.replyHistory.push(replyRecord);
    ticket.status = "waiting_student";
    ticket.updatedAt = now;
    this.saveTickets();
    if (!sendRes.success) {
      return {
        success: false,
        error: sendRes.error || "Failed to dispatch WhatsApp message via Meta Cloud API",
        ticket
      };
    }
    return { success: true, ticket };
  }
};
var supportTicketService = SupportTicketService.getInstance();

// src/services/studentSupportService.ts
var StudentSupportService = class _StudentSupportService {
  constructor() {
    this.conversations = [];
    this.messages = [];
    this.processedMessageIds = /* @__PURE__ */ new Set();
    this.conversationsPath = path4.join(process.cwd(), "uploads", "data", "conversations.json");
    this.messagesPath = path4.join(process.cwd(), "uploads", "data", "messages.json");
    this.loadData();
  }
  static getInstance() {
    if (!_StudentSupportService.instance) {
      _StudentSupportService.instance = new _StudentSupportService();
    }
    return _StudentSupportService.instance;
  }
  loadData() {
    try {
      if (fs4.existsSync(this.conversationsPath)) {
        this.conversations = JSON.parse(fs4.readFileSync(this.conversationsPath, "utf-8"));
      }
    } catch (e) {
      this.conversations = [];
    }
    try {
      if (fs4.existsSync(this.messagesPath)) {
        this.messages = JSON.parse(fs4.readFileSync(this.messagesPath, "utf-8"));
        for (const m of this.messages.slice(0, 1e3)) {
          this.processedMessageIds.add(m.id);
        }
      }
    } catch (e) {
      this.messages = [];
    }
  }
  saveData() {
    try {
      const dir = path4.dirname(this.conversationsPath);
      if (!fs4.existsSync(dir)) fs4.mkdirSync(dir, { recursive: true });
      fs4.writeFileSync(this.conversationsPath, JSON.stringify(this.conversations, null, 2), "utf-8");
      fs4.writeFileSync(this.messagesPath, JSON.stringify(this.messages, null, 2), "utf-8");
    } catch (e) {
      console.error("[StudentSupportService] Error saving conversations/messages:", e);
    }
  }
  getConversations() {
    this.loadData();
    return [...this.conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }
  getMessagesForConversation(convId) {
    this.loadData();
    return this.messages.filter((m) => m.conversationId === convId);
  }
  /**
   * Look up student enrollment context strictly by verified phone number from server records
   */
  findStudentContext(phone) {
    const cleanPhone = whatsappCloudApiService.normalizePhone(phone);
    let matchedName;
    let enrolledCourses = [];
    try {
      const ordersPath = path4.join(process.cwd(), "uploads", "data", "orders.json");
      if (fs4.existsSync(ordersPath)) {
        const orders = JSON.parse(fs4.readFileSync(ordersPath, "utf-8"));
        const studentOrders = orders.filter((o) => {
          const oPhone = whatsappCloudApiService.normalizePhone(o.studentPhone || "");
          return oPhone && (oPhone === cleanPhone || oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone));
        });
        if (studentOrders.length > 0) {
          const latest = studentOrders[0];
          matchedName = latest.studentName;
          enrolledCourses = studentOrders.filter((o) => o.orderStatus === "paid").map((o) => ({
            courseName: o.courseName,
            courseId: o.courseId,
            paymentStatus: o.orderStatus,
            amountPaid: o.expectedAmount,
            transactionId: o.razorpayPaymentId || o.id,
            startDate: WITS_LINGO_CONFIG.FALLBACK_START_DATE
          }));
        }
      }
    } catch (e) {
    }
    if (!matchedName) {
      try {
        const regPath = path4.join(process.cwd(), "uploads", "data", "registrations.json");
        if (fs4.existsSync(regPath)) {
          const registrations = JSON.parse(fs4.readFileSync(regPath, "utf-8"));
          const match = registrations.find((r) => {
            const rPhone = whatsappCloudApiService.normalizePhone(r.phone || r.whatsappPhone || "");
            return rPhone && (rPhone === cleanPhone || rPhone.endsWith(cleanPhone) || cleanPhone.endsWith(rPhone));
          });
          if (match) {
            matchedName = match.name || match.fullName;
          }
        }
      } catch (e) {
      }
    }
    const studentCtx = matchedName ? {
      name: matchedName,
      phone: cleanPhone,
      enrolledCourses
    } : void 0;
    return { studentName: matchedName, studentContext: studentCtx };
  }
  /**
   * Main inbound student message handler from Meta WhatsApp Cloud API Webhook
   */
  async handleInboundMessage(event) {
    const { messageId, senderPhone, timestamp, textBody } = event;
    if (this.processedMessageIds.has(messageId)) {
      console.log(`[StudentSupportService] Duplicate message ID ${messageId} ignored.`);
      return { handled: true, reason: "duplicate_message_id" };
    }
    this.processedMessageIds.add(messageId);
    const text = (textBody || "").trim();
    if (!text) {
      return { handled: true, reason: "empty_body" };
    }
    const cleanSender = whatsappCloudApiService.normalizePhone(senderPhone);
    const convId = `conv_${cleanSender}`;
    const now = timestamp || (/* @__PURE__ */ new Date()).toISOString();
    const { studentName, studentContext } = this.findStudentContext(cleanSender);
    const finalStudentName = studentName || "Student";
    let conv = this.conversations.find((c) => c.id === convId);
    if (!conv) {
      conv = {
        id: convId,
        studentPhone: cleanSender,
        studentName: finalStudentName,
        lastMessageAt: now,
        unreadCount: 1,
        isEscalated: false,
        status: "active"
      };
      this.conversations.unshift(conv);
    } else {
      conv.lastMessageAt = now;
      conv.unreadCount += 1;
      if (studentName) conv.studentName = studentName;
    }
    const incomingMsgRecord = {
      id: messageId,
      conversationId: convId,
      senderPhone: cleanSender,
      senderName: finalStudentName,
      senderType: "student",
      text,
      timestamp: now,
      provider: "meta_cloud_api",
      status: "delivered"
    };
    this.messages.unshift(incomingMsgRecord);
    this.saveData();
    const activeTicket = supportTicketService.getActiveTicketForStudent(cleanSender);
    if (activeTicket && activeTicket.status === "in_progress" && activeTicket.assignedTo) {
      console.log(`[StudentSupportService] Student ${cleanSender} has active assigned ticket (${activeTicket.id}). Silencing AI auto-reply to prevent agent conflict.`);
      activeTicket.replyHistory.push({
        id: `rep_${Date.now()}`,
        sender: "student",
        senderName: finalStudentName,
        messageText: text,
        sentAt: now
      });
      activeTicket.status = "open";
      activeTicket.updatedAt = now;
      supportTicketService.updateTicketStatus(activeTicket.id, { status: "open" });
      return { handled: true, replySent: false, reason: "human_agent_active" };
    }
    const aiResult = await aiSupportService.answerInquiry(text, studentContext);
    let ticketCreated = false;
    if (aiResult.shouldEscalate) {
      conv.isEscalated = true;
      conv.status = "escalated";
      const ticket = supportTicketService.createTicket({
        studentName: finalStudentName,
        studentPhone: cleanSender,
        category: aiResult.escalationCategory || "human_handover",
        priority: aiResult.escalationPriority || "medium",
        description: text,
        courseName: studentContext?.enrolledCourses?.[0]?.courseName
      });
      ticketCreated = true;
    }
    const replyText = aiResult.replyText;
    const sendRes = await whatsappCloudApiService.sendTextMessage(cleanSender, replyText);
    const outboundMsgRecord = {
      id: sendRes.messageId || `msg_ai_${Date.now()}`,
      conversationId: convId,
      senderPhone: "system",
      senderName: "Wits Lingo AI Assistant",
      senderType: "ai",
      text: replyText,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      provider: "meta_cloud_api",
      status: sendRes.success ? "sent" : "failed"
    };
    this.messages.unshift(outboundMsgRecord);
    this.saveData();
    console.log(`[StudentSupportService] Replied to ${cleanSender} via Meta Cloud API (${sendRes.success ? "Success" : "Failed: " + sendRes.error})`);
    return {
      handled: true,
      replySent: sendRes.success,
      ticketCreated
    };
  }
};
var studentSupportService = StudentSupportService.getInstance();

// src/api/webhooks/whatsapp.ts
var config = {
  api: {
    bodyParser: false
  }
};
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}
async function handler(req, res) {
  const method = req.method?.toUpperCase();
  if (method === "GET") {
    try {
      const queryParams = {};
      if (req.query && typeof req.query === "object") {
        for (const [k, v] of Object.entries(req.query)) {
          if (typeof v === "string") queryParams[k] = v;
          else if (Array.isArray(v) && typeof v[0] === "string") queryParams[k] = v[0];
        }
      }
      if (req.url && req.url.includes("?")) {
        try {
          const parsedUrl = new URL(req.url, "https://www.witslingo.com");
          for (const [k, v] of parsedUrl.searchParams.entries()) {
            if (!queryParams[k]) queryParams[k] = v;
          }
        } catch {
        }
      }
      const mode = (queryParams["hub.mode"] || queryParams["mode"] || "").trim();
      const token = (queryParams["hub.verify_token"] || queryParams["verify_token"] || "").trim();
      const challenge = (queryParams["hub.challenge"] || queryParams["challenge"] || "").trim();
      const rawConfiguredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "witslingo_meta_verify_token_2026";
      const configuredToken = rawConfiguredToken.trim().replace(/^["']|["']$/g, "");
      if (!mode && !token && !challenge) {
        if (typeof res.setHeader === "function") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        const healthPayload = {
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
        };
        if (typeof res.status === "function") {
          return res.status(200).json(healthPayload);
        }
        res.statusCode = 200;
        return res.end(JSON.stringify(healthPayload));
      }
      if (mode !== "subscribe") {
        console.warn(`[Meta Webhook GET] Handshake rejected: invalid hub.mode "${mode}". Expected "subscribe".`);
        if (typeof res.status === "function") {
          return res.status(400).send('Bad Request: hub.mode must be "subscribe"');
        }
        res.statusCode = 400;
        return res.end('Bad Request: hub.mode must be "subscribe"');
      }
      if (token !== configuredToken) {
        console.warn("[Meta Webhook GET] Handshake rejected: verification token mismatch.");
        if (typeof res.status === "function") {
          return res.status(403).send("Forbidden: Verification token mismatch");
        }
        res.statusCode = 403;
        return res.end("Forbidden: Verification token mismatch");
      }
      if (!challenge) {
        console.warn("[Meta Webhook GET] Handshake rejected: missing hub.challenge.");
        if (typeof res.status === "function") {
          return res.status(400).send("Bad Request: Missing hub.challenge");
        }
        res.statusCode = 400;
        return res.end("Bad Request: Missing hub.challenge");
      }
      console.log("[Meta Webhook GET] Handshake accepted. Responding HTTP 200 with challenge.");
      if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
      }
      if (typeof res.status === "function") {
        return res.status(200).send(challenge);
      }
      res.statusCode = 200;
      return res.end(challenge);
    } catch (err) {
      console.error("[Meta Webhook GET] Error during handshake:", err);
      if (typeof res.status === "function") {
        return res.status(500).send("Internal Server Error");
      }
      res.statusCode = 500;
      return res.end("Internal Server Error");
    }
  }
  if (method === "POST") {
    try {
      const rawBodyBuffer = await getRawBody(req);
      const signature = req.headers?.["x-hub-signature-256"] || req.headers?.["X-Hub-Signature-256"];
      const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
      if (appSecret) {
        if (!signature || !signature.startsWith("sha256=")) {
          console.warn("[Meta Webhook POST] Missing or malformed X-Hub-Signature-256 header.");
          return res.status(401).json({ error: "Missing or invalid signature header" });
        }
        const expectedSig = crypto2.createHmac("sha256", appSecret).update(rawBodyBuffer).digest("hex");
        const providedSig = signature.substring(7);
        const sigMatches = expectedSig.length === providedSig.length && crypto2.timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(providedSig, "hex"));
        if (!sigMatches) {
          console.warn("[Meta Webhook POST] Invalid X-Hub-Signature-256 HMAC signature.");
          return res.status(401).json({ error: "Invalid webhook signature" });
        }
      }
      if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", "application/json");
      }
      if (typeof res.status === "function") {
        res.status(200).json({ status: "ok" });
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "ok" }));
      }
      let payload;
      try {
        payload = JSON.parse(rawBodyBuffer.toString("utf-8"));
      } catch (parseErr) {
        console.warn("[Meta Webhook POST] Failed to parse JSON body:", parseErr);
        return;
      }
      const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(payload);
      for (const st of statuses) {
        const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : void 0;
        whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
      }
      for (const msg of inboundMessages) {
        console.log(`[Meta Webhook Inbound] Received message from ${msg.senderPhone} (type: ${msg.type})`);
        studentSupportService.handleInboundMessage(msg).catch((err) => {
          console.error("[Meta Webhook Inbound] Exception processing message:", err);
        });
      }
      return;
    } catch (err) {
      console.error("[Meta Webhook POST] Fatal handler error:", err);
      if (!res.headersSent) {
        if (typeof res.status === "function") {
          return res.status(500).json({ error: "Internal server error processing webhook" });
        }
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: "Internal server error processing webhook" }));
      }
    }
  }
  if (typeof res.setHeader === "function") {
    res.setHeader("Allow", "GET, POST");
  }
  if (typeof res.status === "function") {
    return res.status(405).send(`Method ${method} Not Allowed`);
  }
  res.statusCode = 405;
  return res.end(`Method ${method} Not Allowed`);
}
export {
  config,
  handler as default
};
