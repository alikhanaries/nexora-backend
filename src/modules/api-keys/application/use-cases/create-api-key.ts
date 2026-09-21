import { randomUUID } from 'node:crypto';
import type { AuditRecorder } from '../../../audit/public/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import { RateLimitError, ValidationError } from '../../../../shared/errors/index.js';
import type { RateLimitService } from '../../../../shared/rate-limit/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import {
  formatApiKey,
  generateApiKeyPrefix,
  generateApiKeySecret,
  hashApiKeySecret,
} from '../../domain/api-key-secret.js';
import { intersectScopesWithPermissions } from '../../domain/api-key.js';
import type { ApiKeyRepository } from '../ports/api-key-repository.js';
import type { ApiKeyType } from '../../domain/api-key.js';

export interface CreateApiKeyInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorPermissions: readonly string[];
  readonly name: string;
  readonly scopes: readonly string[];
  readonly keyType?: ApiKeyType;
  readonly expiresAt?: Date | null;
}

export interface CreateApiKeyResult {
  readonly id: string;
  readonly prefix: string;
  readonly secret: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly keyType: ApiKeyType;
  readonly expiresAt: Date | null;
}

export interface CreateApiKeyDeps {
  readonly db: TransactionManager;
  readonly apiKeys: ApiKeyRepository;
  readonly rateLimiter: RateLimitService;
  readonly auditRecorder?: AuditRecorder;
}

export class CreateApiKeyUseCase {
  constructor(private readonly deps: CreateApiKeyDeps) {}

  async execute(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('API key name is required');
    }
    if (input.scopes.length === 0) {
      throw new ValidationError('At least one scope is required');
    }

    const allowedScopes = intersectScopesWithPermissions(input.scopes, input.actorPermissions);
    if (allowedScopes.length !== input.scopes.length) {
      throw new ValidationError('One or more scopes exceed the caller permissions');
    }

    const rateLimit = await this.deps.rateLimiter.consume({
      policy: AUTH_RATE_LIMIT_POLICIES.apiKeyCreate,
      subject: `${input.tenantId}:${input.actorId}`,
    });
    if (!rateLimit.allowed) {
      throw new RateLimitError(rateLimit.retryAfterSeconds);
    }

    const prefix = generateApiKeyPrefix();
    const secret = generateApiKeySecret();
    const secretHash = hashApiKeySecret(secret);
    const id = randomUUID();
    const summary = await this.deps.db.execute(
      async (tx) => {
        const created = await this.deps.apiKeys.create(tx, {
          id,
          tenantId: input.tenantId,
          name,
          prefix,
          secretHash,
          keyType: input.keyType ?? 'STANDARD',
          scopes: allowedScopes,
          expiresAt: input.expiresAt ?? null,
        });

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: 'user',
          actorId: input.actorId,
          eventType: 'API_KEY_CREATED',
          resourceType: 'api_key',
          resourceId: created.id,
          metadata: { name, scopes: [...allowedScopes], prefix },
          ...auditRequestFields(),
        });

        return created;
      },
      { tenantId: input.tenantId },
    );

    return {
      id: summary.id,
      prefix: summary.prefix,
      secret: formatApiKey(prefix, secret),
      name: summary.name,
      scopes: summary.scopes,
      keyType: summary.keyType,
      expiresAt: summary.expiresAt,
    };
  }
}
