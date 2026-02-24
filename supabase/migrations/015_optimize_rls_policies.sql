-- Optimize RLS policies for better performance
-- The is_admin() function was being called multiple times per query
-- This optimization uses a STABLE function that can be cached within a transaction

-- Replace is_admin function (use CREATE OR REPLACE to avoid dropping dependent policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT role = 'admin' AND active = true
      FROM profiles
      WHERE id = auth.uid()
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Add comment explaining the optimization
COMMENT ON FUNCTION is_admin() IS 
  'Checks if current user is an active admin. STABLE allows caching within transaction.';

-- Optimize order_items RLS policies to use an index-friendly pattern
DROP POLICY IF EXISTS "Users can read their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON order_items;

-- These new policies are more efficient because they allow index usage
CREATE POLICY "Users can read their own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      LIMIT 1  -- Optimization: stop at first match
    )
  );

CREATE POLICY "Users can create order items for their orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      LIMIT 1  -- Optimization: stop at first match
    )
  );

-- Add index to support the order_items RLS policy
CREATE INDEX IF NOT EXISTS idx_orders_id_user_id 
  ON orders(id, user_id);

-- Analyze tables to update query planner statistics
ANALYZE profiles;
ANALYZE points_ledger;
ANALYZE products;
ANALYZE product_variants;
ANALYZE orders;
ANALYZE order_items;
