-- F03 #327 · DBV identity search emergency quota (backend-only, no PWA change)
-- Migration must be applied to the Badminton project ONLY after all R2 PR gates pass.
-- Anonymous users stay anonymous; this table stores just two global counters.
-- Coarse GLOBAL quota is deliberate: no device ID, IP, session, profile or user-agent tracking.
-- Consequence: sustained abuse can exhaust the shared budget for all users.
-- Follow-on targeted provider-edge protection is needed if that tradeoff becomes unacceptable.

CREATE TABLE IF NOT EXISTS private_content.dbv_identity_search_quota (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  minute_bucket timestamptz NOT NULL,
  minute_requests integer NOT NULL CHECK (minute_requests >= 1),
  day_bucket date NOT NULL,
  day_requests integer NOT NULL CHECK (day_requests >= 1)
);
ALTER TABLE private_content.dbv_identity_search_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private_content.dbv_identity_search_quota FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE private_content.dbv_identity_search_quota IS
 'Anonymous DBV search: one global minute/day quota row; no client identifiers or search text.';

-- Keep the original identity-only return schema, all input filters and 12-hit limit.
-- VOLATILE is necessary: PostgREST treats STABLE RPC calls as read-only.
CREATE OR REPLACE FUNCTION public.search_dbv_player_identity(
  p_query text,
  p_age_class text DEFAULT NULL,
  p_club text DEFAULT NULL,
  p_association text DEFAULT NULL
)
RETURNS TABLE(dbv_id text, name text, club text, age_class text, association text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $search$
DECLARE
  q text := btrim(left(coalesce(p_query, ''), 70));
  club_filter text := btrim(left(coalesce(p_club, ''), 90));
  now_utc timestamptz := clock_timestamp();
  minute_key timestamptz := date_trunc('minute', now_utc);
  day_key date := (now_utc AT TIME ZONE 'UTC')::date;
  admitted boolean := false;
  retry_seconds integer := 60;
BEGIN
  -- Reject invalid searches BEFORE accounting; do not allow list-all or wildcards.
  IF q !~ '^[[:alpha:][:digit:] -]{3,70}$' THEN RETURN; END IF;
  IF p_age_class IS NOT NULL AND p_age_class NOT IN
    ('U11','U13','U15','U17','U19','U22') THEN RETURN; END IF;
  IF p_association IS NOT NULL AND
    (length(p_association)>50 OR p_association !~ '^[[:alpha:][:digit:] -]+$') THEN RETURN; END IF;
  IF p_club IS NOT NULL AND
    (length(club_filter)<2 OR club_filter !~ '^[[:alpha:][:digit:] .&/()-]+$') THEN RETURN; END IF;

  -- A single atomic UPSERT serializes competing calls, including first use.
  -- At most 60 valid lookups/minute AND 1200 valid lookups/UTC day globally.
  INSERT INTO private_content.dbv_identity_search_quota AS bucket
    (singleton, minute_bucket, minute_requests, day_bucket, day_requests)
  VALUES (true, minute_key, 1, day_key, 1)
  ON CONFLICT (singleton) DO UPDATE SET
    minute_bucket = EXCLUDED.minute_bucket,
    minute_requests = CASE WHEN bucket.minute_bucket = EXCLUDED.minute_bucket
                           THEN bucket.minute_requests + 1 ELSE 1 END,
    day_bucket = EXCLUDED.day_bucket,
    day_requests = CASE WHEN bucket.day_bucket = EXCLUDED.day_bucket
                        THEN bucket.day_requests + 1 ELSE 1 END
  WHERE (bucket.minute_bucket <> EXCLUDED.minute_bucket OR bucket.minute_requests < 60)
    AND (bucket.day_bucket <> EXCLUDED.day_bucket OR bucket.day_requests < 1200)
  RETURNING true INTO admitted;

  IF admitted IS DISTINCT FROM true THEN
    SELECT CASE WHEN day_bucket = day_key AND day_requests >= 1200
      THEN LEAST(86400, GREATEST(60,
        EXTRACT(EPOCH FROM
          ((date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') + interval '1 day')
          AT TIME ZONE 'UTC') - clock_timestamp())::integer))
      ELSE 60 END
    INTO retry_seconds
    FROM private_content.dbv_identity_search_quota
    WHERE singleton = true;
    -- PostgREST's PGRST error supplies HTTP 429 and Retry-After even on rollback.
    RAISE SQLSTATE 'PGRST' USING
      MESSAGE = '{"code":"DBV_SEARCH_RATE_LIMIT","message":"DBV-Suche voruebergehend begrenzt. Bitte spaeter erneut versuchen."}',
      DETAIL = jsonb_build_object('status', 429,
        'headers', jsonb_build_object('Retry-After', COALESCE(retry_seconds, 60)::text))::text;
  END IF;

  RETURN QUERY
    SELECT p.dbv_id::text, p.name::text, p.club::text,
           p.age_class::text, p.association::text
    FROM public.players p
    WHERE p.dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
      AND p.verified_at IS NOT NULL AND p.last_ranking_week IS NOT NULL
      AND length(btrim(p.name)) > 0
      AND (p.dbv_id = q OR p.name ILIKE ('%' || q || '%'))
      AND (p_age_class IS NULL OR p.age_class = p_age_class)
      AND (p_association IS NULL OR p.association = p_association)
      AND (p_club IS NULL OR p.club ILIKE ('%' || club_filter || '%'))
    ORDER BY CASE WHEN p.dbv_id = q THEN 0
      WHEN lower(p.name) = lower(q) THEN 1
      WHEN p.name ILIKE (q || '%') THEN 2 ELSE 3 END,
      p.name, p.dbv_id
    LIMIT 12;
END
$search$;

REVOKE ALL ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
  TO anon, authenticated;
COMMENT ON FUNCTION public.search_dbv_player_identity(text,text,text,text) IS
 'Scoped official DBV identity lookup, max 12 hits. Atomic global 60/min and 1200/UTC-day quota; no client tracking, no private matches or trophies.';
NOTIFY pgrst, 'reload schema';
