-- #414. Private DBV weekly importer: database half of the fail-closed scheduler.
-- Code-only migration; DO NOT apply until #17/#56 source/processing rights,
-- private Edge auth and a separate offline/technical review are proven.
-- No pg_net installation, cron schedule, secret or source request here.
-- Existing 4-argument atomic RPC is reused, not recreated.
CREATE TABLE IF NOT EXISTS private_content.dbv_weekly_state (
  id smallint PRIMARY KEY CHECK (id=1),
  enabled boolean NOT NULL DEFAULT false,
  attempt_id uuid,
  lease_until timestamptz,
  next_allowed_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_code text NOT NULL DEFAULT 'never_started',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private_content.dbv_weekly_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.dbv_weekly_state FROM PUBLIC, anon, authenticated;
INSERT INTO private_content.dbv_weekly_state(id,enabled) VALUES (1,false)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS private_content.dbv_weekly_attempts (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  code text NOT NULL DEFAULT 'running',
  duration_ms integer,
  player_count integer,
  ranking_count integer,
  db_bytes bigint,
  source_year integer,
  source_week integer,
  CHECK (player_count IS NULL OR player_count BETWEEN 0 AND 20000),
  CHECK (ranking_count IS NULL OR ranking_count BETWEEN 0 AND 120000)
);
ALTER TABLE private_content.dbv_weekly_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.dbv_weekly_attempts FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS dbv_weekly_attempts_recent
ON private_content.dbv_weekly_attempts(started_at DESC);

CREATE TABLE IF NOT EXISTS private_content.dbv_weekly_snapshots (
  year integer NOT NULL,
  week integer NOT NULL,
  published_at timestamptz NOT NULL,
  payload_md5 text NOT NULL,
  players integer NOT NULL,
  rankings integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(year,week),
  CHECK (year BETWEEN 2026 AND 2100 AND week BETWEEN 1 AND 53),
  CHECK (players BETWEEN 5000 AND 20000 AND rankings >= 4000)
);
ALTER TABLE private_content.dbv_weekly_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.dbv_weekly_snapshots FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_private_dbv_weekly()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $claim$
DECLARE
  s private_content.dbv_weekly_state%ROWTYPE;
  v_bytes bigint;
  v_old_bytes bigint;
  v_latest record;
  v_id uuid;
  v_warning text := null;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(241016,2);
  SELECT * INTO s FROM private_content.dbv_weekly_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND OR NOT s.enabled THEN
    RETURN pg_catalog.jsonb_build_object('allowed',false,'code','disabled');
  END IF;
  IF s.lease_until IS NOT NULL AND s.lease_until>now() THEN
    RETURN pg_catalog.jsonb_build_object('allowed',false,'code','lease_active');
  END IF;
  IF s.next_allowed_at IS NOT NULL AND s.next_allowed_at>now() THEN
    RETURN pg_catalog.jsonb_build_object('allowed',false,'code','backoff');
  END IF;
  v_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());
  IF v_bytes >= 350*1024*1024 THEN
    UPDATE private_content.dbv_weekly_state SET last_code='storage_guard',
      next_allowed_at=now()+interval '7 days',updated_at=now() WHERE id=1;
    RETURN pg_catalog.jsonb_build_object('allowed',false,'code','storage_guard');
  END IF;
  SELECT a.db_bytes INTO v_old_bytes FROM private_content.dbv_weekly_attempts a
    WHERE a.started_at <= now()-interval '7 days' AND a.db_bytes IS NOT NULL
    ORDER BY a.started_at DESC LIMIT 1;
  IF v_bytes >= 250*1024*1024 THEN v_warning := 'storage_250mb'; END IF;
  IF v_old_bytes IS NOT NULL AND v_bytes-v_old_bytes > 20*1024*1024 THEN
    v_warning := 'storage_growth_20mb';
  END IF;
  SELECT w.year,w.week,w.source_published_at INTO v_latest
    FROM public.ranking_weeks w ORDER BY w.year DESC,w.week DESC LIMIT 1;
  v_id := pg_catalog.gen_random_uuid();
  INSERT INTO private_content.dbv_weekly_attempts(id,db_bytes)
    VALUES (v_id,v_bytes);
  UPDATE private_content.dbv_weekly_state SET
    attempt_id=v_id,lease_until=now()+interval '130 seconds',
    last_attempt_at=now(),last_code='running',updated_at=now() WHERE id=1;
  DELETE FROM private_content.dbv_weekly_attempts
    WHERE started_at < now()-interval '90 days';
  RETURN pg_catalog.jsonb_build_object('allowed',true,'attemptId',v_id,
    'latest',CASE WHEN v_latest.year IS NULL THEN NULL ELSE
      pg_catalog.jsonb_build_object('year',v_latest.year,'week',v_latest.week,
        'sourcePublishedAt',v_latest.source_published_at) END,
    'warning',v_warning);
END
$claim$;
REVOKE ALL ON FUNCTION public.claim_private_dbv_weekly() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_private_dbv_weekly() TO service_role;

CREATE OR REPLACE FUNCTION public.finish_private_dbv_weekly(
  p_attempt_id uuid, p_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $finish$
DECLARE s private_content.dbv_weekly_state%ROWTYPE;
BEGIN
  IF p_code NOT IN ('unchanged','source_forbidden','source_throttled',
    'source_unavailable','publication_invalid','xlsx_invalid',
    'coverage_invalid','database_error','internal_error') THEN
    RAISE EXCEPTION 'Invalid private DBV error category';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(241016,2);
  SELECT * INTO s FROM private_content.dbv_weekly_state WHERE id=1 FOR UPDATE;
  IF s.attempt_id IS DISTINCT FROM p_attempt_id OR s.lease_until IS NULL THEN
    RAISE EXCEPTION 'No matching private DBV lease';
  END IF;
  UPDATE private_content.dbv_weekly_attempts SET
    finished_at=now(),code=p_code,
    duration_ms=least(2147483647,
      greatest(0,(extract(epoch FROM now()-started_at)*1000)::bigint))::integer
    WHERE id=p_attempt_id AND finished_at IS NULL;
  UPDATE private_content.dbv_weekly_state SET
    attempt_id=NULL,lease_until=NULL,last_code=p_code,updated_at=now(),
    next_allowed_at=CASE
      WHEN p_code='source_forbidden' THEN now()+interval '7 days'
      WHEN p_code='source_throttled' THEN now()+interval '3 days'
      WHEN p_code='unchanged' THEN now()+interval '2 days'
      ELSE now()+interval '1 day' END WHERE id=1;
  RETURN pg_catalog.jsonb_build_object('ok',true,'code',p_code);
END
$finish$;
REVOKE ALL ON FUNCTION public.finish_private_dbv_weekly(uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_private_dbv_weekly(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ingest_private_dbv_weekly(
  p_attempt_id uuid,p_year integer,p_week integer,p_total integer,
  p_players jsonb,p_source_published_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $ingest$
DECLARE
  s private_content.dbv_weekly_state%ROWTYPE;
  v_latest record;
  v_prior private_content.dbv_weekly_snapshots%ROWTYPE;
  v_hash text;
  v_result jsonb;
  v_rankings integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(241016,2);
  SELECT * INTO s FROM private_content.dbv_weekly_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND OR NOT s.enabled OR s.attempt_id IS DISTINCT FROM p_attempt_id
     OR s.lease_until IS NULL OR s.lease_until<=now() THEN
    RAISE EXCEPTION 'Private DBV scheduler not authorized';
  END IF;
  IF p_source_published_at IS NULL OR p_source_published_at>now()+interval '5 minutes'
     OR p_source_published_at<'2026-01-01'::timestamptz
     OR extract(isoyear FROM p_source_published_at AT TIME ZONE 'Europe/Berlin')::integer<>p_year
     OR extract(week FROM p_source_published_at AT TIME ZONE 'Europe/Berlin')::integer<>p_week THEN
    RAISE EXCEPTION 'Official DBV publication timestamp inconsistent';
  END IF;
  IF p_total NOT BETWEEN 5000 AND 20000 OR pg_catalog.jsonb_typeof(p_players)<>'array'
    OR pg_catalog.jsonb_array_length(p_players)<>p_total THEN
    RAISE EXCEPTION 'Invalid official DBV player count';
  END IF;
  SELECT w.year,w.week,w.source_published_at INTO v_latest
    FROM public.ranking_weeks w ORDER BY w.year DESC,w.week DESC LIMIT 1;
  IF v_latest.year IS NOT NULL AND p_year*100+p_week < v_latest.year*100+v_latest.week THEN
    RAISE EXCEPTION 'Older official DBV ranking rejected';
  END IF;
  IF v_latest.source_published_at IS NOT NULL AND
    p_source_published_at <= v_latest.source_published_at AND
    (p_year*100+p_week)>(v_latest.year*100+v_latest.week) THEN
    RAISE EXCEPTION 'DBV publication must be newer than stored ranking';
  END IF;
  v_hash := pg_catalog.md5(p_players::text);
  SELECT * INTO v_prior FROM private_content.dbv_weekly_snapshots
    WHERE year=p_year AND week=p_week;
  IF FOUND THEN
    IF v_prior.payload_md5<>v_hash OR v_prior.published_at<>p_source_published_at THEN
      RAISE EXCEPTION 'Changed same-week DBV publication requires explicit review';
    END IF;
    UPDATE private_content.dbv_weekly_attempts SET
      finished_at=now(),code='unchanged',
      player_count=v_prior.players,ranking_count=v_prior.rankings,
      source_year=p_year,source_week=p_week
      WHERE id=p_attempt_id;
    UPDATE private_content.dbv_weekly_state SET
      attempt_id=NULL,lease_until=NULL,last_code='unchanged',
      next_allowed_at=now()+interval '2 days',updated_at=now() WHERE id=1;
    RETURN pg_catalog.jsonb_build_object('snapshot',p_year::text||'-KW'||lpad(p_week::text,2,'0'),
      'read',v_prior.players,'rankings_imported',v_prior.rankings,'idempotent',true);
  END IF;
  IF v_latest.year=p_year AND v_latest.week=p_week THEN
    RAISE EXCEPTION 'Existing untracked ranking week cannot be overwritten';
  END IF;
  -- The existing four-argument RPC owns all row validation and atomic data
  -- changes; this call, publication stamp and audit share ONE transaction.
  v_result := public.ingest_private_dbv_directory(p_year,p_week,p_total,p_players);
  v_rankings := (v_result->>'rankings_imported')::integer;
  IF v_rankings<4000 OR v_rankings>120000 THEN
    RAISE EXCEPTION 'Incomplete DBV ranking rows';
  END IF;
  UPDATE public.ranking_weeks SET source_published_at=p_source_published_at
    WHERE year=p_year AND week=p_week;
  INSERT INTO private_content.dbv_weekly_snapshots
    (year,week,published_at,payload_md5,players,rankings)
    VALUES (p_year,p_week,p_source_published_at,v_hash,p_total,v_rankings);
  DELETE FROM private_content.dbv_weekly_snapshots v
    WHERE NOT EXISTS(SELECT 1 FROM public.ranking_weeks w
      WHERE w.year=v.year AND w.week=v.week);
  UPDATE private_content.dbv_weekly_attempts SET
    finished_at=now(),code='ok',player_count=p_total,ranking_count=v_rankings,
    source_year=p_year,source_week=p_week,
    duration_ms=least(2147483647,
      greatest(0,(extract(epoch FROM now()-started_at)*1000)::bigint))::integer
    WHERE id=p_attempt_id;
  UPDATE private_content.dbv_weekly_state SET
    attempt_id=NULL,lease_until=NULL,last_code='ok',
    last_success_at=now(),next_allowed_at=now()+interval '2 days',
    updated_at=now() WHERE id=1;
  RETURN v_result || pg_catalog.jsonb_build_object('publishedAt',p_source_published_at,'idempotent',false);
END
$ingest$;
REVOKE ALL ON FUNCTION public.ingest_private_dbv_weekly(uuid,integer,integer,integer,jsonb,timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_private_dbv_weekly(uuid,integer,integer,integer,jsonb,timestamptz)
TO service_role;
-- Existing legacy RPC is no longer a direct service_role entrypoint after
-- this migration. The SECURITY DEFINER wrapper invokes it transactionally.
REVOKE EXECUTE ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb)
FROM service_role;

CREATE OR REPLACE FUNCTION private_content.dispatch_private_dbv_weekly()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $dispatch$
DECLARE v_url text; v_token text;
BEGIN
  IF NOT (SELECT enabled FROM private_content.dbv_weekly_state WHERE id=1) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name='private_dbv_weekly_url';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets
    WHERE name='private_dbv_weekly_token';
  IF v_url IS DISTINCT FROM
      'https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/private-dbv-weekly'
      OR v_token IS NULL OR length(v_token)<32 THEN
    RAISE EXCEPTION 'Private DBV scheduler secrets missing';
  END IF;
  -- pg_net is intentionally not installed by this migration. Dynamic SQL
  -- resolves net.http_post only after explicit separate rights-gated setup.
  EXECUTE 'SELECT net.http_post(url := $1, headers := jsonb_build_object(''content-type'',''application/json'',''x-private-dbv-cron-token'',$2), body := ''{}''::jsonb, timeout_milliseconds := 120000)'
    USING v_url,v_token;
END
$dispatch$;
REVOKE ALL ON FUNCTION private_content.dispatch_private_dbv_weekly()
FROM PUBLIC, anon, authenticated, service_role;

-- Service-role-only aggregate health: never returns names, DBV IDs, source rows.
CREATE OR REPLACE FUNCTION public.private_dbv_weekly_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $health$
DECLARE
  v_latest record;
  v_state private_content.dbv_weekly_state%ROWTYPE;
  v_entries integer;
  v_players integer;
  v_club integer;
  v_age integer;
  v_bytes bigint;
  v_last_attempt record;
BEGIN
  SELECT w.id,w.year,w.week,w.source_published_at,w.imported_at INTO v_latest
    FROM public.ranking_weeks w ORDER BY w.year DESC,w.week DESC LIMIT 1;
  SELECT * INTO v_state FROM private_content.dbv_weekly_state WHERE id=1;
  SELECT a.started_at,a.code INTO v_last_attempt
    FROM private_content.dbv_weekly_attempts a
    ORDER BY a.started_at DESC LIMIT 1;
  SELECT count(*),count(DISTINCT e.player_id) INTO v_entries,v_players
    FROM public.ranking_entries e WHERE e.week_id=v_latest.id;
  SELECT count(*) INTO v_club FROM public.players p
    WHERE p.club_id='spvgg-moessingen' AND EXISTS(
      SELECT 1 FROM public.ranking_entries e
      WHERE e.week_id=v_latest.id AND e.player_id=p.id);
  v_age := CASE WHEN v_latest.source_published_at IS NULL THEN NULL
    ELSE floor(extract(epoch FROM now()-v_latest.source_published_at)/86400)::integer END;
  v_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());
  RETURN pg_catalog.jsonb_build_object(
    'scheduler_enabled',v_state.enabled,'last_code',v_state.last_code,
    'last_attempt_at',v_last_attempt.started_at,
    'last_success_at',v_state.last_success_at,
    'latest_year',v_latest.year,'latest_week',v_latest.week,
    'published_at',v_latest.source_published_at,
    'imported_at',v_latest.imported_at,
    'entries',v_entries,'players',v_players,
    'club_players_with_ranking',v_club,
    'publication_age_days',v_age,
    'age_7d',v_age IS NULL OR v_age>=7,
    'age_14d',v_age IS NULL OR v_age>=14,
    'database_bytes',v_bytes,
    'storage_warn_250mb',v_bytes>=250*1024*1024,
    'storage_block_350mb',v_bytes>=350*1024*1024);
END
$health$;
REVOKE ALL ON FUNCTION public.private_dbv_weekly_health()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_dbv_weekly_health() TO service_role;
