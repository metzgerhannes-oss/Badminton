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
