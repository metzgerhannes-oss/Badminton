-- v136: invited app members may read sourced match facts and top-four placements.
-- Deliberately NOT public/anon; profile management remains separate.
-- Invitation secret is never stored in cleartext server-side.
create table if not exists private_content.app_access_invites (
  id uuid primary key default gen_random_uuid(),
  secret_digest bytea not null unique,
  issuer uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  redeem_until timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  constraint app_access_invites_digest_size check (octet_length(secret_digest)=32)
);
create table if not exists private_content.app_access_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invitation_id uuid not null references private_content.app_access_invites(id),
  accepted_at timestamptz not null default now()
);
create index if not exists app_access_members_invitation_idx
  on private_content.app_access_members (invitation_id);
alter table private_content.app_access_invites enable row level security;
alter table private_content.app_access_members enable row level security;
revoke all on private_content.app_access_invites from public,anon,authenticated;
revoke all on private_content.app_access_members from public,anon,authenticated;

create or replace function public.app_access_is_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and
    (
      exists (
        select 1 from private_content.site_owners o
        where o.user_id=auth.uid() and o.revoked_at is null
      )
      or exists (
        select 1 from private_content.app_access_members m
        join private_content.app_access_invites i on i.id=m.invitation_id
        where m.user_id=auth.uid() and i.revoked_at is null
      )
    );
$$;
revoke all on function public.app_access_is_member() from public,anon,authenticated;
grant execute on function public.app_access_is_member() to authenticated;

create or replace function public.app_access_status()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'allowed', public.app_access_is_member(),
    'owner', exists (
      select 1 from private_content.site_owners o
      where o.user_id=auth.uid() and o.revoked_at is null
    )
  );
$$;
revoke all on function public.app_access_status() from public,anon,authenticated;
grant execute on function public.app_access_status() to authenticated;

create or replace function public.app_access_invite_issue(p_secret text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare new_id uuid;
begin
 if auth.uid() is null or not exists (
   select 1 from private_content.site_owners o
   where o.user_id=auth.uid() and o.revoked_at is null
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 then raise exception 'invalid_invitation' using errcode='22023'; end if;
 insert into private_content.app_access_invites(secret_digest,issuer)
 values (extensions.digest(decode(p_secret,'hex'),'sha256'),auth.uid())
 returning id into new_id;
 return new_id;
end;
$$;
revoke all on function public.app_access_invite_issue(text) from public,anon,authenticated;
grant execute on function public.app_access_invite_issue(text) to authenticated;

create or replace function public.app_access_invite_accept(p_secret text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare active_id uuid;
begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then return false; end if;
 select i.id into active_id
 from private_content.app_access_invites i
 where i.secret_digest=extensions.digest(decode(p_secret,'hex'),'sha256')
   and i.revoked_at is null and i.redeem_until > now();
 if active_id is null then return false; end if;
 insert into private_content.app_access_members(user_id,invitation_id)
 values(auth.uid(),active_id)
 on conflict (user_id) do update
 set invitation_id=excluded.invitation_id,accepted_at=now();
 return true;
end;
$$;
revoke all on function public.app_access_invite_accept(text) from public,anon,authenticated;
grant execute on function public.app_access_invite_accept(text) to authenticated;

create or replace function public.app_access_invite_revoke(p_invitation_id uuid)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists(
   select 1 from private_content.site_owners o
   where o.user_id=auth.uid() and o.revoked_at is null
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 update private_content.app_access_invites
 set revoked_at=now()
 where id=p_invitation_id and revoked_at is null;
 return found;
end;
$$;
revoke all on function public.app_access_invite_revoke(uuid) from public,anon,authenticated;
grant execute on function public.app_access_invite_revoke(uuid) to authenticated;

-- Full sourced results readable ONLY by authenticated app members; no anon grant.
grant select on public.player_external_match_facts to authenticated;
grant select on public.tournament_placements to authenticated;
drop policy if exists app_access_matches_read on public.player_external_match_facts;
create policy app_access_matches_read on public.player_external_match_facts
 for select to authenticated using ((select public.app_access_is_member()));
drop policy if exists app_access_placements_read on public.tournament_placements;
create policy app_access_placements_read on public.tournament_placements
 for select to authenticated using ((select public.app_access_is_member()));

-- Player-scoped top-four proof view; never return an unverified award or ranking point.
create or replace function public.app_access_trophies_read(p_player_dbv_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
 if p_player_dbv_id is null or p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
 then return null; end if;
 if not public.app_access_is_member() then
   raise exception 'not_authorized' using errcode='42501';
 end if;
 return jsonb_build_object(
   'player_dbv_id',p_player_dbv_id,
   'results',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',p.id,'playerId',p_player_dbv_id,'playerName',pl.name,
       'date',p.event_date,'event',p.tournament_name,
       'place',p.placement,'discipline',p.discipline,
       'ageGroup',p.age_group,'partner',p.partner,
       'source',jsonb_build_object('url',p.source_url,'level',p.source_level),
       'verified',true
     ) order by p.event_date desc,p.id)
     from public.tournament_placements p
     join public.players pl on pl.id=p.player_id
     where pl.dbv_id=p_player_dbv_id
       and p.placement between 1 and 4
       and p.source_url like 'https://%'
   ),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.app_access_trophies_read(text) from public,anon,authenticated;
grant execute on function public.app_access_trophies_read(text) to authenticated;
