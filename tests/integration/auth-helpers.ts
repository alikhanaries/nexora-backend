import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { Application } from '../../src/app/bootstrap/create-application.js';
import type { HttpServer } from '../../src/app/http/types.js';

export interface TestTenantContext {
  readonly tenantId: string;
  readonly slug: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly email: string;
  readonly membershipId: string;
}

const ADMIN_PERMISSIONS = [
  'tenant.admin',
  'roles.read',
  'roles.manage',
  'users.read',
  'users.manage',
  'audit.read',
  'api_keys.read',
  'api_keys.manage',
  'mfa.manage',
] as const;

export async function createTestTenant(
  server: HttpServer,
  slug?: string,
): Promise<{
  tenantId: string;
  slug: string;
}> {
  const tenantSlug = slug ?? `test-${randomUUID().slice(0, 8)}`;
  const response = await server.inject({
    method: 'POST',
    url: '/api/v1/tenants',
    payload: { slug: tenantSlug, name: `Test ${tenantSlug}` },
  });
  expect(response.statusCode).toBe(201);
  return { tenantId: response.json().data.id as string, slug: tenantSlug };
}

export async function seedTenantRoles(app: Application, tenantId: string): Promise<void> {
  await app.authorization.useCases.systemRoleSeeder.execute({ tenantId });
}

export async function createAuthenticatedUser(
  app: Application,
  tenantId: string,
  tenantSlug: string,
): Promise<TestTenantContext> {
  const email = `user-${randomUUID().slice(0, 8)}@example.com`;
  const password = 'SecurePassword123!';

  const user = await app.identity.useCases.createUser.execute({ email, password });

  const membership = await app.identity.useCases.addMembership.execute({
    tenantId,
    userId: user.id,
  });

  await app.identity.useCases.activateMembership.execute({
    tenantId,
    membershipId: membership.id,
  });

  await seedTenantRoles(app, tenantId);

  const roles = await app.authorization.useCases.listRoles.execute({
    tenantId,
    actorPermissions: [...ADMIN_PERMISSIONS],
  });
  const ownerRole = roles.find((role) => role.systemKey === 'owner');
  expect(ownerRole).toBeDefined();

  await app.authorization.useCases.assignRole.execute({
    tenantId,
    actorPermissions: [...ADMIN_PERMISSIONS],
    membershipId: membership.id,
    roleId: ownerRole!.id,
  });

  const login = await app.identity.useCases.login.execute({
    tenantSlug,
    email,
    password,
  });

  return {
    tenantId,
    slug: tenantSlug,
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
    userId: user.id,
    email,
    membershipId: membership.id,
  };
}

export function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

export function apiKeyHeaders(rawKey: string): Record<string, string> {
  return { 'x-api-key': rawKey };
}
