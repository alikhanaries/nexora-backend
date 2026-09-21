import type { Transaction } from '../../../shared/persistence/index.js';
import type { AuditEventDraft } from '../domain/audit-event.js';

export interface AuditRecorder {
  record(tx: Transaction, event: AuditEventDraft): Promise<void>;
}

export const noopAuditRecorder: AuditRecorder = {
  record: () => Promise.resolve(),
};
