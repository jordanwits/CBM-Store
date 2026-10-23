-- A request counter for the forms anyone can submit without signing in.
--
-- Forgot password and request access send email on behalf of whoever fills them in, with
-- nothing to stop a script doing it thousands of times: flooding an employee's inbox with
-- reset emails (each of which also replaces the reset link sent before it), or the admins'
-- with access requests. Supabase's own limits don't apply, because the app makes the reset
-- link with the admin API and sends both emails itself.
--
-- hit_rate_limit counts one more request against a key (an address, an IP, a whole form)
-- in a fixed window and says whether it is still within the limit. Only the service role
-- can call it or see the table; the app reaches it through lib/rate-limit.ts, which lets
-- requests through if this migration has not been run yet.
--
-- Migrations here are pasted into the dashboard SQL Editor by hand, so every statement
-- below has to survive being run twice.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL
);

-- No policies: nothing but the service role and the function below reaches it
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  INSERT INTO rate_limits AS r (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE r.hits + 1
        END,
        window_start = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE r.window_start
        END
  RETURNING hits INTO v_hits;

  -- Keys are addresses and IPs, so old ones are cleared now and then to keep this small
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
