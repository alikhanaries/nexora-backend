import { randomUUID } from 'node:crypto';
import { generateSecret, generateURI } from 'otplib';
import { AuthorizationError, ConflictError } from '../../../../shared/errors/index.js';
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createStartTotpEnrollment(deps) {
    return {
        async execute(input) {
            if (!input.actorPermissions.includes('mfa.manage')) {
                throw new AuthorizationError('Missing required permission: mfa.manage');
            }
            const secret = generateSecret();
            const factorId = randomUUID();
            const label = input.label?.trim() || 'Authenticator';
            const encrypted = deps.secretEncryptor.encrypt(secret);
            await deps.db.execute(async (tx) => {
                const existing = await deps.mfaFactors.findActiveByUser(tx, input.userId, input.tenantId);
                if (existing !== null) {
                    throw new ConflictError('An active MFA factor already exists');
                }
                await deps.mfaFactors.createPending(tx, {
                    id: factorId,
                    userId: input.userId,
                    tenantId: input.tenantId,
                    secretEncrypted: encrypted,
                    label,
                });
            }, { tenantId: input.tenantId });
            const otpauthUri = generateURI({
                issuer: deps.issuer,
                label: input.email,
                secret,
            });
            return { factorId, otpauthUri };
        },
    };
}
