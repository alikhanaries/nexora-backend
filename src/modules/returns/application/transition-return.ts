import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Return } from '../domain/return.js';
import { ReturnStatus } from '../domain/return-status.js';
import type { ReturnRepository } from '../domain/return-repository.port.js';
import { toReturnDetailDto, type ReturnDetailDto } from './return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';

export interface TransitionReturnInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly returnId: string;
}

export interface TransitionReturnResult {
  readonly return: ReturnDetailDto;
}

export interface TransitionReturnDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly returns: ReturnRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

type TransitionFn = (returnEntity: Return, at: Date) => Return;

async function transitionReturn(
  deps: TransitionReturnDependencies,
  input: TransitionReturnInput,
  transition: TransitionFn,
  auditEventType: 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'RETURN_CANCELLED' | 'RETURN_COMPLETED',
): Promise<TransitionReturnResult> {
  requireReturnsUpdate(deps.authorization, input.actorPermissions);

  const returnDetail = await deps.database.execute(
    async (tx) => {
      const existing = await deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
      if (existing === null) {
        throw new NotFoundError('Return was not found', {
          tenantId: input.tenantId,
          returnId: input.returnId,
        });
      }

      const previousStatus = existing.status;
      const now = new Date();
      const updated = transition(existing, now);
      await deps.returns.updateReturn(tx, updated);

      const lines = await deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
      const detail = toReturnDetailDto(updated, lines);

      if (previousStatus !== updated.status) {
        await deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));

        await deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: auditEventType,
          resourceType: 'return',
          resourceId: updated.id,
          metadata: {
            orderId: updated.orderId,
            previousStatus,
            newStatus: updated.status,
          },
          ...auditRequestFields(),
        });
      }

      return detail;
    },
    { tenantId: input.tenantId },
  );

  return { return: returnDetail };
}

export class ApproveReturn {
  constructor(private readonly deps: TransitionReturnDependencies) {}

  execute(input: TransitionReturnInput): Promise<TransitionReturnResult> {
    return transitionReturn(
      this.deps,
      input,
      (returnEntity, at) => returnEntity.approve(at),
      'RETURN_APPROVED',
    );
  }
}

export class RejectReturn {
  constructor(private readonly deps: TransitionReturnDependencies) {}

  execute(input: TransitionReturnInput): Promise<TransitionReturnResult> {
    return transitionReturn(
      this.deps,
      input,
      (returnEntity, at) => returnEntity.reject(at),
      'RETURN_REJECTED',
    );
  }
}

export class CancelReturn {
  constructor(private readonly deps: TransitionReturnDependencies) {}

  execute(input: TransitionReturnInput): Promise<TransitionReturnResult> {
    return transitionReturn(
      this.deps,
      input,
      (returnEntity, at) => returnEntity.cancel(at),
      'RETURN_CANCELLED',
    );
  }
}

export class CompleteReturn {
  constructor(private readonly deps: TransitionReturnDependencies) {}

  async execute(input: TransitionReturnInput): Promise<TransitionReturnResult> {
    requireReturnsUpdate(this.deps.authorization, input.actorPermissions);

    const returnDetail = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
        if (existing === null) {
          throw new NotFoundError('Return was not found', {
            tenantId: input.tenantId,
            returnId: input.returnId,
          });
        }

        if (existing.status !== ReturnStatus.RECEIVED) {
          throw new BusinessRuleError('Return must be received before it can be completed', {
            returnId: input.returnId,
            status: existing.status,
          });
        }

        const previousStatus = existing.status;
        const now = new Date();
        const updated = existing.complete(now);
        await this.deps.returns.updateReturn(tx, updated);

        const lines = await this.deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
        const detail = toReturnDetailDto(updated, lines);

        await this.deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'RETURN_COMPLETED',
          resourceType: 'return',
          resourceId: updated.id,
          metadata: {
            orderId: updated.orderId,
            previousStatus,
            newStatus: updated.status,
          },
          ...auditRequestFields(),
        });

        return detail;
      },
      { tenantId: input.tenantId },
    );

    return { return: returnDetail };
  }
}
