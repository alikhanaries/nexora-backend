/**
 * Health / readiness: HTTP surface is Nest-only under `controllers/nest`.
 * Composition root imports `HealthModule` directly; this factory keeps domain module index parity.
 */
/**
 * @returns {Record<string, never>} Empty object — no programmatic deps; routes are Nest-registered.
 */
export function createHealthModule() {
  return {};
}
