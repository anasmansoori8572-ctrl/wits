import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export interface StoragePersistenceResult {
  success: boolean;
  backend: 'b2_s3' | 'firestore' | 'local_fs' | 'in_memory_only';
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
  primaryBackend: 'b2_s3' | 'firestore' | 'local_fs' | 'in_memory_fallback';
  b2Configured: boolean;
  b2Bucket?: string;
  b2Endpoint?: string;
  firestoreConfigured: boolean;
  firestoreProjectId?: string;
  cachedCollections: string[];
  dedupCount: number;
}

/**
 * DurableStorageService provides unified, cloud-resilient persistence across:
 * 1. Backblaze B2 / AWS S3 (via @aws-sdk/client-s3)
 * 2. Firebase Firestore (REST API if FIREBASE_PROJECT_ID configured)
 * 3. Local filesystem JSON files (ONLY when writable in local development)
 * 4. In-memory cache with explicit observable diagnostics (NEVER writes to read-only disk on Vercel)
 */
export class DurableStorageService {
  private static instance: DurableStorageService;

  private memoryCache: Map<string, any> = new Map();
  private s3Client: S3Client | null = null;
  private s3Configured: boolean = false;
  private s3Bucket: string = '';
  private firestoreConfigured: boolean = false;
  private firestoreProjectId: string = '';
  private isReadOnlyFs: boolean = false;
  private dedupCache: Map<string, DedupRecord> = new Map();

  private constructor() {
    this.detectEnvironment();
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
   * Initialize S3 / Backblaze B2 client from environment variables
   */
  private initS3Client(): void {
    const bucket = (process.env.B2_BUCKET_NAME || process.env.AWS_S3_BUCKET || '').trim();
    const rawEndpoint = (process.env.B2_ENDPOINT || process.env.AWS_ENDPOINT || 's3.us-east-005.backblazeb2.com').trim();
    const keyId = (process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim();
    const appKey = (process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim();

    if (bucket && keyId && appKey) {
      try {
        const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//i, '');
        const regionMatch = cleanEndpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
        const region = regionMatch ? regionMatch[1] : (process.env.AWS_REGION || 'us-east-005');

        this.s3Client = new S3Client({
          endpoint: `https://${cleanEndpoint}`,
          region: region,
          credentials: {
            accessKeyId: keyId,
            secretAccessKey: appKey
          }
        });
        this.s3Bucket = bucket;
        this.s3Configured = true;
      } catch (err) {
        console.warn('[DurableStorage] Could not initialize S3/B2 client:', err);
        this.s3Configured = false;
      }
    }
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
    let primaryBackend: 'b2_s3' | 'firestore' | 'local_fs' | 'in_memory_fallback';
    if (this.s3Configured) {
      primaryBackend = 'b2_s3';
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
      b2Configured: this.s3Configured,
      b2Bucket: this.s3Bucket || undefined,
      b2Endpoint: process.env.B2_ENDPOINT || undefined,
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
      if (Array.isArray(cached)) {
        return [...cached];
      }
    }

    // 2. Try fetching from Backblaze B2 / S3 if configured
    if (this.s3Configured && this.s3Client) {
      try {
        const key = `data/${collectionName}.json`;
        const res = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: key
        }));

        if (res.Body) {
          const chunks: Buffer[] = [];
          for await (const chunk of (res.Body as any)) {
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
        // If file not found in B2 (NoSuchKey), return defaultValue
        if (s3Err?.name !== 'NoSuchKey' && s3Err?.$metadata?.httpStatusCode !== 404) {
          console.warn(`[DurableStorage] B2 read error for ${collectionName}:`, s3Err?.message);
        }
      }
    }

    // 3. Try reading local file if accessible
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
   * Persist collection to durable cloud storage and update memory cache.
   * NEVER writes to read-only disk on Vercel.
   * Reports exact status and never silently claims success on failure.
   */
  public async saveCollection<T>(collectionName: string, items: T[]): Promise<StoragePersistenceResult> {
    const timestamp = new Date().toISOString();
    const cloned = Array.isArray(items) ? [...items] : [];
    this.memoryCache.set(collectionName, cloned);

    const jsonString = JSON.stringify(cloned, null, 2);
    const byteLength = Buffer.byteLength(jsonString, 'utf-8');

    // 1. Persist to Backblaze B2 / S3 if configured
    if (this.s3Configured && this.s3Client) {
      try {
        const key = `data/${collectionName}.json`;
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: Buffer.from(jsonString, 'utf-8'),
          ContentType: 'application/json; charset=utf-8'
        }));

        return {
          success: true,
          backend: 'b2_s3',
          bytesWritten: byteLength,
          timestamp
        };
      } catch (s3Err: any) {
        const errMsg = s3Err?.message || 'B2 PutObject failed';
        console.error(`[DurableStorage] B2 persistence failed for collection '${collectionName}':`, errMsg);
        return {
          success: false,
          backend: 'b2_s3',
          error: errMsg,
          timestamp
        };
      }
    }

    // 2. Persist to Firestore if configured
    if (this.firestoreConfigured && this.firestoreProjectId) {
      try {
        // Direct Firestore REST API persistence
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
            bytesWritten: byteLength,
            timestamp
          };
        } else {
          const errBody = await res.text();
          console.error(`[DurableStorage] Firestore REST error (${res.status}):`, errBody);
          return {
            success: false,
            backend: 'firestore',
            error: `Firestore HTTP ${res.status}`,
            timestamp
          };
        }
      } catch (fsErr: any) {
        console.error(`[DurableStorage] Firestore persistence failed:`, fsErr);
        return {
          success: false,
          backend: 'firestore',
          error: fsErr?.message || 'Firestore write failed',
          timestamp
        };
      }
    }

    // 3. Local filesystem persistence (ONLY if writable and NOT on Vercel)
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
          bytesWritten: byteLength,
          timestamp
        };
      } catch (fsErr: any) {
        console.warn(`[DurableStorage] Local filesystem write failed:`, fsErr?.message);
        return {
          success: false,
          backend: 'local_fs',
          error: fsErr?.message || 'Local filesystem write failed',
          timestamp
        };
      }
    }

    // 4. In-Memory Fallback on Vercel when no cloud database is configured
    console.warn(`[DurableStorage] Running on read-only serverless environment without cloud database configured (B2/Firestore). Data kept in-memory for current container lifetime.`);
    return {
      success: false,
      backend: 'in_memory_only',
      error: 'Read-only serverless filesystem detected. B2/Firestore credentials not configured for durable persistence.',
      timestamp
    };
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
}

export const durableStorageService = DurableStorageService.getInstance();
