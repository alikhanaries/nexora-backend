import type { AuditRecorder } from '../audit/public/index.js';
import type { AppConfig } from '../../shared/config/index.js';
import type { SecretEncryptor } from '../../shared/auth/index.js';
import type { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import type { RateLimitService } from '../../shared/rate-limit/index.js';
import { StepUpService } from './application/step-up-verifier.js';
import { ActivateTotpFactorUseCase } from './application/use-cases/activate-totp-factor.js';
import { StartTotpEnrollmentUseCase } from './application/use-cases/start-totp-enrollment.js';
import { UseRecoveryCodeUseCase } from './application/use-cases/use-recovery-code.js';
import { VerifyMfaUseCase } from './application/use-cases/verify-mfa.js';
import { VerifyTotpEnrollmentUseCase } from './application/use-cases/verify-totp-enrollment.js';
import { PostgresMfaFactorRepository } from './infrastructure/postgres-mfa-factor-repository.js';
import { PostgresRecoveryCodeRepository } from './infrastructure/postgres-recovery-code-repository.js';
import { PostgresStepUpSessionRepository } from './infrastructure/postgres-step-up-session-repository.js';
import mfaRoutes from './presentation/mfa.routes.js';

export interface MfaModuleDependencies {
  readonly database: PostgresDatabase;
  readonly config: AppConfig;
  readonly secretEncryptor: SecretEncryptor;
  readonly rateLimiter: RateLimitService;
  readonly auditRecorder?: AuditRecorder;
}

export function createMfaModule(deps: MfaModuleDependencies) {
  const mfaFactors = new PostgresMfaFactorRepository();
  const recoveryCodes = new PostgresRecoveryCodeRepository();
  const stepUpSessions = new PostgresStepUpSessionRepository();

  const stepUpService = new StepUpService({
    db: deps.database,
    stepUpSessions,
    stepUpTtlSeconds: deps.config.auth.stepUpTtlSeconds,
  });

  const startTotpEnrollment = new StartTotpEnrollmentUseCase({
    db: deps.database,
    mfaFactors,
    secretEncryptor: deps.secretEncryptor,
    issuer: deps.config.appName,
  });

  const verifyTotpEnrollment = new VerifyTotpEnrollmentUseCase({
    db: deps.database,
    mfaFactors,
    secretEncryptor: deps.secretEncryptor,
    rateLimiter: deps.rateLimiter,
  });

  const activateTotpFactor = new ActivateTotpFactorUseCase({
    db: deps.database,
    mfaFactors,
    recoveryCodes,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  });

  const verifyMfa = new VerifyMfaUseCase({
    db: deps.database,
    mfaFactors,
    secretEncryptor: deps.secretEncryptor,
    stepUpService,
    rateLimiter: deps.rateLimiter,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  });

  const useRecoveryCode = new UseRecoveryCodeUseCase({
    db: deps.database,
    recoveryCodes,
    stepUpService,
    rateLimiter: deps.rateLimiter,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  });

  return {
    stepUpService,
    useCases: {
      startTotpEnrollment,
      verifyTotpEnrollment,
      activateTotpFactor,
      verifyMfa,
      useRecoveryCode,
    },
    routes: {
      plugin: mfaRoutes,
      options: {
        startTotpEnrollment,
        verifyTotpEnrollment,
        activateTotpFactor,
        verifyMfa,
        useRecoveryCode,
      },
    },
  };
}

export type MfaModule = ReturnType<typeof createMfaModule>;
