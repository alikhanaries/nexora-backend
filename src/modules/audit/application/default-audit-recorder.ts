import type { Transaction } from '../../../shared/persistence/index.js';
import type { AuditRecorder } from './audit-recorder.js';
import type { AuditRepository } from './audit-service.js';
import type { AuditEventDraft } from '../domain/audit-event.js';

export class DefaultAuditRecorder implements AuditRecorder {
  constructor(private readonly repository: AuditRepository) {}

  async record(tx: Transaction, event: AuditEventDraft): Promise<void> {
    await this.repository.insert(tx, event);
  }
}
