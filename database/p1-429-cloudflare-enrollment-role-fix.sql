-- #429 · A successful signed Cloudflare assertion and verified Supabase user
-- reached the service-role enrollment RPC, but it returned false. The gateway
-- can identify its service API key without setting the legacy JWT role claim.
-- Authorize by the *SQL EXECUTE grant*, never by request.jwt.claim.role.
-- No changes to the approved email hashes, RLS, existing owners or sessions.
BEGIN;
CREATE OR REPLACE FUNCTION public.cf_access_enroll_member(
  p_user_id uuid, p_verified_email text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $enroll$
DECLARE
  v_email_hash bytea;
BEGIN
  IF p_user_id IS NULL OR p_verified_email IS NULL
     OR length(p_verified_email) > 254
  THEN RETURN false; END IF;
  v_email_hash := extensions.digest(
    pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_verified_email)), 'UTF8'), 'sha256');
  IF NOT EXISTS (
    SELECT 1 FROM private_content.cf_access_allowed_emails a
    WHERE a.email_sha256=v_email_hash AND a.enabled
  ) THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id=p_user_id
  ) THEN RETURN false; END IF;
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
REVOKE ALL ON FUNCTION public.cf_access_enroll_member(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cf_access_enroll_member(uuid,text)
 TO service_role;
COMMIT;
