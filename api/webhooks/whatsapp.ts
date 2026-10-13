import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { whatsappCloudApiService } from '../../src/services/whatsappCloudApiService';
import { whatsappNotificationService } from '../../src/services/whatsappNotificationService';
import { studentSupportService } from '../../src/services/studentSupportService';

// Disable Vercel's default body parser so we can capture the exact raw byte buffer for HMAC signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Collect raw byte buffer from incoming request stream
 */
function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

/**
 * Vercel Serverless Function Handler for Official Meta WhatsApp Webhook:
 * Supports:
 * - GET: Webhook verification challenge handshake (hub.mode, hub.verify_token, hub.challenge)
 * - POST: Incoming message processing & delivery status callbacks with X-Hub-Signature-256 verification
 */
export default async function handler(req: any, res: any) {
  const method = req.method?.toUpperCase();

  // --------------------------------------------------------------------------
  // 1. GET: Meta Webhook Verification Handshake
  // --------------------------------------------------------------------------
  if (method === 'GET') {
    try {
      const mode = (req.query?.['hub.mode'] || req.query?.mode || '') as string;
      const token = (req.query?.['hub.verify_token'] || req.query?.verify_token || '') as string;
      const challenge = (req.query?.['hub.challenge'] || req.query?.challenge || '') as string;

      const configuredToken = 
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || 
        process.env.WHATSAPP_VERIFY_TOKEN?.trim() || 
        'witslingo_meta_verify_token_2026';

      console.log(`[Meta Webhook GET] mode=${mode}, tokenProvided=${Boolean(token)}, challengeProvided=${Boolean(challenge)}`);

      if (mode === 'subscribe' && token === configuredToken && challenge) {
        console.log('[Meta Webhook GET] Verification challenge accepted. Responding HTTP 200 with challenge.');
        if (typeof res.setHeader === 'function') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }
        if (typeof res.status === 'function') {
          return res.status(200).send(challenge);
        }
        res.statusCode = 200;
        return res.end(challenge);
      }

      console.warn('[Meta Webhook GET] Verification failed. Token mismatch or missing mode/challenge.');
      if (typeof res.status === 'function') {
        return res.status(403).send('Forbidden: Verification token mismatch');
      }
      res.statusCode = 403;
      return res.end('Forbidden: Verification token mismatch');
    } catch (err: any) {
      console.error('[Meta Webhook GET] Error during handshake:', err);
      if (typeof res.status === 'function') {
        return res.status(500).send('Internal Server Error');
      }
      res.statusCode = 500;
      return res.end('Internal Server Error');
    }
  }

  // --------------------------------------------------------------------------
  // 2. POST: Meta Webhook Events (Messages & Delivery Statuses)
  // --------------------------------------------------------------------------
  if (method === 'POST') {
    try {
      // 1. Collect exact raw request body buffer
      const rawBodyBuffer = await getRawBody(req);
      const signature = (req.headers?.['x-hub-signature-256'] || req.headers?.['X-Hub-Signature-256']) as string | undefined;

      // 2. Validate HMAC SHA-256 signature using WHATSAPP_APP_SECRET (if configured)
      const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
      if (appSecret) {
        if (!signature || !signature.startsWith('sha256=')) {
          console.warn('[Meta Webhook POST] Missing or malformed X-Hub-Signature-256 header.');
          return res.status(401).json({ error: 'Missing or invalid signature header' });
        }

        const expectedSig = crypto
          .createHmac('sha256', appSecret)
          .update(rawBodyBuffer)
          .digest('hex');

        const providedSig = signature.substring(7);
        const sigMatches = 
          expectedSig.length === providedSig.length &&
          crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(providedSig, 'hex'));

        if (!sigMatches) {
          console.warn('[Meta Webhook POST] Invalid X-Hub-Signature-256 HMAC signature.');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      // 3. Immediately return HTTP 200 OK to Meta to prevent delivery retries/timeouts
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/json');
      }
      if (typeof res.status === 'function') {
        res.status(200).json({ status: 'ok' });
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'ok' }));
      }

      // 4. Parse payload and process asynchronously in background
      let payload: any;
      try {
        payload = JSON.parse(rawBodyBuffer.toString('utf-8'));
      } catch (parseErr) {
        console.warn('[Meta Webhook POST] Failed to parse JSON body:', parseErr);
        return;
      }

      const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(payload);

      // Handle delivery status updates (sent -> delivered -> read -> failed)
      for (const st of statuses) {
        const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : undefined;
        whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
      }

      // Handle student incoming messages via AI Support Service
      for (const msg of inboundMessages) {
        console.log(`[Meta Webhook Inbound] Received message from ${msg.senderPhone} (type: ${msg.type})`);
        studentSupportService.handleInboundMessage(msg).catch(err => {
          console.error('[Meta Webhook Inbound] Exception processing message:', err);
        });
      }

      return;
    } catch (err: any) {
      console.error('[Meta Webhook POST] Fatal handler error:', err);
      if (!res.headersSent) {
        if (typeof res.status === 'function') {
          return res.status(500).json({ error: 'Internal server error processing webhook' });
        }
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'Internal server error processing webhook' }));
      }
    }
  }

  // Method not allowed
  if (typeof res.setHeader === 'function') {
    res.setHeader('Allow', 'GET, POST');
  }
  if (typeof res.status === 'function') {
    return res.status(405).send(`Method ${method} Not Allowed`);
  }
  res.statusCode = 405;
  return res.end(`Method ${method} Not Allowed`);
}
