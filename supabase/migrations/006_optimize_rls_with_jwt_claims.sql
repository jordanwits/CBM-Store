-- Optimize RLS by using JWT claims instead of database lookups
-- This dramatically improves query performance by avoiding repeated profile table lookups

-- Function to set custom claims in JWT
-- This will store the user's role in their JWT token for instant access
CREATE OR REPLACE FUNCTION set_user_claims(user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- Update the user's raw_app_meta_data to include role
  -- This gets included in the JWT token
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_admin() to use JWT claims instead of database lookup
-- This avoids a SELECT query on every RLS check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin',
    false
  );
$$ LANGUAGE SQL STABLE;

-- Trigger function to sync JWT claims when profile role changes
CREATE OR REPLACE FUNCTION sync_user_role_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
  -- Update JWT claims whenever role changes
  IF (TG_OP = 'INSERT' OR NEW.role != OLD.role) THEN
    PERFORM set_user_claims(NEW.id, NEW.role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to sync role changes to JWT
DROP TRIGGER IF EXISTS sync_profile_role_to_jwt ON profiles;
CREATE TRIGGER sync_profile_role_to_jwt
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role_to_jwt();

-- Update existing users' JWT claims with their current roles
-- This ensures all existing users have the role in their JWT
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, role FROM profiles LOOP
    PERFORM set_user_claims(user_record.id, user_record.role);
  END LOOP;
END $$;

-- Also update the handle_new_user function to set JWT claims on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT := 'user';
BEGIN
  -- Create profile
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', new_role);
  
  -- Set JWT claims immediately
  PERFORM set_user_claims(NEW.id, new_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for fallback scenarios (if JWT isn't available for some reason)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role_active ON profiles(id, role, active);

-- Comment explaining the optimization
COMMENT ON FUNCTION is_admin() IS 
'Checks if current user is admin using JWT claims (fast). Avoids database lookups in RLS policies.';

COMMENT ON FUNCTION set_user_claims(UUID, TEXT) IS
'Sets custom JWT claims for a user. Called automatically when profile role changes.';
