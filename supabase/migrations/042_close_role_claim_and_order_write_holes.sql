-- Close two ways around the store's own checks. Both are left over from before role syncing
-- and checkout moved into the database, and the app uses neither.
--
-- 1. set_user_claims (006) writes a role into any user's sign-in token (auth.users
--    raw_app_meta_data) and runs with its owner's rights, but the EXECUTE that PUBLIC and the
--    API roles get on every new function was never taken back. So anyone holding the public
--    anon key could call rpc('set_user_claims', ...) and give their own token role 'admin'.
--    The products and exports storage policies (011, 013) trust that claim, so it opened
--    every export file and let product images be replaced or deleted. (is_admin() has read
--    the profile since 015, so the admin area itself was not exposed.)
--    Nothing calls it any more: since 023, handle_new_user and sync_user_role_to_jwt write
--    raw_app_meta_data themselves. It is revoked rather than dropped so that an older trigger
--    body still calling it keeps working, since those run as their owner, not the caller.
--
-- 2. Customers could insert orders (002) and order_items (015) rows directly, and negative
--    ledger rows against their own orders (009). Orders are only ever placed through
--    place_points_order, which is SECURITY DEFINER and needs none of these policies. All they
--    allowed was going around checkout: an order with no points taken and no stock check,
--    points-used figures that refund_order would later pay back, or extra lines added to an
--    order that was already paid for.
--
-- To see whether anyone used either hole, run these before this migration (step 3 below
-- resets the token roles, so the first one has to come first):
--
--   -- Tokens whose role differs from the profile's
--   select u.id, u.email, u.raw_app_meta_data->>'role' as token_role, p.role as profile_role
--   from auth.users u left join public.profiles p on p.id = u.id
--   where (u.raw_app_meta_data->>'role') is distinct from p.role;
--
--   -- Orders checkout did not write as a whole: lines that do not add up to the order, points
--   -- taken that do not match it, or lines added after it was placed
--   select o.id, o.created_at, o.user_id, o.total_points,
--          (select coalesce(sum(i.total_points), 0) from order_items i where i.order_id = o.id) as lines_points,
--          (select -coalesce(sum(l.delta_points), 0) from points_ledger l
--            where l.order_id = o.id and l.delta_points < 0) as points_taken
--   from orders o
--   where o.total_points <> (select coalesce(sum(i.total_points), 0) from order_items i where i.order_id = o.id)
--      or o.total_points <> (select -coalesce(sum(l.delta_points), 0) from points_ledger l
--                             where l.order_id = o.id and l.delta_points < 0)
--      or exists (select 1 from order_items i where i.order_id = o.id and i.created_at <> o.created_at);
--
-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

-- 1. Only server-side roles may call set_user_claims
REVOKE ALL ON FUNCTION public.set_user_claims(uuid, text) FROM PUBLIC, anon, authenticated;

-- 2. Orders, their lines and their points are only written by the database functions
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can deduct points for their own orders" ON public.points_ledger;

-- 3. Put every token role back in line with the profile, undoing any self-promotion. A token
--    already issued keeps its claim until it expires (an hour by default); the next refresh
--    picks up the corrected one.
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE p.id = u.id
  AND (u.raw_app_meta_data->>'role') IS DISTINCT FROM p.role;
