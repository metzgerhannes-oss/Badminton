-- v138: owner-only invitation overview. No invitation secret, email,
-- recipient identity or device fingerprint is returned to the client.
-- The redemption deadline applies to NEW acceptances; accepted memberships
-- persist until the underlying invitation is revoked.
create or replace function public.app_access_invites_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists (
  select 1 from private_content.site_owners o
  where o.user_id=auth.uid() and o.revoked_at is null
 ) then
  raise exception 'not_authorized' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_agg(to_jsonb(link_rows) order by link_rows.created_at desc)
  from (
   select i.id,i.created_at,i.redeem_until,i.revoked_at,
    (select count(*)::integer from private_content.app_access_members m
      where m.invitation_id=i.id) as accepted_count
   from private_content.app_access_invites i
   where i.issuer=auth.uid()
   order by i.created_at desc
   limit 50
  ) link_rows
 ),'[]'::jsonb);
end;
$$;
revoke all on function public.app_access_invites_overview() from public,anon,authenticated;
grant execute on function public.app_access_invites_overview() to authenticated;
comment on function public.app_access_invites_overview() is
 'Owner-only metadata and aggregate acceptance count for the most recent 50 issued app invitations; no secrets or recipient identifiers.';
