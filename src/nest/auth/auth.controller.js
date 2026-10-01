import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import {
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
} from '../../modules/identity/presentation/auth.routes.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';

export @Controller()
class AuthController {
  constructor(@Inject(AuthService) authService) {
    this.authService = authService;
  }

  @Public()
  @Post('/api/v1/auth/login')
  @HttpCode(200)
  async login(@Body() body) {
    const parsed = parseOrThrow(loginBodySchema, body, 'login');
    const result = await this.authService.login(parsed);
    return { success: true, data: result };
  }

  @Public()
  @Post('/api/v1/auth/refresh')
  @HttpCode(200)
  async refresh(@Body() body) {
    const parsed = parseOrThrow(refreshBodySchema, body, 'refresh');
    const result = await this.authService.refresh(parsed);
    return { success: true, data: result };
  }

  @Public()
  @Post('/api/v1/auth/logout')
  @HttpCode(200)
  async logout(@Body() body) {
    const parsed = parseOrThrow(logoutBodySchema, body, 'logout');
    await this.authService.logout(parsed);
    return { success: true, data: { loggedOut: true } };
  }

  @Get('/api/v1/auth/me')
  async me(@Headers('authorization') authorization) {
    const result = await this.authService.getCurrentUser(authorization);
    return { success: true, data: result };
  }
}
