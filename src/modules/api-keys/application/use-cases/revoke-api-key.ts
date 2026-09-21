import type { AuditRecorder } from '../../../audit/public/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { ApiKeyRepository } from '../ports/api-key-repository.js';

export interface RevokeApiKeyInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorPermissions: readonly string[];
  readonly apiKeyId: string;
}

export interface RevokeApiKeyDeps {
  readonly db: TransactionManager;
  readonly apiKeys: ApiKeyRepository;
  readonly auditRecorder?: AuditRecorder;
}

export class RevokeApiKeyUseCase {
  constructor(private readonly deps: RevokeApiKeyDeps) {}

  async execute(input: RevokeApiKeyInput): Promise<{ revoked: true }> {
    if (!input.actorPermissions.includes('api_keys.manage')) {
      throw new AuthorizationError('Missing required permission: api_keys.manage');
    }

    const now = new Date();
    await this.deps.db.execute(
      async (tx) => {
        const existing = await this.deps.apiKeys.findById(tx, input.apiKeyId);
        if (existing === null || existing.tenantId !== input.tenantId) {
          throw new NotFoundError('API key was not found');
        }
        if (existing.status !== 'ACTIVE') {
          throw new ValidationError('API key is not active');
        }

        await this.deps.apiKeys.revoke(tx, existing.id, now);

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: 'user',
          actorId: input.actorId,
          eventType: 'API_KEY_REVOKED',
          resourceType: 'api_key',
          resourceId: existing.id,
          metadata: { prefix: existing.prefix },
          ...auditRequestFields(),
        });
      },
      { tenantId: input.tenantId },
    );

    return { revoked: true };
  }
}
