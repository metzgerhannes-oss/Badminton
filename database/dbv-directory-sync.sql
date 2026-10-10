-- Reproducible server-side DBV directory sync (applied in Supabase project yadexibmjmnjfmfabrug).
-- Run only after the baseline public.players, public.clubs, and private schema exist.
-- The function fetches only fixed public GitHub JSON files. It has no dynamic URL parameter.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
alter table public.clubs add column if not exists dbv_club_id text;
create unique index if not exists clubs_dbv_club_id_uq on public.clubs(dbv_club_id) where dbv_club_id is not null;
alter table public.players add column if not exists age_class text;
alter table public.players add column if not exists association text;
alter table public.players add column if not exists last_ranking_week text;
create index if not exists players_age_class_club_idx on public.players(age_class,club,name);
create index if not exists players_association_age_idx on public.players(association,age_class);
update public.clubs set dbv_club_id='05-0148' where id='spvgg-moessingen';
CREATE OR REPLACE FUNCTION private.refresh_dbv_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  root_url constant text := 'https://raw.githubusercontent.com/metzgerhannes-oss/Badminton/main/data/player-library/';
  index_doc jsonb;
  one_doc jsonb;
  all_players jsonb := '[]'::jsonb;
  age text;
  expected_count integer;
  http_status integer;
  response_content text;
  snap_year integer;
  snap_week integer;
  snapshot_tag text;
  current_tag text;
  total_count integer;
  added_clubs integer := 0;
  touched_players integer := 0;
begin
  select h.status,h.content into http_status,response_content
    from extensions.http_get(root_url||'index.json') h;
  if http_status<>200 or length(response_content)>20000 then
    raise exception 'DBV index unavailable or too large: HTTP %',http_status;
  end if;
  index_doc:=response_content::jsonb;
  if (index_doc->>'schemaVersion')::integer<>1
    or index_doc->>'source'<>'https://turniere.badminton.de/ranking' then
    raise exception 'Unexpected DBV index provenance';
  end if;
  snap_year:=(index_doc->>'year')::integer;
  snap_week:=(index_doc->>'week')::integer;
  if snap_year<2026 or snap_week not between 1 and 53 then
    raise exception 'Invalid DBV ranking period';
  end if;
  snapshot_tag:=snap_year::text||'-KW'||lpad(snap_week::text,2,'0');
  select max(last_ranking_week) into current_tag from public.players;
  if current_tag is not null and current_tag>snapshot_tag then
    raise exception 'Refusing stale DBV snapshot %; database at %',snapshot_tag,current_tag;
  end if;
  foreach age in array array['U11','U13','U15','U17','U19','U22'] loop
    select (a->>'count')::integer into expected_count
      from jsonb_array_elements(index_doc->'ageGroups') as a
      where a->>'age'=age;
    if expected_count is null or expected_count<0 or expected_count>50000 then
      raise exception 'Missing or invalid DBV age metadata: %',age;
    end if;
    select h.status,h.content into http_status,response_content
      from extensions.http_get(root_url||age||'.json') h;
    if http_status<>200 or length(response_content)>12000000 then
      raise exception 'Invalid DBV age download %: HTTP %',age,http_status;
    end if;
    one_doc:=response_content::jsonb;
    if (one_doc->>'schemaVersion')::integer<>1 or one_doc->>'ageClass'<>age
      or jsonb_typeof(one_doc->'players')<>'array'
      or jsonb_array_length(one_doc->'players')<>expected_count then
      raise exception 'DBV age document mismatch for %',age;
    end if;
    all_players:=all_players||(one_doc->'players');
  end loop;
  total_count:=jsonb_array_length(all_players);
  if total_count<>(index_doc->>'total')::integer or total_count<2 then
    raise exception 'DBV directory total mismatch';
  end if;
  if (select count(distinct p.id)
      from jsonb_to_recordset(all_players) as p(id text))<>total_count then
    raise exception 'Duplicate DBV IDs in official archive';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(all_players) as p(
      id text,name text,"birthYear" integer,"ageClass" text,club text,
      "clubId" text,association text,"lastSeen" text)
    where p.id !~ '^[0-9]{2}-[0-9]{6}$'
      or length(trim(coalesce(p.name,'')))<3
      or p."birthYear" not between 1990 and 2100
      or p."ageClass" not in ('U11','U13','U15','U17','U19','U22')
      or p."lastSeen"<>snapshot_tag
      or (coalesce(p."clubId",'')<>'' and p."clubId" !~ '^[0-9]{2}-[0-9]{3,8}$')
      or ((coalesce(p."clubId",'')='') <> (coalesce(trim(p.club),'')=''))
  ) then raise exception 'Invalid DBV source row; transaction rolled back'; end if;

  with original as (
    select distinct on (p."clubId") p."clubId" as club_key,p.club,p.association
    from jsonb_to_recordset(all_players) as p("clubId" text,club text,association text)
    order by p."clubId",p.club
  )
  insert into public.clubs (id,name,short_name,association,source_url,dbv_club_id)
  select 'dbv-'||club_key,club,club,association,
       'https://turniere.badminton.de/ranking',club_key
  from original o where o.club_key<>'' and not exists
    (select 1 from public.clubs c where c.dbv_club_id=o.club_key)
  on conflict(name) do nothing;
  get diagnostics added_clubs=row_count;
  if (select count(distinct p."clubId")
      from jsonb_to_recordset(all_players) as p("clubId" text)
      where p."clubId"<>'')
     <> (select count(distinct p."clubId")
      from jsonb_to_recordset(all_players) as p("clubId" text)
      join public.clubs c on c.dbv_club_id=p."clubId") then
      raise exception 'Missing DBV club mapping, refusing partial import';
  end if;

  insert into public.players(dbv_id,name,club,club_id,birth_year,age_class,association,
       last_ranking_week,source_url,verified_at,updated_at)
  select p.id,p.name,p.club,c.id,p."birthYear",p."ageClass",p.association,
    p."lastSeen",'https://turniere.badminton.de/ranking',now(),now()
  from jsonb_to_recordset(all_players) as p(
      id text,name text,"birthYear" integer,"ageClass" text,club text,
      "clubId" text,association text,"lastSeen" text)
  left join public.clubs c on c.dbv_club_id=p."clubId"
  on conflict(dbv_id) do update set
    name=excluded.name,club=excluded.club,club_id=excluded.club_id,
    birth_year=excluded.birth_year,age_class=excluded.age_class,
    association=excluded.association,last_ranking_week=excluded.last_ranking_week,
    source_url=excluded.source_url,verified_at=excluded.verified_at,updated_at=now()
  where coalesce(public.players.last_ranking_week,'')<=excluded.last_ranking_week;
  get diagnostics touched_players=row_count;
  return jsonb_build_object('snapshot',snapshot_tag,'read',total_count,
    'players_upserted',touched_players,'clubs_inserted',added_clubs,'at',now());
end;
$function$;

revoke all on function private.refresh_dbv_directory() from public,anon,authenticated;
-- Cron jobs were provisioned separately and are active. Jobs do not require any GitHub secret.
-- Thursday 17:35 UTC and Friday 07:25 UTC:
select cron.schedule('badminton-dbv-directory-thursday','35 17 * * 4',
  'select private.refresh_dbv_directory()');
select cron.schedule('badminton-dbv-directory-friday','25 7 * * 5',
  'select private.refresh_dbv_directory()');
