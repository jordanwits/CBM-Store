-- Allow admins to delete orders (e.g. for test orders, duplicates, or system cleanup)
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (is_admin());
