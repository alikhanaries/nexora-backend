/**
 * One-time local bootstrap: tenant + owner user for Postman (no public signup API).
 * Usage: node --env-file=.env --import ./src/app/register-swc.mjs scripts/dev-postman-bootstrap.mjs [slug] [email] [password]
 */
import { loadConfigFromEnvironment } from '../src/app/config/index.js';
import { createInfrastructure } from '../src/app/create-infrastructure.js';
import { createApplication } from '../src/app/create-application.js';
import { createTenantsModule } from '../src/modules/tenants/index.js';

const slug = process.argv[2] ?? 'demo-shop';
const email = process.argv[3] ?? 'admin@example.com';
const password = process.argv[4] ?? 'SecurePassword123!';

const config = loadConfigFromEnvironment();
const infra = await createInfrastructure(config);
const app = await createApplication(infra);
const tenants = createTenantsModule({
  transactionManager: infra.database,
  queryable: infra.database,
});

const { tenant } = await tenants.useCases.createTenant.execute({
  slug,
  name: `Demo ${slug}`,
});
await app.authorization.useCases.systemRoleSeeder.execute({ tenantId: tenant.id });

const user = await app.identity.useCases.createUser.execute({ email, password });
const membership = await app.identity.useCases.addMembership.execute({
  tenantId: tenant.id,
  userId: user.id,
});
await app.identity.useCases.activateMembership.execute({
  tenantId: tenant.id,
  membershipId: membership.id,
});

const roles = await app.authorization.useCases.listRoles.execute({
  tenantId: tenant.id,
  actorPermissions: ['roles.read', 'tenant.admin'],
});
const ownerRole = roles.find((role) => role.systemKey === 'owner');
if (!ownerRole) {
  throw new Error('Owner system role not found after seed');
}
await app.authorization.useCases.assignRole.execute({
  tenantId: tenant.id,
  actorPermissions: ['roles.manage', 'tenant.admin'],
  membershipId: membership.id,
  roleId: ownerRole.id,
});

console.log(
  JSON.stringify(
    {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      email,
      password,
      postman: {
        setEnvironment: { tenantSlug: tenant.slug, tenantId: tenant.id, email, password },
      },
    },
    null,
    2,
  ),
);

await infra.database?.close?.();
process.exit(0);
