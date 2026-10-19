/**
 * @param {object} row
 */
export function toMarketplaceEntityMappingDto(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        channelId: row.channel_id,
        marketplaceKey: row.marketplace_key,
        integrationEntityType: row.nexora_entity_type,
        integrationEntityId: row.nexora_entity_id,
        /** @deprecated Use integrationEntityType — public contract alias until API v2 removes legacy keys. */
        nexoraEntityType: row.nexora_entity_type,
        /** @deprecated Use integrationEntityId — public contract alias until API v2 removes legacy keys. */
        nexoraEntityId: row.nexora_entity_id,
        externalEntityType: row.external_entity_type,
        externalEntityId: row.external_entity_id,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
