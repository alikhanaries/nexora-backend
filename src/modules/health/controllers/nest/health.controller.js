import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { Public } from '../../../../app/common/decorators/public.decorator.js';
import { NEST_READINESS } from './readiness.provider.js';
import { HEALTH_ROUTES } from '../../routes/health.routes.js';

const echoBodySchema = z.object({
  message: z.string().min(1).max(256),
});

@Controller()
class HealthController {
  constructor(@Inject(NEST_READINESS) readiness) {
    this.readiness = readiness;
  }

  @Public()
  @Get(HEALTH_ROUTES.live.path)
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get(HEALTH_ROUTES.foundationPing.path)
  foundationPing() {
    return { success: true, data: { message: 'pong' } };
  }

  @Public()
  @Post(HEALTH_ROUTES.foundationEcho.path)
  foundationEcho(@Body() body) {
    const data = parseOrThrow(echoBodySchema, body, 'foundation echo');
    return { success: true, data };
  }

  @Public()
  @Get(HEALTH_ROUTES.ready.path)
  async ready(@Res() response) {
    const result = await this.readiness.evaluate();
    const statusCode = result.ready ? 200 : 503;
    response.status(statusCode).json({
      status: result.ready ? 'ready' : 'not_ready',
      checks: result.checks,
    });
  }
}
export { HealthController };
