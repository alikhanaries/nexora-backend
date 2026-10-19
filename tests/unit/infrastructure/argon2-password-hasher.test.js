import { describe, expect, it } from 'vitest';
import {
    createArgon2PasswordHasher,
    Argon2PasswordHasher,
} from '../../../src/infrastructure/auth/argon2-password-hasher.js';

/**
 * Characterisation fixture produced by the pre-factory Argon2PasswordHasher
 * (`argon2.hash(password, { type: argon2.argon2id })`) for a test-only password.
 * Must remain verifiable after the factory migration.
 */
const PRE_MIGRATION_PASSWORD = 'wasl-phase-418-fixture-password';
const PRE_MIGRATION_HASH =
    '$argon2id$v=19$m=65536,p=4,t=3$VyGkjWtfccG1sAWBZ1jjTQ$PZ4rIW2i6PjN3uFHo2CAzGibabI7L8P6NR5VP5+VP/c';

describe('createArgon2PasswordHasher', () => {
    it('verifies hashes created before the factory migration', async () => {
        const hasher = createArgon2PasswordHasher();
        await expect(hasher.verify(PRE_MIGRATION_PASSWORD, PRE_MIGRATION_HASH)).resolves.toBe(true);
        await expect(hasher.verify('wrong-password', PRE_MIGRATION_HASH)).resolves.toBe(false);
    });

    it('creates Argon2id hashes that verify under the same contract', async () => {
        const hasher = createArgon2PasswordHasher();
        const password = 'wasl-phase-418-new-hash-password';
        const encoded = await hasher.hash(password);

        expect(encoded.startsWith('$argon2id$')).toBe(true);
        expect(encoded).toContain('m=65536');
        expect(encoded).toContain('t=3');
        expect(encoded).toContain('p=4');
        await expect(hasher.verify(password, encoded)).resolves.toBe(true);
        await expect(hasher.verify('not-the-password', encoded)).resolves.toBe(false);
    });

    it('returns false for malformed encoded hashes instead of throwing', async () => {
        const hasher = createArgon2PasswordHasher();
        await expect(hasher.verify(PRE_MIGRATION_PASSWORD, 'not-a-valid-argon2-hash')).resolves.toBe(
            false,
        );
        await expect(hasher.verify(PRE_MIGRATION_PASSWORD, '')).resolves.toBe(false);
        await expect(hasher.verify(PRE_MIGRATION_PASSWORD, '$argon2id$broken')).resolves.toBe(false);
    });

    it('can verify factory-produced hashes via the compatibility wrapper', async () => {
        const factory = createArgon2PasswordHasher();
        const wrapper = new Argon2PasswordHasher();
        const password = 'wasl-phase-418-cross-verify-password';
        const encoded = await factory.hash(password);

        await expect(wrapper.verify(password, encoded)).resolves.toBe(true);
        await expect(wrapper.verify(PRE_MIGRATION_PASSWORD, PRE_MIGRATION_HASH)).resolves.toBe(true);
        await expect(factory.verify(password, PRE_MIGRATION_HASH)).resolves.toBe(false);
    });
});

describe('Argon2PasswordHasher compatibility wrapper', () => {
    it('delegates to the factory and preserves hash/verify behavior', async () => {
        const viaFactory = createArgon2PasswordHasher();
        const viaWrapper = new Argon2PasswordHasher();
        const password = 'wasl-phase-418-wrapper-parity-password';

        const encoded = await viaWrapper.hash(password);
        expect(encoded.startsWith('$argon2id$')).toBe(true);
        await expect(viaFactory.verify(password, encoded)).resolves.toBe(true);
        await expect(viaWrapper.verify(PRE_MIGRATION_PASSWORD, PRE_MIGRATION_HASH)).resolves.toBe(
            true,
        );
        await expect(viaWrapper.verify('wrong', PRE_MIGRATION_HASH)).resolves.toBe(false);
        await expect(viaWrapper.verify(password, 'not-a-hash')).resolves.toBe(false);
    });
});
