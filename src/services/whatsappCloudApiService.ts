import crypto from 'crypto';

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  status: 'accepted' | 'sent' | 'failed';
  error?: string;
  errorCode?: number;
  httpStatus?: number;
  isTransient?: boolean;
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

export class WhatsAppCloudApiService {
  private static instance: WhatsAppCloudApiService;

  private constructor() {}

  public static getInstance(): WhatsAppCloudApiService {
    if (!WhatsAppCloudApiService.instance) {
      WhatsAppCloudApiService.instance = new WhatsAppCloudApiService();
    }
    return WhatsAppCloudApiService.instance;
  }

  // Configuration getters (reading dynamically so env changes don't require process restart)
  public get phoneNumberId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  }

  public get businessAccountId(): string {
    return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '';
  }

  public get accessToken(): string {
    return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  }

  public get graphApiVersion(): string {
    return process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v21.0';
  }

  public get verifyToken(): string {
    return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || 
           process.env.WHATSAPP_VERIFY_TOKEN?.trim() || 
           'witslingo_meta_verify_token_2026';
  }

  public get appSecret(): string {
    return process.env.WHATSAPP_APP_SECRET?.trim() || '';
  }

  public get confirmationTemplateName(): string {
    return process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME?.trim() || 'wits_lingo_enrollment_confirmation';
  }

  public get templateLanguage(): string {
    return process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';
  }

  public get supportPhone(): string {
    return process.env.WHATSAPP_SUPPORT_PHONE?.trim() || '918791287575';
  }

  /**
   * Diagnostic summary of Meta Cloud API configuration
   */
  public getDiagnostics() {
    return {
      provider: 'cloud_api',
      configured: Boolean(this.phoneNumberId && this.accessToken),
      hasPhoneNumberId: Boolean(this.phoneNumberId),
      hasAccessToken: Boolean(this.accessToken),
      hasAppSecret: Boolean(this.appSecret),
      hasBusinessAccountId: Boolean(this.businessAccountId),
      graphApiVersion: this.graphApiVersion,
      confirmationTemplateName: this.confirmationTemplateName,
      templateLanguage: this.templateLanguage,
      supportPhone: this.supportPhone,
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
   * Verify Webhook challenge from Meta Developers Console (GET /api/webhooks/whatsapp)
   */
  public verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Validate Meta webhook HMAC SHA-256 signature using WHATSAPP_APP_SECRET
   */
  public validateWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      // If app secret is not configured, signature check cannot be enforced
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
   * Low-level HTTP POST to Meta Graph API with retry for transient errors
   */
  private async postToGraphApi(payload: any, maxRetries: number = 2): Promise<MetaSendResult> {
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        success: false,
        status: 'failed',
        error: 'WhatsApp Cloud API is not configured: Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in server environment.',
        isTransient: false
      };
    }

    const url = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`;

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = (await res.json()) as any;

        if (res.ok && data?.messages?.[0]?.id) {
          return {
            success: true,
            status: 'accepted', // Accepted by Meta Graph API; delivery confirmed asynchronously via Webhook
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
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`[WhatsApp Cloud API] Transient error (Code: ${errorCode}, Status: ${res.status}). Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        return {
          success: false,
          status: 'failed',
          error: errorMessage,
          errorCode,
          httpStatus: res.status,
          isTransient
        };
      } catch (networkErr: any) {
        const isAbort = networkErr?.name === 'AbortError';
        const isTransient = true;

        if (attempt <= maxRetries) {
          const delayMs = 1500 * attempt;
          console.warn(`[WhatsApp Cloud API] Network ${isAbort ? 'timeout' : 'failure'}. Retrying attempt ${attempt}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        return {
          success: false,
          status: 'failed',
          error: isAbort ? 'Meta Graph API request timed out (12s)' : (networkErr?.message || 'Network exception'),
          isTransient: true
        };
      }
    }

    return {
      success: false,
      status: 'failed',
      error: 'Max retries exhausted for Meta Graph API call',
      isTransient: false
    };
  }

  /**
   * Send a standard free-form text message via Meta Cloud API.
   * Note: Works within the 24-hour customer service window after a student messages the business.
   */
  public async sendTextMessage(
    recipientPhone: string,
    messageText: string,
    previewUrl: boolean = true
  ): Promise<MetaSendResult> {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return { success: false, status: 'failed', error: 'Invalid recipient phone number', isTransient: false };
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

    return this.postToGraphApi(payload);
  }

  /**
   * Send an approved Meta WhatsApp Template message.
   * Required for starting conversations or sending transactional receipts outside the 24h window.
   */
  public async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponent[] = []
  ): Promise<MetaSendResult> {
    const cleanTo = this.normalizePhone(recipientPhone);
    if (!cleanTo || cleanTo.length < 10) {
      return { success: false, status: 'failed', error: 'Invalid recipient phone number', isTransient: false };
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
      return { success: false, status: 'failed', error: 'Invalid recipient phone number', isTransient: false };
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
