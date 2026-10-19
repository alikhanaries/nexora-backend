import { redactDeep } from '../../../shared/logging/redaction.js';
/** Redacts secrets from audit metadata before persistence. */
export function redactAuditMetadata(metadata) {
    if (metadata === undefined || Object.keys(metadata).length === 0) {
        return {};
    }
    return redactDeep(metadata);
}
