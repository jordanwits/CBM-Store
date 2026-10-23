-- Deactivating an account now stops it signing in.
--
-- profiles.active was only a flag. Neither email nor phone sign-in checked it, and nothing
-- else read it, so a deactivated employee could still sign in either way, or carry on in a
-- session they already had. Checkout refuses inactive accounts since 043; they could still
-- browse and look around their account.
--
-- Supabase Auth refuses sign-in, and refreshing a session, for a user whose banned_until is
-- in the future. A trigger now keeps auth.users.banned_until in step with profiles.active:
-- set 100 years out when an account is deactivated, cleared when it is reactivated. It sits
-- on the profile rather than in the admin action, so a change made anywhere (the users page
-- or the SQL editor) has the same effect. A session already open lasts until its access
-- token expires (an hour by default) and cannot be refreshed after that.
--
-- 100 years rather than 'infinity', which Auth cannot read back as a date.
--
-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

CREATE OR REPLACE FUNCTION public.sync_user_ban_with_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    UPDATE auth.users
    SET banned_until = CASE WHEN NEW.active THEN NULL ELSE now() + interval '100 years' END
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_user_ban_with_active() OWNER TO postgres;

DROP TRIGGER IF EXISTS sync_user_ban_with_active ON public.profiles;
CREATE TRIGGER sync_user_ban_with_active
  AFTER UPDATE OF active ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_ban_with_active();

-- Accounts deactivated before this
UPDATE auth.users u
SET banned_until = now() + interval '100 years'
FROM public.profiles p
WHERE p.id = u.id
  AND NOT p.active
  AND (u.banned_until IS NULL OR u.banned_until < now());
