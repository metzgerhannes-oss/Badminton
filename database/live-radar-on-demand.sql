-- Public source-based LIVE RADAR. On-demand, server-side, bounded retention.
-- Does NOT create official match rows or scrape private nuLiga endpoints.
create table if not exists public.player_live_watches(
 dbv_id text primary key references public.players(dbv_id) on update cascade on delete cascade,
 first_requested_at timestamptz not null default now(),
 last_requested_at timestamptz not null default now(),
 check(dbv_id ~ '^[0-9]{2}-[0-9]{6}$')
);
create index if not exists player_live_watches_active_idx on public.player_live_watches(last_requested_at desc);

create table if not exists public.player_live_snapshots(
 dbv_id text primary key references public.players(dbv_id) on update cascade on delete cascade,
 provider text not null default 'Badhub' check(provider='Badhub'),
 source_url text not null,
 checked_at timestamptz,
 payload jsonb,
 last_error_at timestamptz,
 updated_at timestamptz not null default now(),
 check(source_url = 'https://badhub.de/spieler/'||dbv_id||'/live'),
 check(payload is null or jsonb_typeof(payload)='object')
);
alter table public.player_live_watches enable row level security;
alter table public.player_live_snapshots enable row level security;
revoke all on public.player_live_watches from public,anon,authenticated;
revoke all on public.player_live_snapshots from public,anon,authenticated;
grant insert(dbv_id) on public.player_live_watches to anon,authenticated;
grant select on public.player_live_snapshots to anon,authenticated;

drop policy if exists "Anyone may request watched public DBV player" on public.player_live_watches;
create policy "Anyone may request watched public DBV player" on public.player_live_watches
 for insert to anon,authenticated with check(
 dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
 and exists (select 1 from public.players p
   where p.dbv_id=player_live_watches.dbv_id and p.verified_at is not null)
);
drop policy if exists "Public verified live snapshot read" on public.player_live_snapshots;
create policy "Public verified live snapshot read" on public.player_live_snapshots
 for select to anon,authenticated using(true);

-- All callers use INSERT(dbv_id) only. The private trigger converts repeats
-- to bounded watch refresh, without granting client UPDATE rights.
create or replace function private.guard_live_watch()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare old_time timestamptz;
begin
 perform pg_advisory_xact_lock(9273,382);
 select last_requested_at into old_time
 from public.player_live_watches where dbv_id=new.dbv_id for update;
 if found then
   if old_time<now()-interval '50 seconds' then
     update public.player_live_watches set last_requested_at=now()
       where dbv_id=new.dbv_id;
   end if;
   return null;
 end if;
 if (select count(*) from public.player_live_watches
       where first_requested_at>=now()-interval '24 hours')>=60 then
   raise exception 'Tagesgrenze für neu beobachtete DBV-Spieler erreicht' using errcode='P0001';
 end if;
 if (select count(*) from public.player_live_watches
       where last_requested_at>=now()-interval '15 minutes')>=20 then
   raise exception 'Aktuell zu viele aktive Spielerbeobachtungen' using errcode='P0001';
 end if;
 return new;
end $$;
revoke all on function private.guard_live_watch() from public,anon,authenticated;
drop trigger if exists protect_live_watch on public.player_live_watches;
create trigger protect_live_watch before insert on public.player_live_watches
  for each row execute function private.guard_live_watch();

-- Poll a maximum of 6 active players per minute. One public JSON request per
-- eligible player per >=55 seconds. Import no personal follows or raw HTML.
create or replace function private.refresh_live_radar(batch_size integer default 6)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions,pg_temp as $$
declare watched record;
resp_status integer;
resp_body text;
doc jsonb;
curated jsonb;
cleaned jsonb;
n_success integer:=0;
n_errors integer:=0;
n_idle integer:=0;
n_processed integer:=0;
target_url text;
begin
 if batch_size<1 or batch_size>8 then raise exception 'Invalid live batch size';end if;
 for watched in
   select w.dbv_id from public.player_live_watches w
    left join public.player_live_snapshots s on s.dbv_id=w.dbv_id
   where w.last_requested_at>now()-interval '12 minutes'
     and (s.checked_at is null or s.checked_at<now()-interval '55 seconds')
   order by s.checked_at nulls first,w.last_requested_at desc
   limit batch_size
   for update of w skip locked
 loop
  n_processed:=n_processed+1;
  target_url:='https://badhub.de/spieler/'||watched.dbv_id||'/live';
  begin
    select h.status,h.content into resp_status,resp_body
     from extensions.http_get('https://badhub.de/api/spieler_live.php?lic='||watched.dbv_id) h;
    if resp_status<>200 or resp_body is null or octet_length(resp_body)>100000 then
      raise exception 'Unexpected public source response';
    end if;
    doc:=resp_body::jsonb;
    if jsonb_typeof(doc)<>'object'
      or not (doc ? 'tournament' and doc ? 'running' and doc ? 'upcoming')
      or jsonb_typeof(doc->'upcoming')<>'array'
      or jsonb_array_length(doc->'upcoming')>80
      or (doc ? 'past' and jsonb_typeof(doc->'past')<>'array')
      or (doc->'tournament' is not null and jsonb_typeof(doc->'tournament') not in ('null','object'))
      or (doc->'running' is not null and jsonb_typeof(doc->'running') not in ('null','object'))
    then raise exception 'Malformed live source JSON';end if;
    -- Keep only source-supported fields; cap arrays and total size.
    curated:=jsonb_build_object(
      'tournament',coalesce(doc->'tournament','null'::jsonb),
      'running',coalesce(doc->'running','null'::jsonb),
      'next',coalesce(doc->'next','null'::jsonb),
      'hero',coalesce(doc->'hero','null'::jsonb),
      'upcoming',coalesce((select jsonb_agg(x.value order by x.ordinality)
       from jsonb_array_elements(doc->'upcoming') with ordinality x(value,ordinality)
       where x.ordinality<=20),'[]'::jsonb),
      'past',coalesce((select jsonb_agg(x.value order by x.ordinality)
       from jsonb_array_elements(case when jsonb_typeof(doc->'past')='array' then doc->'past' else '[]'::jsonb end) with ordinality x(value,ordinality)
       where x.ordinality<=12),'[]'::jsonb),
      'entries',coalesce((select jsonb_agg(x.value order by x.ordinality)
       from jsonb_array_elements(case when jsonb_typeof(doc->'entries')='array' then doc->'entries' else '[]'::jsonb end) with ordinality x(value,ordinality)
       where x.ordinality<=15),'[]'::jsonb)
    );
    if octet_length(curated::text)>70000 then raise exception 'Live snapshot oversized';end if;
    insert into public.player_live_snapshots(dbv_id,provider,source_url,checked_at,payload,last_error_at,updated_at)
    values(watched.dbv_id,'Badhub',target_url,now(),curated,null,now())
    on conflict(dbv_id) do update set
      provider='Badhub',source_url=excluded.source_url,checked_at=excluded.checked_at,
      payload=excluded.payload,last_error_at=null,updated_at=now();
    n_success:=n_success+1;
    if curated->'tournament'='null'::jsonb then n_idle:=n_idle+1;end if;
  exception when others then
    insert into public.player_live_snapshots(dbv_id,provider,source_url,last_error_at,updated_at)
     values(watched.dbv_id,'Badhub',target_url,now(),now())
    on conflict(dbv_id) do update set last_error_at=now(),updated_at=now();
    n_errors:=n_errors+1;
  end;
 end loop;
 return jsonb_build_object('processed',n_processed,'ok',n_success,'idle',n_idle,'errors',n_errors,'at',now());
end $$;
revoke all on function private.refresh_live_radar(integer) from public,anon,authenticated;
select cron.schedule('badminton-live-radar','* * * * *',
 'select private.refresh_live_radar(6);');
