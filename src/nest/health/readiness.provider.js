import { ReadinessService } from '../../app/observability/readiness.js';

export const NEST_READINESS = Symbol('NEST_READINESS');

/**
 * Phase 2: process-only readiness (no Postgres/Redis/queue connections).
 * Phase 3+ will register the same probes as the Fastify server.
 */
export function createNestPhase2Readiness() {
  return new ReadinessService([]);
}
