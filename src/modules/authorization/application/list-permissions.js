export class ListPermissions {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return this.deps.permissions.listAll();
    }
}
