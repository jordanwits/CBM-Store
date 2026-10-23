-- Four checkout holes found in the 2026-10-23 bug sweep. place_points_order is otherwise
-- unchanged from 036.
--
-- 1. A negative CBM balance no longer costs extra universal points. The restricted spend was
--    LEAST(balance, eligible) with no floor, so once an admin deduction left the bucket at
--    -500, a 1000-point order spent -500 restricted and 1500 universal: the customer paid
--    the deficit on top, and it stayed. A bucket below zero now just has nothing to spend.
-- 2. A product that has variants can no longer be ordered without one. Every stock check and
--    price adjustment hangs off the variant, so such a line (left in a cart from before the
--    product had sizes, or sent straight to the API) took no stock, skipped the variant's
--    price, and left staff no size to hand over.
-- 3. The same product and variant can only be on one line. Each line was checked against the
--    whole stock count on its own, and nothing came off until every line had passed, so two
--    lines of 5 against a count of 5 both passed and left -5.
-- 4. A deactivated account can no longer place orders. Deactivating only set profiles.active,
--    which checkout never read.
--
-- The signature is unchanged, so CREATE OR REPLACE keeps the function's owner and grants,
-- and running this twice is harmless.

-- Checkout: same as 036, plus the four checks above
CREATE OR REPLACE FUNCTION place_points_order(
  p_items JSONB,
  p_delivery_method TEXT,
  p_ship_name TEXT DEFAULT NULL,
  p_ship_address_line1 TEXT DEFAULT NULL,
  p_ship_address_line2 TEXT DEFAULT NULL,
  p_ship_city TEXT DEFAULT NULL,
  p_ship_state TEXT DEFAULT NULL,
  p_ship_zip TEXT DEFAULT NULL,
  p_ship_country TEXT DEFAULT NULL,
  p_customer_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_total_points INTEGER := 0;
  v_eligible_points INTEGER := 0;
  v_item JSONB;
  v_product RECORD;
  v_variant RECORD;
  v_variant_name TEXT;
  v_variant_size TEXT;
  v_variant_color TEXT;
  v_units_from_stock INTEGER;
  v_conversion_rate NUMERIC;
  v_base_points INTEGER;
  v_variant_adjustment INTEGER;
  v_item_points INTEGER;
  v_item_total INTEGER;
  v_restricted_balance INTEGER;
  v_universal_balance INTEGER;
  v_restricted_spend INTEGER;
  v_universal_spend INTEGER;
  v_cbm_collection_eligible BOOLEAN;
  v_customer_note TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- A deactivated account keeps its points but cannot spend them
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND active) THEN
    RAISE EXCEPTION 'This account is inactive';
  END IF;

  IF p_delivery_method IS NOT NULL AND p_delivery_method <> 'pickup' THEN
    RAISE EXCEPTION 'Only pickup orders are supported';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- One line per product and variant. Each line is checked against the whole stock count on
  -- its own, so a second line for the same variant would oversell. The app merges repeats.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS x
    GROUP BY x->>'product_id', x->>'variant_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'The same item is on more than one line';
  END IF;

  -- Whitespace-only counts as no note, so the admin page never shows an empty box
  v_customer_note := NULLIF(BTRIM(p_customer_note), '');

  IF char_length(v_customer_note) > 1000 THEN
    RAISE EXCEPTION 'Order note is too long (1000 characters at most)';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  SELECT usd_to_points_rate INTO v_conversion_rate
  FROM store_settings
  WHERE id = 1;

  IF v_conversion_rate IS NULL THEN
    v_conversion_rate := 100;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid
      AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    -- Stock and the variant's price both hang off the variant, so a product that has
    -- variants has to be ordered as one of them
    IF v_item->>'variant_id' IS NULL
       AND EXISTS (SELECT 1 FROM product_variants WHERE product_id = v_product.id) THEN
      RAISE EXCEPTION 'Choose a size or color for %', v_product.name;
    END IF;

    v_base_points := ROUND(v_product.base_usd * v_conversion_rate);
    v_variant_adjustment := 0;

    IF v_item->>'variant_id' IS NOT NULL THEN
      -- Locks the row for the rest of the transaction, so the count read in the second
      -- loop is the same one checked here even under concurrent checkouts
      SELECT * INTO v_variant
      FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid
        AND product_id = v_product.id
        AND active = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant % not found, inactive, or does not belong to product %',
          v_item->>'variant_id', v_item->>'product_id';
      END IF;

      v_variant_adjustment := ROUND(v_variant.price_adjustment_usd * v_conversion_rate);

      -- Made-to-order products get made when stock runs out, so stock never gates them
      IF NOT v_product.made_to_order AND v_variant.inventory_count IS NOT NULL THEN
        IF v_variant.inventory_count < (v_item->>'quantity')::integer THEN
          RAISE EXCEPTION 'Insufficient stock for % (variant %). Requested %, available %',
            v_variant.name, v_item->>'variant_id', (v_item->>'quantity')::integer, v_variant.inventory_count;
        END IF;
      END IF;
    END IF;

    v_item_points := v_base_points + v_variant_adjustment;
    v_item_total := v_item_points * (v_item->>'quantity')::integer;

    IF (v_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'product_id';
    END IF;

    v_total_points := v_total_points + v_item_total;

    v_cbm_collection_eligible := v_product.collections IS NOT NULL
      AND 'CBM' = ANY(v_product.collections);

    IF v_cbm_collection_eligible THEN
      v_eligible_points := v_eligible_points + v_item_total;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(CASE WHEN point_type = 'restricted' THEN delta_points ELSE 0 END), 0)::INTEGER
    INTO v_restricted_balance
  FROM points_ledger
  WHERE user_id = v_user_id;

  SELECT COALESCE(SUM(CASE WHEN point_type = 'universal' THEN delta_points ELSE 0 END), 0)::INTEGER
    INTO v_universal_balance
  FROM points_ledger
  WHERE user_id = v_user_id;

  -- A restricted balance below zero has nothing to spend. Without the floor it became a
  -- negative spend, and the universal bucket covered the order plus the deficit.
  v_restricted_spend := GREATEST(LEAST(v_restricted_balance, v_eligible_points), 0);
  v_universal_spend := v_total_points - v_restricted_spend;

  IF v_universal_balance < v_universal_spend THEN
    RAISE EXCEPTION 'Insufficient points. Need % universal points for this cart (you have %). Total order % pts; CBM-collection portion % pts.',
      v_universal_spend, v_universal_balance, v_total_points, v_eligible_points;
  END IF;

  INSERT INTO orders (
    user_id,
    status,
    total_points,
    restricted_points_used,
    universal_points_used,
    delivery_method,
    ship_name,
    ship_address_line1,
    ship_address_line2,
    ship_city,
    ship_state,
    ship_zip,
    ship_country,
    customer_note
  ) VALUES (
    v_user_id,
    'new',
    v_total_points,
    v_restricted_spend,
    v_universal_spend,
    'pickup',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    v_customer_note
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    v_base_points := ROUND(v_product.base_usd * v_conversion_rate);
    v_variant_adjustment := 0;
    v_variant_name := NULL;
    v_variant_size := NULL;
    v_variant_color := NULL;
    v_units_from_stock := 0;

    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid;

      v_variant_name := v_variant.name;
      v_variant_size := v_variant.size;
      v_variant_color := v_variant.color;
      v_variant_adjustment := ROUND(v_variant.price_adjustment_usd * v_conversion_rate);

      -- A NULL count is an untracked variant: nothing to draw down, nothing to record
      IF v_variant.inventory_count IS NOT NULL THEN
        IF v_product.made_to_order THEN
          -- Take what is on the shelf and have the rest made. GREATEST guards a count
          -- left negative by an earlier manual edit from reading as stock to give away.
          v_units_from_stock := LEAST(
            (v_item->>'quantity')::integer,
            GREATEST(v_variant.inventory_count, 0)
          );
        ELSE
          -- Stocked lines were already checked against the count above
          v_units_from_stock := (v_item->>'quantity')::integer;
        END IF;

        IF v_units_from_stock > 0 THEN
          UPDATE product_variants
          SET inventory_count = inventory_count - v_units_from_stock,
              updated_at = NOW()
          WHERE id = (v_item->>'variant_id')::uuid;
        END IF;
      END IF;
    END IF;

    v_item_points := v_base_points + v_variant_adjustment;
    v_item_total := v_item_points * (v_item->>'quantity')::integer;

    INSERT INTO order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      variant_size,
      variant_color,
      quantity,
      units_from_stock,
      points_per_item,
      total_points,
      made_to_order
    ) VALUES (
      v_order_id,
      v_product.id,
      CASE WHEN v_item->>'variant_id' IS NOT NULL THEN (v_item->>'variant_id')::uuid ELSE NULL END,
      v_product.name,
      v_variant_name,
      v_variant_size,
      v_variant_color,
      (v_item->>'quantity')::integer,
      v_units_from_stock,
      v_item_points,
      v_item_total,
      v_product.made_to_order
    );
  END LOOP;

  IF v_restricted_spend > 0 THEN
    INSERT INTO points_ledger (
      user_id,
      delta_points,
      reason,
      order_id,
      created_by,
      point_type
    ) VALUES (
      v_user_id,
      -v_restricted_spend,
      'Order #' || UPPER(substring(v_order_id::text, 1, 8)),
      v_order_id,
      v_user_id,
      'restricted'
    );
  END IF;

  IF v_universal_spend > 0 THEN
    INSERT INTO points_ledger (
      user_id,
      delta_points,
      reason,
      order_id,
      created_by,
      point_type
    ) VALUES (
      v_user_id,
      -v_universal_spend,
      'Order #' || UPPER(substring(v_order_id::text, 1, 8)),
      v_order_id,
      v_user_id,
      'universal'
    );
  END IF;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION place_points_order IS
'Pickup-only: creates order (with the customer''s optional note), draws each line from stock (made-to-order lines take only what is on hand), deducts restricted then universal points for CBM-collection lines.';
