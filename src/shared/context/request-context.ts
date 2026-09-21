import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Who is making the request.
 *
 * Phase 1 never populates this: authentication and tenant resolution arrive in
 * Phase 2. The shape exists now so that adding auth middleware later does not
 * require changing every use-case signature.
 */
export interface Principal {
  readonly kind: 'user' | 'api-key' | 'system';
  readonly id: string;
  readonly tenantId: string;
  readonly permissions: readonly string[];
}

export interface RequestContext {
  readonly requestId: string;
  readonly traceId: string | undefined;
  readonly tenantId: string | undefined;
  readonly userId: string | undefined;
  readonly principal: Principal | undefined;
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
  readonly startedAt: number;
}

/** Fields later middleware is allowed to add once identity is known. */
export interface RequestContextEnrichment {
  readonly traceId?: string | undefined;
  readonly tenantId?: string | undefined;
  readonly userId?: string | undefined;
  readonly principal?: Principal | undefined;
}

/**
 * Holds the current context for one async execution tree.
 *
 * The holder is mutable, but it is confined to a single AsyncLocalStorage
 * scope, so this is scoped state rather than shared global state: concurrent
 * requests can never observe each other's values.
 */
interface ContextHolder {
  context: RequestContext;
}

const storage = new AsyncLocalStorage<ContextHolder>();

export interface NewRequestContext {
  readonly requestId: string;
  readonly traceId?: string | undefined;
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly startedAt?: number | undefined;
}

export function createRequestContext(input: NewRequestContext): RequestContext {
  return {
    requestId: input.requestId,
    traceId: input.traceId,
    tenantId: undefined,
    userId: undefined,
    principal: undefined,
    ip: input.ip,
    userAgent: input.userAgent,
    startedAt: input.startedAt ?? Date.now(),
  };
}

/** Runs `fn` with `context` visible to every awaited call inside it. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run({ context }, fn);
}

/**
 * Binds `context` to the current async execution tree.
 *
 * Used by HTTP middleware: the hook returns before route handlers run, so
 * `run()` would end the scope too early. `enterWith` keeps the context for all
 * subsequent async work on this request.
 */
export function enterRequestContext(context: RequestContext): void {
  storage.enterWith({ context });
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()?.context;
}

/**
 * Adds identity information to the active context.
 *
 * Returns `false` when called outside a request scope (for example from a
 * background job) so callers can decide whether that is a problem.
 */
export function enrichRequestContext(enrichment: RequestContextEnrichment): boolean {
  const holder = storage.getStore();
  if (holder === undefined) return false;

  holder.context = {
    ...holder.context,
    ...(enrichment.traceId === undefined ? {} : { traceId: enrichment.traceId }),
    ...(enrichment.tenantId === undefined ? {} : { tenantId: enrichment.tenantId }),
    ...(enrichment.userId === undefined ? {} : { userId: enrichment.userId }),
    ...(enrichment.principal === undefined ? {} : { principal: enrichment.principal }),
  };
  return true;
}

/** Log fields derived from the active context; empty when there is none. */
export function currentContextLogFields(): Record<string, string> {
  const context = getRequestContext();
  if (context === undefined) return {};

  return {
    requestId: context.requestId,
    ...(context.traceId === undefined ? {} : { traceId: context.traceId }),
    ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    ...(context.userId === undefined ? {} : { userId: context.userId }),
  };
}
