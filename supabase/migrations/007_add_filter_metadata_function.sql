-- Create a function to fetch all filter metadata in one call
-- This combines categories, collections, sizes, and colors into a single query
-- Reduces 4 queries down to 1

CREATE OR REPLACE FUNCTION get_filter_metadata()
RETURNS JSON AS $$
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
      WHERE active = true AND collections IS NOT NULL
    ),
    'sizes', (
      SELECT json_agg(DISTINCT size ORDER BY size)
      FROM product_variants
      WHERE active = true AND size IS NOT NULL
    ),
    'colors', (
      SELECT json_agg(DISTINCT color ORDER BY color)
      FROM product_variants
      WHERE active = true AND color IS NOT NULL
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_filter_metadata() IS 
'Returns all filter options (categories, collections, sizes, colors) in a single query for dashboard filters.';
