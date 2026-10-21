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
 */
@Controller()
class AuthController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.identity.useCases;
  }

  @Public()
  @Post(AUTH_ROUTES.login.path)
  @HttpCode(200)
  async login(@Body() body) {
    const parsed = parseOrThrow(loginBodySchema, body, 'login');
    const result = await this.useCases.login.execute(parsed);
    return { success: true, data: result };
  }

  @Public()
  @Post(AUTH_ROUTES.refresh.path)
  @HttpCode(200)
  async refresh(@Body() body) {
    const parsed = parseOrThrow(refreshBodySchema, body, 'refresh');
    const result = await this.useCases.refreshToken.execute(parsed);
    return { success: true, data: result };
  }

  @Public()
  @Post(AUTH_ROUTES.logout.path)
  @HttpCode(200)
  async logout(@Body() body) {
    const parsed = parseOrThrow(logoutBodySchema, body, 'logout');
    await this.useCases.logout.execute(parsed);
    return { success: true, data: { loggedOut: true } };
  }

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
