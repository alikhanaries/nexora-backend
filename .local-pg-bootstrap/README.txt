One-time bootstrap for PostgreSQL 17 on localhost:5432

1. In pgAdmin, connect to your PG 17 server (port 5432) as superuser (postgres).

2. Create the database if missing:
   CREATE DATABASE nexora;

3. Run create-roles.sql on database "postgres" (skip CREATE DATABASE if nexora already exists).

4. Restore data and schema:
   pg_restore -h localhost -p 5432 -U postgres -d nexora --no-owner --role=nexora nexora-5434.dump
   (Or use pgAdmin: right-click nexora -> Restore, pick nexora-5434.dump)

5. If postgres password is not 1234, edit DATABASE_MIGRATION_URL in .env to match pgAdmin.

6. npm run start

Alternative without restore: run only step 2 plus scripts in pgAdmin from docs below (empty DB, migrations on startup).

SQL if roles missing (passwords match .env):
  CREATE ROLE nexora LOGIN SUPERUSER PASSWORD 'nexora';
  CREATE ROLE nexora_app LOGIN PASSWORD 'nexora';
  GRANT ALL PRIVILEGES ON DATABASE nexora TO nexora;
