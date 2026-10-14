-- Refund a single order line, not just the whole order.
--
-- A refund used to cover the whole order: every point the customer spent went back and the
-- order was cancelled. When one line of three cannot be supplied, staff had to choose
-- between refunding the lot or adding the points back by hand on the Points page, which
-- left the line looking outstanding, did not know which bucket the points came from, and
-- was invisible to a later whole-order refund (which would then pay those points twice).
--
-- A line can now be refunded on its own. It moves to a 'refunded' fulfillment state, which
-- takes it out of everything that asks what is still outstanding, and records how many
-- points went back to each bucket. The whole-order refund refunds only the lines not yet
-- refunded, so the two can be mixed in either order.
--
-- Which bucket a line's points go back to: checkout spends restricted points on the lines
-- in the CBM collection first, then universal (028). The order only records the two
-- totals, not a per-line split, so a refunded CBM collection line takes restricted points first,
-- up to what the order has left to refund in that bucket, then universal. Any other line
-- goes back as universal. Done line by line in that order, the totals always come out at
-- exactly what the order spent in each bucket.
--
-- What has already been refunded is read from points_ledger (positive rows for the order),
-- not from the lines, so an order refunded before this migration reads as fully refunded
-- and cannot be refunded again line by line.
--
-- Both refunds run in the database, in one transaction with the order row locked, so two
-- admins pressing Refund at once cannot both pay out, and a failure part-way leaves nothing
-- half done.

-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

-- Nullable on purpose: the deleted orders bin (038) restores lines through
-- jsonb_populate_recordset, and a snapshot taken before this migration has no value for
-- these. A NOT NULL column would make those orders unrestorable.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_restricted_points INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_universal_points INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_with_return BOOLEAN;

COMMENT ON COLUMN order_items.refunded_at IS
  'When this line was refunded; NULL if it has not been. Set together with fulfillment_status = refunded';
COMMENT ON COLUMN order_items.refunded_restricted_points IS
  'CBM (restricted) points returned to the customer for this line';
COMMENT ON COLUMN order_items.refunded_universal_points IS
  'Universal points returned to the customer for this line';
COMMENT ON COLUMN order_items.refunded_with_return IS
  'true: the units this line took from stock were put back on the shelf when it was refunded';

-- Same as 040: drop whichever check constraint on order_items mentions fulfillment_status
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.order_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%fulfillment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END $$;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_fulfillment_status_check
  CHECK (fulfillment_status IN ('pending', 'ordered', 'ready', 'picked_up', 'refunded'));

COMMENT ON COLUMN order_items.fulfillment_status IS
  'pending: not ready; ordered: made-to-order item ordered in, not arrived; ready: waiting for the customer; picked_up: the customer has it; refunded: points returned, line no longer part of the order';

-- Same as 040, plus the refunded state. Refunding a line moves no stock here: the refund
-- functions below decide that (refund only leaves stock alone, refund with return puts the
-- units back). A refunded line cannot change state again, and only those functions can make
-- one, because they are what records the points that went back.
CREATE OR REPLACE FUNCTION draw_made_to_order_stock_when_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_make INTEGER;
  v_was_ready BOOLEAN;
  v_is_ready BOOLEAN;
BEGIN
  IF NEW.fulfillment_status IS NOT DISTINCT FROM OLD.fulfillment_status THEN
    RETURN NEW;
  END IF;

  IF OLD.fulfillment_status = 'refunded' THEN
    RAISE EXCEPTION 'This item has been refunded, so its status cannot change';
  END IF;

  IF NEW.fulfillment_status = 'refunded' THEN
    IF NEW.refunded_at IS NULL THEN
      RAISE EXCEPTION 'Use Refund item to refund an item, so its points go back to the customer';
    END IF;

    RETURN NEW;
  END IF;

  v_was_ready := OLD.fulfillment_status IN ('ready', 'picked_up');
  v_is_ready := NEW.fulfillment_status IN ('ready', 'picked_up');

  IF NOT v_was_ready AND v_is_ready THEN
    -- Becoming ready (or picked up straight away): the made units are in hand.
    -- The check on what is already drawn keeps a repeated transition from taking twice.
    IF NEW.made_to_order
      AND NEW.variant_id IS NOT NULL
      AND NEW.units_from_stock_at_ready = 0
    THEN
      v_to_make := GREATEST(NEW.quantity - NEW.units_from_stock, 0);

      IF v_to_make > 0 THEN
        -- An untracked variant (NULL count) has nothing to draw from, and records nothing
        UPDATE product_variants
        SET inventory_count = inventory_count - v_to_make,
            updated_at = NOW()
        WHERE id = NEW.variant_id
          AND inventory_count IS NOT NULL;

        IF FOUND THEN
          NEW.units_from_stock_at_ready := v_to_make;
        END IF;
      END IF;
    END IF;

  ELSIF v_was_ready AND NOT v_is_ready THEN
    -- Back to not ready or ordered: the units are not spoken for any more
    IF OLD.units_from_stock_at_ready > 0 AND NEW.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET inventory_count = inventory_count + OLD.units_from_stock_at_ready,
          updated_at = NOW()
      WHERE id = NEW.variant_id
        AND inventory_count IS NOT NULL;
    END IF;

    NEW.units_from_stock_at_ready := 0;
  END IF;

  -- Within either side (not ready <-> ordered, ready <-> picked up) nothing moves
  RETURN NEW;
END;
$$;

-- advance_order_lines_with_status (040) needs no change: it only moves lines that are
-- pending, ordered or ready, so marking the order ready or picked up leaves refunded lines
-- where they are.

-- Points the order has not yet given back, per bucket: what checkout spent, less every
-- refund already in the ledger for this order. Orders from before 028 recorded neither
-- bucket and were paid entirely from universal, the same fallback the old refund used.
CREATE OR REPLACE FUNCTION order_points_left_to_refund(
  p_order orders,
  OUT restricted_left INTEGER,
  OUT universal_left INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_restricted_paid INTEGER := COALESCE(p_order.restricted_points_used, 0);
  v_universal_paid INTEGER := COALESCE(p_order.universal_points_used, 0);
  v_restricted_refunded INTEGER;
  v_universal_refunded INTEGER;
BEGIN
  IF v_restricted_paid = 0 AND v_universal_paid = 0 THEN
    v_universal_paid := COALESCE(p_order.total_points, 0);
  END IF;

  SELECT
    COALESCE(SUM(delta_points) FILTER (WHERE point_type = 'restricted'), 0)::INTEGER,
    COALESCE(SUM(delta_points) FILTER (WHERE point_type = 'universal'), 0)::INTEGER
  INTO v_restricted_refunded, v_universal_refunded
  FROM points_ledger
  WHERE order_id = p_order.id
    AND delta_points > 0;

  restricted_left := GREATEST(v_restricted_paid - v_restricted_refunded, 0);
  universal_left := GREATEST(v_universal_paid - v_universal_refunded, 0);
END;
$$;

-- Refunds one line. Callers lock the order row first and have checked the caller is an
-- admin; this is not callable from the API on its own.
CREATE OR REPLACE FUNCTION refund_order_line(
  p_order orders,
  p_item_id UUID,
  p_with_return BOOLEAN,
  p_refunded_by UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item order_items%ROWTYPE;
  v_restricted_left INTEGER;
  v_universal_left INTEGER;
  v_line_points INTEGER;
  v_restricted INTEGER := 0;
  v_universal INTEGER := 0;
  v_shift INTEGER;
  v_eligible BOOLEAN;
  v_units_to_return INTEGER;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_item
  FROM order_items
  WHERE id = p_item_id
    AND order_id = p_order.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This item is not on this order';
  END IF;

  IF v_item.fulfillment_status = 'refunded' THEN
    RAISE EXCEPTION 'This item has already been refunded';
  END IF;

  SELECT restricted_left, universal_left
  INTO v_restricted_left, v_universal_left
  FROM order_points_left_to_refund(p_order);

  v_line_points := GREATEST(COALESCE(v_item.total_points, 0), 0);

  IF v_line_points > 0 AND v_restricted_left + v_universal_left = 0 THEN
    RAISE EXCEPTION 'This order has already been refunded';
  END IF;

  IF v_line_points > v_restricted_left + v_universal_left THEN
    RAISE EXCEPTION 'This item is worth % points but only % are left to refund on this order',
      v_line_points, v_restricted_left + v_universal_left;
  END IF;

  -- The product's collections as they are now: the line keeps no copy of them. Capping by
  -- what the order has left in each bucket means a collection change since checkout can
  -- only move points between buckets, never refund more than the order spent.
  SELECT p.collections IS NOT NULL AND 'CBM' = ANY(p.collections)
  INTO v_eligible
  FROM products p
  WHERE p.id = v_item.product_id;

  IF COALESCE(v_eligible, false) THEN
    v_restricted := LEAST(v_line_points, v_restricted_left);
  END IF;

  v_universal := v_line_points - v_restricted;

  IF v_universal > v_universal_left THEN
    v_shift := v_universal - v_universal_left;
    v_restricted := v_restricted + v_shift;
    v_universal := v_universal - v_shift;
  END IF;

  v_reason := 'Refund' || CASE WHEN p_with_return THEN ' (with return)' ELSE '' END
    || ' for ' || v_item.product_name
    || ' on order #' || UPPER(substring(p_order.id::text, 1, 8));

  IF v_restricted > 0 THEN
    INSERT INTO points_ledger (user_id, delta_points, reason, order_id, created_by, point_type)
    VALUES (p_order.user_id, v_restricted, v_reason, p_order.id, p_refunded_by, 'restricted');
  END IF;

  IF v_universal > 0 THEN
    INSERT INTO points_ledger (user_id, delta_points, reason, order_id, created_by, point_type)
    VALUES (p_order.user_id, v_universal, v_reason, p_order.id, p_refunded_by, 'universal');
  END IF;

  -- Put back exactly what left the shelf: what checkout drew, plus the made units taken
  -- when a made-to-order line was marked ready (037)
  IF p_with_return THEN
    v_units_to_return := COALESCE(v_item.units_from_stock, 0)
      + COALESCE(v_item.units_from_stock_at_ready, 0);

    IF v_item.variant_id IS NOT NULL AND v_units_to_return > 0 THEN
      UPDATE product_variants
      SET inventory_count = inventory_count + v_units_to_return,
          updated_at = NOW()
      WHERE id = v_item.variant_id
        AND inventory_count IS NOT NULL;
    END IF;
  END IF;

  UPDATE order_items
  SET fulfillment_status = 'refunded',
      refunded_at = NOW(),
      refunded_restricted_points = v_restricted,
      refunded_universal_points = v_universal,
      refunded_with_return = p_with_return,
      -- Returned units are back on the shelf, so the line no longer holds any
      units_from_stock_at_ready = CASE
        WHEN p_with_return THEN 0
        ELSE units_from_stock_at_ready
      END
  WHERE id = v_item.id;

  RETURN v_line_points;
END;
$$;

REVOKE ALL ON FUNCTION order_points_left_to_refund(orders) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refund_order_line(orders, UUID, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;

-- Refund one line of an order. The order stays open unless that was its last line.
--
-- p_refunded_by is the admin recorded on the ledger rows. The admin action runs as the
-- service role (requireAdmin), where auth.uid() is NULL and cannot say who pressed the
-- button; from an admin's own session auth.uid() is used instead.
CREATE OR REPLACE FUNCTION refund_order_item(
  p_order_id UUID,
  p_item_id UUID,
  p_with_return BOOLEAN DEFAULT false,
  p_refunded_by UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_points INTEGER;
BEGIN
  IF NOT is_admin() AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Locked so two refunds on the same order cannot both read the same points left
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_points := refund_order_line(
    v_order,
    p_item_id,
    COALESCE(p_with_return, false),
    COALESCE(auth.uid(), p_refunded_by)
  );

  -- Nothing left to collect: the order is over, the same as a whole-order refund
  IF NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = p_order_id
      AND fulfillment_status <> 'refunded'
  ) THEN
    UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;
  END IF;

  RETURN v_points;
END;
$$;

-- Refund everything on an order not refunded yet, and cancel it.
--
-- Each remaining line is refunded the same way as on its own, so the lines say what went
-- back for them. Anything still left after that (an order whose lines do not add up to
-- its total) is refunded against the order itself, so a whole-order refund always gives
-- back every point the order spent.
CREATE OR REPLACE FUNCTION refund_order(
  p_order_id UUID,
  p_with_return BOOLEAN DEFAULT false,
  p_refunded_by UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_actor UUID := COALESCE(auth.uid(), p_refunded_by);
  v_item_id UUID;
  v_restricted_left INTEGER;
  v_universal_left INTEGER;
  v_total INTEGER := 0;
  v_reason TEXT;
BEGIN
  IF NOT is_admin() AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT restricted_left, universal_left
  INTO v_restricted_left, v_universal_left
  FROM order_points_left_to_refund(v_order);

  IF v_restricted_left + v_universal_left = 0 THEN
    RAISE EXCEPTION 'This order has already been refunded';
  END IF;

  -- Lines outside the CBM collection first: their points can only go back as
  -- universal, so taking them first keeps universal from running out before them
  FOR v_item_id IN
    SELECT oi.id
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND oi.fulfillment_status <> 'refunded'
    ORDER BY (p.collections IS NOT NULL AND 'CBM' = ANY(p.collections)), oi.created_at, oi.id
  LOOP
    v_total := v_total + refund_order_line(
      v_order,
      v_item_id,
      COALESCE(p_with_return, false),
      v_actor
    );
  END LOOP;

  SELECT restricted_left, universal_left
  INTO v_restricted_left, v_universal_left
  FROM order_points_left_to_refund(v_order);

  v_reason := 'Refund' || CASE WHEN p_with_return THEN ' (with return)' ELSE '' END
    || ' for order #' || UPPER(substring(p_order_id::text, 1, 8));

  IF v_restricted_left > 0 THEN
    INSERT INTO points_ledger (user_id, delta_points, reason, order_id, created_by, point_type)
    VALUES (v_order.user_id, v_restricted_left, v_reason, p_order_id, v_actor, 'restricted');
  END IF;

  IF v_universal_left > 0 THEN
    INSERT INTO points_ledger (user_id, delta_points, reason, order_id, created_by, point_type)
    VALUES (v_order.user_id, v_universal_left, v_reason, p_order_id, v_actor, 'universal');
  END IF;

  v_total := v_total + v_restricted_left + v_universal_left;

  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION refund_order_item(UUID, UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_order_item(UUID, UUID, BOOLEAN, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION refund_order(UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refund_order(UUID, BOOLEAN, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION refund_order_item(UUID, UUID, BOOLEAN, UUID) IS
  'Admin only: returns one line''s points to the customer (CBM collection lines restricted first), optionally puts its stock back, and marks it refunded. Cancels the order when no other lines are left.';
COMMENT ON FUNCTION refund_order(UUID, BOOLEAN, UUID) IS
  'Admin only: refunds every line not refunded yet, then anything else the order has left, and cancels the order.';

-- The refund functions read an order's ledger rows on every refund
CREATE INDEX IF NOT EXISTS idx_points_ledger_order_id
  ON points_ledger(order_id)
  WHERE order_id IS NOT NULL;
