-- Inventory snapshot as a fourth export type.
--
-- The first three exports all answer "what happened during month X" and read from order
-- history. An inventory export answers a different question — "what is on the shelf right
-- now" — so it has no month to belong to. Rather than add a nullable column nothing else
-- would use, an inventory row stores the snapshot date (YYYY-MM-DD) in `month`, which
-- still sorts correctly next to the YYYY-MM rows and still reads as a date on screen.

ALTER TABLE monthly_exports
  DROP CONSTRAINT IF EXISTS monthly_exports_export_type_check;

ALTER TABLE monthly_exports
  ADD CONSTRAINT monthly_exports_export_type_check
  CHECK (export_type IN ('orders', 'points_ledger', 'order_items', 'inventory'));

COMMENT ON COLUMN monthly_exports.month IS
  'YYYY-MM for the order/points exports, or YYYY-MM-DD for an inventory snapshot, which is point-in-time rather than monthly';
