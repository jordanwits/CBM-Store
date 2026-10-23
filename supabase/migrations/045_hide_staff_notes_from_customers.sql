-- Staff notes are no longer readable by customers.
--
-- orders.notes is what staff write about an order, kept apart from the customer's own note
-- (036) so that neither side's text reaches the other. But 002's "Users can read their own
-- orders" policy returns whole rows, and row-level security cannot hide a column, so any
-- customer could read the staff notes on their own orders through the API with the public
-- key. The store's own pages never asked for them; nothing stopped another request doing so.
--
-- Signed-in users now get SELECT on every column of orders except notes, and anonymous
-- callers on none. The admin pages that show notes read through the service role, as the
-- admin actions already did. Checkout, refunds and the deleted-orders bin run as their
-- owner and are unaffected.
--
-- Two consequences for later work: a signed-in select('*') on orders now fails, so pages
-- that read orders as the user name their columns; and a column added to orders later is
-- not readable by signed-in users until it is granted, for example
--   GRANT SELECT (new_column) ON public.orders TO authenticated;
--
-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

DO $$
DECLARE
  v_columns TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name <> 'notes';

  REVOKE SELECT ON public.orders FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.orders TO authenticated', v_columns);
END $$;
