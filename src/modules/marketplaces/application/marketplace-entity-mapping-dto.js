/**
 * @param {object} row
 */
export function toMarketplaceEntityMappingDto(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        channelId: row.channel_id,
        marketplaceKey: row.marketplace_key,
        nexoraEntityType: row.nexora_entity_type,
        nexoraEntityId: row.nexora_entity_id,
        externalEntityType: row.external_entity_type,
        externalEntityId: row.external_entity_id,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
