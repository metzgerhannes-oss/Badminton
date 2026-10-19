-- Fix the broken 2026-10 live feed without making source snapshots public.
-- Original watch+snapshot endpoints were called with only the publishable key,
-- while both tables had no user grants and the snapshot table had no read RLS.
-- Use ONLY authenticated, non-revoked invited app members for public Badhub
-- player snapshots.  Existing private provider cron and limits stay unchanged.
begin;
revoke all on public.player_live_snapshots from public,anon,authenticated;
revoke all on public.player_live_watches from public,anon,authenticated;
grant select(dbv_id,provider,source_url,checked_at,payload,last_error_at)
  on public.player_live_snapshots to authenticated;
grant insert(dbv_id) on public.player_live_watches to authenticated;
-- authenticated has no SELECT on public.players: a small DEFINER predicate
-- checks a verified DBV ID without granting the underlying directory access.
create or replace function public.app_access_is_verified_live_player(p_dbv_id text)
 returns boolean language sql stable security definer set search_path to '' as $
 select p_dbv_id ~ '^[0-9]{2}-[0-9]{6}
alter table public.player_live_watches enable row level security;
drop policy if exists "Public verified live snapshot read" on public.player_live_snapshots;
drop policy if exists "App members read source-backed live snapshots" on public.player_live_snapshots;
create policy "App members read source-backed live snapshots"
 on public.player_live_snapshots for select to authenticated
 using ((select public.app_access_is_member()));
drop policy if exists "Anyone may request watched public DBV player" on public.player_live_watches;
drop policy if exists "App members request verified watched player" on public.player_live_watches;
create policy "App members request verified watched player"
 on public.player_live_watches for insert to authenticated
 with check(
  (select public.app_access_is_member())
  and dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
  and (select public.app_access_is_verified_live_player(player_live_watches.dbv_id))
 );
-- No privileges to write the snapshot cache, read watch IDs or change the job.
commit;

  and exists(select 1 from public.players p
    where p.dbv_id=p_dbv_id and p.verified_at is not null);
 $;
revoke all on function public.app_access_is_verified_live_player(text)
 from public,anon,authenticated;
grant execute on function public.app_access_is_verified_live_player(text)
 to authenticated;
alter table public.player_live_snapshots enable row level security;
alter table public.player_live_watches enable row level security;
drop policy if exists "Public verified live snapshot read" on public.player_live_snapshots;
drop policy if exists "App members read source-backed live snapshots" on public.player_live_snapshots;
create policy "App members read source-backed live snapshots"
 on public.player_live_snapshots for select to authenticated
 using ((select public.app_access_is_member()));
drop policy if exists "Anyone may request watched public DBV player" on public.player_live_watches;
drop policy if exists "App members request verified watched player" on public.player_live_watches;
create policy "App members request verified watched player"
 on public.player_live_watches for insert to authenticated
 with check(
  (select public.app_access_is_member())
  and dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
  and exists(select 1 from public.players p
     where p.dbv_id=player_live_watches.dbv_id and p.verified_at is not null)
 );
-- No privileges to write the snapshot cache, read watch IDs or change the job.
commit;
