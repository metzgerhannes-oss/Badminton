-- Source-labelled individual match facts for followed players.
-- These are NOT official DBV match rows, since Badhub tournament cards do not
-- consistently provide individual provider match IDs. They never populate
-- public.matches or the official match statistics view.
create table if not exists public.player_external_match_facts(
 dbv_id text not null references public.players(dbv_id) on delete cascade,
 source_key text not null,
 source_name text not null default 'Badhub' check(source_name='Badhub'),
 source_kind text not null default 'third-party-match-card'
  check(source_kind='third-party-match-card'),
 category text not null check(category in ('league','tournament')),
 competition text not null,
 competition_id text not null,
 event text not null,
 discipline text not null check(discipline in ('Einzel','Doppel','Mixed')),
 round_label text,
 match_date date,
 match_year integer not null check(match_year between 2000 and 2100),
 player_side smallint not null check(player_side in (1,2)),
 winning_side smallint not null check(winning_side in (1,2)),
 opponent_names text[] not null,
 partner_names text[] not null default '{}',
 games jsonb not null check(jsonb_typeof(games)='array'),
 source_url text not null check(source_url ~ '^https://badhub[.]de/(bwbv/(turnier|begegnung)|dbv/turnier)[.]php[?]id=[0-9]+,
 observed_at timestamptz not null default now(),
 primary key(dbv_id,source_key),
 check(length(source_key) between 20 and 460),
 check(array_length(opponent_names,1) between 1 and 2)
);
create index if not exists player_external_facts_by_year
 on public.player_external_match_facts(dbv_id,match_year desc,category,discipline);
alter table public.player_external_match_facts enable row level security;
revoke all on public.player_external_match_facts from public,anon,authenticated;
grant select on public.player_external_match_facts to anon,authenticated;
drop policy if exists "Read sourced individual external matches" on public.player_external_match_facts;
create policy "Read sourced individual external matches" on public.player_external_match_facts
 for select to anon,authenticated using(true);

create table if not exists public.player_external_match_imports(
 dbv_id text primary key references public.players(dbv_id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','loading','partial','complete','error','awaiting_source')),
 last_started_at timestamptz,
 last_finished_at timestamptz,
 lease_until timestamptz,
 cursor_offset integer not null default 0 check(cursor_offset>=0),
 source_count integer not null default 0 check(source_count>=0),
 verified_count integer not null default 0 check(verified_count>=0),
 rejected_count integer not null default 0 check(rejected_count>=0),
 detail text not null default 'Quellenimport vorgemerkt',
 updated_at timestamptz not null default now()
);
alter table public.player_external_match_imports enable row level security;
revoke all on public.player_external_match_imports from public,anon,authenticated;
grant select on public.player_external_match_imports to anon,authenticated;
drop policy if exists "Read verified external history import progress" on public.player_external_match_imports;
create policy "Read verified external history import progress" on public.player_external_match_imports
 for select to anon,authenticated using(true);

-- A hard global cap includes repeat batches for the same profile.
create table if not exists private.external_match_attempts(
 dbv_id text not null,
 attempted_at timestamptz not null default now()
);
create index if not exists external_match_attempts_recent_idx
 on private.external_match_attempts(attempted_at desc);
revoke all on private.external_match_attempts from public,anon,authenticated;

-- Only the server-side service role can claim work; anon has no function
-- EXECUTE grant and cannot edit either table. Strict atomic rate limiting.
create or replace function public.claim_external_match_import(target_id text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
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
end $$;
revoke all on function public.claim_external_match_import(text) from public,anon,authenticated;
grant execute on function public.claim_external_match_import(text) to service_role;
comment on function public.claim_external_match_import(text) is
'Private server-side throttle: one import per verified followed DBV ID and max 24 distinct users per day.';

-- This project's public tables use explicit revokes. Grant the internal
-- service-role REST consumer only what the Edge importer needs.
grant select(dbv_id,name) on public.players to service_role;
grant select,insert,update on public.player_external_match_facts to service_role;
grant select,insert,update on public.player_external_match_imports to service_role;
),
 observed_at timestamptz not null default now(),
 primary key(dbv_id,source_key),
 check(length(source_key) between 20 and 460),
 check(array_length(opponent_names,1) between 1 and 2)
);
create index if not exists player_external_facts_by_year
 on public.player_external_match_facts(dbv_id,match_year desc,category,discipline);
alter table public.player_external_match_facts enable row level security;
revoke all on public.player_external_match_facts from public,anon,authenticated;
grant select on public.player_external_match_facts to anon,authenticated;
drop policy if exists "Read sourced individual external matches" on public.player_external_match_facts;
create policy "Read sourced individual external matches" on public.player_external_match_facts
 for select to anon,authenticated using(true);

create table if not exists public.player_external_match_imports(
 dbv_id text primary key references public.players(dbv_id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','loading','partial','complete','error','awaiting_source')),
 last_started_at timestamptz,
 last_finished_at timestamptz,
 lease_until timestamptz,
 cursor_offset integer not null default 0 check(cursor_offset>=0),
 source_count integer not null default 0 check(source_count>=0),
 verified_count integer not null default 0 check(verified_count>=0),
 rejected_count integer not null default 0 check(rejected_count>=0),
 detail text not null default 'Quellenimport vorgemerkt',
 updated_at timestamptz not null default now()
);
alter table public.player_external_match_imports enable row level security;
revoke all on public.player_external_match_imports from public,anon,authenticated;
grant select on public.player_external_match_imports to anon,authenticated;
drop policy if exists "Read verified external history import progress" on public.player_external_match_imports;
create policy "Read verified external history import progress" on public.player_external_match_imports
 for select to anon,authenticated using(true);

-- A hard global cap includes repeat batches for the same profile.
create table if not exists private.external_match_attempts(
 dbv_id text not null,
 attempted_at timestamptz not null default now()
);
create index if not exists external_match_attempts_recent_idx
 on private.external_match_attempts(attempted_at desc);
revoke all on private.external_match_attempts from public,anon,authenticated;

-- Only the server-side service role can claim work; anon has no function
-- EXECUTE grant and cannot edit either table. Strict atomic rate limiting.
create or replace function public.claim_external_match_import(target_id text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
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
end $$;
revoke all on function public.claim_external_match_import(text) from public,anon,authenticated;
grant execute on function public.claim_external_match_import(text) to service_role;
comment on function public.claim_external_match_import(text) is
'Private server-side throttle: one import per verified followed DBV ID and max 24 distinct users per day.';

-- This project's public tables use explicit revokes. Grant the internal
-- service-role REST consumer only what the Edge importer needs.
grant select(dbv_id,name) on public.players to service_role;
grant select,insert,update on public.player_external_match_facts to service_role;
grant select,insert,update on public.player_external_match_imports to service_role;
