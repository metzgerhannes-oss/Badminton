-- v250 service-only atomic matchday writes; transactional and idempotent.
CREATE OR REPLACE FUNCTION public.dbv_matchday_store(
 p_tournament_id uuid,p_dbv_id text,p_player_no integer,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp
AS $fn$
DECLARE
 target record;
 row_ jsonb;
 member jsonb;
 game jsonb;
 event_uuid uuid;
 match_uuid uuid;
 verified_player uuid;
 source_key text;
 event_key text;
 round_ text;
 label_ text;
 discipline_ text;
 age_ text;
 court_ text;
 status_ text;
 instant_ timestamptz;
 winner_ integer;
 own_count integer;
 side_ integer;
 position_ integer;
 local_no integer;
 participant text;
 previous_status text;
 existing_count integer;
 current_count integer;
 source_link text;
 saved integer:=0;
 ended integer:=0;
 seen text[]:=array[]::text[];
 a_win integer;
 b_win integer;
 BEGIN
 SELECT t.external_id,t.start_date,t.end_date,pl.id AS player_uuid
 INTO target FROM public.dbv_matchday_targets tg
 JOIN public.tournaments t ON t.id=tg.tournament_id
 JOIN public.players pl ON pl.dbv_id=tg.dbv_id AND pl.verified_at IS NOT NULL
 WHERE tg.tournament_id=p_tournament_id
  AND tg.dbv_id=p_dbv_id AND tg.source_player_no=p_player_no
  AND t.provider='dbv.turnier.de';
 IF NOT FOUND OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array'
 THEN RAISE EXCEPTION 'dbv_scope_invalid'; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 60
 THEN RAISE EXCEPTION 'dbv_card_count_invalid'; END IF;
 source_link='https://dbv.turnier.de/tournament/'||
  upper(target.external_id::text)||'/player/'||p_player_no;
 PERFORM pg_advisory_xact_lock(hashtextextended(
  'dbv-day:'||p_tournament_id||':'||p_dbv_id,0));
 FOR row_ IN SELECT value FROM jsonb_array_elements(p_rows)
 LOOP
  source_key=row_->>'source_match_id';
  event_key=row_->>'source_event_id';
  round_=btrim(coalesce(row_->>'round_label',''));
  label_=btrim(coalesce(row_->>'title',''));
  discipline_=row_->>'discipline';
  age_=row_->>'age_group';
  court_=row_->>'court';
  status_=row_->>'status';
  IF source_key IS NULL OR source_key !~
    '^pv:[0-9]{1,6}:[0-9]{1,7}:[a-z0-9-]{1,36}:[1-9][0-9]?$'
   OR source_key NOT LIKE 'pv:'||p_player_no||':%'
   OR source_key=ANY(seen)
   OR event_key !~ '^draw:[0-9]{1,7}$'
   OR length(round_) NOT BETWEEN 3 AND 75
   OR length(label_) NOT BETWEEN 4 AND 60
   OR discipline_ NOT IN ('MS','WS','MD','WD','XD')
   OR age_ !~ '^U(9|11|13|15|17|19|22)$'
   OR status_ NOT IN ('scheduled','finished')
   OR (court_ IS NOT NULL AND court_ !~ '^[0-9]{1,3}$')
   OR jsonb_typeof(row_->'sides')<>'array'
   OR jsonb_array_length(row_->'sides')<>2
   OR jsonb_typeof(row_->'games')<>'array'
  THEN RAISE EXCEPTION 'dbv_row_invalid'; END IF;
  seen=array_append(seen,source_key);
  instant_=NULLIF(row_->>'scheduled_at','')::timestamptz;
  IF instant_ IS NULL OR
    (instant_ AT TIME ZONE 'Europe/Berlin')::date
      NOT BETWEEN target.start_date AND target.end_date
  THEN RAISE EXCEPTION 'dbv_outside_tournament'; END IF;
  winner_=NULLIF(row_->>'winning_side','')::integer;
  IF (status_='scheduled' AND (
     winner_ IS NOT NULL OR jsonb_array_length(row_->'games')<>0))
   OR (status_='finished' AND (
     winner_ IS NULL OR winner_ NOT IN (1,2) OR
     jsonb_array_length(row_->'games') NOT BETWEEN 2 AND 5))
  THEN RAISE EXCEPTION 'dbv_score_status_invalid'; END IF;
  own_count=0;current_count=0;
  FOR side_ IN 0..1 LOOP
   IF jsonb_typeof(row_->'sides'->side_)<>'array'
     OR jsonb_array_length(row_->'sides'->side_)>2
   THEN RAISE EXCEPTION 'dbv_pairing_invalid'; END IF;
   FOR member IN SELECT value FROM jsonb_array_elements(row_->'sides'->side_)
   LOOP
    local_no=(member->>'local_id')::integer;
    participant=btrim(coalesce(member->>'name',''));
    IF local_no NOT BETWEEN 1 AND 999999
     OR length(participant) NOT BETWEEN 2 AND 100
    THEN RAISE EXCEPTION 'dbv_participant_invalid'; END IF;
    IF local_no=p_player_no THEN own_count=own_count+1; END IF;
    current_count=current_count+1;
   END LOOP;
  END LOOP;
  IF own_count<>1 THEN RAISE EXCEPTION 'dbv_identity_ambiguous'; END IF;
  a_win=0;b_win=0;
  IF status_='finished' THEN
   FOR game IN SELECT value FROM jsonb_array_elements(row_->'games')
   LOOP
    IF (game->>'number')::integer NOT BETWEEN 1 AND 5 OR
     (game->>'side1')::integer NOT BETWEEN 0 AND 40 OR
     (game->>'side2')::integer NOT BETWEEN 0 AND 40 OR
     (game->>'side1')::integer=(game->>'side2')::integer
    THEN RAISE EXCEPTION 'dbv_set_points_invalid'; END IF;
    IF (game->>'side1')::integer>(game->>'side2')::integer
    THEN a_win=a_win+1;ELSE b_win=b_win+1;END IF;
   END LOOP;
   IF (winner_=1 AND a_win<=b_win) OR (winner_=2 AND b_win<=a_win)
   THEN RAISE EXCEPTION 'dbv_winner_score_conflict'; END IF;
  END IF;
  INSERT INTO public.events(tournament_id,source_event_id,title,discipline,age_group,source_url)
  VALUES(p_tournament_id,event_key,label_,discipline_,age_,
   'https://dbv.turnier.de/sport/draw.aspx?id='||
     lower(target.external_id::text)||'&draw='||split_part(event_key,':',2))
  ON CONFLICT (tournament_id,source_event_id) DO UPDATE
  SET title=EXCLUDED.title,discipline=EXCLUDED.discipline,
    age_group=EXCLUDED.age_group,updated_at=now()
  RETURNING id INTO event_uuid;
  SELECT m.status INTO previous_status FROM public.matches m
   WHERE m.tournament_id=p_tournament_id AND m.source_match_id=source_key FOR UPDATE;
  INSERT INTO public.matches(tournament_id,event_id,source_match_id,round_label,
   status,court,scheduled_at,winning_side,source_url,last_synced_at)
  VALUES(p_tournament_id,event_uuid,source_key,round_,status_,
    court_,instant_,winner_,source_link,now())
  ON CONFLICT (tournament_id,source_match_id) DO UPDATE
   SET event_id=EXCLUDED.event_id,round_label=EXCLUDED.round_label,
    status=CASE WHEN public.matches.status='finished' AND
       EXCLUDED.status<>'finished' THEN 'finished' ELSE EXCLUDED.status END,
    court=COALESCE(EXCLUDED.court,public.matches.court),
    scheduled_at=COALESCE(EXCLUDED.scheduled_at,public.matches.scheduled_at),
    winning_side=CASE WHEN public.matches.status='finished' AND
       EXCLUDED.status<>'finished' THEN public.matches.winning_side
       ELSE EXCLUDED.winning_side END,
    source_url=EXCLUDED.source_url,last_synced_at=now()
  RETURNING id INTO match_uuid;
  SELECT count(*) INTO existing_count FROM public.match_participants
   WHERE match_id=match_uuid;
  IF NOT (previous_status='finished' AND status_<>'finished')
   AND current_count>=existing_count THEN
   DELETE FROM public.match_participants WHERE match_id=match_uuid;
   FOR side_ IN 0..1 LOOP
    position_=0;
    FOR member IN SELECT value FROM jsonb_array_elements(row_->'sides'->side_)
    LOOP
     position_=position_+1;
     local_no=(member->>'local_id')::int;
     participant=btrim(member->>'name');
     verified_player=CASE WHEN local_no=p_player_no THEN target.player_uuid ELSE NULL END;
     INSERT INTO public.match_participants(
      match_id,side,player_position,participant_name,player_id)
     VALUES(match_uuid,side_+1,position_,participant,verified_player);
    END LOOP;
   END LOOP;
  END IF;
  IF status_='finished' THEN
   FOR game IN SELECT value FROM jsonb_array_elements(row_->'games')
   LOOP
    INSERT INTO public.match_games(match_id,game_number,side1_points,side2_points,finished)
    VALUES(match_uuid,(game->>'number')::int,(game->>'side1')::int,
     (game->>'side2')::int,true)
    ON CONFLICT(match_id,game_number) DO UPDATE
     SET side1_points=EXCLUDED.side1_points,
         side2_points=EXCLUDED.side2_points,finished=true;
   END LOOP;
   DELETE FROM public.match_games WHERE match_id=match_uuid
   AND game_number>jsonb_array_length(row_->'games');
   ended=ended+1;
  END IF;
  saved=saved+1;
 END LOOP;
 UPDATE public.dbv_matchday_targets SET
  last_checked_at=now(),last_success_at=now(),last_error_at=NULL,error_code=NULL,
  last_match_count=saved WHERE tournament_id=p_tournament_id AND dbv_id=p_dbv_id;
 RETURN jsonb_build_object('stored',saved,'finished',ended,'synced_at',now());
END;
$fn$;
REVOKE ALL ON FUNCTION public.dbv_matchday_store(uuid,text,integer,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dbv_matchday_store(uuid,text,integer,jsonb)
 TO service_role;
