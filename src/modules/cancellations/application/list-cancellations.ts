import type { AuthorizationService } from '../../authorization/public/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { CancellationStatus } from '../domain/cancellation-status.js';
import type { CancellationRepository } from '../domain/cancellation-repository.port.js';
import { toCancellationDto, type CancellationDto } from './cancellation-dto.js';
import { requireCancellationsRead } from './cancellation-permissions.js';

export interface ListCancellationsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly orderId?: string | undefined;
  readonly status?: CancellationStatus | undefined;
}

export interface ListCancellationsDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly cancellations: CancellationRepository;
}

export class ListCancellations {
  constructor(private readonly deps: ListCancellationsDependencies) {}

  async execute(input: ListCancellationsInput): Promise<CursorPage<CancellationDto>> {
    requireCancellationsRead(this.deps.authorization, input.actorPermissions);

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

    const page = await this.deps.cancellations.listPage(
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
    const last = items.at(-1);

    return {
      items: items.map(toCancellationDto),
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor([last.createdAt.toISOString(), last.id])
          : null,
    };
  }
}
