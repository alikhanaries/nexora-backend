import { requireChannelRead } from './commerce-integration-permissions.js';

export function createListCommerceIntegrations(deps) {
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
