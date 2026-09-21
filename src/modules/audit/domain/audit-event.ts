export const AUDIT_EVENT_TYPES = [
  'USER_CREATED',
  'USER_STATUS_CHANGED',
  'MEMBERSHIP_CREATED',
  'MEMBERSHIP_ACTIVATED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_REVOKED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'REFRESH_REUSE_DETECTED',
  'API_KEY_CREATED',
  'API_KEY_ROTATED',
  'API_KEY_REVOKED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_STEP_UP',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditActorKind = 'user' | 'api-key' | 'system';

export interface AuditEvent {
  readonly id: string;
  readonly tenantId: string | null;
  readonly actorKind: AuditActorKind;
  readonly actorId: string | null;
  readonly eventType: AuditEventType;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly ipAddress: string | null;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface AuditEventDraft {
  readonly tenantId?: string | null;
  readonly actorKind: AuditActorKind;
  readonly actorId?: string | null;
  readonly eventType: AuditEventType;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string | null;
  readonly requestId?: string | null;
}
