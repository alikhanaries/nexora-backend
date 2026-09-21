export function actorFingerprint(actor: {
  readonly userId?: string;
  readonly apiKeyId?: string;
}): string {
  if (actor.userId !== undefined) {
    return `user:${actor.userId}`;
  }
  if (actor.apiKeyId !== undefined) {
    return `api-key:${actor.apiKeyId}`;
  }
  return 'anonymous';
}
