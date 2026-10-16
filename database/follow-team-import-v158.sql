-- v158: Shared, bounded, member-authorized club refresh requests.
-- Do not store follow lists, device identifiers or personal data in the queue.
create table if not exists private.team_import_demands (
 club_id text primary key references public.league_clubs(id),
 last_demand_at timestamptz not null default now(),
 last_attempt_at timestamptz,
 last_completed_at timestamptz
);
revoke all on private.team_import_demands from public, anon, authenticated;

create or replace function public.app_access_team_demand(p_team_follow_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_club text;
 v_last timestamptz;
begin
 if auth.uid() is null or not public.app_access_is_member() then
  raise exception 'not_authorized' using errcode='42501';
 end if;
 if p_team_follow_key is null or p_team_follow_key !~ '^nuliga:[0-9]{3,7}:[1-9][0-9]?$' then
  return jsonb_build_object('accepted',false,'reason','invalid_team');
 end if;
 select t.club_id into v_club from public.league_teams t
 where t.follow_key=p_team_follow_key and t.provider='nuliga' limit 1;
 if v_club is null or not exists(select 1 from public.league_clubs c
   where c.id=v_club and c.import_state='imported') then
  return jsonb_build_object('accepted',false,'reason','source_unavailable');
 end if;
 perform pg_catalog.pg_advisory_xact_lock(9273,386);
 select d.last_demand_at into v_last from private.team_import_demands d
 where d.club_id=v_club for update;
 if v_last >= now()-interval '24 hours' then
  return jsonb_build_object('accepted',true,'reused',true);
 end if;
 if (select count(*) from private.team_import_demands d
    where d.last_demand_at>=now()-interval '24 hours')>=20 then
  return jsonb_build_object('accepted',false,'reason','capacity');
 end if;
 insert into private.team_import_demands(club_id,last_demand_at)
 values(v_club,now()) on conflict(club_id) do update set last_demand_at=excluded.last_demand_at;
 return jsonb_build_object('accepted',true,'reused',false);
end;
$$;
revoke all on function public.app_access_team_demand(text) from public,anon;
grant execute on function public.app_access_team_demand(text) to authenticated;

-- Reuse the existing hourly cron, preserving its 4-club per-run free-plan cap.
-- A newly followed club takes priority once, with 6h retry spacing on failures.
create or replace function private.nuliga_refresh_batch(p_max integer default 4)
returns jsonb language plpgsql set search_path to 'pg_catalog'
as $$
declare x record; ok int:=0; failures int:=0;
begin
 if p_max<1 or p_max>4 then raise exception 'Batch size must be 1..4'; end if;
 for x in
  select c.id,
   exists(
    select 1 from private.team_import_demands d
    where d.club_id=c.id and d.last_demand_at>=now()-interval '14 days'
      and (d.last_completed_at is null or d.last_completed_at<d.last_demand_at)
      and (d.last_attempt_at is null or d.last_attempt_at<now()-interval '6 hours')
   ) as requested,
   min(t.source_checked_at) as oldest
  from public.league_clubs c
  join public.league_teams t on t.club_id=c.id and t.season='2026/27'
  where c.import_state='imported'
  group by c.id
  having min(t.source_checked_at)<now()-interval '24 hours'
    or exists(
     select 1 from private.team_import_demands d
     where d.club_id=c.id and d.last_demand_at>=now()-interval '14 days'
       and (d.last_completed_at is null or d.last_completed_at<d.last_demand_at)
       and (d.last_attempt_at is null or d.last_attempt_at<now()-interval '6 hours')
    )
  order by requested desc, oldest nulls first, c.id
  limit p_max
 loop
  begin
   update private.team_import_demands set last_attempt_at=now()
   where club_id=x.id and x.requested;
   perform private.sync_nuliga_club(x.id);
   update private.team_import_demands set last_completed_at=now() where club_id=x.id;
   ok:=ok+1;
  exception when others then
   -- Existing published snapshots remain untouched; retry after a bounded delay.
   failures:=failures+1;
  end;
 end loop;
 return jsonb_build_object('refreshed',ok,'failed',failures,'checked_at',now());
end;
$$;
revoke all on function private.nuliga_refresh_batch(integer) from public,anon,authenticated;
