-- Create exports storage bucket for monthly CSV exports
-- This bucket stores monthly exports of orders and points ledger data

-- Create the bucket (not public - only admins can access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,  -- private bucket - only accessible via signed URLs
  52428800,  -- 50MB file size limit (enough for large CSV exports)
  ARRAY['text/csv', 'application/csv', 'text/plain']
);

-- Create monthly_exports table to track export metadata
CREATE TABLE monthly_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month TEXT NOT NULL, -- YYYY-MM format
  export_type TEXT NOT NULL CHECK (export_type IN ('orders', 'points_ledger', 'order_items')),
  storage_path TEXT NOT NULL, -- path in storage bucket
  file_size_bytes INTEGER,
  row_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id), -- nullable for automated exports
  UNIQUE(month, export_type) -- one export per type per month
);

-- Index for common queries
CREATE INDEX idx_monthly_exports_month ON monthly_exports(month DESC);
CREATE INDEX idx_monthly_exports_type ON monthly_exports(export_type);
CREATE INDEX idx_monthly_exports_created_at ON monthly_exports(created_at DESC);

-- Enable RLS on monthly_exports table
ALTER TABLE monthly_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies for monthly_exports table
CREATE POLICY "Admins can read all exports"
  ON monthly_exports FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert exports"
  ON monthly_exports FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete exports"
  ON monthly_exports FOR DELETE
  USING (is_admin());

-- Storage RLS policies for exports bucket

-- Only admins can view export files
CREATE POLICY "Admins can view export files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- Only admins (or service role for automation) can upload exports
CREATE POLICY "Admins can upload export files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exports' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- Only admins can delete export files
CREATE POLICY "Admins can delete export files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exports' 
    AND (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin'
  );

-- Add comment for documentation
COMMENT ON TABLE monthly_exports IS 
'Tracks monthly CSV exports of orders and points ledger. Each export is stored in the exports storage bucket and linked via storage_path.';
