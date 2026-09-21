import type { Readable } from 'node:stream';

/**
 * Object storage port.
 *
 * Large or binary payloads belong in object storage, never in PostgreSQL rows
 * or Redis values (ADR-004). Only the infrastructure implementation may import
 * an S3/MinIO SDK.
 */

/** Location of an object within the configured bucket. */
export interface ObjectKey {
  readonly key: string;
}

export interface PutObjectInput {
  readonly key: string;
  /**
   * A stream keeps large uploads off the heap. Buffers are accepted for small,
   * known-size payloads only.
   */
  readonly body: Buffer | Readable;
  readonly contentType: string;
  /** Required when `body` is a stream: S3 needs an explicit length. */
  readonly contentLength?: number | undefined;
  readonly metadata?: Readonly<Record<string, string>> | undefined;
}

export interface StoredObjectDescriptor {
  readonly key: string;
  readonly bucket: string;
  readonly contentType: string | undefined;
  readonly sizeBytes: number | undefined;
  /** Provider-reported integrity value (S3 ETag). */
  readonly checksum: string | undefined;
  readonly lastModifiedAt: Date | undefined;
}

export interface GetObjectResult extends StoredObjectDescriptor {
  readonly body: Readable;
}

export interface StorageProvider {
  put(input: PutObjectInput): Promise<StoredObjectDescriptor>;
  /** @throws {NotFoundError} when the key does not exist. */
  get(key: ObjectKey): Promise<GetObjectResult>;
  /** Idempotent: deleting a missing key is not an error. */
  delete(key: ObjectKey): Promise<void>;
  exists(key: ObjectKey): Promise<boolean>;
  /** Metadata without transferring the body. */
  head(key: ObjectKey): Promise<StoredObjectDescriptor | undefined>;
  healthCheck(): Promise<void>;
}

/**
 * Metadata a module would persist when it needs to track stored objects
 * relationally (ownership, retention, audit).
 *
 * No table exists in Phase 1: there is no owning module yet, and a table with
 * no writer is speculative schema. The shape is fixed here so the first owner
 * inherits a consistent contract rather than inventing a new one.
 */
export interface ObjectMetadata {
  readonly objectId: string;
  readonly provider: 's3';
  readonly bucket: string;
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly tenantId: string | null;
  readonly createdAt: Date;
  readonly retainUntil: Date | null;
}
