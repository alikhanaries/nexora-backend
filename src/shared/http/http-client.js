/**
 * Outbound HTTP port.
 *
 * Every call to a third party goes through this interface so timeouts,
 * redacted logging, error normalisation and trace propagation are applied
 * uniformly. Calling `fetch` directly from a module is a boundary violation.
 *
 * Phase 1 implements timeout, logging, error normalisation and trace
 * propagation only. Retry, circuit breaking and provider-side rate limiting
 * are deliberately absent: they need per-provider policy that does not exist
 * yet, and blind retries amplify outages.
 */
export {};
