-- v97: official BWBV club directory, separate from verified season/team data.
create table if not exists public.league_clubs(
  id text primary key check (id ~ '^[0-9]{3,7}$'),
  name text not null check (length(name) between 2 and 180),
  region text not null,
  source_url text not null,
  checked_at timestamptz not null default now(),
  import_state text not null default 'not_imported'
     check (import_state in ('not_imported','imported','no_teams','needs_review'))
);
create index if not exists league_clubs_name_idx on public.league_clubs(name);
alter table public.league_clubs enable row level security;
revoke all on public.league_clubs from PUBLIC, anon, authenticated;
grant select on public.league_clubs to anon, authenticated;
create policy league_clubs_public_read on public.league_clubs for select to anon,authenticated using (true);

create or replace function private.sync_nuliga_club_directory()
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare
 reg record; body text; rsp extensions.http_response;
 entry text[]; parsed int; total int := 0; cn text;
begin
 for reg in
 select * from (values
 ('DE.SO.05.01','Bezirk Nordbaden','Bezirk+Nordbaden'),
 ('DE.SO.05.02','Bezirk Südbaden','Bezirk+S%C3%BCdbaden'),
 ('DE.SO.05.03','Bezirk Nordwürttemberg','Bezirk+Nordw%C3%BCrttemberg'),
 ('DE.SO.05.04','Bezirk Südwürttemberg','Bezirk+S%C3%BCdw%C3%BCrttemberg')
 ) as t(code,label,encoded)
 loop
  select * into rsp from extensions.http_get(
   ('https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubSearch?searchPattern='||reg.code||
   '&federation=BWBV&regionName='||reg.encoded||'&federations=BWBV')::varchar);
  body:=rsp.content;
  if rsp.status<>200 or length(body)>1000000 or
     body not like '%Vereinssuche%' or body not like '%Suchergebnis%' then
    raise exception 'BWBV club directory unavailable for % (HTTP %)',reg.label,rsp.status;
  end if;
  parsed:=0;
  for entry in
   select m from regexp_matches(body,
     '<a href="/cgi-bin/WebObjects/nuLigaBADDE[.]woa/wa/clubInfoDisplay[?]club=([0-9]{3,7})">([^<]{2,180})</a>','g') as m
  loop
    cn:=private.nuliga_clean(entry[2]);
    if length(cn)<2 then continue; end if;
    insert into public.league_clubs(id,name,region,source_url,checked_at)
    values(entry[1],cn,reg.label,
      'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club='||entry[1],now())
    on conflict(id) do update set
      name=excluded.name,region=excluded.region,source_url=excluded.source_url,checked_at=now();
    parsed:=parsed+1;
  end loop;
  if parsed<15 or parsed>190 then raise exception 'Unexpected % clubs in %',parsed,reg.label; end if;
  total:=total+parsed;
 end loop;
 return jsonb_build_object('verified_clubs',total,'regions',4,'checked_at',now());
end;$$;
revoke all on function private.sync_nuliga_club_directory() from PUBLIC,anon,authenticated;
