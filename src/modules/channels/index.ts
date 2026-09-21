import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { VerifyMarketplaceExists } from '../marketplaces/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  ActivateChannel,
  CreateChannel,
  DeactivateChannel,
  DefaultChannelQueryService,
  GetChannel,
  ListChannels,
  SuspendChannel,
  UpdateChannel,
} from './application/index.js';
import { PostgresChannelRepository } from './infrastructure/index.js';
import channelRoutes, { type ChannelRoutesDependencies } from './presentation/channel.routes.js';

export interface ChannelsModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly eventRecorder: EventRecorder;
  readonly verifyMarketplaceExists: VerifyMarketplaceExists;
  readonly auditRecorder?: AuditRecorder;
}

export interface ChannelsModule {
  readonly useCases: ChannelRoutesDependencies;
  readonly channelQueryService: DefaultChannelQueryService;
  readonly routes: typeof channelRoutes;
}

export function createChannelsModule(deps: ChannelsModuleDependencies): ChannelsModule {
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
    getChannelById: (tenantId, channelId, queryable) =>
      repository.findById(queryable, tenantId, channelId),
    listChannels: (tenantId, filters, queryable) => repository.list(queryable, tenantId, filters),
  });

  const useCases: ChannelRoutesDependencies = {
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
