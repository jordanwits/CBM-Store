-- The last SECURITY DEFINER functions without a fixed search_path get one.
--
-- A SECURITY DEFINER function runs with its owner's rights but resolves unqualified names
-- through the caller's search_path, so a caller who could put a schema ahead of public
-- could have it pick up their own table or function. These three are the ones left; every
-- other definer function in the chain already sets it. Their bodies only reach outside
-- public through schema-qualified names (auth.uid(), auth.users), so pinning it changes
-- nothing they do.
--
-- Migrations here are pasted into the dashboard SQL Editor by hand; ALTER FUNCTION ... SET
-- is safe to run twice.

ALTER FUNCTION public.is_admin() SET search_path = public;

ALTER FUNCTION public.set_user_claims(uuid, text) SET search_path = public;

ALTER FUNCTION public.place_points_order(jsonb, text, text, text, text, text, text, text, text, text)
  SET search_path = public;
