import { z } from 'zod';
import { ListingStatus } from '../domain/listing-status.js';
import { OfferStatus } from '../domain/offer-status.js';

export const offerIdParamsSchema = z.object({
  offerId: z.string().uuid(),
});

export const createOfferBodySchema = z.object({
  productId: z.string().uuid(),
  channelId: z.string().uuid(),
  externalReference: z.string().max(256).nullable().optional(),
  priceReference: z.string().uuid().nullable().optional(),
});

export const updateOfferBodySchema = z
  .object({
    externalReference: z.string().max(256).nullable().optional(),
    priceReference: z.string().uuid().nullable().optional(),
    listingStatus: z
      .enum([ListingStatus.UNLISTED, ListingStatus.LISTED, ListingStatus.DELISTED])
      .optional(),
    status: z.enum([OfferStatus.ACTIVE, OfferStatus.INACTIVE, OfferStatus.SUSPENDED]).optional(),
  })
  .refine(
    (body) =>
      body.externalReference !== undefined ||
      body.priceReference !== undefined ||
      body.listingStatus !== undefined ||
      body.status !== undefined,
    { message: 'At least one field must be provided' },
  );

export const activateOfferBodySchema = z.object({
  resolvePricing: z.boolean().optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .optional(),
});

export const listOffersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  productId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  status: z
    .enum([OfferStatus.DRAFT, OfferStatus.ACTIVE, OfferStatus.INACTIVE, OfferStatus.SUSPENDED])
    .optional(),
});

export const offerResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  channelId: z.string().uuid(),
  status: z.enum([
    OfferStatus.DRAFT,
    OfferStatus.ACTIVE,
    OfferStatus.INACTIVE,
    OfferStatus.SUSPENDED,
  ]),
  externalReference: z.string().nullable(),
  priceReference: z.string().uuid().nullable(),
  listingStatus: z.enum([ListingStatus.UNLISTED, ListingStatus.LISTED, ListingStatus.DELISTED]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const offerSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: offerResponseSchema,
});

export const offerListSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(offerResponseSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});
