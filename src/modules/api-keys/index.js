/**
 * API keys domain: tenant-scoped key lifecycle (create, rotate, revoke, list) and request verification.
 * Wired by the app composition root; exposes use cases for Nest/HTTP handlers.
 */
import { createCreateApiKey } from './services/use-cases/create-api-key.js';
import { createListApiKeys } from './services/use-cases/list-api-keys.js';
import { createRevokeApiKey } from './services/use-cases/revoke-api-key.js';
import { createRotateApiKey } from './services/use-cases/rotate-api-key.js';
import { createVerifyApiKey } from './services/use-cases/verify-api-key.js';
import { createPostgresApiKeyRepository } from './repositories/postgres-api-key-repository.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../../infrastructure/auth/step-up-verifier.port.js').StepUpVerifierPort} deps.stepUpVerifier
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ useCases: { createApiKey: Function, rotateApiKey: Function, revokeApiKey: Function, listApiKeys: Function, verifyApiKey: Function } }}
 */
export function createApiKeysModule(deps) {
    const apiKeys = createPostgresApiKeyRepository();
    const createApiKey = createCreateApiKey({
        db: deps.database,
        apiKeys,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const rotateApiKey = createRotateApiKey({
        db: deps.database,
        apiKeys,
        stepUpVerifier: deps.stepUpVerifier,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const revokeApiKey = createRevokeApiKey({
        db: deps.database,
        apiKeys,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const listApiKeys = createListApiKeys({
        db: deps.database,
        apiKeys
    });
    const verifyApiKey = createVerifyApiKey({
        db: deps.database,
        apiKeys
    });
    return {
        useCases: {
            createApiKey,
            rotateApiKey,
            revokeApiKey,
            listApiKeys,
            verifyApiKey,
        },
    };
}
