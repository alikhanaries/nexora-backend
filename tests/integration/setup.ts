import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env', override: false });

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL = 'postgresql://nexora:nexora@localhost:5433/nexora';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.QUEUE_REDIS_URL ??= 'redis://localhost:6379';
process.env.STORAGE_ENDPOINT ??= 'http://localhost:9000';
process.env.STORAGE_BUCKET ??= 'nexora-local';
process.env.STORAGE_ACCESS_KEY_ID ??= 'nexora';
process.env.STORAGE_SECRET_ACCESS_KEY ??= 'nexora-secret';
process.env.STORAGE_FORCE_PATH_STYLE ??= 'true';
process.env.LOG_PRETTY ??= 'false';
process.env.TRACING_ENABLED ??= 'false';
process.env.DOCS_ENABLED ??= 'true';
process.env.AUTH_JWT_SECRET ??= 'test-jwt-secret-32chars-minimum!!';
process.env.AUTH_MFA_ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef';
process.env.AUTH_JWT_SECRET ??= 'test-jwt-secret-32chars-min!!';
process.env.AUTH_MFA_ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef';
