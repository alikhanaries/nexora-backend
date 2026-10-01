import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { parseOrThrow } from '../../shared/validation/index.js';
import {
  activateTotpBodySchema,
  mfaCodeBodySchema,
  startTotpBodySchema,
  verifyTotpEnrollmentBodySchema,
} from './mfa.schemas.js';
import { MfaService } from './mfa.service.js';

export @Controller()
class MfaController {
  constructor(@Inject(MfaService) mfaService) {
    this.mfaService = mfaService;
  }

  @Post('/api/v1/mfa/totp/start')
  @HttpCode(200)
  async startTotp(@Body() body) {
    const parsed = parseOrThrow(startTotpBodySchema, body ?? {}, 'start totp');
    const data = await this.mfaService.startTotpEnrollment(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/mfa/totp/verify')
  @HttpCode(200)
  async verifyTotp(@Body() body) {
    const parsed = parseOrThrow(verifyTotpEnrollmentBodySchema, body, 'verify totp enrollment');
    const data = await this.mfaService.verifyTotpEnrollment(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/mfa/totp/activate')
  @HttpCode(200)
  async activateTotp(@Body() body) {
    const parsed = parseOrThrow(activateTotpBodySchema, body, 'activate totp');
    const data = await this.mfaService.activateTotpFactor(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/mfa/verify')
  @HttpCode(200)
  async verifyMfa(@Body() body) {
    const parsed = parseOrThrow(mfaCodeBodySchema, body, 'verify mfa');
    const data = await this.mfaService.verifyMfa(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/mfa/recovery-code/use')
  @HttpCode(200)
  async useRecoveryCode(@Body() body) {
    const parsed = parseOrThrow(mfaCodeBodySchema, body, 'use recovery code');
    const data = await this.mfaService.useRecoveryCode(parsed);
    return { success: true, data };
  }
}
