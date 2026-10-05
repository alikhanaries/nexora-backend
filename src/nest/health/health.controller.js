import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from '../../shared/validation/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { NEST_READINESS } from './readiness.provider.js';

const echoBodySchema = z.object({
  message: z.string().min(1).max(256),
});

export @Controller()
class HealthController {
  constructor(@Inject(NEST_READINESS) readiness) {
    this.readiness = readiness;
  }

  @Public()
  @Get('/health/live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('/api/v1/foundation/ping')
  foundationPing() {
    return { success: true, data: { message: 'pong' } };
  }

  @Public()
  @Post('/api/v1/foundation/echo')
  foundationEcho(@Body() body) {
    const data = parseOrThrow(echoBodySchema, body, 'foundation echo');
    return { success: true, data };
  }

  @Public()
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
