import { NotFoundError } from '../../../../shared/errors/index.js';
export class GetUserUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(userId) {
        return this.deps.db.execute(async (tx) => {
            const user = await this.deps.users.findById(tx, userId);
            if (user === null) {
                throw new NotFoundError('User was not found');
            }
            return user;
        });
    }
}
