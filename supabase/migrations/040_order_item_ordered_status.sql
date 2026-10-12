-- An "Ordered" step for an order line: made to order, ordered in, not here yet.
--
-- The line states were not ready, ready for pickup, and picked up. For a made-to-order item
-- "not ready" covered both "nobody has ordered this yet" and "it is ordered and on its way",
-- and staff could not tell which without asking whoever does the ordering. 'ordered' records
-- the second.
--
-- An ordered line is still not ready: nothing has arrived, so nothing is set aside for the
-- customer. The made units still leave inventory only when the line becomes ready or picked
-- up, and moving it back to not ready or ordered puts them back. Not ready <-> ordered moves
-- no stock. Marking the whole order ready for pickup or picked up moves ordered lines along
-- with the not-ready ones.

-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

-- The check was added inline with the column, so its name was generated. Drop whichever
-- check constraint on order_items mentions fulfillment_status rather than trusting a name.
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
  CHECK (fulfillment_status IN ('pending', 'ordered', 'ready', 'picked_up'));

COMMENT ON COLUMN order_items.fulfillment_status IS
  'pending: not ready; ordered: made-to-order item ordered in, not arrived; ready: waiting for the customer; picked_up: the customer has it';

-- Same as before, with 'ordered' on the not-ready side of the line
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

-- Same as before, with ordered lines moving along with not-ready ones
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
      AND fulfillment_status IN ('pending', 'ordered');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE order_items
    SET fulfillment_status = 'picked_up'
    WHERE order_id = NEW.id
      AND fulfillment_status IN ('pending', 'ordered', 'ready');
  END IF;

  RETURN NEW;
END;
$$;
