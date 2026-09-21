import type {
  Queryable,
  Transaction,
  TransactionManager,
} from '../../../shared/persistence/index.js';
import type { AuditEvent, AuditEventDraft, AuditEventType } from '../domain/audit-event.js';

export interface ListAuditEventsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly eventType?: AuditEventType;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAuditEventsResult {
  readonly events: readonly AuditEvent[];
  readonly total: number;
}

export interface AuditRepository {
  insert(tx: Transaction, event: AuditEventDraft): Promise<void>;
  list(
    tx: Transaction,
    input: Omit<ListAuditEventsInput, 'actorPermissions'>,
  ): Promise<ListAuditEventsResult>;
}

export interface AuditServiceDependencies {
  readonly repository: AuditRepository;
  readonly database: Queryable & TransactionManager;
  readonly requirePermission: (granted: readonly string[], required: string) => void;
}

export class AuditService {
  constructor(private readonly deps: AuditServiceDependencies) {}

  async listEvents(input: ListAuditEventsInput): Promise<ListAuditEventsResult> {
    this.deps.requirePermission(input.actorPermissions, 'audit.read');

    return this.deps.database.execute(
      async (tx) =>
        this.deps.repository.list(tx, {
          tenantId: input.tenantId,
          ...(input.eventType === undefined ? {} : { eventType: input.eventType }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.offset === undefined ? {} : { offset: input.offset }),
        }),
      { tenantId: input.tenantId },
    );
  }
}
