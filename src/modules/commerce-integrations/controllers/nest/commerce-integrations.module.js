/**
 * Nest module for commerce channel (integration) management APIs.
 * Registers CommerceIntegrationsController using CORE_SERVICES.channelRouteDeps.
 */
import { Module } from '@nestjs/common';
import { CommerceIntegrationsController } from './commerce-integrations.controller.js';

@Module({
  controllers: [CommerceIntegrationsController],
  providers: [],
})
class CommerceIntegrationsModule {}
export { CommerceIntegrationsModule };
