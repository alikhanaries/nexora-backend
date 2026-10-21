/**
 * S3-compatible object storage adapter.
 *
 * Supports AWS S3 and path-style endpoints (e.g. MinIO) for product assets and
 * other blob persistence behind the storage port.
 */
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client, } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { NotFoundError, ServiceUnavailableError, toErrorMessage, } from '../../shared/errors/index.js';
/** Type guard for Node readable streams from GetObject body. */
function isReadable(value) {
    return value instanceof Readable;
}
/** Infrastructure implementation of the storage provider port. */
export class S3StorageProvider {
    config;
    client;
    logger;
    bucketEnsured = false;
    /** Configures AWS SDK client for S3 or path-style compatible endpoints. */
    constructor(config, logger) {
        this.config = config;
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
    /** Uploads object bytes/metadata; returns stored object descriptor. */
    async put(input) {
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
        }
        catch (error) {
            throw new ServiceUnavailableError('Object storage write failed', {
                reason: toErrorMessage(error),
            });
        }
    }
    /** Streams object body; throws {@link NotFoundError} when key is missing. */
    async get(key) {
        await this.ensureBucket();
        try {
            const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key.key }));
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
        }
        catch (error) {
            if (isNotFound(error)) {
                throw new NotFoundError('Object was not found', { key: key.key });
            }
            throw new ServiceUnavailableError('Object storage read failed', {
                reason: toErrorMessage(error),
            });
        }
    }
    /** Deletes object by key. */
    async delete(key) {
        await this.ensureBucket();
        try {
            await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key.key }));
        }
        catch (error) {
            throw new ServiceUnavailableError('Object storage delete failed', {
                reason: toErrorMessage(error),
            });
        }
    }
    /** True when {@link head} returns metadata. */
    async exists(key) {
        const head = await this.head(key);
        return head !== undefined;
    }
    /** HEAD object metadata without downloading body; undefined when not found. */
    async head(key) {
        await this.ensureBucket();
        try {
            const result = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key.key }));
            return {
                key: key.key,
                bucket: this.config.bucket,
                contentType: result.ContentType,
                sizeBytes: result.ContentLength,
                checksum: result.ETag?.replace(/"/g, ''),
                lastModifiedAt: result.LastModified,
            };
        }
        catch (error) {
            if (isNotFound(error))
                return undefined;
            throw new ServiceUnavailableError('Object storage head failed', {
                reason: toErrorMessage(error),
            });
        }
    }
    /** Verifies bucket exists (creates if needed) via HeadBucket. */
    async healthCheck() {
        await this.ensureBucket();
        await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    }
    /** One-time HeadBucket or CreateBucket for dev/local endpoints. */
    async ensureBucket() {
        if (this.bucketEnsured)
            return;
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
        }
        catch {
            try {
                await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
                this.logger.info({ bucket: this.config.bucket }, 'Created storage bucket');
            }
            catch (error) {
                throw new ServiceUnavailableError('Could not ensure storage bucket', {
                    reason: toErrorMessage(error),
                });
            }
        }
        this.bucketEnsured = true;
    }
}
/** True for S3 SDK not-found error names. */
function isNotFound(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    const name = error.name;
    return name === 'NotFound' || name === 'NoSuchKey' || name === '404';
}
