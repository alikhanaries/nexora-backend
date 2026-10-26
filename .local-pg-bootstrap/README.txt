Local PostgreSQL bootstrap (optional; prefer docker-compose in repo root).

1. Install PostgreSQL and create a superuser you can connect with (often `postgres`).
2. In pgAdmin or psql, run create-roles.sql on database "postgres".
3. If you have a dump from another machine:
   pg_restore -h localhost -p 5432 -U postgres -d wasl --no-owner --role=wasl wasl-5434.dump
   (Or use pgAdmin: right-click wasl -> Restore, pick wasl-5434.dump)

4. If postgres password is not 1234, edit DATABASE_MIGRATION_URL in .env to match pgAdmin.

Manual roles (same as create-roles.sql):
  CREATE DATABASE wasl;
  CREATE ROLE wasl LOGIN SUPERUSER PASSWORD 'wasl';
  CREATE ROLE wasl_app LOGIN PASSWORD 'wasl';
  GRANT ALL PRIVILEGES ON DATABASE wasl TO wasl;
