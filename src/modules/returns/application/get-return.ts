import type { AuthorizationService } from '../../authorization/public/index.js';
import type { ReturnQueryService } from './return-query-service.js';
import { requireReturnsRead } from './return-permissions.js';
import type { ReturnDetailDto } from './return-dto.js';

export interface GetReturnInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly returnId: string;
}

export interface GetReturnResult {
  readonly return: ReturnDetailDto;
}

export interface GetReturnDependencies {
  readonly authorization: AuthorizationService;
  readonly returnQueryService: ReturnQueryService;
}

export class GetReturn {
  constructor(private readonly deps: GetReturnDependencies) {}

  async execute(input: GetReturnInput): Promise<GetReturnResult> {
    requireReturnsRead(this.deps.authorization, input.actorPermissions);

    const returnDetail = await this.deps.returnQueryService.getReturnById(
      input.tenantId,
      input.returnId,
    );

    return { return: returnDetail };
  }
}
