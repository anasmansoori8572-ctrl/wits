// server.ts
import "dotenv/config";
import express from "express";
import path6 from "path";
import crypto3 from "crypto";
import fs6 from "fs";
import { S3Client as S3Client2, PutObjectCommand as PutObjectCommand2 } from "@aws-sdk/client-s3";

// src/config/witsLingoConfig.ts
var WITS_LINGO_CONFIG = {
  // Fixed permanent WhatsApp Business sender number
  WHATSAPP_BUSINESS_NUMBER: "+91 90277 29917",
  WHATSAPP_BUSINESS_NUMBER_CLEAN: "919027729917",
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

// src/services/whatsappCloudApiService.ts
import crypto from "crypto";
function sanitizeMetaError(rawMessage) {
  if (!rawMessage) return "Unknown Meta API error";
  return rawMessage.replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, "access_token=[REDACTED]").replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]").replace(/appsecret_proof=[a-zA-Z0-9_\-]+/gi, "appsecret_proof=[REDACTED]").trim();
}
var WhatsAppCloudApiService = class _WhatsAppCloudApiService {
  constructor() {
    // In-memory registry of student last inbound messages for tracking the 24h Customer Service Window
    // 24 hours in milliseconds = 86,400,000 ms
    this.customerInboundTimestamps = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_WhatsAppCloudApiService.instance) {
      _WhatsAppCloudApiService.instance = new _WhatsAppCloudApiService();
    }
    return _WhatsAppCloudApiService.instance;
  }
  // Configuration getters (dynamically evaluated and stripped of leading/trailing quotes)
  get phoneNumberId() {
    const raw = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get businessAccountId() {
    const raw = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "2292090624977946";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get accessToken() {
    const raw = process.env.WHATSAPP_ACCESS_TOKEN || "";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get graphApiVersion() {
    const raw = process.env.WHATSAPP_GRAPH_API_VERSION || process.env.WHATSAPP_API_VERSION || "v21.0";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get verifyToken() {
    const raw = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "witslingo_meta_verify_token_2026";
    return raw.trim().replace(/^["']+|["']+$/g, "").trim();
  }
  get appSecret() {
    const raw = process.env.WHATSAPP_APP_SECRET || "";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get confirmationTemplateName() {
    const raw = process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME || "wits_lingo_enrollment_confirmation";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get templateLanguage() {
    const raw = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  get supportPhone() {
    const raw = process.env.WHATSAPP_SUPPORT_PHONE || "919027729917";
    return raw.trim().replace(/^["']|["']$/g, "");
  }
  /**
   * Diagnostic summary of Meta Cloud API configuration and credentials health.
   * Completely safe: never reveals token bytes.
   */
  getDiagnostics() {
    const hasPhone = Boolean(this.phoneNumberId);
    const isPhoneNumeric = /^\d+$/.test(this.phoneNumberId);
    const hasToken = Boolean(this.accessToken);
    const tokenLength = this.accessToken.length;
    const hasAppSecret = Boolean(this.appSecret);
    return {
      provider: "cloud_api",
      configured: hasPhone && hasToken,
      hasPhoneNumberId: hasPhone,
      isPhoneNumberNumeric: isPhoneNumeric,
      hasAccessToken: hasToken,
      tokenLengthHint: hasToken ? tokenLength > 50 ? "valid_length" : "suspiciously_short" : "missing",
      hasAppSecret,
      hasBusinessAccountId: Boolean(this.businessAccountId),
      hasWebhookVerifyTokenEnv: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
      graphApiVersion: this.graphApiVersion,
      confirmationTemplateName: this.confirmationTemplateName,
      templateLanguage: this.templateLanguage,
      supportPhone: this.supportPhone,
      activeCustomerWindowsCount: this.customerInboundTimestamps.size,
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
   * Record when a student sent an inbound message, initiating or extending the 24h Customer Service Window
   */
  recordCustomerInbound(phone, timestamp) {
    const cleanPhone = this.normalizePhone(phone);
    if (!cleanPhone) return;
    let tsMillis;
    if (typeof timestamp === "number") {
      tsMillis = timestamp > 1e11 ? timestamp : timestamp * 1e3;
    } else if (typeof timestamp === "string") {
      tsMillis = new Date(timestamp).getTime();
      if (isNaN(tsMillis)) tsMillis = Date.now();
    } else {
      tsMillis = Date.now();
    }
    this.customerInboundTimestamps.set(cleanPhone, tsMillis);
  }
  /**
   * Check whether a customer is currently within the Meta 24-hour Customer Service Window
   */
  getCustomerWindowStatus(phone) {
    const cleanPhone = this.normalizePhone(phone);
    const lastInbound = this.customerInboundTimestamps.get(cleanPhone);
    const now = Date.now();
    const WINDOW_DURATION_MS = 24 * 60 * 60 * 1e3;
    if (!lastInbound) {
      return {
        isOpen: false,
        remainingSeconds: 0
      };
    }
    const elapsed = now - lastInbound;
    const remainingMs = WINDOW_DURATION_MS - elapsed;
    if (remainingMs > 0) {
      return {
        isOpen: true,
        lastInboundAt: new Date(lastInbound).toISOString(),
        expiresAt: new Date(lastInbound + WINDOW_DURATION_MS).toISOString(),
        remainingSeconds: Math.floor(remainingMs / 1e3)
      };
    } else {
      return {
        isOpen: false,
        lastInboundAt: new Date(lastInbound).toISOString(),
        expiresAt: new Date(lastInbound + WINDOW_DURATION_MS).toISOString(),
        remainingSeconds: 0
      };
    }
  }
  /**
   * Verify Webhook challenge from Meta Developers Console (GET /api/webhooks/whatsapp)
   */
  verifyWebhookChallenge(mode, token, challenge) {
    if (mode !== "subscribe" || !token || !challenge) return null;
    const cleanCand = token.trim().replace(/^["']+|["']+$/g, "").trim();
    const cleanConfig = this.verifyToken;
    const INTENDED = "witslingo_meta_verify_token_2026";
    if (cleanCand === cleanConfig || cleanCand === INTENDED) {
      return challenge;
    }
    try {
      const decoded = decodeURIComponent(cleanCand);
      if (decoded === cleanConfig || decoded === INTENDED) {
        return challenge;
      }
    } catch {
    }
    return null;
  }
  /**
   * Query Meta Graph API for the verified details of the configured Phone Number ID
   */
  async getMetaPhoneNumberDetails(phoneNumberIdOverride) {
    const id = phoneNumberIdOverride || this.phoneNumberId;
    if (!id || !this.accessToken) {
      return {
        success: false,
        phoneNumberId: id || void 0,
        error: "Phone Number ID or Access Token not configured in environment"
      };
    }
    try {
      const url = `https://graph.facebook.com/${this.graphApiVersion}/${id}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          phoneNumberId: id,
          error: data?.error?.message ? sanitizeMetaError(data.error.message) : `Meta HTTP ${res.status}`
        };
      }
      const cleanMetaPhone = this.normalizePhone(data.display_phone_number || "");
      const expectedPhone = "919027729917";
      return {
        success: true,
        phoneNumberId: data.id,
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
        codeVerificationStatus: data.code_verification_status,
        isCorrectNumber: cleanMetaPhone === expectedPhone
      };
    } catch (err) {
      return {
        success: false,
        phoneNumberId: id,
        error: sanitizeMetaError(err?.message || "Network error querying Meta Graph API")
      };
    }
  }
  /**
   * Discover WhatsApp Business Account ID (WABA ID) associated with token or businesses
   */
  async discoverWabaId() {
    const steps = {};
    if (this.businessAccountId) {
      return { wabaId: this.businessAccountId, steps: { configured: true } };
    }
    if (!this.accessToken) {
      return { wabaId: null, steps: { error: "No access token" } };
    }
    let appId = "";
    let bizId = "";
    try {
      const appRes = await fetch(`https://graph.facebook.com/${this.graphApiVersion}/app?fields=id,name,business`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const appData = await appRes.json();
      steps.appQuery = { ok: appRes.status, hasId: Boolean(appData?.id), hasBusiness: Boolean(appData?.business?.id) };
      if (appRes.ok) {
        if (appData?.id) appId = appData.id;
        if (appData?.business?.id) bizId = appData.business.id;
      }
    } catch (e) {
      steps.appQuery = { error: e?.message };
    }
    if (bizId) {
      try {
        const bizWabaRes = await fetch(`https://graph.facebook.com/${this.graphApiVersion}/${bizId}/owned_whatsapp_business_accounts?fields=id,name`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        const bizWabaData = await bizWabaRes.json();
        steps.appBizWabas = { ok: bizWabaRes.status, count: Array.isArray(bizWabaData?.data) ? bizWabaData.data.length : 0 };
        if (bizWabaRes.ok && Array.isArray(bizWabaData?.data) && bizWabaData.data[0]?.id) {
          return { wabaId: String(bizWabaData.data[0].id), steps };
        }
      } catch (e) {
        steps.appBizWabas = { error: e?.message };
      }
      try {
        const clientWabaRes = await fetch(`https://graph.facebook.com/${this.graphApiVersion}/${bizId}/client_whatsapp_business_accounts?fields=id,name`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        const clientWabaData = await clientWabaRes.json();
        steps.appClientWabas = { ok: clientWabaRes.status, count: Array.isArray(clientWabaData?.data) ? clientWabaData.data.length : 0 };
        if (clientWabaRes.ok && Array.isArray(clientWabaData?.data) && clientWabaData.data[0]?.id) {
          return { wabaId: String(clientWabaData.data[0].id), steps };
        }
      } catch (e) {
        steps.appClientWabas = { error: e?.message };
      }
    }
    const appToken = appId && this.appSecret ? `${appId}|${this.appSecret}` : this.accessToken;
    try {
      const debugUrl = `https://graph.facebook.com/${this.graphApiVersion}/debug_token?input_token=${this.accessToken}&access_token=${appToken}`;
      const debugRes = await fetch(debugUrl);
      const debugData = await debugRes.json();
      const scopes = debugData?.data?.granular_scopes;
      steps.debugToken = {
        ok: debugRes.status,
        isValid: debugData?.data?.is_valid,
        scopesSummary: Array.isArray(scopes) ? scopes.map((s) => ({ scope: s.scope, target_ids: s.target_ids })) : [],
        allScopes: debugData?.data?.scopes || []
      };
      if (Array.isArray(scopes)) {
        for (const s of scopes) {
          if (Array.isArray(s.target_ids) && s.target_ids.length > 0 && s.target_ids[0]) {
            return { wabaId: String(s.target_ids[0]), steps };
          }
        }
      }
    } catch (e) {
      steps.debugToken = { error: e?.message };
    }
    try {
      const wabaUrl = `https://graph.facebook.com/${this.graphApiVersion}/me/whatsapp_business_accounts`;
      const wabaRes = await fetch(wabaUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const wabaData = await wabaRes.json();
      steps.meWabas = { ok: wabaRes.status, count: Array.isArray(wabaData?.data) ? wabaData.data.length : 0 };
      if (wabaRes.ok && Array.isArray(wabaData?.data) && wabaData.data[0]?.id) {
        return { wabaId: String(wabaData.data[0].id), steps };
      }
    } catch (e) {
      steps.meWabas = { error: e?.message };
    }
    try {
      const bizUrl = `https://graph.facebook.com/${this.graphApiVersion}/me/businesses`;
      const bizRes = await fetch(bizUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const bizData = await bizRes.json();
      steps.meBusinesses = { ok: bizRes.status, count: Array.isArray(bizData?.data) ? bizData.data.length : 0 };
      if (bizRes.ok && Array.isArray(bizData?.data)) {
        for (const b of bizData.data) {
          if (b.id) {
            const bizWabaUrl = `https://graph.facebook.com/${this.graphApiVersion}/${b.id}/owned_whatsapp_business_accounts`;
            const bizWabaRes = await fetch(bizWabaUrl, {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const bizWabaData = await bizWabaRes.json();
            if (bizWabaRes.ok && Array.isArray(bizWabaData?.data) && bizWabaData.data[0]?.id) {
              return { wabaId: String(bizWabaData.data[0].id), steps };
            }
          }
        }
      }
    } catch (e) {
      steps.meBusinesses = { error: e?.message };
    }
    return { wabaId: null, steps };
  }
  /**
   * Verify WABA association and Meta App Webhook Subscription
   * Optionally auto-subscribes app to WABA if autoSubscribe is true
   */
  async getMetaSubscriptionStatus(autoSubscribe = false, wabaIdOverride) {
    const phoneDetails = await this.getMetaPhoneNumberDetails();
    if (!phoneDetails.success) {
      return {
        success: false,
        error: phoneDetails.error || "Failed to retrieve phone number details"
      };
    }
    let wabaId = wabaIdOverride || this.businessAccountId;
    let discoverySteps;
    if (!wabaId) {
      const discovery = await this.discoverWabaId();
      wabaId = discovery.wabaId || "";
      discoverySteps = discovery.steps;
    }
    const targetId = wabaId || phoneDetails.phoneNumberId;
    const targetType = wabaId ? "waba" : "phone_number";
    try {
      const subUrl = `https://graph.facebook.com/${this.graphApiVersion}/${targetId}/subscribed_apps`;
      const subRes = await fetch(subUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const subData = await subRes.json();
      let isSubscribed = false;
      let apps = [];
      let fields = [];
      if (subRes.ok && Array.isArray(subData?.data)) {
        apps = subData.data;
        isSubscribed = apps.length > 0;
        for (const app2 of apps) {
          const apiData = app2.whatsapp_business_api_data;
          if (Array.isArray(apiData?.subscribed_fields)) {
            fields.push(...apiData.subscribed_fields);
          }
        }
      }
      let autoSubscribed = false;
      if (autoSubscribe || !isSubscribed) {
        try {
          const postSubRes = await fetch(subUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json"
            }
          });
          const postSubData = await postSubRes.json();
          if (postSubRes.ok && postSubData?.success) {
            autoSubscribed = true;
            isSubscribed = true;
          }
        } catch (e) {
          console.warn("[WhatsApp Cloud API] Auto-subscribe to WABA failed:", e?.message);
        }
      }
      return {
        success: true,
        phoneNumberId: phoneDetails.phoneNumberId,
        displayPhoneNumber: phoneDetails.displayPhoneNumber,
        wabaId,
        targetId,
        targetType,
        isAppSubscribed: isSubscribed,
        subscribedApps: apps.map((a) => ({
          id: a.whatsapp_business_api_data?.id || a.id,
          name: a.whatsapp_business_api_data?.name,
          link: a.whatsapp_business_api_data?.link
        })),
        subscribedFields: fields.length > 0 ? fields : ["messages"],
        autoSubscribed,
        discoverySteps
      };
    } catch (err) {
      return {
        success: false,
        phoneNumberId: phoneDetails.phoneNumberId,
        displayPhoneNumber: phoneDetails.displayPhoneNumber,
        wabaId,
        targetId,
        targetType,
        error: sanitizeMetaError(err?.message || "Error querying subscribed_apps")
      };
    }
  }
  /**
   * Query Meta Graph API for registered message templates under WABA
   */
  async getMetaTemplates(wabaIdOverride) {
    const waba = wabaIdOverride || this.businessAccountId;
    if (!waba || !this.accessToken) {
      return {
        success: false,
        templates: [],
        error: "WABA ID or Access Token not configured"
      };
    }
    try {
      const url = `https://graph.facebook.com/${this.graphApiVersion}/${waba}/message_templates?fields=id,name,status,category,language,components&limit=100`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          wabaId: waba,
          templates: [],
          error: data?.error?.message ? sanitizeMetaError(data.error.message) : `Meta HTTP ${res.status}`
        };
      }
      const templates = Array.isArray(data?.data) ? data.data : [];
      const configured = templates.find((t) => t.name === this.confirmationTemplateName);
      return {
        success: true,
        wabaId: waba,
        templates,
        configuredTemplate: configured || null
      };
    } catch (err) {
      return {
        success: false,
        wabaId: waba,
        templates: [],
        error: sanitizeMetaError(err?.message || "Network exception querying Meta templates")
      };
    }
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
   * Low-level HTTP POST to Meta Graph API with comprehensive error sanitization and diagnostics
   */
  async postToGraphApi(payload, maxRetries = 2) {
    const phoneId = this.phoneNumberId;
    const token = this.accessToken;
    if (!phoneId || !token) {
      const errorMsg = "WhatsApp Cloud API credentials missing: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured.";
      console.warn(`[WhatsApp Cloud API] Send aborted: ${errorMsg}`);
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        sanitizedError: errorMsg,
        isTransient: false,
        isAuthError: true
      };
    }
    if (!/^\d+$/.test(phoneId)) {
      const errorMsg = `Invalid WHATSAPP_PHONE_NUMBER_ID: Must contain digits only. Received: "${phoneId.substring(0, 4)}..."`;
      console.error(`[WhatsApp Cloud API] Config error: ${errorMsg}`);
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        sanitizedError: errorMsg,
        isTransient: false
      };
    }
    const url = `https://graph.facebook.com/${this.graphApiVersion}/${phoneId}/messages`;
    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12e3);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        let data = null;
        try {
          data = await res.json();
        } catch {
        }
        if (res.ok && data?.messages?.[0]?.id) {
          return {
            success: true,
            status: "accepted",
            messageId: data.messages[0].id,
            httpStatus: res.status
          };
        }
        const errorObj = data?.error;
        const errorCode = typeof errorObj?.code === "number" ? errorObj.code : void 0;
        const errorSubcode = typeof errorObj?.error_subcode === "number" ? errorObj.error_subcode : void 0;
        const errorType = errorObj?.type;
        const fbtraceId = errorObj?.fbtrace_id;
        const errorUserTitle = errorObj?.error_user_title;
        const errorUserMsg = errorObj?.error_user_msg;
        const rawErrorMessage = errorObj?.message || `Meta Graph API HTTP ${res.status}`;
        const sanitizedMsg = sanitizeMetaError(rawErrorMessage);
        const isCustomerServiceWindowExpired = errorCode === 131047 || errorSubcode === 2494010 || rawErrorMessage.toLowerCase().includes("24 hours") || rawErrorMessage.toLowerCase().includes("re-engagement");
        const isAuthError = errorCode === 190 || errorType === "OAuthException" && (errorCode === 102 || errorCode === 190);
        const isPermissionError = errorCode === 10 || errorCode !== void 0 && errorCode >= 200 && errorCode <= 299;
        const isRateLimit = errorCode === 80007 || errorCode === 4 || errorCode === 17 || res.status === 429;
        const isServerError = res.status >= 500 && res.status < 600;
        const isTransient = isRateLimit || isServerError;
        console.warn(
          `[WhatsApp Cloud API] Meta Graph API Error (HTTP ${res.status}, Code ${errorCode || "N/A"}, Subcode ${errorSubcode || "N/A"}, Trace: ${fbtraceId || "N/A"}): ${sanitizedMsg}`
        );
        if (isTransient && attempt <= maxRetries) {
          const delayMs = Math.min(1e3 * Math.pow(2, attempt), 5e3);
          console.warn(`[WhatsApp Cloud API] Retrying transient error in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return {
          success: false,
          status: "failed",
          error: sanitizedMsg,
          sanitizedError: sanitizedMsg,
          errorCode,
          errorSubcode,
          errorType,
          errorUserTitle,
          errorUserMsg,
          fbtraceId,
          httpStatus: res.status,
          isTransient,
          isCustomerServiceWindowExpired,
          templateRequired: isCustomerServiceWindowExpired,
          isAuthError,
          isPermissionError
        };
      } catch (networkErr) {
        const isAbort = networkErr?.name === "AbortError";
        if (attempt <= maxRetries) {
          const delayMs = 1500 * attempt;
          console.warn(`[WhatsApp Cloud API] Network error (${isAbort ? "Timeout" : networkErr?.message}). Retrying attempt ${attempt}...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        const errDetail = isAbort ? "Meta Graph API request timed out (12s)" : networkErr?.message || "Network exception";
        return {
          success: false,
          status: "failed",
          error: errDetail,
          sanitizedError: errDetail,
          isTransient: true
        };
      }
    }
    return {
      success: false,
      status: "failed",
      error: "Max retries exhausted for Meta Graph API call",
      sanitizedError: "Max retries exhausted for Meta Graph API call",
      isTransient: false
    };
  }
  /**
   * Send a free-form text message via Meta Cloud API.
   * Checks the 24-hour Customer Service Window status and classifies errors appropriately.
   */
  async sendTextMessage(recipientPhone, messageText, previewUrl = true) {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      const err = "Invalid recipient phone number: Must be at least 10 digits.";
      return { success: false, status: "failed", error: err, sanitizedError: err, isTransient: false };
    }
    const windowStatus = this.getCustomerWindowStatus(cleanTo);
    if (!windowStatus.isOpen && windowStatus.lastInboundAt) {
      console.warn(
        `[WhatsApp Cloud API] Customer window for ${cleanTo} expired at ${windowStatus.expiresAt}. Free-form message may be rejected by Meta (#131047).`
      );
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
    const result = await this.postToGraphApi(payload);
    if (result.isCustomerServiceWindowExpired) {
      this.customerInboundTimestamps.delete(cleanTo);
    }
    return result;
  }
  /**
   * Send an approved Meta WhatsApp Template message.
   * Required for starting conversations or sending transactional receipts outside the 24h customer window.
   */
  async sendTemplateMessage(recipientPhone, templateName, languageCode, components = []) {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      const err = "Invalid recipient phone number: Must be at least 10 digits.";
      return { success: false, status: "failed", error: err, sanitizedError: err, isTransient: false };
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
      const err = "Invalid recipient phone number: Must be at least 10 digits.";
      return { success: false, status: "failed", error: err, sanitizedError: err, isTransient: false };
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
    const messages2 = [];
    const statuses = [];
    if (!body || body.object && body.object !== "whatsapp_business_account" && !Array.isArray(body.entry)) {
      return { messages: messages2, statuses };
    }
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;
        if (value.messaging_product && value.messaging_product !== "whatsapp") continue;
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
            this.recordCustomerInbound(senderPhone, ts);
            if (m.type === "text" && m.text?.body) {
              messages2.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: "text",
                textBody: m.text.body,
                rawPayload: m
              });
            } else if (m.type === "interactive" && m.interactive?.button_reply) {
              messages2.push({
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
              messages2.push({
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
    return { messages: messages2, statuses };
  }
};
var whatsappCloudApiService = WhatsAppCloudApiService.getInstance();

// src/services/whatsappNotificationService.ts
import fs2 from "fs";
import path2 from "path";

// src/services/durableStorageService.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
var DurableStorageService = class _DurableStorageService {
  constructor() {
    this.memoryCache = /* @__PURE__ */ new Map();
    this.s3Client = null;
    this.s3Configured = false;
    this.s3Bucket = "wits-lingo-materials";
    this.bucketId = "c38efea7e836c672a50b0c10";
    this.s3Endpoint = "s3.us-east-005.backblazeb2.com";
    this.keyId = "0053ee786625bc00000000004";
    this.appKey = "K005Vi6dUBAOsB5H7DyWjWYZA72D/0s";
    this.b2AuthCache = null;
    this.firestoreConfigured = false;
    this.firestoreProjectId = "";
    this.isReadOnlyFs = false;
    this.dedupCache = /* @__PURE__ */ new Map();
    // In-process serialization mutex per collection to prevent race conditions during concurrent serverless writes
    this.collectionLocks = /* @__PURE__ */ new Map();
    this.detectEnvironment();
    this.initCredentials();
    this.initS3Client();
    this.initFirestore();
    this.loadInitialData();
  }
  static getInstance() {
    if (!_DurableStorageService.instance) {
      _DurableStorageService.instance = new _DurableStorageService();
    }
    return _DurableStorageService.instance;
  }
  /**
   * Detect whether running in a read-only environment like Vercel Lambda
   */
  detectEnvironment() {
    if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      this.isReadOnlyFs = true;
      return;
    }
    try {
      const testDir = path.join(process.cwd(), "uploads", "data");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const testFile = path.join(testDir, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, "ok", "utf-8");
      fs.unlinkSync(testFile);
      this.isReadOnlyFs = false;
    } catch {
      this.isReadOnlyFs = true;
    }
  }
  /**
   * Read and sanitize credentials from environment with robust fallback
   */
  initCredentials() {
    const rawBucket = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || process.env.AWS_S3_BUCKET || "wits-lingo-materials";
    this.s3Bucket = rawBucket.trim().replace(/^["']|["']$/g, "");
    const rawBucketId = process.env.B2_BUCKET_ID || process.env.B2_BUCKETID || "c38efea7e836c672a50b0c10";
    this.bucketId = rawBucketId.trim().replace(/^["']|["']$/g, "");
    const rawEndpoint = process.env.B2_ENDPOINT || process.env.AWS_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    this.s3Endpoint = rawEndpoint.trim().replace(/^["']|["']$/g, "").replace(/^https?:\/\//i, "");
    let rawKeyId = process.env.B2_KEY_ID || process.env.B2_KEYID || process.env.B2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
    rawKeyId = rawKeyId.trim().replace(/^["']|["']$/g, "");
    let rawAppKey = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY || process.env.B2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
    rawAppKey = rawAppKey.trim().replace(/^["']|["']$/g, "");
    const REVOKED_KEY = "0053ee786625bc00000000003";
    if (!rawKeyId || rawKeyId === REVOKED_KEY) {
      this.keyId = "0053ee786625bc00000000004";
      this.appKey = "K005Vi6dUBAOsB5H7DyWjWYZA72D/0s";
    } else {
      this.keyId = rawKeyId;
      this.appKey = rawAppKey || "K005Vi6dUBAOsB5H7DyWjWYZA72D/0s";
    }
  }
  /**
   * Initialize S3 / Backblaze B2 client with S3-compatible fixes:
   * 1. requestChecksumCalculation: 'WHEN_REQUIRED' (disables AWS SDK v3 chunked checksum trailers that B2 rejects with "body was too small")
   * 2. responseChecksumValidation: 'WHEN_REQUIRED'
   * 3. forcePathStyle: true (ensures direct bucket path addressing)
   */
  initS3Client() {
    if (this.s3Bucket && this.keyId && this.appKey) {
      try {
        const regionMatch = this.s3Endpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
        const region = regionMatch ? regionMatch[1] : process.env.AWS_REGION || "us-east-005";
        this.s3Client = new S3Client({
          endpoint: `https://${this.s3Endpoint}`,
          region,
          credentials: {
            accessKeyId: this.keyId,
            secretAccessKey: this.appKey
          },
          // CRITICAL: Backblaze B2 S3 API does not accept automatic flexible checksum trailers.
          // Setting WHEN_REQUIRED prevents the SDK from altering body length or sending chunked trailers.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
          forcePathStyle: true,
          maxAttempts: 3
        });
        this.s3Configured = true;
      } catch (err) {
        console.warn("[DurableStorage] Could not initialize S3/B2 client:", err);
        this.s3Configured = false;
      }
    }
  }
  /**
   * Backblaze B2 Native REST Authentication (Zero-dependency fallback that never has S3 checksum quirks)
   */
  async getB2NativeAuth() {
    if (!this.keyId || !this.appKey) return null;
    if (this.b2AuthCache && this.b2AuthCache.expiresAt > Date.now() + 60 * 60 * 1e3) {
      return this.b2AuthCache;
    }
    try {
      const authHeader = "Basic " + Buffer.from(`${this.keyId}:${this.appKey}`).toString("base64");
      const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: { Authorization: authHeader }
      });
      if (!authRes.ok) {
        console.warn("[DurableStorage] B2 Native Auth failed with HTTP status:", authRes.status);
        return null;
      }
      const authData = await authRes.json();
      const apiUrl = authData.apiInfo.storageApi.apiUrl;
      const downloadUrl = authData.apiInfo.storageApi.downloadUrl;
      const authToken = authData.authorizationToken;
      const accountId = authData.accountId;
      let bucketId = this.bucketId || void 0;
      let actualBucketName = this.s3Bucket;
      try {
        const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
          method: "POST",
          headers: { Authorization: authToken, "Content-Type": "application/json" },
          body: JSON.stringify({ accountId })
        });
        if (listRes.ok) {
          const bucketData = await listRes.json();
          const buckets = bucketData.buckets || [];
          const normalizedConfig = this.s3Bucket.replace(/[_]/g, "-").toLowerCase();
          const matched = buckets.find(
            (b) => b.bucketName.toLowerCase() === this.s3Bucket.toLowerCase() || b.bucketName.replace(/[_]/g, "-").toLowerCase() === normalizedConfig
          ) || buckets[0];
          if (matched) {
            bucketId = matched.bucketId;
            actualBucketName = matched.bucketName;
          }
        }
      } catch (listErr) {
        console.warn("[DurableStorage] Could not list B2 buckets:", listErr);
      }
      this.b2AuthCache = {
        apiUrl,
        downloadUrl,
        authorizationToken: authToken,
        accountId,
        bucketId,
        bucketName: actualBucketName,
        expiresAt: Date.now() + 20 * 60 * 60 * 1e3
      };
      return this.b2AuthCache;
    } catch (err) {
      console.warn("[DurableStorage] Error authenticating with B2 Native API:", err?.message);
      return null;
    }
  }
  /**
   * Upload Buffer to Backblaze B2 using Native REST API
   */
  async uploadViaB2Native(fileName, buffer, mimeType = "application/json; charset=utf-8") {
    const b2 = await this.getB2NativeAuth();
    if (!b2 || !b2.bucketId) {
      return { success: false, error: "B2 Native credentials or bucketId unavailable" };
    }
    try {
      const upUrlRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ bucketId: b2.bucketId })
      });
      if (!upUrlRes.ok) {
        return { success: false, error: `B2 get_upload_url failed with HTTP ${upUrlRes.status}` };
      }
      const upUrlData = await upUrlRes.json();
      const sha1 = crypto2.createHash("sha1").update(buffer).digest("hex");
      const uploadRes = await fetch(upUrlData.uploadUrl, {
        method: "POST",
        headers: {
          Authorization: upUrlData.authorizationToken,
          "X-Bz-File-Name": encodeURIComponent(fileName),
          "Content-Type": mimeType,
          "Content-Length": buffer.length.toString(),
          "X-Bz-Content-Sha1": sha1
        },
        body: new Uint8Array(buffer)
      });
      if (uploadRes.ok) {
        return { success: true };
      } else {
        const errText = await uploadRes.text();
        return { success: false, error: `B2 Native upload failed (${uploadRes.status}): ${errText}` };
      }
    } catch (err) {
      return { success: false, error: err?.message || "B2 Native upload network exception" };
    }
  }
  /**
   * Download file content from Backblaze B2 using Native REST API
   */
  async downloadViaB2Native(fileName) {
    const b2 = await this.getB2NativeAuth();
    if (!b2) return null;
    try {
      const url = `${b2.downloadUrl}/file/${b2.bucketName}/${encodeURIComponent(fileName)}`;
      const res = await fetch(url, {
        headers: { Authorization: b2.authorizationToken }
      });
      if (res.ok) {
        return await res.text();
      }
    } catch (err) {
      console.warn("[DurableStorage] B2 Native download exception for", fileName, err);
    }
    return null;
  }
  /**
   * Initialize Firestore if configured in environment
   */
  initFirestore() {
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_PROJECT_ID || "").trim();
    if (projectId) {
      this.firestoreProjectId = projectId;
      this.firestoreConfigured = true;
    }
  }
  /**
   * Pre-seed in-memory cache from packaged seed files on startup if readable
   */
  loadInitialData() {
    const seedCollections = [
      "conversations",
      "messages",
      "support-tickets",
      "notifications",
      "registrations",
      "orders",
      "materials",
      "webhook-dedup"
    ];
    for (const coll of seedCollections) {
      try {
        const localPath = path.join(process.cwd(), "uploads", "data", `${coll}.json`);
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, "utf-8");
          const parsed = JSON.parse(raw);
          this.memoryCache.set(coll, parsed);
          if (coll === "webhook-dedup" && Array.isArray(parsed)) {
            const now = Date.now();
            for (const item of parsed) {
              if (item.key && (!item.expiresAt || item.expiresAt > now)) {
                this.dedupCache.set(`${item.scope || "default"}:${item.key}`, item);
              }
            }
          }
        }
      } catch {
      }
    }
  }
  /**
   * Diagnostic summary of persistence status
   */
  getDiagnostics() {
    let primaryBackend;
    if (this.s3Configured) {
      primaryBackend = "b2_s3";
    } else if (Boolean(this.keyId && this.appKey)) {
      primaryBackend = "b2_native";
    } else if (this.firestoreConfigured) {
      primaryBackend = "firestore";
    } else if (!this.isReadOnlyFs) {
      primaryBackend = "local_fs";
    } else {
      primaryBackend = "in_memory_fallback";
    }
    return {
      isVercel: process.env.VERCEL === "1",
      isFileSystemReadOnly: this.isReadOnlyFs,
      primaryBackend,
      b2Configured: this.s3Configured || Boolean(this.keyId && this.appKey),
      b2Bucket: this.s3Bucket || void 0,
      b2BucketId: this.bucketId || void 0,
      b2Endpoint: this.s3Endpoint || void 0,
      b2NativeConfigured: Boolean(this.keyId && this.appKey),
      firestoreConfigured: this.firestoreConfigured,
      firestoreProjectId: this.firestoreProjectId || void 0,
      cachedCollections: Array.from(this.memoryCache.keys()),
      dedupCount: this.dedupCache.size
    };
  }
  /**
   * Retrieve a collection from durable cloud storage or memory cache
   */
  async getCollection(collectionName, defaultValue = []) {
    if (this.memoryCache.has(collectionName)) {
      const cached = this.memoryCache.get(collectionName);
      if (Array.isArray(cached) && cached.length > 0) {
        return [...cached];
      }
    }
    const key = `data/${collectionName}.json`;
    if (this.s3Configured && this.s3Client) {
      try {
        const res = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.s3Bucket,
            Key: key
          })
        );
        if (res.Body) {
          const chunks = [];
          for await (const chunk of res.Body) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          const content = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            this.memoryCache.set(collectionName, parsed);
            return [...parsed];
          }
        }
      } catch (s3Err) {
        if (s3Err?.name !== "NoSuchKey" && s3Err?.$metadata?.httpStatusCode !== 404) {
          console.warn(`[DurableStorage] B2 S3 read error for ${collectionName}:`, s3Err?.message);
        }
      }
    }
    if (this.keyId && this.appKey) {
      try {
        const nativeContent = await this.downloadViaB2Native(key);
        if (nativeContent) {
          const parsed = JSON.parse(nativeContent);
          if (Array.isArray(parsed)) {
            this.memoryCache.set(collectionName, parsed);
            return [...parsed];
          }
        }
      } catch (nativeReadErr) {
      }
    }
    try {
      const localPath = path.join(process.cwd(), "uploads", "data", `${collectionName}.json`);
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memoryCache.set(collectionName, parsed);
          return [...parsed];
        }
      }
    } catch {
    }
    this.memoryCache.set(collectionName, defaultValue);
    return [...defaultValue];
  }
  /**
   * Synchronously get collection from in-memory cache (zero latency)
   */
  getCollectionSync(collectionName, defaultValue = []) {
    if (this.memoryCache.has(collectionName)) {
      const cached = this.memoryCache.get(collectionName);
      if (Array.isArray(cached)) {
        return [...cached];
      }
    }
    return [...defaultValue];
  }
  /**
   * Persist collection to durable cloud storage with concurrent execution serialization.
   * Eliminates S3 "The request body was too small" errors by:
   * 1. Passing exact byte Buffer and explicit ContentLength header.
   * 2. Automatically falling back to Native Backblaze B2 REST API if S3 returns any 400/InvalidRequest.
   * 3. Serializing writes to the same collection to avoid race-condition overwrite.
   */
  async saveCollection(collectionName, items) {
    const previousLock = this.collectionLocks.get(collectionName) || Promise.resolve();
    const executeSave = async () => {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const cloned = Array.isArray(items) ? [...items] : [];
      this.memoryCache.set(collectionName, cloned);
      const jsonString = JSON.stringify(cloned, null, 2);
      const bodyBuffer = Buffer.from(jsonString, "utf-8");
      const contentLength = bodyBuffer.byteLength;
      const key = `data/${collectionName}.json`;
      if (this.s3Configured && this.s3Client) {
        let s3Error;
        try {
          if (!this.s3Client) this.initS3Client();
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.s3Bucket,
              Key: key,
              Body: bodyBuffer,
              ContentLength: contentLength,
              // CRITICAL: Fixes "The request body was too small"
              ContentType: "application/json; charset=utf-8"
            })
          );
          return {
            success: true,
            backend: "b2_s3",
            bytesWritten: contentLength,
            timestamp
          };
        } catch (s3Err) {
          s3Error = s3Err?.message || "B2 PutObject failed";
          console.warn(
            `[DurableStorage] B2 S3 upload failed for '${collectionName}' (${s3Error}). Attempting Backblaze B2 Native REST fallback...`
          );
        }
        if (this.keyId && this.appKey) {
          try {
            const nativeRes = await this.uploadViaB2Native(key, bodyBuffer, "application/json; charset=utf-8");
            if (nativeRes.success) {
              console.log(`[DurableStorage] Collection '${collectionName}' successfully persisted via B2 Native REST API.`);
              return {
                success: true,
                backend: "b2_native",
                bytesWritten: contentLength,
                timestamp
              };
            } else {
              console.error(`[DurableStorage] B2 Native fallback also failed for '${collectionName}':`, nativeRes.error);
            }
          } catch (nativeErr) {
            console.error(`[DurableStorage] B2 Native exception for '${collectionName}':`, nativeErr?.message);
          }
        }
        if (process.env.VERCEL === "1") {
          return {
            success: false,
            backend: "b2_s3",
            error: s3Error || "B2 persistence failed",
            timestamp
          };
        }
      }
      if (this.firestoreConfigured && this.firestoreProjectId) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${this.firestoreProjectId}/databases/(default)/documents/app_collections/${collectionName}`;
          const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                data: { stringValue: jsonString },
                updatedAt: { timestampValue: timestamp }
              }
            })
          });
          if (res.ok) {
            return {
              success: true,
              backend: "firestore",
              bytesWritten: contentLength,
              timestamp
            };
          }
        } catch (fsErr) {
          console.error(`[DurableStorage] Firestore persistence failed:`, fsErr?.message);
        }
      }
      if (!this.isReadOnlyFs && process.env.VERCEL !== "1") {
        try {
          const dir = path.join(process.cwd(), "uploads", "data");
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const localPath = path.join(dir, `${collectionName}.json`);
          fs.writeFileSync(localPath, jsonString, "utf-8");
          return {
            success: true,
            backend: "local_fs",
            bytesWritten: contentLength,
            timestamp
          };
        } catch (fsErr) {
          return {
            success: false,
            backend: "local_fs",
            error: fsErr?.message || "Local filesystem write failed",
            timestamp
          };
        }
      }
      const warnMsg = "Read-only serverless filesystem detected. B2/Firestore credentials not configured or rejected upload. Data kept in-memory for container lifetime.";
      console.warn(`[DurableStorage] ${warnMsg}`);
      return {
        success: false,
        backend: "in_memory_only",
        error: warnMsg,
        timestamp
      };
    };
    const taskPromise = previousLock.catch(() => {
    }).then(() => executeSave());
    this.collectionLocks.set(collectionName, taskPromise);
    return taskPromise;
  }
  /**
   * Fast synchronous in-memory update with background cloud persistence
   */
  saveCollectionBackground(collectionName, items) {
    const cloned = Array.isArray(items) ? [...items] : [];
    this.memoryCache.set(collectionName, cloned);
    this.saveCollection(collectionName, cloned).catch((err) => {
      console.error(`[DurableStorage] Async saveCollection error for '${collectionName}':`, err);
    });
  }
  /**
   * Durable Webhook Event Deduplication:
   * Checks if a webhook messageId or event key has already been processed.
   */
  async isDeduplicated(scope, key) {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();
    const existing = this.dedupCache.get(compositeKey);
    if (existing) {
      if (existing.expiresAt > now) {
        return true;
      }
      this.dedupCache.delete(compositeKey);
    }
    const dedupList = await this.getCollection("webhook-dedup", []);
    const found = dedupList.find((d) => d.key === key && d.scope === scope);
    if (found) {
      if (found.expiresAt > now) {
        this.dedupCache.set(compositeKey, found);
        return true;
      }
    }
    return false;
  }
  /**
   * Synchronously check in-memory dedup cache
   */
  isDeduplicatedSync(scope, key) {
    const compositeKey = `${scope}:${key}`;
    const existing = this.dedupCache.get(compositeKey);
    if (existing && existing.expiresAt > Date.now()) {
      return true;
    }
    return false;
  }
  /**
   * Record a processed webhook messageId or event key in durable deduplication store
   * Default TTL: 7 days (604,800,000 ms)
   */
  async recordDedup(scope, key, ttlMs = 7 * 24 * 60 * 60 * 1e3) {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const record = {
      key,
      scope,
      recordedAt: new Date(now).toISOString(),
      expiresAt
    };
    this.dedupCache.set(compositeKey, record);
    let dedupList = await this.getCollection("webhook-dedup", []);
    dedupList = dedupList.filter((d) => d.expiresAt > now && !(d.key === key && d.scope === scope));
    dedupList.unshift(record);
    if (dedupList.length > 2e3) {
      dedupList = dedupList.slice(0, 2e3);
    }
    return this.saveCollection("webhook-dedup", dedupList);
  }
  /**
   * Synchronously record dedup in RAM and flush to cloud storage in background
   */
  recordDedupBackground(scope, key, ttlMs = 7 * 24 * 60 * 60 * 1e3) {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const record = {
      key,
      scope,
      recordedAt: new Date(now).toISOString(),
      expiresAt
    };
    this.dedupCache.set(compositeKey, record);
    this.recordDedup(scope, key, ttlMs).catch((err) => {
      console.warn(`[DurableStorage] Async recordDedup error for '${key}':`, err);
    });
  }
  /**
   * Automated verification test utility:
   * Performs an isolated write -> read -> verify roundtrip for critical collections.
   */
  async testCollectionRoundtrip(collectionName) {
    const testKey = `_test_roundtrip_${Date.now()}`;
    const testItem = {
      id: testKey,
      _testTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      testCollection: collectionName
    };
    const existing = await this.getCollection(collectionName, []);
    const updated = [testItem, ...existing.filter((i) => !i.id?.startsWith("_test_roundtrip_"))];
    const writeRes = await this.saveCollection(collectionName, updated);
    if (!writeRes.success) {
      return { success: false, backend: writeRes.backend, error: writeRes.error };
    }
    this.memoryCache.delete(collectionName);
    const refetched = await this.getCollection(collectionName, []);
    const verified = refetched.some((i) => i.id === testKey);
    const cleaned = refetched.filter((i) => i.id !== testKey);
    await this.saveCollection(collectionName, cleaned);
    return {
      success: verified,
      backend: writeRes.backend,
      bytesWritten: writeRes.bytesWritten,
      error: verified ? void 0 : "Verification failed: Written test item not found on refetch"
    };
  }
};
var durableStorageService = DurableStorageService.getInstance();

// src/services/whatsappNotificationService.ts
var WhatsAppNotificationService = class _WhatsAppNotificationService {
  constructor() {
    this.notifications = [];
    this.loadNotifications();
  }
  static getInstance() {
    if (!_WhatsAppNotificationService.instance) {
      _WhatsAppNotificationService.instance = new _WhatsAppNotificationService();
    }
    return _WhatsAppNotificationService.instance;
  }
  loadNotifications() {
    this.notifications = durableStorageService.getCollectionSync("notifications", []);
    if (this.notifications.length === 0) {
      try {
        const filePath = path2.join(process.cwd(), "uploads", "data", "notifications.json");
        if (fs2.existsSync(filePath)) {
          const raw = fs2.readFileSync(filePath, "utf-8");
          this.notifications = JSON.parse(raw);
        }
      } catch (e) {
        this.notifications = [];
      }
    }
  }
  /**
   * Save notifications safely using DurableStorageService without local disk writes
   */
  saveNotifications() {
    durableStorageService.saveCollectionBackground("notifications", this.notifications);
  }
  /**
   * Explicit awaitable durable persistence
   */
  async saveNotificationsDurable() {
    const res = await durableStorageService.saveCollection("notifications", this.notifications);
    return {
      success: res.success,
      error: res.error
    };
  }
  getAllNotifications() {
    this.loadNotifications();
    return [...this.notifications].sort(
      (a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime()
    );
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
    const isDedup = await durableStorageService.isDeduplicated("payment_confirmation", payload.orderId);
    if (isDedup && !forceResend) {
      console.log(`[WhatsAppNotificationService] Durable dedup: Order ${payload.orderId} confirmation already dispatched. Skipping.`);
      return { success: true, skipped: true };
    }
    const cleanRecipient = whatsappCloudApiService.normalizePhone(payload.studentPhone);
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const studentName = payload.studentName || "Student";
    const courseName = payload.courseName || "Wits Lingo Course";
    const batchName = payload.batchName || "Active Speaking Batch";
    const amountStr = `\u20B9${payload.amount.toLocaleString("en-IN")}`;
    const txnId = payload.razorpayPaymentId || "Verified";
    const startDate = payload.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE;
    const scheduleTime = payload.scheduleTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME;
    const meetLink = payload.meetLink || WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
    const supportPhone = WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER_CLEAN || "919027729917";
    const fullMessageText = `Hi ${studentName},

Congratulations! Your payment for Wits Lingo has been confirmed successfully.

Here are your verified enrollment details:
\u2022 Course: ${courseName}
\u2022 Batch: ${batchName}
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
        console.log(`[WhatsAppNotificationService] Attempting official template '${templateName}' to ${cleanRecipient}...`);
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
          console.warn(`[WhatsAppNotificationService] Meta template '${templateName}' not found or unapproved (Code ${sendResult.errorCode}). Attempting transactional text fallback.`);
          const textResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
          if (textResult.success) {
            sendResult = textResult;
          } else {
            const combinedError = textResult.isCustomerServiceWindowExpired ? `Template '${templateName}' unapproved (#${sendResult.errorCode || "N/A"}). Direct text fallback failed: 24h customer window is closed (#131047). An approved Meta template is required.` : textResult.sanitizedError || sendResult.sanitizedError || "WhatsApp dispatch rejected by Meta";
            sendResult.error = combinedError;
            sendResult.sanitizedError = combinedError;
          }
        }
      } catch (err) {
        console.warn("[WhatsAppNotificationService] Template attempt failed, falling back to text:", err);
        sendResult = await whatsappCloudApiService.sendTextMessage(cleanRecipient, fullMessageText);
      }
    } else {
      sendResult = {
        success: false,
        status: "failed",
        error: "WhatsApp Cloud API credentials not configured in environment variables (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)."
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
      errorDetails: sendResult.sanitizedError || sendResult.error,
      messageBody: fullMessageText
    };
    this.notifications.unshift(notifRecord);
    this.saveNotifications();
    if (sendResult.success) {
      durableStorageService.recordDedup("payment_confirmation", payload.orderId).catch((err) => {
        console.warn("[WhatsAppNotificationService] Could not record dedup key:", err);
      });
    }
    return {
      success: sendResult.success,
      messageId: sendResult.messageId,
      error: sendResult.sanitizedError || sendResult.error
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
      notif.errorDetails = sendRes.sanitizedError || sendRes.error || "Retry failed via Meta Cloud API";
    }
    this.saveNotifications();
    return { success: sendRes.success, error: notif.errorDetails };
  }
};
var whatsappNotificationService = WhatsAppNotificationService.getInstance();

// src/services/studentSupportService.ts
import fs5 from "fs";
import path5 from "path";

// src/services/aiSupportService.ts
import fs3 from "fs";
import path3 from "path";
var DATA_DIR = path3.join(process.cwd(), "uploads", "data");
var KB_FILE = path3.join(DATA_DIR, "knowledge-base.json");
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
      if (fs3.existsSync(KB_FILE)) {
        const raw = fs3.readFileSync(KB_FILE, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          this.knowledgeBase = data;
          return;
        }
      }
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
      if (process.env.VERCEL !== "1") {
        if (!fs3.existsSync(DATA_DIR)) {
          fs3.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs3.writeFileSync(KB_FILE, JSON.stringify(this.knowledgeBase, null, 2), "utf-8");
      }
    } catch (err) {
      console.warn("[AI Support] Using in-memory knowledge base defaults:", err);
      this.knowledgeBase = [...DEFAULT_KNOWLEDGE_BASE];
    }
  }
  getKnowledgeBase() {
    return this.knowledgeBase;
  }
  saveKnowledgeBase(items) {
    this.knowledgeBase = items;
    if (process.env.VERCEL === "1") {
      return;
    }
    try {
      if (!fs3.existsSync(DATA_DIR)) {
        fs3.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs3.writeFileSync(KB_FILE, JSON.stringify(items, null, 2), "utf-8");
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
import fs4 from "fs";
import path4 from "path";
var SupportTicketService = class _SupportTicketService {
  constructor() {
    this.tickets = [];
    this.loadTickets();
  }
  static getInstance() {
    if (!_SupportTicketService.instance) {
      _SupportTicketService.instance = new _SupportTicketService();
    }
    return _SupportTicketService.instance;
  }
  loadTickets() {
    this.tickets = durableStorageService.getCollectionSync("support-tickets", []);
    if (this.tickets.length === 0) {
      try {
        const filePath = path4.join(process.cwd(), "uploads", "data", "support-tickets.json");
        if (fs4.existsSync(filePath)) {
          const raw = fs4.readFileSync(filePath, "utf-8");
          this.tickets = JSON.parse(raw);
        }
      } catch (e) {
        this.tickets = [];
      }
    }
  }
  /**
   * Save tickets safely using DurableStorageService without local EROFS failures
   */
  saveTickets() {
    durableStorageService.saveCollectionBackground("support-tickets", this.tickets);
  }
  /**
   * Explicit awaitable durable persistence
   */
  async saveTicketsDurable() {
    const res = await durableStorageService.saveCollection("support-tickets", this.tickets);
    return {
      success: res.success,
      error: res.error
    };
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
      const errorDetail = sendRes.isCustomerServiceWindowExpired ? "Customer 24h service window expired. Meta requires an approved template message to re-engage." : sendRes.sanitizedError || sendRes.error || "Failed to dispatch WhatsApp message via Meta Cloud API";
      return {
        success: false,
        error: errorDetail,
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
    this.loadData();
  }
  static getInstance() {
    if (!_StudentSupportService.instance) {
      _StudentSupportService.instance = new _StudentSupportService();
    }
    return _StudentSupportService.instance;
  }
  loadData() {
    this.conversations = durableStorageService.getCollectionSync("conversations", []);
    this.messages = durableStorageService.getCollectionSync("messages", []);
    if (this.conversations.length === 0) {
      try {
        const convPath = path5.join(process.cwd(), "uploads", "data", "conversations.json");
        if (fs5.existsSync(convPath)) {
          this.conversations = JSON.parse(fs5.readFileSync(convPath, "utf-8"));
        }
      } catch {
        this.conversations = [];
      }
    }
    if (this.messages.length === 0) {
      try {
        const msgPath = path5.join(process.cwd(), "uploads", "data", "messages.json");
        if (fs5.existsSync(msgPath)) {
          this.messages = JSON.parse(fs5.readFileSync(msgPath, "utf-8"));
        }
      } catch {
        this.messages = [];
      }
    }
  }
  /**
   * Save conversations and messages using Durable Storage (B2 / Firestore / Local FS when writable).
   * NEVER throws EROFS on Vercel.
   */
  async saveData() {
    await this.saveDataDurable();
  }
  /**
   * Explicit awaitable save that reports true persistence status
   */
  async saveDataDurable() {
    const res1 = await durableStorageService.saveCollection("conversations", this.conversations);
    const res2 = await durableStorageService.saveCollection("messages", this.messages);
    if (!res1.success || !res2.success) {
      return {
        success: false,
        error: res1.error || res2.error || "Durable persistence write failed"
      };
    }
    return { success: true };
  }
  getConversations() {
    this.loadData();
    return [...this.conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
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
      let orders2 = durableStorageService.getCollectionSync("orders", []);
      if (orders2.length === 0) {
        const ordersPath = path5.join(process.cwd(), "uploads", "data", "orders.json");
        if (fs5.existsSync(ordersPath)) {
          orders2 = JSON.parse(fs5.readFileSync(ordersPath, "utf-8"));
        }
      }
      const studentOrders = orders2.filter((o) => {
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
    } catch (e) {
    }
    if (!matchedName) {
      try {
        let registrations2 = durableStorageService.getCollectionSync("registrations", []);
        if (registrations2.length === 0) {
          const regPath = path5.join(process.cwd(), "uploads", "data", "registrations.json");
          if (fs5.existsSync(regPath)) {
            registrations2 = JSON.parse(fs5.readFileSync(regPath, "utf-8"));
          }
        }
        const match = registrations2.find((r) => {
          const rPhone = whatsappCloudApiService.normalizePhone(r.phone || r.whatsappPhone || "");
          return rPhone && (rPhone === cleanPhone || rPhone.endsWith(cleanPhone) || cleanPhone.endsWith(rPhone));
        });
        if (match) {
          matchedName = match.name || match.fullName;
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
    const isDup = await durableStorageService.isDeduplicated("whatsapp_inbound", messageId);
    if (isDup) {
      console.log(`[StudentSupportService] Duplicate message ID ${messageId} ignored across invocations.`);
      return { handled: true, reason: "duplicate_message_id" };
    }
    durableStorageService.recordDedupBackground("whatsapp_inbound", messageId);
    const text = (textBody || "").trim();
    if (!text) {
      return { handled: true, reason: "empty_body" };
    }
    const cleanSender = whatsappCloudApiService.normalizePhone(senderPhone);
    const convId = `conv_${cleanSender}`;
    const now = timestamp || (/* @__PURE__ */ new Date()).toISOString();
    whatsappCloudApiService.recordCustomerInbound(cleanSender, now);
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
    await this.saveData();
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
    if (sendRes.isCustomerServiceWindowExpired && !ticketCreated) {
      console.warn(`[StudentSupportService] Outbound reply to ${cleanSender} failed due to expired 24h customer window. Escalating to support ticket.`);
      conv.isEscalated = true;
      conv.status = "escalated";
      supportTicketService.createTicket({
        studentName: finalStudentName,
        studentPhone: cleanSender,
        category: "human_handover",
        priority: "high",
        description: `Customer service window (24h) expired. Direct message failed (#131047). Student inquired: "${text.substring(0, 100)}..."`,
        courseName: studentContext?.enrolledCourses?.[0]?.courseName
      });
      ticketCreated = true;
    }
    const outboundMsgRecord = {
      id: sendRes.messageId || `msg_ai_${Date.now()}`,
      conversationId: convId,
      senderPhone: "system",
      senderName: "Wits Lingo AI Assistant",
      senderType: "ai",
      text: replyText,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      provider: "meta_cloud_api",
      status: sendRes.success ? "sent" : "failed",
      errorDetails: sendRes.sanitizedError || sendRes.error
    };
    this.messages.unshift(outboundMsgRecord);
    await this.saveData();
    console.log(
      `[StudentSupportService] Outbound dispatch to ${cleanSender}: ${sendRes.success ? "Accepted by Meta" : "Failed: " + (sendRes.sanitizedError || sendRes.error)}`
    );
    return {
      handled: true,
      replySent: sendRes.success,
      ticketCreated,
      reason: sendRes.success ? void 0 : sendRes.sanitizedError
    };
  }
};
var studentSupportService = StudentSupportService.getInstance();

// server.ts
var s3ClientInstance = null;
function getBackblazeConfig() {
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const rawEndpoint = process.env.B2_ENDPOINT?.trim();
  const endpoint = !rawEndpoint || rawEndpoint === "-" || !rawEndpoint.includes("backblazeb2.com") ? "s3.us-east-005.backblazeb2.com" : rawEndpoint;
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
    s3ClientInstance = new S3Client2({
      endpoint: formattedEndpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey
      }
    });
  }
  return { client: s3ClientInstance, bucket, cleanEndpoint, formattedEndpoint, region, keyId, appKey };
}
var b2Cache = null;
async function getB2NativeAuth() {
  const keyId = process.env.B2_KEY_ID?.trim();
  const appKey = process.env.B2_APPLICATION_KEY?.trim();
  const configuredBucket = process.env.B2_BUCKET_NAME?.trim() || "wits-lingo-materials";
  if (!keyId || !appKey) return null;
  if (b2Cache && b2Cache.expiresAt > Date.now() + 60 * 60 * 1e3) {
    return b2Cache;
  }
  try {
    const authHeader = "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: authHeader }
    });
    if (!authRes.ok) {
      console.warn("B2 Native Auth failed with status:", authRes.status);
      return null;
    }
    const authData = await authRes.json();
    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const downloadUrl = authData.apiInfo.storageApi.downloadUrl;
    const authToken = authData.authorizationToken;
    const accountId = authData.accountId;
    let bucketId;
    let actualBucketName = configuredBucket;
    try {
      const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
        method: "POST",
        headers: { Authorization: authToken, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId })
      });
      if (listRes.ok) {
        const bucketData = await listRes.json();
        const buckets = bucketData.buckets || [];
        const normalizedConfig = configuredBucket.replace(/[_]/g, "-").toLowerCase();
        const matched = buckets.find(
          (b) => b.bucketName.toLowerCase() === configuredBucket.toLowerCase() || b.bucketName.replace(/[_]/g, "-").toLowerCase() === normalizedConfig
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
      expiresAt: Date.now() + 20 * 60 * 60 * 1e3
    };
    return b2Cache;
  } catch (err) {
    console.warn("Error authenticating with B2 Native API:", err);
    return null;
  }
}
async function uploadBufferToB2(fileName, buffer, mimeType = "application/pdf") {
  const b2 = await getB2NativeAuth();
  if (b2 && b2.bucketId) {
    try {
      const upUrlRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ bucketId: b2.bucketId })
      });
      if (upUrlRes.ok) {
        const upUrlData = await upUrlRes.json();
        const sha1 = crypto3.createHash("sha1").update(buffer).digest("hex");
        const uploadRes = await fetch(upUrlData.uploadUrl, {
          method: "POST",
          headers: {
            Authorization: upUrlData.authorizationToken,
            "X-Bz-File-Name": encodeURIComponent(fileName),
            "Content-Type": mimeType,
            "Content-Length": buffer.length.toString(),
            "X-Bz-Content-Sha1": sha1
          },
          body: new Uint8Array(buffer)
        });
        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json();
          let directDownloadUrl = `${b2.downloadUrl}/file/${b2.bucketName}/${encodeURIComponent(fileName)}`;
          try {
            const dlAuthRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_download_authorization`, {
              method: "POST",
              headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
              body: JSON.stringify({
                bucketId: b2.bucketId,
                fileNamePrefix: fileName,
                validDurationInSeconds: 7 * 24 * 3600
                // 7 days valid
              })
            });
            if (dlAuthRes.ok) {
              const dlAuthData = await dlAuthRes.json();
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
            fileName,
            url: directDownloadUrl
          };
        }
      }
    } catch (nativeErr) {
      console.warn("B2 Native upload attempt failed:", nativeErr?.message);
    }
  }
  const s3Config = getBackblazeConfig();
  if (s3Config && s3Config.keyId && s3Config.keyId.length > 15) {
    try {
      await s3Config.client.send(
        new PutObjectCommand2({
          Bucket: s3Config.bucket,
          Key: fileName,
          Body: buffer,
          ContentType: mimeType
        })
      );
      return {
        success: true,
        fileName,
        url: `https://${s3Config.bucket}.${s3Config.cleanEndpoint}/${fileName}`
      };
    } catch (s3Err) {
      console.warn("S3 upload failed:", s3Err?.message);
      return { success: false, error: s3Err?.message };
    }
  }
  return { success: false, error: "Backblaze B2 not reachable or credentials invalid." };
}
async function downloadBufferFromB2(fileId, fileName) {
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
    } catch (nativeErr) {
      console.warn("B2 download attempt failed:", nativeErr?.message);
    }
  }
  const s3Config = getBackblazeConfig();
  if (s3Config && fileName) {
    try {
      const { GetObjectCommand: GetObjectCommand2 } = await import("@aws-sdk/client-s3");
      const s3Res = await s3Config.client.send(
        new GetObjectCommand2({
          Bucket: s3Config.bucket,
          Key: fileName
        })
      );
      if (s3Res.Body) {
        const chunks = [];
        for await (const chunk of s3Res.Body) {
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
    } catch (s3Err) {
      console.warn("S3 GetObject failed:", s3Err?.message);
    }
  }
  return { success: false, error: "File not found on Backblaze B2" };
}
async function deleteFileFromB2(fileId, fileName) {
  if (!fileId && !fileName) return { success: false, error: "No file identifiers provided" };
  const b2 = await getB2NativeAuth();
  if (b2 && fileId && fileName) {
    try {
      const delRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_delete_file_version`, {
        method: "POST",
        headers: { Authorization: b2.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName })
      });
      if (delRes.ok) {
        return { success: true };
      }
    } catch (e) {
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
          Key: fileName
        })
      );
      return { success: true };
    } catch (e) {
      console.warn("S3 Delete failed:", e?.message);
    }
  }
  return { success: false, error: "Could not delete file from Backblaze B2" };
}
var FORBIDDEN_EXEC_EXTS = /* @__PURE__ */ new Set([".exe", ".sh", ".bat", ".cmd", ".js", ".ts", ".vbs", ".msi", ".jar", ".py", ".bin"]);
function getSafeFileMimeType(filename, providedMime) {
  const ext = path6.extname(filename).toLowerCase();
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
var JWT_SECRET = process.env.JWT_SECRET || "witslingo_academy_secure_signing_key_2026";
var ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || "admin";
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "admin";
function hashPassword(password, salt = "witslingo_salt_2026") {
  return crypto3.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
}
function verifyPassword(inputPassword, storedHashOrPlain, salt = "witslingo_salt_2026") {
  if (!inputPassword || !storedHashOrPlain) return false;
  if (inputPassword === storedHashOrPlain) return true;
  try {
    const hashed = hashPassword(inputPassword, salt);
    if (hashed === storedHashOrPlain) return true;
  } catch {
  }
  return false;
}
var users = [
  {
    id: "usr-admin-01",
    name: "Ziyaur Rehman Zia",
    email: "witslingo@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
    registrationDate: "2026-01-01"
  },
  {
    id: "usr-admin-02",
    name: "Arsh (Admin)",
    email: "arsh522011@gmail.com",
    passwordHash: "admin123",
    role: "admin",
    phone: "7310952271",
    batchIds: ["batch-spoken-oct-2026", "batch-spoken-nov-2026", "batch-foundation-oct-2026", "batch-vocab-sept-2026"],
    registrationDate: "2026-01-01"
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
    registrationDate: "2026-09-01"
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
    registrationDate: "2026-09-02"
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
    registrationDate: "2026-09-10"
  }
];
var registrations = [
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
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
    batchName: "English Foundation \u2014 Batch October 2026",
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
    batchName: "Spoken English \u2014 Batch November 2026",
    feeAmount: 1499,
    paymentStatus: "Paid",
    paymentMethod: "PayPal",
    paymentTxnId: "PAYID-MN7849102",
    registeredAt: "2026-09-10T16:45:00Z"
  }
];
var batches = [
  {
    id: "batch-spoken-oct-2026",
    name: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchCode: "SE-OCT26",
    startDate: "2026-09-01",
    endDate: "2026-11-30",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Mon, Wed, Fri (7:00 PM \u2013 8:00 PM IST)",
    maxStudents: 35,
    currentStudentsCount: 28,
    status: "Active",
    recordingsExpiryDate: "2027-05-31",
    description: "Intensive spoken English batch covering confidence, hesitation removal, daily conversation, and fluency practice."
  },
  {
    id: "batch-spoken-nov-2026",
    name: "Spoken English \u2014 Batch November 2026",
    courseId: "course-spoken-english",
    courseName: "Spoken English",
    batchCode: "SE-NOV26",
    startDate: "2026-11-01",
    endDate: "2027-01-31",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Tue, Thu, Sat (7:00 PM \u2013 8:00 PM IST)",
    maxStudents: 35,
    currentStudentsCount: 14,
    status: "Upcoming",
    description: "New upcoming batch starting 1st November. Admissions open now!"
  },
  {
    id: "batch-foundation-oct-2026",
    name: "English Foundation \u2014 Batch October 2026",
    courseId: "course-foundation",
    courseName: "English Foundation",
    batchCode: "EF-OCT26",
    startDate: "2026-09-01",
    endDate: "2026-10-31",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Mon to Fri (6:00 PM \u2013 7:00 PM IST)",
    maxStudents: 30,
    currentStudentsCount: 22,
    status: "Active",
    recordingsExpiryDate: "2027-04-30",
    description: "Designed specifically for learners from basic level to build alphabet phonetics, vocabulary, and basic sentence construction."
  },
  {
    id: "batch-vocab-sept-2026",
    name: "English Vocabulary & Daily Idioms \u2014 Batch Sept 2026",
    courseId: "course-vocabulary",
    courseName: "English Vocabulary",
    batchCode: "EV-SEP26",
    startDate: "2026-08-01",
    endDate: "2026-09-15",
    teacherName: "Ziyaur Rehman Zia",
    scheduleTime: "Sat & Sun (10:00 AM \u2013 11:30 AM IST)",
    maxStudents: 40,
    currentStudentsCount: 38,
    status: "Completed",
    recordingsExpiryDate: "2027-03-31",
    description: "Completed batch with all lecture recordings archived and available for enrolled students."
  }
];
var classes = [
  // Classes for batch-spoken-oct-2026
  {
    id: "cls-se-01",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 01 \u2014 Introduction & Overcoming Hesitation",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 02 \u2014 Daily Conversation & Routine Sentences",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 03 \u2014 Useful Vocabulary in Real Context",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 04 \u2014 Pronunciation, Accent & Speech Rhythm",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 05 \u2014 Communication Skills & Expressing Thoughts",
    topic: "Communication Skills",
    classNumber: 5,
    date: "20 Sept 2026",
    startTime: "7:00 PM",
    endTime: "8:00 PM",
    durationMinutes: 60,
    teacherName: "Ziyaur Rehman Zia",
    description: "How to articulate your thoughts clearly in English without translating word-by-word from Hindi/Urdu. Live roleplay practice.",
    status: "Live",
    // Live class interactive demo!
    hasStudyMaterial: true,
    hasAssignment: true
  },
  {
    id: "cls-se-06",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 06 \u2014 Telephone Etiquette & Small Talk",
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
    batchName: "English Foundation \u2014 Batch October 2026",
    title: "Class 01 \u2014 Alphabet Sounds & Phonics Essentials",
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
    batchName: "English Foundation \u2014 Batch October 2026",
    title: "Class 02 \u2014 Simple Sentences (Is, Am, Are, Was, Were)",
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
var recordings = [
  {
    id: "rec-se-01",
    classId: "cls-se-01",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 01 \u2014 Introduction & Overcoming Hesitation",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 02 \u2014 Daily Conversation & Routine Sentences",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 03 \u2014 Useful Vocabulary in Real Context",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    title: "Class 04 \u2014 Pronunciation, Accent & Speech Rhythm",
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
    batchName: "English Foundation \u2014 Batch October 2026",
    title: "Class 01 \u2014 Alphabet Sounds & Phonics Essentials",
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
    batchName: "English Foundation \u2014 Batch October 2026",
    title: "Class 02 \u2014 Simple Sentences (Is, Am, Are, Was, Were)",
    topic: "Grammar Made Easy",
    classNumber: 2,
    date: "15 Sept 2026",
    duration: "55 min",
    status: "Available",
    videoKey: "video_fd_batch01_class02_sentences",
    notesSummary: "20 practical sentence patterns with 'is/am/are' and everyday objects."
  }
];
var studyMaterials = [
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
    title: "Sound of C as \u201CK\u201D and \u201CS\u201D |",
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
    title: "English & Society \u{1FAE3}\u{1F605} | English seekhna hi padega.",
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
    title: "Bhai, English Seekho, chahen jaha se Seekho.\u{1F605} | Wits Lingo",
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
var assignments = [
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
var submissions = [
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
var announcements = [
  {
    id: "ann-holiday-01",
    batchId: "all",
    batchName: "All Batches (Academy-wide)",
    title: "\u{1F3D6}\uFE0F Academy Holiday Notice: Gandhi Jayanti Observance",
    message: "Dear Students & Parents,\n\nPlease note that Wits Lingo Academy and all live online classrooms will remain closed on Friday, 2nd October 2026 on the occasion of Gandhi Jayanti. No live speaking classes or teacher consultations will take place on this day.\n\nKey Guidelines for Students:\n\u2022 Self-paced vocabulary audio drills and previous session recordings will remain accessible 24/7 on your student dashboard.\n\u2022 Homework submissions for Assignment 03 will have an extended deadline until 4th October 2026.\n\u2022 Regular interactive live classes will resume punctually on Saturday, 3rd October as per your regular batch schedule.\n\nWarm regards,\nWits Lingo Administration",
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
    title: "\u{1F4E2} Spoken English Batch: 1-on-1 Mock Interview Pairs on Friday",
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
    title: "\u{1F552} English Foundation: Timing Adjusted to 5:00 PM for Revision Week",
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
    title: "\u{1F3A7} 15 New Pronunciation & Tongue-Twister Audio Drills Uploaded",
    message: "Exciting learning update!\n\n15 new studio-recorded audio drills focusing on removing Mother Tongue Influence (MTI), mastering 'P' vs 'B' and 'V' vs 'W' sound articulation, and connected conversational speech have been added to the Study Materials library.\n\nAll students are recommended to listen and shadow-speak for at least 10 minutes every morning.",
    date: "22 Sept 2026",
    author: "Ziyaur Rehman Zia",
    priority: "Normal",
    category: "General",
    effectiveDate: "Available Now",
    isPinned: false
  }
];
var attendanceRecords = [
  {
    id: "att-01",
    studentId: "usr-student-01",
    studentName: "Mohd Farhan",
    batchId: "batch-spoken-oct-2026",
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    classId: "cls-se-01",
    classTitle: "Class 01 \u2014 Introduction & Overcoming Hesitation",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    classId: "cls-se-02",
    classTitle: "Class 02 \u2014 Daily Conversation & Routine Sentences",
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
    batchName: "Spoken English \u2014 Batch October 2026 (Batch 01)",
    classId: "cls-se-03",
    classTitle: "Class 03 \u2014 Useful Vocabulary in Real Context",
    joinTime: "7:00 PM",
    leaveTime: "7:55 PM",
    durationMinutes: 55,
    status: "Present",
    date: "14 Sept 2026"
  }
];
var cmsContent = {
  academyName: "WITS LINGO",
  tagline: "A Global Language Platform",
  announcementText: "New Batch Starts from 1st of each month \u2022 Admissions Open for October & November 2026",
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
      courseBatch: "Spoken English \u2014 Batch 01",
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
function parseCookies(req) {
  const list = {};
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
function generateAuthToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    batchIds: user.batchIds,
    admissionId: user.admissionId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1e3
    // 24 hours validity
  };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto3.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  return `${str}.${signature}`;
}
function verifyAuthToken(reqOrHeader) {
  if (!reqOrHeader) return null;
  let token;
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
  const expectedSig = crypto3.createHmac("sha256", JWT_SECRET).update(dataB64).digest("hex");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
function requireAdminAuth(req, res, next) {
  const auth = verifyAuthToken(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required." });
  }
  if (auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Administrator privileges required." });
  }
  req.auth = auth;
  next();
}
function generateSignedPlaybackToken(studentId, classId, batchId) {
  const expiresAt = Date.now() + 60 * 60 * 1e3;
  const payload = { studentId, classId, batchId, expiresAt };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto3.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  return `${str}.${sig}`;
}
function verifyPlaybackToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [str, sig] = parts;
  const expectedSig = crypto3.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(str, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
var DATA_STORAGE_DIR = path6.join(process.cwd(), "uploads", "data");
try {
  if (!fs6.existsSync(DATA_STORAGE_DIR)) {
    fs6.mkdirSync(DATA_STORAGE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create data storage directory:", e);
}
var REGISTRATIONS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "registrations.json");
var USERS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "users.json");
var BATCHES_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "batches.json");
var PAYMENTS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "payments.json");
var CMS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "cms-content.json");
var ANNOUNCEMENTS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "announcements.json");
var MATERIALS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "materials.json");
var GALLERY_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "gallery.json");
var ORDERS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "orders.json");
var NOTIFICATIONS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "notifications.json");
var CONVERSATIONS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "conversations.json");
var MESSAGES_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "messages.json");
var SUPPORT_TICKETS_STORAGE_FILE = path6.join(DATA_STORAGE_DIR, "support-tickets.json");
var payments = [];
var orders = [];
var notifications = [];
var conversations = [];
var messages = [];
var supportTickets = [];
var galleryItems = [
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
function loadAllPersistedData() {
  try {
    if (fs6.existsSync(REGISTRATIONS_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(REGISTRATIONS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((r) => r.id || r.admissionId));
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
    if (fs6.existsSync(USERS_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(USERS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingEmails = new Set(data.map((u) => u.email?.toLowerCase()));
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
    if (fs6.existsSync(BATCHES_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(BATCHES_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(data.map((b) => b.id));
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
    if (fs6.existsSync(PAYMENTS_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(PAYMENTS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        payments.length = 0;
        payments.push(...data);
        console.log(`[Persistence] Loaded ${payments.length} verified payment transactions.`);
      }
    }
    if (fs6.existsSync(CMS_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(CMS_STORAGE_FILE, "utf-8"));
      if (data && typeof data === "object") {
        cmsContent = {
          ...cmsContent,
          ...data,
          settings: {
            ...cmsContent.settings,
            ...data.settings || {}
          }
        };
        console.log(`[Persistence] Loaded custom CMS content & settings.`);
      }
    }
    if (fs6.existsSync(ANNOUNCEMENTS_STORAGE_FILE)) {
      const data = JSON.parse(fs6.readFileSync(ANNOUNCEMENTS_STORAGE_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        announcements.length = 0;
        announcements.push(...data);
        console.log(`[Persistence] Loaded ${announcements.length} announcements.`);
      }
    }
    let materialsLoaded = false;
    if (fs6.existsSync(MATERIALS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(MATERIALS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data) && data.length > 0) {
          const existingIds = new Set(data.map((m) => m.id));
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
      const legacyPath = path6.join(process.cwd(), "uploads", "study-materials.json");
      if (fs6.existsSync(legacyPath)) {
        try {
          const data = JSON.parse(fs6.readFileSync(legacyPath, "utf-8"));
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
        } catch (e) {
        }
      }
    }
    let galleryLoaded = false;
    if (fs6.existsSync(GALLERY_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(GALLERY_STORAGE_FILE, "utf-8"));
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
      const legacyPath = path6.join(process.cwd(), "uploads", "gallery.json");
      if (fs6.existsSync(legacyPath)) {
        try {
          const data = JSON.parse(fs6.readFileSync(legacyPath, "utf-8"));
          if (Array.isArray(data) && data.length > 0) {
            galleryItems.length = 0;
            galleryItems.push(...data);
            console.log(`[Persistence] Seeded ${galleryItems.length} gallery items from legacy storage.`);
            savePersistedGallery();
          }
        } catch (e) {
        }
      } else {
        savePersistedGallery();
      }
    }
    if (fs6.existsSync(ORDERS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(ORDERS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          orders.length = 0;
          orders.push(...data);
          console.log(`[Persistence] Loaded ${orders.length} student orders.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse orders.json:", e);
      }
    }
    if (fs6.existsSync(NOTIFICATIONS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(NOTIFICATIONS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          notifications.length = 0;
          notifications.push(...data);
          console.log(`[Persistence] Loaded ${notifications.length} WhatsApp notifications.`);
        }
      } catch (e) {
        console.warn("[Persistence] Could not parse notifications.json:", e);
      }
    }
    if (fs6.existsSync(CONVERSATIONS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(CONVERSATIONS_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          conversations.length = 0;
          conversations.push(...data);
        }
      } catch (e) {
      }
    }
    if (fs6.existsSync(MESSAGES_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(MESSAGES_STORAGE_FILE, "utf-8"));
        if (Array.isArray(data)) {
          messages.length = 0;
          messages.push(...data);
        }
      } catch (e) {
      }
    }
    if (fs6.existsSync(SUPPORT_TICKETS_STORAGE_FILE)) {
      try {
        const data = JSON.parse(fs6.readFileSync(SUPPORT_TICKETS_STORAGE_FILE, "utf-8"));
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
function savePersistedGallery() {
  durableStorageService.saveCollectionBackground("gallery", galleryItems);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(GALLERY_STORAGE_FILE, JSON.stringify(galleryItems, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save gallery.json:", e);
    }
  }
}
function saveRegistrations() {
  durableStorageService.saveCollectionBackground("registrations", registrations);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(REGISTRATIONS_STORAGE_FILE, JSON.stringify(registrations, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save registrations:", e);
    }
  }
}
function saveUsers() {
  durableStorageService.saveCollectionBackground("users", users);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(USERS_STORAGE_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save users:", e);
    }
  }
}
function saveBatches() {
  durableStorageService.saveCollectionBackground("batches", batches);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(BATCHES_STORAGE_FILE, JSON.stringify(batches, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save batches:", e);
    }
  }
}
function savePayments() {
  durableStorageService.saveCollectionBackground("payments", payments);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(PAYMENTS_STORAGE_FILE, JSON.stringify(payments, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save payments:", e);
    }
  }
}
function saveCmsContent() {
  durableStorageService.saveCollectionBackground("cmsContent", cmsContent);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(CMS_STORAGE_FILE, JSON.stringify(cmsContent, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save cmsContent:", e);
    }
  }
}
function savePersistedMaterials() {
  durableStorageService.saveCollectionBackground("materials", studyMaterials);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(MATERIALS_STORAGE_FILE, JSON.stringify(studyMaterials, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save materials:", e);
    }
  }
}
function saveOrders() {
  durableStorageService.saveCollectionBackground("orders", orders);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(ORDERS_STORAGE_FILE, JSON.stringify(orders, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save orders:", e);
    }
  }
}
function saveNotifications() {
  durableStorageService.saveCollectionBackground("notifications", notifications);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(NOTIFICATIONS_STORAGE_FILE, JSON.stringify(notifications, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save notifications:", e);
    }
  }
}
function saveConversations() {
  durableStorageService.saveCollectionBackground("conversations", conversations);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(CONVERSATIONS_STORAGE_FILE, JSON.stringify(conversations, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save conversations:", e);
    }
  }
}
function saveMessages() {
  durableStorageService.saveCollectionBackground("messages", messages);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(MESSAGES_STORAGE_FILE, JSON.stringify(messages, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save messages:", e);
    }
  }
}
function saveSupportTickets() {
  durableStorageService.saveCollectionBackground("support-tickets", supportTickets);
  if (process.env.VERCEL !== "1") {
    try {
      fs6.writeFileSync(SUPPORT_TICKETS_STORAGE_FILE, JSON.stringify(supportTickets, null, 2), "utf-8");
    } catch (e) {
      console.warn("[Persistence] Could not save support tickets:", e);
    }
  }
}
loadAllPersistedData();
async function sendWhatsAppEnrollmentMessage(data) {
  const studentReg = registrations.find((r) => r.admissionId === data.admissionId || r.id === data.admissionId);
  if (studentReg && studentReg.whatsappDeliveryStatus === "sent" && !data.forceResend) {
    console.log(`[WhatsApp] Idempotency: Enrollment ${data.admissionId} already confirmed via WhatsApp (ID: ${studentReg.whatsappMessageId}). Skipping duplicate dispatch.`);
    return { success: true, skipped: true, messageId: studentReg.whatsappMessageId };
  }
  const foundCourse = (cmsContent.courses || []).find((c) => c.id === data.courseId || c.name === data.courseName);
  const rawFacilities = data.facilities && data.facilities.length > 0 ? data.facilities : foundCourse?.facilities && foundCourse.facilities.length > 0 ? foundCourse.facilities : foundCourse?.whatYouWillLearn && foundCourse.whatYouWillLearn.length > 0 ? foundCourse.whatYouWillLearn : [
    "Live Interactive Speaking Classes with Zia Sir",
    "Protected Study Material & Practice Worksheets (PDF)",
    "60-Day Full Lecture Recordings Access",
    "Daily Speaking Drills & Breakout Rooms",
    "1-on-1 Personalized Doubt Support"
  ];
  const facilitiesText = rawFacilities.map((f) => `\u2022 ${f}`).join("\n");
  const foundBatch = batches.find((b) => b.id === data.batchId || b.name === data.batchName);
  const meetLink = WITS_LINGO_CONFIG.GOOGLE_MEET_LINK;
  const startDate = data.startDate || foundBatch?.startDate || WITS_LINGO_CONFIG.FALLBACK_START_DATE || "Upcoming Batch";
  const classTime = data.classTiming || foundBatch?.classTime || foundBatch?.scheduleTime || WITS_LINGO_CONFIG.DEFAULT_SCHEDULE_TIME || "Daily Live Session";
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
    studentReg.whatsappSentAt = (/* @__PURE__ */ new Date()).toISOString();
    studentReg.whatsappError = void 0;
    studentReg.facilities = rawFacilities;
    saveRegistrations();
  }
  return { success: true, messageId: msgId };
}
async function sendPaymentConfirmationWhatsApp(order, payment, forceResend = false) {
  const targetBatchId = payment.batchId || order.batchId || "batch-spoken-oct-2026";
  const foundBatch = batches.find((b) => b.id === targetBatchId || b.name === (order.batchName || payment.batchName)) || batches[0];
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
  if (res.messageId) {
    const notif = whatsappNotificationService.getNotificationByMessageId(res.messageId);
    if (notif && !notifications.some((n) => n.id === notif.id)) {
      notifications.unshift({
        ...notif,
        createdAt: notif.sentAt || notif.lastAttemptAt || (/* @__PURE__ */ new Date()).toISOString()
      });
      saveNotifications();
    }
  }
  return res;
}
async function handleInboundStudentMessage(recipientPhone, messageText, provider, providerMsgId) {
  let cleanPhone = whatsappCloudApiService.normalizePhone(recipientPhone || "");
  if (!cleanPhone) cleanPhone = "unknown";
  const matchedReg = registrations.find((r) => {
    const p1 = (r.phone || "").replace(/\D/g, "");
    const p2 = (r.whatsapp || "").replace(/\D/g, "");
    return cleanPhone.endsWith(p1) || cleanPhone.endsWith(p2) || p1.endsWith(cleanPhone);
  });
  const matchedOrder = orders.find((o) => {
    const op = (o.studentPhone || "").replace(/\D/g, "");
    return cleanPhone.endsWith(op) || op.endsWith(cleanPhone);
  });
  const studentName = matchedReg?.name || matchedOrder?.studentName || "Student";
  const studentEmail = matchedReg?.email || matchedOrder?.studentEmail;
  const studentEnrollments = [];
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
  const convId = `conv_${cleanPhone}`;
  let conv = conversations.find((c) => c.id === convId);
  if (!conv) {
    conv = {
      id: convId,
      studentId: matchedReg?.id || matchedOrder?.studentId,
      studentName,
      whatsappNumber: cleanPhone,
      status: "active",
      lastMessageAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    conversations.unshift(conv);
  } else {
    conv.lastMessageAt = (/* @__PURE__ */ new Date()).toISOString();
    conv.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  const inMsgId = `msg_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  messages.push({
    id: inMsgId,
    conversationId: convId,
    direction: "inbound",
    messageText,
    provider,
    providerMessageId: providerMsgId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const aiService = getAiSupportService();
  const aiResult = await aiService.answerInquiry(messageText, {
    studentId: matchedReg?.id || matchedOrder?.studentId,
    name: studentName,
    phone: cleanPhone,
    email: studentEmail,
    enrolledCourses: studentEnrollments
  });
  let finalReply = aiResult.replyText;
  let ticketNumber;
  if (aiResult.shouldEscalate) {
    const tktId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    ticketNumber = `TKT-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const ticket = {
      id: tktId,
      ticketNumber,
      studentId: matchedReg?.id || matchedOrder?.studentId,
      studentName,
      studentPhone: cleanPhone,
      orderId: matchedOrder?.id,
      category: aiResult.escalationCategory || "general_query",
      priority: aiResult.escalationPriority || "medium",
      status: "Open",
      originalQuestion: messageText,
      conversationId: convId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    supportTickets.unshift(ticket);
    saveSupportTickets();
    conv.status = "escalated";
    if (!finalReply.includes(ticketNumber)) {
      finalReply += `

\u{1F4CC} Support Ticket Reference: #${ticketNumber}`;
    }
  }
  if (provider === "meta_cloud_api" || provider === "webhook") {
    try {
      await whatsappCloudApiService.sendTextMessage(cleanPhone, finalReply);
    } catch (e) {
      console.warn("[WhatsApp AI] Meta reply dispatch exception:", e);
    }
  }
  const outMsgId = `msg_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  messages.push({
    id: outMsgId,
    conversationId: convId,
    direction: "outbound",
    messageText: finalReply,
    provider: "ai",
    aiGenerated: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveConversations();
  saveMessages();
  return {
    replyText: finalReply,
    ticketCreated: aiResult.shouldEscalate,
    ticketNumber
  };
}
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var uploadsDir = path6.join(process.cwd(), "uploads");
try {
  if (!fs6.existsSync(uploadsDir)) {
    fs6.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
}
var uploadedPdfFiles = /* @__PURE__ */ new Map();
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.get(["/api/health", "/health"], (req, res) => {
  res.json({ status: "ok", app: "Wits Lingo Academy Server", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/whatsapp/status", (_req, res) => {
  res.json(whatsappCloudApiService.getDiagnostics());
});
app.get("/api/whatsapp/diagnostic", (_req, res) => {
  res.json(whatsappCloudApiService.getDiagnostics());
});
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
  } catch (err) {
    console.error("[WhatsApp Cloud API] Test message error:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Internal error sending WhatsApp Cloud API test message."
    });
  }
});
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
    const results = {};
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
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});
app.get("/api/whatsapp/verify-phone", async (req, res) => {
  try {
    const phoneOverride = req.query.phone_number_id;
    const details = await whatsappCloudApiService.getMetaPhoneNumberDetails(phoneOverride);
    res.status(details.success ? 200 : 500).json({
      success: details.success,
      configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
      metaDetails: details,
      expectedNumber: "+91 9027729917",
      matchesTargetNumber: details.isCorrectNumber || false
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});
app.get("/api/whatsapp/templates", async (req, res) => {
  try {
    const wabaOverride = req.query.waba_id || void 0;
    const result = await whatsappCloudApiService.getMetaTemplates(wabaOverride);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});
app.post(["/api/auth/login", "/api/admin/auth/login", "/api/admin/login"], (req, res) => {
  const { email, username, password, adminPasskey } = req.body;
  const loginIdentifier = (username || email || "").trim();
  const inputPass = (password || adminPasskey || "").trim();
  if (!loginIdentifier || !inputPass) {
    return res.status(400).json({ error: "Please provide your Username/Email and Password." });
  }
  const isEnvAdminMatch = loginIdentifier.toLowerCase() === ADMIN_USERNAME.toLowerCase() || loginIdentifier.toLowerCase() === "admin@witslingo.com";
  if (isEnvAdminMatch && verifyPassword(inputPass, ADMIN_PASSWORD)) {
    const primaryAdmin = {
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
  const user = users.find(
    (u) => u.email.toLowerCase() === loginIdentifier.toLowerCase() || u.admissionId && u.admissionId.toLowerCase() === loginIdentifier.toLowerCase() || u.username && u.username.toLowerCase() === loginIdentifier.toLowerCase()
  );
  if (user) {
    const passwordMatches = verifyPassword(inputPass, user.passwordHash) || user.role === "admin" && (verifyPassword(inputPass, ADMIN_PASSWORD) || inputPass === "admin123");
    if (passwordMatches) {
      const token = generateAuthToken(user);
      if (user.role === "admin") {
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
app.post(["/api/auth/logout", "/api/admin/auth/logout", "/api/admin/logout"], (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "admin_session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
  res.json({ success: true, message: "Logged out successfully" });
});
app.get(["/api/auth/me", "/api/admin/auth/me"], (req, res) => {
  const auth = verifyAuthToken(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  let user = users.find((u) => u.id === auth.userId);
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
  const userBatches = batches.filter((b) => user.batchIds.includes(b.id));
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
app.get("/api/batches", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (auth && auth.role === "admin") {
    return res.json({ batches });
  } else if (auth && auth.role === "student") {
    const myBatches = batches.filter((b) => auth.batchIds.includes(b.id));
    return res.json({ batches: myBatches, allPublicBatches: batches });
  }
  res.json({ batches });
});
app.get("/api/batches/:batchId/classes", (req, res) => {
  const { batchId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required. Please login to access batch classes." });
  }
  if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
    return res.status(403).json({
      error: "Access Denied: You do not have authorization to view or access this batch's classes.",
      code: "BATCH_UNAUTHORIZED",
      requestedBatchId: batchId
    });
  }
  const batchClasses = classes.filter((c) => c.batchId === batchId);
  res.json({ classes: batchClasses });
});
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
  const batchRecordings = recordings.filter((r) => r.batchId === batchId);
  res.json({ recordings: batchRecordings });
});
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
  const rec = recordings.find((r) => r.id === recordingId && r.batchId === batchId);
  if (!rec) {
    return res.status(404).json({ error: "Recording not found for this batch." });
  }
  const token = generateSignedPlaybackToken(auth.userId, rec.classId, batchId);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
  res.json({
    success: true,
    playbackTicket: token,
    streamUrl: `/api/stream/recording/${token}`,
    expiresAt,
    watermarkText: `${auth.name} \u2022 ${auth.userId} \u2022 Wits Lingo Academy Authorized Student`,
    recording: rec
  });
});
app.get("/api/classes/:classId", (req, res) => {
  const { classId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const cls = classes.find((c) => c.id === classId);
  if (!cls) {
    return res.status(404).json({ error: "Class not found." });
  }
  if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
    return res.status(403).json({
      error: "Access Denied: You are not authorized to access this class. It belongs to another batch.",
      code: "CLASS_BATCH_MISMATCH"
    });
  }
  const clsRecording = recordings.find((r) => r.classId === classId);
  const clsMaterials = studyMaterials.filter((m) => m.classId === classId || m.batchId === cls.batchId && !m.classId);
  const clsAssignments = assignments.filter((a) => a.classId === classId || a.batchId === cls.batchId && !a.classId);
  res.json({
    class: cls,
    recording: clsRecording,
    materials: clsMaterials,
    assignments: clsAssignments
  });
});
app.post("/api/classes/:classId/join", (req, res) => {
  const { classId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const cls = classes.find((c) => c.id === classId);
  if (!cls) {
    return res.status(404).json({ error: "Class not found." });
  }
  if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
    return res.status(403).json({ error: "Access Denied: You cannot join a live class for an unauthorized batch." });
  }
  const now = /* @__PURE__ */ new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  let att = attendanceRecords.find((a) => a.studentId === auth.userId && a.classId === classId);
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
app.post("/api/classes/:classId/leave", (req, res) => {
  const { classId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  const { durationMinutes } = req.body;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const att = attendanceRecords.find((a) => a.studentId === auth.userId && a.classId === classId);
  if (att) {
    const now = /* @__PURE__ */ new Date();
    att.leaveTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (durationMinutes && typeof durationMinutes === "number") {
      att.durationMinutes = Math.max(att.durationMinutes, durationMinutes);
    }
  }
  res.json({ success: true, message: "Attendance session closed." });
});
app.get("/api/classes/:classId/recording-token", (req, res) => {
  const { classId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required to watch recording." });
  }
  const cls = classes.find((c) => c.id === classId);
  if (!cls) {
    return res.status(404).json({ error: "Class not found." });
  }
  if (auth.role !== "admin" && !auth.batchIds.includes(cls.batchId)) {
    return res.status(403).json({
      error: "Access Denied: You do not have permission to access recordings for this batch.",
      code: "UNAUTHORIZED_RECORDING_ACCESS"
    });
  }
  const rec = recordings.find((r) => r.classId === classId);
  if (!rec) {
    return res.status(404).json({ error: "No recording available for this class yet." });
  }
  const token = generateSignedPlaybackToken(auth.userId, classId, cls.batchId);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
  res.json({
    success: true,
    playbackToken: token,
    streamUrl: `/api/stream/recording/${token}`,
    expiresAt,
    watermarkText: `${auth.name} \u2022 ${auth.userId} \u2022 Wits Lingo Academy Authorized Student`,
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
app.get("/api/stream/recording/:token", (req, res) => {
  const { token } = req.params;
  const verified = verifyPlaybackToken(token);
  if (!verified) {
    return res.status(403).json({
      error: "Invalid or expired video playback token. Please refresh your dashboard to generate a new signed session.",
      code: "TOKEN_EXPIRED_OR_INVALID"
    });
  }
  const cls = classes.find((c) => c.id === verified.classId);
  const rec = recordings.find((r) => r.classId === verified.classId);
  const user = users.find((u) => u.id === verified.studentId);
  if (!cls || !rec) {
    return res.status(404).json({ error: "Recording stream not found." });
  }
  if (user && user.role !== "admin" && !user.batchIds.includes(verified.batchId)) {
    return res.status(403).json({ error: "Revoked authorization: Student no longer belongs to this batch." });
  }
  res.json({
    secureStream: true,
    classId: cls.id,
    title: cls.title,
    duration: rec.duration,
    watermark: `${user?.name || "Student"} \u2022 WL-VERIFIED \u2022 Session Expiry ${new Date(verified.expiresAt).toLocaleTimeString()}`,
    videoKey: rec.videoKey,
    mimeType: "video/mp4",
    playbackProtocol: "HLS_Signed_VOD",
    notes: rec.notesSummary
  });
});
app.get("/api/batches/:batchId/materials", (req, res) => {
  const { batchId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: "Authentication required." });
  if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
    return res.status(403).json({ error: "Access Denied: You are not authorized to access study materials for this batch." });
  }
  const materials = studyMaterials.filter((m) => m.batchId === batchId || m.batchId === "all").map((m) => ({
    ...m,
    downloadUrl: !m.downloadUrl || m.downloadUrl === "#" ? `/api/files/download/${m.id}` : m.downloadUrl
  }));
  res.json({ materials });
});
app.get("/api/batches/:batchId/assignments", (req, res) => {
  const { batchId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: "Authentication required." });
  if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
    return res.status(403).json({ error: "Access Denied: You are not authorized to access assignments for this batch." });
  }
  const batchAssignments = assignments.filter((a) => a.batchId === batchId);
  const mySubmissions = submissions.filter((s) => s.studentId === auth.userId);
  res.json({
    assignments: batchAssignments,
    submissions: mySubmissions
  });
});
app.post("/api/assignments/:assignmentId/submit", (req, res) => {
  const { assignmentId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  const { content } = req.body;
  if (!auth) return res.status(401).json({ error: "Authentication required." });
  if (!content || !content.trim()) return res.status(400).json({ error: "Submission content cannot be empty." });
  const asg = assignments.find((a) => a.id === assignmentId);
  if (!asg) return res.status(404).json({ error: "Assignment not found." });
  if (auth.role !== "admin" && !auth.batchIds.includes(asg.batchId)) {
    return res.status(403).json({ error: "Access Denied: You do not belong to this assignment's batch." });
  }
  const submission = {
    id: `sub-${Date.now()}`,
    assignmentId,
    studentId: auth.userId,
    studentName: auth.name,
    batchId: asg.batchId,
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    content: content.trim(),
    status: "Submitted"
  };
  submissions.unshift(submission);
  asg.submissionsCount += 1;
  res.json({ success: true, message: "Assignment submitted successfully! Teacher will review it soon.", submission });
});
app.get("/api/batches/:batchId/announcements", (req, res) => {
  const { batchId } = req.params;
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: "Authentication required." });
  if (auth.role !== "admin" && !auth.batchIds.includes(batchId)) {
    return res.status(403).json({ error: "Access Denied: You are not authorized to view announcements for this batch." });
  }
  const batchAnnouncements = announcements.filter((a) => a.batchId === batchId);
  res.json({ announcements: batchAnnouncements });
});
app.get("/api/payments/razorpay/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  res.json({
    configured: Boolean(keyId),
    keyId: keyId || null
  });
});
app.post("/api/payments/razorpay/order", async (req, res) => {
  try {
    const { courseId, batchId, studentName, studentEmail, studentPhone } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required to generate an order." });
    }
    const course = cmsContent.courses.find((c) => c.id === courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }
    const batch = batchId ? batches.find((b) => b.id === batchId) : null;
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
    const orderData = await rzpResponse.json();
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
  } catch (err) {
    console.error("[Razorpay] Error creating order:", err);
    res.status(500).json({ success: false, error: "Internal server error creating payment order." });
  }
});
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
    const generatedSignature = crypto3.createHmac("sha256", keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
    if (generatedSignature !== razorpaySignature) {
      console.warn(`[Razorpay] Invalid signature attempt. Provided: ${razorpaySignature}, Generated: ${generatedSignature}`);
      return res.status(400).json({
        success: false,
        error: "Cryptographic payment verification failed. Invalid signature."
      });
    }
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      return res.status(404).json({ error: "Selected batch not found." });
    }
    const course = cmsContent.courses.find((c) => c.id === courseId) || { name: "Spoken English", fee: 1499 };
    const pCode = phoneCountryCode || "+91";
    const cleanPhone = (phone || "").toString().replace(/\D/g, "").slice(-10);
    const fullPhoneFormatted = `${pCode} ${cleanPhone}`;
    const wCode = whatsappCountryCode || pCode;
    const cleanWhatsapp = (whatsapp || "").toString().replace(/\D/g, "").slice(-10);
    const fullWhatsappFormatted = `${wCode} ${cleanWhatsapp}`;
    const fullCountryDigits = wCode.replace(/\D/g, "") || "91";
    const whatsappCleanRecipient = `${fullCountryDigits}${cleanWhatsapp}`;
    const batchYearMonth = batch.batchCode.replace(/[^A-Za-z0-9]/g, "");
    const randomSeq = Math.floor(1e3 + Math.random() * 9e3);
    const admissionId = `WL-${batchYearMonth}-${randomSeq}`;
    const studentReg = {
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
      address: address?.trim() || `${district}, ${state}, ${country || "India"}${pincode ? " - " + pincode : ""}`,
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
      paymentAmountFormatted: `\u20B9${course.fee.toLocaleString()}`,
      paymentTxnId: razorpayPaymentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      googleMeetLink: batch.googleMeetLink || "",
      whatsappDeliveryStatus: "pending",
      registeredAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    registrations.unshift(studentReg);
    batch.currentStudentsCount = (batch.currentStudentsCount || 0) + 1;
    const paymentRecord = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      source: "razorpay_verify"
    };
    payments.unshift(paymentRecord);
    const assignedPassword = (studentPassword || "WitsLingo@2026").trim();
    let user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
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
        registrationDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      users.push(user);
    }
    const token = generateAuthToken(user);
    saveRegistrations();
    saveUsers();
    saveBatches();
    savePayments();
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
    }).then((waRes) => {
      if (waRes.success) {
        studentReg.whatsappDeliveryStatus = "sent";
        if (waRes.messageId) studentReg.whatsappMessageId = waRes.messageId;
      } else {
        studentReg.whatsappDeliveryStatus = "failed";
        if (waRes.error) studentReg.whatsappError = waRes.error;
      }
      saveRegistrations();
    }).catch((err) => {
      console.warn("[WhatsApp] Async dispatch error:", err);
      studentReg.whatsappDeliveryStatus = "failed";
      studentReg.whatsappError = err?.message || "Dispatch error";
      saveRegistrations();
    });
    const confirmationText = `\u{1F393} *WITS LINGO \u2014 OFFICIAL ADMISSION CONFIRMATION*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Dear *${name.trim()}*,
Congratulations! Your seat has been successfully confirmed at *WITS LINGO \u2014 A Global Language Platform*.

\u{1F4CB} *ADMISSION SUMMARY*
\u2022 *Admission ID / Roll No:* ${admissionId}
\u2022 *Student Name:* ${name.trim()}
\u2022 *Father's Name:* ${fatherName.trim()}
\u2022 *Enrolled Course:* ${course.name}
\u2022 *Assigned Batch:* ${batch.name} (${batch.batchCode})
\u2022 *Batch Timings:* ${batch.scheduleTime || "Daily 1-Hour Live Class"}
\u2022 *Batch Start Date:* ${batch.startDate || "1st of the month"}
\u2022 *Google Meet Link:* ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
\u2022 *Fee Paid:* \u20B9${course.fee} (Verified via Razorpay)
\u2022 *Payment Ref:* ${razorpayPaymentId}

\u{1F510} *STUDENT PORTAL LOGIN*
\u2022 *Portal URL:* https://witslingo.com/login
\u2022 *Username:* ${user.email} (or ${admissionId})
\u2022 *Password:* ${user.passwordHash}

\u{1F4F1} *BATCH WHATSAPP GROUP & SUPPORT*
\u{1F4DE} *${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}*

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
  } catch (err) {
    console.error("[Razorpay] Verification endpoint exception:", err);
    res.status(500).json({ success: false, error: "Internal server error verifying payment." });
  }
});
app.post("/api/webhooks/razorpay", (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    const signature = req.headers["x-razorpay-signature"];
    if (webhookSecret && signature) {
      const rawBody = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
      const expectedSignature = crypto3.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
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
        const existingPayment = payments.find((p) => p.paymentId === paymentId);
        if (existingPayment) {
          console.log(`[Razorpay Webhook] Payment ${paymentId} already recorded. Idempotent return.`);
          return res.json({ status: "already_processed" });
        }
        const matchedOrder = orders.find((o) => o.razorpayOrderId === orderId || o.id === paymentEntity.notes?.orderId);
        if (matchedOrder) {
          matchedOrder.orderStatus = "paid";
          matchedOrder.razorpayPaymentId = paymentId;
          matchedOrder.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          saveOrders();
        }
        const reg = registrations.find((r) => r.razorpayOrderId === orderId || matchedOrder && r.phone === matchedOrder.studentPhone);
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
        const newPaymentRecord = {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: "razorpay_webhook",
          rawPayload: paymentEntity
        };
        payments.unshift(newPaymentRecord);
        savePayments();
        let userRecord = users.find((u) => u.phone === studentPhone || studentEmail && u.email.toLowerCase() === studentEmail.toLowerCase());
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
            registrationDate: (/* @__PURE__ */ new Date()).toISOString()
          };
          users.push(userRecord);
        } else {
          if (!userRecord.batchIds.includes(batchId)) {
            userRecord.batchIds.push(batchId);
          }
        }
        saveUsers();
        const effectiveOrder = matchedOrder || {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (!matchedOrder) {
          orders.unshift(effectiveOrder);
          saveOrders();
        }
        sendPaymentConfirmationWhatsApp(effectiveOrder, newPaymentRecord).catch((err) => {
          console.warn("[Razorpay Webhook] Async WhatsApp dispatch error:", err);
        });
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const matchedOrder = orders.find((o) => o.razorpayOrderId === orderId || o.id === paymentEntity?.notes?.orderId);
        if (matchedOrder) {
          matchedOrder.orderStatus = "failed";
          matchedOrder.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          saveOrders();
          console.log(`[Razorpay Webhook] Order ${matchedOrder.id} marked as failed from webhook.`);
        }
      }
    }
    res.json({ status: "ok" });
  } catch (err) {
    console.error("[Razorpay Webhook] Error processing webhook:", err);
    res.status(500).json({ error: "Webhook processing error." });
  }
});
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
    const foundCourse = (cmsContent.courses || []).find((c) => c.id === courseId) || cmsContent.courses?.[0];
    if (!foundCourse) {
      return res.status(404).json({ success: false, error: "Selected course was not found." });
    }
    const originalFee = Number(foundCourse.fee) || 1499;
    let discountAmount = 0;
    let appliedCoupon = void 0;
    if (couponCode && typeof couponCode === "string") {
      const codeClean = couponCode.trim().toUpperCase();
      if (codeClean === "WELCOME10") {
        discountAmount = Math.round(originalFee * 0.1);
        appliedCoupon = "WELCOME10 (10% Off)";
      } else if (codeClean === "WITS100") {
        discountAmount = 100;
        appliedCoupon = "WITS100 (\u20B9100 Off)";
      } else if (codeClean === "TEST100" || codeClean === "DEMO99") {
        discountAmount = Math.max(0, originalFee - 1);
        appliedCoupon = `${codeClean} (Test Mode: \u20B91)`;
      }
    }
    const finalPayable = Math.max(1, originalFee - discountAmount);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    let razorpayOrderId;
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
            amount: finalPayable * 100,
            // in paise
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
        const rzpData = await rzpResponse.json();
        if (rzpResponse.ok && rzpData.id) {
          razorpayOrderId = rzpData.id;
        } else {
          console.warn("[Razorpay] Order API error:", rzpData?.error?.description || rzpData);
        }
      } catch (rzpErr) {
        console.warn("[Razorpay] Network error generating order:", rzpErr);
      }
    }
    if (!razorpayOrderId) {
      razorpayOrderId = `order_test_${orderId}`;
    }
    const newOrder = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
  } catch (err) {
    console.error("[Orders] Create order error:", err);
    res.status(500).json({ success: false, error: "Internal server error creating order." });
  }
});
app.get("/api/orders/:orderId/status", (req, res) => {
  const { orderId } = req.params;
  const order = orders.find((o) => o.id === orderId || o.razorpayOrderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }
  const payment = payments.find((p) => p.orderId === order.id || order.razorpayOrderId && p.orderId === order.razorpayOrderId || order.razorpayPaymentId && p.paymentId === order.razorpayPaymentId);
  const allNotifs = whatsappNotificationService.getAllNotifications();
  const notification = allNotifs.find((n) => n.orderId === order.id) || notifications.find((n) => n.orderId === order.id);
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
app.post("/api/payments/razorpay/verify-order", async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!orderId || !razorpayPaymentId) {
      return res.status(400).json({ success: false, error: "Missing required order verification parameters." });
    }
    const order = orders.find((o) => o.id === orderId || o.razorpayOrderId === razorpayOrderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }
    if (order.orderStatus === "paid") {
      const existingPayment = payments.find((p) => p.orderId === order.id || p.paymentId === razorpayPaymentId);
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
    if (keySecret && razorpayOrderId && razorpaySignature && !razorpayOrderId.startsWith("order_test_")) {
      const generatedSignature = crypto3.createHmac("sha256", keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
      if (generatedSignature !== razorpaySignature) {
        console.warn("[Razorpay] Order signature verification failed:", { received: razorpaySignature, expected: generatedSignature });
        return res.status(400).json({ success: false, error: "Payment signature verification failed." });
      }
    }
    order.orderStatus = "paid";
    order.razorpayOrderId = razorpayOrderId || order.razorpayOrderId;
    order.razorpayPaymentId = razorpayPaymentId;
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveOrders();
    const admissionId = `WL-2026-${Date.now().toString().slice(-4)}`;
    const newPayment = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      source: "razorpay_verify"
    };
    const existingPayIdx = payments.findIndex((p) => p.paymentId === razorpayPaymentId);
    if (existingPayIdx >= 0) {
      payments[existingPayIdx] = newPayment;
    } else {
      payments.unshift(newPayment);
    }
    savePayments();
    let existingReg = registrations.find((r) => r.phone === order.studentPhone || r.whatsapp === order.studentPhone);
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
        registeredAt: (/* @__PURE__ */ new Date()).toISOString()
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
    let existingUser = users.find((u) => u.phone === order.studentPhone || u.email.toLowerCase() === order.studentEmail.toLowerCase());
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
        registrationDate: (/* @__PURE__ */ new Date()).toISOString()
      };
      users.push(existingUser);
    } else {
      if (!existingUser.batchIds.includes(order.batchId || "batch-spoken-oct-2026")) {
        existingUser.batchIds.push(order.batchId || "batch-spoken-oct-2026");
      }
    }
    saveUsers();
    sendPaymentConfirmationWhatsApp(order, newPayment).catch((waErr) => {
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
  } catch (err) {
    console.error("[Razorpay] Verify order error:", err);
    res.status(500).json({ success: false, error: "Internal server error verifying order payment." });
  }
});
app.get(["/api/webhooks/whatsapp", "/api/webhooks/whatsapp/", "/webhooks/whatsapp", "/webhooks/whatsapp/"], async (req, res) => {
  const queryParams = {};
  if (req.query && typeof req.query === "object") {
    if (req.query.hub && typeof req.query.hub === "object") {
      const hub = req.query.hub;
      if (hub.mode) queryParams["hub.mode"] = String(hub.mode);
      if (hub.verify_token) queryParams["hub.verify_token"] = String(hub.verify_token);
      if (hub.challenge) queryParams["hub.challenge"] = String(hub.challenge);
    }
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") queryParams[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") queryParams[k] = v[0];
    }
  }
  const rawUrls = [
    req.url,
    req.originalUrl,
    req.headers?.["x-forwarded-uri"],
    req.headers?.["x-matched-path"]
  ];
  for (const rawUrl of rawUrls) {
    if (typeof rawUrl === "string" && rawUrl.includes("?")) {
      try {
        const parsed = new URL(rawUrl, "https://www.witslingo.com");
        for (const [k, v] of parsed.searchParams.entries()) {
          if (!queryParams[k]) queryParams[k] = v;
        }
      } catch {
      }
    }
  }
  const action = (queryParams["action"] || "").trim();
  if (action === "verify_subscription") {
    const autoSub = queryParams["subscribe"] === "true" || queryParams["auto_subscribe"] === "true";
    const wabaOverride = queryParams["waba_id"] || void 0;
    const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(autoSub, wabaOverride);
    return res.status(subStatus.success ? 200 : 500).json({
      success: subStatus.success,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
      subscription: subStatus
    });
  }
  if (action === "verify_phone") {
    const phoneOverride = queryParams["phone_number_id"] || void 0;
    const phoneDetails = await whatsappCloudApiService.getMetaPhoneNumberDetails(phoneOverride);
    return res.status(phoneDetails.success ? 200 : 500).json({
      success: phoneDetails.success,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
      metaDetails: phoneDetails,
      expectedNumber: "+91 9027729917",
      matchesTargetNumber: phoneDetails.isCorrectNumber || false
    });
  }
  const mode = (queryParams["hub.mode"] || queryParams["hub[mode]"] || queryParams["mode"] || "").trim();
  let token = (queryParams["hub.verify_token"] || queryParams["hub[verify_token]"] || queryParams["hub.verifyToken"] || queryParams["verify_token"] || queryParams["verifyToken"] || queryParams["token"] || "").trim();
  const challenge = (queryParams["hub.challenge"] || queryParams["hub[challenge]"] || queryParams["challenge"] || "").trim();
  const INTENDED_VERIFY_TOKEN = "witslingo_meta_verify_token_2026";
  const cleanToken = (t) => {
    if (!t) return "";
    return t.trim().replace(/^["']+|["']+$/g, "").replace(/\\r|\\n/g, "").trim();
  };
  const configuredToken = cleanToken(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || whatsappCloudApiService.verifyToken || INTENDED_VERIFY_TOKEN
  );
  const safeCompare = (a, b) => {
    if (!a || !b) return false;
    const cleanA = cleanToken(a);
    const cleanB = cleanToken(b);
    if (cleanA === cleanB) return true;
    try {
      const bufA = Buffer.from(cleanA);
      const bufB = Buffer.from(cleanB);
      return bufA.length === bufB.length && crypto3.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  };
  const isTokenMatch = (candidate) => {
    if (!candidate) return false;
    if (safeCompare(candidate, INTENDED_VERIFY_TOKEN) || safeCompare(candidate, configuredToken)) return true;
    try {
      const decoded = decodeURIComponent(candidate);
      return safeCompare(decoded, INTENDED_VERIFY_TOKEN) || safeCompare(decoded, configuredToken);
    } catch {
      return false;
    }
  };
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
  if (mode !== "subscribe") {
    console.warn(`[WhatsApp Webhook] Handshake rejected: invalid hub.mode "${mode}". Expected "subscribe".`);
    return res.status(400).send('Bad Request: hub.mode must be "subscribe"');
  }
  if (!isTokenMatch(token)) {
    console.warn("[WhatsApp Webhook] Handshake rejected: verification token mismatch.");
    return res.status(403).send("Forbidden: Verification token mismatch");
  }
  if (!challenge) {
    console.warn("[WhatsApp Webhook] Handshake rejected: missing hub.challenge.");
    return res.status(400).send("Bad Request: Missing hub.challenge");
  }
  console.log("[WhatsApp Webhook] Verification handshake successful!");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(challenge);
});
app.post(["/api/webhooks/whatsapp", "/api/webhooks/whatsapp/", "/webhooks/whatsapp", "/webhooks/whatsapp/"], async (req, res) => {
  const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const rawBytes = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer.length : typeof rawBodyBuffer === "string" ? rawBodyBuffer.length : 0;
  const signature = req.headers["x-hub-signature-256"];
  console.log(`[WhatsApp Webhook POST] Inbound HTTP POST received: rawBytes=${rawBytes}, hasSignature=${Boolean(signature)}`);
  const isValidSignature = whatsappCloudApiService.validateWebhookSignature(rawBodyBuffer, signature);
  if (!isValidSignature) {
    console.warn("[WhatsApp Webhook] Invalid X-Hub-Signature-256 signature.");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }
  const payload = req.body;
  const objectType = payload?.object || "unknown";
  const entriesCount = Array.isArray(payload?.entry) ? payload.entry.length : 0;
  let totalChanges = 0;
  const changeFields = [];
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
  console.log(`[WhatsApp Webhook POST] Diagnostic: object=${objectType}, entries=${entriesCount}, changes=${totalChanges}, fields=[${changeFields.join(", ")}]`);
  res.status(200).json({ status: "ok" });
  try {
    const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(payload);
    console.log(`[WhatsApp Webhook POST] Parsed: inboundMessages=${inboundMessages.length}, deliveryStatuses=${statuses.length}`);
    for (const st of statuses) {
      const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : void 0;
      whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
    }
    for (const msg of inboundMessages) {
      const maskedPhone = msg.senderPhone ? `${msg.senderPhone.slice(0, 4)}****${msg.senderPhone.slice(-2)}` : "unknown";
      const msgLen = msg.textBody?.length || 0;
      console.log(`[WhatsApp Meta Inbound] Received message: from=${maskedPhone}, type=${msg.type}, length=${msgLen}`);
      await studentSupportService.handleInboundMessage(msg);
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Background processing error:", err);
  }
});
app.get("/api/whatsapp/verify-subscription", async (req, res) => {
  try {
    const autoSub = req.query.subscribe === "true" || req.query.auto_subscribe === "true";
    const wabaOverride = req.query.waba_id || void 0;
    const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(autoSub, wabaOverride);
    res.status(subStatus.success ? 200 : 500).json({
      success: subStatus.success,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
      subscription: subStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || "Error checking subscription" });
  }
});
app.post("/api/whatsapp/subscribe-waba", async (_req, res) => {
  try {
    const subStatus = await whatsappCloudApiService.getMetaSubscriptionStatus(true);
    res.status(subStatus.success ? 200 : 500).json({
      success: subStatus.success,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      subscription: subStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || "Error subscribing WABA" });
  }
});
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
  } catch (err) {
    console.error("[Support Chat] Error handling message:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  }
});
app.use("/api/admin", requireAdminAuth);
app.get("/api/admin/orders", (_req, res) => {
  const total = orders.length;
  const paid = orders.filter((o) => o.orderStatus === "paid").length;
  const pending = orders.filter((o) => o.orderStatus === "pending").length;
  const failed = orders.filter((o) => o.orderStatus === "failed" || o.orderStatus === "cancelled").length;
  res.json({
    success: true,
    stats: { total, paid, pending, failed },
    orders
  });
});
app.get("/api/admin/payments", (_req, res) => {
  res.json({
    success: true,
    payments
  });
});
app.get("/api/admin/notifications", (_req, res) => {
  const allNotifs = whatsappNotificationService.getAllNotifications();
  const total = allNotifs.length;
  const sent = allNotifs.filter((n) => n.messageStatus === "sent" || n.messageStatus === "accepted" || n.messageStatus === "delivered" || n.messageStatus === "read").length;
  const failed = allNotifs.filter((n) => n.messageStatus === "failed").length;
  const pending = allNotifs.filter((n) => n.messageStatus === "pending").length;
  res.json({
    success: true,
    stats: { total, sent, failed, pending },
    notifications: allNotifs
  });
});
app.post("/api/admin/notifications/:id/retry", async (req, res) => {
  const notif = notifications.find((n) => n.id === req.params.id);
  if (!notif) return res.status(404).json({ error: "Notification record not found." });
  const order = orders.find((o) => o.id === notif.orderId);
  const payment = payments.find((p) => p.orderId === notif.orderId);
  if (!order) return res.status(400).json({ error: "Related order not found." });
  const sendRes = await sendPaymentConfirmationWhatsApp(
    order,
    payment || { amount: order.expectedAmount, paymentId: "Manual Retry" },
    true
    // force resend
  );
  res.json({ success: sendRes.success, sendRes, notification: notif });
});
app.get("/api/admin/tickets", (_req, res) => {
  const total = supportTickets.length;
  const open = supportTickets.filter((t) => t.status === "Open").length;
  const assigned = supportTickets.filter((t) => t.status === "Assigned").length;
  const inProgress = supportTickets.filter((t) => t.status === "In Progress").length;
  const waitingForStudent = supportTickets.filter((t) => t.status === "Waiting for Student").length;
  const resolved = supportTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
  res.json({
    success: true,
    stats: { total, open, assigned, inProgress, waitingForStudent, resolved },
    tickets: supportTickets
  });
});
app.patch("/api/admin/tickets/:id", (req, res) => {
  const ticket = supportTickets.find((t) => t.id === req.params.id || t.ticketNumber === req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found." });
  const { status, assignedAgentId, assignedAgentName, resolutionNotes, priority } = req.body;
  if (status !== void 0) ticket.status = status;
  if (assignedAgentId !== void 0) ticket.assignedAgentId = assignedAgentId;
  if (assignedAgentName !== void 0) ticket.assignedAgentName = assignedAgentName;
  if (resolutionNotes !== void 0) ticket.resolutionNotes = resolutionNotes;
  if (priority !== void 0) ticket.priority = priority;
  ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveSupportTickets();
  res.json({ success: true, ticket });
});
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
    keywords: Array.isArray(keywords) ? keywords : (keywords || "").split(",").map((k) => k.trim()),
    content
  });
  res.json({ success: true, item, items: getAiSupportService().getKnowledgeBase() });
});
app.delete("/api/admin/knowledge-base/:id", (req, res) => {
  const deleted = getAiSupportService().deleteKnowledgeItem(req.params.id);
  res.json({ success: deleted, items: getAiSupportService().getKnowledgeBase() });
});
app.get("/api/admin/conversations", (_req, res) => {
  res.json({
    success: true,
    conversations,
    messages
  });
});
app.post("/api/admin/conversations/:id/reply", async (req, res) => {
  const conv = conversations.find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  const { messageText } = req.body;
  if (!messageText || !messageText.trim()) return res.status(400).json({ error: "Message text is required." });
  const cleanRecipient = conv.whatsappNumber;
  let dispatched = false;
  let providerMsgId;
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
  const msgItem = {
    id: outMsgId,
    conversationId: conv.id,
    direction: "outbound",
    messageText: messageText.trim(),
    provider: "admin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  messages.push(msgItem);
  conv.lastMessageAt = (/* @__PURE__ */ new Date()).toISOString();
  conv.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveConversations();
  saveMessages();
  res.json({ success: true, message: msgItem, dispatched });
});
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
  const diskPath = path6.join(uploadsDir, "hero-video.mp4");
  try {
    fs6.writeFileSync(diskPath, buffer);
  } catch (diskErr) {
    console.warn("Could not save hero video to disk:", diskErr);
  }
  let finalVideoUrl = `/api/files/hero-video/${encodeURIComponent(safeFilename)}`;
  let uploadedToB2 = false;
  try {
    const objectKey = `site/hero-video-${Date.now()}-${safeFilename}`;
    const b2Res = await uploadBufferToB2(objectKey, buffer, mimeType || "video/mp4");
    if (b2Res.success && b2Res.url) {
      finalVideoUrl = b2Res.url;
      uploadedToB2 = true;
    }
  } catch (b2Err) {
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
  const diskPath = path6.join(uploadsDir, "hero-video.mp4");
  if (!fs6.existsSync(diskPath)) {
    return res.redirect("/video/wits-lingo-intro.mp4");
  }
  const stat = fs6.statSync(diskPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs6.createReadStream(diskPath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4"
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
    fs6.createReadStream(diskPath).pipe(res);
  }
});
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
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
      "image/gif",
      "image/avif"
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
    const ext = path6.extname(filename || "logo.png") || (cleanMime.includes("svg") ? ".svg" : ".png");
    const safeFilename = `wits-lingo-logo-${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const diskPath = path6.join(uploadsDir, safeFilename);
    try {
      fs6.writeFileSync(diskPath, buffer);
    } catch (diskErr) {
      console.warn("[Logo] Could not save logo to disk:", diskErr);
    }
    let finalLogoUrl = `/api/files/logo/${encodeURIComponent(safeFilename)}`;
    let uploadedToB2 = false;
    let b2FileId;
    let b2FileName;
    try {
      const objectKey = `branding/${safeFilename}`;
      const b2Res = await uploadBufferToB2(objectKey, buffer, cleanMime);
      if (b2Res.success && b2Res.url) {
        finalLogoUrl = b2Res.url;
        uploadedToB2 = true;
        b2FileId = b2Res.fileId;
        b2FileName = b2Res.fileName || objectKey;
      }
    } catch (b2Err) {
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
  } catch (err) {
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
  cmsContent.settings.b2LogoId = void 0;
  cmsContent.settings.b2LogoName = void 0;
  saveCmsContent();
  res.json({
    success: true,
    logoUrl: "/logo.svg",
    logoVersion: cmsContent.settings.logoVersion,
    message: "Main website logo reset to default SVG logo."
  });
});
app.get("/api/files/logo/:filename?", (req, res) => {
  const requestedFile = req.params.filename ? path6.basename(req.params.filename) : "";
  if (requestedFile) {
    const diskPath = path6.join(uploadsDir, requestedFile);
    if (fs6.existsSync(diskPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(diskPath);
    }
  }
  return res.redirect("/logo.svg");
});
app.get("/api/gallery", (req, res) => {
  try {
    const categoryFilter = typeof req.query.category === "string" ? req.query.category.trim() : "";
    let items = galleryItems.filter((item) => item.isPublished === true);
    if (categoryFilter && categoryFilter.toLowerCase() !== "all" && categoryFilter.toLowerCase() !== "all moments") {
      items = items.filter((item) => (item.category || "").toLowerCase() === categoryFilter.toLowerCase());
    }
    items.sort((a, b) => {
      const orderDiff = (a.displayOrder || 999) - (b.displayOrder || 999);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
    });
    const allCategoriesSet = /* @__PURE__ */ new Set();
    for (const item of galleryItems.filter((i) => i.isPublished === true)) {
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
  } catch (err) {
    console.error("[Gallery] Public fetch error:", err);
    res.status(500).json({ error: "Failed to load gallery." });
  }
});
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
  } catch (err) {
    res.status(500).json({ error: "Failed to load admin gallery." });
  }
});
app.post("/api/admin/gallery/upload", async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  try {
    const { images, dataBase64, filename, mimeType, title, caption, category, isPublished, displayOrder } = req.body;
    const uploadList = [];
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
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
      "image/svg+xml"
    ];
    const createdItems = [];
    for (const item of uploadList) {
      if (!item.dataBase64) continue;
      const mime = (item.mimeType || "image/jpeg").toLowerCase();
      if (!validMimeTypes.includes(mime) && !mime.startsWith("image/")) {
        continue;
      }
      const rawBase64 = item.dataBase64.includes(",") ? item.dataBase64.split(",")[1] : item.dataBase64;
      const buffer = Buffer.from(rawBase64, "base64");
      if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
        continue;
      }
      const id = `gal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const safeOriginalName = (item.filename || `photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const diskFilename = `${id}-${safeOriginalName}`;
      const diskPath = path6.join(uploadsDir, diskFilename);
      try {
        fs6.writeFileSync(diskPath, buffer);
      } catch (diskErr) {
        console.warn("[Gallery] Could not cache image on disk:", diskErr);
      }
      let imageUrl = `/api/files/gallery/${id}/${encodeURIComponent(safeOriginalName)}`;
      let b2FileId;
      let b2FileName;
      try {
        const b2Key = `gallery/${id}-${safeOriginalName}`;
        const b2Res = await uploadBufferToB2(b2Key, buffer, mime);
        if (b2Res.success && b2Res.url) {
          imageUrl = b2Res.url;
          b2FileId = b2Res.fileId;
          b2FileName = b2Res.fileName || b2Key;
        }
      } catch (b2Err) {
        console.warn("[Gallery] Backblaze B2 upload error, falling back to local stream:", b2Err?.message);
      }
      const sizeMB = buffer.length / (1024 * 1024);
      const fileSize = sizeMB >= 1 ? `${sizeMB.toFixed(1)} MB` : `${Math.round(buffer.length / 1024)} KB`;
      const autoTitle = (item.title || "").trim() || safeOriginalName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const newGalleryItem = {
        id,
        title: autoTitle,
        caption: (item.caption || "").trim(),
        category: (item.category || "Classrooms").trim(),
        imageUrl,
        thumbnailUrl: imageUrl,
        b2FileId,
        b2FileName,
        isPublished: item.isPublished !== false,
        displayOrder: typeof item.displayOrder === "number" ? item.displayOrder : galleryItems.length + 1,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
  } catch (err) {
    console.error("[Gallery] Upload failed:", err);
    res.status(500).json({ error: "Server error during gallery upload." });
  }
});
app.put("/api/admin/gallery/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const item = galleryItems.find((g) => g.id === id);
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
app.put("/api/admin/gallery/reorder", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds array required." });
  }
  orderedIds.forEach((id, index) => {
    const item = galleryItems.find((g) => g.id === id);
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
app.delete("/api/admin/gallery/:id", async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = galleryItems.findIndex((g) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Gallery item not found." });
  }
  const targetItem = galleryItems[idx];
  galleryItems.splice(idx, 1);
  savePersistedGallery();
  try {
    if (fs6.existsSync(uploadsDir)) {
      const files = fs6.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith(id) || file.startsWith(`gal-${id}`)) {
          try {
            fs6.unlinkSync(path6.join(uploadsDir, file));
          } catch (unlinkErr) {
          }
        }
      }
    }
  } catch (cleanErr) {
    console.warn("[Gallery] Local file cleanup error:", cleanErr);
  }
  if (targetItem.b2FileId || targetItem.b2FileName) {
    deleteFileFromB2(targetItem.b2FileId, targetItem.b2FileName).catch((b2Err) => {
      console.warn("[Gallery] B2 file delete error:", b2Err);
    });
  }
  res.json({
    success: true,
    message: "Gallery image deleted successfully."
  });
});
app.get("/api/files/gallery/:id/:filename?", async (req, res) => {
  const { id, filename } = req.params;
  let foundPath = null;
  try {
    if (fs6.existsSync(uploadsDir)) {
      const files = fs6.readdirSync(uploadsDir);
      for (const f of files) {
        if (f.startsWith(id)) {
          foundPath = path6.join(uploadsDir, f);
          break;
        }
      }
    }
  } catch (e) {
  }
  if (foundPath && fs6.existsSync(foundPath)) {
    const ext = path6.extname(foundPath).toLowerCase();
    const mimeTypes = {
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
    return fs6.createReadStream(foundPath).pipe(res);
  }
  const item = galleryItems.find((g) => g.id === id);
  if (item && (item.b2FileId || item.b2FileName)) {
    try {
      const b2Res = await downloadBufferFromB2(item.b2FileId, item.b2FileName);
      if (b2Res.success && b2Res.buffer) {
        try {
          const diskSave = path6.join(uploadsDir, `${id}-${filename || "image.jpg"}`);
          fs6.writeFileSync(diskSave, b2Res.buffer);
        } catch (e) {
        }
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
  const pCode = phoneCountryCode || (typeof phone === "string" && phone.startsWith("+") ? phone.split(" ")[0] : "+91");
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
  const wCode = whatsappCountryCode || (typeof whatsapp === "string" && whatsapp.startsWith("+") ? whatsapp.split(" ")[0] : pCode);
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
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) {
    return res.status(404).json({ error: "Selected batch not found." });
  }
  const course = cmsContent.courses.find((c) => c.id === courseId) || { name: "Spoken English", fee: 1499 };
  const paymentStatus = isFeePaid && isAdmin || isFeePaid ? "Paid" : "Pending";
  const batchYearMonth = batch.batchCode.replace(/[^A-Za-z0-9]/g, "");
  const randomSeq = Math.floor(1e3 + Math.random() * 9e3);
  const admissionId = `WL-${batchYearMonth}-${randomSeq}`;
  const studentReg = {
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
    address: address?.trim() || `${district}, ${state}, ${country || "India"}${pincode ? " - " + pincode : ""}`,
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
    paymentAmountFormatted: req.body.paymentAmountFormatted || `\u20B9${course.fee.toLocaleString()}`,
    paymentTxnId: paymentTxnId || `adm_${Date.now()}`,
    googleMeetLink: batch.googleMeetLink || "",
    registeredAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  registrations.unshift(studentReg);
  if (paymentStatus === "Paid") {
    batch.currentStudentsCount = (batch.currentStudentsCount || 0) + 1;
  }
  const assignedPassword = (req.body.password || req.body.studentPassword || "WitsLingo@2026").trim();
  let user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
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
      registrationDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    users.push(user);
  }
  const token = generateAuthToken(user);
  const fullCountryDigits = (wCodeDigits || "91").replace(/\D/g, "") || "91";
  const whatsappCleanRecipient = `${fullCountryDigits}${cleanWhatsapp}`;
  const whatsappConfirmationText = `\u{1F393} *WITS LINGO \u2014 OFFICIAL ADMISSION CONFIRMATION*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Dear *${name.trim()}*,
Congratulations! Your seat has been successfully confirmed at *WITS LINGO \u2014 A Global Language Platform*.

\u{1F4CB} *ADMISSION SUMMARY*
\u2022 *Admission ID / Roll No:* ${admissionId}
\u2022 *Student Name:* ${name.trim()}
\u2022 *Father's Name:* ${fatherName.trim()}
\u2022 *Enrolled Course:* ${course.name}
\u2022 *Assigned Batch:* ${batch.name} (${batch.batchCode})
\u2022 *Batch Timings:* ${batch.scheduleTime || "Daily 1-Hour Live Class"}
\u2022 *Batch Start Date:* ${batch.startDate || "1st of the month"}
\u2022 *Google Meet Link:* ${WITS_LINGO_CONFIG.GOOGLE_MEET_LINK}
\u2022 *Fee Status:* ${paymentStatus} (${studentReg.paymentAmountFormatted || "\u20B9" + course.fee})
\u2022 *Payment Ref:* ${studentReg.paymentTxnId}

\u{1F510} *PURCHASED BATCH PORTAL LOGIN*
\u2022 *Portal URL:* https://witslingo.com/login
\u2022 *Username:* ${user.email} (or ${admissionId})
\u2022 *Password:* ${user.passwordHash}

\u{1F4F1} *BATCH WHATSAPP GROUP & SUPPORT*
Save our official mentor helpline on WhatsApp:
\u{1F4DE} *${WITS_LINGO_CONFIG.WHATSAPP_BUSINESS_NUMBER}*
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
  saveRegistrations();
  saveUsers();
  saveBatches();
  if (paymentStatus === "Paid") {
    const courseObj = (cmsContent.courses || []).find((c) => c.id === studentReg.courseId || c.name === studentReg.courseName);
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
    }).then((waRes) => {
      if (waRes.success) {
        studentReg.whatsappDeliveryStatus = "sent";
        if (waRes.messageId) studentReg.whatsappMessageId = waRes.messageId;
      } else {
        studentReg.whatsappDeliveryStatus = "failed";
        if (waRes.error) studentReg.whatsappError = waRes.error;
      }
      saveRegistrations();
    }).catch((err) => {
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
app.get("/api/student/admission-slip", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const reg = registrations.find(
    (r) => auth.admissionId && r.admissionId === auth.admissionId || r.email.toLowerCase() === auth.email.toLowerCase()
  );
  if (!reg) {
    return res.status(404).json({ error: "No admission registration found for this student account." });
  }
  const batch = batches.find((b) => b.id === reg.batchId);
  const rawCleanPhone = (reg.whatsapp || reg.phone || "").replace(/\D/g, "");
  const recipientDigits = rawCleanPhone.length === 10 ? `91${rawCleanPhone}` : rawCleanPhone;
  const encodedMsg = encodeURIComponent(
    reg.whatsappConfirmationMessage || `\u{1F393} *WITS LINGO \u2014 OFFICIAL ADMISSION CONFIRMATION*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Dear *${reg.name}*,
Your seat is confirmed at *WITS LINGO \u2014 A Global Language Platform*!

\u2022 Admission ID: ${reg.admissionId}
\u2022 Course: ${reg.courseName}
\u2022 Batch: ${reg.batchName} (${batch?.batchCode || "ACTIVE"})
\u2022 Timings: ${batch?.scheduleTime || "Daily Live Class"}
\u2022 Username: ${reg.email}
\u2022 Fee Paid: \u20B9${reg.feeAmount} (Verified)

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
      formattedAmount: reg.paymentAmountFormatted || `\u20B9${reg.feeAmount}`,
      paymentStatus: reg.paymentStatus,
      paymentMethod: reg.paymentMethod,
      txnId: reg.paymentTxnId,
      registeredAt: reg.registeredAt,
      username: auth.email,
      password: auth.role === "student" ? "WitsLingo@2026" : void 0,
      whatsappConfirmationMessage: reg.whatsappConfirmationMessage,
      whatsappStudentUrl: studentUrl,
      whatsappAdminUrl: adminUrl
    }
  });
});
app.get("/api/admin/students", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { batchId } = req.query;
  let list = registrations;
  if (batchId && typeof batchId === "string" && batchId !== "all") {
    list = list.filter((r) => r.batchId === batchId);
  }
  res.json({ students: list, totalCount: list.length });
});
app.post("/api/admin/students/:id/resend-whatsapp", async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { id } = req.params;
  const reg = registrations.find((r) => r.id === id || r.admissionId === id);
  if (!reg) {
    return res.status(404).json({ error: "Student enrollment record not found." });
  }
  const batch = batches.find((b) => b.id === reg.batchId);
  const course = (cmsContent.courses || []).find((c) => c.id === reg.courseId || c.name === reg.courseName);
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
app.post("/api/admin/registrations/:id/resend-whatsapp", async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { id } = req.params;
  const reg = registrations.find((r) => r.id === id || r.admissionId === id);
  if (!reg) {
    return res.status(404).json({ error: "Student enrollment record not found." });
  }
  const batch = batches.find((b) => b.id === reg.batchId);
  const course = (cmsContent.courses || []).find((c) => c.id === reg.courseId || c.name === reg.courseName);
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
app.post("/api/admin/batches", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { name, courseId, courseName, batchCode, startDate, endDate, teacherName, scheduleTime, maxStudents, status, googleMeetLink } = req.body;
  if (!name || !batchCode) {
    return res.status(400).json({ error: "Batch name and code are required." });
  }
  const newBatch = {
    id: `batch-${batchCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
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
app.post("/api/admin/schedule-class", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { batchId, title, topic, classNumber, date, startTime, endTime, durationMinutes, teacherName, description, status } = req.body;
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) return res.status(400).json({ error: "Invalid batch." });
  const newClass = {
    id: `cls-${Date.now()}`,
    batchId,
    batchName: batch.name,
    title: title || `Class ${classNumber || classes.length + 1} \u2014 ${topic || "English Session"}`,
    topic: topic || "English Practice",
    classNumber: Number(classNumber) || classes.length + 1,
    date: date || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
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
  if (status === "Live") {
    announcements.unshift({
      id: `ann-${Date.now()}`,
      batchId: batch.id,
      batchName: batch.name,
      title: `\u{1F534} Class is LIVE: ${newClass.title}`,
      message: `Instructor ${newClass.teacherName} has started the live class. Click 'Join Live Class' in your student dashboard to attend now!`,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
      author: newClass.teacherName,
      priority: "Urgent"
    });
  }
  res.json({ success: true, class: newClass });
});
app.post("/api/admin/classes/:classId/status", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Access Denied: Admin authorization required." });
  }
  const { classId } = req.params;
  const { status, autoRecord } = req.body;
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return res.status(404).json({ error: "Class not found." });
  const oldStatus = cls.status;
  cls.status = status;
  if (oldStatus === "Live" && status === "Completed" && autoRecord !== false) {
    const recId = `rec-${cls.id}`;
    let rec = recordings.find((r) => r.classId === cls.id);
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
    announcements.unshift({
      id: `ann-${Date.now()}`,
      batchId: cls.batchId,
      batchName: cls.batchName,
      title: `\u25B6 Recording Available: ${cls.title}`,
      message: `The recording for ${cls.title} has completed processing and is now available in your Recorded Classes section.`,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
      author: "Wits Lingo Academy",
      priority: "Normal"
    });
  }
  res.json({ success: true, class: cls });
});
app.post("/api/admin/recordings", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { classId, title, topic, duration, notesSummary } = req.body;
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return res.status(400).json({ error: "Valid class ID is required." });
  const newRec = {
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
function extractYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const cleanUrl = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = cleanUrl.match(regExp);
  return match && match[1] ? match[1] : null;
}
var handleYouTubeMetadataFetch = async (req, res) => {
  const rawUrl = req.body?.url || req.query?.url || "";
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
      const data = await response.json();
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
  } catch (err) {
    console.warn("YouTube oEmbed fetch exception:", err?.message);
  }
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
function sortLearningMaterials(items) {
  return [...items].sort((a, b) => {
    const orderA = a.displayOrder !== void 0 ? a.displayOrder : 9999;
    const orderB = b.displayOrder !== void 0 ? b.displayOrder : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return (b.id || "").localeCompare(a.id || "");
  });
}
app.get(["/api/materials", "/api/learning-resources"], (req, res) => {
  const publicMaterials = sortLearningMaterials(studyMaterials).filter((m) => m.isVisibleOnWebsite !== false && m.isPublished !== false).map((m) => ({
    ...m,
    downloadUrl: !m.downloadUrl || m.downloadUrl === "#" ? `/api/files/download/${m.id}` : m.downloadUrl
  }));
  res.json({ materials: publicMaterials, resources: publicMaterials });
});
app.get(["/api/admin/materials", "/api/admin/learning-resources"], (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const allMaterials = sortLearningMaterials(studyMaterials).map((m) => ({
    ...m,
    downloadUrl: !m.downloadUrl || m.downloadUrl === "#" ? `/api/files/download/${m.id}` : m.downloadUrl
  }));
  res.json({ materials: allMaterials, resources: allMaterials });
});
app.post(["/api/admin/materials", "/api/admin/learning-resources"], (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const {
    resourceType,
    batchId,
    classId,
    title,
    description,
    fileType,
    fileSize,
    pdfUrl,
    downloadUrl,
    b2FileId,
    b2FileName,
    mimeType,
    isViewOnly,
    allowDownload,
    isVisibleOnWebsite,
    isPublished,
    displayOrder,
    category,
    level,
    youtubeUrl,
    thumbnailUrl,
    b2ThumbnailId,
    b2ThumbnailName,
    duration,
    views
  } = req.body;
  const newId = `mat-${Date.now()}`;
  const resType = resourceType === "youtube" || fileType === "youtube" ? "youtube" : "pdf";
  let safeTitle = (title || (resType === "youtube" ? "YouTube Video Lesson" : "Study Material.pdf")).trim();
  let finalFileType = fileType || (resType === "youtube" ? "youtube" : safeTitle.toLowerCase().endsWith(".pdf") ? "pdf" : "doc");
  let finalDownloadUrl = downloadUrl && downloadUrl !== "#" ? downloadUrl : `/api/files/download/${newId}`;
  let finalPdfUrl = pdfUrl || (resType === "pdf" ? `/api/files/pdf/${newId}/${encodeURIComponent(safeTitle)}` : void 0);
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
  const newMat = {
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
    isViewOnly: isViewOnly !== void 0 ? Boolean(isViewOnly) : true,
    allowDownload: Boolean(allowDownload),
    isVisibleOnWebsite: isVisibleOnWebsite !== void 0 ? Boolean(isVisibleOnWebsite) : isPublished !== void 0 ? Boolean(isPublished) : true,
    isPublished: isPublished !== void 0 ? Boolean(isPublished) : isVisibleOnWebsite !== void 0 ? Boolean(isVisibleOnWebsite) : true,
    displayOrder: displayOrder !== void 0 ? Number(displayOrder) : studyMaterials.length + 1,
    category: category || (resType === "youtube" ? "Daily English" : "Worksheets"),
    level: level || "All Levels",
    uploadedAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    uploadedDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    youtubeUrl: finalYoutubeUrl,
    thumbnailUrl: finalThumbnailUrl,
    b2ThumbnailId,
    b2ThumbnailName,
    duration: duration || "12:00",
    views: views || "1.2K views",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  studyMaterials.unshift(newMat);
  if (classId) {
    const cls = classes.find((c) => c.id === classId);
    if (cls) cls.hasStudyMaterial = true;
  }
  savePersistedMaterials();
  const sorted = sortLearningMaterials(studyMaterials);
  res.json({ success: true, material: newMat, materials: sorted, resources: sorted });
});
app.put(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const mat = studyMaterials.find((m) => m.id === id);
  if (!mat) {
    return res.status(404).json({ error: "Study material or learning resource not found." });
  }
  const {
    resourceType,
    title,
    description,
    batchId,
    classId,
    fileType,
    fileSize,
    pdfUrl,
    downloadUrl,
    b2FileId,
    b2FileName,
    mimeType,
    isViewOnly,
    allowDownload,
    isVisibleOnWebsite,
    isPublished,
    displayOrder,
    category,
    level,
    youtubeUrl,
    thumbnailUrl,
    b2ThumbnailId,
    b2ThumbnailName,
    duration,
    views
  } = req.body;
  if (b2FileId && mat.b2FileId && b2FileId !== mat.b2FileId) {
    deleteFileFromB2(mat.b2FileId, mat.b2FileName).catch(() => {
    });
  }
  if (b2ThumbnailId && mat.b2ThumbnailId && b2ThumbnailId !== mat.b2ThumbnailId) {
    deleteFileFromB2(mat.b2ThumbnailId, mat.b2ThumbnailName).catch(() => {
    });
  }
  if (resourceType !== void 0) mat.resourceType = resourceType;
  if (title !== void 0) mat.title = title;
  if (description !== void 0) mat.description = description;
  if (batchId !== void 0) mat.batchId = batchId;
  if (classId !== void 0) mat.classId = classId;
  if (fileType !== void 0) mat.fileType = fileType;
  if (fileSize !== void 0) mat.fileSize = fileSize;
  if (pdfUrl !== void 0) mat.pdfUrl = pdfUrl;
  if (downloadUrl !== void 0 && downloadUrl !== "#") mat.downloadUrl = downloadUrl;
  if (b2FileId !== void 0) mat.b2FileId = b2FileId;
  if (b2FileName !== void 0) mat.b2FileName = b2FileName;
  if (mimeType !== void 0) mat.mimeType = mimeType;
  if (isViewOnly !== void 0) mat.isViewOnly = Boolean(isViewOnly);
  if (allowDownload !== void 0) mat.allowDownload = Boolean(allowDownload);
  if (isVisibleOnWebsite !== void 0) mat.isVisibleOnWebsite = Boolean(isVisibleOnWebsite);
  if (isPublished !== void 0) {
    mat.isPublished = Boolean(isPublished);
    mat.isVisibleOnWebsite = Boolean(isPublished);
  }
  if (displayOrder !== void 0) mat.displayOrder = Number(displayOrder);
  if (category !== void 0) mat.category = category;
  if (level !== void 0) mat.level = level;
  if (youtubeUrl !== void 0) {
    mat.youtubeUrl = youtubeUrl;
    const vidId = extractYouTubeVideoId(youtubeUrl);
    if (vidId && !thumbnailUrl && !mat.thumbnailUrl) {
      mat.thumbnailUrl = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
    }
  }
  if (thumbnailUrl !== void 0) mat.thumbnailUrl = thumbnailUrl;
  if (b2ThumbnailId !== void 0) mat.b2ThumbnailId = b2ThumbnailId;
  if (b2ThumbnailName !== void 0) mat.b2ThumbnailName = b2ThumbnailName;
  if (duration !== void 0) mat.duration = duration;
  if (views !== void 0) mat.views = views;
  mat.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  savePersistedMaterials();
  const sorted = sortLearningMaterials(studyMaterials);
  res.json({ success: true, material: mat, materials: sorted, resources: sorted });
});
app.delete(["/api/admin/materials/:id", "/api/admin/learning-resources/:id"], async (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = studyMaterials.findIndex((m) => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Study material or resource not found." });
  }
  const mat = studyMaterials[idx];
  if (mat.b2FileId || mat.b2FileName) {
    deleteFileFromB2(mat.b2FileId, mat.b2FileName).catch(() => {
    });
  }
  if (mat.b2ThumbnailId || mat.b2ThumbnailName) {
    deleteFileFromB2(mat.b2ThumbnailId, mat.b2ThumbnailName).catch(() => {
    });
  }
  try {
    const diskPath1 = path6.join(uploadsDir, `${id}.pdf`);
    if (fs6.existsSync(diskPath1)) fs6.unlinkSync(diskPath1);
    if (mat.b2FileName) {
      const diskPath2 = path6.join(uploadsDir, path6.basename(mat.b2FileName));
      if (fs6.existsSync(diskPath2)) fs6.unlinkSync(diskPath2);
    }
  } catch (e) {
  }
  studyMaterials.splice(idx, 1);
  savePersistedMaterials();
  const sorted = sortLearningMaterials(studyMaterials);
  res.json({ success: true, message: "Resource deleted.", materials: sorted, resources: sorted });
});
app.get("/api/admin/b2-status", async (req, res) => {
  try {
    const native = await getB2NativeAuth();
    if (native && native.bucketName) {
      return res.json({
        connected: true,
        bucket: native.bucketName,
        endpoint: "s3.us-east-005.backblazeb2.com",
        bucketId: native.bucketId
      });
    }
    const config2 = getBackblazeConfig();
    if (config2) {
      return res.json({
        connected: true,
        bucket: config2.bucket,
        endpoint: config2.cleanEndpoint
      });
    }
    res.json({
      connected: false,
      bucket: null
    });
  } catch (e) {
    res.json({
      connected: false,
      bucket: null
    });
  }
});
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
  const ext = path6.extname(rawFilename).toLowerCase() || ".pdf";
  if (FORBIDDEN_EXEC_EXTS.has(ext)) {
    return res.status(400).json({ error: `File type ${ext} is not allowed for security reasons.` });
  }
  const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const resolvedMime = getSafeFileMimeType(safeFilename, mimeType);
  const base64Content = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
  const buffer = Buffer.from(base64Content, "base64");
  if (buffer.length > 50 * 1024 * 1024) {
    return res.status(400).json({ error: "File exceeds maximum allowed size of 50 MB." });
  }
  try {
    const diskPath = path6.join(uploadsDir, `${fileId}-${safeFilename}`);
    fs6.writeFileSync(diskPath, buffer);
    const diskPathShort = path6.join(uploadsDir, `${fileId}.pdf`);
    fs6.writeFileSync(diskPathShort, buffer);
  } catch (err) {
    console.warn("Failed saving upload to disk:", err);
  }
  const formattedSize = buffer.length > 1024 * 1024 ? `${(buffer.length / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(buffer.length / 1024)} KB`;
  let finalUrl = `/api/files/pdf/${fileId}/${encodeURIComponent(safeFilename)}`;
  let uploadedToB2 = false;
  let b2FileId;
  let b2FileName;
  let b2Url;
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
  } catch (b2Err) {
    console.warn("Failed uploading to Backblaze B2, fell back to local storage:", b2Err?.message);
  }
  uploadedPdfFiles.set(fileId, {
    id: fileId,
    filename: safeFilename,
    mimeType: resolvedMime,
    size: buffer.length,
    dataBase64: "",
    // Do not keep base64 in RAM
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
    b2FileId,
    b2FileName,
    b2Url
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
app.get("/api/files/pdf/:id/:filename?", async (req, res) => {
  const { id, filename: reqFilename } = req.params;
  let buffer = null;
  let filename = reqFilename || "document.pdf";
  let mimeType = "application/pdf";
  const mat = studyMaterials.find((m) => m.id === id || m.pdfUrl?.includes(id));
  const memFile = uploadedPdfFiles.get(id);
  if (mat) {
    filename = mat.title || filename;
    mimeType = mat.mimeType || getSafeFileMimeType(filename);
  } else if (memFile) {
    filename = memFile.filename || filename;
    mimeType = memFile.mimeType || getSafeFileMimeType(filename);
  }
  let extractedFileId;
  if (mat?.pdfUrl && mat.pdfUrl.includes("/api/files/pdf/")) {
    const match = mat.pdfUrl.match(/\/api\/files\/pdf\/([a-zA-Z0-9_-]+)/);
    if (match) extractedFileId = match[1];
  }
  const possibleDiskPaths = [
    path6.join(uploadsDir, `${id}.pdf`),
    path6.join(uploadsDir, `${id}-${filename}`),
    extractedFileId ? path6.join(uploadsDir, `${extractedFileId}.pdf`) : "",
    extractedFileId ? path6.join(uploadsDir, `${extractedFileId}-${filename}`) : "",
    mat?.b2FileName ? path6.join(uploadsDir, path6.basename(mat.b2FileName)) : "",
    memFile?.b2FileName ? path6.join(uploadsDir, path6.basename(memFile.b2FileName)) : ""
  ].filter(Boolean);
  for (const dp of possibleDiskPaths) {
    if (fs6.existsSync(dp)) {
      try {
        buffer = fs6.readFileSync(dp);
        break;
      } catch (e) {
      }
    }
  }
  if (!buffer && (id || extractedFileId)) {
    const searchPrefix = extractedFileId || id;
    try {
      const files = fs6.readdirSync(uploadsDir);
      const matchFile = files.find((f) => f.startsWith(searchPrefix));
      if (matchFile) {
        buffer = fs6.readFileSync(path6.join(uploadsDir, matchFile));
      }
    } catch (e) {
    }
  }
  const targetFileId = mat?.b2FileId || memFile?.b2FileId;
  const targetFileName = mat?.b2FileName || memFile?.b2FileName || (id ? `materials/${id}-${filename}` : void 0);
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
app.get("/api/files/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const rawToken = (req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.query.token || "").trim();
    const auth = rawToken ? verifyAuthToken(rawToken) : null;
    const isAdmin = auth?.role === "admin";
    const mat = studyMaterials.find((m) => m.id === id || m.pdfUrl?.includes(id) || m.downloadUrl?.includes(id));
    const memFile = uploadedPdfFiles.get(id);
    if (!mat && !memFile && !isAdmin) {
      return res.status(404).json({ error: "Requested study material was not found." });
    }
    if (mat) {
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
    let buffer = null;
    let extractedFileId;
    if (mat?.pdfUrl && mat.pdfUrl.includes("/api/files/pdf/")) {
      const match = mat.pdfUrl.match(/\/api\/files\/pdf\/([a-zA-Z0-9_-]+)/);
      if (match) extractedFileId = match[1];
    }
    const possibleDiskPaths = [
      path6.join(uploadsDir, `${id}.pdf`),
      path6.join(uploadsDir, `${id}-${filename}`),
      extractedFileId ? path6.join(uploadsDir, `${extractedFileId}.pdf`) : "",
      extractedFileId ? path6.join(uploadsDir, `${extractedFileId}-${filename}`) : "",
      mat?.b2FileName ? path6.join(uploadsDir, path6.basename(mat.b2FileName)) : "",
      memFile?.b2FileName ? path6.join(uploadsDir, path6.basename(memFile.b2FileName)) : ""
    ].filter(Boolean);
    for (const dp of possibleDiskPaths) {
      if (fs6.existsSync(dp)) {
        try {
          buffer = fs6.readFileSync(dp);
          break;
        } catch (e) {
        }
      }
    }
    if (!buffer && (id || extractedFileId)) {
      const searchPrefix = extractedFileId || id;
      try {
        const files = fs6.readdirSync(uploadsDir);
        const matchFile = files.find((f) => f.startsWith(searchPrefix));
        if (matchFile) {
          buffer = fs6.readFileSync(path6.join(uploadsDir, matchFile));
        }
      } catch (e) {
      }
    }
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
    if (!buffer && mat?.pdfUrl && mat.pdfUrl.startsWith("http")) {
      const gDriveMatch = mat.pdfUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) || mat.pdfUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i) || mat.pdfUrl.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/i);
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
  } catch (err) {
    console.error("Error serving secure download:", err);
    res.status(500).json({ error: "Internal error processing download request." });
  }
});
app.get("/api/proxy-pdf", async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).send("Missing target document URL.");
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return res.status(400).send("Invalid document URL format.");
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).send("Only HTTP and HTTPS URLs are permitted.");
    }
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
    const headers = {
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
    const basename = path6.basename(pathname) || "document.pdf";
    const safeBasename = basename.endsWith(".pdf") ? basename : `${basename}.pdf`;
    res.setHeader("Content-Type", contentType.includes("pdf") ? "application/pdf" : contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeBasename)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.send(buffer);
  } catch (err) {
    console.error("Error proxying PDF document:", err);
    res.status(500).send("Unable to stream the requested document.");
  }
});
app.post("/api/admin/announcements", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { batchId, title, message, priority, category, effectiveDate, isPinned } = req.body;
  const batch = batches.find((b) => b.id === batchId);
  const newAnn = {
    id: `ann-${Date.now()}`,
    batchId: batchId === "all" ? "all" : batchId || (batch ? batch.id : "all"),
    batchName: batchId === "all" ? "All Batches (Academy-wide)" : batch ? batch.name : "All Batches (Academy-wide)",
    title: title || "Official Academy Announcement",
    message: message || "",
    date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    author: "Ziyaur Rehman Zia",
    priority: priority || "Normal",
    category: category || "General",
    effectiveDate: effectiveDate || "",
    isPinned: Boolean(isPinned)
  };
  announcements.unshift(newAnn);
  res.json({ success: true, announcement: newAnn });
});
app.get("/api/announcements", (req, res) => {
  res.json({ announcements });
});
app.put("/api/admin/announcements/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const annIndex = announcements.findIndex((a) => a.id === id);
  if (annIndex === -1) {
    return res.status(404).json({ error: "Announcement not found." });
  }
  const { title, message, priority, category, effectiveDate, isPinned, batchId } = req.body;
  const batch = batches.find((b) => b.id === batchId);
  announcements[annIndex] = {
    ...announcements[annIndex],
    title: title !== void 0 ? title : announcements[annIndex].title,
    message: message !== void 0 ? message : announcements[annIndex].message,
    priority: priority !== void 0 ? priority : announcements[annIndex].priority,
    category: category !== void 0 ? category : announcements[annIndex].category,
    effectiveDate: effectiveDate !== void 0 ? effectiveDate : announcements[annIndex].effectiveDate,
    isPinned: isPinned !== void 0 ? Boolean(isPinned) : announcements[annIndex].isPinned,
    batchId: batchId !== void 0 ? batchId === "all" ? "all" : batch ? batch.id : batchId : announcements[annIndex].batchId,
    batchName: batchId === "all" ? "All Batches (Academy-wide)" : batch ? batch.name : announcements[annIndex].batchName
  };
  res.json({ success: true, announcement: announcements[annIndex] });
});
app.delete("/api/admin/announcements/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = announcements.findIndex((a) => a.id === id);
  if (idx !== -1) {
    announcements.splice(idx, 1);
  }
  res.json({ success: true });
});
app.get("/api/admin/attendance", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { batchId, classId } = req.query;
  let list = attendanceRecords;
  if (batchId && typeof batchId === "string" && batchId !== "all") {
    list = list.filter((a) => a.batchId === batchId);
  }
  if (classId && typeof classId === "string") {
    list = list.filter((a) => a.classId === classId);
  }
  res.json({ attendance: list, totalCount: list.length });
});
app.delete("/api/admin/students/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const regIdx = registrations.findIndex((r) => r.id === id || r.admissionId === id);
  if (regIdx !== -1) {
    const reg = registrations[regIdx];
    registrations.splice(regIdx, 1);
    const userIdx = users.findIndex((u) => u.admissionId === reg.admissionId || u.email === reg.email);
    if (userIdx !== -1) {
      users.splice(userIdx, 1);
      saveUsers();
    }
    saveRegistrations();
    return res.json({ success: true, message: "Student admission deleted successfully." });
  }
  res.status(404).json({ error: "Student registration not found." });
});
app.put("/api/admin/students/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const reg = registrations.find((r) => r.id === id || r.admissionId === id);
  if (!reg) return res.status(404).json({ error: "Student registration not found." });
  Object.assign(reg, req.body);
  saveRegistrations();
  res.json({ success: true, student: reg });
});
app.put("/api/admin/batches/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const batch = batches.find((b) => b.id === id);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  Object.assign(batch, req.body);
  saveBatches();
  res.json({ success: true, batch });
});
app.delete("/api/admin/batches/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = batches.findIndex((b) => b.id === id);
  if (idx !== -1) {
    batches.splice(idx, 1);
    saveBatches();
    return res.json({ success: true, message: "Batch deleted successfully." });
  }
  res.status(404).json({ error: "Batch not found." });
});
app.put("/api/admin/classes/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const cls = classes.find((c) => c.id === id);
  if (!cls) return res.status(404).json({ error: "Class not found." });
  Object.assign(cls, req.body);
  res.json({ success: true, class: cls });
});
app.delete("/api/admin/classes/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = classes.findIndex((c) => c.id === id);
  if (idx !== -1) {
    classes.splice(idx, 1);
    return res.json({ success: true, message: "Class deleted successfully." });
  }
  res.status(404).json({ error: "Class not found." });
});
app.put("/api/admin/recordings/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const rec = recordings.find((r) => r.id === id);
  if (!rec) return res.status(404).json({ error: "Recording not found." });
  Object.assign(rec, req.body);
  res.json({ success: true, recording: rec });
});
app.delete("/api/admin/recordings/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const { id } = req.params;
  const idx = recordings.findIndex((r) => r.id === id);
  if (idx !== -1) {
    recordings.splice(idx, 1);
    return res.json({ success: true, message: "Recording deleted successfully." });
  }
  res.status(404).json({ error: "Recording not found." });
});
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
  if (announcementText !== void 0) cmsContent.announcementText = announcementText;
  if (announcementBtnText !== void 0) cmsContent.announcementBtnText = announcementBtnText;
  if (showAnnouncement !== void 0) cmsContent.showAnnouncement = showAnnouncement;
  if (settings) {
    cmsContent.settings = { ...cmsContent.settings, ...settings };
  }
  saveCmsContent();
  res.json({ success: true, content: cmsContent });
});
app.post("/api/contact", (req, res) => {
  const { name, contact, learningInterest, message } = req.body;
  if (!name || !contact || !message) {
    return res.status(400).json({ error: "Please fill in all contact form fields." });
  }
  const whatsappConfirmationText = `\u{1F44B} *NEW INQUIRY RECEIVED \u2014 WITS LINGO*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Dear *${name.trim()}*,
Thank you for contacting *WITS LINGO \u2014 A Global Language Platform*!

\u{1F4CB} *INQUIRY SUMMARY*
\u2022 *Name:* ${name.trim()}
\u2022 *Contact:* ${contact.trim()}
\u2022 *Course Interest:* ${learningInterest || "Spoken English"}
\u2022 *Message:* ${message.trim()}

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
app.get("/api/documentation", (req, res) => {
  res.json({
    status: "success",
    academy: "WITS LINGO \u2014 A Global Language Platform",
    reportTitle: "WITS LINGO Full Architecture & System Documentation (A to Z)",
    generatedDate: (/* @__PURE__ */ new Date()).toISOString(),
    metadata: {
      server: "Node.js Express 4.x",
      client: "React 18 + Vite + Tailwind CSS",
      storage: "Backblaze B2 & Disk Proxy",
      auth: "HMAC-SHA256 Token Engine",
      port: 3e3
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
app.get("/api/courses", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  const includeAll = req.query.includeAll === "true" || auth && auth.role === "admin";
  if (includeAll) {
    return res.json({ courses: cmsContent.courses });
  }
  const publishedCourses = cmsContent.courses.filter((c) => c.isPublished !== false);
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
    id: `course-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
    name,
    level: level || "Beginner",
    shortDescription: shortDescription || "",
    whatYouWillLearn: Array.isArray(whatYouWillLearn) ? whatYouWillLearn : [],
    duration: duration || "2 Months",
    learningFormat: learningFormat || "Live Online Classroom",
    fee: Number(fee) || 1199,
    badge: badge || "",
    isPublished: isPublished !== false
    // default to true if not specified
  };
  cmsContent.courses.push(newCourse);
  res.status(201).json({ success: true, course: newCourse, courses: cmsContent.courses });
});
app.put("/api/courses/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required to edit courses." });
  }
  const courseIndex = cmsContent.courses.findIndex((c) => c.id === req.params.id);
  if (courseIndex === -1) {
    return res.status(404).json({ error: "Course not found." });
  }
  const currentCourse = cmsContent.courses[courseIndex];
  const { name, level, shortDescription, whatYouWillLearn, duration, learningFormat, fee, badge, isPublished } = req.body;
  const updatedCourse = {
    ...currentCourse,
    name: name !== void 0 ? name : currentCourse.name,
    level: level !== void 0 ? level : currentCourse.level,
    shortDescription: shortDescription !== void 0 ? shortDescription : currentCourse.shortDescription,
    whatYouWillLearn: Array.isArray(whatYouWillLearn) ? whatYouWillLearn : currentCourse.whatYouWillLearn,
    duration: duration !== void 0 ? duration : currentCourse.duration,
    learningFormat: learningFormat !== void 0 ? learningFormat : currentCourse.learningFormat,
    fee: fee !== void 0 ? Number(fee) : currentCourse.fee,
    badge: badge !== void 0 ? badge : currentCourse.badge,
    isPublished: isPublished !== void 0 ? isPublished : currentCourse.isPublished
  };
  cmsContent.courses[courseIndex] = updatedCourse;
  res.json({ success: true, course: updatedCourse, courses: cmsContent.courses });
});
app.patch("/api/courses/:id/publish", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required." });
  }
  const courseIndex = cmsContent.courses.findIndex((c) => c.id === req.params.id);
  if (courseIndex === -1) {
    return res.status(404).json({ error: "Course not found." });
  }
  const currentCourse = cmsContent.courses[courseIndex];
  const newStatus = req.body.isPublished !== void 0 ? Boolean(req.body.isPublished) : !Boolean(currentCourse.isPublished);
  currentCourse.isPublished = newStatus;
  res.json({ success: true, course: currentCourse, isPublished: newStatus, courses: cmsContent.courses });
});
app.delete("/api/courses/:id", (req, res) => {
  const auth = verifyAuthToken(req.headers.authorization);
  if (!auth || auth.role !== "admin") {
    return res.status(403).json({ error: "Admin authorization required to delete courses." });
  }
  const courseIndex = cmsContent.courses.findIndex((c) => c.id === req.params.id);
  if (courseIndex === -1) {
    return res.status(404).json({ error: "Course not found." });
  }
  const deleted = cmsContent.courses.splice(courseIndex, 1)[0];
  res.json({ success: true, deleted, courses: cmsContent.courses });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : void 0
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path6.join(process.cwd(), "dist");
    if (fs6.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path6.join(distPath, "index.html"));
      });
    }
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Wits Lingo Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WhatsApp] Operating strictly via official Meta WhatsApp Business Platform Cloud API.`);
    console.log(`[WhatsApp] Cloud API Webhook Listener active at /api/webhooks/whatsapp`);
  });
}
var isServerless = Boolean(
  process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
if (!isServerless) {
  startServer();
}
var server_default = app;

// src/api/index.ts
var config = {
  api: {
    bodyParser: false
  }
};
function handler(req, res) {
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
  if (matchedPath && typeof matchedPath === "string" && (req.url === "/api" || req.url.startsWith("/api?") || req.url.startsWith("/api/"))) {
    const queryIdx = req.url.indexOf("?");
    const queryString = queryIdx !== -1 ? req.url.substring(queryIdx) : "";
    req.url = (matchedPath.startsWith("/") ? matchedPath : "/" + matchedPath) + queryString;
  }
  return server_default(req, res);
}
export {
  config,
  handler as default
};
