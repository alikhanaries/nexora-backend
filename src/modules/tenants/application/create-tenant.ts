import { randomUUID } from 'node:crypto';
import { normalizeTenantSlug, validateTenantSlug } from '../../../shared/security/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { Tenant } from '../domain/tenant.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

export interface CreateTenantInput {
  readonly slug: string;
  readonly name: string;
}

export interface CreateTenantResult {
  readonly tenant: Tenant;
}

export class CreateTenant {
  constructor(
    private readonly repository: TenantRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantResult> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Tenant name is required');
    }

    validateTenantSlug(input.slug);
    const slug = normalizeTenantSlug(input.slug);
    const now = new Date();
    const tenant = Tenant.create({
      id: randomUUID(),
      slug,
      name,
      createdAt: now,
    });

    await this.transactionManager.execute(async (tx) => {
      await this.repository.insert(tx, tenant);
    });

    return { tenant };
  }
}
