export function intersectScopesWithPermissions(scopes, permissions) {
    const allowed = new Set(permissions);
    return scopes.filter((scope) => allowed.has(scope));
}
