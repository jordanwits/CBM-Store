/**
 * Set for phone onboarding; cleared after the first password change.
 *
 * Kept in app_metadata, which only the service role can write. It used to be in
 * user_metadata, which a signed-in user can change from the browser with
 * supabase.auth.updateUser({ data }), so anyone could clear it and carry on with the
 * temporary password the admin had seen. Migration 047 moved existing flags across.
 */
export const MUST_CHANGE_PASSWORD_META_KEY = 'must_change_password' as const;

export function userMustChangePassword(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  return user?.app_metadata?.[MUST_CHANGE_PASSWORD_META_KEY] === true;
}
