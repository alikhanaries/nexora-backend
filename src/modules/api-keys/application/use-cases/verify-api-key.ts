import { secureCompareHash } from '../../../../shared/security/index.js';
import { AuthenticationError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { hashApiKeySecret, parseApiKey } from '../../domain/api-key-secret.js';
import { intersectScopesWithPermissions } from '../../domain/api-key.js';
import type { ApiKeyRepository } from '../ports/api-key-repository.js';

export interface VerifyApiKeyInput {
  readonly rawKey: string;
}

export interface VerifiedApiKeyPrincipal {
  readonly apiKeyId: string;
  readonly tenantId: string;
  readonly scopes: readonly string[];
  readonly permissions: readonly string[];
}

export interface VerifyApiKeyDeps {
  readonly db: TransactionManager;
  readonly apiKeys: ApiKeyRepository;
}

export class VerifyApiKeyUseCase {
  constructor(private readonly deps: VerifyApiKeyDeps) {}

  async execute(input: VerifyApiKeyInput): Promise<VerifiedApiKeyPrincipal> {
    const parsed = parseApiKey(input.rawKey.trim());
    if (parsed === null) {
      throw new AuthenticationError();
    }

    const candidateHash = hashApiKeySecret(parsed.secret);
    const now = new Date();

    const key = await this.deps.db.execute(async (tx) =>
      this.deps.apiKeys.findByPrefix(tx, parsed.prefix),
    );

    if (key === null) {
      throw new AuthenticationError();
    }

    if (key.status !== 'ACTIVE') {
      throw new AuthenticationError();
    }

    if (key.expiresAt !== null && key.expiresAt <= now) {
      throw new AuthenticationError();
    }

    if (!secureCompareHash(key.secretHash, candidateHash)) {
      throw new AuthenticationError();
    }

    await this.deps.db.execute(
      async (tx) => {
        await this.deps.apiKeys.touchLastUsed(tx, key.id, now);
      },
      { tenantId: key.tenantId },
    );

    const permissions = intersectScopesWithPermissions(key.scopes, key.scopes);

    return {
      apiKeyId: key.id,
      tenantId: key.tenantId,
      scopes: key.scopes,
      permissions,
    };
  }
}
