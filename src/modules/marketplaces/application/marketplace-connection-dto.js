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
        lastTestAt: row.last_test_at === null ? null : row.last_test_at.toISOString(),
        lastTestOutcome: row.last_test_outcome ?? null,
        lastTestError: row.last_test_error ?? null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
