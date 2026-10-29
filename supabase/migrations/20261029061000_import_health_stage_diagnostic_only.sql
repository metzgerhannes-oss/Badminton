-- #162/#199: Historical stage-only records no longer force a permanent alarm.
-- Preserve original stored evidence, all true source/coverage gates, all privileges.
CREATE OR REPLACE FUNCTION private_content.record_import_health_weekly()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
    'import_count_excess_facts',count(*) FILTER (
       WHERE importer_verified IS NOT NULL AND facts>importer_verified),
    'import_count_shortfall',count(*) FILTER (
       WHERE importer_verified IS NOT NULL AND facts<importer_verified),
    'import_count_missing_counter',count(*) FILTER (
       WHERE importer_verified IS NULL),
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

  -- Database-wide PostgreSQL bytes are a technical early-warning indicator,
  -- NOT identical to provider-billed storage. The billing dashboard is authoritative.
  -- Keep unmatched staging and one-time backup rows until source reconciliation:
  -- neither missing canonical matches nor unreviewed reimport backups may be deleted.
  counts := counts || jsonb_build_object(
    'pg_database_bytes', pg_database_size(current_database()),
    'nominal_free_database_limit_bytes', 500000000,
    'pg_database_nominal_percent',
      round(pg_database_size(current_database())::numeric * 100 / 500000000,2),
    'storage_watch_level',case
      when pg_database_size(current_database()) >= 425000000 then 'critical'
      when pg_database_size(current_database()) >= 350000000 then 'review'
      else 'ok' end,
    'match_stage_bytes',
      pg_total_relation_size('public.spvgg_match_rebuild_stage'::regclass),
    'reimport_backup_bytes',
      pg_total_relation_size('private_content.spvgg_match_backup_before_reimport_20261015'::regclass),
    'stage_cards_unreconciled',(
      select count(*)
      from public.spvgg_match_rebuild_stage s
      where not exists(
        select 1 from public.player_external_match_facts f
        where f.dbv_id=s.dbv_id and f.source_key=s.source_key)
      and not exists(
        select 1 from private.external_match_quarantine q
        where q.dbv_id=s.dbv_id and q.source_key=s.source_key)
    ),
    'backup_cards_not_in_current',(
      select count(*)
      from private_content.spvgg_match_backup_before_reimport_20261015 b
      where not exists(
        select 1 from public.player_external_match_facts f
        where f.dbv_id=b.dbv_id and f.source_key=b.source_key)
    ),
    'ranking_weeks_retained',(select count(*) from public.ranking_weeks),
    'previous_pg_database_bytes',(
      select (nullif(summary->>'pg_database_bytes',''))::bigint
      from private_content.import_health_weekly
      where checked_on < (now() at time zone 'UTC')::date
        and summary ? 'pg_database_bytes'
      order by checked_on desc limit 1
    )
  );

  classification := CASE
    WHEN (counts->>'pg_database_bytes')::bigint >= 350000000
      OR (counts->>'ranking_weeks_retained')::int > 8
      OR (counts->>'club_profiles')::int < 13
      OR (counts->>'players_without_match_proof')::int > 0
      OR (counts->>'players_without_latest_ranking')::int > 0
      OR (counts->>'bad_import_status')::int > 0
      OR (counts->>'import_count_shortfall')::int > 0
      OR (counts->>'import_count_missing_counter')::int > 0
      -- Historic stage-only rows are diagnostic, not a live-source outage.
      -- Keep their counts in the summary but do not alert on them alone.
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
$function$
;
