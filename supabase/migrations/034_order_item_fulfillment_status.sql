-- Per-line fulfillment state, so an order can be collected in stages.
--
-- orders.status describes the order as a whole, which is the right shape until one line
-- holds up the rest: a made-to-order item is still being made while everything else sits
-- on the shelf ready to hand over. The single field cannot say "three of these four are
-- collectable", so that fact lived in staff memory and in the wording of whatever email
-- someone last sent.
--
-- This records it per line. orders.status is left alone and stays the authoritative
-- order-level state — nothing here derives, overrides, or advances it. What the lines add
-- is a count: how much of this order is still outstanding, readable from the order list
-- without opening the order.

-- Migrations here are pasted into the dashboard SQL Editor by hand (see
-- SETUP_INSTRUCTIONS.txt), so this file has to survive being run twice. The backfill is the
-- dangerous half: on a second run it would re-derive every line from the order-level status
-- and wipe out whatever staff had marked since. Gating on "did the column already exist"
-- keeps it strictly first-run-only.
DO $$
DECLARE
  v_already_present BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_items'
      AND column_name = 'fulfillment_status'
  ) INTO v_already_present;

  IF v_already_present THEN
    RAISE NOTICE 'order_items.fulfillment_status already exists; leaving existing values alone';
    RETURN;
  END IF;

  ALTER TABLE order_items
    ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (fulfillment_status IN ('pending', 'ready', 'picked_up'));

  -- Existing orders get the state their order-level status already implied, so nothing that
  -- shipped before this migration reads as newly outstanding. 'shipped' is the stored value
  -- behind the "Ready for pickup" label and 'delivered' behind "Picked up" (see
  -- lib/orders/status.ts); a cancelled order's lines were never handed over, so they stay
  -- pending and the cancellation itself carries the meaning.
  UPDATE order_items oi
  SET fulfillment_status = CASE
    WHEN o.status = 'delivered' THEN 'picked_up'
    WHEN o.status = 'shipped' THEN 'ready'
    ELSE 'pending'
  END
  FROM orders o
  WHERE o.id = oi.order_id;
END $$;

COMMENT ON COLUMN order_items.fulfillment_status IS
  'pending: not collectable yet (being made or not gathered); ready: waiting for the customer; picked_up: the customer has it';

-- order_items has never had an UPDATE policy: every write until now happened inside
-- place_points_order, which is SECURITY DEFINER and bypasses RLS. Marking a line ready is
-- the first ordinary update, and requireAdmin() falls back to the caller's own client when
-- SUPABASE_SERVICE_ROLE_KEY is unset, where the write would otherwise be dropped silently.
-- Dropped first because CREATE POLICY has no IF NOT EXISTS form and would abort a re-run.
DROP POLICY IF EXISTS "Admins can update all order items" ON order_items;

CREATE POLICY "Admins can update all order items"
  ON order_items FOR UPDATE
  USING (is_admin());

-- Supports the per-order rollup the order lists run over a page of orders at a time.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_fulfillment
  ON order_items(order_id, fulfillment_status);

ANALYZE order_items;
