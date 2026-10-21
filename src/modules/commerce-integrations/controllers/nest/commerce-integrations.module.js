import { Module } from '@nestjs/common';
import { CommerceIntegrationsController } from './commerce-integrations.controller.js';

@Module({
  controllers: [CommerceIntegrationsController],
  providers: [],
})
class CommerceIntegrationsModule {}
export { CommerceIntegrationsModule };
