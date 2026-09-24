/**
 * @param {object} row
 */
export function toMarketplaceConnectionDto(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        channelId: row.channel_id,
        marketplaceKey: row.marketplace_key,
        configuration: row.configuration ?? {},
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
