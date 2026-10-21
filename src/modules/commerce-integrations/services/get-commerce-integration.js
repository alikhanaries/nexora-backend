import { NotFoundError } from '../../../shared/errors/index.js';
import { requireChannelRead } from './commerce-integration-permissions.js';

/** @param {object} deps @returns {{ execute: Function }} */
export function createGetCommerceIntegration(deps) {
    /** Loads channel by id or NotFound. Authz: `channels.read`. Tenant-scoped. */
    async function execute(input) {
        requireChannelRead(deps.authorization, input.actorPermissions);
        const channel = await deps.database.execute(async (tx) => {
            const existing = await deps.repository.findById(tx, input.tenantId, input.channelId);
            if (existing === null) {
                throw new NotFoundError('Channel was not found', {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                });
            }
            return existing;
        }, { tenantId: input.tenantId });
        return { channel };
    }
    return { execute };
}
