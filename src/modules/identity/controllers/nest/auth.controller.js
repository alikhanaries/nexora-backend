import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import {
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
} from '../../views/auth.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { Public } from '../../../../app/common/decorators/public.decorator.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { AUTH_ROUTES } from '../../routes/auth.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Route family `/api/v1/auth/*` (AUTH_ROUTES); handlers call `CORE_SERVICES.identity.useCases`.
 */
@Controller()
class AuthController {
  /** @param {object} coreServices Injected Wasl core services (`identity.useCases`). */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.identity.useCases;
  }

  /**
   * Password login for a tenant slug; returns access + refresh tokens. Public. Rate-limited in use case.
   */
  @Public()
  @Post(AUTH_ROUTES.login.path)
  @HttpCode(200)
  async login(@Body() body) {
    const parsed = parseOrThrow(loginBodySchema, body, 'login');
    const result = await this.useCases.login.execute(parsed);
    return { success: true, data: result };
  }

  /** Rotates refresh token and issues new access token. Public. Refresh token rotation in use case. */
  @Public()
  @Post(AUTH_ROUTES.refresh.path)
  @HttpCode(200)
  async refresh(@Body() body) {
    const parsed = parseOrThrow(refreshBodySchema, body, 'refresh');
    const result = await this.useCases.refreshToken.execute(parsed);
    return { success: true, data: result };
  }

  /** Revokes refresh session family from presented refresh token. Public. */
  @Public()
  @Post(AUTH_ROUTES.logout.path)
  @HttpCode(200)
  async logout(@Body() body) {
    const parsed = parseOrThrow(logoutBodySchema, body, 'logout');
    await this.useCases.logout.execute(parsed);
    return { success: true, data: { loggedOut: true } };
  }

  /** Current user + membership for Bearer access token (auth required, not @Public). */
  @Get(AUTH_ROUTES.me.path)
  async me(@Headers('authorization') authorization) {
    if (typeof authorization !== 'string') {
      throw new AuthenticationError();
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (match?.[1] === undefined) {
      throw new AuthenticationError();
    }
    const result = await this.useCases.getCurrentUser.execute({
      accessToken: match[1],
    });
    return { success: true, data: result };
  }
}
export { AuthController };
