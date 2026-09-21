import { randomUUID } from 'node:crypto';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { StepUpSessionRepository } from './ports/step-up-session-repository.js';

export interface StepUpContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
}

export interface StepUpVerifier {
  hasValidStepUp(context: StepUpContext): Promise<boolean>;
}

export interface StepUpServiceDeps {
  readonly db: TransactionManager;
  readonly stepUpSessions: StepUpSessionRepository;
  readonly stepUpTtlSeconds: number;
}

export class StepUpService implements StepUpVerifier {
  constructor(private readonly deps: StepUpServiceDeps) {}

  async hasValidStepUp(context: StepUpContext): Promise<boolean> {
    const now = new Date();
    return this.deps.db.execute(
      async (tx) =>
        this.deps.stepUpSessions.findValid(tx, {
          userId: context.userId,
          tenantId: context.tenantId,
          sessionId: context.sessionId,
          now,
        }),
      { tenantId: context.tenantId },
    );
  }

  async recordStepUp(context: StepUpContext): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.deps.stepUpTtlSeconds * 1_000);

    await this.deps.db.execute(
      async (tx) => {
        await this.deps.stepUpSessions.upsert(tx, {
          id: randomUUID(),
          userId: context.userId,
          tenantId: context.tenantId,
          sessionId: context.sessionId,
          verifiedAt: now,
          expiresAt,
        });
      },
      { tenantId: context.tenantId },
    );
  }
}
