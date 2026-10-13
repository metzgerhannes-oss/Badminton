-- Schmetterlinge v118: data minimization, do not return unneeded birth_year
-- from a recipient-facing private match capability.
-- Keep all server-side authorization/revocation checks identical to v116.
begin;
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
   'age_class',p.age_class),
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


commit;
