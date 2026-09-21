-- Reason: establishes the `app` schema and the tenant-context helper that all
-- future row-level-security policies depend on. Creating it once here means
-- every policy references the same definition instead of re-implementing the
-- lookup.

CREATE SCHEMA IF NOT EXISTS app;

-- Reads the transaction-local tenant set by the application via
-- `set_config('app.tenant_id', <uuid>, true)`.
--
-- The second argument of current_setting() is `missing_ok`, so an unset GUC
-- yields NULL instead of raising. Policies must therefore treat NULL as
-- "no tenant scope" and deny rather than allow.
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION app.current_tenant_id() IS
  'Transaction-local tenant identifier used by row-level-security policies. '
  'Returns NULL when no tenant scope is active.';
