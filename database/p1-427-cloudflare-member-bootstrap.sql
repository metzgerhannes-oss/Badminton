-- Issue #427: additive Cloudflare Access identity -> short-lived Supabase membership.
-- Cloudflare JWT verification occurs server-side in cf-access-bootstrap.
-- Seeding the allowlist occurs separately from the operator's existing Access policy.
BEGIN;
CREATE TABLE IF NOT EXISTS private_content.cf_access_allowed_emails (
  email_sha256 bytea PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cf_access_approved_digest_length CHECK (octet_length(email_sha256)=32)
);
CREATE TABLE IF NOT EXISTS private_content.cf_access_verified_devices (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_sha256 bytea NOT NULL REFERENCES private_content.cf_access_allowed_emails(email_sha256),
  verified_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CONSTRAINT cf_access_valid_window CHECK (valid_until > verified_at)
);
ALTER TABLE private_content.cf_access_allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_content.cf_access_verified_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.cf_access_allowed_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private_content.cf_access_verified_devices FROM PUBLIC, anon, authenticated;

-- This function is callable *only* by the trusted Supabase Edge Function,
-- which must independently verify a signed CF Access JWT and the Supabase user.
CREATE OR REPLACE FUNCTION public.cf_access_enroll_member(
  p_user_id uuid, p_verified_email text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $enroll$
DECLARE
  v_email_hash bytea;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
     OR p_user_id IS NULL OR p_verified_email IS NULL
     OR length(p_verified_email) > 254
  THEN RETURN false; END IF;
  v_email_hash := extensions.digest(
    pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_verified_email)), 'UTF8'), 'sha256');
  IF NOT EXISTS (
    SELECT 1 FROM private_content.cf_access_allowed_emails a
     WHERE a.email_sha256=v_email_hash AND a.enabled
  ) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_user_id) THEN RETURN false; END IF;
  INSERT INTO private_content.cf_access_verified_devices
    (user_id,email_sha256,verified_at,valid_until)
  VALUES (p_user_id,v_email_hash,now(),now()+interval '24 hours')
  ON CONFLICT (user_id) DO UPDATE
   SET email_sha256=EXCLUDED.email_sha256,
       verified_at=EXCLUDED.verified_at,
       valid_until=EXCLUDED.valid_until;
  RETURN true;
END
$enroll$;
REVOKE ALL ON FUNCTION public.cf_access_enroll_member(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_access_enroll_member(uuid,text) TO service_role;

-- The prior owner and invitation paths remain intact. Cloudflare enrollment
-- is additional, revocable, and expires unless a fresh signed CF token is used.
CREATE OR REPLACE FUNCTION public.app_access_is_member()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $member$
 SELECT auth.uid() IS NOT NULL AND (
   EXISTS (SELECT 1 FROM private_content.site_owners o
           WHERE o.user_id=auth.uid() AND o.revoked_at IS NULL)
   OR EXISTS (
     SELECT 1 FROM private_content.app_access_members m
     JOIN private_content.app_access_invites i ON i.id=m.invitation_id
     WHERE m.user_id=auth.uid() AND i.revoked_at IS NULL
   )
   OR EXISTS (
     SELECT 1 FROM private_content.cf_access_verified_devices d
     JOIN private_content.cf_access_allowed_emails a
       ON a.email_sha256=d.email_sha256
     WHERE d.user_id=auth.uid() AND a.enabled
       AND d.valid_until>now()
   )
 );
 $member$;
COMMIT;
