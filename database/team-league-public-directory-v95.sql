
-- Schmetterlinge: public team directory with read-only and source-traceable league data.
-- User follows are intentionally kept on-device; no private roster or contacts here.
create table if not exists public.league_teams (
  id text primary key,
  follow_key text not null,
  provider text not null default 'nuliga',
  club_id text not null,
  club_name text not null,
  team_label text not null,
  league_name text not null,
  season text not null,
  position integer check (position is null or position > 0),
  points_for integer check (points_for is null or points_for >= 0),
  points_against integer check (points_against is null or points_against >= 0),
  source_url text not null,
  source_checked_at timestamptz not null,
  unique (follow_key, season)
);
create index if not exists league_teams_search_idx on public.league_teams(season, club_name);
create index if not exists league_teams_follow_idx on public.league_teams(follow_key);

create table if not exists public.league_fixtures (
  id text primary key,
  team_id text not null references public.league_teams(id) on delete cascade,
  match_date timestamptz,
  home_team text not null,
  away_team text not null,
  home_score integer check(home_score is null or home_score between 0 and 8),
  away_score integer check(away_score is null or away_score between 0 and 8),
  status text not null check(status in ('scheduled','finished','postponed','cancelled','forfeit','unknown')),
  source_url text not null,
  source_checked_at timestamptz not null,
  check ((home_score is null and away_score is null) or (home_score is not null and away_score is not null))
);
create index if not exists league_fixtures_team_date_idx on public.league_fixtures(team_id,match_date);

create table if not exists public.league_table_rows (
  id text primary key,
  team_id text not null references public.league_teams(id) on delete cascade,
  position integer not null check(position>0),
  club_team text not null,
  played integer check(played is null or played>=0),
  won integer check(won is null or won>=0),
  drawn integer check(drawn is null or drawn>=0),
  lost integer check(lost is null or lost>=0),
  points_for integer check(points_for is null or points_for>=0),
  points_against integer check(points_against is null or points_against>=0),
  games_for integer check(games_for is null or games_for>=0),
  games_against integer check(games_against is null or games_against>=0),
  sets_for integer check(sets_for is null or sets_for>=0),
  sets_against integer check(sets_against is null or sets_against>=0),
  source_url text not null,
  source_checked_at timestamptz not null
);
create index if not exists league_table_rows_team_idx on public.league_table_rows(team_id,position);

alter table public.league_teams enable row level security;
alter table public.league_fixtures enable row level security;
alter table public.league_table_rows enable row level security;
revoke all on public.league_teams, public.league_fixtures, public.league_table_rows from PUBLIC, anon, authenticated;
grant select on public.league_teams, public.league_fixtures, public.league_table_rows to anon, authenticated;
create policy league_teams_public_read on public.league_teams for select to anon, authenticated using (true);
create policy league_fixtures_public_read on public.league_fixtures for select to anon, authenticated using (true);
create policy league_table_rows_public_read on public.league_table_rows for select to anon, authenticated using (true);

-- Initial curated source snapshots. No games or full table invented.
insert into public.league_teams(id,follow_key,club_id,club_name,team_label,league_name,season,position,points_for,points_against,source_url,source_checked_at)
values
 ('nuliga:10777:2026-27:1','nuliga:10777:1','10777','SpVgg. Mössingen','I','Regionalliga SüdOst','2026/27',1,4,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777','2026-10-12T12:45:00+02:00'),
 ('nuliga:10777:2026-27:2','nuliga:10777:2','10777','SpVgg. Mössingen','II','Württemberg-Liga','2026/27',5,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777','2026-10-12T12:45:00+02:00'),
 ('nuliga:10777:2026-27:3','nuliga:10777:3','10777','SpVgg. Mössingen','III','Württemberg-Liga','2026/27',6,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777','2026-10-12T12:45:00+02:00'),
 ('nuliga:10777:2026-27:4','nuliga:10777:4','10777','SpVgg. Mössingen','IV','Landesliga Zollern / Alb-Donau','2026/27',5,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777','2026-10-12T12:45:00+02:00'),
 ('nuliga:10777:2026-27:5','nuliga:10777:5','10777','SpVgg. Mössingen','V','Kreisliga Reutlingen / Zollern-Alb','2026/27',5,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777','2026-10-12T12:45:00+02:00'),
 ('nuliga:10892:2026-27:1','nuliga:10892:1','10892','TSG Heilbronn','I','Baden-Württemberg-Liga','2026/27',8,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892','2026-10-12T12:45:00+02:00'),
 ('nuliga:10892:2026-27:2','nuliga:10892:2','10892','TSG Heilbronn','II','Verbandsliga Nordbaden','2026/27',1,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892','2026-10-12T12:45:00+02:00'),
 ('nuliga:10892:2026-27:3','nuliga:10892:3','10892','TSG Heilbronn','III','Landesliga Unterer Neckar - Odenwald','2026/27',1,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892','2026-10-12T12:45:00+02:00'),
 ('nuliga:10892:2026-27:4','nuliga:10892:4','10892','TSG Heilbronn','IV','Bezirksliga Neckar-Odenwald','2026/27',7,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892','2026-10-12T12:45:00+02:00'),
 ('nuliga:10892:2026-27:5','nuliga:10892:5','10892','TSG Heilbronn','V','Bezirksliga Neckar-Odenwald','2026/27',6,0,0,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892','2026-10-12T12:45:00+02:00'),
 ('nuliga:10869:2026-27:1','nuliga:10869:1','10869','TV Mannheim-Neckarau','I','Landesliga Unterer Neckar - Odenwald','2026/27',7,0,2,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10869','2026-10-12T12:45:00+02:00'),
 ('nuliga:10869:2026-27:2','nuliga:10869:2','10869','TV Mannheim-Neckarau','II','Bezirksliga Unterer Neckar','2026/27',4,1,1,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10869','2026-10-12T12:45:00+02:00'),
 ('nuliga:10869:2026-27:3','nuliga:10869:3','10869','TV Mannheim-Neckarau','III','Kreisliga Mannheim-Heidelberg','2026/27',5,0,2,'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10869','2026-10-12T12:45:00+02:00')
on conflict (id) do nothing;
