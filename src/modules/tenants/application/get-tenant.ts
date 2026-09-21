import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { Tenant } from '../domain/tenant.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

export interface GetTenantInput {
  readonly tenantId: string;
}

export interface GetTenantResult {
  readonly tenant: Tenant;
}

export class GetTenant {
  constructor(
    private readonly repository: TenantRepository,
    private readonly queryable: Queryable,
  ) {}

  async execute(input: GetTenantInput): Promise<GetTenantResult> {
    const tenant = await this.repository.findById(this.queryable, input.tenantId);
    if (tenant === null) {
      throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
    }
    return { tenant };
  }
}
