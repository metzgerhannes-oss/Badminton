-- Demand-driven, PUBLIC PLAYER-ID keyed import queue.
-- Users may request only known verified DBV IDs; neither personal follows nor
-- browser identities are stored in Supabase. The only available automatic source
-- is a manually source-verified historical aggregate archive, NOT official match rows.
create table if not exists public.player_history_imports (
  dbv_id text primary key references public.players(dbv_id) on update cascade on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','checking','partial','awaiting_source','error')),
  requested_at timestamptz not null default now(),
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  source_name text,
  detail text not null default 'Importauftrag erstellt',
  imported_match_count integer not null default 0 check (imported_match_count>=0),
  check (dbv_id ~ '^[0-9]{2}-[0-9]{6}$')
);
create index if not exists player_history_imports_pending_idx
  on public.player_history_imports(status,last_checked_at,requested_at);

create table if not exists public.player_history_overviews (
  dbv_id text primary key references public.players(dbv_id) on update cascade on delete cascade,
  source_name text not null check (source_name='Badhub'),
  source_url text not null,
  source_kind text not null check (source_kind='third-party-aggregated'),
  source_snapshot_url text not null,
  source_checked_on date not null,
  summary jsonb not null,
  imported_at timestamptz not null default now(),
  check (source_url ~ '^https://badhub[.]de/spieler/[0-9]{2}-[0-9]{6}[?]'),
  check (source_snapshot_url ~ '^https://raw[.]githubusercontent[.]com/metzgerhannes-oss/Badminton/main/data/player-history/')
);

alter table public.player_history_imports enable row level security;
alter table public.player_history_overviews enable row level security;
revoke all on public.player_history_imports from public,anon,authenticated;
revoke all on public.player_history_overviews from public,anon,authenticated;
grant select on public.player_history_imports to anon,authenticated;
grant insert(dbv_id) on public.player_history_imports to anon,authenticated;
grant select on public.player_history_overviews to anon,authenticated;

drop policy if exists "Anyone can read DBV import statuses" on public.player_history_imports;
create policy "Anyone can read DBV import statuses" on public.player_history_imports
  for select to anon,authenticated using (true);
drop policy if exists "Request import for verified DBV player only" on public.player_history_imports;
create policy "Request import for verified DBV player only" on public.player_history_imports
  for insert to anon,authenticated with check (
    dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
    and status='queued' and requested_at is not null
    and exists (select 1 from public.players p where p.dbv_id=dbv_id and p.verified_at is not null)
  );
drop policy if exists "Anyone can read verified external overviews" on public.player_history_overviews;
create policy "Anyone can read verified external overviews" on public.player_history_overviews
  for select to anon,authenticated using (true);

-- Trigger lives in an unexposed schema, and limits any anonymous mass requests
-- globally to 60 new DBV IDs in a rolling day. Existing IDs are idempotent.
create or replace function private.guard_history_import_insert()
returns trigger language plpgsql security definer
set search_path = pg_catalog,public,pg_temp
as $$
begin
  perform pg_advisory_xact_lock(9273,381);
  if exists (select 1 from public.player_history_imports i where i.dbv_id=new.dbv_id)
     then return null; end if;
  if (select count(*) from public.player_history_imports i
      where i.requested_at >= now() - interval '24 hours') >=60 then
    raise exception 'Tageslimit für neue historische Importaufträge erreicht'
      using errcode='P0001';
  end if;
  return new;
end
$$;
revoke all on function private.guard_history_import_insert() from public,anon,authenticated;
drop trigger if exists protect_history_import_queue on public.player_history_imports;
create trigger protect_history_import_queue
  before insert on public.player_history_imports
  for each row execute function private.guard_history_import_insert();

-- Runs server side using the same documented outbound HTTP extension
-- as the existing weekly DBV-player import.
create or replace function private.process_player_history_imports(batch_size integer default 5)
returns jsonb language plpgsql security definer
set search_path = pg_catalog,public,extensions,pg_temp
as $$
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
    where status='queued'
       or (status='error' and last_checked_at<now()-interval '1 hour')
       or (status in ('partial','awaiting_source') and last_checked_at<now()-interval '7 days')
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
end $$;
revoke all on function private.process_player_history_imports(integer) from public,anon,authenticated;

-- Worker is capped at 5 IDs / 15 minutes and refreshes existing external
-- summaries no more than once per seven days. No service role key in frontend.
select cron.schedule('badminton-history-demand-worker','*/15 * * * *',
  'select private.process_player_history_imports(5);');
