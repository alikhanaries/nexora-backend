import { CreateApiKeyUseCase } from './services/use-cases/create-api-key.js';
import { ListApiKeysUseCase } from './services/use-cases/list-api-keys.js';
import { RevokeApiKeyUseCase } from './services/use-cases/revoke-api-key.js';
import { RotateApiKeyUseCase } from './services/use-cases/rotate-api-key.js';
import { VerifyApiKeyUseCase } from './services/use-cases/verify-api-key.js';
import { PostgresApiKeyRepository } from './repositories/postgres-api-key-repository.js';
import apiKeyRoutes from './views/api-key.routes.js';
export function createApiKeysModule(deps) {
    const apiKeys = new PostgresApiKeyRepository();
    const createApiKey = new CreateApiKeyUseCase({
        db: deps.database,
        apiKeys,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const rotateApiKey = new RotateApiKeyUseCase({
        db: deps.database,
        apiKeys,
        stepUpVerifier: deps.stepUpVerifier,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const revokeApiKey = new RevokeApiKeyUseCase({
        db: deps.database,
        apiKeys,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const listApiKeys = new ListApiKeysUseCase({
        db: deps.database,
        apiKeys,
    });
    const verifyApiKey = new VerifyApiKeyUseCase({
        db: deps.database,
        apiKeys,
    });
    return {
        useCases: {
            createApiKey,
            rotateApiKey,
            revokeApiKey,
            listApiKeys,
            verifyApiKey,
        },
        routes: {
            plugin: apiKeyRoutes,
            options: {
                createApiKey,
                rotateApiKey,
                revokeApiKey,
                listApiKeys,
            },
        },
    };
}
