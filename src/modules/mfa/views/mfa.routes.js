import { z } from 'zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { AuthenticationError } from '../../../shared/errors/index.js';
const codeBodySchema = z.object({
    code: z.string().min(6).max(16),
});
const mfaRoutes = async (app, options) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/mfa/totp/start', {
        schema: {
            tags: ['MFA'],
            summary: 'Start TOTP enrollment',
            body: z.object({ label: z.string().max(64).optional() }),
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.object({
                        factorId: z.string().uuid(),
                        otpauthUri: z.string(),
                    }),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        if (actor.userId === undefined || actor.email === undefined) {
            throw new AuthenticationError('User session is required');
        }
        const result = await options.startTotpEnrollment.execute({
            tenantId: actor.tenantId,
            userId: actor.userId,
            actorPermissions: actor.permissions,
            email: actor.email,
            ...(request.body?.label === undefined ? {} : { label: request.body.label }),
        });
        return { success: true, data: result };
    });
    typed.post('/api/v1/mfa/totp/verify', {
        schema: {
            tags: ['MFA'],
            summary: 'Verify TOTP code during enrollment',
            body: codeBodySchema.extend({ factorId: z.string().uuid() }),
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.object({ verified: z.literal(true) }),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        if (actor.userId === undefined) {
            throw new AuthenticationError('User session is required');
        }
        const result = await options.verifyTotpEnrollment.execute({
            tenantId: actor.tenantId,
            userId: actor.userId,
            actorPermissions: actor.permissions,
            factorId: request.body.factorId,
            code: request.body.code,
        });
        return { success: true, data: result };
    });
    typed.post('/api/v1/mfa/totp/activate', {
        schema: {
            tags: ['MFA'],
            summary: 'Activate TOTP factor and receive recovery codes',
            body: z.object({ factorId: z.string().uuid() }),
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.object({
                        activated: z.literal(true),
                        recoveryCodes: z.array(z.string()),
                    }),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        if (actor.userId === undefined) {
            throw new AuthenticationError('User session is required');
        }
        const result = await options.activateTotpFactor.execute({
            tenantId: actor.tenantId,
            userId: actor.userId,
            actorPermissions: actor.permissions,
            factorId: request.body.factorId,
        });
        return {
            success: true,
            data: {
                activated: true,
                recoveryCodes: [...result.recoveryCodes],
            },
        };
    });
    typed.post('/api/v1/mfa/verify', {
        schema: {
            tags: ['MFA'],
            summary: 'Verify MFA for step-up authentication',
            body: codeBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.object({ stepUpVerified: z.literal(true) }),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        if (actor.userId === undefined || actor.sessionId === undefined) {
            throw new AuthenticationError('User session is required');
        }
        const result = await options.verifyMfa.execute({
            tenantId: actor.tenantId,
            userId: actor.userId,
            sessionId: actor.sessionId,
            code: request.body.code,
        });
        return { success: true, data: result };
    });
    typed.post('/api/v1/mfa/recovery-code/use', {
        schema: {
            tags: ['MFA'],
            summary: 'Use a one-time recovery code for step-up',
            body: codeBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.object({ stepUpVerified: z.literal(true) }),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        if (actor.userId === undefined || actor.sessionId === undefined) {
            throw new AuthenticationError('User session is required');
        }
        const result = await options.useRecoveryCode.execute({
            tenantId: actor.tenantId,
            userId: actor.userId,
            sessionId: actor.sessionId,
            code: request.body.code,
        });
        return { success: true, data: result };
    });
    await Promise.resolve();
};
export default mfaRoutes;
