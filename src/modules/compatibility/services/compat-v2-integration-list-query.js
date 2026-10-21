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

    /**
     * GET `/api/v2/ce/channels` — lists tenant commerce integrations mapped to CE channel envelope.
     * @param {object} input `{ tenantId }` from authenticated actor.
     * @returns {Promise<object>} Success/Content collection; read-only, no idempotency.
     */
    async listCommerceIntegrations(input) {
        const channels = await this.deps.commerceIntegrationQueryService.listCommerceIntegrations(input.tenantId, {});
        return mapIntegrationsToCompatV2Collection(channels);
    }
}
