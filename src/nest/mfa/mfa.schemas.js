import { z } from 'zod';

export const mfaCodeBodySchema = z.object({
  code: z.string().min(6).max(16),
});

export const startTotpBodySchema = z.object({
  label: z.string().max(64).optional(),
});

export const verifyTotpEnrollmentBodySchema = mfaCodeBodySchema.extend({
  factorId: z.string().uuid(),
});

export const activateTotpBodySchema = z.object({
  factorId: z.string().uuid(),
});
