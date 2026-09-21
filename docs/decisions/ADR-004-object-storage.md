# ADR-004: Object Storage

## Status

Accepted — implemented in Phase 1.

## Context

Large or binary payloads must not be stored in PostgreSQL rows or Redis values.

## Decision

Use an S3-compatible `StorageProvider` abstraction. Local development uses MinIO; production uses managed S3-compatible storage.

## Consequences

- Only `S3StorageProvider` imports `@aws-sdk/client-s3`.
- Object metadata tables are deferred until a business module owns files.
- `StorageProvider` exposes `put`, `get`, `delete`, `exists`, `head`.
