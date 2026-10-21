import { createStepUpService } from './services/step-up-verifier.js';
import { createActivateTotpFactor } from './services/use-cases/activate-totp-factor.js';
import { createStartTotpEnrollment } from './services/use-cases/start-totp-enrollment.js';
import { createUseRecoveryCode } from './services/use-cases/use-recovery-code.js';
import { createVerifyMfa } from './services/use-cases/verify-mfa.js';
import { createVerifyTotpEnrollment } from './services/use-cases/verify-totp-enrollment.js';
import { createPostgresMfaFactorRepository } from './repositories/postgres-mfa-factor-repository.js';
import { createPostgresRecoveryCodeRepository } from './repositories/postgres-recovery-code-repository.js';
import { createPostgresStepUpSessionRepository } from './repositories/postgres-step-up-session-repository.js';
export function createMfaModule(deps) {
    const mfaFactors = createPostgresMfaFactorRepository();
    const recoveryCodes = createPostgresRecoveryCodeRepository();
    const stepUpSessions = createPostgresStepUpSessionRepository();
    const stepUpService = createStepUpService({
        db: deps.database,
        stepUpSessions,
        stepUpTtlSeconds: deps.config.auth.stepUpTtlSeconds
    });
    const startTotpEnrollment = createStartTotpEnrollment({
        db: deps.database,
        mfaFactors,
        secretEncryptor: deps.secretEncryptor,
        issuer: deps.config.appName
    });
    const verifyTotpEnrollment = createVerifyTotpEnrollment({
        db: deps.database,
        mfaFactors,
        secretEncryptor: deps.secretEncryptor,
        rateLimiter: deps.rateLimiter
    });
    const activateTotpFactor = createActivateTotpFactor({
        db: deps.database,
        mfaFactors,
        recoveryCodes,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const verifyMfa = createVerifyMfa({
        db: deps.database,
        mfaFactors,
        secretEncryptor: deps.secretEncryptor,
        stepUpService,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    });
    const useRecoveryCode = createUseRecoveryCode({
        db: deps.database,
        recoveryCodes,
        stepUpService,
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
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
    };
}
