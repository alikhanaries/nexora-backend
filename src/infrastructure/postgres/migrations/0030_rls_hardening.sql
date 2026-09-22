-- Phase 5.1: RLS hardening — runtime application role and FORCE ROW LEVEL SECURITY.
--
-- The default Docker `nexora` user is a superuser and bypasses RLS entirely.
-- Runtime should connect as `nexora_app` (non-superuser, not table owner) so
-- tenant policies provide genuine database-level defense-in-depth.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_app') THEN
    CREATE ROLE nexora_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      PASSWORD 'nexora';
  END IF;
END
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relrowsecurity = true
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
      r.schema_name,
      r.table_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO nexora_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO nexora_app;
GRANT USAGE ON SCHEMA app TO nexora_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexora_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO nexora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nexora IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nexora IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nexora_app;

COMMENT ON ROLE nexora_app IS
  'Non-superuser runtime role subject to row-level security. '
  'Migrations and schema changes run as the owning role via DATABASE_MIGRATION_URL.';
