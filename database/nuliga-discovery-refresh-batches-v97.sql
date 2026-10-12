-- v97: scan a bounded number of official BWBV club pages per hour.
-- Each club has its own subtransaction; unknown SG aliases are never imported by guess.
-- No arbitrary URLs: IDs are looked up in official league_clubs.
create or replace function private.nuliga_discover_batch(p_max integer default 4)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare x record; ok int:=0; review int:=0; notplayed int:=0; result jsonb;
begin
 if p_max<1 or p_max>4 then raise exception 'Batch size must be 1..4';end if;
 for x in
  with c as (
   select id,region,row_number() over(partition by region order by name,id) as seq
   from public.league_clubs where import_state='not_imported'
  ) select id from c order by seq,region,id limit p_max
 loop
  begin
   result:=private.sync_nuliga_club(x.id);
   if result->>'state'='no_teams' then notplayed:=notplayed+1;
   else ok:=ok+1;end if;
  exception when others then
   -- Roll back this club's incomplete tables before marking review state.
   update public.league_clubs set import_state='needs_review' where id=x.id;
   review:=review+1;
  end;
 end loop;
 return jsonb_build_object('imported',ok,'no_active_teams',notplayed,'needs_review',review,'checked_at',now());
end;
$$;
revoke all on function private.nuliga_discover_batch(integer) from PUBLIC,anon,authenticated;

create or replace function private.nuliga_refresh_batch(p_max integer default 4)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare x record; ok int:=0; failures int:=0;
begin
 if p_max<1 or p_max>4 then raise exception 'Batch size must be 1..4';end if;
 for x in
   select c.id from public.league_clubs c
   join public.league_teams t on t.club_id=c.id and t.season='2026/27'
   where c.import_state='imported'
     and t.source_checked_at<now()-interval '24 hours'
   group by c.id order by min(t.source_checked_at),c.id limit p_max
 loop
   begin
     perform private.sync_nuliga_club(x.id);
     ok:=ok+1;
   exception when others then
     -- Preserve the last valid public snapshot; failures are retried next cycle.
     failures:=failures+1;
   end;
 end loop;
 return jsonb_build_object('refreshed',ok,'failed',failures,'checked_at',now());
end;
$$;
revoke all on function private.nuliga_refresh_batch(integer) from PUBLIC,anon,authenticated;

update public.league_clubs set import_state='imported'
where id in (select distinct club_id from public.league_teams where season='2026/27')
  and import_state='not_imported';

-- Four new clubs/hour, staggered; four stale season snapshots/hour.
select cron.schedule('badminton-nuliga-discover-v97','12 * * * *',
  $$select private.nuliga_discover_batch(4);$$);
select cron.schedule('badminton-nuliga-refresh-v97','43 * * * *',
  $$select private.nuliga_refresh_batch(4);$$);
