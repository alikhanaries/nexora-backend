import { randomBytes } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthorizationError, NotFoundError } from '../../../../shared/errors/index.js';
import { hashSecret } from '../../../../shared/security/index.js';
const RECOVERY_CODE_COUNT = 10;
/** Generates plaintext recovery codes and hashed storage form. */
function generateRecoveryCodes() {
    const plaintext = [];
    const hashes = [];
    for (let index = 0; index < RECOVERY_CODE_COUNT; index += 1) {
        const code = randomBytes(5).toString('hex');
        plaintext.push(code);
        hashes.push(hashSecret(code));
    }
    return { plaintext, hashes };
}
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createActivateTotpFactor(deps) {
    return {
        /** Activates verified PENDING factor, rotates recovery codes. Authz: `mfa.manage`. */
        async execute(input) {
            if (!input.actorPermissions.includes('mfa.manage')) {
                throw new AuthorizationError('Missing required permission: mfa.manage');
            }
            const now = new Date();
            const { plaintext, hashes } = generateRecoveryCodes();
            await deps.db.execute(async (tx) => {
                const factor = await deps.mfaFactors.findById(tx, input.factorId);
                if (factor === null || factor.userId !== input.userId || factor.status !== 'PENDING') {
                    throw new NotFoundError('MFA factor was not found');
                }
                await deps.mfaFactors.revokeAllForUser(tx, input.userId, input.tenantId, now);
                await deps.mfaFactors.activate(tx, factor.id, now);
                await deps.recoveryCodes.revokeAllForUser(tx, input.userId, input.tenantId);
                await deps.recoveryCodes.createBatch(tx, {
                    userId: input.userId,
                    tenantId: input.tenantId,
                    codeHashes: hashes,
                });
                await deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: 'user',
                    actorId: input.userId,
                    eventType: 'MFA_ENABLED',
                    resourceType: 'mfa_factor',
                    resourceId: factor.id,
                    ...auditRequestFields(),
                });
            }, { tenantId: input.tenantId });
            return { activated: true, recoveryCodes: plaintext };
        },
    };
}
