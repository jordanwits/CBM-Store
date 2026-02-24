-- Remove unique constraint on monthly_exports to allow multiple exports per month/type
-- This allows users to regenerate exports or create multiple exports for the same month/type

ALTER TABLE monthly_exports 
DROP CONSTRAINT IF EXISTS monthly_exports_month_export_type_key;

-- Add a comment explaining the change
COMMENT ON TABLE monthly_exports IS 
'Tracks monthly CSV exports of orders and points ledger. Each export is stored in the exports storage bucket and linked via storage_path. Multiple exports can exist for the same month and export type.';
