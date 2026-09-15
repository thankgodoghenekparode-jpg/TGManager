import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Object storage abstraction. Uses S3 with presigned upload/download URLs when
 * configured (S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY);
 * otherwise falls back to the local filesystem under STORAGE_DIR so the API
 * works in development and tests without cloud credentials.
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly localRoot: string;

  constructor(config: ConfigService) {
    this.localRoot = config.get<string>('STORAGE_DIR') ?? 'storage';
    const region = config.get<string>('S3_REGION');
    const bucket = config.get<string>('S3_BUCKET');
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
    if (region && bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
      this.logger.log(`Storage backend: S3 (${region}/${bucket})`);
    } else {
      this.s3 = null;
      this.bucket = null;
      this.logger.log(`Storage backend: local (${this.localRoot})`);
    }
  }

  get isS3(): boolean {
    return this.s3 !== null && this.bucket !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isS3) {
      await mkdir(this.localRoot, { recursive: true });
    }
  }

  async onModuleDestroy(): Promise<void> {
    // No-op: S3 client and local dir need no teardown.
  }

  async putObject(key: string, body: Buffer, mimeType?: string): Promise<void> {
    if (this.isS3 && this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType ?? 'application/octet-stream',
        }),
      );
      return;
    }
    const filePath = this.localPath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
  }

  async getObject(key: string): Promise<Buffer> {
    if (this.isS3 && this.s3 && this.bucket) {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from((await res.Body?.transformToByteArray()) ?? []);
    }
    return readFile(this.localPath(key));
  }

  async deleteObject(key: string): Promise<void> {
    if (this.isS3 && this.s3 && this.bucket) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return;
    }
    await unlink(this.localPath(key)).catch(() => {
      // Ignore missing local files.
    });
  }

  async createUploadUrl(
    key: string,
    mimeType?: string,
    expiresIn = 900,
  ): Promise<string | null> {
    if (!this.isS3 || !this.s3 || !this.bucket) return null;
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn },
    );
  }

  async createDownloadUrl(
    key: string,
    expiresIn = 900,
  ): Promise<string | null> {
    if (!this.isS3 || !this.s3 || !this.bucket) return null;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  private localPath(key: string): string {
    return join(this.localRoot, key);
  }
}
