import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../../../shared/errors/index.js';
import { validatePassword } from '../../../../shared/security/index.js';
import { Email, User } from '../../domain/index.js';
export class CreateUserUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        validatePassword(input.password, this.deps.passwordPolicy);
        const email = Email.create(input.email);
        return this.deps.db.execute(async (tx) => {
            const existing = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
            if (existing !== null) {
                throw new ConflictError('A user with this email already exists');
            }
            const user = User.createNew(randomUUID(), email);
            const passwordHash = await this.deps.passwordHasher.hash(input.password);
            await this.deps.users.save(tx, user);
            await this.deps.credentials.save(tx, user.id, passwordHash);
            return {
                id: user.id,
                email: user.email.raw,
                status: user.status,
            };
        });
    }
}
