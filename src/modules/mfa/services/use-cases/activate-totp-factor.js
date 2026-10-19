import { randomBytes } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthorizationError, NotFoundError } from '../../../../shared/errors/index.js';
import { hashSecret } from '../../../../shared/security/index.js';
const RECOVERY_CODE_COUNT = 10;
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
export class ActivateTotpFactorUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (!input.actorPermissions.includes('mfa.manage')) {
            throw new AuthorizationError('Missing required permission: mfa.manage');
        }
        const now = new Date();
        const { plaintext, hashes } = generateRecoveryCodes();
        await this.deps.db.execute(async (tx) => {
            const factor = await this.deps.mfaFactors.findById(tx, input.factorId);
            if (factor === null || factor.userId !== input.userId || factor.status !== 'PENDING') {
                throw new NotFoundError('MFA factor was not found');
            }
            await this.deps.mfaFactors.revokeAllForUser(tx, input.userId, input.tenantId, now);
            await this.deps.mfaFactors.activate(tx, factor.id, now);
            await this.deps.recoveryCodes.revokeAllForUser(tx, input.userId, input.tenantId);
            await this.deps.recoveryCodes.createBatch(tx, {
                userId: input.userId,
                tenantId: input.tenantId,
                codeHashes: hashes,
            });
            await this.deps.auditRecorder?.record(tx, {
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
    }
}
