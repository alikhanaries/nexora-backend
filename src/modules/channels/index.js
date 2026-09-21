import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateChannel, CreateChannel, DeactivateChannel, DefaultChannelQueryService, GetChannel, ListChannels, SuspendChannel, UpdateChannel, } from './application/index.js';
import { PostgresChannelRepository } from './infrastructure/index.js';
import channelRoutes, {} from './presentation/channel.routes.js';
export function createChannelsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const repository = new PostgresChannelRepository();
    const sharedDeps = {
        authorization,
        repository,
        database: deps.database,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const channelQueryService = new DefaultChannelQueryService({
        queryable: deps.database,
        getChannelById: (tenantId, channelId, queryable) => repository.findById(queryable, tenantId, channelId),
        listChannels: (tenantId, filters, queryable) => repository.list(queryable, tenantId, filters),
    });
    const useCases = {
        createChannel: new CreateChannel({
            ...sharedDeps,
            verifyMarketplaceExists: deps.verifyMarketplaceExists,
        }),
        getChannel: new GetChannel(sharedDeps),
        listChannels: new ListChannels(sharedDeps),
        updateChannel: new UpdateChannel(sharedDeps),
        activateChannel: new ActivateChannel(sharedDeps),
        deactivateChannel: new DeactivateChannel(sharedDeps),
        suspendChannel: new SuspendChannel(sharedDeps),
    };
    return {
        useCases,
        channelQueryService,
        routes: channelRoutes,
    };
}
export { Channel, ChannelStatus } from './domain/index.js';
