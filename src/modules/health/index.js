/**
 * Health / readiness HTTP surface is Nest-only under controllers/nest.
 * Composition root imports HealthModule directly; this factory keeps module index parity.
 */
export function createHealthModule() {
  return {};
}
