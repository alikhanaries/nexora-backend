/** Maps domain tenant to ISO-dated public API response. */
export function toTenantResponse(tenant) {
    return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
    };
}
