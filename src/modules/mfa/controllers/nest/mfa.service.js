import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

export @Injectable()
class MfaService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  get useCases() {
    return this.coreServices.mfa.routes.options;
  }

  async startTotpEnrollment(body) {
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.email === undefined) {
      throw new AuthenticationError('User session is required');
    }
    return this.useCases.startTotpEnrollment.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      email: actor.email,
      ...(body?.label === undefined ? {} : { label: body.label }),
    });
  }

  async verifyTotpEnrollment(body) {
    const actor = requireActorContext();
    if (actor.userId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    return this.useCases.verifyTotpEnrollment.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      factorId: body.factorId,
      code: body.code,
    });
  }

  async activateTotpFactor(body) {
    const actor = requireActorContext();
    if (actor.userId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    const result = await this.useCases.activateTotpFactor.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      actorPermissions: actor.permissions,
      factorId: body.factorId,
    });
    return {
      activated: true,
      recoveryCodes: [...result.recoveryCodes],
    };
  }

  async verifyMfa(body) {
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.sessionId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    return this.useCases.verifyMfa.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      sessionId: actor.sessionId,
      code: body.code,
    });
  }

  async useRecoveryCode(body) {
    const actor = requireActorContext();
    if (actor.userId === undefined || actor.sessionId === undefined) {
      throw new AuthenticationError('User session is required');
    }
    return this.useCases.useRecoveryCode.execute({
      tenantId: actor.tenantId,
      userId: actor.userId,
      sessionId: actor.sessionId,
      code: body.code,
    });
  }
}
