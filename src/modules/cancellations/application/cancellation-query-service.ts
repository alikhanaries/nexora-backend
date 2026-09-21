import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { CancellationRepository } from '../domain/cancellation-repository.port.js';
import {
  toCancellationDto,
  toCancellationLineDto,
  type CancellationDetailDto,
  type CancellationDto,
} from './cancellation-dto.js';

export interface CancellationQueryService {
  getCancellationById(
    tenantId: string,
    cancellationId: string,
    tx?: Transaction,
  ): Promise<CancellationDetailDto>;
  getCancellationSummaryById(
    tenantId: string,
    cancellationId: string,
    tx?: Transaction,
  ): Promise<CancellationDto>;
}

export interface DefaultCancellationQueryServiceDeps {
  readonly queryable: Queryable;
  readonly cancellations: CancellationRepository;
}

export class DefaultCancellationQueryService implements CancellationQueryService {
  constructor(private readonly deps: DefaultCancellationQueryServiceDeps) {}

  async getCancellationById(
    tenantId: string,
    cancellationId: string,
    tx?: Transaction,
  ): Promise<CancellationDetailDto> {
    const queryable = tx ?? this.deps.queryable;
    const cancellation = await this.deps.cancellations.findById(
      queryable,
      tenantId,
      cancellationId,
    );
    if (cancellation === null) {
      throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
    }

    const lines = await this.deps.cancellations.listLines(queryable, tenantId, cancellationId);

    return {
      ...toCancellationDto(cancellation),
      lines: lines.map(toCancellationLineDto),
    };
  }

  async getCancellationSummaryById(
    tenantId: string,
    cancellationId: string,
    tx?: Transaction,
  ): Promise<CancellationDto> {
    const queryable = tx ?? this.deps.queryable;
    const cancellation = await this.deps.cancellations.findById(
      queryable,
      tenantId,
      cancellationId,
    );
    if (cancellation === null) {
      throw new NotFoundError('Cancellation was not found', { tenantId, cancellationId });
    }

    return toCancellationDto(cancellation);
  }
}
