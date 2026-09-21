export function actorFingerprint(actor) {
    if (actor.userId !== undefined) {
        return `user:${actor.userId}`;
    }
    if (actor.apiKeyId !== undefined) {
        return `api-key:${actor.apiKeyId}`;
    }
    return 'anonymous';
}
