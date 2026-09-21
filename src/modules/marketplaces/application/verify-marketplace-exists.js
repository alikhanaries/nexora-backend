export class VerifyMarketplaceExists {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const marketplace = await this.deps.repository.findById(this.deps.queryable, input.marketplaceId);
        return { exists: marketplace !== null };
    }
}
