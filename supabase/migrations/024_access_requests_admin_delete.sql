-- Allow admins to delete access requests (for declining)
CREATE POLICY "Admins can delete access requests"
  ON access_requests FOR DELETE
  USING (is_admin());
