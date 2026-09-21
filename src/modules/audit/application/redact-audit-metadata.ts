import { redactDeep } from '../../../shared/logging/redaction.js';

/** Redacts secrets from audit metadata before persistence. */
export function redactAuditMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  if (metadata === undefined || Object.keys(metadata).length === 0) {
    return {};
  }
  return redactDeep(metadata) as Record<string, unknown>;
}
