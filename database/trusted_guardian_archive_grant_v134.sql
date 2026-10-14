-- v134: One proportional alternative for the independently verified repository
-- site owner, where an explicit guardian attestation already exists.
-- This is NOT a grant by a local profile, raw DBV ID or any anonymous user.
-- Existing independent club/association approvals remain valid unchanged.
CREATE OR REPLACE FUNCTION private_content.has_independent_player_grant(
 p_user_id uuid,p_dbv_id text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
 SELECT p_user_id IS NOT NULL
  AND p_dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
  AND (
  EXISTS (
    SELECT 1 FROM public.player_publication_grants g
    JOIN private_content.player_management_requests r
      ON r.applicant_user_id=g.user_id AND r.player_dbv_id=g.player_dbv_id
       AND r.status='approved' AND r.revoked_at IS NULL
    JOIN private_content.player_management_reviewers v
      ON v.user_id=r.reviewer_user_id AND v.revoked_at IS NULL
       AND v.independent_channel=r.preferred_channel
    JOIN public.players p ON p.dbv_id=g.player_dbv_id
      AND (v.club_scope=p.club OR
       (v.independent_channel='association_official' AND v.club_scope='*'))
    WHERE g.user_id=p_user_id AND g.player_dbv_id=p_dbv_id
      AND g.revoked_at IS NULL
      AND g.verification_method IN ('club_review','adult_player_review')
      AND g.reviewed_by='reviewer:'||r.reviewer_user_id::text
      AND g.verified_at>=r.reviewed_at
      AND r.reviewer_user_id<>r.applicant_user_id
      AND r.reviewed_at IS NOT NULL AND length(r.review_reference)>=8
  )
  OR EXISTS (
    -- Only the verified repository/site owner may attest a player as their
    -- own dependent, using the EXISTING deliberate server-side attestation.
    -- An arbitrary account (even authenticated) cannot enter this branch.
    SELECT 1 FROM public.player_publication_grants g
    JOIN private_content.site_owners o
      ON o.user_id=g.user_id AND o.revoked_at IS NULL
      AND o.verified_github_login='metzgerhannes-oss'
    WHERE g.user_id=p_user_id AND g.player_dbv_id=p_dbv_id
      AND g.revoked_at IS NULL
      AND g.verified_at IS NOT NULL
      AND g.verified_at>=o.enrolled_at
      AND g.verification_method='guardian_review'
      AND g.reviewed_by='github-owner:metzgerhannes-oss'
  )
 );
$function$;
COMMENT ON FUNCTION private_content.has_independent_player_grant(uuid,text)
 IS 'Valid grant: independently approved club/adult claim OR explicit still-active guardian attestation by verified site owner. Not a public/anonymous grant.';
