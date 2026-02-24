-- Create access_requests table for tracking public access requests
CREATE TABLE access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_access_requests_email ON access_requests(email);
CREATE INDEX idx_access_requests_status ON access_requests(status);
CREATE INDEX idx_access_requests_created_at ON access_requests(created_at DESC);

-- Enable RLS
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admins can view all access requests
CREATE POLICY "Admins can read all access requests"
  ON access_requests FOR SELECT
  USING (is_admin());

-- Admins can update access requests (for approving/rejecting)
CREATE POLICY "Admins can update access requests"
  ON access_requests FOR UPDATE
  USING (is_admin());

-- No public SELECT policy - requests are only visible to admins
-- No INSERT policy - insertions are done via service role in server action

-- Add trigger for updated_at
CREATE TRIGGER update_access_requests_updated_at 
  BEFORE UPDATE ON access_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comment
COMMENT ON TABLE access_requests IS 
  'Stores public access requests from employees. Insertions are handled via server-side service role. Admins can view and update status.';
