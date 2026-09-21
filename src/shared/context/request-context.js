import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
export function createRequestContext(input) {
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
export function runWithRequestContext(context, fn) {
    return storage.run({ context }, fn);
}
/**
 * Binds `context` to the current async execution tree.
 *
 * Used by HTTP middleware: the hook returns before route handlers run, so
 * `run()` would end the scope too early. `enterWith` keeps the context for all
 * subsequent async work on this request.
 */
export function enterRequestContext(context) {
    storage.enterWith({ context });
}
export function getRequestContext() {
    return storage.getStore()?.context;
}
/**
 * Adds identity information to the active context.
 *
 * Returns `false` when called outside a request scope (for example from a
 * background job) so callers can decide whether that is a problem.
 */
export function enrichRequestContext(enrichment) {
    const holder = storage.getStore();
    if (holder === undefined)
        return false;
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
export function currentContextLogFields() {
    const context = getRequestContext();
    if (context === undefined)
        return {};
    return {
        requestId: context.requestId,
        ...(context.traceId === undefined ? {} : { traceId: context.traceId }),
        ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
        ...(context.userId === undefined ? {} : { userId: context.userId }),
    };
}
