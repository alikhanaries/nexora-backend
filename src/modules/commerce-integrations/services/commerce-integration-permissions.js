export function requireChannelRead(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.read');
}
export function requireChannelCreate(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.create');
}
export function requireChannelUpdate(authorization, permissions) {
    authorization.requirePermission(permissions, 'channels.update');
}
