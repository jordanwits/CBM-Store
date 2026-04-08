-- Products may still carry the old "Affinity" tag if migration 028 ran before the collection was renamed to "CBM".
UPDATE products
SET collections = array_replace(collections, 'Affinity', 'CBM')
WHERE collections IS NOT NULL AND 'Affinity' = ANY(collections);

COMMENT ON COLUMN points_ledger.point_type IS 'universal: spend anywhere; restricted: spend only on products in CBM collection';

-- 4. Checkout: spend restricted on CBM-collection subtotal first, then universal
CREATE OR REPLACE FUNCTION place_points_order(
  p_items JSONB,
  p_delivery_method TEXT,
  p_ship_name TEXT DEFAULT NULL,
  p_ship_address_line1 TEXT DEFAULT NULL,
  p_ship_address_line2 TEXT DEFAULT NULL,
  p_ship_city TEXT DEFAULT NULL,
  p_ship_state TEXT DEFAULT NULL,
  p_ship_zip TEXT DEFAULT NULL,
  p_ship_country TEXT DEFAULT NULL
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_delivery_method IS NOT NULL AND p_delivery_method <> 'pickup' THEN
    RAISE EXCEPTION 'Only pickup orders are supported';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
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

    v_base_points := ROUND(v_product.base_usd * v_conversion_rate);
    v_variant_adjustment := 0;

    IF v_item->>'variant_id' IS NOT NULL THEN
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

      IF v_variant.inventory_count IS NOT NULL THEN
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

  v_restricted_spend := LEAST(v_restricted_balance, v_eligible_points);
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
    ship_country
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
    NULL
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    v_base_points := ROUND(v_product.base_usd * v_conversion_rate);
    v_variant_adjustment := 0;
    v_variant := NULL;

    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid;

      v_variant_adjustment := ROUND(v_variant.price_adjustment_usd * v_conversion_rate);

      IF v_variant.inventory_count IS NOT NULL THEN
        UPDATE product_variants
        SET inventory_count = inventory_count - (v_item->>'quantity')::integer,
            updated_at = NOW()
        WHERE id = (v_item->>'variant_id')::uuid;
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
      quantity,
      points_per_item,
      total_points
    ) VALUES (
      v_order_id,
      v_product.id,
      CASE WHEN v_item->>'variant_id' IS NOT NULL THEN (v_item->>'variant_id')::uuid ELSE NULL END,
      v_product.name,
      CASE WHEN v_variant IS NOT NULL THEN v_variant.name ELSE NULL END,
      (v_item->>'quantity')::integer,
      v_item_points,
      v_item_total
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
'Pickup-only: creates order, inventory updates, deducts restricted then universal points for CBM-collection lines.';
