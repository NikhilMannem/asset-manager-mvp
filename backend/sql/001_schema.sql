-- Base schema for the multi-tenant asset manager.
--
-- Run as the table owner (for example the postgres role):
--   psql -U postgres -d asset_manager -f sql/001_schema.sql
--
-- The application must connect as a separate role that is NOT a superuser,
-- does NOT have BYPASSRLS, and does NOT own these tables. FORCE ROW LEVEL
-- SECURITY below makes the policies apply even to the owner.

CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants (id),
    name text NOT NULL,
    type text NOT NULL
        CHECK (type IN ('string', 'number', 'boolean', 'date', 'json')),
    required boolean DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_fields_tenant_name
    ON asset_fields (tenant_id, name);

CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants (id),
    name text NOT NULL,
    attributes jsonb
);

CREATE TABLE IF NOT EXISTS staged_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants (id),
    raw_data jsonb,
    errors jsonb,
    is_valid boolean,
    processed boolean DEFAULT false,
    validated_data jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid,
    action text,
    created_at timestamp DEFAULT now(),
    changed_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_asset ON audit_logs (asset_id);

-- Audit trail: snapshot every insert, update and delete on assets.
CREATE OR REPLACE FUNCTION log_asset_action() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (asset_id, action, changed_data)
        VALUES (OLD.id, TG_OP, to_jsonb(OLD));
        RETURN OLD;
    ELSE
        INSERT INTO audit_logs (asset_id, action, changed_data)
        VALUES (NEW.id, TG_OP, to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;

CREATE OR REPLACE TRIGGER audit_assets_trigger
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION log_asset_action();

-- Row-Level Security. Each request sets the tenant for its transaction:
--   SELECT set_config('app.current_tenant', '<tenant uuid>', true);
-- Without that setting the cast below fails, so a forgotten context
-- raises an error instead of returning every tenant's rows.
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolate_tenants ON assets;
CREATE POLICY isolate_tenants ON assets
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE staged_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staged_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolate_staged_assets ON staged_assets;
CREATE POLICY isolate_staged_assets ON staged_assets
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS insert_audit_logs ON audit_logs;
CREATE POLICY insert_audit_logs ON audit_logs
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS isolate_audit_logs ON audit_logs;
CREATE POLICY isolate_audit_logs ON audit_logs
    FOR SELECT USING (
        asset_id IN (
            SELECT id FROM assets
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
        )
    );
