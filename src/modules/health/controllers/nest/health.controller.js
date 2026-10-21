/**
 * Liveness, readiness, and public foundation probe endpoints.
 * Routes from HEALTH_ROUTES (`/health/*`, `/api/v1/foundation/*`); readiness via injected NEST_READINESS checks.
 */
import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { Public } from '../../../../app/common/decorators/public.decorator.js';
import { NEST_READINESS } from './readiness.provider.js';
import { HEALTH_ROUTES } from '../../routes/health.routes.js';

const echoBodySchema = z.object({
  message: z.string().min(1).max(256),
});

/** Unauthenticated health and foundation smoke endpoints. */
@Controller()
class HealthController {
  /** @param {object} readiness Injected readiness evaluator (DB/Redis checks). */
  constructor(@Inject(NEST_READINESS) readiness) {
    this.readiness = readiness;
  }

  /** Liveness: process up (no dependency checks). Public, no auth. */
  @Public()
  @Get(HEALTH_ROUTES.live.path)
  live() {
    return { status: 'ok' };
  }

  /** Public smoke ping for load balancers and SDK connectivity tests. */
  @Public()
  @Get(HEALTH_ROUTES.foundationPing.path)
  foundationPing() {
    return { success: true, data: { message: 'pong' } };
  }

  /** Echoes validated message body (public contract test endpoint). */
  @Public()
  @Post(HEALTH_ROUTES.foundationEcho.path)
  foundationEcho(@Body() body) {
    const data = parseOrThrow(echoBodySchema, body, 'foundation echo');
    return { success: true, data };
  }

  /** Readiness: 200 when dependencies pass, 503 with check details otherwise. Public. */
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
