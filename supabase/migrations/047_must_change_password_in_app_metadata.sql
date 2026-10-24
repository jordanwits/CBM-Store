-- The "must change password" flag moves from user_metadata to app_metadata.
--
-- An admin who creates a phone account sees its temporary password, and the account is
-- flagged to replace it at first sign-in. The flag was in user_metadata, which a signed-in
-- user can rewrite from the browser (supabase.auth.updateUser({ data })), so the change
-- could be skipped and the temporary password kept. The app now sets and reads the flag in
-- app_metadata, which only the service role can write, and clears it only after a new
-- password has been saved.
--
-- This carries across the flag for anyone still waiting to change their password, and takes
-- the old copy out of user_metadata. Migrations here are pasted into the dashboard SQL
-- Editor by hand, so both statements have to survive being run twice.

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', true)
WHERE raw_user_meta_data->>'must_change_password' = 'true'
  AND COALESCE(raw_app_meta_data->>'must_change_password', '') <> 'true';

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'must_change_password'
WHERE raw_user_meta_data ? 'must_change_password';
