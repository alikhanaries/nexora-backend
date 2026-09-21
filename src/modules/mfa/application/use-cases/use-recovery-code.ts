import type { AuditRecorder } from '../../../audit/public/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import type { RateLimitService } from '../../../../shared/rate-limit/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { hashSecret } from '../../../../shared/security/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { RecoveryCodeRepository } from '../ports/recovery-code-repository.js';
import type { StepUpService } from '../step-up-verifier.js';

export interface UseRecoveryCodeInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly code: string;
}

export interface UseRecoveryCodeDeps {
  readonly db: TransactionManager;
  readonly recoveryCodes: RecoveryCodeRepository;
  readonly stepUpService: StepUpService;
  readonly rateLimiter: RateLimitService;
  readonly auditRecorder?: AuditRecorder;
}

export class UseRecoveryCodeUseCase {
  constructor(private readonly deps: UseRecoveryCodeDeps) {}

  async execute(input: UseRecoveryCodeInput): Promise<{ stepUpVerified: true }> {
    const rateLimit = await this.deps.rateLimiter.consume({
      policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
      subject: `${input.tenantId}:${input.userId}`,
    });
    if (!rateLimit.allowed) {
      throw new RateLimitError(rateLimit.retryAfterSeconds);
    }

    const codeHash = hashSecret(input.code.trim());
    const now = new Date();
    await this.deps.db.execute(
      async (tx) => {
        const record = await this.deps.recoveryCodes.findActiveByHash(tx, codeHash);
        if (
          record === null ||
          record.userId !== input.userId ||
          record.tenantId !== input.tenantId
        ) {
          throw new ValidationError('Invalid recovery code');
        }

        await this.deps.recoveryCodes.markUsed(tx, record.id, now);
        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: 'user',
          actorId: input.userId,
          eventType: 'MFA_STEP_UP',
          resourceType: 'recovery_code',
          resourceId: record.id,
          metadata: { method: 'recovery_code' },
          ...auditRequestFields(),
        });
      },
      { tenantId: input.tenantId },
    );

    await this.deps.stepUpService.recordStepUp({
      userId: input.userId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
    });

    return { stepUpVerified: true };
  }
}
