/**
 * Keeps only scopes the caller is allowed to grant (prevents privilege escalation on key create).
 * @param {string[]} scopes Requested API key scopes.
 * @param {string[]} permissions Caller effective permissions.
 * @returns {string[]}
 */
export function intersectScopesWithPermissions(scopes, permissions) {
    const allowed = new Set(permissions);
    return scopes.filter((scope) => allowed.has(scope));
}
