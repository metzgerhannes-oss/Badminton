-- v133 · Small, user-initiated official DBV identity search.
-- Public RLS on players stays unchanged: anonymous table SELECT is NOT granted.
-- Only name, club, age class, federation and DBV id; no birth year, games,
-- trophy rows, rankings, private permission records or list-all endpoint.
CREATE OR REPLACE FUNCTION public.search_dbv_player_identity(
  p_query text,
  p_age_class text DEFAULT NULL,
  p_club text DEFAULT NULL,
  p_association text DEFAULT NULL
)
RETURNS TABLE(dbv_id text, name text, club text, age_class text, association text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $search$
DECLARE
  q text := btrim(left(coalesce(p_query,''),70));
  club_filter text := btrim(left(coalesce(p_club,''),90));
BEGIN
  -- No wildcards, metacharacters or empty catalog listing. Exact DBV id works.
  IF q !~ '^[[:alpha:][:digit:] -]{3,70}$' THEN RETURN; END IF;
  IF p_age_class IS NOT NULL AND p_age_class NOT IN
    ('U11','U13','U15','U17','U19','U22') THEN RETURN; END IF;
  IF p_association IS NOT NULL AND
    (length(p_association)>50 OR p_association !~ '^[[:alpha:][:digit:] -]+$') THEN RETURN; END IF;
  IF p_club IS NOT NULL AND
    (length(club_filter)<2 OR club_filter !~ '^[[:alpha:][:digit:] .&/()-]+$') THEN RETURN; END IF;
  RETURN QUERY
   SELECT p.dbv_id::text, p.name::text, p.club::text, p.age_class::text, p.association::text
   FROM public.players p
   WHERE p.dbv_id ~ '^[0-9]{2}-[0-9]{6}
     AND length(btrim(p.name))>0
     AND (p.dbv_id = q OR p.name ILIKE ('%' || q || '%'))
     AND (p_age_class IS NULL OR p.age_class=p_age_class)
     AND (p_association IS NULL OR p.association=p_association)
     AND (p_club IS NULL OR p.club ILIKE ('%' || club_filter || '%'))
   ORDER BY CASE WHEN p.dbv_id=q THEN 0
      WHEN lower(p.name)=lower(q) THEN 1
      WHEN p.name ILIKE (q || '%') THEN 2 ELSE 3 END,
     p.name, p.dbv_id
   LIMIT 12;
END
$search$;
-- Narrow grants to this one function; no table/data-policy changes.
REVOKE ALL ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
 TO anon,authenticated;
COMMENT ON FUNCTION public.search_dbv_player_identity(text,text,text,text) IS
 'Explicit DBV identity lookup only: max 12 matches, 3+ safe characters, restricted output. No access to trophies or match records.';

     AND p.verified_at IS NOT NULL AND p.last_ranking_week IS NOT NULL
     AND length(btrim(p.name))>0
     AND (p.dbv_id = q OR p.name ILIKE ('%' || q || '%'))
     AND (p_age_class IS NULL OR p.age_class=p_age_class)
     AND (p_association IS NULL OR p.association=p_association)
     AND (p_club IS NULL OR p.club ILIKE ('%' || club_filter || '%'))
   ORDER BY CASE WHEN p.dbv_id=q THEN 0
      WHEN lower(p.name)=lower(q) THEN 1
      WHEN p.name ILIKE (q || '%') THEN 2 ELSE 3 END,
     p.name, p.dbv_id
   LIMIT 12;
END
$search$;
-- Narrow grants to this one function; no table/data-policy changes.
REVOKE ALL ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_dbv_player_identity(text,text,text,text)
 TO anon,authenticated;
COMMENT ON FUNCTION public.search_dbv_player_identity(text,text,text,text) IS
 'Explicit DBV identity lookup only: max 12 matches, 3+ safe characters, restricted output. No access to trophies or match records.';
