-- Step 4: weekly source/import consistency check, entirely inside PostgreSQL.
-- Never requests external sites, invokes Edge Functions or stores player identities.
-- A row per UTC date, retained for at most 90 days (~13 snapshots).
CREATE TABLE IF NOT EXISTS private_content.import_health_weekly (
  checked_on date PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok','attention')),
  summary jsonb NOT NULL CHECK (jsonb_typeof(summary)='object')
);
ALTER TABLE private_content.import_health_weekly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.import_health_weekly FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private_content.record_import_health_weekly()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  result jsonb;
  counts jsonb;
  classification text;
BEGIN
  -- All source-backed sports facts remain in their existing canonical tables.
  -- Read only 13+ verified club profiles; never expose IDs or names in the log.
  WITH latest AS (
    SELECT id, year, week, source_published_at, imported_at
    FROM public.ranking_weeks ORDER BY year DESC, week DESC LIMIT 1
  ), roster AS (
    SELECT p.id, p.dbv_id FROM public.players p
    WHERE p.club_id='spvgg-moessingen'
  ), player_checks AS (
    SELECT
      (SELECT count(*) FROM public.player_external_match_facts f
       WHERE f.dbv_id=p.dbv_id) AS facts,
      (SELECT count(*) FROM private_content.spvgg_archive_evidence e
       WHERE e.dbv_id=p.dbv_id AND e.kind='match_card') AS archived_facts,
      (SELECT count(*) FROM public.tournament_placements t
       WHERE t.player_id=p.id) AS placements,
      (SELECT count(*) FROM private_content.spvgg_archive_evidence e
       WHERE e.dbv_id=p.dbv_id AND e.kind='placement') AS archived_placements,
      (SELECT count(*) FROM public.ranking_entries r
       WHERE r.player_id=p.id AND r.week_id=(SELECT id FROM latest)) AS latest_rankings,
      (SELECT j.status FROM public.player_external_match_imports j
       WHERE j.dbv_id=p.dbv_id) AS import_status,
      (SELECT j.verified_count FROM public.player_external_match_imports j
       WHERE j.dbv_id=p.dbv_id) AS importer_verified,
      (SELECT count(*) FROM public.player_external_match_facts f
       WHERE f.dbv_id=p.dbv_id
         AND NOT EXISTS (
           SELECT 1 FROM private_content.spvgg_archive_evidence e
           WHERE e.dbv_id=f.dbv_id AND e.kind='match_card'
             AND e.source_key=f.source_key)) AS missing_archive_keys
    FROM roster p
  )
  SELECT jsonb_build_object(
    'club_profiles',count(*),
    'players_without_match_proof',count(*) FILTER (WHERE facts=0),
    'players_without_latest_ranking',count(*) FILTER (WHERE latest_rankings=0),
    'bad_import_status',count(*) FILTER (
       WHERE import_status IS NULL OR import_status='error'
       OR (facts>0 AND import_status='awaiting_source')),
    'import_count_mismatch',count(*) FILTER (
       WHERE importer_verified IS NULL OR facts<>importer_verified),
    'match_archive_mismatch',count(*) FILTER (
       WHERE facts<>archived_facts OR missing_archive_keys>0),
    'placement_archive_mismatch',count(*) FILTER (
       WHERE placements<>archived_placements),
    'match_proofs',coalesce(sum(facts),0),
    'tournament_placements',coalesce(sum(placements),0),
    'ranking_week',(SELECT year::text||'-KW'||lpad(week::text,2,'0') FROM latest),
    'ranking_publication_age_days',(SELECT floor(extract(epoch from
       now()-coalesce(source_published_at,imported_at))/86400)::int FROM latest)
  ) INTO counts
  FROM player_checks;

  classification := CASE
    WHEN (counts->>'club_profiles')::int < 13
      OR (counts->>'players_without_match_proof')::int > 0
      OR (counts->>'players_without_latest_ranking')::int > 0
      OR (counts->>'bad_import_status')::int > 0
      OR (counts->>'import_count_mismatch')::int > 0
      OR (counts->>'match_archive_mismatch')::int > 0
      OR (counts->>'placement_archive_mismatch')::int > 0
      OR counts->>'ranking_week' IS NULL
      OR (counts->>'ranking_publication_age_days')::int > 14
    THEN 'attention' ELSE 'ok' END;

  result:=jsonb_build_object('status',classification,'counts',counts);
  INSERT INTO private_content.import_health_weekly(
    checked_on,checked_at,status,summary
  ) VALUES ((now() AT TIME ZONE 'UTC')::date,now(),classification,counts)
  ON CONFLICT (checked_on) DO UPDATE SET
    checked_at=excluded.checked_at,status=excluded.status,summary=excluded.summary;

  DELETE FROM private_content.import_health_weekly
  WHERE checked_on < (now() AT TIME ZONE 'UTC')::date - 90;
  RETURN result;
END;
$body$;
REVOKE ALL ON FUNCTION private_content.record_import_health_weekly()
  FROM PUBLIC, anon, authenticated;

-- Once a week, Monday 07:49 UTC: DB-only read and one compact aggregate.
-- Uses the existing pg_cron installation; no GitHub OIDC, client token or
-- public Data API access. Re-running the migration updates the named schedule.
SELECT cron.schedule(
  'badminton-import-health-weekly-v1',
  '49 7 * * 1',
  'SELECT private_content.record_import_health_weekly();'
);
