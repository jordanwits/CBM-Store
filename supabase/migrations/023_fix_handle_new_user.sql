-- Fix handle_new_user trigger - required for Supabase dashboard user creation
-- See: https://supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role TEXT := 'user';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), new_role);
  
  -- Set JWT claims (wrapped - don't fail user creation if auth.users update fails)
  BEGIN
    UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role) WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN NEW;
END;
$$;

-- Also make sync trigger resilient (in case auth.users update fails)
CREATE OR REPLACE FUNCTION public.sync_user_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role)) THEN
    BEGIN
      UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role) WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
