-- Run as the table owner after 001_schema.sql.

-- 1. Tenant indexes.
-- Every RLS policy filters on tenant_id. Without an index, each tenant's
-- query scans every tenant's rows (1.1 s for 500 rows out of 1.6M in testing).
CREATE INDEX IF NOT EXISTS idx_staged_assets_tenant_review
    ON staged_assets (tenant_id, is_valid, processed);

CREATE INDEX IF NOT EXISTS idx_assets_tenant
    ON assets (tenant_id);

-- 2. Isolate tenant schema definitions.
-- asset_fields previously had no policy, so one tenant could read
-- another tenant's field definitions.
ALTER TABLE asset_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_fields FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolate_asset_fields ON asset_fields;
CREATE POLICY isolate_asset_fields ON asset_fields
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
