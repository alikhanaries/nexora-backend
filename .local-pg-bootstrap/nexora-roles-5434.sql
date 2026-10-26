--
-- PostgreSQL database cluster dump
--

\restrict 02u8VQnagwNJdScmeuItgqmwgChBZ5CRbkdtOp7CyWt2AZNb0qSt2iS0d6RHzVa

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE nexora;
ALTER ROLE nexora WITH SUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:erxYNFMW7jvUxnrvh8WqAg==$ctygWS5e3/48gB3zUdZ8nzzzl/c0YQxpeKCk29QKMy8=:rEi46Xv/WDiE8OEWsAmw8ohaPbk7ibpClmJJ+6qT81I=';
CREATE ROLE nexora_app;
ALTER ROLE nexora_app WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:NvsW3Twotl6Twju0CGMppA==$TL3aTo8bLo+EHBL3zta690cdev+N/a7gr7m4pLjolUE=:bL6vqbtsW4OHIlnwDKYPWeZgi3BXmFYCVRti2WCJOoM=';
COMMENT ON ROLE nexora_app IS 'Non-superuser runtime role subject to row-level security. Migrations and schema changes run as the owning role via DATABASE_MIGRATION_URL.';
CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:+fFQ70xDd9JaD9rcIfCnNg==$EyqokH5CaDNfkNVcZDieq37EV7B//SNbXqOd4wm9pnY=:zUag/CgIJJ+YPv5613QwfMpuwdjB9F35TEOpTXJSn1w=';

--
-- User Configurations
--






\unrestrict 02u8VQnagwNJdScmeuItgqmwgChBZ5CRbkdtOp7CyWt2AZNb0qSt2iS0d6RHzVa

--
-- PostgreSQL database cluster dump complete
--

