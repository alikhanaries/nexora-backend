import { randomUUID } from 'node:crypto';
import { generateSecret, generateURI } from 'otplib';
import type { SecretEncryptor } from '../../../../shared/auth/index.js';
import { AuthorizationError, ConflictError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MfaFactorRepository } from '../ports/mfa-factor-repository.js';

export interface StartTotpEnrollmentInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly actorPermissions: readonly string[];
  readonly label?: string;
  readonly email: string;
}

export interface StartTotpEnrollmentResult {
  readonly factorId: string;
  readonly otpauthUri: string;
}

export interface StartTotpEnrollmentDeps {
  readonly db: TransactionManager;
  readonly mfaFactors: MfaFactorRepository;
  readonly secretEncryptor: SecretEncryptor;
  readonly issuer: string;
}

export class StartTotpEnrollmentUseCase {
  constructor(private readonly deps: StartTotpEnrollmentDeps) {}

  async execute(input: StartTotpEnrollmentInput): Promise<StartTotpEnrollmentResult> {
    if (!input.actorPermissions.includes('mfa.manage')) {
      throw new AuthorizationError('Missing required permission: mfa.manage');
    }

    const secret = generateSecret();
    const factorId = randomUUID();
    const label = input.label?.trim() || 'Authenticator';
    const encrypted = this.deps.secretEncryptor.encrypt(secret);

    await this.deps.db.execute(
      async (tx) => {
        const existing = await this.deps.mfaFactors.findActiveByUser(
          tx,
          input.userId,
          input.tenantId,
        );
        if (existing !== null) {
          throw new ConflictError('An active MFA factor already exists');
        }

        await this.deps.mfaFactors.createPending(tx, {
          id: factorId,
          userId: input.userId,
          tenantId: input.tenantId,
          secretEncrypted: encrypted,
          label,
        });
      },
      { tenantId: input.tenantId },
    );

    const otpauthUri = generateURI({
      issuer: this.deps.issuer,
      label: input.email,
      secret,
    });

    return { factorId, otpauthUri };
  }
}
