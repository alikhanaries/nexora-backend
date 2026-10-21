import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthorizationError, NotFoundError, ValidationError, } from '../../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createRevokeApiKey(deps) {
    /**
     * @param {object} input
     */
    async function execute(input) {
        if (!input.actorPermissions.includes('api_keys.manage')) {
            throw new AuthorizationError('Missing required permission: api_keys.manage');
        }
        const now = new Date();
        await deps.db.execute(async (tx) => {
            const existing = await deps.apiKeys.findById(tx, input.apiKeyId);
            if (existing === null || existing.tenantId !== input.tenantId) {
                throw new NotFoundError('API key was not found');
            }
            if (existing.status !== 'ACTIVE') {
                throw new ValidationError('API key is not active');
            }
            await deps.apiKeys.revoke(tx, existing.id, now);
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: 'user',
                actorId: input.actorId,
                eventType: 'API_KEY_REVOKED',
                resourceType: 'api_key',
                resourceId: existing.id,
                metadata: { prefix: existing.prefix },
                ...auditRequestFields(),
            });
        }, { tenantId: input.tenantId });
        return { revoked: true };
    }

    return { execute };
}
