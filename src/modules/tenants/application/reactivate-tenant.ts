import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Tenant } from '../domain/tenant.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

export interface ReactivateTenantInput {
  readonly tenantId: string;
}

export interface ReactivateTenantResult {
  readonly tenant: Tenant;
}

export class ReactivateTenant {
  constructor(
    private readonly repository: TenantRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: ReactivateTenantInput): Promise<ReactivateTenantResult> {
    const tenant = await this.transactionManager.execute(async (tx) => {
      const existing = await this.repository.findById(tx, input.tenantId);
      if (existing === null) {
        throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
      }

      const updated = existing.reactivate(new Date());
      await this.repository.update(tx, updated);
      return updated;
    });

    return { tenant };
  }
}
