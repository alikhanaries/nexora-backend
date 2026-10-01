import { Controller, Get } from '@nestjs/common';

export @Controller()
class HealthController {
  @Get('/health/live')
  live() {
    return { status: 'ok' };
  }
}
