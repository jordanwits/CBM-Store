-- DISABLED: a one-time wipe of test data before launch. It has already run.
--
-- Running it again (pasting it into the SQL Editor, or replaying the chain onto the live
-- database) would delete every real order, order line, points balance and monthly export.
-- Its statements are kept below, commented out, as a record of what it did. On a new,
-- empty database it had nothing to delete, so leaving it out changes nothing there.
--
-- To wipe test data deliberately, copy the statements out and run them by hand.

-- Wipe test data: orders, order items, points ledger, and monthly exports
-- This script restores inventory and clears all transaction/order history
-- User data (profiles) is preserved

-- Step 1: Restore inventory for all order items
-- This reverses the inventory decrements that happened when orders were placed
-- UPDATE product_variants pv
-- SET inventory_count = pv.inventory_count + COALESCE(restore.quantity, 0),
--     updated_at = NOW()
-- FROM (
--   SELECT 
--     oi.variant_id,
--     SUM(oi.quantity) as quantity
--   FROM order_items oi
--   WHERE oi.variant_id IS NOT NULL
--   GROUP BY oi.variant_id
-- ) restore
-- WHERE pv.id = restore.variant_id
--   AND pv.inventory_count IS NOT NULL;

-- Step 2: Delete order items (must be deleted before orders due to FK constraint)
-- DELETE FROM order_items;

-- Step 3: Delete all orders
-- DELETE FROM orders;

-- Step 4: Delete all points ledger entries (transaction history)
-- This effectively wipes all user points balances since points are calculated from ledger
-- DELETE FROM points_ledger;

-- Step 5: Delete monthly exports (since they reference wiped data)
-- DELETE FROM monthly_exports;

-- Note: User profiles, products, product_variants, and store_settings are preserved
-- Inventory has been restored to pre-order levels
