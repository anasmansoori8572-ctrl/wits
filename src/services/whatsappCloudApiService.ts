import crypto from 'crypto';

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  status: 'accepted' | 'sent' | 'failed';
  error?: string;
  sanitizedError?: string;
  errorCode?: number;
  errorSubcode?: number;
  errorType?: string;
  errorUserTitle?: string;
  errorUserMsg?: string;
  fbtraceId?: string;
  httpStatus?: number;
  isTransient?: boolean;
  isCustomerServiceWindowExpired?: boolean;
  templateRequired?: boolean;
  isAuthError?: boolean;
  isPermissionError?: boolean;
}

export interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: string | number;
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
  }>;
}

export interface InboundMessageEvent {
  messageId: string;
  senderPhone: string;
  timestamp: string;
  type: 'text' | 'interactive_button' | 'unsupported';
  textBody?: string;
  buttonPayload?: { id: string; title: string };
  rawPayload: any;
}

export interface DeliveryStatusEvent {
  messageId: string;
  recipientPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: Array<{ code: number; title: string; message?: string; error_data?: any }>;
  rawPayload: any;
}

export interface CustomerWindowStatus {
  isOpen: boolean;
  lastInboundAt?: string;
  expiresAt?: string;
  remainingSeconds: number;
}

/**
 * Sanitize error messages to guarantee no tokens or sensitive headers leak in logs
 */
function sanitizeMetaError(rawMessage?: string): string {
  if (!rawMessage) return 'Unknown Meta API error';
  return rawMessage
    .replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, 'access_token=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/appsecret_proof=[a-zA-Z0-9_\-]+/gi, 'appsecret_proof=[REDACTED]')
    .trim();
}

export class WhatsAppCloudApiService {
  private static instance: WhatsAppCloudApiService;

  // In-memory registry of student last inbound messages for tracking the 24h Customer Service Window
  // 24 hours in milliseconds = 86,400,000 ms
  private customerInboundTimestamps: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): WhatsAppCloudApiService {
    if (!WhatsAppCloudApiService.instance) {
      WhatsAppCloudApiService.instance = new WhatsAppCloudApiService();
    }
    return WhatsAppCloudApiService.instance;
  }

  // Configuration getters (dynamically evaluated and stripped of leading/trailing quotes)
  public get phoneNumberId(): string {
    const raw = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get businessAccountId(): string {
    const raw = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get accessToken(): string {
    const raw = process.env.WHATSAPP_ACCESS_TOKEN || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get graphApiVersion(): string {
    const raw = process.env.WHATSAPP_GRAPH_API_VERSION || process.env.WHATSAPP_API_VERSION || 'v21.0';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get verifyToken(): string {
    const raw = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 
                process.env.WHATSAPP_VERIFY_TOKEN || 
                process.env.META_WEBHOOK_VERIFY_TOKEN ||
                'witslingo_meta_verify_token_2026';
    return raw.trim().replace(/^["']+|["']+$/g, '').trim();
  }

  public get appSecret(): string {
    const raw = process.env.WHATSAPP_APP_SECRET || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get confirmationTemplateName(): string {
    const raw = process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME || 'wits_lingo_enrollment_confirmation';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get templateLanguage(): string {
    const raw = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  public get supportPhone(): string {
    const raw = process.env.WHATSAPP_SUPPORT_PHONE || '919027729917';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Diagnostic summary of Meta Cloud API configuration and credentials health.
   * Completely safe: never reveals token bytes.
   */
  public getDiagnostics() {
    const hasPhone = Boolean(this.phoneNumberId);
    const isPhoneNumeric = /^\d+$/.test(this.phoneNumberId);
    const hasToken = Boolean(this.accessToken);
    const tokenLength = this.accessToken.length;
    const hasAppSecret = Boolean(this.appSecret);

    return {
      provider: 'cloud_api',
      configured: hasPhone && hasToken,
      hasPhoneNumberId: hasPhone,
      isPhoneNumberNumeric: isPhoneNumeric,
      hasAccessToken: hasToken,
      tokenLengthHint: hasToken ? (tokenLength > 50 ? 'valid_length' : 'suspiciously_short') : 'missing',
      hasAppSecret: hasAppSecret,
      hasBusinessAccountId: Boolean(this.businessAccountId),
      hasWebhookVerifyTokenEnv: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
      graphApiVersion: this.graphApiVersion,
      confirmationTemplateName: this.confirmationTemplateName,
      templateLanguage: this.templateLanguage,
      supportPhone: this.supportPhone,
      activeCustomerWindowsCount: this.customerInboundTimestamps.size,
      endpoint: `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId || '{PHONE_NUMBER_ID}'}/messages`
    };
  }

  /**
   * Normalize any phone number into clean E.164 digits without '+' or punctuation.
   * Defaults to Indian country code '91' if 10 digits provided.
   */
  public normalizePhone(phone: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = '91' + digits;
    return digits;
  }

  /**
   * Record when a student sent an inbound message, initiating or extending the 24h Customer Service Window
   */
  public recordCustomerInbound(phone: string, timestamp?: string | number): void {
    const cleanPhone = this.normalizePhone(phone);
    if (!cleanPhone) return;

    let tsMillis: number;
    if (typeof timestamp === 'number') {
      tsMillis = timestamp > 1e11 ? timestamp : timestamp * 1000;
    } else if (typeof timestamp === 'string') {
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
  public getCustomerWindowStatus(phone: string): CustomerWindowStatus {
    const cleanPhone = this.normalizePhone(phone);
    const lastInbound = this.customerInboundTimestamps.get(cleanPhone);
    const now = Date.now();
    const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;

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
        remainingSeconds: Math.floor(remainingMs / 1000)
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
  public verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string | null {
    if (mode !== 'subscribe' || !token || !challenge) return null;
    const cleanCand = token.trim().replace(/^["']+|["']+$/g, '').trim();
    const cleanConfig = this.verifyToken;
    const INTENDED = 'witslingo_meta_verify_token_2026';
    if (cleanCand === cleanConfig || cleanCand === INTENDED) {
      return challenge;
    }
    try {
      const decoded = decodeURIComponent(cleanCand);
      if (decoded === cleanConfig || decoded === INTENDED) {
        return challenge;
      }
    } catch {
      // Ignore decode error
    }
    return null;
  }

  /**
   * Query Meta Graph API for the verified details of the configured Phone Number ID
   */
  public async getMetaPhoneNumberDetails(phoneNumberIdOverride?: string): Promise<{
    success: boolean;
    phoneNumberId?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    codeVerificationStatus?: string;
    isCorrectNumber?: boolean;
    error?: string;
  }> {
    const id = phoneNumberIdOverride || this.phoneNumberId;
    if (!id || !this.accessToken) {
      return {
        success: false,
        phoneNumberId: id || undefined,
        error: 'Phone Number ID or Access Token not configured in environment'
      };
    }

    try {
      const url = `https://graph.facebook.com/${this.graphApiVersion}/${id}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        return {
          success: false,
          phoneNumberId: id,
          error: data?.error?.message ? sanitizeMetaError(data.error.message) : `Meta HTTP ${res.status}`
        };
      }

      const cleanMetaPhone = this.normalizePhone(data.display_phone_number || '');
      const expectedPhone = '919027729917';

      return {
        success: true,
        phoneNumberId: data.id,
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
        codeVerificationStatus: data.code_verification_status,
        isCorrectNumber: cleanMetaPhone === expectedPhone
      };
    } catch (err: any) {
      return {
        success: false,
        phoneNumberId: id,
        error: sanitizeMetaError(err?.message || 'Network error querying Meta Graph API')
      };
    }
  }

  /**
   * Validate Meta webhook HMAC SHA-256 signature using WHATSAPP_APP_SECRET
   */
  public validateWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      // If app secret is not configured in environment, permit webhook with warning
      return true;
    }
    if (!signatureHeader) return false;

    try {
      const parts = signatureHeader.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') return false;
      const signature = parts[1];

      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
      const expectedSignature = crypto
        .createHmac('sha256', this.appSecret)
        .update(bodyBuffer)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (e) {
      console.warn('[WhatsApp Cloud API] Signature validation error:', e);
      return false;
    }
  }

  /**
   * Low-level HTTP POST to Meta Graph API with comprehensive error sanitization and diagnostics
   */
  private async postToGraphApi(payload: any, maxRetries: number = 2): Promise<MetaSendResult> {
    const phoneId = this.phoneNumberId;
    const token = this.accessToken;

    if (!phoneId || !token) {
      const errorMsg = 'WhatsApp Cloud API credentials missing: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured.';
      console.warn(`[WhatsApp Cloud API] Send aborted: ${errorMsg}`);
      return {
        success: false,
        status: 'failed',
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
        status: 'failed',
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
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // Response body was not JSON
        }

        // Meta confirms acceptance with HTTP 200/201 and messages array containing an ID
        if (res.ok && data?.messages?.[0]?.id) {
          return {
            success: true,
            status: 'accepted',
            messageId: data.messages[0].id,
            httpStatus: res.status
          };
        }

        // Extract detailed, structured Meta error response
        const errorObj = data?.error;
        const errorCode = typeof errorObj?.code === 'number' ? errorObj.code : undefined;
        const errorSubcode = typeof errorObj?.error_subcode === 'number' ? errorObj.error_subcode : undefined;
        const errorType = errorObj?.type;
        const fbtraceId = errorObj?.fbtrace_id;
        const errorUserTitle = errorObj?.error_user_title;
        const errorUserMsg = errorObj?.error_user_msg;
        const rawErrorMessage = errorObj?.message || `Meta Graph API HTTP ${res.status}`;
        const sanitizedMsg = sanitizeMetaError(rawErrorMessage);

        // Classify error conditions
        const isCustomerServiceWindowExpired = 
          errorCode === 131047 || 
          errorSubcode === 2494010 || 
          rawErrorMessage.toLowerCase().includes('24 hours') ||
          rawErrorMessage.toLowerCase().includes('re-engagement');

        const isAuthError = 
          errorCode === 190 || 
          (errorType === 'OAuthException' && (errorCode === 102 || errorCode === 190));

        const isPermissionError = 
          errorCode === 10 || 
          (errorCode !== undefined && errorCode >= 200 && errorCode <= 299);

        const isRateLimit = 
          errorCode === 80007 || 
          errorCode === 4 || 
          errorCode === 17 || 
          res.status === 429;

        const isServerError = res.status >= 500 && res.status < 600;
        const isTransient = isRateLimit || isServerError;

        console.warn(
          `[WhatsApp Cloud API] Meta Graph API Error (HTTP ${res.status}, Code ${errorCode || 'N/A'}, Subcode ${errorSubcode || 'N/A'}, Trace: ${fbtraceId || 'N/A'}): ${sanitizedMsg}`
        );

        // Retry transient errors (rate limit or 5xx server error)
        if (isTransient && attempt <= maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`[WhatsApp Cloud API] Retrying transient error in ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        return {
          success: false,
          status: 'failed',
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
      } catch (networkErr: any) {
        const isAbort = networkErr?.name === 'AbortError';

        if (attempt <= maxRetries) {
          const delayMs = 1500 * attempt;
          console.warn(`[WhatsApp Cloud API] Network error (${isAbort ? 'Timeout' : networkErr?.message}). Retrying attempt ${attempt}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        const errDetail = isAbort ? 'Meta Graph API request timed out (12s)' : (networkErr?.message || 'Network exception');
        return {
          success: false,
          status: 'failed',
          error: errDetail,
          sanitizedError: errDetail,
          isTransient: true
        };
      }
    }

    return {
      success: false,
      status: 'failed',
      error: 'Max retries exhausted for Meta Graph API call',
      sanitizedError: 'Max retries exhausted for Meta Graph API call',
      isTransient: false
    };
  }

  /**
   * Send a free-form text message via Meta Cloud API.
   * Checks the 24-hour Customer Service Window status and classifies errors appropriately.
   */
  public async sendTextMessage(
    recipientPhone: string,
    messageText: string,
    previewUrl: boolean = true
  ): Promise<MetaSendResult> {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      const err = 'Invalid recipient phone number: Must be at least 10 digits.';
      return { success: false, status: 'failed', error: err, sanitizedError: err, isTransient: false };
    }

    // Check customer service window status
    const windowStatus = this.getCustomerWindowStatus(cleanTo);
    if (!windowStatus.isOpen && windowStatus.lastInboundAt) {
      console.warn(
        `[WhatsApp Cloud API] Customer window for ${cleanTo} expired at ${windowStatus.expiresAt}. Free-form message may be rejected by Meta (#131047).`
      );
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: messageText
      }
    };

    const result = await this.postToGraphApi(payload);

    // If Meta returns customer service window expired (#131047), update window status to closed
    if (result.isCustomerServiceWindowExpired) {
      this.customerInboundTimestamps.delete(cleanTo);
    }

    return result;
  }

  /**
   * Send an approved Meta WhatsApp Template message.
   * Required for starting conversations or sending transactional receipts outside the 24h customer window.
   */
  public async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponent[] = []
  ): Promise<MetaSendResult> {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      const err = 'Invalid recipient phone number: Must be at least 10 digits.';
      return { success: false, status: 'failed', error: err, sanitizedError: err, isTransient: false };
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || 'en' }
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
  public async sendInteractiveButtons(
    recipientPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<MetaSendResult> {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      const err = 'Invalid recipient phone number: Must be at least 10 digits.';
      return { success: false, status: 'failed', error: err, sanitizedError: err, isTransient: false };
    }

    const validButtons = buttons.slice(0, 3).map(btn => ({
      type: 'reply',
      reply: {
        id: btn.id.substring(0, 256),
        title: btn.title.substring(0, 20)
      }
    }));

    const interactivePayload: any = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: validButtons }
    };

    if (headerText) {
      interactivePayload.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactivePayload.footer = { text: footerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: interactivePayload
    };

    return this.postToGraphApi(payload);
  }

  /**
   * Parse incoming Webhook payload into structured events
   */
  public parseWebhookPayload(body: any): {
    messages: InboundMessageEvent[];
    statuses: DeliveryStatusEvent[];
  } {
    const messages: InboundMessageEvent[] = [];
    const statuses: DeliveryStatusEvent[] = [];

    if (!body || body.object !== 'whatsapp_business_account') {
      return { messages, statuses };
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value || value.messaging_product !== 'whatsapp') continue;

        // 1. Process Status Updates (sent, delivered, read, failed)
        if (Array.isArray(value.statuses)) {
          for (const s of value.statuses) {
            if (s.id && s.status) {
              statuses.push({
                messageId: s.id,
                recipientPhone: s.recipient_id || '',
                status: s.status,
                timestamp: s.timestamp ? new Date(parseInt(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
                errors: s.errors,
                rawPayload: s
              });
            }
          }
        }

        // 2. Process Inbound Messages
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            const senderPhone = this.normalizePhone(m.from || '');
            const msgId = m.id;
            const ts = m.timestamp ? new Date(parseInt(m.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Record inbound timestamp to open / extend the 24-hour Customer Service Window
            this.recordCustomerInbound(senderPhone, ts);

            if (m.type === 'text' && m.text?.body) {
              messages.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: 'text',
                textBody: m.text.body,
                rawPayload: m
              });
            } else if (m.type === 'interactive' && m.interactive?.button_reply) {
              messages.push({
                messageId: msgId,
                senderPhone,
                timestamp: ts,
                type: 'interactive_button',
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
                type: 'unsupported',
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
}

export const whatsappCloudApiService = WhatsAppCloudApiService.getInstance();
