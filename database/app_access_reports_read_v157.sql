-- v157: Invite-only report reading. The public articles and mention tables stay RLS-locked.
-- App members can read verified source links; narrow player-link holders receive only
-- articles mentioning the exact server-verified player. No player names are returned.
create or replace function public.app_access_reports_read(
  p_player_dbv_id text default null,
  p_invitation_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $fn$
declare
  v_member boolean := public.app_access_is_member();
  v_invited jsonb;
  v_articles jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_player_dbv_id is not null and p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$' then
    raise exception 'invalid_player' using errcode = '22023';
  end if;
  if not v_member then
    if p_player_dbv_id is null or p_invitation_id is null then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    -- This existing server helper checks the accepting user, revocation and
    -- the underlying player-publication grant. A local UUID is not a credential.
    v_invited := private_content.player_access_session_read(p_invitation_id);
    if v_invited is null
       or (v_invited->'player'->>'dbv_id') is distinct from p_player_dbv_id then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',rows.id,
      'url',rows.url,
      'title',rows.title,
      'published_on',rows.published_on,
      'summary',rows.summary,
      'club_id',rows.club_id,
      'report_sources',jsonb_build_object('name',rows.source_name,'category',rows.source_category),
      'named',rows.is_named
    ) order by rows.published_on desc nulls last,rows.id
  ),'[]'::jsonb) into v_articles
  from (
    select a.id,a.url,a.title,a.published_on,a.summary,a.club_id,
      rs.name as source_name,rs.category as source_category,
      exists(
        select 1 from public.article_player_mentions m
        join public.players p on p.id=m.player_id
        where m.article_id=a.id and p.dbv_id=p_player_dbv_id
      ) as is_named
    from public.articles a
    left join public.report_sources rs on rs.id=a.source_id
    where a.status='verified'
      and (v_member or exists(
        select 1 from public.article_player_mentions m
        join public.players p on p.id=m.player_id
        where m.article_id=a.id and p.dbv_id=p_player_dbv_id
      ))
    order by a.published_on desc nulls last,a.id
    limit 200
  ) rows;
  return jsonb_build_object(
    'scope',case when v_member then 'member' else 'player' end,
    'player_dbv_id',p_player_dbv_id,
    'articles',v_articles
  );
end;
$fn$;

revoke all on function public.app_access_reports_read(text,uuid) from public,anon;
grant execute on function public.app_access_reports_read(text,uuid) to authenticated;
comment on function public.app_access_reports_read(text,uuid) is
 'Read verified public-source report links for invited app members or one server-authorized player. No raw player table access.';
