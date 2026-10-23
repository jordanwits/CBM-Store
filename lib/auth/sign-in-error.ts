/**
 * What to show for a failed sign-in. A deactivated account is banned in Supabase Auth
 * (migration 044 keeps the ban in step with profiles.active), and Auth's own words for that
 * are "User is banned".
 */
export function signInErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === 'user_banned') {
    return 'This account is inactive.';
  }
  return error.message;
}
