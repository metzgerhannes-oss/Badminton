-- P0 #417 · STAGED ONLY · NOT APPLIED TO PRODUCTION
-- Apply atomically ONLY after a verified non-public client cutover, family
-- device regression, rollback rehearsal and explicit release-route review.
-- No GitHub Actions production database requests. This file is NOT in
-- supabase/migrations intentionally; no automatic deploy/merge.
BEGIN;
DO $audit$
DECLARE
  unsafe_count integer;
BEGIN
  SELECT count(*) INTO unsafe_count
  FROM pg_policies p
  WHERE p.schemaname='public'
    AND (p.tablename,p.policyname) IN (
      ('clubs','Public club directory'),
      ('dbv_calendar_entries','Public official DBV calendar only read'),
      ('events','Public DBV events can be read'),
      ('league_clubs','league_clubs_public_read'),
      ('league_fixtures','league_fixtures_public_read'),
      ('league_table_rows','league_table_rows_public_read'),
      ('league_teams','league_teams_public_read'),
      ('ranking_weeks','Public DBV ranking weeks can be read'),
      ('report_sources','Public verified source directory'),
      ('tournaments','Public DBV tournaments can be read')
    )
    AND p.cmd='SELECT' AND p.qual='true'
    AND p.roles @> ARRAY['anon','authenticated']::name[];
  IF unsafe_count<>10 THEN
    RAISE EXCEPTION 'P0-417 policy drift: expected 10 public SELECT policies, found %',unsafe_count;
  END IF;
END
$audit$;
DROP POLICY IF EXISTS "Public club directory" ON public.clubs;
DROP POLICY IF EXISTS "Public official DBV calendar only read" ON public.dbv_calendar_entries;
DROP POLICY IF EXISTS "Public DBV events can be read" ON public.events;
DROP POLICY IF EXISTS "league_clubs_public_read" ON public.league_clubs;
DROP POLICY IF EXISTS "league_fixtures_public_read" ON public.league_fixtures;
DROP POLICY IF EXISTS "league_table_rows_public_read" ON public.league_table_rows;
DROP POLICY IF EXISTS "league_teams_public_read" ON public.league_teams;
DROP POLICY IF EXISTS "Public DBV ranking weeks can be read" ON public.ranking_weeks;
DROP POLICY IF EXISTS "Public verified source directory" ON public.report_sources;
DROP POLICY IF EXISTS "Public DBV tournaments can be read" ON public.tournaments;
REVOKE SELECT ON public.clubs, public.dbv_calendar_entries, public.events, public.league_clubs, public.league_fixtures, public.league_table_rows, public.league_teams, public.ranking_weeks, public.report_sources, public.tournaments FROM PUBLIC, anon;
GRANT SELECT ON public.clubs, public.dbv_calendar_entries, public.events, public.league_clubs, public.league_fixtures, public.league_table_rows, public.league_teams, public.ranking_weeks, public.report_sources, public.tournaments TO authenticated;
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.clubs;
CREATE POLICY "p0_417_verified_family_read" ON public.clubs
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.dbv_calendar_entries;
CREATE POLICY "p0_417_verified_family_read" ON public.dbv_calendar_entries
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.events;
CREATE POLICY "p0_417_verified_family_read" ON public.events
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.league_clubs;
CREATE POLICY "p0_417_verified_family_read" ON public.league_clubs
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.league_fixtures;
CREATE POLICY "p0_417_verified_family_read" ON public.league_fixtures
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.league_table_rows;
CREATE POLICY "p0_417_verified_family_read" ON public.league_table_rows
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.league_teams;
CREATE POLICY "p0_417_verified_family_read" ON public.league_teams
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.ranking_weeks;
CREATE POLICY "p0_417_verified_family_read" ON public.ranking_weeks
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.report_sources;
CREATE POLICY "p0_417_verified_family_read" ON public.report_sources
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS "p0_417_verified_family_read" ON public.tournaments;
CREATE POLICY "p0_417_verified_family_read" ON public.tournaments
  FOR SELECT TO authenticated USING ((SELECT public.app_access_is_member()));
CREATE OR REPLACE FUNCTION public.search_dbv_player_identity(p_query text, p_age_class text DEFAULT NULL::text, p_club text DEFAULT NULL::text, p_association text DEFAULT NULL::text)
 RETURNS TABLE(dbv_id text, name text, club text, age_class text, association text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q text := btrim(left(coalesce(p_query, ''), 70));
  club_filter text := btrim(left(coalesce(p_club, ''), 90));
  now_utc timestamptz := clock_timestamp();
  minute_key timestamptz := date_trunc('minute', now_utc);
  day_key date := (now_utc AT TIME ZONE 'UTC')::date;
  admitted boolean := false;
  retry_seconds integer := 60;
BEGIN
  -- P0 #417: Anonymous Auth sessions use the authenticated database role.
  -- Only a verified family member may search, before quota accounting.
  IF public.app_access_is_member() IS DISTINCT FROM true THEN RETURN; END IF;
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
$function$
;
REVOKE EXECUTE ON FUNCTION public.search_dbv_player_identity(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_dbv_player_identity(text,text,text,text) TO authenticated;
COMMIT;
