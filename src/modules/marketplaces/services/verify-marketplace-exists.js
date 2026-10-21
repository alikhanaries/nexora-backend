export class VerifyMarketplaceExists {
    deps;
    /**
     * Injects module dependencies (database, repositories, authorization, event recorder).
     */
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Use-case entry: permission check, transactional persistence, domain events/audit when applicable.
     */
    async execute(input) {
        const marketplace = await this.deps.repository.findById(this.deps.queryable, input.marketplaceId);
        return { exists: marketplace !== null };
    }
}
