import type { AuthorizationService } from '../../authorization/public/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { ShipmentStatus } from '../domain/shipment-status.js';
import type { ShipmentRepository } from '../domain/shipment-repository.port.js';
import { toShipmentDto, type ShipmentDto } from './shipment-dto.js';
import { requireShipmentsRead } from './shipment-permissions.js';

export interface ListShipmentsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly orderId?: string | undefined;
  readonly status?: ShipmentStatus | undefined;
  readonly trackingNumber?: string | undefined;
}

export interface ListShipmentsDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly shipments: ShipmentRepository;
}

export class ListShipments {
  constructor(private readonly deps: ListShipmentsDependencies) {}

  async execute(input: ListShipmentsInput): Promise<CursorPage<ShipmentDto>> {
    requireShipmentsRead(this.deps.authorization, input.actorPermissions);

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

    const page = await this.deps.shipments.listPage(
      this.deps.queryable,
      input.tenantId,
      {
        ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.trackingNumber === undefined ? {} : { trackingNumber: input.trackingNumber }),
      },
      fetchLimit,
      cursorCreatedAt,
      cursorId,
    );

    const hasMore = page.items.length > limit;
    const items = hasMore ? page.items.slice(0, limit) : page.items;
    const last = items.at(-1);

    return {
      items: items.map(toShipmentDto),
      hasMore,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor([last.createdAt.toISOString(), last.id])
          : null,
    };
  }
}
