-- Made-to-order units come out of inventory when the line is marked ready for pickup.
--
-- Since 033 checkout takes whatever is on the shelf for a made-to-order line and leaves the
-- rest (quantity - units_from_stock) to be made. Nothing ever took that rest out of
-- inventory. Staff add the units to stock when they arrive, so after the customer had them
-- the count still included them, and staff were correcting it by hand after every order.
--
-- The store's rule is that the made units leave inventory when the line is marked ready for
-- pickup: that is the moment they are set aside for this customer. A trigger on order_items
-- does it, so every way of marking a line ready (the line's dropdown, a pickup notice, the
-- whole order being marked ready below, the SQL editor) draws the same way. Moving a line
-- back to not ready puts the units back.
--
-- The count is allowed to go below zero. If staff mark a line ready before adding the units
-- that arrived, a negative count says so, and adding them afterwards brings it back to the
-- right number. Stopping at zero would quietly lose those units instead.
--
-- Lines already ready or picked up when this runs are left alone: whatever staff did by hand
-- for them is not recorded anywhere, so there is nothing safe to backfill.

-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS units_from_stock_at_ready INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_items.units_from_stock_at_ready IS
  'Units of the made-to-order portion currently taken out of inventory because the line was marked ready; returned if it goes back to pending';

-- BEFORE UPDATE so the amount drawn is recorded on the same row write that changed the
-- status. SECURITY DEFINER because the update can come from an admin's own session (when the
-- service key is not configured), and the inventory write must not depend on that session's
-- product_variants policies.
CREATE OR REPLACE FUNCTION draw_made_to_order_stock_when_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_make INTEGER;
BEGIN
  IF NEW.fulfillment_status IS NOT DISTINCT FROM OLD.fulfillment_status THEN
    RETURN NEW;
  END IF;

  IF OLD.fulfillment_status = 'pending' THEN
    -- Leaving pending (to ready, or straight to picked up): the made units are in hand.
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

  ELSIF NEW.fulfillment_status = 'pending' THEN
    -- Back to not ready: the units are not spoken for any more
    IF OLD.units_from_stock_at_ready > 0 AND NEW.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET inventory_count = inventory_count + OLD.units_from_stock_at_ready,
          updated_at = NOW()
      WHERE id = NEW.variant_id
        AND inventory_count IS NOT NULL;
    END IF;

    NEW.units_from_stock_at_ready := 0;
  END IF;

  -- ready <-> picked_up moves nothing: the units already left inventory at ready
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS draw_made_to_order_stock_when_ready ON order_items;

CREATE TRIGGER draw_made_to_order_stock_when_ready
  BEFORE UPDATE OF fulfillment_status ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION draw_made_to_order_stock_when_ready();

-- Marking the whole order ready for pickup marks its lines ready too.
--
-- 'shipped' is the stored value behind the "Ready for pickup" label and 'delivered' behind
-- "Picked up" (see lib/orders/status.ts), the same mapping 034 used to backfill the lines.
-- Without this, staff who mark the order rather than each line would see nothing come out
-- of inventory. Only lines that are behind move, so a line already picked up stays picked
-- up, and moving the order backwards leaves the lines where they are for staff to set.
-- The line updates fire the trigger above, which does the drawing.
CREATE OR REPLACE FUNCTION advance_order_lines_with_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'shipped' THEN
    UPDATE order_items
    SET fulfillment_status = 'ready'
    WHERE order_id = NEW.id
      AND fulfillment_status = 'pending';
  ELSIF NEW.status = 'delivered' THEN
    UPDATE order_items
    SET fulfillment_status = 'picked_up'
    WHERE order_id = NEW.id
      AND fulfillment_status IN ('pending', 'ready');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advance_order_lines_with_status ON orders;

CREATE TRIGGER advance_order_lines_with_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('shipped', 'delivered'))
  EXECUTE FUNCTION advance_order_lines_with_status();
