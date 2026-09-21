import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Email, Membership, RefreshSession, User } from '../domain/index.js';
import type { PasswordResetTokenRecord } from '../application/ports/password-reset-token-repository.js';
import type { TenantRecord } from '../application/ports/tenant-lookup.js';

const userRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  normalized_email: z.string(),
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED']),
  created_at: z.date(),
  updated_at: z.date(),
});

const membershipRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED']),
  created_at: z.date(),
  updated_at: z.date(),
});

const refreshSessionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  token_hash: z.string(),
  family_id: z.string().uuid(),
  status: z.enum(['ACTIVE', 'REVOKED', 'REPLACED']),
  expires_at: z.date(),
  created_at: z.date(),
  last_used_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
  replaced_by: z.string().uuid().nullable(),
});

const tenantRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
});

const passwordResetTokenRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  token_hash: z.string(),
  status: z.enum(['ACTIVE', 'USED', 'REVOKED']),
  expires_at: z.date(),
  created_at: z.date(),
  used_at: z.date().nullable(),
});

export function mapUserRow(row: unknown): User {
  const parsed = parseOrThrow(userRowSchema, row, 'user row');
  return User.create({
    id: parsed.id,
    email: Email.create(parsed.email),
    status: parsed.status,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  });
}

export function mapMembershipRow(row: unknown): Membership {
  const parsed = parseOrThrow(membershipRowSchema, row, 'membership row');
  return Membership.create({
    id: parsed.id,
    tenantId: parsed.tenant_id,
    userId: parsed.user_id,
    status: parsed.status,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  });
}

export function mapRefreshSessionRow(row: unknown): RefreshSession {
  const parsed = parseOrThrow(refreshSessionRowSchema, row, 'refresh session row');
  return RefreshSession.create({
    id: parsed.id,
    userId: parsed.user_id,
    tenantId: parsed.tenant_id,
    tokenHash: parsed.token_hash,
    familyId: parsed.family_id,
    status: parsed.status,
    expiresAt: parsed.expires_at,
    createdAt: parsed.created_at,
    lastUsedAt: parsed.last_used_at,
    revokedAt: parsed.revoked_at,
    replacedBy: parsed.replaced_by,
  });
}

export function mapTenantRow(row: unknown): TenantRecord {
  const parsed = parseOrThrow(tenantRowSchema, row, 'tenant row');
  return {
    id: parsed.id,
    slug: parsed.slug,
    name: parsed.name,
    status: parsed.status,
  };
}

export function mapPasswordResetTokenRow(row: unknown): PasswordResetTokenRecord {
  const parsed = parseOrThrow(passwordResetTokenRowSchema, row, 'password reset token row');
  return {
    id: parsed.id,
    userId: parsed.user_id,
    tokenHash: parsed.token_hash,
    status: parsed.status,
    expiresAt: parsed.expires_at,
    createdAt: parsed.created_at,
    usedAt: parsed.used_at,
  };
}
