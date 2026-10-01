import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

export @Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
class ChannelsModule {}
