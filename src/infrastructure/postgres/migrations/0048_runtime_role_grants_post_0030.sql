-- Grant nexora_app access to tables created after 0030_rls_hardening when migrations
-- run as postgres (or another owner other than nexora). 0030 only granted on existing
-- tables at migration time; DEFAULT PRIVILEGES FOR ROLE nexora does not apply to
-- objects owned by postgres.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  external_integer_id_mappings,
  external_integer_id_sequences,
  webhook_subscriptions,
  webhook_deliveries,
  marketplace_connections,
  marketplace_entity_mappings
TO nexora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nexora_app;
