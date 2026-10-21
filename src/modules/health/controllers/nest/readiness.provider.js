/**
 * DI token for the Nest readiness evaluator injected into HealthController.
 * Bound at app bootstrap; implements dependency checks for `/health/ready`.
 */
export const NEST_READINESS = Symbol('NEST_READINESS');
