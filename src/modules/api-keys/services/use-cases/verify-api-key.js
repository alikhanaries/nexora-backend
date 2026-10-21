import { secureCompareHash } from '../../../../shared/security/index.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { hashApiKeySecret, parseApiKey } from '../../models/api-key-secret.js';
import { intersectScopesWithPermissions } from '../../models/api-key.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createVerifyApiKey(deps) {
    /**
     * @param {object} input
     */
    async function execute(input) {
        const parsed = parseApiKey(input.rawKey.trim());
        if (parsed === null) {
            throw new AuthenticationError();
        }
        const candidateHash = hashApiKeySecret(parsed.secret);
        const now = new Date();
        const key = await deps.db.executeAsOwner(async (tx) => deps.apiKeys.findByPrefix(tx, parsed.prefix));
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
        await deps.db.execute(async (tx) => {
            await deps.apiKeys.touchLastUsed(tx, key.id, now);
        }, { tenantId: key.tenantId });
        const permissions = intersectScopesWithPermissions(key.scopes, key.scopes);
        return {
            apiKeyId: key.id,
            tenantId: key.tenantId,
            scopes: key.scopes,
            permissions,
            ...(key.channelId === null ? {} : { channelId: key.channelId }),
        };
    }

    return { execute };
}
