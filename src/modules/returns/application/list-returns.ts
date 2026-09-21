import type { AuthorizationService } from '../../authorization/public/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { ReturnStatus } from '../domain/return-status.js';
import type { ReturnRepository } from '../domain/return-repository.port.js';
import { toReturnDetailDto, type ReturnDetailDto } from './return-dto.js';
import { requireReturnsRead } from './return-permissions.js';

export interface ListReturnsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly orderId?: string | undefined;
  readonly status?: ReturnStatus | undefined;
}

export interface ListReturnsDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly returns: ReturnRepository;
}

export class ListReturns {
  constructor(private readonly deps: ListReturnsDependencies) {}

  async execute(input: ListReturnsInput): Promise<CursorPage<ReturnDetailDto>> {
    requireReturnsRead(this.deps.authorization, input.actorPermissions);

    const limit = clampCursorLimit(input.limit);
    const fetchLimit = limit + 1;

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (input.cursor !== undefined) {
      const parts = decodeCursor(input.cursor);
      if (parts.length !== 2) {
        throw new ValidationError('Invalid cursor');
      }
      cursorCreatedAt = new Date(parts[0] ?? '');
      cursorId = parts[1] ?? null;
    }

    const page = await this.deps.returns.listPage(
      this.deps.queryable,
      input.tenantId,
      {
        ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      fetchLimit,
      cursorCreatedAt,
      cursorId,
    );

    const hasMore = page.items.length > limit;
    const items = hasMore ? page.items.slice(0, limit) : page.items;

    const details = await Promise.all(
      items.map(async (returnEntity) => {
        const lines = await this.deps.returns.listReturnLines(
          this.deps.queryable,
          input.tenantId,
          returnEntity.id,
        );
        return toReturnDetailDto(returnEntity, lines);
      }),
    );

    const last = items.at(-1);

    return {
      items: details,
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor([last.createdAt.toISOString(), last.id])
          : null,
    };
  }
}
