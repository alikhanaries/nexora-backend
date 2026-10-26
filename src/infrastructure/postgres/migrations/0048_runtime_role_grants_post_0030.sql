-- Grant nexora_app access to tables created after 0030_rls_hardening when migrations
-- run as an owner other than nexora_app. 0030 only granted on existing tables at
-- migration time; DEFAULT PRIVILEGES FOR ROLE nexora does not apply to objects owned
-- by a different migration role (e.g. postgres on managed Postgres, nexora in Docker).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  external_integer_id_mappings,
  external_integer_id_sequences,
  webhook_subscriptions,
  webhook_deliveries,
  marketplace_connections,
  marketplace_entity_mappings
TO nexora_app;

DO $$
DECLARE
  owner_role name;
BEGIN
  FOREACH owner_role IN ARRAY ARRAY['postgres', 'nexora']::name[]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nexora_app',
        owner_role
      );
    END IF;
  END LOOP;
END
$$;
