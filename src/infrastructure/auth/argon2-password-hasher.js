import argon2 from 'argon2';
export class Argon2PasswordHasher {
    async hash(password) {
        return argon2.hash(password, { type: argon2.argon2id });
    }
    async verify(password, hash) {
        try {
            return await argon2.verify(hash, password);
        }
        catch {
            return false;
        }
    }
}
