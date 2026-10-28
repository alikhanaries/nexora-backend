-- Phase 5.1: RLS hardening — runtime application role and FORCE ROW LEVEL SECURITY.
--
-- Docker/local migrations run as superuser `wasl` (see docker-compose POSTGRES_USER).
-- Runtime should connect as `wasl_app` (non-superuser, not table owner) so tenant policies
-- provide genuine database-level defense-in-depth.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wasl_app') THEN
    CREATE ROLE wasl_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      PASSWORD 'wasl';
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
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO wasl_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO wasl_app;
GRANT USAGE ON SCHEMA app TO wasl_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wasl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wasl_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO wasl_app;

DO $$
DECLARE
  owner_role name;
BEGIN
  FOREACH owner_role IN ARRAY ARRAY['postgres', 'wasl']::name[]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wasl_app',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO wasl_app',
        owner_role
      );
    END IF;
  END LOOP;
END
$$;

COMMENT ON ROLE wasl_app IS
  'Non-superuser runtime role subject to row-level security. '
  'Migrations and schema changes run as the owning role via DATABASE_MIGRATION_URL.';
