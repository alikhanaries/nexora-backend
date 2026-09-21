-- Phase 2C: Permission catalog, tenant roles, and membership role assignments.

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT permissions_key_format CHECK (key ~ '^[a-z][a-z0-9_.]*$')
);

CREATE UNIQUE INDEX permissions_key_unique ON permissions (key);

CREATE TABLE roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants (id),
  name                text NOT NULL,
  system_key          text,
  status              text NOT NULL DEFAULT 'ACTIVE',
  is_system           boolean NOT NULL DEFAULT false,
  cloned_from_role_id uuid REFERENCES roles (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roles_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT roles_system_key_when_system CHECK (
    (is_system = false AND system_key IS NULL)
    OR (is_system = true AND system_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX roles_tenant_name_unique ON roles (tenant_id, lower(name));
CREATE UNIQUE INDEX roles_tenant_system_key_unique
  ON roles (tenant_id, system_key)
  WHERE system_key IS NOT NULL;
CREATE INDEX roles_tenant_status_idx ON roles (tenant_id, status);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_tenant_isolation ON roles
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions (id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX role_permissions_permission_id_idx ON role_permissions (permission_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_tenant_isolation ON role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = app.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = app.current_tenant_id()
    )
  );

CREATE TABLE membership_roles (
  membership_id uuid NOT NULL REFERENCES tenant_memberships (id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES roles (id),
  PRIMARY KEY (membership_id, role_id)
);

CREATE OR REPLACE FUNCTION app.enforce_membership_role_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  membership_tenant uuid;
  role_tenant uuid;
BEGIN
  SELECT tenant_id INTO membership_tenant
  FROM tenant_memberships WHERE id = NEW.membership_id;
  SELECT tenant_id INTO role_tenant FROM roles WHERE id = NEW.role_id;
  IF membership_tenant IS DISTINCT FROM role_tenant THEN
    RAISE EXCEPTION 'membership and role must belong to the same tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER membership_roles_same_tenant_trg
  BEFORE INSERT OR UPDATE ON membership_roles
  FOR EACH ROW EXECUTE FUNCTION app.enforce_membership_role_same_tenant();

CREATE INDEX membership_roles_role_id_idx ON membership_roles (role_id);

ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_roles_tenant_isolation ON membership_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.id = membership_roles.membership_id
        AND tm.tenant_id = app.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.id = membership_roles.membership_id
        AND tm.tenant_id = app.current_tenant_id()
    )
  );

-- Seed global permission catalog.
INSERT INTO permissions (key, description) VALUES
  ('tenant.admin', 'Full tenant administration capability'),
  ('orders.read', 'View orders'),
  ('orders.create', 'Create orders'),
  ('orders.update', 'Update orders'),
  ('orders.cancel', 'Cancel orders'),
  ('products.read', 'View products'),
  ('products.create', 'Create products'),
  ('products.update', 'Update products'),
  ('inventory.read', 'View inventory'),
  ('inventory.update', 'Update inventory'),
  ('shipments.read', 'View shipments'),
  ('shipments.create', 'Create shipments'),
  ('returns.read', 'View returns'),
  ('returns.create', 'Create returns'),
  ('channels.read', 'View channels'),
  ('channels.update', 'Update channels'),
  ('users.read', 'View users and memberships'),
  ('users.manage', 'Manage users and memberships'),
  ('roles.read', 'View roles and permissions'),
  ('roles.manage', 'Manage roles and role assignments'),
  ('audit.read', 'View audit records'),
  ('audit.export', 'Export audit records'),
  ('api_keys.read', 'View API keys'),
  ('api_keys.manage', 'Create, rotate, and revoke API keys'),
  ('mfa.manage', 'Manage MFA factors'),
  ('auth.step_up', 'Perform step-up authenticated actions');
