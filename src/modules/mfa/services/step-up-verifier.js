import { randomUUID } from 'node:crypto';
/**
 * Step-up session recording and verification.
 * @param {{ db: object, stepUpSessions: object, stepUpTtlSeconds: number }} deps
 * @returns {{ hasValidStepUp: Function, recordStepUp: Function }}
 */
export function createStepUpService(deps) {
    return {
        async hasValidStepUp(context) {
            const now = new Date();
            return deps.db.execute(async (tx) => deps.stepUpSessions.findValid(tx, {
                userId: context.userId,
                tenantId: context.tenantId,
                sessionId: context.sessionId,
                now,
            }), { tenantId: context.tenantId });
        },
        async recordStepUp(context) {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + deps.stepUpTtlSeconds * 1_000);
            await deps.db.execute(async (tx) => {
                await deps.stepUpSessions.upsert(tx, {
                    id: randomUUID(),
                    userId: context.userId,
                    tenantId: context.tenantId,
                    sessionId: context.sessionId,
                    verifiedAt: now,
                    expiresAt,
                });
            }, { tenantId: context.tenantId });
        },
    };
}
