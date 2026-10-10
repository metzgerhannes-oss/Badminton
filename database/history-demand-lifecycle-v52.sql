-- v52: periodic history refresh only for recently requested, verified DBV IDs.
-- Badminton project yadexibmjmnjfmfabrug ONLY. No match evidence is deleted.
alter table public.player_history_imports add column if not exists last_demand_at timestamptz;
update public.player_history_imports set last_demand_at=requested_at where last_demand_at is null;
alter table public.player_history_imports alter column last_demand_at set default now();
alter table public.player_history_imports alter column last_demand_at set not null;
create index if not exists history_import_recent_demand_idx on public.player_history_imports(last_demand_at desc);
revoke select on public.player_history_imports from anon,authenticated;
grant select(dbv_id,status,requested_at,last_checked_at,updated_at,source_name,detail,imported_match_count)
 on public.player_history_imports to anon,authenticated;
-- Isolate privileged writes in a non-Data-API schema. The exposed RPC is
-- SECURITY INVOKER; only its restricted internal function performs the updates.
create schema if not exists demand_internal;
revoke all on schema demand_internal from public,anon,authenticated;
grant usage on schema demand_internal to anon,authenticated;
create or replace function demand_internal.request_player_history_demand(target_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp
as $$
declare prior timestamptz;
begin
 if target_id is null or target_id !~ '^[0-9]{2}-[0-9]{6}$' then
  return jsonb_build_object('accepted',false,'reason','invalid_id');
 end if;
 if not exists(select 1 from public.players p where p.dbv_id=target_id and p.verified_at is not null) then
  return jsonb_build_object('accepted',false,'reason','unverified');
 end if;
 perform pg_advisory_xact_lock(9273,381);
 select last_demand_at into prior from public.player_history_imports where dbv_id=target_id for update;
 if prior >= now()-interval '24 hours' then
  return jsonb_build_object('accepted',true,'reused',true);
 end if;
 if (select count(*) from public.player_history_imports where last_demand_at >= now()-interval '24 hours')>=60 then
  return jsonb_build_object('accepted',false,'reason','capacity');
 end if;
 if prior is null then
  insert into public.player_history_imports(dbv_id,last_demand_at)
    values(target_id,now()) on conflict(dbv_id) do nothing;
 else
  update public.player_history_imports set last_demand_at=now() where dbv_id=target_id;
 end if;
 return jsonb_build_object('accepted',true,'reused',false);
exception when sqlstate 'P0001' then
 return jsonb_build_object('accepted',false,'reason','capacity');
end $$;
revoke all on function demand_internal.request_player_history_demand(text) from public,anon,authenticated;
grant execute on function demand_internal.request_player_history_demand(text) to anon,authenticated;
create or replace function public.request_player_history_demand(target_id text)
returns jsonb language sql security invoker
set search_path=pg_catalog,public,pg_temp
as $ select demand_internal.request_player_history_demand(target_id) $;
revoke all on function public.request_player_history_demand(text) from public,anon,authenticated;
grant execute on function public.request_player_history_demand(text) to anon,authenticated;
comment on function public.request_player_history_demand(text) is
'Verified public DBV ID only, one touch per ID per 24h, max 60 new active IDs per 24h.';
-- Except for two recent-demand filters, the worker is unchanged from v51.
CREATE OR REPLACE FUNCTION private.process_player_history_imports(batch_size integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  listing jsonb;
  record public.player_history_imports%rowtype;
  entry jsonb;
  doc jsonb;
  http_status integer;
  response_content text;
  file_url text;
  count_processed integer :=0;
  count_partial integer :=0;
  count_missing integer :=0;
  matches_count integer;
begin
  if batch_size<1 or batch_size>8 then raise exception 'Invalid batch size'; end if;
  -- No scheduled source download when no public player has an eligible request.
  -- Keep these eligibility conditions identical to the bounded FOR UPDATE queue below.
  if not exists (
    select 1 from public.player_history_imports
    where last_demand_at >= now()-interval '14 days'
      and (status='queued'
       or (status='error' and last_checked_at<now()-interval '1 hour')
       or (status in ('partial','awaiting_source') and last_checked_at<now()-interval '7 days'))
  ) then
    return jsonb_build_object('processed',0,'external_overviews',0,
            'awaiting_source',0,'at',now());
  end if;
  select h.status,h.content into http_status,response_content
   from extensions.http_get(
     'https://raw.githubusercontent.com/metzgerhannes-oss/Badminton/main/data/player-history/index.json'
   ) h;
  if http_status<>200 or length(response_content)>40000 then
    raise exception 'Trusted history source catalog unavailable, status %',http_status;
  end if;
  listing:=response_content::jsonb;
  if (listing->>'schemaVersion')::integer<>1 or jsonb_typeof(listing->'profiles')<>'array'
     or jsonb_array_length(listing->'profiles')>10000 then
    raise exception 'Invalid historical source catalog';
  end if;

  for record in
    select * from public.player_history_imports
    where last_demand_at >= now()-interval '14 days'
      and (status='queued'
       or (status='error' and last_checked_at<now()-interval '1 hour')
       or (status in ('partial','awaiting_source') and last_checked_at<now()-interval '7 days'))
    order by case when status='queued' then 0 else 1 end,requested_at
    limit batch_size for update skip locked
  loop
    count_processed:=count_processed+1;
    update public.player_history_imports
      set status='checking',updated_at=now(),
          detail='Öffentliche Ergebnisquellen werden geprüft'
      where dbv_id=record.dbv_id;
    begin
      select x into entry from jsonb_array_elements(listing->'profiles') x
        where x->>'dbvId'=record.dbv_id and x->>'path'=record.dbv_id||'.json'
        limit 1;
      if entry is null then
        update public.player_history_imports
          set status='awaiting_source',last_checked_at=now(),updated_at=now(),
              detail='Noch kein zulässiger, strukturierter Match-Quellenimport für diese DBV-ID verfügbar',
              source_name=null,imported_match_count=(
                select count(*) from public.match_participants mp
                 join public.players p on p.id=mp.player_id
                 join public.matches m on m.id=mp.match_id
                 where p.dbv_id=record.dbv_id and m.status='finished'
              )
          where dbv_id=record.dbv_id;
        count_missing:=count_missing+1;
      else
        file_url:='https://raw.githubusercontent.com/metzgerhannes-oss/Badminton/main/data/player-history/'||record.dbv_id||'.json';
        select h.status,h.content into http_status,response_content
          from extensions.http_get(file_url) h;
        if http_status<>200 or length(response_content)>240000 then
          raise exception 'Historical snapshot not available: HTTP %',http_status;
        end if;
        doc:=response_content::jsonb;
        if (doc->>'dbvId')<>record.dbv_id
          or (doc->>'schemaVersion')::integer<>1
          or doc->>'sourceStatus'<>'third-party-aggregated'
          or doc#>>'{source,name}'<>'Badhub'
          or doc#>>'{source,url}'<>'https://badhub.de/spieler/'||record.dbv_id||'?saison=all&src=gesamt'
          or jsonb_typeof(doc->'years')<>'array' or jsonb_array_length(doc->'years')<1
          or (doc#>>'{totals,matches}')::integer <>
                (doc#>>'{totals,wins}')::integer+(doc#>>'{totals,losses}')::integer
          or (doc#>>'{totals,matches}')::integer <>
                (doc#>>'{totals,tournament,matches}')::integer+
                (doc#>>'{totals,league,matches}')::integer
          or (doc#>>'{totals,wins}')::integer <>
                (doc#>>'{totals,tournament,wins}')::integer+
                (doc#>>'{totals,league,wins}')::integer
          or (doc->>'retrievedOn')::date > current_date
        then raise exception 'Unverified or invalid sourced player overview'; end if;
        insert into public.player_history_overviews
          (dbv_id,source_name,source_url,source_kind,source_snapshot_url,source_checked_on,summary,imported_at)
        values (record.dbv_id,'Badhub',doc#>>'{source,url}','third-party-aggregated',
                file_url,(doc->>'retrievedOn')::date,doc,now())
        on conflict(dbv_id) do update set
          source_url=excluded.source_url,source_snapshot_url=excluded.source_snapshot_url,
          source_checked_on=excluded.source_checked_on,summary=excluded.summary,imported_at=now();
        select count(distinct m.id) into matches_count
          from public.match_participants mp
          join public.players p on p.id=mp.player_id
          join public.matches m on m.id=mp.match_id
          where p.dbv_id=record.dbv_id and m.status='finished';
        update public.player_history_imports
          set status='partial',source_name='Badhub',last_checked_at=now(),updated_at=now(),
              imported_match_count=matches_count,
              detail='Externe Karriereübersicht übernommen; einzelne DBV-Matches noch nicht verfügbar'
          where dbv_id=record.dbv_id;
        count_partial:=count_partial+1;
      end if;
    exception when others then
      update public.player_history_imports
        set status='error',last_checked_at=now(),updated_at=now(),
            detail='Quellenprüfung fehlgeschlagen; erneuter Versuch geplant'
        where dbv_id=record.dbv_id;
    end;
    entry:=null;
  end loop;
  return jsonb_build_object('processed',count_processed,'external_overviews',count_partial,
         'awaiting_source',count_missing,'at',now());
end $function$;

-- Independent 30-minute external match batch runner is also bounded by recent demand.
CREATE OR REPLACE FUNCTION private.continue_external_match_import()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
declare chosen text; h record; response_status integer; response_text text;
begin
 select j.dbv_id into chosen
 from public.player_history_imports j
 join public.players p on p.dbv_id=j.dbv_id and p.verified_at is not null
 left join public.player_external_match_imports e on e.dbv_id=j.dbv_id
 where j.last_demand_at >= now()-interval '14 days'
   and (e.dbv_id is null
   or (e.status='partial' and e.cursor_offset<e.verified_count
       and e.last_started_at<now()-interval '15 minutes')
   or (e.status in ('partial','complete') and e.cursor_offset>=e.verified_count
       and e.last_started_at<now()-interval '7 days')
   or (e.status='awaiting_source' and e.last_started_at<now()-interval '7 days')
   or (e.status='loading' and e.lease_until<now()-interval '10 minutes')
   or (e.status='error' and e.last_started_at<now()-interval '1 day'))
 order by coalesce(e.last_started_at,'2000-01-01'::timestamptz),j.requested_at
 limit 1;
 if chosen is null then return jsonb_build_object('processed',0,'reason','no_pending_job');end if;
 begin
  select x.status,x.content into response_status,response_text
   from extensions.http_post(
    'https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/history-match-import',
    jsonb_build_object('dbv_id',chosen,
      'public_key','sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE')::text,
    'application/json'
   ) x;
  return jsonb_build_object('processed',1,'dbv_id',chosen,'status',response_status,
                           'body',left(response_text,320));
 exception when others then
  return jsonb_build_object('processed',1,'dbv_id',chosen,
                           'error','Temporary worker HTTP error');
 end;
end $function$;
CREATE OR REPLACE FUNCTION public.claim_external_match_import(target_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
 status_now text;
 last_start timestamptz;
 cursor_now integer;
 verified_count_now integer;
 verified boolean;
begin
 if target_id !~ '^[0-9]{2}-[0-9]{6}$' then
   return jsonb_build_object('accepted',false,'reason','invalid_id');
 end if;
 perform pg_advisory_xact_lock(9273,383);
 select exists(
  select 1 from public.player_history_imports h
  join public.players p on p.dbv_id=h.dbv_id and p.verified_at is not null
  where h.dbv_id=target_id
    and h.last_demand_at >= now()-interval '14 days'
 ) into verified;
 if not verified then return jsonb_build_object('accepted',false,'reason','not_followed');end if;
 insert into public.player_external_match_imports(dbv_id)
  values(target_id) on conflict(dbv_id) do nothing;
 select status,last_started_at,cursor_offset,verified_count
  into status_now,last_start,cursor_now,verified_count_now
  from public.player_external_match_imports
  where dbv_id=target_id for update;
 -- Partial with all source cards already scanned (but excluded cards) is
 -- complete for now too. Never restart its first page every ten minutes.
 if status_now in ('complete','partial') and cursor_now>=verified_count_now
    and last_start>now()-interval '7 days' then
  return jsonb_build_object('accepted',false,'reason','recently_complete');
 end if;
 if status_now='loading' and (select lease_until>now() from public.player_external_match_imports where dbv_id=target_id) then
  return jsonb_build_object('accepted',false,'reason','already_loading');
 end if;
 if last_start>now()-interval '10 minutes' then
  return jsonb_build_object('accepted',false,'reason','cooldown');
 end if;
 if (select count(*) from public.player_external_match_imports
    where last_started_at>now()-interval '24 hours')>=24
    and (last_start is null or last_start<now()-interval '24 hours') then
   return jsonb_build_object('accepted',false,'reason','daily_limit');
 end if;
 if (select count(*) from private.external_match_attempts where attempted_at>=now()-interval '24 hours')>=36 then
   return jsonb_build_object('accepted',false,'reason','global_cooldown');
 end if;
 insert into private.external_match_attempts(dbv_id) values(target_id);
 -- The provider lists newest matches first; a weekly refresh must start
 -- from index zero or it will miss newly inserted matches at the top.
 if status_now in ('complete','partial') and cursor_now>=verified_count_now then
   cursor_now:=0;
 end if;
 update public.player_external_match_imports set
  status='loading',last_started_at=now(),lease_until=now()+interval '3 minutes',
  cursor_offset=cursor_now,updated_at=now(),
  detail='Öffentliche Matchkarten werden abgeglichen'
 where dbv_id=target_id;
 return jsonb_build_object('accepted',true,'cursor',cursor_now,'player_id',target_id);
end $function$;
