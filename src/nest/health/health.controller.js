import { Controller, Get, Inject, Res } from '@nestjs/common';
import { NEST_READINESS } from './readiness.provider.js';

export @Controller()
class HealthController {
  constructor(@Inject(NEST_READINESS) readiness) {
    this.readiness = readiness;
  }

  @Get('/health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('/health/ready')
  async ready(@Res() response) {
    const result = await this.readiness.evaluate();
    const statusCode = result.ready ? 200 : 503;
    response.status(statusCode).json({
      status: result.ready ? 'ready' : 'not_ready',
      checks: result.checks,
    });
  }
}
