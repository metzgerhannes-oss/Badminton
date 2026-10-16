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
  RETURN pg_catalog.jsonb_build_object(
    'snapshot',snapshot_tag,'read',actual_count,'players_upserted',affected_players,
    'clubs_inserted',inserted_clubs
  );
END
$body$;
REVOKE ALL ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_private_dbv_directory(integer,integer,integer,jsonb) TO service_role;
