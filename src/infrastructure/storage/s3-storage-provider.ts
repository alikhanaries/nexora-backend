import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { StorageConfig } from '../../shared/config/index.js';
import {
  NotFoundError,
  ServiceUnavailableError,
  toErrorMessage,
} from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';
import type {
  GetObjectResult,
  ObjectKey,
  PutObjectInput,
  StorageProvider,
  StoredObjectDescriptor,
} from '../../shared/storage/index.js';

function isReadable(value: unknown): value is Readable {
  return value instanceof Readable;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly logger: Logger;
  private bucketEnsured = false;

  constructor(
    private readonly config: StorageConfig,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: 'storage' });
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint === undefined
        ? {}
        : {
            endpoint: config.endpoint,
            forcePathStyle: config.forcePathStyle,
          }),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<StoredObjectDescriptor> {
    await this.ensureBucket();

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.contentLength === undefined ? {} : { ContentLength: input.contentLength }),
        ...(input.metadata === undefined ? {} : { Metadata: input.metadata }),
      });
      const result = await this.client.send(command);

      return {
        key: input.key,
        bucket: this.config.bucket,
        contentType: input.contentType,
        sizeBytes: input.contentLength,
        checksum: result.ETag?.replace(/"/g, ''),
        lastModifiedAt: new Date(),
      };
    } catch (error) {
      throw new ServiceUnavailableError('Object storage write failed', {
        reason: toErrorMessage(error),
      });
    }
  }

  async get(key: ObjectKey): Promise<GetObjectResult> {
    await this.ensureBucket();

    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key.key }),
      );

      if (result.Body === undefined || !isReadable(result.Body)) {
        throw new NotFoundError('Object body was not readable');
      }

      return {
        key: key.key,
        bucket: this.config.bucket,
        contentType: result.ContentType,
        sizeBytes: result.ContentLength,
        checksum: result.ETag?.replace(/"/g, ''),
        lastModifiedAt: result.LastModified,
        body: result.Body,
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundError('Object was not found', { key: key.key });
      }
      throw new ServiceUnavailableError('Object storage read failed', {
        reason: toErrorMessage(error),
      });
    }
  }

  async delete(key: ObjectKey): Promise<void> {
    await this.ensureBucket();
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key.key }));
    } catch (error) {
      throw new ServiceUnavailableError('Object storage delete failed', {
        reason: toErrorMessage(error),
      });
    }
  }

  async exists(key: ObjectKey): Promise<boolean> {
    const head = await this.head(key);
    return head !== undefined;
  }

  async head(key: ObjectKey): Promise<StoredObjectDescriptor | undefined> {
    await this.ensureBucket();
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key.key }),
      );
      return {
        key: key.key,
        bucket: this.config.bucket,
        contentType: result.ContentType,
        sizeBytes: result.ContentLength,
        checksum: result.ETag?.replace(/"/g, ''),
        lastModifiedAt: result.LastModified,
      };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw new ServiceUnavailableError('Object storage head failed', {
        reason: toErrorMessage(error),
      });
    }
  }

  async healthCheck(): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
        this.logger.info({ bucket: this.config.bucket }, 'Created storage bucket');
      } catch (error) {
        throw new ServiceUnavailableError('Could not ensure storage bucket', {
          reason: toErrorMessage(error),
        });
      }
    }
    this.bucketEnsured = true;
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: string }).name;
  return name === 'NotFound' || name === 'NoSuchKey' || name === '404';
}
