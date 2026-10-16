-- Complete authoritative weekly DBV ranking, compact private storage.
-- Extend existing atomic service_role importer and preserve access gates.
-- Private weekly DBV directory ingestion, fed exclusively by a signed GitHub OIDC workflow.
-- No names/identifiers are committed to the public repository.
-- One PostgreSQL transaction validates and merges the complete snapshot.
CREATE OR REPLACE FUNCTION public.ingest_private_dbv_directory(
  p_year integer, p_week integer, p_total integer, p_players jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
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
       OR p."ageClass" IS NULL OR p."ageClass" NOT IN ('U11','U13','U15','U17','U19','U22')
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
$body$;
REVOKE ALL ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) TO service_role;


-- For any *complete* official weekly import, use exactly the newest publication.
-- A missing player in that complete weekly ranking must not fall back to an old
-- position. Preserve legacy partial rows only until the first full import.
CREATE OR REPLACE FUNCTION public.app_access_rankings_read(p_player_dbv_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $reader$
DECLARE
  v_week record;
  v_disciplines jsonb;
  v_full boolean := false;
BEGIN
  IF p_player_dbv_id IS NULL OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$' THEN
    RETURN NULL;
  END IF;
  IF NOT public.app_access_is_member() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT w.id,w.year,w.week,w.source_url INTO v_week
  FROM public.ranking_weeks w
  WHERE (SELECT count(*) FROM public.ranking_entries e
         WHERE e.week_id=w.id AND e.source_quality='official_total')>=4000
  ORDER BY w.year DESC,w.week DESC LIMIT 1;
  v_full := FOUND;
  IF NOT v_full THEN
    -- Compatibility: selected profiles had partial, personally-verified
    -- snapshots before the complete signed importer existed.
    SELECT w.id,w.year,w.week,w.source_url INTO v_week
    FROM public.ranking_entries e
    JOIN public.players p ON p.id=e.player_id
    JOIN public.ranking_weeks w ON w.id=e.week_id
    WHERE p.dbv_id=p_player_dbv_id AND e.source_quality='official_total'
    ORDER BY w.year DESC,w.week DESC LIMIT 1;
  END IF;
  IF NOT FOUND AND NOT v_full THEN
    RETURN jsonb_build_object(
      'player_dbv_id',p_player_dbv_id,'status','no_verified_ranking');
  END IF;
  SELECT pg_catalog.coalesce(pg_catalog.jsonb_object_agg(e.discipline,
     pg_catalog.jsonb_build_object(
       'ageClass',e.age_group,
       'birthYear',p.birth_year,
       'points',e.points,
       'tournaments',e.tournaments_count,
       'ageClassRank',e.germany_age_rank,
       'bwAgeClassRank',e.bw_age_rank,
       'nationalYouthOverallRank',e.germany_youth_overall_rank
     )),'{}'::jsonb) INTO v_disciplines
  FROM public.ranking_entries e
  JOIN public.players p ON p.id=e.player_id
  WHERE p.dbv_id=p_player_dbv_id
    AND e.week_id=v_week.id AND e.source_quality='official_total'
    AND e.discipline IN ('HE','HD','HM','DE','DD','DM');
  IF v_disciplines='{}'::jsonb THEN
    RETURN jsonb_build_object('player_dbv_id',p_player_dbv_id,
      'status','no_verified_ranking',
      'reason',CASE WHEN v_full THEN 'not_listed_in_latest_official_export'
        ELSE 'not_imported' END,
      'current', CASE WHEN v_full THEN
       jsonb_build_object('year',v_week.year,'week',v_week.week,'url',v_week.source_url)
       ELSE NULL END);
  END IF;
  RETURN jsonb_build_object(
    'player_dbv_id',p_player_dbv_id,
    'status','available',
    'current',jsonb_build_object('year',v_week.year,'week',v_week.week,'url',v_week.source_url),
    'disciplines',v_disciplines);
END
$reader$;
REVOKE ALL ON FUNCTION public.app_access_rankings_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_access_rankings_read(text) TO authenticated,service_role;
