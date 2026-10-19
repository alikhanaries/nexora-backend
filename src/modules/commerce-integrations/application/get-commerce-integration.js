import { NotFoundError } from '../../../shared/errors/index.js';
import { requireChannelRead } from './commerce-integration-permissions.js';
export class GetCommerceIntegration {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireChannelRead(this.deps.authorization, input.actorPermissions);
        const channel = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.repository.findById(tx, input.tenantId, input.channelId);
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
}
