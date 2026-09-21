import type { Transaction } from '../../../shared/persistence/index.js';
import type { StepUpSessionRepository } from '../application/ports/step-up-session-repository.js';

export class PostgresStepUpSessionRepository implements StepUpSessionRepository {
  async upsert(
    tx: Transaction,
    input: {
      readonly id: string;
      readonly userId: string;
      readonly tenantId: string;
      readonly sessionId: string;
      readonly verifiedAt: Date;
      readonly expiresAt: Date;
    },
  ): Promise<void> {
    await tx.query(
      `INSERT INTO step_up_sessions (id, user_id, tenant_id, session_id, verified_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, tenant_id, session_id)
       DO UPDATE SET verified_at = EXCLUDED.verified_at, expires_at = EXCLUDED.expires_at`,
      [input.id, input.userId, input.tenantId, input.sessionId, input.verifiedAt, input.expiresAt],
      { operation: 'step_up_sessions.upsert' },
    );
  }

  async findValid(
    tx: Transaction,
    input: {
      readonly userId: string;
      readonly tenantId: string;
      readonly sessionId: string;
      readonly now: Date;
    },
  ): Promise<boolean> {
    const result = await tx.query(
      `SELECT 1 FROM step_up_sessions
       WHERE user_id = $1 AND tenant_id = $2 AND session_id = $3
         AND expires_at > $4
       LIMIT 1`,
      [input.userId, input.tenantId, input.sessionId, input.now],
      { operation: 'step_up_sessions.find_valid' },
    );
    return result.rowCount > 0;
  }
}
