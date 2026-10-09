-- Customers can change their own name and address, and nothing else on their profile.
--
-- 002 lets a signed-in user update their own profile row ("Users can update their own
-- profile", USING auth.uid() = id). Row-level security decides which rows, not which
-- columns, and the API role is granted UPDATE on every column. So any customer could call
-- the database API directly with the public key and set their own role to 'admin' or flip
-- their active flag, and the admin area would then let them in. The store's own pages never
-- do this, but nothing stopped someone else's request from doing it.
--
-- A trigger closes it. When a signed-in non-admin changes a profile through the API, only
-- the fields the profile page edits may differ: name and address. Any other change (role,
-- active, email, phone, and any column added later) is refused. Inserting a profile as a
-- non-admin may only create an ordinary, active one, which covers a user whose profile row
-- is missing creating their own as an admin.
--
-- Nothing else is restricted. The admin actions run as the service role, the SQL editor and
-- the sign-up trigger run as database roles of their own, and an admin's own session passes
-- is_admin(), so creating users, changing roles and deactivating accounts all work as before.

-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

-- Deliberately not SECURITY DEFINER: the check reads current_user, which has to stay the
-- caller's role ('authenticated' for a signed-in customer through the API).
CREATE OR REPLACE FUNCTION guard_profile_self_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- What the profile page lets a customer edit. updated_at is set by its own trigger.
  v_editable CONSTANT TEXT[] := ARRAY[
    'full_name',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'zip',
    'country',
    'updated_at'
  ];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user' OR NEW.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Only an admin can create an admin or inactive profile'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Compared as JSON with the editable fields taken out, so a column added to profiles
  -- later is protected without this function having to name it
  IF (to_jsonb(NEW) - v_editable) IS DISTINCT FROM (to_jsonb(OLD) - v_editable) THEN
    RAISE EXCEPTION 'Only your name and address can be changed on your own profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_service ON profiles;

CREATE TRIGGER guard_profile_self_service
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_self_service();
