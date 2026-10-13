-- v127 / Badminton only: a newly accepted, expressly consented player link
-- loads private sourced trophies and match cards without manual archive imports.
-- V1/legacy links are never upgraded. A browser follow/local profile grants nothing.
begin;

alter table private_content.player_access_invites
 add column if not exists scope_version smallint not null default 1
 check (scope_version in (1,2));

-- A site-owner self-attestation is insufficient for expanding access to
-- children's archived results. This approval is recorded out of band only.
create table if not exists private_content.player_archive_reviews (
 owner_user_id uuid not null,
 player_dbv_id text not null,
 evidence_kind text not null check(evidence_kind in
  ('club_confirmation','guardian_confirmation','adult_player_confirmation')),
 reviewed_by text not null check(length(btrim(reviewed_by)) between 3 and 120),
 reviewed_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(owner_user_id,player_dbv_id),
 foreign key(owner_user_id,player_dbv_id)
  references public.player_publication_grants(user_id,player_dbv_id)
  on delete cascade
);
alter table private_content.player_archive_reviews enable row level security;
revoke all on private_content.player_archive_reviews from public,anon,authenticated;
comment on table private_content.player_archive_reviews is
 'Trusted, independent authority validation per player; never self-provision from browser.';

create or replace function private_content.player_access_invite_create_v2(
 p_token text,p_player_dbv_id text
) returns table(invitation_id uuid,expires_at timestamptz)
 language plpgsql security definer set search_path=''
as $body$
declare new_id uuid; deadline timestamptz;
begin
 if auth.uid() is null or not exists (
   select 1 from private_content.player_archive_reviews r
   join public.player_publication_grants g
    on g.user_id=r.owner_user_id and g.player_dbv_id=r.player_dbv_id
   where r.owner_user_id=auth.uid()
     and r.player_dbv_id=p_player_dbv_id
     and r.revoked_at is null and g.revoked_at is null
     and g.verified_at is not null
 ) then raise exception 'independent player authorization required' using errcode='42501'; end if;

 -- All original token, ownership and quota checks remain in the v116 function.
 select c.invitation_id,c.expires_at into new_id,deadline
 from private_content.player_access_invite_create(p_token,p_player_dbv_id) c;
 update private_content.player_access_invites i set scope_version=2
 where i.id=new_id and i.owner_user_id=auth.uid();
 return query select new_id,deadline;
end;
$body$;

create or replace function public.private_player_invite_create_v2(
 p_token text,p_player_dbv_id text
) returns table(invitation_id uuid,expires_at timestamptz)
 language sql security invoker set search_path=''
as $body$
 select * from private_content.player_access_invite_create_v2(p_token,p_player_dbv_id);
$body$;

-- Private, bounded and session-bound archive access. No data based on an ID alone.
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
   and exists (
    select 1 from public.player_publication_grants g
    join private_content.player_archive_reviews r
      on r.owner_user_id=g.user_id and r.player_dbv_id=g.player_dbv_id
    where g.user_id=i.owner_user_id and g.player_dbv_id=i.player_dbv_id
      and g.revoked_at is null and g.verified_at is not null
      and r.revoked_at is null)
 limit 1;
 if target_id is null then return null; end if;

 select count(*) into total_count
 from private_content.spvgg_archive_evidence e
 where e.dbv_id=target_id and e.kind=p_kind;

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

create or replace function public.private_player_archive_read(
 p_invitation_id uuid,p_kind text,p_offset integer,p_limit integer
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private_content.player_archive_session_read(p_invitation_id,p_kind,p_offset,p_limit);
$body$;

revoke all on function private_content.player_access_invite_create_v2(text,text)
 from public,anon,authenticated;
revoke all on function private_content.player_archive_session_read(uuid,text,integer,integer)
 from public,anon,authenticated;
revoke all on function public.private_player_invite_create_v2(text,text)
 from public,anon,authenticated;
revoke all on function public.private_player_archive_read(uuid,text,integer,integer)
 from public,anon,authenticated;
grant execute on function private_content.player_access_invite_create_v2(text,text) to authenticated;
grant execute on function private_content.player_archive_session_read(uuid,text,integer,integer) to authenticated;
grant execute on function public.private_player_invite_create_v2(text,text) to authenticated;
grant execute on function public.private_player_archive_read(uuid,text,integer,integer) to authenticated;
commit;
