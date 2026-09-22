import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthorizationError, RateLimitError, ValidationError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { formatApiKey, generateApiKeyPrefix, generateApiKeySecret, hashApiKeySecret, } from '../../domain/api-key-secret.js';
import { intersectScopesWithPermissions } from '../../domain/api-key.js';
export class CreateApiKeyUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (!input.actorPermissions.includes('api_keys.manage')) {
            throw new AuthorizationError('Missing required permission: api_keys.manage');
        }
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('API key name is required');
        }
        if (input.scopes.length === 0) {
            throw new ValidationError('At least one scope is required');
        }
        const allowedScopes = intersectScopesWithPermissions(input.scopes, input.actorPermissions);
        if (allowedScopes.length !== input.scopes.length) {
            throw new ValidationError('One or more scopes exceed the caller permissions');
        }
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.apiKeyCreate,
            subject: `${input.tenantId}:${input.actorId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const prefix = generateApiKeyPrefix();
        const secret = generateApiKeySecret();
        const secretHash = hashApiKeySecret(secret);
        const id = randomUUID();
        const summary = await this.deps.db.execute(async (tx) => {
            const created = await this.deps.apiKeys.create(tx, {
                id,
                tenantId: input.tenantId,
                name,
                prefix,
                secretHash,
                keyType: input.keyType ?? 'STANDARD',
                scopes: allowedScopes,
                expiresAt: input.expiresAt ?? null,
            });
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: 'user',
                actorId: input.actorId,
                eventType: 'API_KEY_CREATED',
                resourceType: 'api_key',
                resourceId: created.id,
                metadata: { name, scopes: [...allowedScopes], prefix },
                ...auditRequestFields(),
            });
            return created;
        }, { tenantId: input.tenantId });
        return {
            id: summary.id,
            prefix: summary.prefix,
            secret: formatApiKey(prefix, secret),
            name: summary.name,
            scopes: summary.scopes,
            keyType: summary.keyType,
            expiresAt: summary.expiresAt,
        };
    }
}
