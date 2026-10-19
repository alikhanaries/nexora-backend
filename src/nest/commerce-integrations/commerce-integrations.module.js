import { Module } from '@nestjs/common';
import { CommerceIntegrationsController } from './commerce-integrations.controller.js';
import { CommerceIntegrationsService } from './commerce-integrations.service.js';

export @Module({
  controllers: [CommerceIntegrationsController],
  providers: [CommerceIntegrationsService],
  exports: [CommerceIntegrationsService],
})
class CommerceIntegrationsModule {}
