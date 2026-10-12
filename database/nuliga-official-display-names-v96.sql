-- Preserve the official team name when the registered club plays under an SG name.
alter table public.league_teams add column if not exists official_team_name text;
update public.league_teams
set official_team_name =
  (case club_id when '10892' then 'SG Heilbronn/Leingarten'
                when '10869' then 'BSG Mannheim'
                else club_name end)
  || (case when team_label='I' then '' else ' '||team_label end)
where season='2026/27' and club_id in ('10777','10892','10869');
