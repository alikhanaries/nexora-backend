import { mapIntegrationsToCompatV2Collection } from './mappers/compat-v2-integration.mapper.js';

/**
 * Compat v2 integration list query (`GET /api/v2/ce/channels`).
 */
export class CompatV2IntegrationListQuery {
    deps;

    /** @param {{ commerceIntegrationQueryService: import('../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService }} deps */
    constructor(deps) {
        this.deps = deps;
    }

    async listCommerceIntegrations(input) {
        const channels = await this.deps.commerceIntegrationQueryService.listCommerceIntegrations(input.tenantId, {});
        return mapIntegrationsToCompatV2Collection(channels);
    }
}
