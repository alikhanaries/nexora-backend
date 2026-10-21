import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { MFA_ROUTES } from '../../routes/mfa.routes.js';
import {
  activateTotpBodySchema,
  mfaCodeBodySchema,
  startTotpBodySchema,
  verifyTotpEnrollmentBodySchema,
} from '../../views/mfa.schemas.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 */
@Controller()
class MfaController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.mfa.useCases;
  }

  @Post(MFA_ROUTES.startTotp.path)
  @HttpCode(200)
  async startTotp(@Body() body) {
    const parsed = parseOrThrow(startTotpBodySchema, body ?? {}, 'start totp');
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.email === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const data = await this.useCases.startTotpEnrollment.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      email: actor.email,
      ...(parsed?.label === undefined ? {} : { label: parsed.label }),
    });
    return { success: true, data };
  }

  @Post(MFA_ROUTES.verifyTotp.path)
  @HttpCode(200)
  async verifyTotp(@Body() body) {
    const parsed = parseOrThrow(verifyTotpEnrollmentBodySchema, body, 'verify totp enrollment');
    const actor = requireActorContext();
    if (actor.userId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const data = await this.useCases.verifyTotpEnrollment.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      factorId: parsed.factorId,
      code: parsed.code,
    });
    return { success: true, data };
  }

  @Post(MFA_ROUTES.activateTotp.path)
  @HttpCode(200)
  async activateTotp(@Body() body) {
    const parsed = parseOrThrow(activateTotpBodySchema, body, 'activate totp');
    const actor = requireActorContext();
    if (actor.userId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const result = await this.useCases.activateTotpFactor.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      factorId: parsed.factorId,
    });
    return {
      success: true,
      data: {
        activated: true,
        recoveryCodes: [...result.recoveryCodes],
      },
    };
  }

  @Post(MFA_ROUTES.verifyMfa.path)
  @HttpCode(200)
  async verifyMfa(@Body() body) {
    const parsed = parseOrThrow(mfaCodeBodySchema, body, 'verify mfa');
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.sessionId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const data = await this.useCases.verifyMfa.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      sessionId: actor.sessionId,
      code: parsed.code,
    });
    return { success: true, data };
  }

  @Post(MFA_ROUTES.useRecoveryCode.path)
  @HttpCode(200)
  async useRecoveryCode(@Body() body) {
    const parsed = parseOrThrow(mfaCodeBodySchema, body, 'use recovery code');
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.sessionId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const data = await this.useCases.useRecoveryCode.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      sessionId: actor.sessionId,
      code: parsed.code,
    });
    return { success: true, data };
  }
}
export { MfaController };
