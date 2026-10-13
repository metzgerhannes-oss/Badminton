-- Draft #195: bounded, opt-in DBV player identity lookup.
-- DO NOT deploy/activate until #56/#53 source rights, legal basis, contact,
-- correction/objection workflow and rate limits have been approved.
-- Does NOT restore anon SELECT on public.players and does NOT grant any private data.
begin;

create table if not exists private_content.dbv_name_search_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  approved_at timestamptz,
  decision_reference text
);
insert into private_content.dbv_name_search_policy(singleton,enabled)
values (true,false)
on conflict (singleton) do nothing;

alter table private_content.dbv_name_search_policy enable row level security;
revoke all on private_content.dbv_name_search_policy from public, anon, authenticated;

create or replace function public.search_dbv_name_v1(p_query text)
returns table(dbv_id text, name text, club text)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query,''));
begin
  -- The server, not the UI, controls activation; no table-publication side effect.
  if not exists (
    select 1 from private_content.dbv_name_search_policy gate
    where gate.singleton and gate.enabled and gate.approved_at is not null
  ) then
    raise exception 'DBV identity search not released' using errcode = 'P0001';
  end if;

  -- No dump/empty scans, joker search, special characters or long queries.
  -- A true global per-client request quota is a separate mandatory gate.
  if char_length(q) < 3 or char_length(q) > 70
     or q ~ '[%_]'
     or q !~ '^[[:alnum:] -]+ then
    return;
  end if;

  -- Restrict response to verified identity fields. No birth year, source URLs,
  -- rankings, matches or trophies. No OFFSET/pagination or query logs.
  return query
    select p.dbv_id, p.name, p.club
    from public.players p
    where p.dbv_id ~ '^([0-9]{2})-([0-9]{6})$'
      and nullif(btrim(p.name),'') is not null
      and (
        (q ~ '^[0-9]{2}-[0-9]{6}$' and p.dbv_id = q)
        or (q !~ '^[0-9]{2}-[0-9]{6}$' and p.name ilike ('%' || q || '%'))
      )
    order by lower(p.name),p.dbv_id
    limit 10;
end;
$$;

-- Requires a deliberate, separately reviewed post-gate GRANT.
-- The function is never callable by anonymous or authenticated browsers
-- merely because this migration exists.
revoke all on function public.search_dbv_name_v1(text) from public, anon, authenticated;
commit;
 then
    return;
  end if;

  -- Restrict response to verified identity fields. No birth year, source URLs,
  -- rankings, matches or trophies. No OFFSET/pagination or query logs.
  return query
    select p.dbv_id, p.name, p.club
    from public.players p
    where p.dbv_id ~ '^([0-9]{2})-([0-9]{6})$'
      and nullif(btrim(p.name),'') is not null
      and (
        (q ~ '^[0-9]{2}-[0-9]{6}$' and p.dbv_id = q)
        or (q !~ '^[0-9]{2}-[0-9]{6}$' and p.name ilike ('%' || q || '%'))
      )
    order by lower(p.name),p.dbv_id
    limit 10;
end;
$$;

-- Requires a deliberate, separately reviewed post-gate GRANT.
-- The function is never callable by anonymous or authenticated browsers
-- merely because this migration exists.
revoke all on function public.search_dbv_name_v1(text) from public, anon, authenticated;
commit;
