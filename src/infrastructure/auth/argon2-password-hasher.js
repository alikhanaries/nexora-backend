import argon2 from 'argon2';

/**
 * Argon2id password hashing (Wasl default).
 *
 * Options are intentionally limited to `{ type: argon2.argon2id }` so salt
 * generation, memory/time/parallelism, and encoding stay on the argon2 package
 * defaults that existing stored hashes already use.
 *
 * @param {object} [dependencies]
 * @param {typeof argon2} [dependencies.argon2] Optional argon2 module (tests); defaults to the production import.
 * @returns {{
 *   hash: (password: string) => Promise<string>,
 *   verify: (password: string, hash: string) => Promise<boolean>,
 * }}
 */
export function createArgon2PasswordHasher(dependencies = {}) {
    const argon2Lib = dependencies.argon2 ?? argon2;

    /**
     * @param {string} password
     */
    async function hash(password) {
        return argon2Lib.hash(password, { type: argon2Lib.argon2id });
    }

    /**
     * @param {string} password
     * @param {string} encodedHash
     */
    async function verify(password, encodedHash) {
        try {
            return await argon2Lib.verify(encodedHash, password);
        }
        catch {
            return false;
        }
    }

    return {
        hash,
        verify,
    };
}

/**
 * @deprecated Prefer {@link createArgon2PasswordHasher}; kept for existing import sites.
 * Constructor returns the factory result (same pattern as RedisKeyBuilder / Orders wrappers).
 */
export class Argon2PasswordHasher {
    constructor() {
        return createArgon2PasswordHasher();
    }
}
