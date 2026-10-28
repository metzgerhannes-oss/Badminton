-- #414: private full weekly official archive import, safe nullable source timestamp.
-- NO public grants, NO scheduler/backoff changes, NO content copy, no public release.
-- Existing SECURITY DEFINER RPC signatures and private execute permissions unchanged.
ALTER TABLE private_content.dbv_weekly_snapshots
  ALTER COLUMN published_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.ingest_private_dbv_directory(p_year integer, p_week integer, p_total integer, p_players jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  snapshot_tag text;
  newest_tag text;
  actual_count integer;
  inserted_clubs integer := 0;
  affected_players integer := 0;
  rank_count integer := 0;
  current_week_id uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(241016, 1);
  IF p_year NOT BETWEEN 2026 AND 2100 OR p_week NOT BETWEEN 1 AND 53 THEN
    RAISE EXCEPTION 'Invalid DBV snapshot week';
  END IF;
  snapshot_tag := p_year::text || '-KW' || lpad(p_week::text,2,'0');
  IF pg_catalog.jsonb_typeof(p_players) <> 'array' THEN
    RAISE EXCEPTION 'DBV payload must be an array';
  END IF;
  actual_count := pg_catalog.jsonb_array_length(p_players);
  IF actual_count <> p_total OR actual_count NOT BETWEEN 5000 AND 20000 THEN
    RAISE EXCEPTION 'DBV directory total mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_players) AS p(
      id text, name text, "birthYear" integer, "ageClass" text,
      club text, "clubId" text, association text, "lastSeen" text
    )
    WHERE p.id IS NULL OR p.id !~ '^[0-9]{2}-[0-9]{6}$'
       OR p.name IS NULL OR length(btrim(p.name)) NOT BETWEEN 3 AND 90
       OR p."birthYear" NOT BETWEEN 1990 AND 2100 OR p."birthYear" IS NULL
       OR p."ageClass" IS NULL OR p."ageClass" NOT IN ('U09','U11','U13','U15','U17','U19','U22')
       OR p."lastSeen" IS DISTINCT FROM snapshot_tag
       OR length(coalesce(p.club,'')) > 120
       OR length(coalesce(p.association,'')) > 70
       OR (coalesce(p."clubId",'') <> '' AND
           (p."clubId" !~ '^[0-9]{2}-[0-9]{3,8}$' OR btrim(coalesce(p.club,''))=''))
  ) THEN
    RAISE EXCEPTION 'Invalid DBV source row';
  END IF;
  IF (SELECT count(DISTINCT p.id)
      FROM pg_catalog.jsonb_to_recordset(p_players) AS p(id text)) <> actual_count THEN
    RAISE EXCEPTION 'Duplicate DBV IDs';
  END IF;
  SELECT max(last_ranking_week) INTO newest_tag FROM public.players;
  IF newest_tag IS NOT NULL AND newest_tag > snapshot_tag THEN
    RAISE EXCEPTION 'Older DBV snapshot rejected';
  END IF;
  -- Existing club naming conflicts are not guessed or overwritten.
  WITH original AS (
    SELECT DISTINCT ON (p."clubId") p."clubId" AS club_key,
           p.club, p.association
    FROM pg_catalog.jsonb_to_recordset(p_players) AS p(
      "clubId" text, club text, association text)
    WHERE coalesce(p."clubId",'') <> '' AND btrim(coalesce(p.club,'')) <> ''
    ORDER BY p."clubId", p.club
  )
  INSERT INTO public.clubs(id,name,short_name,association,source_url,dbv_club_id)
  SELECT 'dbv-'||club_key,club,left(club,120),association,
         'https://turniere.badminton.de/ranking',club_key
  FROM original o
  WHERE NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.dbv_club_id=o.club_key)
  ON CONFLICT(name) DO NOTHING;
  GET DIAGNOSTICS inserted_clubs = ROW_COUNT;

  INSERT INTO public.players(
    dbv_id,name,club,club_id,birth_year,age_class,association,
    last_ranking_week,source_url,verified_at,updated_at
  )
  SELECT p.id,p.name,nullif(p.club,''),c.id,p."birthYear",p."ageClass",
         p.association,snapshot_tag,'https://turniere.badminton.de/ranking',now(),now()
  FROM pg_catalog.jsonb_to_recordset(p_players) AS p(
    id text, name text, "birthYear" integer, "ageClass" text,
    club text, "clubId" text, association text, "lastSeen" text
  )
  LEFT JOIN public.clubs c ON c.dbv_club_id=p."clubId"
  ON CONFLICT(dbv_id) DO UPDATE SET
    name=excluded.name, club=excluded.club, club_id=excluded.club_id,
    birth_year=excluded.birth_year,age_class=excluded.age_class,
    association=excluded.association,last_ranking_week=excluded.last_ranking_week,
    source_url=excluded.source_url,verified_at=excluded.verified_at,
    updated_at=excluded.updated_at
  WHERE coalesce(public.players.last_ranking_week,'')<=excluded.last_ranking_week;
  GET DIAGNOSTICS affected_players = ROW_COUNT;

  -- The latest published Excel is a complete ranking *state*, even for people
  -- who did not play this week. Never infer points from recent matches.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_players) AS entry
    WHERE pg_catalog.jsonb_typeof(entry->'rankings') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(entry->'rankings') > 6
  ) THEN
    RAISE EXCEPTION 'Missing or invalid full ranking payload';
  END IF;
  SELECT coalesce(sum(pg_catalog.jsonb_array_length(entry->'rankings')),0)
    INTO rank_count FROM pg_catalog.jsonb_array_elements(p_players) AS entry;
  IF rank_count < (actual_count * 0.80)::integer OR rank_count > 6*actual_count THEN
    RAISE EXCEPTION 'Incomplete official ranking coverage';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_players) AS entry
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(entry->'rankings') AS ranking
    WHERE pg_catalog.jsonb_typeof(ranking) <> 'array'
       OR pg_catalog.jsonb_array_length(ranking) <> 6
       OR (ranking->>0) NOT IN ('HE','HD','HM','DE','DD','DM')
       OR (ranking->>1)::numeric < 0
       OR (ranking->>1)::numeric > 1000000000
       OR (ranking->>2)::integer NOT BETWEEN 0 AND 200
       OR (ranking->>3)::integer NOT BETWEEN 1 AND 50000
       OR ((ranking->>4) IS NOT NULL AND (ranking->>4)::integer NOT BETWEEN 1 AND 50000)
       OR ((ranking->>5) IS NOT NULL AND (ranking->>5)::integer NOT BETWEEN 1 AND 50000)
  ) THEN
    RAISE EXCEPTION 'Invalid official ranking values';
  END IF;
  IF (SELECT count(DISTINCT (entry->>'id')||':'||(ranking->>0))
      FROM pg_catalog.jsonb_array_elements(p_players) AS entry
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(entry->'rankings') AS ranking
     ) <> rank_count THEN
     RAISE EXCEPTION 'Duplicate official ranking discipline';
  END IF;

  INSERT INTO public.ranking_weeks(year,week,source_url,imported_at)
  VALUES (p_year,p_week,'https://turniere.badminton.de/ranking',now())
  ON CONFLICT (year,week) DO UPDATE SET
    source_url=excluded.source_url,imported_at=now();
  SELECT w.id INTO current_week_id FROM public.ranking_weeks w
  WHERE w.year=p_year AND w.week=p_week;
  -- Replacing the entire validated week is atomic and prevents stale rows.
  DELETE FROM public.ranking_entries WHERE week_id=current_week_id;
  INSERT INTO public.ranking_entries(
    week_id,player_id,discipline,age_group,points,tournaments_count,
    germany_age_rank,bw_age_rank,germany_youth_overall_rank,source_quality
  )
  SELECT current_week_id,p.id,r->>0,entry->>'ageClass',
    (r->>1)::numeric,(r->>2)::integer,(r->>3)::integer,
    (r->>4)::integer,(r->>5)::integer,'official_total'
  FROM pg_catalog.jsonb_array_elements(p_players) AS entry
  CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(entry->'rankings') AS r
  JOIN public.players p ON p.dbv_id=entry->>'id';
  IF (SELECT count(*) FROM public.ranking_entries
      WHERE week_id=current_week_id) <> rank_count THEN
     RAISE EXCEPTION 'Ranking snapshot verification mismatch';
  END IF;
  -- Storage budget: eight published snapshots maximum, no permanent
  -- nationwide weekly history or raw Excel copies. Existing player identities
  -- and match/trophy history are unaffected.
  DELETE FROM public.ranking_weeks w
   WHERE w.id NOT IN (
     SELECT kept.id FROM public.ranking_weeks kept
     ORDER BY kept.year DESC,kept.week DESC LIMIT 8
   );

  RETURN pg_catalog.jsonb_build_object(
    'snapshot',snapshot_tag,'read',actual_count,'players_upserted',affected_players,
    'clubs_inserted',inserted_clubs,'rankings_imported',rank_count
  );
END
$function$


CREATE OR REPLACE FUNCTION public.ingest_private_dbv_weekly(p_attempt_id uuid, p_year integer, p_week integer, p_total integer, p_players jsonb, p_source_published_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
  -- A weekly file demonstrably listed in the official archive can have no
  -- individually published timestamp. NULL is an honest unknown, never now().
  -- A present official timestamp MUST continue matching the exact ISO week.
  IF p_source_published_at IS NULL THEN
    IF p_year*100+p_week >
      extract(isoyear FROM now() AT TIME ZONE 'Europe/Berlin')::integer*100 +
      extract(week FROM now() AT TIME ZONE 'Europe/Berlin')::integer THEN
      RAISE EXCEPTION 'Future official DBV archive week rejected';
    END IF;
  ELSIF p_source_published_at>now()+interval '5 minutes'
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
    IF v_prior.payload_md5<>v_hash OR v_prior.published_at IS DISTINCT FROM p_source_published_at THEN
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
  UPDATE public.ranking_weeks
    SET source_published_at=p_source_published_at,
        source_url=CASE WHEN p_source_published_at IS NULL THEN
          'https://turniere.badminton.de/uploads/ranking/Ranking_' ||
          p_year::text || '_KW' || lpad(p_week::text,2,'0') || '.xlsx'
          ELSE 'https://turniere.badminton.de/ranking' END
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
$function$


-- Privileges must stay service_role only (idempotent defense in depth).
REVOKE ALL ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ingest_private_dbv_weekly(uuid,integer,integer,integer,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_private_dbv_weekly(uuid,integer,integer,integer,jsonb,timestamptz) TO service_role;
