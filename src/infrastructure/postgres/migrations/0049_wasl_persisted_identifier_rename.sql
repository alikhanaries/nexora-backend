-- Rename persisted identifiers to Wasl naming (runtime DB role + marketplace mapping columns).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_app')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wasl_app') THEN
    ALTER ROLE nexora_app RENAME TO wasl_app;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_entity_mappings'
      AND column_name = 'nexora_entity_type'
  ) THEN
    ALTER TABLE marketplace_entity_mappings
      RENAME COLUMN nexora_entity_type TO wasl_entity_type;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_entity_mappings'
      AND column_name = 'nexora_entity_id'
  ) THEN
    ALTER TABLE marketplace_entity_mappings
      RENAME COLUMN nexora_entity_id TO wasl_entity_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_entity_mappings_nexora_type_valid'
  ) THEN
    ALTER TABLE marketplace_entity_mappings
      RENAME CONSTRAINT marketplace_entity_mappings_nexora_type_valid
      TO marketplace_entity_mappings_wasl_type_valid;
  END IF;
END
$$;

COMMENT ON ROLE wasl_app IS
  'Non-superuser runtime role subject to row-level security. '
  'Migrations and schema changes run as the owning role via DATABASE_MIGRATION_URL.';
