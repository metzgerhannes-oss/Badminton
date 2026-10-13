-- Badminton only: yadexibmjmnjfmfabrug
-- PRIVACY CUTOVER: No personal player data can be read by unauthenticated visitors
-- or by arbitrary authenticated/anonymous-auth users.
-- Intentionally takes individual player search, match KPIs and source mentions offline
-- until server-verified invitation scopes are implemented and tested.
-- Never grant SELECT TO authenticated alone: anonymous Auth users share that role.
-- Public DBV tournament calendar, clubs, team fixtures and generic event metadata remain.
begin;
revoke select on public.article_player_mentions, public.articles, public.match_games, public.match_participants, public.matches, public.player_external_match_facts, public.player_external_match_imports, public.player_history_imports, public.player_history_overviews, public.player_live_snapshots, public.players, public.ranking_entries, public.shared_tournament_hints, public.tournament_placements from public,anon,authenticated;
revoke select on public.player_match_observations from public,anon,authenticated;
drop policy if exists "Public checked article mentions" on public.article_player_mentions;
drop policy if exists "Public verified report links" on public.articles;
drop policy if exists "Public DBV game scores can be read" on public.match_games;
drop policy if exists "Public DBV participants can be read" on public.match_participants;
drop policy if exists "Public DBV matches can be read" on public.matches;
drop policy if exists "Read sourced individual external matches" on public.player_external_match_facts;
drop policy if exists "Read verified external history import progress" on public.player_external_match_imports;
drop policy if exists "Anyone can read DBV import statuses" on public.player_history_imports;
drop policy if exists "Anyone can read verified external overviews" on public.player_history_overviews;
drop policy if exists "Public verified live snapshot read" on public.player_live_snapshots;
drop policy if exists "Public DBV players can be read" on public.players;
drop policy if exists "Public DBV rankings can be read" on public.ranking_entries;
drop policy if exists "Public read community tournament hints" on public.shared_tournament_hints;
drop policy if exists "Curated placement results are readable" on public.tournament_placements;
-- Legacy column-level ACL: a table-level revoke alone does not revoke these.
revoke select (dbv_id,status,requested_at,last_checked_at,updated_at,source_name,detail,imported_match_count)
 on public.player_history_imports from public,anon,authenticated;
-- Also stop public creation of new history jobs during the private cutover.
revoke insert (dbv_id) on public.player_history_imports from public,anon,authenticated;
revoke execute on function public.request_player_history_demand(text) from public,anon,authenticated;
do $verify$
declare tbl text; is_open boolean;
begin
 foreach tbl in array array['article_player_mentions','articles','match_games','match_participants','matches','player_external_match_facts','player_external_match_imports','player_history_imports','player_history_overviews','player_live_snapshots','players','ranking_entries','shared_tournament_hints','tournament_placements'] loop
  select has_table_privilege('anon',format('public.%I',tbl),'SELECT')
    or has_table_privilege('authenticated',format('public.%I',tbl),'SELECT')
    into is_open;
  if is_open then raise exception 'Unexpected browser read grant: %',tbl;end if;
 end loop;
 if has_column_privilege('anon','public.player_history_imports','dbv_id','SELECT') or
    has_column_privilege('authenticated','public.player_history_imports','status','SELECT') then
   raise exception 'History import column grants remain';
 end if;
 if has_function_privilege('anon','public.request_player_history_demand(text)','EXECUTE') or
    has_function_privilege('authenticated','public.request_player_history_demand(text)','EXECUTE') then
   raise exception 'History requester RPC exposed';
 end if;
 if not has_table_privilege('anon','public.dbv_calendar_entries','SELECT') then
   raise exception 'Public calendar accidentally unavailable';
 end if;
end
$verify$;
commit;
