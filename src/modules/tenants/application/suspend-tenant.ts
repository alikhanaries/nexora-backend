import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Tenant } from '../domain/tenant.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

export interface SuspendTenantInput {
  readonly tenantId: string;
}

export interface SuspendTenantResult {
  readonly tenant: Tenant;
}

export class SuspendTenant {
  constructor(
    private readonly repository: TenantRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: SuspendTenantInput): Promise<SuspendTenantResult> {
    const tenant = await this.transactionManager.execute(async (tx) => {
      const existing = await this.repository.findById(tx, input.tenantId);
      if (existing === null) {
        throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
      }

      const updated = existing.suspend(new Date());
      await this.repository.update(tx, updated);
      return updated;
    });

    return { tenant };
  }
}
