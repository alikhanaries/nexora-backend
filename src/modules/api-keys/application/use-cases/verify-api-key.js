import { secureCompareHash } from '../../../../shared/security/index.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { hashApiKeySecret, parseApiKey } from '../../domain/api-key-secret.js';
import { intersectScopesWithPermissions } from '../../domain/api-key.js';
export class VerifyApiKeyUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const parsed = parseApiKey(input.rawKey.trim());
        if (parsed === null) {
            throw new AuthenticationError();
        }
        const candidateHash = hashApiKeySecret(parsed.secret);
        const now = new Date();
        const key = await this.deps.db.execute(async (tx) => this.deps.apiKeys.findByPrefix(tx, parsed.prefix));
        if (key === null) {
            throw new AuthenticationError();
        }
        if (key.status !== 'ACTIVE') {
            throw new AuthenticationError();
        }
        if (key.expiresAt !== null && key.expiresAt <= now) {
            throw new AuthenticationError();
        }
        if (!secureCompareHash(key.secretHash, candidateHash)) {
            throw new AuthenticationError();
        }
        await this.deps.db.execute(async (tx) => {
            await this.deps.apiKeys.touchLastUsed(tx, key.id, now);
        }, { tenantId: key.tenantId });
        const permissions = intersectScopesWithPermissions(key.scopes, key.scopes);
        return {
            apiKeyId: key.id,
            tenantId: key.tenantId,
            scopes: key.scopes,
            permissions,
        };
    }
}
