-- Support phone-only auth users (email optional on profiles)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_or_phone;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_or_phone CHECK (
    (email IS NOT NULL AND length(trim(email)) > 0)
    OR (phone IS NOT NULL AND length(trim(phone)) > 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

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
