import { randomUUID } from 'node:crypto';
export class StepUpService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async hasValidStepUp(context) {
        const now = new Date();
        return this.deps.db.execute(async (tx) => this.deps.stepUpSessions.findValid(tx, {
            userId: context.userId,
            tenantId: context.tenantId,
            sessionId: context.sessionId,
            now,
        }), { tenantId: context.tenantId });
    }
    async recordStepUp(context) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.deps.stepUpTtlSeconds * 1_000);
        await this.deps.db.execute(async (tx) => {
            await this.deps.stepUpSessions.upsert(tx, {
                id: randomUUID(),
                userId: context.userId,
                tenantId: context.tenantId,
                sessionId: context.sessionId,
                verifiedAt: now,
                expiresAt,
            });
        }, { tenantId: context.tenantId });
    }
}
