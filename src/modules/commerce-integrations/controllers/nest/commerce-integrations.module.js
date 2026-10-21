import { Module } from '@nestjs/common';
import { CommerceIntegrationsController } from './commerce-integrations.controller.js';

export @Module({
  controllers: [CommerceIntegrationsController],
  providers: [],
})
class CommerceIntegrationsModule {}
