-- Phone-as-login without auth.users.phone: copy E.164 from user_metadata.phone_e164 into profiles.phone

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role TEXT := 'user';
  v_email TEXT;
  v_phone TEXT;
BEGIN
  v_email := NULLIF(trim(COALESCE(NEW.email, '')), '');
  v_phone := NULLIF(trim(COALESCE(NEW.phone, '')), '');
  IF v_phone IS NULL OR length(v_phone) = 0 THEN
    v_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone_e164', '')), '');
  END IF;

  INSERT INTO public.profiles (id, email, phone, full_name, role)
  VALUES (
    NEW.id,
    v_email,
    v_phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_role
  );

  BEGIN
    UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role) WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
