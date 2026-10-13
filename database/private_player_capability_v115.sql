-- Schmetterlinge private player capability – Badminton project only: yadexibmjmnjfmfabrug
-- NO browser SELECT grants on players, matches or source tables.
-- Only a verified player_publication_grant holder can create an invitation.
-- A bearer URL token permits ONE player, 30 recent sourced matches, 7 days maximum.
-- Tokens must be generated with crypto.getRandomValues (256 bits), sent in hash fragment.
-- Privileged routines in unexposed schema. No paid service or pre-provisioned users.
begin;

create schema if not exists private_content;
revoke all on schema private_content from public, anon, authenticated;

create table if not exists private_content.player_access_invites (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 player_dbv_id text not null references public.players(dbv_id),
 token_digest bytea not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 revoked_at timestamptz,
 constraint player_access_token_length check (octet_length(token_digest)=32),
 constraint player_access_ttl check (expires_at<=created_at+interval '7 days 5 minutes')
);
create index if not exists player_access_invites_owner_idx
 on private_content.player_access_invites(owner_user_id,created_at desc);
create index if not exists player_access_invites_expiry_idx
 on private_content.player_access_invites(expires_at);
alter table private_content.player_access_invites enable row level security;
revoke all on private_content.player_access_invites from public,anon,authenticated;

create or replace function private_content.player_access_invite_create(
 p_token text, p_player_dbv_id text
) returns table(invitation_id uuid,expires_at timestamptz)
 language plpgsql security definer set search_path=''
as $function$
declare owner_id uuid := auth.uid();
begin
 if owner_id is null then
  raise exception 'verified owner required' using errcode='42501';
 end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$'
  or p_player_dbv_id is null or p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
 then raise exception 'invalid invitation input' using errcode='22023'; end if;

 -- A typed DBV player ID or an anonymous session alone NEVER confers authority.
 if not exists (
  select 1 from public.player_publication_grants g
  where g.user_id=owner_id and g.player_dbv_id=p_player_dbv_id
    and g.revoked_at is null
 ) then raise exception 'verified owner required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,115));
 if (select count(*) from private_content.player_access_invites
     where owner_user_id=owner_id and created_at>now()-interval '24 hours')>=10
 then raise exception 'invitation quota reached' using errcode='22023'; end if;
 if (select count(*) from private_content.player_access_invites
     where owner_user_id=owner_id and revoked_at is null and expires_at>now())>=5
 then raise exception 'active invitation quota reached' using errcode='22023'; end if;

 return query insert into private_content.player_access_invites(owner_user_id,player_dbv_id,token_digest)
 values (owner_id,p_player_dbv_id,extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256'))
 returning id,private_content.player_access_invites.expires_at;
end
$function$;

create or replace function private_content.player_access_invite_read(p_token text)
 returns jsonb language plpgsql security definer set search_path=''
as $function$
declare player_id text;
declare result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select i.player_dbv_id into player_id
 from private_content.player_access_invites i
 where i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
   and i.revoked_at is null and i.expires_at>now()
   and exists (
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
     and g.revoked_at is null
   )
 limit 1;
 if player_id is null then return null; end if;
 select jsonb_build_object(
  'player',jsonb_build_object(
   'dbv_id',p.dbv_id,'name',p.name,'club',p.club,
   'birth_year',p.birth_year,'age_class',p.age_class),
  'matches',coalesce((
   select jsonb_agg(to_jsonb(m)) from (
    select f.match_date,f.discipline,f.competition,f.category,
     f.player_side,f.winning_side,f.games,
     f.source_name,f.source_url
    from public.player_external_match_facts f
    where f.dbv_id=p.dbv_id and f.match_date is not null
    order by f.match_date desc,f.source_key desc
    limit 30
   ) m
  ),'[]'::jsonb)
 ) into result from public.players p where p.dbv_id=player_id;
 return result;
end
$function$;

create or replace function private_content.player_access_invite_revoke(p_invitation_id uuid)
 returns boolean language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then return false; end if;
 update private_content.player_access_invites
 set revoked_at=now()
 where id=p_invitation_id and owner_user_id=auth.uid()
   and revoked_at is null;
 return found;
end
$function$;

-- Public RPC façade is SECURITY INVOKER, not a direct table access grant.
create or replace function public.private_player_invite_create(p_token text,p_player_dbv_id text)
 returns table(invitation_id uuid,expires_at timestamptz)
 language sql security invoker set search_path=''
as $function$
 select * from private_content.player_access_invite_create(p_token,p_player_dbv_id);
$function$;

create or replace function public.private_player_invite_read(p_token text)
 returns jsonb language sql security invoker set search_path=''
as $function$
 select private_content.player_access_invite_read(p_token);
$function$;

create or replace function public.private_player_invite_revoke(p_invitation_id uuid)
 returns boolean language sql security invoker set search_path=''
as $function$
 select private_content.player_access_invite_revoke(p_invitation_id);
$function$;

revoke all on function private_content.player_access_invite_create(text,text) from public,anon,authenticated;
revoke all on function private_content.player_access_invite_read(text) from public,anon,authenticated;
revoke all on function private_content.player_access_invite_revoke(uuid) from public,anon,authenticated;
revoke all on function public.private_player_invite_create(text,text) from public,anon,authenticated;
revoke all on function public.private_player_invite_read(text) from public,anon,authenticated;
revoke all on function public.private_player_invite_revoke(uuid) from public,anon,authenticated;

-- The private_content schema is not in exposed PostgREST schemas, but its
-- internal functions need narrowly scoped invocation for the public façades.
grant usage on schema private_content to anon,authenticated;
grant execute on function private_content.player_access_invite_read(text) to anon,authenticated;
grant execute on function public.private_player_invite_read(text) to anon,authenticated;
grant execute on function private_content.player_access_invite_create(text,text) to authenticated;
grant execute on function public.private_player_invite_create(text,text) to authenticated;
grant execute on function private_content.player_access_invite_revoke(uuid) to authenticated;
grant execute on function public.private_player_invite_revoke(uuid) to authenticated;
commit;
