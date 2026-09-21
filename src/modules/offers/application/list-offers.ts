import type { AuthorizationService } from '../../authorization/public/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { OfferStatus } from '../domain/offer-status.js';
import type { OfferRepository } from '../domain/offer-repository.port.js';
import { toOfferDto, type OfferDto } from './offer-dto.js';
import { requireOffersRead } from './offer-permissions.js';

export interface ListOffersInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly productId?: string | undefined;
  readonly channelId?: string | undefined;
  readonly status?: OfferStatus | undefined;
}

export interface ListOffersDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly offers: OfferRepository;
}

export class ListOffers {
  constructor(private readonly deps: ListOffersDependencies) {}

  async execute(input: ListOffersInput): Promise<CursorPage<OfferDto>> {
    requireOffersRead(this.deps.authorization, input.actorPermissions);

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

    const page = await this.deps.offers.listPage(
      this.deps.queryable,
      input.tenantId,
      {
        ...(input.productId === undefined ? {} : { productId: input.productId }),
        ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
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
      items: items.map(toOfferDto),
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor([last.createdAt.toISOString(), last.id])
          : null,
    };
  }
}
