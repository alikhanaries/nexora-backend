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
 * Route family `/api/v1/mfa/*` (MFA_ROUTES); handlers call `CORE_SERVICES.mfa.useCases`.
 */
@Controller()
class MfaController {
  /** @param {object} coreServices Injected Wasl core services (`mfa.useCases`). */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.mfa.useCases;
  }

  /** Begins TOTP enrollment (secret + otpauth URI). Authz: `mfa.manage`. Requires user session. */
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

  /** Verifies TOTP code against pending factor before activation. Authz: `mfa.manage`. */
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

  /** Activates pending factor and returns one-time recovery codes. Authz: `mfa.manage`. */
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

  /** Step-up: valid TOTP records step-up session for sensitive actions (e.g. API key rotate). */
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

  /** Consumes a recovery code for step-up when TOTP unavailable. Single-use codes. */
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
