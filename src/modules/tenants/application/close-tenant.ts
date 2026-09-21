import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Tenant } from '../domain/tenant.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

export interface CloseTenantInput {
  readonly tenantId: string;
}

export interface CloseTenantResult {
  readonly tenant: Tenant;
}

export class CloseTenant {
  constructor(
    private readonly repository: TenantRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: CloseTenantInput): Promise<CloseTenantResult> {
    const tenant = await this.transactionManager.execute(async (tx) => {
      const existing = await this.repository.findById(tx, input.tenantId);
      if (existing === null) {
        throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
      }

      const updated = existing.close(new Date());
      await this.repository.update(tx, updated);
      return updated;
    });

    return { tenant };
  }
}
