-- Phase 32: opaque ingress tokens for inbound marketplace webhooks (Nexora routing, not provider auth).

ALTER TABLE marketplace_connections
  ADD COLUMN webhook_ingress_token_hash text;

CREATE UNIQUE INDEX marketplace_connections_webhook_ingress_token_hash_uidx
  ON marketplace_connections (webhook_ingress_token_hash)
  WHERE webhook_ingress_token_hash IS NOT NULL;

-- Lookup active connection by hashed ingress token without tenant GUC (public webhook endpoint).
CREATE OR REPLACE FUNCTION app.lookup_marketplace_connection_for_webhook(p_token_hash text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  channel_id uuid,
  marketplace_key text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
  SELECT mc.id, mc.tenant_id, mc.channel_id, mc.marketplace_key, mc.status
  FROM marketplace_connections mc
  WHERE mc.webhook_ingress_token_hash = p_token_hash
    AND mc.status = 'ACTIVE'
  LIMIT 1;
$$;
