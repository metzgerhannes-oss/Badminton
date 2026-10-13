-- Schmetterlinge v118 · Repair verified per-player sharing RLS.
-- IMPORTANT: policy predicates must not directly query tables whose SELECT
-- privilege has intentionally been revoked from authenticated clients.
-- No browser SELECT permissions are granted and no person data is exposed.
begin;
create or replace function private_content.can_publish_player_tournament(
 p_owner uuid, p_player_dbv_id text
) returns boolean
language sql stable security definer set search_path=''
as $function$
 select
  auth.uid() is not null
  and p_owner=auth.uid()
  and p_player_dbv_id is not null
  and exists(
   select 1
   from public.player_publication_grants g
   join public.players p on p.dbv_id=g.player_dbv_id
   where g.user_id=p_owner
     and g.player_dbv_id=p_player_dbv_id
     and g.revoked_at is null
     and g.verified_at is not null
     and p.verified_at is not null
  );
$function$;
revoke all on function private_content.can_publish_player_tournament(uuid,text)
 from public,anon,authenticated;
grant execute on function private_content.can_publish_player_tournament(uuid,text)
 to authenticated;

-- The existing "Bound" and "Only verified managers" policies WERE restrictive.
-- They cannot be bypassed through permissive ownership policies, but directly
-- selecting players/grants from RLS policy expressions can deny legitimate
-- signed-in publishers. Replace these four policies with one narrow server-side
-- check per operation. Preserve existing owner-only permissive policies.
drop policy if exists "Bound public tournament publications on insert"
 on public.user_tournament_links;
drop policy if exists "Only verified managers can publish on insert"
 on public.user_tournament_links;
drop policy if exists "Bound public tournament publications on update"
 on public.user_tournament_links;
drop policy if exists "Only verified managers can publish on update"
 on public.user_tournament_links;

create policy "v118 verified private sharing on insert"
 on public.user_tournament_links
 as restrictive for insert to authenticated
 with check (
  user_id=(select auth.uid())
  and (
   is_shared is false
   or (
    player_dbv_id is not null
    and shared_at is not null
    and private_content.can_publish_player_tournament(user_id,player_dbv_id)
   )
  )
 );

create policy "v118 verified private sharing on update"
 on public.user_tournament_links
 as restrictive for update to authenticated
 using (user_id=(select auth.uid()))
 with check (
  user_id=(select auth.uid())
  and (
   is_shared is false
   or (
    player_dbv_id is not null
    and shared_at is not null
    and private_content.can_publish_player_tournament(user_id,player_dbv_id)
   )
  )
 );
commit;
