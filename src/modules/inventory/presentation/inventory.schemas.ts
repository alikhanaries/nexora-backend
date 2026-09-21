import { z } from 'zod';
import { StockLocationStatus } from '../domain/stock-location-status.js';

export const stockLocationIdParamsSchema = z.object({
  stockLocationId: z.string().uuid(),
});

export const productIdParamsSchema = z.object({
  productId: z.string().uuid(),
});

export const createStockLocationBodySchema = z.object({
  name: z.string().min(1).max(256),
  externalReference: z.string().min(1).max(256).optional(),
});

export const stockLocationResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  externalReference: z.string().nullable(),
  status: z.enum([StockLocationStatus.ACTIVE, StockLocationStatus.INACTIVE]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const balanceResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  stockLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  onHand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const balanceSnapshotSchema = z.object({
  onHand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
});

export const inventoryListQuerySchema = z.object({
  stockLocationId: z.string().uuid().optional(),
});

export const adjustInventoryBodySchema = z.object({
  stockLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0, 'Delta must be non-zero'),
  referenceType: z.string().min(1).max(128).optional(),
  referenceId: z.string().min(1).max(256).optional(),
  idempotencyKey: z.string().min(1).max(256).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const receiveInventoryBodySchema = z.object({
  stockLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  referenceType: z.string().min(1).max(128).optional(),
  referenceId: z.string().min(1).max(256).optional(),
  idempotencyKey: z.string().min(1).max(256).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const reserveInventoryBodySchema = z.object({
  stockLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  referenceType: z.string().min(1).max(128),
  referenceId: z.string().min(1).max(256),
  idempotencyKey: z.string().min(1).max(256).optional(),
});

export const releaseInventoryBodySchema = z.object({
  stockLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  referenceType: z.string().min(1).max(128),
  referenceId: z.string().min(1).max(256),
  quantity: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1).max(256).optional(),
});

export const mutationResultSchema = z.object({
  idempotent: z.boolean(),
  balance: balanceSnapshotSchema,
});

export const reserveResultSchema = z.object({
  reservationId: z.string().uuid(),
  idempotent: z.boolean(),
  balance: balanceSnapshotSchema,
});
