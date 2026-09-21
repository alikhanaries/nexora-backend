/**
 * Queue port.
 *
 * Business code depends on this interface; only
 * src/infrastructure/queue may import BullMQ. That keeps the queue technology
 * replaceable and keeps BullMQ types out of use cases.
 */
export {};
