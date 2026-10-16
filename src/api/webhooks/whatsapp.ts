import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { whatsappCloudApiService } from '../../services/whatsappCloudApiService';
import { whatsappNotificationService } from '../../services/whatsappNotificationService';
import { studentSupportService } from '../../services/studentSupportService';
import { durableStorageService } from '../../services/durableStorageService';

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
  // 1. GET: Meta Webhook Verification Handshake & Diagnostic Health Check
  // --------------------------------------------------------------------------
  if (method === 'GET') {
    try {
      // 1. Extract query parameters safely from req.query and req.url
      const queryParams: Record<string, string> = {};
      if (req.query && typeof req.query === 'object') {
        for (const [k, v] of Object.entries(req.query)) {
          if (typeof v === 'string') queryParams[k] = v;
          else if (Array.isArray(v) && typeof v[0] === 'string') queryParams[k] = v[0];
        }
      }
      if (req.url && req.url.includes('?')) {
        try {
          const parsedUrl = new URL(req.url, 'https://www.witslingo.com');
          for (const [k, v] of parsedUrl.searchParams.entries()) {
            if (!queryParams[k]) queryParams[k] = v;
          }
        } catch {
          // Ignore URL parsing errors
        }
      }

      const mode = (queryParams['hub.mode'] || queryParams['mode'] || '').trim();
      const token = (queryParams['hub.verify_token'] || queryParams['verify_token'] || '').trim();
      const challenge = (queryParams['hub.challenge'] || queryParams['challenge'] || '').trim();

      // Read configured token securely from environment or official fallback
      const configuredToken = whatsappCloudApiService.verifyToken;

      // Browser visit / Direct health check without Meta handshake parameters
      if (!mode && !token && !challenge) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        const healthPayload = {
          status: 'ready',
          endpoint: 'Official Meta WhatsApp Cloud API Webhook',
          message: 'Webhook endpoint is active and awaiting Meta Cloud API verification challenge or events.',
          verificationProtocol: {
            method: 'GET',
            requiredParams: [
              'hub.mode=subscribe',
              'hub.verify_token=<your_configured_verify_token>',
              'hub.challenge=<random_challenge_string>'
            ],
            response: 'HTTP 200 with hub.challenge as plain text upon token match'
          },
          tokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
          whatsAppApi: whatsappCloudApiService.getDiagnostics(),
          persistence: durableStorageService.getDiagnostics()
        };
        if (typeof res.status === 'function') {
          return res.status(200).json(healthPayload);
        }
        res.statusCode = 200;
        return res.end(JSON.stringify(healthPayload));
      }

      // Authorized B2 Persistence Test & Verification Probe
      const action = (queryParams['action'] || '').trim();
      if (action === 'test_b2' && token === configuredToken) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        const collectionsToTest = [
          'materials',
          'conversations',
          'messages',
          'support-tickets',
          'notifications',
          'webhook-dedup'
        ];
        const results: Record<string, any> = {};
        let allPassed = true;

        for (const coll of collectionsToTest) {
          const roundtrip = await durableStorageService.testCollectionRoundtrip(coll);
          results[coll] = roundtrip;
          if (!roundtrip.success) allPassed = false;
        }

        const report = {
          success: allPassed,
          testTimestamp: new Date().toISOString(),
          b2Diagnostics: durableStorageService.getDiagnostics(),
          collectionResults: results
        };

        if (typeof res.status === 'function') {
          return res.status(allPassed ? 200 : 500).json(report);
        }
        res.statusCode = allPassed ? 200 : 500;
        return res.end(JSON.stringify(report));
      }

      // Authorized Phone Verification Probe
      if (action === 'verify_phone') {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        const phoneOverride = queryParams['phone_number_id'] || undefined;
        const phoneDetails = await whatsappCloudApiService.getMetaPhoneNumberDetails(phoneOverride);
        const report = {
          success: phoneDetails.success,
          timestamp: new Date().toISOString(),
          configuredPhoneNumberId: whatsappCloudApiService.phoneNumberId,
          metaDetails: phoneDetails,
          expectedNumber: '+91 9027729917',
          matchesTargetNumber: phoneDetails.isCorrectNumber || false
        };

        if (typeof res.status === 'function') {
          return res.status(phoneDetails.success ? 200 : 500).json(report);
        }
        res.statusCode = phoneDetails.success ? 200 : 500;
        return res.end(JSON.stringify(report));
      }

      // Meta Handshake: Validate mode === 'subscribe'
      if (mode !== 'subscribe') {
        console.warn(`[Meta Webhook GET] Handshake rejected: invalid hub.mode "${mode}". Expected "subscribe".`);
        if (typeof res.status === 'function') {
          return res.status(400).send('Bad Request: hub.mode must be "subscribe"');
        }
        res.statusCode = 400;
        return res.end('Bad Request: hub.mode must be "subscribe"');
      }

      // Meta Handshake: Validate verify_token matches
      if (token !== configuredToken) {
        console.warn('[Meta Webhook GET] Handshake rejected: verification token mismatch.');
        if (typeof res.status === 'function') {
          return res.status(403).send('Forbidden: Verification token mismatch');
        }
        res.statusCode = 403;
        return res.end('Forbidden: Verification token mismatch');
      }

      // Meta Handshake: Validate challenge parameter present
      if (!challenge) {
        console.warn('[Meta Webhook GET] Handshake rejected: missing hub.challenge.');
        if (typeof res.status === 'function') {
          return res.status(400).send('Bad Request: Missing hub.challenge');
        }
        res.statusCode = 400;
        return res.end('Bad Request: Missing hub.challenge');
      }

      // Meta Handshake Accepted: Return HTTP 200 plain text challenge
      console.log('[Meta Webhook GET] Handshake accepted. Responding HTTP 200 with challenge.');
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      if (typeof res.status === 'function') {
        return res.status(200).send(challenge);
      }
      res.statusCode = 200;
      return res.end(challenge);
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

      // 2. Validate HMAC SHA-256 signature using WHATSAPP_APP_SECRET
      const appSecret = whatsappCloudApiService.appSecret;
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

      // 3. Parse JSON payload
      let payload: any;
      try {
        payload = JSON.parse(rawBodyBuffer.toString('utf-8'));
      } catch (parseErr) {
        console.warn('[Meta Webhook POST] Failed to parse JSON body:', parseErr);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const { messages: inboundMessages, statuses } = whatsappCloudApiService.parseWebhookPayload(payload);

      // 4. Process events within a safe execution deadline before responding to prevent serverless freeze
      const processEventsPromise = async () => {
        // Handle delivery status updates (sent -> delivered -> read -> failed)
        for (const st of statuses) {
          const isDup = await durableStorageService.isDeduplicated('delivery_status', `${st.messageId}_${st.status}`);
          if (isDup) continue;

          durableStorageService.recordDedupBackground('delivery_status', `${st.messageId}_${st.status}`);
          const errorText = st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title}` : undefined;
          whatsappNotificationService.updateDeliveryStatus(st.messageId, st.status, st.timestamp, errorText);
        }

        // Handle student incoming messages via AI Support Service
        for (const msg of inboundMessages) {
          console.log(`[Meta Webhook Inbound] Received message from ${msg.senderPhone} (type: ${msg.type})`);
          try {
            await studentSupportService.handleInboundMessage(msg);
          } catch (msgErr) {
            console.error('[Meta Webhook Inbound] Exception processing message:', msgErr);
          }
        }
      };

      // Ensure execution completes or safely times out before Vercel container closes
      // 7.5s deadline leaves safe margin for 10s serverless timeout
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 7500));
      await Promise.race([processEventsPromise(), timeoutPromise]);

      // Respond HTTP 200 OK to Meta confirming event ingestion
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/json');
      }
      if (typeof res.status === 'function') {
        return res.status(200).json({ status: 'ok', received: true });
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: 'ok', received: true }));
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
