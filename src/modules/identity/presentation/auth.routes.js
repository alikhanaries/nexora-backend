import { z } from 'zod';
import { AuthenticationError } from '../../../shared/errors/index.js';
const loginBodySchema = z.object({
    tenantSlug: z.string().min(1).max(64),
    email: z.string().email().max(320),
    password: z.string().min(1).max(128),
});
const refreshBodySchema = z.object({
    refreshToken: z.string().min(1).max(256),
});
const logoutBodySchema = z.object({
    refreshToken: z.string().min(1).max(256),
});
const tokenResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        accessToken: z.string(),
        refreshToken: z.string(),
        expiresIn: z.number().int(),
    }),
});
const meResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        id: z.string().uuid(),
        email: z.string(),
        status: z.string(),
        tenantId: z.string().uuid(),
        membershipStatus: z.string(),
    }),
});
function readBearerToken(authorization) {
    if (authorization === undefined) {
        throw new AuthenticationError();
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (match?.[1] === undefined) {
        throw new AuthenticationError();
    }
    return match[1];
}
export function createAuthRoutes(deps) {
    const authRoutes = async (app) => {
        const typed = app.withTypeProvider();
        typed.post('/api/v1/auth/login', {
            schema: {
                tags: ['Auth'],
                summary: 'Authenticate with tenant slug, email and password',
                body: loginBodySchema,
                response: { 200: tokenResponseSchema },
            },
        }, async (request) => {
            const result = await deps.login.execute(request.body);
            return { success: true, data: result };
        });
        typed.post('/api/v1/auth/refresh', {
            schema: {
                tags: ['Auth'],
                summary: 'Rotate refresh token and issue a new access token',
                body: refreshBodySchema,
                response: { 200: tokenResponseSchema },
            },
        }, async (request) => {
            const result = await deps.refreshToken.execute(request.body);
            return { success: true, data: result };
        });
        typed.post('/api/v1/auth/logout', {
            schema: {
                tags: ['Auth'],
                summary: 'Revoke the current refresh session',
                body: logoutBodySchema,
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z.object({ loggedOut: z.literal(true) }),
                    }),
                },
            },
        }, async (request) => {
            await deps.logout.execute(request.body);
            return { success: true, data: { loggedOut: true } };
        });
        typed.get('/api/v1/auth/me', {
            schema: {
                tags: ['Auth'],
                summary: 'Return the authenticated user for the current access token',
                response: { 200: meResponseSchema },
            },
        }, async (request) => {
            const accessToken = readBearerToken(request.headers.authorization);
            const result = await deps.getCurrentUser.execute({ accessToken });
            return { success: true, data: result };
        });
        await Promise.resolve();
    };
    return authRoutes;
}
