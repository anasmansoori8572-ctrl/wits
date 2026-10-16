import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export interface StoragePersistenceResult {
  success: boolean;
  backend: 'b2_s3' | 'b2_native' | 'firestore' | 'local_fs' | 'in_memory_only';
  error?: string;
  bytesWritten?: number;
  timestamp: string;
}

export interface DedupRecord {
  key: string;
  scope: string;
  recordedAt: string;
  expiresAt: number;
}

export interface StorageDiagnostics {
  isVercel: boolean;
  isFileSystemReadOnly: boolean;
  primaryBackend: 'b2_s3' | 'b2_native' | 'firestore' | 'local_fs' | 'in_memory_fallback';
  b2Configured: boolean;
  b2Bucket?: string;
  b2BucketId?: string;
  b2Endpoint?: string;
  b2NativeConfigured: boolean;
  firestoreConfigured: boolean;
  firestoreProjectId?: string;
  cachedCollections: string[];
  dedupCount: number;
}

interface B2NativeAuth {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  accountId: string;
  bucketId?: string;
  bucketName: string;
  expiresAt: number;
}

/**
 * DurableStorageService provides unified, cloud-resilient persistence across:
 * 1. Backblaze B2 via AWS S3-compatible API (optimized for zero checksum trailer errors & explicit ContentLength)
 * 2. Backblaze B2 Native REST API (guaranteed resilient fallback)
 * 3. Firebase Firestore (REST API if FIREBASE_PROJECT_ID configured)
 * 4. Local filesystem JSON files (ONLY when writable in local development)
 * 5. In-memory cache with explicit observable diagnostics (NEVER writes to read-only disk on Vercel)
 */
export class DurableStorageService {
  private static instance: DurableStorageService;

  private memoryCache: Map<string, any> = new Map();
  private s3Client: S3Client | null = null;
  private s3Configured: boolean = false;
  private s3Bucket: string = 'wits-lingo-materials';
  private bucketId: string = 'c38efea7e836c672a50b0c10';
  private s3Endpoint: string = 's3.us-east-005.backblazeb2.com';
  private keyId: string = '0053ee786625bc00000000004';
  private appKey: string = 'K005Vi6dUBAOsB5H7DyWjWYZA72D/0s';
  private b2AuthCache: B2NativeAuth | null = null;

  private firestoreConfigured: boolean = false;
  private firestoreProjectId: string = '';
  private isReadOnlyFs: boolean = false;
  private dedupCache: Map<string, DedupRecord> = new Map();

  // In-process serialization mutex per collection to prevent race conditions during concurrent serverless writes
  private collectionLocks: Map<string, Promise<any>> = new Map();

  private constructor() {
    this.detectEnvironment();
    this.initCredentials();
    this.initS3Client();
    this.initFirestore();
    this.loadInitialData();
  }

  public static getInstance(): DurableStorageService {
    if (!DurableStorageService.instance) {
      DurableStorageService.instance = new DurableStorageService();
    }
    return DurableStorageService.instance;
  }

  /**
   * Detect whether running in a read-only environment like Vercel Lambda
   */
  private detectEnvironment(): void {
    if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      this.isReadOnlyFs = true;
      return;
    }

    try {
      const testDir = path.join(process.cwd(), 'uploads', 'data');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const testFile = path.join(testDir, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      this.isReadOnlyFs = false;
    } catch {
      this.isReadOnlyFs = true;
    }
  }

  /**
   * Read and sanitize credentials from environment with robust fallback
   */
  private initCredentials(): void {
    const rawBucket =
      process.env.B2_BUCKET_NAME ||
      process.env.B2_BUCKET ||
      process.env.AWS_S3_BUCKET ||
      'wits-lingo-materials';
    this.s3Bucket = rawBucket.trim().replace(/^["']|["']$/g, '');

    const rawBucketId =
      process.env.B2_BUCKET_ID ||
      process.env.B2_BUCKETID ||
      'c38efea7e836c672a50b0c10';
    this.bucketId = rawBucketId.trim().replace(/^["']|["']$/g, '');

    const rawEndpoint =
      process.env.B2_ENDPOINT ||
      process.env.AWS_ENDPOINT ||
      's3.us-east-005.backblazeb2.com';
    this.s3Endpoint = rawEndpoint.trim().replace(/^["']|["']$/g, '').replace(/^https?:\/\//i, '');

    let rawKeyId =
      process.env.B2_KEY_ID ||
      process.env.B2_KEYID ||
      process.env.B2_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID ||
      '';
    rawKeyId = rawKeyId.trim().replace(/^["']|["']$/g, '');

    let rawAppKey =
      process.env.B2_APPLICATION_KEY ||
      process.env.B2_APP_KEY ||
      process.env.B2_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      '';
    rawAppKey = rawAppKey.trim().replace(/^["']|["']$/g, '');

    // Fallback if environment is unconfigured or still holds the revoked key (...00000000003)
    const REVOKED_KEY = '0053ee786625bc00000000003';
    if (!rawKeyId || rawKeyId === REVOKED_KEY) {
      this.keyId = '0053ee786625bc00000000004';
      this.appKey = 'K005Vi6dUBAOsB5H7DyWjWYZA72D/0s';
    } else {
      this.keyId = rawKeyId;
      this.appKey = rawAppKey || 'K005Vi6dUBAOsB5H7DyWjWYZA72D/0s';
    }
  }

  /**
   * Initialize S3 / Backblaze B2 client with S3-compatible fixes:
   * 1. requestChecksumCalculation: 'WHEN_REQUIRED' (disables AWS SDK v3 chunked checksum trailers that B2 rejects with "body was too small")
   * 2. responseChecksumValidation: 'WHEN_REQUIRED'
   * 3. forcePathStyle: true (ensures direct bucket path addressing)
   */
  private initS3Client(): void {
    if (this.s3Bucket && this.keyId && this.appKey) {
      try {
        const regionMatch = this.s3Endpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
        const region = regionMatch ? regionMatch[1] : (process.env.AWS_REGION || 'us-east-005');

        this.s3Client = new S3Client({
          endpoint: `https://${this.s3Endpoint}`,
          region,
          credentials: {
            accessKeyId: this.keyId,
            secretAccessKey: this.appKey
          },
          // CRITICAL: Backblaze B2 S3 API does not accept automatic flexible checksum trailers.
          // Setting WHEN_REQUIRED prevents the SDK from altering body length or sending chunked trailers.
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
          forcePathStyle: true,
          maxAttempts: 3
        });
        this.s3Configured = true;
      } catch (err) {
        console.warn('[DurableStorage] Could not initialize S3/B2 client:', err);
        this.s3Configured = false;
      }
    }
  }

  /**
   * Backblaze B2 Native REST Authentication (Zero-dependency fallback that never has S3 checksum quirks)
   */
  private async getB2NativeAuth(): Promise<B2NativeAuth | null> {
    if (!this.keyId || !this.appKey) return null;

    if (this.b2AuthCache && this.b2AuthCache.expiresAt > Date.now() + 60 * 60 * 1000) {
      return this.b2AuthCache;
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.appKey}`).toString('base64');
      const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
        headers: { Authorization: authHeader }
      });

      if (!authRes.ok) {
        console.warn('[DurableStorage] B2 Native Auth failed with HTTP status:', authRes.status);
        return null;
      }

      const authData = (await authRes.json()) as any;
      const apiUrl = authData.apiInfo.storageApi.apiUrl;
      const downloadUrl = authData.apiInfo.storageApi.downloadUrl;
      const authToken = authData.authorizationToken;
      const accountId = authData.accountId;

      let bucketId: string | undefined = this.bucketId || undefined;
      let actualBucketName = this.s3Bucket;

      try {
        const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
          method: 'POST',
          headers: { Authorization: authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId })
        });
        if (listRes.ok) {
          const bucketData = (await listRes.json()) as any;
          const buckets = bucketData.buckets || [];
          const normalizedConfig = this.s3Bucket.replace(/[_]/g, '-').toLowerCase();
          const matched = buckets.find(
            (b: any) =>
              b.bucketName.toLowerCase() === this.s3Bucket.toLowerCase() ||
              b.bucketName.replace(/[_]/g, '-').toLowerCase() === normalizedConfig
          ) || buckets[0];

          if (matched) {
            bucketId = matched.bucketId;
            actualBucketName = matched.bucketName;
          }
        }
      } catch (listErr) {
        console.warn('[DurableStorage] Could not list B2 buckets:', listErr);
      }

      this.b2AuthCache = {
        apiUrl,
        downloadUrl,
        authorizationToken: authToken,
        accountId,
        bucketId,
        bucketName: actualBucketName,
        expiresAt: Date.now() + 20 * 60 * 60 * 1000
      };

      return this.b2AuthCache;
    } catch (err: any) {
      console.warn('[DurableStorage] Error authenticating with B2 Native API:', err?.message);
      return null;
    }
  }

  /**
   * Upload Buffer to Backblaze B2 using Native REST API
   */
  private async uploadViaB2Native(
    fileName: string,
    buffer: Buffer,
    mimeType: string = 'application/json; charset=utf-8'
  ): Promise<{ success: boolean; error?: string }> {
    const b2 = await this.getB2NativeAuth();
    if (!b2 || !b2.bucketId) {
      return { success: false, error: 'B2 Native credentials or bucketId unavailable' };
    }

    try {
      const upUrlRes = await fetch(`${b2.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: 'POST',
        headers: { Authorization: b2.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: b2.bucketId })
      });

      if (!upUrlRes.ok) {
        return { success: false, error: `B2 get_upload_url failed with HTTP ${upUrlRes.status}` };
      }

      const upUrlData = (await upUrlRes.json()) as any;
      const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

      const uploadRes = await fetch(upUrlData.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: upUrlData.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'X-Bz-Content-Sha1': sha1
        },
        body: new Uint8Array(buffer)
      });

      if (uploadRes.ok) {
        return { success: true };
      } else {
        const errText = await uploadRes.text();
        return { success: false, error: `B2 Native upload failed (${uploadRes.status}): ${errText}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'B2 Native upload network exception' };
    }
  }

  /**
   * Download file content from Backblaze B2 using Native REST API
   */
  private async downloadViaB2Native(fileName: string): Promise<string | null> {
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
      console.warn('[DurableStorage] B2 Native download exception for', fileName, err);
    }
    return null;
  }

  /**
   * Initialize Firestore if configured in environment
   */
  private initFirestore(): void {
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_PROJECT_ID || '').trim();
    if (projectId) {
      this.firestoreProjectId = projectId;
      this.firestoreConfigured = true;
    }
  }

  /**
   * Pre-seed in-memory cache from packaged seed files on startup if readable
   */
  private loadInitialData(): void {
    const seedCollections = [
      'conversations',
      'messages',
      'support-tickets',
      'notifications',
      'registrations',
      'orders',
      'materials',
      'webhook-dedup'
    ];

    for (const coll of seedCollections) {
      try {
        const localPath = path.join(process.cwd(), 'uploads', 'data', `${coll}.json`);
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          const parsed = JSON.parse(raw);
          this.memoryCache.set(coll, parsed);

          if (coll === 'webhook-dedup' && Array.isArray(parsed)) {
            const now = Date.now();
            for (const item of parsed) {
              if (item.key && (!item.expiresAt || item.expiresAt > now)) {
                this.dedupCache.set(`${item.scope || 'default'}:${item.key}`, item);
              }
            }
          }
        }
      } catch {
        // Files may not exist yet on fresh start; ignore
      }
    }
  }

  /**
   * Diagnostic summary of persistence status
   */
  public getDiagnostics(): StorageDiagnostics {
    let primaryBackend: 'b2_s3' | 'b2_native' | 'firestore' | 'local_fs' | 'in_memory_fallback';
    if (this.s3Configured) {
      primaryBackend = 'b2_s3';
    } else if (Boolean(this.keyId && this.appKey)) {
      primaryBackend = 'b2_native';
    } else if (this.firestoreConfigured) {
      primaryBackend = 'firestore';
    } else if (!this.isReadOnlyFs) {
      primaryBackend = 'local_fs';
    } else {
      primaryBackend = 'in_memory_fallback';
    }

    return {
      isVercel: process.env.VERCEL === '1',
      isFileSystemReadOnly: this.isReadOnlyFs,
      primaryBackend,
      b2Configured: this.s3Configured || Boolean(this.keyId && this.appKey),
      b2Bucket: this.s3Bucket || undefined,
      b2BucketId: this.bucketId || undefined,
      b2Endpoint: this.s3Endpoint || undefined,
      b2NativeConfigured: Boolean(this.keyId && this.appKey),
      firestoreConfigured: this.firestoreConfigured,
      firestoreProjectId: this.firestoreProjectId || undefined,
      cachedCollections: Array.from(this.memoryCache.keys()),
      dedupCount: this.dedupCache.size
    };
  }

  /**
   * Retrieve a collection from durable cloud storage or memory cache
   */
  public async getCollection<T>(collectionName: string, defaultValue: T[] = []): Promise<T[]> {
    // 1. Return from in-memory cache if available
    if (this.memoryCache.has(collectionName)) {
      const cached = this.memoryCache.get(collectionName);
      if (Array.isArray(cached) && cached.length > 0) {
        return [...cached];
      }
    }

    const key = `data/${collectionName}.json`;

    // 2. Try fetching from Backblaze B2 via S3
    if (this.s3Configured && this.s3Client) {
      try {
        const res = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.s3Bucket,
            Key: key
          })
        );

        if (res.Body) {
          const chunks: Buffer[] = [];
          for await (const chunk of res.Body as any) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const content = Buffer.concat(chunks).toString('utf-8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            this.memoryCache.set(collectionName, parsed);
            return [...parsed];
          }
        }
      } catch (s3Err: any) {
        if (s3Err?.name !== 'NoSuchKey' && s3Err?.$metadata?.httpStatusCode !== 404) {
          console.warn(`[DurableStorage] B2 S3 read error for ${collectionName}:`, s3Err?.message);
        }
      }
    }

    // 3. Fallback: Try fetching via B2 Native REST API
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
        // Fall through
      }
    }

    // 4. Try reading local file if accessible
    try {
      const localPath = path.join(process.cwd(), 'uploads', 'data', `${collectionName}.json`);
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memoryCache.set(collectionName, parsed);
          return [...parsed];
        }
      }
    } catch {
      // Local read failed; fall back to default
    }

    this.memoryCache.set(collectionName, defaultValue);
    return [...defaultValue];
  }

  /**
   * Synchronously get collection from in-memory cache (zero latency)
   */
  public getCollectionSync<T>(collectionName: string, defaultValue: T[] = []): T[] {
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
  public async saveCollection<T>(collectionName: string, items: T[]): Promise<StoragePersistenceResult> {
    // Acquire mutex lock for this collection to serialize concurrent updates
    const previousLock = this.collectionLocks.get(collectionName) || Promise.resolve();

    const executeSave = async (): Promise<StoragePersistenceResult> => {
      const timestamp = new Date().toISOString();
      const cloned = Array.isArray(items) ? [...items] : [];
      this.memoryCache.set(collectionName, cloned);

      const jsonString = JSON.stringify(cloned, null, 2);
      const bodyBuffer = Buffer.from(jsonString, 'utf-8');
      const contentLength = bodyBuffer.byteLength;
      const key = `data/${collectionName}.json`;

      // -------------------------------------------------------------
      // 1. Primary: Backblaze B2 S3 API (with explicit ContentLength & no chunked trailers)
      // -------------------------------------------------------------
      if (this.s3Configured && this.s3Client) {
        let s3Error: string | undefined;
        try {
          // Re-initialize client dynamically if env changed
          if (!this.s3Client) this.initS3Client();

          await this.s3Client!.send(
            new PutObjectCommand({
              Bucket: this.s3Bucket,
              Key: key,
              Body: bodyBuffer,
              ContentLength: contentLength, // CRITICAL: Fixes "The request body was too small"
              ContentType: 'application/json; charset=utf-8'
            })
          );

          return {
            success: true,
            backend: 'b2_s3',
            bytesWritten: contentLength,
            timestamp
          };
        } catch (s3Err: any) {
          s3Error = s3Err?.message || 'B2 PutObject failed';
          console.warn(
            `[DurableStorage] B2 S3 upload failed for '${collectionName}' (${s3Error}). Attempting Backblaze B2 Native REST fallback...`
          );
        }

        // -------------------------------------------------------------
        // 2. Resilient Fallback: Backblaze B2 Native REST API
        // -------------------------------------------------------------
        if (this.keyId && this.appKey) {
          try {
            const nativeRes = await this.uploadViaB2Native(key, bodyBuffer, 'application/json; charset=utf-8');
            if (nativeRes.success) {
              console.log(`[DurableStorage] Collection '${collectionName}' successfully persisted via B2 Native REST API.`);
              return {
                success: true,
                backend: 'b2_native',
                bytesWritten: contentLength,
                timestamp
              };
            } else {
              console.error(`[DurableStorage] B2 Native fallback also failed for '${collectionName}':`, nativeRes.error);
            }
          } catch (nativeErr: any) {
            console.error(`[DurableStorage] B2 Native exception for '${collectionName}':`, nativeErr?.message);
          }
        }

        // If we reach here, B2 S3 failed and Native fallback failed
        if (process.env.VERCEL === '1') {
          return {
            success: false,
            backend: 'b2_s3',
            error: s3Error || 'B2 persistence failed',
            timestamp
          };
        }
      }

      // -------------------------------------------------------------
      // 3. Fallback: Firestore if configured
      // -------------------------------------------------------------
      if (this.firestoreConfigured && this.firestoreProjectId) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${this.firestoreProjectId}/databases/(default)/documents/app_collections/${collectionName}`;
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
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
              backend: 'firestore',
              bytesWritten: contentLength,
              timestamp
            };
          }
        } catch (fsErr: any) {
          console.error(`[DurableStorage] Firestore persistence failed:`, fsErr?.message);
        }
      }

      // -------------------------------------------------------------
      // 4. Fallback: Local filesystem (ONLY if writable and NOT on Vercel)
      // -------------------------------------------------------------
      if (!this.isReadOnlyFs && process.env.VERCEL !== '1') {
        try {
          const dir = path.join(process.cwd(), 'uploads', 'data');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const localPath = path.join(dir, `${collectionName}.json`);
          fs.writeFileSync(localPath, jsonString, 'utf-8');

          return {
            success: true,
            backend: 'local_fs',
            bytesWritten: contentLength,
            timestamp
          };
        } catch (fsErr: any) {
          return {
            success: false,
            backend: 'local_fs',
            error: fsErr?.message || 'Local filesystem write failed',
            timestamp
          };
        }
      }

      // -------------------------------------------------------------
      // 5. In-Memory Warning on Vercel
      // -------------------------------------------------------------
      const warnMsg =
        'Read-only serverless filesystem detected. B2/Firestore credentials not configured or rejected upload. Data kept in-memory for container lifetime.';
      console.warn(`[DurableStorage] ${warnMsg}`);
      return {
        success: false,
        backend: 'in_memory_only',
        error: warnMsg,
        timestamp
      };
    };

    const taskPromise = previousLock
      .catch(() => {})
      .then(() => executeSave());
    this.collectionLocks.set(collectionName, taskPromise);
    return taskPromise;
  }

  /**
   * Fast synchronous in-memory update with background cloud persistence
   */
  public saveCollectionBackground<T>(collectionName: string, items: T[]): void {
    const cloned = Array.isArray(items) ? [...items] : [];
    this.memoryCache.set(collectionName, cloned);

    this.saveCollection(collectionName, cloned).catch(err => {
      console.error(`[DurableStorage] Async saveCollection error for '${collectionName}':`, err);
    });
  }

  /**
   * Durable Webhook Event Deduplication:
   * Checks if a webhook messageId or event key has already been processed.
   */
  public async isDeduplicated(scope: string, key: string): Promise<boolean> {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();

    // 1. Check in-memory deduplication cache
    const existing = this.dedupCache.get(compositeKey);
    if (existing) {
      if (existing.expiresAt > now) {
        return true;
      }
      this.dedupCache.delete(compositeKey);
    }

    // 2. Check durable store if not found in memory
    const dedupList = await this.getCollection<DedupRecord>('webhook-dedup', []);
    const found = dedupList.find(d => d.key === key && d.scope === scope);
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
  public isDeduplicatedSync(scope: string, key: string): boolean {
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
  public async recordDedup(
    scope: string,
    key: string,
    ttlMs: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<StoragePersistenceResult> {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const record: DedupRecord = {
      key,
      scope,
      recordedAt: new Date(now).toISOString(),
      expiresAt
    };

    // Update memory
    this.dedupCache.set(compositeKey, record);

    // Update persistent collection
    let dedupList = await this.getCollection<DedupRecord>('webhook-dedup', []);
    // Prune expired records and duplicates
    dedupList = dedupList.filter(d => d.expiresAt > now && !(d.key === key && d.scope === scope));
    dedupList.unshift(record);

    // Keep recent 2000 entries max to prevent uncontrolled growth
    if (dedupList.length > 2000) {
      dedupList = dedupList.slice(0, 2000);
    }

    return this.saveCollection('webhook-dedup', dedupList);
  }

  /**
   * Synchronously record dedup in RAM and flush to cloud storage in background
   */
  public recordDedupBackground(
    scope: string,
    key: string,
    ttlMs: number = 7 * 24 * 60 * 60 * 1000
  ): void {
    const compositeKey = `${scope}:${key}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const record: DedupRecord = {
      key,
      scope,
      recordedAt: new Date(now).toISOString(),
      expiresAt
    };

    this.dedupCache.set(compositeKey, record);

    this.recordDedup(scope, key, ttlMs).catch(err => {
      console.warn(`[DurableStorage] Async recordDedup error for '${key}':`, err);
    });
  }

  /**
   * Automated verification test utility:
   * Performs an isolated write -> read -> verify roundtrip for critical collections.
   */
  public async testCollectionRoundtrip(
    collectionName: string
  ): Promise<{ success: boolean; bytesWritten?: number; backend?: string; error?: string }> {
    const testKey = `_test_roundtrip_${Date.now()}`;
    const testItem = {
      id: testKey,
      _testTimestamp: new Date().toISOString(),
      testCollection: collectionName
    };

    // 1. Fetch current collection items
    const existing = await this.getCollection<any>(collectionName, []);
    const updated = [testItem, ...existing.filter(i => !i.id?.startsWith('_test_roundtrip_'))];

    // 2. Perform durable write
    const writeRes = await this.saveCollection(collectionName, updated);
    if (!writeRes.success) {
      return { success: false, backend: writeRes.backend, error: writeRes.error };
    }

    // 3. Clear cache to force clean remote read
    this.memoryCache.delete(collectionName);

    // 4. Perform durable read
    const refetched = await this.getCollection<any>(collectionName, []);
    const verified = refetched.some(i => i.id === testKey);

    // 5. Clean up test item
    const cleaned = refetched.filter(i => i.id !== testKey);
    await this.saveCollection(collectionName, cleaned);

    return {
      success: verified,
      backend: writeRes.backend,
      bytesWritten: writeRes.bytesWritten,
      error: verified ? undefined : 'Verification failed: Written test item not found on refetch'
    };
  }
}

export const durableStorageService = DurableStorageService.getInstance();
