#!/usr/bin/env node
/**
 * Idempotently seeds local dev tenant + owner user for UI login.
 * Usage: node --env-file=.env scripts/seed-dev-user.mjs
 */
import { loadConfig } from '../src/app/config/config.js';
import { createInfrastructure } from '../src/app/create-infrastructure.js';
import { createApplication } from '../src/app/create-application.js';
import { createTenantsModule } from '../src/modules/tenants/index.js';
import { createPostgresTenantRepository } from '../src/modules/tenants/repositories/index.js';
import { createPostgresUserRepository } from '../src/modules/identity/repositories/postgres-user-repository.js';
import { createPostgresMembershipRepository } from '../src/modules/identity/repositories/postgres-membership-repository.js';
import { createPostgresPasswordCredentialRepository } from '../src/modules/identity/repositories/postgres-password-credential-repository.js';
import { createArgon2PasswordHasher } from '../src/infrastructure/auth/argon2-password-hasher.js';
import { ConflictError } from '../src/shared/errors/index.js';
import { parseEmail } from '../src/modules/identity/models/index.js';

const TENANT_SLUG = process.env.DEV_SEED_TENANT_SLUG ?? 'wasl-dev';
const TENANT_NAME = process.env.DEV_SEED_TENANT_NAME ?? 'Wasl Dev';
const EMAIL = process.env.DEV_SEED_EMAIL ?? 'admin@wasl.dev';
const PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'SecurePassword123!';

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
];

const tenantRepository = createPostgresTenantRepository();
const users = createPostgresUserRepository();
const memberships = createPostgresMembershipRepository();
const credentials = createPostgresPasswordCredentialRepository();
const passwordHasher = createArgon2PasswordHasher();

async function ensureTenant(tenantsModule, db) {
  const existing = await db.execute((tx) => tenantRepository.findBySlug(tx, TENANT_SLUG));
  if (existing !== null) {
    return existing;
  }
  const { tenant } = await tenantsModule.useCases.createTenant.execute({
    slug: TENANT_SLUG,
    name: TENANT_NAME,
  });
  return tenant;
}

async function ensureUser(db, identity) {
  try {
    return await identity.useCases.createUser.execute({ email: EMAIL, password: PASSWORD });
  } catch (error) {
    if (!(error instanceof ConflictError)) {
      throw error;
    }
    const parsed = parseEmail(EMAIL);
    const user = await db.execute((tx) => users.findByNormalizedEmail(tx, parsed.normalized));
    if (user === null) {
      throw error;
    }
    const passwordHash = await passwordHasher.hash(PASSWORD);
    await db.execute(async (tx) => {
      await credentials.save(tx, user.id, passwordHash);
    });
    return { id: user.id, email: user.email.raw, status: user.status };
  }
}

async function ensureOwnerMembership(db, identity, authorization, tenantId, userId) {
  let membership = await db.execute((tx) => memberships.findByTenantAndUser(tx, tenantId, userId));
  if (membership === null) {
    membership = await identity.useCases.addMembership.execute({ tenantId, userId });
  }
  if (membership.status !== 'ACTIVE') {
    await identity.useCases.activateMembership.execute({
      tenantId,
      membershipId: membership.id,
    });
  }

  await authorization.useCases.systemRoleSeeder.execute({ tenantId });
  const roles = await authorization.useCases.listRoles.execute({
    tenantId,
    actorPermissions: [...ADMIN_PERMISSIONS],
  });
  const ownerRole = roles.find((role) => role.systemKey === 'owner');
  if (ownerRole === undefined) {
    throw new Error('owner role missing after system role seed');
  }

  try {
    await authorization.useCases.assignRole.execute({
      tenantId,
      actorPermissions: [...ADMIN_PERMISSIONS],
      membershipId: membership.id,
      roleId: ownerRole.id,
    });
  } catch (error) {
    if (!(error instanceof ConflictError)) {
      throw error;
    }
  }
}

async function main() {
  const config = loadConfig(process.env);
  const infra = await createInfrastructure(config);
  const app = await createApplication(infra);
  const tenantsModule = createTenantsModule({
    database: infra.database,
    transactionManager: infra.database,
    queryable: infra.database,
  });

  const tenant = await ensureTenant(tenantsModule, infra.database);
  const user = await ensureUser(infra.database, app.identity);
  await ensureOwnerMembership(
    infra.database,
    app.identity,
    app.authorization,
    tenant.id,
    user.id,
  );

  const login = await app.identity.useCases.login.execute({
    tenantSlug: TENANT_SLUG,
    email: EMAIL,
    password: PASSWORD,
  });

  if (!login.accessToken) {
    throw new Error('Login verification failed after seed');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantSlug: TENANT_SLUG,
        email: EMAIL,
        password: PASSWORD,
        tenantId: tenant.id,
        userId: user.id,
      },
      null,
      2,
    ),
  );

  await infra.database.close().catch(() => undefined);
  await infra.redis.close().catch(() => undefined);
  await infra.queue.close().catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
