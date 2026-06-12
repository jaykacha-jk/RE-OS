import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, resolve } from 'path';

export type StoredObject = {
  /** Opaque storage key used for later deletion. */
  storageKey: string;
  /** Publicly reachable URL for the stored asset. */
  url: string;
};

export interface StorageProvider {
  save(input: { key: string; buffer: Buffer; contentType?: string }): Promise<StoredObject>;
  delete(storageKey: string): Promise<void>;
}

/**
 * Local-disk provider used as the development fallback.
 * Files are written under LOCAL_STORAGE_DIR and served via the `/static` route
 * configured in `main.ts`.
 */
class LocalStorageProvider implements StorageProvider {
  private readonly baseDir = resolve(
    process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), 'storage', 'uploads'),
  );
  private readonly publicBase =
    process.env.PUBLIC_ASSET_BASE_URL ?? 'http://localhost:3001/static';

  async save(input: { key: string; buffer: Buffer; contentType?: string }): Promise<StoredObject> {
    const target = join(this.baseDir, input.key);
    const parent = resolve(target, '..');
    if (!existsSync(parent)) {
      await mkdir(parent, { recursive: true });
    }
    await writeFile(target, input.buffer);
    return {
      storageKey: input.key,
      url: `${this.publicBase}/${input.key}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const target = join(this.baseDir, storageKey);
    if (existsSync(target)) {
      await unlink(target);
    }
  }
}

/**
 * S3 provider. The AWS SDK is loaded lazily so the package remains an optional
 * dependency — local development works without it. Wire AWS_S3_BUCKET +
 * AWS_REGION (+ credentials via the default provider chain) to enable.
 */
class S3StorageProvider implements StorageProvider {
  private readonly bucket = process.env.AWS_S3_BUCKET!;
  private readonly region = process.env.AWS_REGION ?? 'ap-south-1';
  private readonly cdnBase = process.env.AWS_S3_PUBLIC_BASE_URL;
  private clientPromise: Promise<unknown> | null = null;

  private async getClient() {
    if (!this.clientPromise) {
      const moduleName = '@aws-sdk/client-s3';
      this.clientPromise = import(moduleName)
        .then((sdk: any) => new sdk.S3Client({ region: this.region }))
        .catch(() => {
          throw new Error(
            'S3 storage selected but "@aws-sdk/client-s3" is not installed. ' +
              'Run `npm i @aws-sdk/client-s3` or set STORAGE_DRIVER=local.',
          );
        });
    }
    return this.clientPromise;
  }

  async save(input: { key: string; buffer: Buffer; contentType?: string }): Promise<StoredObject> {
    const client: any = await this.getClient();
    const moduleName = '@aws-sdk/client-s3';
    const sdk: any = await import(moduleName);
    await client.send(
      new sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );
    const url = this.cdnBase
      ? `${this.cdnBase}/${input.key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${input.key}`;
    return { storageKey: input.key, url };
  }

  async delete(storageKey: string): Promise<void> {
    const client: any = await this.getClient();
    const moduleName = '@aws-sdk/client-s3';
    const sdk: any = await import(moduleName);
    await client.send(new sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;

  constructor() {
    const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
    if (driver === 's3') {
      if (!process.env.AWS_S3_BUCKET) {
        this.logger.warn('STORAGE_DRIVER=s3 but AWS_S3_BUCKET is missing; falling back to local.');
        this.provider = new LocalStorageProvider();
      } else {
        this.provider = new S3StorageProvider();
      }
    } else {
      this.provider = new LocalStorageProvider();
    }
  }

  /** Decodes a base64 (optionally data-URI) payload and stores it under a tenant path. */
  async saveBase64(input: {
    tenantId: string;
    propertyId: string;
    kind: 'images' | 'videos' | 'documents';
    filename?: string;
    contentBase64: string;
    contentType?: string;
  }): Promise<StoredObject> {
    const cleaned = input.contentBase64.includes(',')
      ? input.contentBase64.slice(input.contentBase64.indexOf(',') + 1)
      : input.contentBase64;
    const buffer = Buffer.from(cleaned, 'base64');
    const ext = input.filename ? extname(input.filename) : this.extFromContentType(input.contentType);
    const hash = randomBytes(8).toString('hex');
    const key = `tenants/${input.tenantId}/properties/${input.propertyId}/${input.kind}/${hash}${ext}`;
    return this.provider.save({ key, buffer, contentType: input.contentType });
  }

  /**
   * Decodes a base64 (optionally data-URI) payload and stores it under the chat
   * conversation path. Reuses the same provider abstraction as property media so
   * S3 / local behaviour is identical.
   */
  async saveChatAttachment(input: {
    tenantId: string;
    conversationId: string;
    filename?: string;
    contentBase64: string;
    contentType?: string;
  }): Promise<StoredObject> {
    const cleaned = input.contentBase64.includes(',')
      ? input.contentBase64.slice(input.contentBase64.indexOf(',') + 1)
      : input.contentBase64;
    const buffer = Buffer.from(cleaned, 'base64');
    const ext = input.filename
      ? extname(input.filename)
      : this.extFromContentType(input.contentType);
    const hash = randomBytes(8).toString('hex');
    const key = `tenants/${input.tenantId}/conversations/${input.conversationId}/${hash}${ext}`;
    return this.provider.save({ key, buffer, contentType: input.contentType });
  }

  /** Size of a base64 (optionally data-URI) payload once decoded, in bytes. */
  decodedByteLength(contentBase64: string): number {
    const cleaned = contentBase64.includes(',')
      ? contentBase64.slice(contentBase64.indexOf(',') + 1)
      : contentBase64;
    return Buffer.from(cleaned, 'base64').length;
  }

  async delete(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) return;
    try {
      await this.provider.delete(storageKey);
    } catch (err) {
      this.logger.warn(`Failed to delete storage object ${storageKey}: ${(err as Error).message}`);
    }
  }

  private extFromContentType(contentType?: string): string {
    if (!contentType) return '';
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'application/pdf': '.pdf',
    };
    return map[contentType] ?? '';
  }

  /** Deterministic checksum helper (useful for idempotent uploads/tests). */
  checksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
