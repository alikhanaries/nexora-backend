/**
 * Phase 3B mechanical rename — run once, then review diff and run tests.
 * Does not touch .env, migrations, or historical docs unless path references break tests.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      walk(p, out);
    } else if (/\.(js|mjs|cjs|json|md)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

function applyReplacements(content, pairs) {
  let next = content;
  for (const [from, to] of pairs) {
    if (typeof from === 'string') {
      next = next.split(from).join(to);
    } else {
      next = next.replace(from, to);
    }
  }
  return next;
}

const GLOBAL_REPLACEMENTS = [
  ['modules/channels/', 'modules/commerce-integrations/'],
  ['modules/channel-catalog-sync/', 'modules/integration-catalog-sync/'],
  ['../channels/', '../commerce-integrations/'],
  ['../../channels/', '../../commerce-integrations/'],
  ['../../../channels/', '../../../commerce-integrations/'],
  ['../../../../channels/', '../../../../commerce-integrations/'],
  ['../../../../../channels/', '../../../../../commerce-integrations/'],
  ['../channel-catalog-sync/', '../integration-catalog-sync/'],
  ['../../channel-catalog-sync/', '../../integration-catalog-sync/'],
  ['../../../channel-catalog-sync/', '../../../integration-catalog-sync/'],
  ['../../../../channel-catalog-sync/', '../../../../integration-catalog-sync/'],
  ['createChannelsModule', 'createCommerceIntegrationsModule'],
  ['DefaultChannelQueryService', 'CommerceIntegrationQueryService'],
  ['ChannelQueryService', 'CommerceIntegrationQueryService'],
  ['PostgresChannelRepository', 'PostgresCommerceIntegrationRepository'],
  ['CreateChannel', 'CreateCommerceIntegration'],
  ['GetChannel', 'GetCommerceIntegration'],
  ['ListChannels', 'ListCommerceIntegrations'],
  ['UpdateChannel', 'UpdateCommerceIntegration'],
  ['ActivateChannel', 'ActivateCommerceIntegration'],
  ['DeactivateChannel', 'DeactivateCommerceIntegration'],
  ['SuspendChannel', 'SuspendCommerceIntegration'],
  ['ChannelStatus', 'IntegrationStatus'],
  ['createChannel', 'createCommerceIntegration'],
  ['getChannel', 'getCommerceIntegration'],
  ['listChannels', 'listCommerceIntegrations'],
  ['updateChannel', 'updateCommerceIntegration'],
  ['activateChannel', 'activateCommerceIntegration'],
  ['deactivateChannel', 'deactivateCommerceIntegration'],
  ['suspendChannel', 'suspendCommerceIntegration'],
  ['channelQueryService', 'commerceIntegrationQueryService'],
  ['wireChannelCatalogSync', 'wireIntegrationCatalogSync'],
  ['wire-channel-catalog-sync', 'wire-integration-catalog-sync'],
  ['ChannelCatalogSyncService', 'IntegrationCatalogSyncService'],
  ['ChannelCatalogSyncRateLimiter', 'IntegrationCatalogSyncRateLimiter'],
  ['createChannelCatalogSyncModule', 'createIntegrationCatalogSyncModule'],
  ['sync-channel-product', 'sync-integration-product'],
  ['sync-channel-offer', 'sync-integration-offer'],
  ['sync-channel-inventory', 'sync-integration-inventory'],
  ['sync-channel-price', 'sync-integration-price'],
  ['channel-catalog-sync-rate-limiter', 'integration-catalog-sync-rate-limiter'],
  ['channel-catalog-sync-service', 'integration-catalog-sync-service'],
  ['CreateChannelOrder', 'CreateIntegrationOrder'],
  ['CreateChannelFulfilledOrder', 'CreateIntegrationFulfilledOrder'],
  ['createChannelOrder', 'createIntegrationOrder'],
  ['createChannelFulfilledOrder', 'createIntegrationFulfilledOrder'],
  ['create-channel-order', 'create-integration-order'],
  ['create-channel-fulfilled-order', 'create-integration-fulfilled-order'],
  ['ChannelsModule', 'CommerceIntegrationsModule'],
  ['ChannelsController', 'CommerceIntegrationsController'],
  ['ChannelsService', 'CommerceIntegrationsService'],
  ['nest/channels/', 'nest/commerce-integrations/'],
  // compat v2 surface (replaces merchant-protocol internal names)
  ['merchant-protocol-', 'compat-v2-'],
  ['merchantProtocol', 'compatV2'],
  ['MerchantProtocol', 'CompatV2'],
  ['mapMerchantProtocol', 'mapCompatV2'],
  ['resolveMerchantProtocol', 'resolveCompatV2'],
  ['generateMerchantProtocol', 'generateCompatV2'],
  ['buildMerchantProtocol', 'buildCompatV2'],
  ['createMerchantProtocol', 'createCompatV2'],
  ['assertMerchantProtocol', 'assertCompatV2'],
  ['merchant_protocol_compat', 'compat_v2_surface'],
  ['MERCHANT_PROTOCOL_BRIDGE', 'COMPAT_V2_WEBHOOK_BRIDGE'],
  ['isMerchantProtocolBridge', 'isCompatV2WebhookBridge'],
  ['mapIntegrationsToMerchantProtocolCollection', 'mapIntegrationsToCompatV2Collection'],
  ['mapCompatV2IntegrationProduct', 'mapCompatV2IntegrationProduct'],
  ['listOrdersForMerchantProtocolPoll', 'listOrdersForCompatV2Poll'],
  ['merchantProtocolMutationContext', 'compatV2MutationContext'],
  ['merchantProtocolRoutes', 'compatV2Routes'],
  ['merchantProtocolOrdersQuerySchema', 'compatV2OrdersQuerySchema'],
  ['merchantProtocolApiKeyQuerySchema', 'compatV2ApiKeyQuerySchema'],
  ['merchantProtocolProductsQuerySchema', 'compatV2ProductsQuerySchema'],
  ['merchantProtocolIntegrationProductsQuerySchema', 'compatV2IntegrationProductsQuerySchema'],
  ['merchantProtocolOrderCollectionSchema', 'compatV2OrderCollectionSchema'],
  ['merchantProtocolOrderSchema', 'compatV2OrderSchema'],
  ['merchantProtocolOrderLineSchema', 'compatV2OrderLineSchema'],
  ['toChannelResponse', 'toCommerceIntegrationResponse'],
  ['channel-events.js', 'commerce-integration-events.js'],
  ['channel-permissions.js', 'commerce-integration-permissions.js'],
  ['channel-query-service.js', 'commerce-integration-query-service.js'],
  ['channel.mapper.js', 'commerce-integration.mapper.js'],
  ['channel.schemas.js', 'commerce-integration.schemas.js'],
  ['channel.routes.js', 'commerce-integration.routes.js'],
  ['channel-repository.port.js', 'commerce-integration-repository.port.js'],
  ['postgres-channel-repository.js', 'postgres-commerce-integration-repository.js'],
  ['resolve-channel-stock-location-id.js', 'resolve-commerce-integration-stock-location-id.js'],
  ['resolve-channel-queryable.js', 'resolve-commerce-integration-queryable.js'],
  ['create-channel.js', 'create-commerce-integration.js'],
  ['get-channel.js', 'get-commerce-integration.js'],
  ['list-channels.js', 'list-commerce-integrations.js'],
  ['update-channel.js', 'update-commerce-integration.js'],
  ['activate-channel.js', 'activate-commerce-integration.js'],
  ['deactivate-channel.js', 'deactivate-commerce-integration.js'],
  ['suspend-channel.js', 'suspend-commerce-integration.js'],
  ['channel-status.js', 'integration-status.js'],
  ['channel.js', 'commerce-integration.js'],
  ['export class Channel ', 'export class CommerceIntegration '],
  ['export { Channel,', 'export { CommerceIntegration,'],
  ['export { Channel }', 'export { CommerceIntegration }'],
  ['new Channel(', 'new CommerceIntegration('],
  ['Channel.create', 'CommerceIntegration.create'],
  ['Channel.reconstitute', 'CommerceIntegration.reconstitute'],
  ['Channel.activate', 'CommerceIntegration.activate'],
  ['Channel.deactivate', 'CommerceIntegration.deactivate'],
  ['Channel.suspend', 'CommerceIntegration.suspend'],
  ['Nexora', 'Wasl'],
  ['nexora-backend', 'wasl-backend'],
  // DB columns stay nexora_entity_* (persisted contract); do not rename in SQL.
  ['MarketplaceCommerceEntityType', 'MarketplaceCommerceEntityType'],
];

function copyModule(srcRel, destRel) {
  const src = join(ROOT, srcRel);
  const dest = join(ROOT, destRel);
  if (!existsSync(src)) {
    console.warn('skip missing', srcRel);
    return;
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

// 1) Clone modules
copyModule('src/modules/channels', 'src/modules/commerce-integrations');
copyModule('src/modules/channel-catalog-sync', 'src/modules/integration-catalog-sync');

// 2) Rename nest/channels -> commerce-integrations
const nestSrc = join(ROOT, 'src/nest/channels');
const nestDest = join(ROOT, 'src/nest/commerce-integrations');
if (existsSync(nestSrc)) {
  if (existsSync(nestDest)) rmSync(nestDest, { recursive: true, force: true });
  cpSync(nestSrc, nestDest, { recursive: true });
  renameSync(join(nestDest, 'channels.module.js'), join(nestDest, 'commerce-integrations.module.js'));
  renameSync(join(nestDest, 'channels.controller.js'), join(nestDest, 'commerce-integrations.controller.js'));
  renameSync(join(nestDest, 'channels.service.js'), join(nestDest, 'commerce-integrations.service.js'));
}

// 3) Apply global replacements across src, tests, test, scripts (not docs bulk)
const SCAN_ROOTS = ['src', 'tests', 'test', 'scripts'];
const files = [];
for (const r of SCAN_ROOTS) {
  walk(join(ROOT, r), files);
}

for (const file of files) {
  if (file.includes('phase3b-wasl-rename.mjs')) continue;
  const original = readFileSync(file, 'utf8');
  const updated = applyReplacements(original, GLOBAL_REPLACEMENTS);
  if (updated !== original) writeFileSync(file, updated);
}

// 4) Rename merchant-protocol files that still exist under compatibility
const compatApp = join(ROOT, 'src/modules/compatibility/application');
const compatPres = join(ROOT, 'src/modules/compatibility/presentation');
const compatMap = join(ROOT, 'src/modules/compatibility/application/mappers');
for (const dir of [compatApp, compatPres, compatMap]) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    if (entry.includes('merchant-protocol')) {
      const from = join(dir, entry);
      const to = join(dir, entry.replace(/merchant-protocol/g, 'compat-v2'));
      if (from !== to && existsSync(from)) renameSync(from, to);
    }
  }
}

const sharedBridge = join(ROOT, 'src/shared/stockconnect/merchant-protocol-webhook-bridge.js');
const sharedBridgeNew = join(ROOT, 'src/shared/stockconnect/compat-v2-webhook-bridge.js');
if (existsSync(sharedBridge)) renameSync(sharedBridge, sharedBridgeNew);

const nestCompat = join(ROOT, 'src/nest/legacy-compatibility/merchant-protocol.controller.js');
if (existsSync(nestCompat)) {
  renameSync(nestCompat, join(ROOT, 'src/nest/legacy-compatibility/compat-v2.controller.js'));
}
const nestOrders = join(ROOT, 'src/nest/legacy-orders/merchant-protocol-orders.controller.js');
if (existsSync(nestOrders)) {
  renameSync(nestOrders, join(ROOT, 'src/nest/legacy-orders/compat-v2-orders.controller.js'));
}

// 5) Remove old module dirs (after copies + global import updates)
for (const old of ['src/modules/channels', 'src/modules/channel-catalog-sync', 'src/nest/channels']) {
  if (existsSync(old)) rmSync(old, { recursive: true, force: true });
}

// 6) Second pass on commerce-integrations filenames
const ciRoot = join(ROOT, 'src/modules/commerce-integrations');
if (existsSync(ciRoot)) {
  for (const file of walk(ciRoot)) {
    const base = basename(file);
    let newBase = base
      .replace(/^channel\./, 'commerce-integration.')
      .replace(/^channel-/, 'commerce-integration-')
      .replace(/channel-status/, 'integration-status')
      .replace(/create-channel/, 'create-commerce-integration')
      .replace(/get-channel/, 'get-commerce-integration')
      .replace(/list-channels/, 'list-commerce-integrations')
      .replace(/update-channel/, 'update-commerce-integration')
      .replace(/activate-channel/, 'activate-commerce-integration')
      .replace(/deactivate-channel/, 'deactivate-commerce-integration')
      .replace(/suspend-channel/, 'suspend-commerce-integration');
    if (newBase !== base) {
      const dest = join(dirname(file), newBase);
      if (!existsSync(dest)) renameSync(file, dest);
    }
  }
}

const icsRoot = join(ROOT, 'src/modules/integration-catalog-sync');
if (existsSync(icsRoot)) {
  for (const file of walk(icsRoot)) {
    const base = basename(file);
    const newBase = base.replace(/channel-catalog-sync/g, 'integration-catalog-sync').replace(/sync-channel-/g, 'sync-integration-');
    if (newBase !== base) {
      const dest = join(dirname(file), newBase);
      if (!existsSync(dest)) renameSync(file, dest);
    }
  }
}

console.log('Phase 3B rename script completed. Review git diff and run tests.');
