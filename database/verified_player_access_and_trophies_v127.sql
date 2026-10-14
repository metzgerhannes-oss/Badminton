-- v127 draft: independent player-manager verification and private trophy read.
-- Source: Badminton Supabase only (yadexibmjmnjfmfabrug).
-- MUST NOT be deployed until an independently vetted club/parent reviewer is enrolled
-- through a trusted out-of-band procedure and privacy obligations #53/#56 are met.
-- Existing v1 invitations stay v1. Two guardian_review assertions are NOT proof.
BEGIN;

CREATE TABLE IF NOT EXISTS private_content.player_management_reviewers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 independent_channel text NOT NULL CHECK(independent_channel IN ('club_official','association_official','parent_confirmed')),
 club_scope text NOT NULL CHECK (length(club_scope) BETWEEN 1 AND 120),
 CONSTRAINT association_only_global_scope CHECK (club_scope<>'*' OR independent_channel='association_official'),
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS private_content.player_management_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 applicant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 player_dbv_id text NOT NULL REFERENCES public.players(dbv_id) ON DELETE CASCADE,
 preferred_channel text NOT NULL CHECK(preferred_channel IN ('club_official','association_official','parent_confirmed')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewer_user_id uuid REFERENCES private_content.player_management_reviewers(user_id),
 review_reference text,
 revoked_at timestamptz,
 CONSTRAINT independent_review_requires_reviewer CHECK (
  status <> 'approved' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND review_reference IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS player_management_one_pending
 ON private_content.player_management_requests(applicant_user_id,player_dbv_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS player_management_active_review
 ON private_content.player_management_requests(applicant_user_id,player_dbv_id,status);
ALTER TABLE private_content.player_management_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_content.player_management_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.player_management_reviewers FROM PUBLIC,anon,authenticated;
REVOKE ALL ON private_content.player_management_requests FROM PUBLIC,anon,authenticated;
-- Intentionally no browser SELECT/INSERT/UPDATE/DELETE policies on reviewer or request tables.
-- Reviewer enrolment is an out-of-band, separately checked administrative action.
-- Neither the owner nor an anonymous account can enrol themselves from an RPC.

CREATE OR REPLACE FUNCTION private_content.has_independent_player_grant(p_user_id uuid,p_dbv_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$
 SELECT p_user_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.player_publication_grants g
   JOIN private_content.player_management_requests r
     ON r.applicant_user_id=g.user_id AND r.player_dbv_id=g.player_dbv_id
      AND r.status='approved' AND r.revoked_at IS NULL
   JOIN private_content.player_management_reviewers v
     ON v.user_id=r.reviewer_user_id AND v.revoked_at IS NULL
     AND v.independent_channel=r.preferred_channel
   JOIN public.players p ON p.dbv_id=g.player_dbv_id
     AND (v.club_scope=p.club OR (v.independent_channel='association_official' AND v.club_scope='*'))
   WHERE g.user_id=p_user_id AND g.player_dbv_id=p_dbv_id AND g.revoked_at IS NULL
     AND g.verification_method IN ('club_review','adult_player_review')
     AND g.reviewed_by='reviewer:'||r.reviewer_user_id::text
     AND g.verified_at>=r.reviewed_at
     AND r.reviewer_user_id <> r.applicant_user_id
     AND r.reviewed_at IS NOT NULL AND length(r.review_reference)>=8
 );
$func$;
REVOKE ALL ON FUNCTION private_content.has_independent_player_grant(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private_content.player_management_request_create(p_player_dbv_id text,p_channel text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid(); request_id uuid;
BEGIN
 IF actor IS NULL OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
  OR p_channel NOT IN ('club_official','association_official','parent_confirmed')
 THEN RAISE EXCEPTION 'invalid player verification request' USING errcode='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.players p WHERE p.dbv_id=p_player_dbv_id)
 THEN RETURN NULL; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,127));
 IF (SELECT count(*) FROM private_content.player_management_requests r
      WHERE r.created_at>now()-interval '24 hours')>=100
   OR (SELECT count(*) FROM private_content.player_management_requests r
      WHERE r.player_dbv_id=p_player_dbv_id AND r.created_at>now()-interval '24 hours')>=8
 THEN RAISE EXCEPTION 'global verification request quota' USING errcode='22023'; END IF;
 IF (SELECT count(*) FROM private_content.player_management_requests r
      WHERE r.applicant_user_id=actor AND r.created_at>now()-interval '24 hours')>=5
 THEN RAISE EXCEPTION 'verification request quota' USING errcode='22023'; END IF;
 INSERT INTO private_content.player_management_requests(applicant_user_id,player_dbv_id,preferred_channel)
 VALUES(actor,p_player_dbv_id,p_channel)
 ON CONFLICT (applicant_user_id,player_dbv_id) WHERE status='pending'
 DO UPDATE SET preferred_channel=EXCLUDED.preferred_channel
 RETURNING id INTO request_id;
 RETURN request_id;
END
$func$;
REVOKE ALL ON FUNCTION private_content.player_management_request_create(text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private_content.player_management_request_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'player_dbv_id',r.player_dbv_id,'status',
 CASE WHEN r.status='approved' AND NOT private_content.has_independent_player_grant(auth.uid(),r.player_dbv_id)
      THEN 'not_verified' ELSE r.status END,
 'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::jsonb)
 FROM (SELECT * FROM private_content.player_management_requests r
       WHERE r.applicant_user_id=auth.uid() ORDER BY r.created_at DESC LIMIT 20) r;
$func$;
REVOKE ALL ON FUNCTION private_content.player_management_request_status() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private_content.player_management_review_decide(
 p_request_id uuid,p_approve boolean,p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid(); req private_content.player_management_requests%rowtype;
BEGIN
 IF actor IS NULL OR p_request_id IS NULL
  OR (p_approve AND (p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9._:/-]{8,100}$'))
 THEN RETURN false; END IF;
 SELECT * INTO req FROM private_content.player_management_requests
  WHERE id=p_request_id AND status='pending' FOR UPDATE;
 IF NOT FOUND OR req.applicant_user_id=actor THEN RETURN false; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM private_content.player_management_reviewers v
   JOIN public.players p ON p.dbv_id=req.player_dbv_id
   WHERE v.user_id=actor AND v.revoked_at IS NULL
    AND v.independent_channel=req.preferred_channel
    AND (v.club_scope=p.club OR (v.independent_channel='association_official' AND v.club_scope='*'))
 ) THEN RETURN false; END IF;
 UPDATE private_content.player_management_requests SET
  status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewer_user_id=actor, reviewed_at=now(),
  review_reference=CASE WHEN p_approve THEN p_reference ELSE NULL END
 WHERE id=p_request_id;
 IF p_approve THEN
  INSERT INTO public.player_publication_grants
   (user_id,player_dbv_id,verification_method,reviewed_by,verified_at,revoked_at)
  VALUES(req.applicant_user_id,req.player_dbv_id,
    CASE WHEN req.preferred_channel='parent_confirmed' THEN 'adult_player_review' ELSE 'club_review' END,
    'reviewer:'||actor::text,now(),NULL)
  ON CONFLICT(user_id,player_dbv_id) DO UPDATE SET
   verification_method=EXCLUDED.verification_method,
   reviewed_by=EXCLUDED.reviewed_by,verified_at=now(),revoked_at=NULL;
 END IF;
 RETURN true;
END
$func$;
REVOKE ALL ON FUNCTION private_content.player_management_review_decide(uuid,boolean,text) FROM PUBLIC,anon,authenticated;

-- The RPC wrappers accept technical anonymous Auth sessions, but NEVER grant
-- rights by themselves. Only a separately vetted reviewer can approve.
CREATE OR REPLACE FUNCTION public.private_player_manage_request(p_player_dbv_id text,p_channel text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $func$ SELECT private_content.player_management_request_create(p_player_dbv_id,p_channel) $func$;
CREATE OR REPLACE FUNCTION public.private_player_manage_status()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $func$ SELECT private_content.player_management_request_status() $func$;
CREATE OR REPLACE FUNCTION public.private_player_manage_review(p_request_id uuid,p_approve boolean,p_reference text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $func$ SELECT private_content.player_management_review_decide(p_request_id,p_approve,p_reference) $func$;
REVOKE ALL ON FUNCTION public.private_player_manage_request(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_player_manage_status() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_player_manage_review(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_manage_request(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_manage_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_manage_review(uuid,boolean,text) TO authenticated;

-- Every invitation created before this migration defaults to version 1.
ALTER TABLE private_content.player_access_invites
 ADD COLUMN IF NOT EXISTS scope_version smallint NOT NULL DEFAULT 1;
ALTER TABLE private_content.player_access_invites
 ADD COLUMN IF NOT EXISTS granted_sections text[] NOT NULL DEFAULT ARRAY['profile','matches']::text[];
ALTER TABLE private_content.player_access_invites
 ADD CONSTRAINT player_invite_scope_contract_v127 CHECK (
  (scope_version=1 AND granted_sections=ARRAY['profile','matches']::text[])
  OR (scope_version=2 AND granted_sections=ARRAY['profile','trophies','matches']::text[])
 );
-- Replace only creation. Acceptance/revocation/legacy session reads remain unchanged.
-- Disabled after the migration: old cached clients must not create
-- v2 links without first disclosing their complete scope.
CREATE OR REPLACE FUNCTION private_content.player_access_invite_create(p_token text,p_player_dbv_id text)
RETURNS TABLE(invitation_id uuid,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION 'Updated client with explicit sharing scope required' USING errcode='42501';
END
$fn$;
CREATE OR REPLACE FUNCTION private_content.player_access_invite_create_v2(p_token text,p_player_dbv_id text,p_scope_confirmation text)
RETURNS TABLE(invitation_id uuid,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF p_scope_confirmation IS DISTINCT FROM 'profile+trophies+matches:v2' THEN RAISE EXCEPTION 'explicit v2 scope required' USING errcode='22023'; END IF;
 IF actor IS NULL OR p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$'
  OR p_player_dbv_id IS NULL OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
 THEN RAISE EXCEPTION 'invalid invitation input' USING errcode='22023'; END IF;
 IF NOT private_content.has_independent_player_grant(actor,p_player_dbv_id)
 THEN RAISE EXCEPTION 'independent player verification required' USING errcode='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,115));
 IF (SELECT count(*) FROM private_content.player_access_invites i
     WHERE i.owner_user_id=actor AND i.created_at>now()-interval '24 hours')>=10
 THEN RAISE EXCEPTION 'invitation quota reached' USING errcode='22023'; END IF;
 IF (SELECT count(*) FROM private_content.player_access_invites i
     WHERE i.owner_user_id=actor AND i.revoked_at IS NULL
      AND (i.expires_at>now() OR i.accepted_at IS NOT NULL))>=20
 THEN RAISE EXCEPTION 'active invitation quota reached' USING errcode='22023'; END IF;
 RETURN QUERY INSERT INTO private_content.player_access_invites
  (owner_user_id,player_dbv_id,token_digest,scope_version,granted_sections)
 VALUES(actor,p_player_dbv_id,extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256'),
        2,ARRAY['profile','trophies','matches']::text[])
 RETURNING id,private_content.player_access_invites.expires_at;
END
$func$;
REVOKE ALL ON FUNCTION private_content.player_access_invite_create_v2(text,text) FROM PUBLIC,anon;
-- authenticated retains explicit EXECUTE as in existing v125.

GRANT EXECUTE ON FUNCTION private_content.player_access_invite_create_v2(text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.private_player_invite_create_v2(p_token text,p_player_dbv_id text,p_scope_confirmation text)
RETURNS TABLE(invitation_id uuid,expires_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $fn$ SELECT * FROM private_content.player_access_invite_create_v2(p_token,p_player_dbv_id,p_scope_confirmation) $fn$;
REVOKE ALL ON FUNCTION public.private_player_invite_create_v2(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_invite_create_v2(text,text,text) TO authenticated;

-- A version-2 recipient must retain a valid independently reviewed issuer
-- for acceptance, profile and match reads; v1 stays unchanged.
CREATE OR REPLACE FUNCTION private_content.player_access_invite_accept(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE visitor uuid:=auth.uid(); invite uuid;
BEGIN
 IF visitor IS NULL THEN RAISE EXCEPTION 'technical anonymous session required' USING errcode='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$'
 THEN RETURN NULL; END IF;
 UPDATE private_content.player_access_invites i SET accepted_by=visitor,accepted_at=now()
 WHERE i.token_digest=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
  AND i.accepted_by IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()
  AND EXISTS(SELECT 1 FROM public.player_publication_grants g
    WHERE g.user_id=i.owner_user_id AND g.player_dbv_id=i.player_dbv_id AND g.revoked_at IS NULL)
  AND (i.scope_version=1 OR (i.scope_version=2
       AND private_content.has_independent_player_grant(i.owner_user_id,i.player_dbv_id)))
 RETURNING i.id INTO invite;
 RETURN invite;
END
$func$;

CREATE OR REPLACE FUNCTION private_content.player_access_session_read(p_invitation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE player_id text; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_invitation_id IS NULL THEN RETURN NULL; END IF;
 SELECT i.player_dbv_id INTO player_id FROM private_content.player_access_invites i
 WHERE i.id=p_invitation_id AND i.accepted_by=auth.uid()
  AND i.accepted_at IS NOT NULL AND i.revoked_at IS NULL
  -- The seven days limit acceptance, not an accepted link's lifetime.
  AND EXISTS(SELECT 1 FROM public.player_publication_grants g
    WHERE g.user_id=i.owner_user_id AND g.player_dbv_id=i.player_dbv_id AND g.revoked_at IS NULL)
  AND (i.scope_version=1 OR (i.scope_version=2
       AND private_content.has_independent_player_grant(i.owner_user_id,i.player_dbv_id)))
 LIMIT 1;
 IF player_id IS NULL THEN RETURN NULL; END IF;
 SELECT jsonb_build_object(
  'player',jsonb_build_object(
   'dbv_id',p.dbv_id,'name',p.name,'club',p.club,
   'birth_year',p.birth_year,'age_class',p.age_class),
  'matches',coalesce((
   SELECT jsonb_agg(to_jsonb(m)) FROM (
    SELECT f.match_date,f.discipline,f.competition,f.category,
     f.player_side,f.winning_side,f.games,f.source_name,f.source_url
    FROM public.player_external_match_facts f
    WHERE f.dbv_id=p.dbv_id AND f.match_date IS NOT NULL
    ORDER BY f.match_date DESC,f.source_key DESC LIMIT 30
   ) m),'[]'::jsonb)
 ) INTO result FROM public.players p WHERE p.dbv_id=player_id;
 RETURN result;
END
$func$;
REVOKE ALL ON FUNCTION private_content.player_access_invite_accept(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private_content.player_access_session_read(uuid) FROM PUBLIC,anon;

-- The client must refuse to create old-scope links against a stale backend.
CREATE OR REPLACE FUNCTION public.private_player_scope_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$ SELECT jsonb_build_object('scope_version',2,
  'sections',jsonb_build_array('profile','trophies','matches')) $func$;
REVOKE ALL ON FUNCTION public.private_player_scope_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_scope_capabilities() TO authenticated;

-- All records originate from the private v126 hard archive. Only individual
-- sourced Top-4 placements corroborated by the preserved verified chronology,
-- qualify. New results need the same curated verified evidence before being counted.
CREATE OR REPLACE FUNCTION private_content.scoped_trophy_projection(p_dbv_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $func$
 WITH filtered AS (
  SELECT DISTINCT ON ((e.payload->>'source_url'),(e.payload->>'event_date'),
      (e.payload->>'discipline'),(e.payload->>'age_group'),(e.payload->>'placement'))
   e.source_key,e.payload
  FROM private_content.spvgg_archive_evidence e
  WHERE e.dbv_id=p_dbv_id AND e.kind='placement'
   AND (e.payload->>'placement') ~ '^[1-4]$'
   AND (e.payload->>'source_url') ~ '^https://'
   AND EXISTS (
      SELECT 1 FROM private_content.source_snapshots s
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN s.source_key='data/history.json'
          AND jsonb_typeof(s.document->'results')='array'
        THEN s.document->'results' ELSE '[]'::jsonb END) v(result)
      WHERE s.source_key='data/history.json'
       AND v.result->>'verified'='true'
       AND v.result->>'playerId'=p_dbv_id
       AND v.result->>'date'=e.payload->>'event_date'
       AND v.result->>'discipline'=e.payload->>'discipline'
       AND v.result->>'place'=e.payload->>'placement'
       AND v.result->'source'->>'url'=e.payload->>'source_url'
   )
  ORDER BY (e.payload->>'source_url'),(e.payload->>'event_date'),
           (e.payload->>'discipline'),(e.payload->>'age_group'),
           (e.payload->>'placement'),e.source_key
 ), bounded AS (
 SELECT * FROM filtered ORDER BY (payload->>'event_date') DESC,source_key LIMIT 200
 )
 SELECT jsonb_build_object(
  'player_dbv_id',p_dbv_id,'coverage','partial_not_exhaustively_verified',
  'results',coalesce(jsonb_agg(jsonb_build_object(
    'id',b.source_key,'playerId',p_dbv_id,'verified',true,
    'date',b.payload->>'event_date','event',b.payload->>'tournament_name',
    'place',(b.payload->>'placement')::integer,
    'discipline',b.payload->>'discipline',
    'ageGroup',b.payload->>'age_group',
    'source',jsonb_build_object('url',b.payload->>'source_url')
  ) ORDER BY (b.payload->>'event_date') DESC,b.source_key),'[]'::jsonb))
 FROM bounded b;
$func$;
REVOKE ALL ON FUNCTION private_content.scoped_trophy_projection(text) FROM PUBLIC,anon,authenticated;

-- Invited recipient: v2 scope, same technical session, one exact player,
-- current independent issuer proof, and immediate revocation checks.
CREATE OR REPLACE FUNCTION public.private_player_trophies_read(p_invitation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE target_id text;
BEGIN
 IF auth.uid() IS NULL OR p_invitation_id IS NULL THEN RETURN NULL; END IF;
 SELECT i.player_dbv_id INTO target_id
 FROM private_content.player_access_invites i
 WHERE i.id=p_invitation_id AND i.accepted_by=auth.uid()
  AND i.accepted_at IS NOT NULL AND i.revoked_at IS NULL
  AND i.scope_version=2 AND i.granted_sections@>ARRAY['trophies']::text[]
  AND private_content.has_independent_player_grant(i.owner_user_id,i.player_dbv_id)
 LIMIT 1;
 IF target_id IS NULL THEN RETURN NULL; END IF;
 RETURN private_content.scoped_trophy_projection(target_id);
END
$func$;

-- Verified managing adult: requires independently reviewed player grant.
-- Merely following, knowing an ID, owning the site or checking a box is never enough.
CREATE OR REPLACE FUNCTION public.private_owner_trophies_read(p_player_dbv_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
BEGIN
 IF auth.uid() IS NULL OR p_player_dbv_id IS NULL
  OR p_player_dbv_id !~ '^[0-9]{2}-[0-9]{6}$'
  OR NOT private_content.has_independent_player_grant(auth.uid(),p_player_dbv_id)
 THEN RETURN NULL; END IF;
 RETURN private_content.scoped_trophy_projection(p_player_dbv_id);
END
$func$;
REVOKE ALL ON FUNCTION public.private_player_trophies_read(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.private_owner_trophies_read(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_player_trophies_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_owner_trophies_read(text) TO authenticated;
COMMIT;
