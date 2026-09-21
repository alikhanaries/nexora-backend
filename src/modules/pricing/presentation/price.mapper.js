export function toPriceResponse(price) {
    return {
        id: price.id,
        tenantId: price.tenantId,
        productId: price.productId,
        channelId: price.channelId,
        currency: price.currency,
        amountMinor: price.amountMinor,
        validFrom: price.validFrom.toISOString(),
        validTo: price.validTo?.toISOString() ?? null,
        status: price.status,
        createdAt: price.createdAt.toISOString(),
        updatedAt: price.updatedAt.toISOString(),
    };
}
