import { z } from 'zod';

export const loginBodySchema = z.object({
    tenantSlug: z.string().min(1).max(64),
    email: z.string().email().max(320),
    password: z.string().min(1).max(128),
});

export const refreshBodySchema = z.object({
    refreshToken: z.string().min(1).max(256),
});

export const logoutBodySchema = z.object({
    refreshToken: z.string().min(1).max(256),
});
