import { describe, expect, it, vi } from 'vitest';
import { createMfaModule } from '../../../src/modules/mfa/index.js';
import { createStepUpService } from '../../../src/modules/mfa/services/step-up-verifier.js';
import { createActivateTotpFactor } from '../../../src/modules/mfa/services/use-cases/activate-totp-factor.js';
import { createStartTotpEnrollment } from '../../../src/modules/mfa/services/use-cases/start-totp-enrollment.js';
import { createUseRecoveryCode } from '../../../src/modules/mfa/services/use-cases/use-recovery-code.js';
import { createVerifyMfa } from '../../../src/modules/mfa/services/use-cases/verify-mfa.js';
import { createVerifyTotpEnrollment } from '../../../src/modules/mfa/services/use-cases/verify-totp-enrollment.js';
import { createPostgresMfaFactorRepository } from '../../../src/modules/mfa/repositories/postgres-mfa-factor-repository.js';
import { createPostgresRecoveryCodeRepository } from '../../../src/modules/mfa/repositories/postgres-recovery-code-repository.js';
import { createPostgresStepUpSessionRepository } from '../../../src/modules/mfa/repositories/postgres-step-up-session-repository.js';
import { createStepUpService as publicCreateStepUpService } from '../../../src/modules/mfa/public/index.js';
import { hashSecret } from '../../../src/shared/security/index.js';
import { AuthorizationError, RateLimitError, ValidationError } from '../../../src/shared/errors/index.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const FACTOR_ID = '33333333-3333-4333-8333-333333333333';

function createDb(tx = { query: vi.fn() }) {
    return { tx, execute: vi.fn(async (fn) => fn(tx)) };
}

describe('mfa repositories (factories)', () => {
    it('mfa factor repository exposes the expected methods and SQL operations', async () => {
        const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
        const repository = createPostgresMfaFactorRepository();
        expect(Object.keys(repository).sort()).toEqual([
            'activate',
            'createPending',
            'findActiveByUser',
            'findById',
            'revokeAllForUser',
            'updateStatus',
        ]);

        expect(await repository.findById({ query }, FACTOR_ID)).toBeNull();
        expect(await repository.findActiveByUser({ query }, USER_ID, TENANT_ID)).toBeNull();
        await repository.activate({ query }, FACTOR_ID, new Date());
        await repository.revokeAllForUser({ query }, USER_ID, TENANT_ID, new Date());
        await repository.updateStatus({ query }, FACTOR_ID, 'REVOKED');

        expect(query.mock.calls.map((call) => call[2].operation)).toEqual([
            'mfa_factors.find_by_id',
            'mfa_factors.find_active',
            'mfa_factors.activate',
            'mfa_factors.revoke_active',
            'mfa_factors.update_status',
        ]);
    });

    it('maps a pending factor row on create', async () => {
        const now = new Date();
        const query = vi.fn().mockResolvedValue({
            rows: [
                {
                    id: FACTOR_ID,
                    user_id: USER_ID,
                    tenant_id: TENANT_ID,
                    factor_type: 'TOTP',
                    status: 'PENDING',
                    secret_encrypted: 'enc',
                    label: 'Authenticator',
                    created_at: now,
                    updated_at: now,
                    activated_at: null,
                    revoked_at: null,
                },
            ],
        });
        const created = await createPostgresMfaFactorRepository().createPending(
            { query },
            { id: FACTOR_ID, userId: USER_ID, tenantId: TENANT_ID, secretEncrypted: 'enc', label: 'Authenticator' },
        );
        expect(created).toMatchObject({ id: FACTOR_ID, userId: USER_ID, status: 'PENDING', activatedAt: null });
    });

    it('recovery code repository inserts one row per hash and maps lookups', async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', user_id: USER_ID, tenant_id: TENANT_ID }] });
        const repository = createPostgresRecoveryCodeRepository();
        expect(Object.keys(repository).sort()).toEqual([
            'createBatch',
            'findActiveByHash',
            'markUsed',
            'revokeAllForUser',
        ]);

        await repository.createBatch({ query }, { userId: USER_ID, tenantId: TENANT_ID, codeHashes: ['a', 'b'] });
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0][2]).toEqual({ operation: 'recovery_codes.create' });

        expect(await repository.findActiveByHash({ query }, 'missing')).toBeNull();
        expect(await repository.findActiveByHash({ query }, 'hash')).toEqual({
            id: 'r1',
            userId: USER_ID,
            tenantId: TENANT_ID,
        });
    });

    it('step-up session repository upserts and checks validity via rowCount', async () => {
        const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
        const repository = createPostgresStepUpSessionRepository();
        expect(Object.keys(repository).sort()).toEqual(['findValid', 'upsert']);

        await repository.upsert(
            { query },
            {
                id: 's1',
                userId: USER_ID,
                tenantId: TENANT_ID,
                sessionId: 'sess',
                verifiedAt: new Date(),
                expiresAt: new Date(),
            },
        );
        expect(query.mock.calls[0][2]).toEqual({ operation: 'step_up_sessions.upsert' });
        expect(
            await repository.findValid({ query }, { userId: USER_ID, tenantId: TENANT_ID, sessionId: 'sess', now: new Date() }),
        ).toBe(true);
    });
});

describe('createStepUpService', () => {
    it('records a step-up session with the configured TTL and checks validity', async () => {
        const db = createDb();
        const stepUpSessions = { upsert: vi.fn(), findValid: vi.fn(async () => true) };
        const service = createStepUpService({ db, stepUpSessions, stepUpTtlSeconds: 60 });
        expect(typeof service.recordStepUp).toBe('function');
        expect(typeof service.hasValidStepUp).toBe('function');

        await service.recordStepUp({ userId: USER_ID, tenantId: TENANT_ID, sessionId: 'sess' });
        const [, input] = stepUpSessions.upsert.mock.calls[0];
        expect(input.expiresAt.getTime() - input.verifiedAt.getTime()).toBe(60_000);
        expect(db.execute).toHaveBeenCalledWith(expect.any(Function), { tenantId: TENANT_ID });

        await expect(service.hasValidStepUp({ userId: USER_ID, tenantId: TENANT_ID, sessionId: 'sess' })).resolves.toBe(true);
    });

    it('is re-exported from the public barrel', () => {
        expect(publicCreateStepUpService).toBe(createStepUpService);
    });
});

describe('mfa use-case factories', () => {
    it('return { execute } objects', () => {
        const factories = [
            createStartTotpEnrollment,
            createVerifyTotpEnrollment,
            createActivateTotpFactor,
            createVerifyMfa,
            createUseRecoveryCode,
        ];
        for (const factory of factories) {
            expect(typeof factory({}).execute).toBe('function');
        }
    });

    it('start enrollment requires mfa.manage', async () => {
        const useCase = createStartTotpEnrollment({});
        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, actorPermissions: [], email: 'a@b.c' }),
        ).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('start enrollment rejects when an active factor exists, otherwise creates a pending factor', async () => {
        const db = createDb();
        const mfaFactors = { findActiveByUser: vi.fn(async () => null), createPending: vi.fn() };
        const useCase = createStartTotpEnrollment({
            db,
            mfaFactors,
            secretEncryptor: { encrypt: vi.fn(() => 'enc') },
            issuer: 'Wasl',
        });
        const result = await useCase.execute({
            tenantId: TENANT_ID,
            userId: USER_ID,
            actorPermissions: ['mfa.manage'],
            email: 'a@b.c',
            label: '  Phone ',
        });
        expect(result.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
        expect(mfaFactors.createPending.mock.calls[0][1]).toMatchObject({
            userId: USER_ID,
            tenantId: TENANT_ID,
            secretEncrypted: 'enc',
            label: 'Phone',
        });

        mfaFactors.findActiveByUser.mockResolvedValueOnce({ id: 'x' });
        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, actorPermissions: ['mfa.manage'], email: 'a@b.c' }),
        ).rejects.toThrow('An active MFA factor already exists');
    });

    it('verify enrollment enforces permission and rate limit before touching the database', async () => {
        const db = createDb();
        const rateLimiter = { consume: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 7 })) };
        const useCase = createVerifyTotpEnrollment({ db, rateLimiter, mfaFactors: {}, secretEncryptor: {} });

        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, actorPermissions: [], factorId: FACTOR_ID, code: '123456' }),
        ).rejects.toBeInstanceOf(AuthorizationError);
        await expect(
            useCase.execute({
                tenantId: TENANT_ID,
                userId: USER_ID,
                actorPermissions: ['mfa.manage'],
                factorId: FACTOR_ID,
                code: '123456',
            }),
        ).rejects.toBeInstanceOf(RateLimitError);
        expect(rateLimiter.consume).toHaveBeenCalledWith(
            expect.objectContaining({ subject: `${TENANT_ID}:${USER_ID}` }),
        );
        expect(db.execute).not.toHaveBeenCalled();
    });

    it('verify mfa is rate limited', async () => {
        const rateLimiter = { consume: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 3 })) };
        const useCase = createVerifyMfa({ rateLimiter });
        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, sessionId: 's', code: '123456' }),
        ).rejects.toBeInstanceOf(RateLimitError);
    });

    it('activate factor revokes old factors/codes, issues 10 recovery codes and audits MFA_ENABLED', async () => {
        const db = createDb();
        const mfaFactors = {
            findById: vi.fn(async () => ({ id: FACTOR_ID, userId: USER_ID, status: 'PENDING' })),
            revokeAllForUser: vi.fn(),
            activate: vi.fn(),
        };
        const recoveryCodes = { revokeAllForUser: vi.fn(), createBatch: vi.fn() };
        const auditRecorder = { record: vi.fn() };
        const useCase = createActivateTotpFactor({ db, mfaFactors, recoveryCodes, auditRecorder });

        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, actorPermissions: [], factorId: FACTOR_ID }),
        ).rejects.toBeInstanceOf(AuthorizationError);

        const result = await useCase.execute({
            tenantId: TENANT_ID,
            userId: USER_ID,
            actorPermissions: ['mfa.manage'],
            factorId: FACTOR_ID,
        });
        expect(result.activated).toBe(true);
        expect(result.recoveryCodes).toHaveLength(10);
        expect(recoveryCodes.createBatch.mock.calls[0][1].codeHashes).toEqual(result.recoveryCodes.map(hashSecret));
        expect(mfaFactors.activate).toHaveBeenCalledTimes(1);
        expect(auditRecorder.record.mock.calls[0][1]).toMatchObject({
            eventType: 'MFA_ENABLED',
            resourceType: 'mfa_factor',
            resourceId: FACTOR_ID,
        });
    });

    it('use recovery code marks the code used, audits and records step-up', async () => {
        const db = createDb();
        const recoveryCodes = {
            findActiveByHash: vi.fn(async () => ({ id: 'rc1', userId: USER_ID, tenantId: TENANT_ID })),
            markUsed: vi.fn(),
        };
        const auditRecorder = { record: vi.fn() };
        const stepUpService = { recordStepUp: vi.fn() };
        const rateLimiter = { consume: vi.fn(async () => ({ allowed: true })) };
        const useCase = createUseRecoveryCode({ db, recoveryCodes, auditRecorder, stepUpService, rateLimiter });

        const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, sessionId: 'sess', code: ' abc ' });
        expect(result).toEqual({ stepUpVerified: true });
        expect(recoveryCodes.findActiveByHash.mock.calls[0][1]).toBe(hashSecret('abc'));
        expect(recoveryCodes.markUsed).toHaveBeenCalledWith(db.tx, 'rc1', expect.any(Date));
        expect(auditRecorder.record.mock.calls[0][1]).toMatchObject({
            eventType: 'MFA_STEP_UP',
            resourceType: 'recovery_code',
            metadata: { method: 'recovery_code' },
        });
        expect(stepUpService.recordStepUp).toHaveBeenCalledWith({
            userId: USER_ID,
            tenantId: TENANT_ID,
            sessionId: 'sess',
        });

        recoveryCodes.findActiveByHash.mockResolvedValueOnce(null);
        await expect(
            useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, sessionId: 'sess', code: 'nope' }),
        ).rejects.toBeInstanceOf(ValidationError);
    });
});

describe('createMfaModule', () => {
    it('wires factories without class instances', () => {
        const module = createMfaModule({
            database: { execute: vi.fn() },
            config: { appName: 'Wasl', auth: { stepUpTtlSeconds: 300 } },
            secretEncryptor: {},
            rateLimiter: {},
        });
        expect(typeof module.stepUpService.hasValidStepUp).toBe('function');
        expect(Object.keys(module.useCases).sort()).toEqual([
            'activateTotpFactor',
            'startTotpEnrollment',
            'useRecoveryCode',
            'verifyMfa',
            'verifyTotpEnrollment',
        ]);
        for (const useCase of Object.values(module.useCases)) {
            expect(Object.getPrototypeOf(useCase)).toBe(Object.prototype);
            expect(typeof useCase.execute).toBe('function');
        }
        expect(Object.getPrototypeOf(module.stepUpService)).toBe(Object.prototype);
    });
});
