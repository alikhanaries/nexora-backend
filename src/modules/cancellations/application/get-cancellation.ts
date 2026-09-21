import type { AuthorizationService } from '../../authorization/public/index.js';
import type { CancellationQueryService } from './cancellation-query-service.js';
import { requireCancellationsRead } from './cancellation-permissions.js';
import type { CancellationDetailDto } from './cancellation-dto.js';

export interface GetCancellationInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly cancellationId: string;
}

export interface GetCancellationResult {
  readonly cancellation: CancellationDetailDto;
}

export interface GetCancellationDependencies {
  readonly authorization: AuthorizationService;
  readonly cancellationQueryService: CancellationQueryService;
}

export class GetCancellation {
  constructor(private readonly deps: GetCancellationDependencies) {}

  async execute(input: GetCancellationInput): Promise<GetCancellationResult> {
    requireCancellationsRead(this.deps.authorization, input.actorPermissions);

    const cancellation = await this.deps.cancellationQueryService.getCancellationById(
      input.tenantId,
      input.cancellationId,
    );

    return { cancellation };
  }
}
