-- Allow users to insert negative point transactions for their own orders
-- This enables users to deduct points when placing orders

CREATE POLICY "Users can deduct points for their own orders"
  ON points_ledger FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND delta_points < 0
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = points_ledger.order_id
      AND orders.user_id = auth.uid()
    )
  );
