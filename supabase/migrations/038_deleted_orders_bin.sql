-- Deleted orders go to a bin that an admin can restore from.
--
-- Deleting an order used to be final: the row and its lines were gone, and the only trace
-- left was the points deduction in points_ledger, which has no foreign key to orders. One
-- mis-click on the wrong row was enough to lose an order for good.
--
-- A trigger on orders now copies the order and its lines into deleted_orders just before
-- the row goes. Because it is a trigger rather than something the delete action does, it
-- also catches a delete run from the SQL editor or cascaded from another table. Nothing that
-- reads orders has to learn about a "deleted" flag: a binned order is simply not in orders.
--
-- Deleting never touched inventory or points, so restoring does not either. The points
-- deduction stayed in the ledger the whole time and lines up with the order again once it
-- is back.

-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

CREATE TABLE IF NOT EXISTS deleted_orders (
  order_id UUID PRIMARY KEY,
  -- to_jsonb of the orders row and of each order_items row, exactly as they were
  order_data JSONB NOT NULL,
  items_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE deleted_orders IS
  'Snapshots of deleted orders and their lines, so an admin can restore them';

CREATE INDEX IF NOT EXISTS idx_deleted_orders_deleted_at
  ON deleted_orders(deleted_at DESC);

ALTER TABLE deleted_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read deleted orders" ON deleted_orders;

CREATE POLICY "Admins can read deleted orders"
  ON deleted_orders FOR SELECT
  USING (is_admin());

-- The only direct write is the delete action stamping who pressed the button (the trigger
-- runs under the service role there, where auth.uid() is NULL). requireAdmin() falls back to
-- the admin's own client when SUPABASE_SERVICE_ROLE_KEY is unset, so this needs a policy.
DROP POLICY IF EXISTS "Admins can update deleted orders" ON deleted_orders;

CREATE POLICY "Admins can update deleted orders"
  ON deleted_orders FOR UPDATE
  USING (is_admin());

-- BEFORE DELETE, so the order's lines are still there to copy: the ON DELETE CASCADE on
-- order_items runs after the orders row itself is removed.
--
-- SECURITY DEFINER so the copy lands whoever is deleting; there is no INSERT policy on
-- deleted_orders for anyone to use directly. search_path is pinned to public because
-- is_admin() and the tables are referenced unqualified throughout this schema.
CREATE OR REPLACE FUNCTION snapshot_deleted_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO deleted_orders (order_id, order_data, items_data, deleted_at, deleted_by)
  VALUES (
    OLD.id,
    to_jsonb(OLD),
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(oi)) FROM order_items oi WHERE oi.order_id = OLD.id),
      '[]'::jsonb
    ),
    NOW(),
    auth.uid()
  )
  -- An order restored and then deleted again replaces its earlier snapshot
  ON CONFLICT (order_id) DO UPDATE
    SET order_data = EXCLUDED.order_data,
        items_data = EXCLUDED.items_data,
        deleted_at = EXCLUDED.deleted_at,
        deleted_by = EXCLUDED.deleted_by;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_deleted_order ON orders;

CREATE TRIGGER snapshot_deleted_order
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_deleted_order();

-- Puts a binned order back exactly as it was, lines included, in one transaction.
--
-- The snapshot is replayed through jsonb_populate_record, so every column comes back
-- without this function having to list them. A column added to orders or order_items later
-- with NOT NULL and no value in an older snapshot would need handling here.
--
-- Callers: the restore action runs as the service role (requireAdmin), or as the admin's
-- own session when the service key is not configured. Anyone else is refused.
CREATE OR REPLACE FUNCTION restore_deleted_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bin deleted_orders%ROWTYPE;
  v_items JSONB;
BEGIN
  IF NOT is_admin() AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Locked so two admins pressing Restore at once cannot both replay it
  SELECT * INTO v_bin
  FROM deleted_orders
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This order is not in the deleted orders list';
  END IF;

  IF EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'An order with this number already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = (v_bin.order_data ->> 'user_id')::uuid
  ) THEN
    RAISE EXCEPTION 'The customer on this order no longer has an account, so it cannot be restored';
  END IF;

  -- A product cannot be deleted while an order points at it, but a binned order no longer
  -- does, so one of its products may have gone since
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_bin.items_data) AS item
    WHERE NOT EXISTS (
      SELECT 1 FROM products p WHERE p.id = (item ->> 'product_id')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'A product on this order has since been deleted, so it cannot be restored';
  END IF;

  -- A variant removed in the meantime only loses the link: the line keeps its own copy of
  -- the variant's name, size and colour, which is what every order page prints
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN item ->> 'variant_id' IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM product_variants pv WHERE pv.id = (item ->> 'variant_id')::uuid
          )
        THEN jsonb_set(item, '{variant_id}', 'null'::jsonb)
        ELSE item
      END
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM jsonb_array_elements(v_bin.items_data) AS item;

  INSERT INTO orders
  SELECT * FROM jsonb_populate_record(NULL::orders, v_bin.order_data);

  INSERT INTO order_items
  SELECT * FROM jsonb_populate_recordset(NULL::order_items, v_items);

  DELETE FROM deleted_orders WHERE order_id = p_order_id;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION restore_deleted_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION restore_deleted_order(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION restore_deleted_order(UUID) IS
  'Admin only: re-inserts a binned order and its lines from deleted_orders, then removes the snapshot.';
