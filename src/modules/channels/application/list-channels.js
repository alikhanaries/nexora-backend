import { requireChannelRead } from './channel-permissions.js';
export class ListChannels {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireChannelRead(this.deps.authorization, input.actorPermissions);
        const channels = await this.deps.database.execute(async (tx) => this.deps.repository.list(tx, input.tenantId, {
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.marketplaceId === undefined ? {} : { marketplaceId: input.marketplaceId }),
        }), { tenantId: input.tenantId });
        return { channels };
    }
}
