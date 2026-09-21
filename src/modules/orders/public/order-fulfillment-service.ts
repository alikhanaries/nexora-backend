import type { Transaction } from '../../../shared/persistence/index.js';
import type { OrderLine } from '../domain/order-line.js';
import type { OrderDto } from '../application/order-dto.js';

export interface CancellationLineUpdate {
  readonly orderLineId: string;
  readonly quantity: number;
}

export interface AppliedCancellationLine {
  readonly orderLineId: string;
  readonly productId: string;
  readonly stockLocationId: string;
  readonly quantity: number;
}

export interface ApplyCancellationInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly lines: readonly CancellationLineUpdate[];
}

export interface ApplyCancellationResult {
  readonly order: OrderDto;
  readonly appliedLines: readonly AppliedCancellationLine[];
  readonly previousOrderStatus: string;
}

export interface OrderFulfillmentLineInput {
  readonly orderLineId: string;
  readonly quantity: number;
}

export interface OrderFulfillmentService {
  applyCancellation(
    transaction: Transaction,
    input: ApplyCancellationInput,
  ): Promise<ApplyCancellationResult>;
  lockOrderLinesForFulfillment(
    tenantId: string,
    orderId: string,
    tx: Transaction,
  ): Promise<readonly OrderLine[]>;
  applyShipmentQuantities(
    tenantId: string,
    orderId: string,
    lines: readonly OrderFulfillmentLineInput[],
    tx: Transaction,
  ): Promise<void>;
  reverseShipmentQuantities(
    tenantId: string,
    orderId: string,
    lines: readonly OrderFulfillmentLineInput[],
    tx: Transaction,
  ): Promise<void>;
  evaluateOrderShipmentState(tenantId: string, orderId: string, tx: Transaction): Promise<void>;
}
