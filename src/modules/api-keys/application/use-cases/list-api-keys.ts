import { AuthorizationError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { ApiKeySummary } from '../../domain/api-key.js';
import type { ApiKeyRepository } from '../ports/api-key-repository.js';

export interface ListApiKeysInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
}

export interface ListApiKeysDeps {
  readonly db: TransactionManager;
  readonly apiKeys: ApiKeyRepository;
}

export class ListApiKeysUseCase {
  constructor(private readonly deps: ListApiKeysDeps) {}

  async execute(input: ListApiKeysInput): Promise<readonly ApiKeySummary[]> {
    if (!input.actorPermissions.includes('api_keys.read')) {
      throw new AuthorizationError('Missing required permission: api_keys.read');
    }

    return this.deps.db.execute(async (tx) => this.deps.apiKeys.listByTenant(tx, input.tenantId), {
      tenantId: input.tenantId,
    });
  }
}
