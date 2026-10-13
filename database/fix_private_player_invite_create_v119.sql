-- v119: fix PostgreSQL 42702 ambiguous 'expires_at' in private invitation creation.
-- Function RETURNS TABLE(..., expires_at) makes an unqualified expires_at
-- inside its body ambiguous. Always qualify the invite table alias.
-- All existing token, owner grant, quotas and expiry semantics remain intact.
begin;
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
 if (select count(*) from private_content.player_access_invites inv
     where inv.owner_user_id=owner_id and inv.revoked_at is null and (inv.expires_at>now() or inv.accepted_at is not null))>=20
 then raise exception 'active invitation quota reached' using errcode='22023'; end if;

 return query insert into private_content.player_access_invites(owner_user_id,player_dbv_id,token_digest)
 values (owner_id,p_player_dbv_id,extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256'))
 returning id,private_content.player_access_invites.expires_at;
end
$function$;
commit;
