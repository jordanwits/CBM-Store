-- Decrement variant inventory when placing an order
-- place_points_order was creating orders but not adjusting stock

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
  v_current_balance INTEGER;
  v_item JSONB;
  v_product RECORD;
  v_variant RECORD;
  v_conversion_rate NUMERIC;
  v_base_points INTEGER;
  v_variant_adjustment INTEGER;
  v_item_points INTEGER;
  v_item_total INTEGER;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate delivery method
  IF p_delivery_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid delivery method. Must be pickup or delivery';
  END IF;

  -- Validate shipping fields for delivery orders
  IF p_delivery_method = 'delivery' THEN
    IF p_ship_name IS NULL OR p_ship_address_line1 IS NULL OR 
       p_ship_city IS NULL OR p_ship_state IS NULL OR 
       p_ship_zip IS NULL OR p_ship_country IS NULL THEN
      RAISE EXCEPTION 'All shipping fields are required for delivery orders';
    END IF;
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Acquire advisory lock for this user to prevent concurrent order placement
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Get store conversion rate
  SELECT usd_to_points_rate INTO v_conversion_rate
  FROM store_settings
  WHERE id = 1;

  IF v_conversion_rate IS NULL THEN
    v_conversion_rate := 100;
  END IF;

  -- Validate all items, check inventory, and calculate total points
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid
      AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    -- Calculate base points
    v_base_points := ROUND(v_product.base_usd * v_conversion_rate);
    v_variant_adjustment := 0;

    -- If variant specified, validate, lock, and check inventory
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

      -- Validate inventory (only when variant tracks stock)
      IF v_variant.inventory_count IS NOT NULL THEN
        IF v_variant.inventory_count < (v_item->>'quantity')::integer THEN
          RAISE EXCEPTION 'Insufficient stock for % (variant %). Requested %, available %',
            v_variant.name, v_item->>'variant_id', (v_item->>'quantity')::integer, v_variant.inventory_count;
        END IF;
      END IF;
    END IF;

    -- Calculate item points
    v_item_points := v_base_points + v_variant_adjustment;
    v_item_total := v_item_points * (v_item->>'quantity')::integer;

    -- Validate quantity
    IF (v_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_item->>'product_id';
    END IF;

    v_total_points := v_total_points + v_item_total;
  END LOOP;

  -- Check user's current balance (inside transaction)
  SELECT COALESCE(SUM(delta_points), 0) INTO v_current_balance
  FROM points_ledger
  WHERE user_id = v_user_id;

  IF v_current_balance < v_total_points THEN
    RAISE EXCEPTION 'Insufficient points. You have % points but need % points', 
      v_current_balance, v_total_points;
  END IF;

  -- Create the order
  INSERT INTO orders (
    user_id,
    status,
    total_points,
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
    p_delivery_method,
    p_ship_name,
    p_ship_address_line1,
    p_ship_address_line2,
    p_ship_city,
    p_ship_state,
    p_ship_zip,
    p_ship_country
  )
  RETURNING id INTO v_order_id;

  -- Insert order items and decrement inventory
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

      -- Decrement inventory when variant tracks stock
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

  -- Deduct points from user's balance
  INSERT INTO points_ledger (
    user_id,
    delta_points,
    reason,
    order_id,
    created_by
  ) VALUES (
    v_user_id,
    -v_total_points,
    'Order #' || UPPER(substring(v_order_id::text, 1, 8)),
    v_order_id,
    v_user_id
  );

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION place_points_order IS 
'Atomically creates an order, decrements variant inventory, and deducts points. Validates stock before placement. Uses advisory lock + row locks to prevent race conditions.';
