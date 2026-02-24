-- Add address fields to profiles table for default shipping address
ALTER TABLE profiles 
ADD COLUMN address_line1 TEXT,
ADD COLUMN address_line2 TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT,
ADD COLUMN zip TEXT,
ADD COLUMN country TEXT DEFAULT 'US';

-- Add comment for documentation
COMMENT ON COLUMN profiles.address_line1 IS 'Default shipping address line 1';
COMMENT ON COLUMN profiles.address_line2 IS 'Default shipping address line 2 (optional)';
COMMENT ON COLUMN profiles.city IS 'Default shipping city';
COMMENT ON COLUMN profiles.state IS 'Default shipping state/province';
COMMENT ON COLUMN profiles.zip IS 'Default shipping ZIP/postal code';
COMMENT ON COLUMN profiles.country IS 'Default shipping country (defaults to US)';
