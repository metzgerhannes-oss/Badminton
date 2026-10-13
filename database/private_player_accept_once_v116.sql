-- Schmetterlinge v116; Badminton project yadexibmjmnjfmfabrug ONLY.
-- Seven days are an ACCEPTANCE window, not a lifespan of accepted access.
-- Lifetime grants count against a bounded owner quota (20 active or waiting).

-- Acceptance binds one invitation to exactly one anonymous/authenticated Supabase user.
-- Subsequent reads check that user on EVERY call, plus creator's verified grant and revocation.
-- No client SELECT on personal tables, no new required account for public browsing.
begin;
alter table private_content.player_access_invites
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz;
alter table private_content.player_access_invites
  drop constraint if exists player_access_accept_pair;
alter table private_content.player_access_invites
  add constraint player_access_accept_pair check
  ((accepted_by is null and accepted_at is null) or
   (accepted_by is not null and accepted_at is not null));
create index if not exists player_access_invite_reader
  on private_content.player_access_invites(accepted_by)
  where accepted_by is not null and revoked_at is null;

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
 if p_token is null or p_token !~ '^[a-f0-9]{64}
 returns uuid language plpgsql security definer set search_path=''
as $function$
declare visitor uuid:=auth.uid(); invite uuid;
begin
 if visitor is null then raise exception 'anonymous account required for one-time acceptance'
  using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 -- Single atomic redemption: a forwarded link cannot enroll a second device.
 update private_content.player_access_invites i
 set accepted_by=visitor,accepted_at=now()
 where i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
   and i.accepted_by is null
   and i.revoked_at is null
   and i.expires_at>now()
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   )
 returning i.id into invite;
 return invite;
end
$function$;

create or replace function private_content.player_access_session_read(p_invitation_id uuid)
 returns jsonb language plpgsql security definer set search_path=''
as $function$
declare player_id text; result jsonb;
begin
 if auth.uid() is null or p_invitation_id is null then return null; end if;
 select i.player_dbv_id into player_id
 from private_content.player_access_invites i
 where i.id=p_invitation_id and i.accepted_by=auth.uid()
   and i.accepted_at is not null and i.revoked_at is null
   -- Intentionally no expires_at check: 7 days limit ACCEPTANCE only.
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   ) limit 1;
 if player_id is null then return null; end if;
 select jsonb_build_object(
  'player',jsonb_build_object(
   'dbv_id',p.dbv_id,'name',p.name,'club',p.club,
   'birth_year',p.birth_year,'age_class',p.age_class),
  'matches',coalesce((
   select jsonb_agg(to_jsonb(m)) from (
    select f.match_date,f.discipline,f.competition,f.category,
     f.player_side,f.winning_side,f.games,f.source_name,f.source_url
    from public.player_external_match_facts f
    where f.dbv_id=p.dbv_id and f.match_date is not null
    order by f.match_date desc,f.source_key desc limit 30
   ) m
  ),'[]'::jsonb)
 ) into result from public.players p where p.dbv_id=player_id;
 return result;
end
$function$;

create or replace function public.private_player_invite_accept(p_token text)
 returns uuid language sql security invoker set search_path=''
as $function$
 select private_content.player_access_invite_accept(p_token);
$function$;
create or replace function public.private_player_access_read(p_invitation_id uuid)
 returns jsonb language sql security invoker set search_path=''
as $function$
 select private_content.player_access_session_read(p_invitation_id);
$function$;

-- Disable legacy seven-day bearer-only reads. No data must be returned without
-- a device-bound session and one-time acceptance, even while older PWA assets persist.
create or replace function private_content.player_access_invite_read(p_token text)
 returns jsonb language sql security invoker set search_path=''
as $function$ select null::jsonb; $function$;
revoke all on function private_content.player_access_invite_read(text) from public,anon,authenticated;
revoke all on function public.private_player_invite_read(text) from public,anon,authenticated;

revoke all on function private_content.player_access_invite_accept(text) from public,anon,authenticated;
revoke all on function private_content.player_access_session_read(uuid) from public,anon,authenticated;
revoke all on function public.private_player_invite_accept(text) from public,anon,authenticated;
revoke all on function public.private_player_access_read(uuid) from public,anon,authenticated;
grant execute on function private_content.player_access_invite_accept(text) to authenticated;
grant execute on function private_content.player_access_session_read(uuid) to authenticated;
grant execute on function public.private_player_invite_accept(text) to authenticated;
grant execute on function public.private_player_access_read(uuid) to authenticated;
commit;

  or p_player_dbv_id is null or p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}
 returns uuid language plpgsql security definer set search_path=''
as $function$
declare visitor uuid:=auth.uid(); invite uuid;
begin
 if visitor is null then raise exception 'anonymous account required for one-time acceptance'
  using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 -- Single atomic redemption: a forwarded link cannot enroll a second device.
 update private_content.player_access_invites i
 set accepted_by=visitor,accepted_at=now()
 where i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
   and i.accepted_by is null
   and i.revoked_at is null
   and i.expires_at>now()
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   )
 returning i.id into invite;
 return invite;
end
$function$;

create or replace function private_content.player_access_session_read(p_invitation_id uuid)
 returns jsonb language plpgsql security definer set search_path=''
as $function$
declare player_id text; result jsonb;
begin
 if auth.uid() is null or p_invitation_id is null then return null; end if;
 select i.player_dbv_id into player_id
 from private_content.player_access_invites i
 where i.id=p_invitation_id and i.accepted_by=auth.uid()
   and i.accepted_at is not null and i.revoked_at is null
   -- Intentionally no expires_at check: 7 days limit ACCEPTANCE only.
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   ) limit 1;
 if player_id is null then return null; end if;
 select jsonb_build_object(
  'player',jsonb_build_object(
   'dbv_id',p.dbv_id,'name',p.name,'club',p.club,
   'birth_year',p.birth_year,'age_class',p.age_class),
  'matches',coalesce((
   select jsonb_agg(to_jsonb(m)) from (
    select f.match_date,f.discipline,f.competition,f.category,
     f.player_side,f.winning_side,f.games,f.source_name,f.source_url
    from public.player_external_match_facts f
    where f.dbv_id=p.dbv_id and f.match_date is not null
    order by f.match_date desc,f.source_key desc limit 30
   ) m
  ),'[]'::jsonb)
 ) into result from public.players p where p.dbv_id=player_id;
 return result;
end
$function$;

create or replace function public.private_player_invite_accept(p_token text)
 returns uuid language sql security invoker set search_path=''
as $function$
 select private_content.player_access_invite_accept(p_token);
$function$;
create or replace function public.private_player_access_read(p_invitation_id uuid)
 returns jsonb language sql security invoker set search_path=''
as $function$
 select private_content.player_access_session_read(p_invitation_id);
$function$;

-- Disable legacy seven-day bearer-only reads. No data must be returned without
-- a device-bound session and one-time acceptance, even while older PWA assets persist.
create or replace function private_content.player_access_invite_read(p_token text)
 returns jsonb language sql security invoker set search_path=''
as $function$ select null::jsonb; $function$;
revoke all on function private_content.player_access_invite_read(text) from public,anon,authenticated;
revoke all on function public.private_player_invite_read(text) from public,anon,authenticated;

revoke all on function private_content.player_access_invite_accept(text) from public,anon,authenticated;
revoke all on function private_content.player_access_session_read(uuid) from public,anon,authenticated;
revoke all on function public.private_player_invite_accept(text) from public,anon,authenticated;
revoke all on function public.private_player_access_read(uuid) from public,anon,authenticated;
grant execute on function private_content.player_access_invite_accept(text) to authenticated;
grant execute on function private_content.player_access_session_read(uuid) to authenticated;
grant execute on function public.private_player_invite_accept(text) to authenticated;
grant execute on function public.private_player_access_read(uuid) to authenticated;
commit;

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
     where owner_user_id=owner_id and revoked_at is null and (expires_at>now() or accepted_at is not null))>=20
 then raise exception 'active invitation quota reached' using errcode='22023'; end if;

 return query insert into private_content.player_access_invites(owner_user_id,player_dbv_id,token_digest)
 values (owner_id,p_player_dbv_id,extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256'))
 returning id,private_content.player_access_invites.expires_at;
end
$function$;

create or replace function private_content.player_access_invite_accept(p_token text)
 returns uuid language plpgsql security definer set search_path=''
as $function$
declare visitor uuid:=auth.uid(); invite uuid;
begin
 if visitor is null then raise exception 'anonymous account required for one-time acceptance'
  using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 -- Single atomic redemption: a forwarded link cannot enroll a second device.
 update private_content.player_access_invites i
 set accepted_by=visitor,accepted_at=now()
 where i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
   and i.accepted_by is null
   and i.revoked_at is null
   and i.expires_at>now()
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   )
 returning i.id into invite;
 return invite;
end
$function$;

create or replace function private_content.player_access_session_read(p_invitation_id uuid)
 returns jsonb language plpgsql security definer set search_path=''
as $function$
declare player_id text; result jsonb;
begin
 if auth.uid() is null or p_invitation_id is null then return null; end if;
 select i.player_dbv_id into player_id
 from private_content.player_access_invites i
 where i.id=p_invitation_id and i.accepted_by=auth.uid()
   and i.accepted_at is not null and i.revoked_at is null
   -- Intentionally no expires_at check: 7 days limit ACCEPTANCE only.
   and exists(
    select 1 from public.player_publication_grants g
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null
   ) limit 1;
 if player_id is null then return null; end if;
 select jsonb_build_object(
  'player',jsonb_build_object(
   'dbv_id',p.dbv_id,'name',p.name,'club',p.club,
   'birth_year',p.birth_year,'age_class',p.age_class),
  'matches',coalesce((
   select jsonb_agg(to_jsonb(m)) from (
    select f.match_date,f.discipline,f.competition,f.category,
     f.player_side,f.winning_side,f.games,f.source_name,f.source_url
    from public.player_external_match_facts f
    where f.dbv_id=p.dbv_id and f.match_date is not null
    order by f.match_date desc,f.source_key desc limit 30
   ) m
  ),'[]'::jsonb)
 ) into result from public.players p where p.dbv_id=player_id;
 return result;
end
$function$;

create or replace function public.private_player_invite_accept(p_token text)
 returns uuid language sql security invoker set search_path=''
as $function$
 select private_content.player_access_invite_accept(p_token);
$function$;
create or replace function public.private_player_access_read(p_invitation_id uuid)
 returns jsonb language sql security invoker set search_path=''
as $function$
 select private_content.player_access_session_read(p_invitation_id);
$function$;

-- Disable legacy seven-day bearer-only reads. No data must be returned without
-- a device-bound session and one-time acceptance, even while older PWA assets persist.
create or replace function private_content.player_access_invite_read(p_token text)
 returns jsonb language sql security invoker set search_path=''
as $function$ select null::jsonb; $function$;
revoke all on function private_content.player_access_invite_read(text) from public,anon,authenticated;
revoke all on function public.private_player_invite_read(text) from public,anon,authenticated;

revoke all on function private_content.player_access_invite_accept(text) from public,anon,authenticated;
revoke all on function private_content.player_access_session_read(uuid) from public,anon,authenticated;
revoke all on function public.private_player_invite_accept(text) from public,anon,authenticated;
revoke all on function public.private_player_access_read(uuid) from public,anon,authenticated;
grant execute on function private_content.player_access_invite_accept(text) to authenticated;
grant execute on function private_content.player_access_session_read(uuid) to authenticated;
grant execute on function public.private_player_invite_accept(text) to authenticated;
grant execute on function public.private_player_access_read(uuid) to authenticated;
commit;
