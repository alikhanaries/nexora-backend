-- Run in pgAdmin Query Tool as postgres on port 5432.

CREATE DATABASE nexora;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora') THEN
    CREATE ROLE nexora LOGIN SUPERUSER PASSWORD 'nexora';
  ELSE
    ALTER ROLE nexora WITH LOGIN SUPERUSER PASSWORD 'nexora';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_app') THEN
    CREATE ROLE nexora_app LOGIN PASSWORD 'nexora';
  ELSE
    ALTER ROLE nexora_app WITH LOGIN PASSWORD 'nexora';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE nexora TO nexora;
GRANT CONNECT ON DATABASE nexora TO nexora_app;
