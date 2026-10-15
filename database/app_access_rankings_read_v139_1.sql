-- v139.1: existing official DBV ranking totals for an invited app member.
-- Only explicitly requested DBV identity; no public JSON, no bulk listing, no RLS change.
CREATE OR REPLACE FUNCTION public.app_access_rankings_read(p_player_dbv_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_week record;
  v_disciplines jsonb;
BEGIN
  IF p_player_dbv_id IS NULL OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$' THEN
    RETURN NULL;
  END IF;
  IF NOT public.app_access_is_member() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT w.id,w.year,w.week,w.source_url
    INTO v_week
    FROM public.ranking_entries e
    JOIN public.players p ON p.id=e.player_id
    JOIN public.ranking_weeks w ON w.id=e.week_id
   WHERE p.dbv_id=p_player_dbv_id AND e.source_quality='official_total'
   ORDER BY w.year DESC,w.week DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('player_dbv_id',p_player_dbv_id,'status','no_verified_ranking');
  END IF;
  SELECT coalesce(jsonb_object_agg(e.discipline,jsonb_build_object(
      'ageClass',e.age_group,
      'birthYear',p.birth_year,
      'points',e.points,
      'tournaments',e.tournaments_count,
      'ageClassRank',e.germany_age_rank,
      'bwAgeClassRank',e.bw_age_rank
    )),'{}'::jsonb)
    INTO v_disciplines
    FROM public.ranking_entries e
    JOIN public.players p ON p.id=e.player_id
   WHERE p.dbv_id=p_player_dbv_id
     AND e.week_id=v_week.id
     AND e.source_quality='official_total'
     AND e.discipline IN ('HE','HD','HM','DE','DD','DM');
  RETURN jsonb_build_object(
    'player_dbv_id',p_player_dbv_id,
    'status','available',
    'current',jsonb_build_object('year',v_week.year,'week',v_week.week,'url',v_week.source_url),
    'disciplines',v_disciplines
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.app_access_rankings_read(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_access_rankings_read(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.app_access_rankings_read(text) TO authenticated;