import type { OrderDetailDto } from '../application/order-dto.js';

/**
 * Command surface for order mutations consumed by future phases.
 * HTTP routes delegate to the same underlying use cases.
 */
export interface OrderCommandService {
  /** Idempotent order creation is enforced at the HTTP layer via Idempotency-Key. */
  createOrder(input: unknown): Promise<{ readonly order: OrderDetailDto }>;
  confirmOrder(input: unknown): Promise<{ readonly order: OrderDetailDto }>;
}
