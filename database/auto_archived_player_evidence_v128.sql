-- Badminton v128: automatic archived evidence reads after independent approval.
-- Reuse v127's reviewed per-player grant; no extra, manually seeded permission table.
-- Old v1 invites and local follows remain unauthorized. No public table SELECT.
begin;
create or replace function private_content.player_archive_session_read(
 p_invitation_id uuid,p_kind text,p_offset integer,p_limit integer
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare target_id text; result jsonb; total_count integer; owner_name text;
begin
 if p_kind not in ('placement','match_card') or p_kind is null
    or p_offset is null or p_offset<0 or p_offset>10000
    or p_limit is null or p_limit<1 or p_limit>100 then
   raise exception 'invalid evidence page' using errcode='22023'; end if;
 if auth.uid() is null or p_invitation_id is null then return null; end if;

 select i.player_dbv_id,p.name into target_id,owner_name
 from private_content.player_access_invites i
 join public.players p on p.dbv_id=i.player_dbv_id
 where i.id=p_invitation_id
   and i.scope_version=2
   and i.accepted_by=auth.uid()
   and i.accepted_at is not null
   and i.revoked_at is null
   and i.granted_sections @> ARRAY['profile','trophies','matches']::text[]
   and private_content.has_independent_player_grant(i.owner_user_id,i.player_dbv_id)
 limit 1;
 if target_id is null then return null; end if;

 select count(*) into total_count
 from private_content.spvgg_archive_evidence e
 where e.dbv_id=target_id and e.kind=p_kind
   and (p_kind<>'placement' or (e.payload->>'placement')::integer between 1 and 4);

 if p_kind='placement' then
  select coalesce(jsonb_agg(
   jsonb_build_object(
    'id',s.source_key,'playerId',target_id,'playerName',owner_name,
    'date',s.payload->>'event_date',
    'place',(s.payload->>'placement')::integer,
    'verified',true,
    'event',s.payload->>'tournament_name',
    'discipline',s.payload->>'discipline',
    'ageGroup',s.payload->>'age_group',
    'location',s.payload->>'city',
    'source',jsonb_build_object('url',s.payload->>'source_url')
   ) order by s.payload->>'event_date' desc,s.source_key
  ),'[]'::jsonb) into result
  from (
   select e.source_key,e.payload
   from private_content.spvgg_archive_evidence e
   where e.dbv_id=target_id and e.kind='placement'
    and (e.payload->>'placement')::integer between 1 and 4
   order by e.payload->>'event_date' desc,e.source_key
   limit p_limit offset p_offset
  ) s;
 else
  select coalesce(jsonb_agg(
   jsonb_build_object(
    'dbv_id',target_id,'source_key',s.source_key,
    'category',s.payload->>'category',
    'competition',s.payload->>'competition',
    'event',s.payload->>'event',
    'discipline',s.payload->>'discipline',
    'round_label',s.payload->>'round_label',
    'match_date',s.payload->>'match_date',
    'match_year',(s.payload->>'match_year')::integer,
    'player_side',(s.payload->>'player_side')::integer,
    'winning_side',(s.payload->>'winning_side')::integer,
    'opponent_names',coalesce(s.payload->'opponent_names','[]'::jsonb),
    'partner_names',coalesce(s.payload->'partner_names','[]'::jsonb),
    'games',coalesce(s.payload->'games','[]'::jsonb),
    'outcome_evidence',s.payload->>'outcome_evidence',
    'source_name',s.payload->>'source_name',
    'source_kind',s.payload->>'source_kind',
    'source_url',s.payload->>'source_url'
   ) order by s.payload->>'match_year' desc,s.payload->>'match_date' desc,s.source_key
  ),'[]'::jsonb) into result
  from (
   select e.source_key,e.payload
   from private_content.spvgg_archive_evidence e
   where e.dbv_id=target_id and e.kind='match_card'
   order by e.payload->>'match_year' desc,e.payload->>'match_date' desc,e.source_key
   limit p_limit offset p_offset
  ) s;
 end if;
 return jsonb_build_object(
  'dbv_id',target_id,'kind',p_kind,'scope_version',2,
  'coverage','source_evidence_not_exhaustively_verified',
  'total',total_count,'offset',p_offset,'entries',result);
end;
$body$;

create or replace function private_content.player_owner_archive_session_read(
 p_player_dbv_id text,p_kind text,p_offset integer,p_limit integer
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare target_id text; result jsonb; total_count integer; owner_name text;
begin
 if p_kind not in ('placement','match_card') or p_kind is null
    or p_offset is null or p_offset<0 or p_offset>10000
    or p_limit is null or p_limit<1 or p_limit>100 then
   raise exception 'invalid evidence page' using errcode='22023'; end if;
 if auth.uid() is null or p_player_dbv_id is null then return null; end if;

 select p.dbv_id,p.name into target_id,owner_name
 from public.players p where p.dbv_id=p_player_dbv_id
   and private_content.has_independent_player_grant(auth.uid(),p.dbv_id)
 limit 1;
 if target_id is null then return null; end if;

 select count(*) into total_count
 from private_content.spvgg_archive_evidence e
 where e.dbv_id=target_id and e.kind=p_kind
   and (p_kind<>'placement' or (e.payload->>'placement')::integer between 1 and 4);

 if p_kind='placement' then
  select coalesce(jsonb_agg(
   jsonb_build_object(
    'id',s.source_key,'playerId',target_id,'playerName',owner_name,
    'date',s.payload->>'event_date',
    'place',(s.payload->>'placement')::integer,
    'verified',true,
    'event',s.payload->>'tournament_name',
    'discipline',s.payload->>'discipline',
    'ageGroup',s.payload->>'age_group',
    'location',s.payload->>'city',
    'source',jsonb_build_object('url',s.payload->>'source_url')
   ) order by s.payload->>'event_date' desc,s.source_key
  ),'[]'::jsonb) into result
  from (
   select e.source_key,e.payload
   from private_content.spvgg_archive_evidence e
   where e.dbv_id=target_id and e.kind='placement'
    and (e.payload->>'placement')::integer between 1 and 4
   order by e.payload->>'event_date' desc,e.source_key
   limit p_limit offset p_offset
  ) s;
 else
  select coalesce(jsonb_agg(
   jsonb_build_object(
    'dbv_id',target_id,'source_key',s.source_key,
    'category',s.payload->>'category',
    'competition',s.payload->>'competition',
    'event',s.payload->>'event',
    'discipline',s.payload->>'discipline',
    'round_label',s.payload->>'round_label',
    'match_date',s.payload->>'match_date',
    'match_year',(s.payload->>'match_year')::integer,
    'player_side',(s.payload->>'player_side')::integer,
    'winning_side',(s.payload->>'winning_side')::integer,
    'opponent_names',coalesce(s.payload->'opponent_names','[]'::jsonb),
    'partner_names',coalesce(s.payload->'partner_names','[]'::jsonb),
    'games',coalesce(s.payload->'games','[]'::jsonb),
    'outcome_evidence',s.payload->>'outcome_evidence',
    'source_name',s.payload->>'source_name',
    'source_kind',s.payload->>'source_kind',
    'source_url',s.payload->>'source_url'
   ) order by s.payload->>'match_year' desc,s.payload->>'match_date' desc,s.source_key
  ),'[]'::jsonb) into result
  from (
   select e.source_key,e.payload
   from private_content.spvgg_archive_evidence e
   where e.dbv_id=target_id and e.kind='match_card'
   order by e.payload->>'match_year' desc,e.payload->>'match_date' desc,e.source_key
   limit p_limit offset p_offset
  ) s;
 end if;
 return jsonb_build_object(
  'dbv_id',target_id,'kind',p_kind,'scope_version',2,
  'coverage','source_evidence_not_exhaustively_verified',
  'total',total_count,'offset',p_offset,'entries',result);
end;
$body$;

create or replace function public.private_player_owner_archive_read(
 p_player_dbv_id text,p_kind text,p_offset integer,p_limit integer
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private_content.player_owner_archive_session_read(p_player_dbv_id,p_kind,p_offset,p_limit);
$body$;

revoke all on function private_content.player_owner_archive_session_read(text,text,integer,integer)
 from public,anon,authenticated;
revoke all on function public.private_player_owner_archive_read(text,text,integer,integer)
 from public,anon,authenticated;
grant execute on function private_content.player_owner_archive_session_read(text,text,integer,integer)
 to authenticated;
grant execute on function public.private_player_owner_archive_read(text,text,integer,integer)
 to authenticated;
commit;
