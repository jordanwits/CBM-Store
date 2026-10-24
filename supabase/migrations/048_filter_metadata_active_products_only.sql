-- Storefront filter options only list sizes and colours a customer can actually buy.
--
-- get_filter_metadata read sizes and colours from every active variant, including those of
-- products that are switched off, so a filter could offer a size that then found "No
-- products". They now come from active variants of active products.

-- The admin-only "Custom Order" tag (any casing) is also left out of the collections, as
-- it already was in the Affinity store; it was showing up as a storefront filter here.
--
-- It also gets a fixed search_path, as a SECURITY DEFINER function should.
--
-- Migrations here are pasted into the dashboard SQL Editor by hand; CREATE OR REPLACE keeps
-- this safe to run twice.

CREATE OR REPLACE FUNCTION get_filter_metadata()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'categories', (
      SELECT json_agg(DISTINCT category ORDER BY category)
      FROM products
      WHERE active = true AND category IS NOT NULL
    ),
    'collections', (
      SELECT json_agg(DISTINCT collection ORDER BY collection)
      FROM products, unnest(collections) AS collection
      WHERE active = true
        AND collections IS NOT NULL
        AND lower(trim(collection)) <> 'custom order'
    ),
    'sizes', (
      SELECT json_agg(DISTINCT v.size ORDER BY v.size)
      FROM product_variants v
      JOIN products p ON p.id = v.product_id AND p.active = true
      WHERE v.active = true AND v.size IS NOT NULL
    ),
    'colors', (
      SELECT json_agg(DISTINCT v.color ORDER BY v.color)
      FROM product_variants v
      JOIN products p ON p.id = v.product_id AND p.active = true
      WHERE v.active = true AND v.color IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_filter_metadata() IS
'Returns storefront filter options: sizes and colours of active variants of active products. Admin-only tag Custom Order (any casing) is omitted from collections.';
