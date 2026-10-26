-- Run in pgAdmin Query Tool as postgres on port 5432.

CREATE DATABASE wasl;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wasl') THEN
    CREATE ROLE wasl LOGIN SUPERUSER PASSWORD 'wasl';
  ELSE
    ALTER ROLE wasl WITH LOGIN SUPERUSER PASSWORD 'wasl';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wasl_app') THEN
    CREATE ROLE wasl_app LOGIN PASSWORD 'wasl';
  ELSE
    ALTER ROLE wasl_app WITH LOGIN PASSWORD 'wasl';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE wasl TO wasl;
GRANT CONNECT ON DATABASE wasl TO wasl_app;
