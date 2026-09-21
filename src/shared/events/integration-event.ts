/**
 * Durable, versioned fact published for consumption outside the writing
 * transaction (other modules, webhooks, external systems).
 *
 * Events are written to the outbox inside the business transaction and
 * published afterwards - see ADR-005. Delivery is AT-LEAST-ONCE.
 */
export interface IntegrationEvent {
  /** Stable identity used for consumer deduplication. */
  readonly id: string;
  /** Namespaced type, e.g. `orders.order_created`. */
  readonly type: string;
  /** Incremented on breaking payload changes; consumers branch on it. */
  readonly version: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  /** Null for platform-level events that belong to no tenant. */
  readonly tenantId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  /** Correlates the event with the request or job that produced it. */
  readonly correlationId: string | null;
}

/** An event being recorded, before the store assigns storage metadata. */
export interface NewIntegrationEvent {
  readonly id?: string | undefined;
  readonly type: string;
  readonly version: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly tenantId?: string | null | undefined;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt?: Date | undefined;
  readonly correlationId?: string | null | undefined;
}
