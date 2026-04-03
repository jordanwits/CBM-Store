/** Stored in auth user_metadata for phone onboarding; cleared after first password change. */
export const MUST_CHANGE_PASSWORD_META_KEY = 'must_change_password' as const;

export function userMustChangePassword(user: { user_metadata?: Record<string, unknown> } | null): boolean {
  return user?.user_metadata?.[MUST_CHANGE_PASSWORD_META_KEY] === true;
}
