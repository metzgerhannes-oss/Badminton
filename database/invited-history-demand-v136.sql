-- Member-initiated history import demand; replaces the v114 disabled public queue.
-- Service-role importer keeps its existing bounded, per-player claims and quotas.
create or replace function public.app_access_history_demand(p_player_dbv_id text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not public.app_access_is_member()
 then raise exception 'not_authorized' using errcode='42501'; end if;
 return demand_internal.request_player_history_demand(p_player_dbv_id);
end;
$$;
revoke all on function public.app_access_history_demand(text) from public,anon,authenticated;
grant execute on function public.app_access_history_demand(text) to authenticated;
