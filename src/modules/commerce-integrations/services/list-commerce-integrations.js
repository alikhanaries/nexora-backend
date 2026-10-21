import { requireChannelRead } from './commerce-integration-permissions.js';

/** @param {object} deps @returns {{ execute: Function }} */
export function createListCommerceIntegrations(deps) {
    /** Lists tenant channels with optional filters. Authz: `channels.read`. */
    async function execute(input) {
        requireChannelRead(deps.authorization, input.actorPermissions);
        const channels = await deps.database.execute(async (tx) => deps.repository.list(tx, input.tenantId, {
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.marketplaceId === undefined ? {} : { marketplaceId: input.marketplaceId }),
        }), { tenantId: input.tenantId });
        return { channels };
    }
    return { execute };
}
