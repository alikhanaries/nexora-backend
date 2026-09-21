import { verify } from 'otplib';
import type { SecretEncryptor } from '../../../../shared/auth/index.js';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';
import type { RateLimitService } from '../../../../shared/rate-limit/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MfaFactorRepository } from '../ports/mfa-factor-repository.js';

export interface VerifyTotpEnrollmentInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly actorPermissions: readonly string[];
  readonly factorId: string;
  readonly code: string;
}

export interface VerifyTotpEnrollmentDeps {
  readonly db: TransactionManager;
  readonly mfaFactors: MfaFactorRepository;
  readonly secretEncryptor: SecretEncryptor;
  readonly rateLimiter: RateLimitService;
}

export class VerifyTotpEnrollmentUseCase {
  constructor(private readonly deps: VerifyTotpEnrollmentDeps) {}

  async execute(input: VerifyTotpEnrollmentInput): Promise<{ verified: true }> {
    if (!input.actorPermissions.includes('mfa.manage')) {
      throw new AuthorizationError('Missing required permission: mfa.manage');
    }

    const rateLimit = await this.deps.rateLimiter.consume({
      policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
      subject: `${input.tenantId}:${input.userId}`,
    });
    if (!rateLimit.allowed) {
      throw new RateLimitError(rateLimit.retryAfterSeconds);
    }

    const factor = await this.deps.db.execute(
      async (tx) => this.deps.mfaFactors.findById(tx, input.factorId),
      { tenantId: input.tenantId },
    );

    if (factor === null || factor.userId !== input.userId || factor.status !== 'PENDING') {
      throw new NotFoundError('MFA factor was not found');
    }

    const secret = this.deps.secretEncryptor.decrypt(factor.secretEncrypted);
    const valid = await verify({ token: input.code, secret });
    if (!valid) {
      throw new ValidationError('Invalid MFA code');
    }

    return { verified: true };
  }
}
