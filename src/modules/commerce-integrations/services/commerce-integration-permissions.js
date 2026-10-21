/** Authz gate for channel read operations (`channels.read`). */
export function requireChannelRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.read');
}

/** Authz gate for channel create (`channels.create`). */
export function requireChannelCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.create');
}

/** Authz gate for channel update/status/connection mutations (`channels.update`). */
export function requireChannelUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.update');
}
