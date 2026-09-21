import { randomUUID } from 'node:crypto';
import type { AuditRecorder } from '../../../audit/public/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import {
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../../../shared/errors/index.js';
import type { RateLimitService } from '../../../../shared/rate-limit/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import {
  formatApiKey,
  generateApiKeySecret,
  hashApiKeySecret,
} from '../../domain/api-key-secret.js';
import type { ApiKeyRepository } from '../ports/api-key-repository.js';
import type { StepUpVerifier } from '../../../mfa/public/index.js';

export interface RotateApiKeyInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorPermissions: readonly string[];
  readonly sessionId?: string;
  readonly apiKeyId: string;
}

export interface RotateApiKeyResult {
  readonly id: string;
  readonly prefix: string;
  readonly secret: string;
  readonly rotatedFromId: string;
}

export interface RotateApiKeyDeps {
  readonly db: TransactionManager;
  readonly apiKeys: ApiKeyRepository;
  readonly stepUpVerifier: StepUpVerifier;
  readonly rateLimiter: RateLimitService;
  readonly auditRecorder?: AuditRecorder;
}

export class RotateApiKeyUseCase {
  constructor(private readonly deps: RotateApiKeyDeps) {}

  async execute(input: RotateApiKeyInput): Promise<RotateApiKeyResult> {
    if (!input.actorPermissions.includes('api_keys.manage')) {
      throw new AuthorizationError('Missing required permission: api_keys.manage');
    }

    if (input.sessionId === undefined) {
      throw new ValidationError('Step-up authentication is required to rotate API keys');
    }

    const hasStepUp = await this.deps.stepUpVerifier.hasValidStepUp({
      userId: input.actorId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
    });
    if (!hasStepUp) {
      throw new AuthorizationError('Recent step-up authentication is required');
    }

    const rateLimit = await this.deps.rateLimiter.consume({
      policy: AUTH_RATE_LIMIT_POLICIES.apiKeyRotate,
      subject: `${input.tenantId}:${input.actorId}`,
    });
    if (!rateLimit.allowed) {
      throw new RateLimitError(rateLimit.retryAfterSeconds);
    }

    const secret = generateApiKeySecret();
    const secretHash = hashApiKeySecret(secret);
    const newId = randomUUID();
    const now = new Date();
    const result = await this.deps.db.execute(
      async (tx) => {
        const existing = await this.deps.apiKeys.findById(tx, input.apiKeyId);
        if (existing === null || existing.tenantId !== input.tenantId) {
          throw new NotFoundError('API key was not found');
        }
        if (existing.status !== 'ACTIVE') {
          throw new ValidationError('Only active API keys can be rotated');
        }

        await this.deps.apiKeys.markRotated(tx, existing.id, now);

        const replacement = await this.deps.apiKeys.create(tx, {
          id: newId,
          tenantId: existing.tenantId,
          name: existing.name,
          prefix: existing.prefix,
          secretHash,
          keyType: existing.keyType,
          scopes: existing.scopes,
          expiresAt: existing.expiresAt,
          rotatedFromId: existing.id,
        });

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: 'user',
          actorId: input.actorId,
          eventType: 'API_KEY_ROTATED',
          resourceType: 'api_key',
          resourceId: replacement.id,
          metadata: { rotatedFromId: existing.id, prefix: existing.prefix },
          ...auditRequestFields(),
        });

        return { replacement, prefix: existing.prefix, rotatedFromId: existing.id };
      },
      { tenantId: input.tenantId },
    );

    return {
      id: result.replacement.id,
      prefix: result.prefix,
      secret: formatApiKey(result.prefix, secret),
      rotatedFromId: result.rotatedFromId,
    };
  }
}
