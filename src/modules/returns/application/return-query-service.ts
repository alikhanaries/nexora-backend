import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ReturnRepository } from '../domain/return-repository.port.js';
import {
  toReturnDetailDto,
  toReturnDto,
  type ReturnDetailDto,
  type ReturnDto,
} from './return-dto.js';

export interface ReturnQueryService {
  getReturnById(tenantId: string, returnId: string, tx?: Transaction): Promise<ReturnDetailDto>;
  getReturnHeaderById(tenantId: string, returnId: string, tx?: Transaction): Promise<ReturnDto>;
}

export interface DefaultReturnQueryServiceDeps {
  readonly queryable: Queryable;
  readonly returns: ReturnRepository;
}

export class DefaultReturnQueryService implements ReturnQueryService {
  constructor(private readonly deps: DefaultReturnQueryServiceDeps) {}

  async getReturnById(
    tenantId: string,
    returnId: string,
    tx?: Transaction,
  ): Promise<ReturnDetailDto> {
    const queryable = tx ?? this.deps.queryable;
    const returnEntity = await this.deps.returns.findById(queryable, tenantId, returnId);
    if (returnEntity === null) {
      throw new NotFoundError('Return was not found', { tenantId, returnId });
    }

    const lines = await this.deps.returns.listReturnLines(queryable, tenantId, returnId);
    return toReturnDetailDto(returnEntity, lines);
  }

  async getReturnHeaderById(
    tenantId: string,
    returnId: string,
    tx?: Transaction,
  ): Promise<ReturnDto> {
    const queryable = tx ?? this.deps.queryable;
    const returnEntity = await this.deps.returns.findById(queryable, tenantId, returnId);
    if (returnEntity === null) {
      throw new NotFoundError('Return was not found', { tenantId, returnId });
    }
    return toReturnDto(returnEntity);
  }
}
