-- Public, read-only, source-backed match observations for player statistics.
-- This view is invoker-secured: the underlying public-match tables remain RLS governed.
-- A finished match without a documented unique match key, winner, event or opponent
-- is explicitly NOT counted. No placement or ranking row is ever interpreted as a match.
create or replace view public.player_match_observations
with (security_invoker = true) as
select distinct on (p.dbv_id,m.id)
  p.dbv_id,
  m.id as match_id,
  t.name as tournament_name,
  coalesce(m.finished_at::date,m.scheduled_at::date,t.start_date) as match_date,
  e.discipline as event_code,
  case
    when e.discipline in ('MS','WS') then 'Einzel'
    when e.discipline in ('MD','WD') then 'Doppel'
    when e.discipline = 'XD' then 'Mixed'
    else 'Unbekannt'
  end as discipline,
  m.status as match_status,
  mp.side as player_side,
  m.winning_side,
  coalesce(m.source_url,t.source_url) as source_url,
  m.last_synced_at,
  o.opponent_names,
  sc.game_score,
  (
    m.status = 'finished'
    and m.winning_side in (1,2)
    and e.discipline in ('MS','WS','MD','WD','XD')
    and nullif(btrim(m.source_match_id),'') is not null
    and coalesce(m.source_url,t.source_url) ~ '^https://'
    and o.opponent_names is not null
    and not exists (
      select 1 from public.match_participants bad
      where bad.match_id=m.id and bad.player_id=mp.player_id and bad.side<>mp.side
    )
  ) as countable,
  case
    when m.status = 'walkover' then 'Kampflos'
    when m.status = 'cancelled' then 'Abgesagt'
    when m.status <> 'finished' then 'Nicht abgeschlossen'
    when m.winning_side not in (1,2) or m.winning_side is null then 'Sieger nicht belegt'
    when e.discipline not in ('MS','WS','MD','WD','XD') or e.discipline is null then 'Disziplin unbekannt'
    when nullif(btrim(m.source_match_id),'') is null then 'Offizielle Match-ID fehlt'
    when coalesce(m.source_url,t.source_url) !~ '^https://' then 'Quellbeleg fehlt'
    when o.opponent_names is null then 'Gegnerseite fehlt'
    when exists (
      select 1 from public.match_participants bad
      where bad.match_id=m.id and bad.player_id=mp.player_id and bad.side<>mp.side
    ) then 'Unklare Teamzuordnung'
    else null
  end as exclusion_reason
from public.match_participants mp
join public.players p on p.id=mp.player_id
join public.matches m on m.id=mp.match_id
join public.tournaments t on t.id=m.tournament_id
left join public.events e on e.id=m.event_id
left join lateral (
  select nullif(string_agg(
    coalesce(nullif(btrim(opp.participant_name),''),
      nullif(btrim(op.name),'')),
    ' / ' order by opp.player_position
  ),'') as opponent_names
  from public.match_participants opp
  left join public.players op on op.id=opp.player_id
  where opp.match_id=m.id and opp.side<>mp.side
) o on true
left join lateral (
  select nullif(string_agg(
    g.side1_points::text || ':' || g.side2_points::text,
    ', ' order by g.game_number
  ),'') as game_score
  from public.match_games g
  where g.match_id=m.id and g.finished=true
    and g.side1_points is not null and g.side2_points is not null
) sc on true
order by p.dbv_id,m.id,mp.player_position;
revoke all on public.player_match_observations from public;
grant select on public.player_match_observations to anon,authenticated;
comment on view public.player_match_observations is
'One row per player and sourced match. countable true only with finished status, winner, validated event, source, match key and both sides. No win/loss inferred from rankings or placements.';
