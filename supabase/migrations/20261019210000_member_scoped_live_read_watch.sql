-- Member-scoped Badhub snapshot/read + bounded watch registration.
-- A public-key-only user cannot inspect snapshots or schedule Badhub work.
-- Existing cron, service role writes and DBV verification remain unchanged.
begin;
revoke all on table public.player_live_snapshots from public, anon, authenticated;
revoke all on table public.player_live_watches from public, anon, authenticated;
grant select (dbv_id, provider, source_url, checked_at, payload, last_error_at)
 on table public.player_live_snapshots to authenticated;
grant insert (dbv_id) on table public.player_live_watches to authenticated;

-- Checking public.players requires a definer: ordinary members have no
-- SELECT rights on the underlying players table. Do not grant those rights.
-- Membership is checked here too so a direct RPC call cannot enumerate
-- whether an arbitrary DBV identifier belongs to a verified player.
create or replace function public.app_access_is_verified_live_player(p_dbv_id text)
 returns boolean
 language sql stable security definer
 set search_path = ''
 as $member_check$
  select public.app_access_is_member()
   and p_dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
   and exists (
    select 1 from public.players p
    where p.dbv_id = p_dbv_id and p.verified_at is not null
   );
 $member_check$;
revoke all on function public.app_access_is_verified_live_player(text)
 from public, anon, authenticated;
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
 with check (
  (select public.app_access_is_member())
  and dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
  and public.app_access_is_verified_live_player(dbv_id)
 );
-- Existing private trigger still caps per-player watches to at most
-- once every 50 seconds and limits provider work per minute.
-- No new cron job and no access to read or update watch table contents.
commit;
