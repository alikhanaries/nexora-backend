import { createCreateApiKey } from './services/use-cases/create-api-key.js';
import { createListApiKeys } from './services/use-cases/list-api-keys.js';
import { createRevokeApiKey } from './services/use-cases/revoke-api-key.js';
import { createRotateApiKey } from './services/use-cases/rotate-api-key.js';
import { createVerifyApiKey } from './services/use-cases/verify-api-key.js';
import { PostgresApiKeyRepository } from './repositories/postgres-api-key-repository.js';
import apiKeyRoutes from './views/api-key.routes.js';

export function createApiKeysModule(deps) {
    requireApiKeysModuleDeps(deps);
    const apiKeys = new PostgresApiKeyRepository();
    const createApiKey = createCreateApiKey({
        db: deps.database,
        apiKeys,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const rotateApiKey = createRotateApiKey({
        db: deps.database,
        apiKeys,
        stepUpVerifier: deps.stepUpVerifier,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const revokeApiKey = createRevokeApiKey({
        db: deps.database,
        apiKeys,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    });
    const listApiKeys = createListApiKeys({
        db: deps.database,
        apiKeys,
    });
    const verifyApiKey = createVerifyApiKey({
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

/**
 * Fail at wiring time when required collaborators are missing rather than on
 * the first authenticated request with a cryptic property-access TypeError.
 *
 * @param {object} deps
 */
function requireApiKeysModuleDeps(deps) {
    if (deps === undefined || deps === null || typeof deps !== 'object') {
        throw new Error('createApiKeysModule requires a deps object');
    }
    for (const name of ['database', 'rateLimiter', 'stepUpVerifier']) {
        if (deps[name] === undefined || deps[name] === null) {
            throw new Error(`createApiKeysModule requires deps.${name}`);
        }
    }
}
